use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::Mutex;
use std::thread;
use chrono::{DateTime, Utc};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

use windows::Win32::Foundation::{HMODULE, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, PostThreadMessageW, SetWindowsHookExW,
    TranslateMessage, UnhookWindowsHookEx, HHOOK, MSG, MSLLHOOKSTRUCT, WH_MOUSE_LL, WM_LBUTTONDOWN,
    WM_LBUTTONUP, WM_MBUTTONDOWN, WM_MBUTTONUP, WM_MOUSEMOVE, WM_MOUSEWHEEL, WM_QUIT,
    WM_RBUTTONDOWN, WM_RBUTTONUP,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawEvent {
    pub ts_utc: DateTime<Utc>,
    pub event_type: String, // "move", "click_down", "click_up", "scroll"
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub scroll_delta: Option<i32>,
    pub button: Option<String>, // "left", "right", "middle"
}

#[allow(dead_code)]
struct SendHhook(HHOOK);
unsafe impl Send for SendHhook {}
unsafe impl Sync for SendHhook {}

static EVENT_SENDER: Lazy<Mutex<Option<Sender<RawEvent>>>> = Lazy::new(|| Mutex::new(None));
static HOOK_HANDLE: Lazy<Mutex<Option<SendHhook>>> = Lazy::new(|| Mutex::new(None));
static HOOK_THREAD_ID: Lazy<Mutex<Option<u32>>> = Lazy::new(|| Mutex::new(None));

pub struct Hook {
    receiver: Receiver<RawEvent>,
    thread_handle: Option<thread::JoinHandle<()>>,
}

impl Hook {
    pub fn start() -> anyhow::Result<Self> {
        let (tx, rx) = channel();
        
        // Store sender globally for the C-style callback
        {
            let mut sender_guard = EVENT_SENDER.lock().unwrap();
            *sender_guard = Some(tx);
        }

        let thread_handle = thread::spawn(|| {
            unsafe {
                let thread_id = GetCurrentThreadId();
                {
                    let mut id_guard = HOOK_THREAD_ID.lock().unwrap();
                    *id_guard = Some(thread_id);
                }

                // Install the low-level mouse hook
                let hhook = match SetWindowsHookExW(
                    WH_MOUSE_LL,
                    Some(hook_callback),
                    HMODULE::default(),
                    0,
                ) {
                    Ok(hook) => hook,
                    Err(e) => {
                        eprintln!("Error setting low-level mouse hook: {:?}", e);
                        return;
                    }
                };

                {
                    let mut hook_guard = HOOK_HANDLE.lock().unwrap();
                    *hook_guard = Some(SendHhook(hhook));
                }

                // Run message loop
                let mut msg = MSG::default();
                while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                    let _ = TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }

                // Clean up the hook when message loop exits
                let _ = UnhookWindowsHookEx(hhook);
                
                {
                    let mut hook_guard = HOOK_HANDLE.lock().unwrap();
                    *hook_guard = None;
                }
            }
        });

        Ok(Self {
            receiver: rx,
            thread_handle: Some(thread_handle),
        })
    }

    pub fn receiver(&self) -> &Receiver<RawEvent> {
        &self.receiver
    }
}

impl Drop for Hook {
    fn drop(&mut self) {
        // Clear global sender
        {
            let mut sender_guard = EVENT_SENDER.lock().unwrap();
            *sender_guard = None;
        }

        // Post WM_QUIT to the hook thread's message loop
        let thread_id = {
            let mut id_guard = HOOK_THREAD_ID.lock().unwrap();
            id_guard.take()
        };

        if let Some(tid) = thread_id {
            unsafe {
                // Post WM_QUIT (0x0012) to the thread
                let _ = PostThreadMessageW(tid, WM_QUIT, WPARAM(0), LPARAM(0));
            }
        }

        if let Some(handle) = self.thread_handle.take() {
            let _ = handle.join();
        }
    }
}

unsafe extern "system" fn hook_callback(ncode: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if ncode >= 0 {
        let msg = wparam.0 as u32;
        let info = unsafe { *(lparam.0 as *const MSLLHOOKSTRUCT) };

        let mut event_type = None;
        let mut x = None;
        let mut y = None;
        let mut scroll_delta = None;
        let mut button = None;

        match msg {
            WM_MOUSEMOVE => {
                event_type = Some("move".to_string());
                x = Some(info.pt.x);
                y = Some(info.pt.y);
            }
            WM_LBUTTONDOWN => {
                event_type = Some("click_down".to_string());
                button = Some("left".to_string());
                x = Some(info.pt.x);
                y = Some(info.pt.y);
            }
            WM_LBUTTONUP => {
                event_type = Some("click_up".to_string());
                button = Some("left".to_string());
                x = Some(info.pt.x);
                y = Some(info.pt.y);
            }
            WM_RBUTTONDOWN => {
                event_type = Some("click_down".to_string());
                button = Some("right".to_string());
                x = Some(info.pt.x);
                y = Some(info.pt.y);
            }
            WM_RBUTTONUP => {
                event_type = Some("click_up".to_string());
                button = Some("right".to_string());
                x = Some(info.pt.x);
                y = Some(info.pt.y);
            }
            WM_MBUTTONDOWN => {
                event_type = Some("click_down".to_string());
                button = Some("middle".to_string());
                x = Some(info.pt.x);
                y = Some(info.pt.y);
            }
            WM_MBUTTONUP => {
                event_type = Some("click_up".to_string());
                button = Some("middle".to_string());
                x = Some(info.pt.x);
                y = Some(info.pt.y);
            }
            WM_MOUSEWHEEL => {
                event_type = Some("scroll".to_string());
                // The scroll delta is stored in the high word of mouseData
                let mouse_data = (info.mouseData >> 16) as i16;
                scroll_delta = Some(mouse_data as i32);
            }
            _ => {}
        }

        if let Some(et) = event_type {
            let event = RawEvent {
                ts_utc: Utc::now(),
                event_type: et,
                x,
                y,
                scroll_delta,
                button,
            };
            if let Ok(guard) = EVENT_SENDER.lock() {
                if let Some(ref tx) = *guard {
                    let _ = tx.send(event);
                }
            }
        }
    }

    unsafe { CallNextHookEx(None, ncode, wparam, lparam) }
}
