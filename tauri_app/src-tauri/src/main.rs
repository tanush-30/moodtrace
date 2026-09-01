#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use std::sync::Mutex;
use std::time::Instant;
use chrono::Utc;
use tauri::Manager;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};

use input_capture::features::calculate_features;
use input_capture::hook::Hook;
use input_capture::inference::InferenceEngine;

#[derive(Default, Clone, Copy)]
pub struct LatestMetrics {
    pub mean_speed: f32,
    pub mean_acceleration: f32,
    pub click_rate: f32,
    pub idle_ratio: f32,
    pub event_count: usize,
}

pub struct AppState {
    pub db_path: String,
    pub current_arousal: Mutex<f32>,
    pub current_valence: Mutex<f32>,
    pub tracking_enabled: Mutex<bool>,
    pub inference_interval_sec: Mutex<u64>,
    pub popup_interval_min: Mutex<u64>,
    pub window_duration_sec: Mutex<i64>,
    pub latest_metrics: Mutex<LatestMetrics>,
}

fn resolve_db_path() -> String {
    let paths = ["../../moodtrace.db", "../moodtrace.db", "moodtrace.db"];
    for path in &paths {
        if std::path::Path::new(path).exists() {
            return path.to_string();
        }
    }
    "moodtrace.db".to_string()
}

fn resolve_model_paths() -> (String, String) {
    let check_paths = [
        ("../../model_arousal.onnx", "../../model_valence.onnx"),
        ("../model_arousal.onnx", "../model_valence.onnx"),
        ("model_arousal.onnx", "model_valence.onnx"),
    ];

    for (a_path, v_path) in &check_paths {
        if std::path::Path::new(a_path).exists() && std::path::Path::new(v_path).exists() {
            return (a_path.to_string(), v_path.to_string());
        }
    }
    ("model_arousal.onnx".to_string(), "model_valence.onnx".to_string())
}

fn main() {
    let db_path = resolve_db_path();
    println!("Moodtrace: Database path resolved to: {}", db_path);

    let state = AppState {
        db_path,
        current_arousal: Mutex::new(-0.4),
        current_valence: Mutex::new(0.6),
        tracking_enabled: Mutex::new(true),
        inference_interval_sec: Mutex::new(5),
        popup_interval_min: Mutex::new(10),
        window_duration_sec: Mutex::new(45),
        latest_metrics: Mutex::new(LatestMetrics::default()),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::get_current_state,
            commands::set_tracking,
            commands::update_settings,
            commands::get_telemetry_stats,
            commands::submit_label,
            commands::trigger_affect_grid,
            commands::close_popup,
            commands::hide_to_tray,
            commands::quit_app
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // When user closes the dashboard, minimize to system tray instead of exiting
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                    println!("Moodtrace: Dashboard minimized to system tray.");
                }
            }
        })
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Explicitly show, unminimize, and bring the main window to front on launch
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }

            // Load tray icons from compiled bytes
            let calm_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray_calm.png")).unwrap();
            let neutral_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray_neutral.png")).unwrap();
            let energized_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray_energized.png")).unwrap();

            // Build Tray Context Menu
            let show_i = MenuItem::with_id(app, "show_dashboard", "Open Dashboard", true, None::<&str>)?;
            let report_i = MenuItem::with_id(app, "self_report", "Log Mood (Self-Report)", true, None::<&str>)?;
            let toggle_i = MenuItem::with_id(app, "toggle_tracking", "Pause / Resume Tracking", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit Moodtrace", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &report_i, &toggle_i, &quit_i])?;

            // Build system tray icon
            let _tray = TrayIconBuilder::with_id("main")
                .tooltip("Moodtrace (Running in Background)")
                .icon(neutral_icon.clone())
                .menu(&menu)
                .on_menu_event(move |app_h, event| {
                    match event.id.as_ref() {
                        "show_dashboard" => {
                            if let Some(window) = app_h.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        "self_report" => {
                            if let Some(window) = app_h.get_webview_window("self_report") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "toggle_tracking" => {
                            let app_state = app_h.state::<AppState>();
                            let mut tracking = app_state.tracking_enabled.lock().unwrap();
                            *tracking = !*tracking;
                            println!("Tray: Tracking toggled to {}", *tracking);
                        }
                        "quit" => {
                            app_h.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(move |tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            if is_visible {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // Background Hook & Inference OS Thread
            std::thread::spawn(move || {
                let (a_path, v_path) = resolve_model_paths();
                println!("Moodtrace background: Loading ONNX models:\n  Arousal: {}\n  Valence: {}", a_path, v_path);

                let mut engine = match InferenceEngine::load(&a_path, &v_path) {
                    Ok(eng) => Some(eng),
                    Err(e) => {
                        eprintln!("Moodtrace background: Warning: Could not load ONNX models: {:?}", e);
                        None
                    }
                };

                let hook = match Hook::start() {
                    Ok(h) => Some(h),
                    Err(e) => {
                        eprintln!("Moodtrace background: Warning: Could not start mouse hook: {:?}", e);
                        None
                    }
                };

                let rx = hook.as_ref().map(|h| h.receiver());
                let mut buffer = Vec::new();
                let mut last_predict = Instant::now();
                let mut last_popup = Instant::now();

                println!("Moodtrace background tracking loop running.");

                loop {
                    let app_state = app_handle.state::<AppState>();
                    let tracking_active = *app_state.tracking_enabled.lock().unwrap();

                    // Pull events from hook
                    if let Some(ref r) = rx {
                        while let Ok(event) = r.try_recv() {
                            if tracking_active {
                                buffer.push(event);
                            }
                        }
                    }

                    let interval_secs = *app_state.inference_interval_sec.lock().unwrap();
                    let window_dur_secs = *app_state.window_duration_sec.lock().unwrap();
                    let popup_mins = *app_state.popup_interval_min.lock().unwrap();

                    if tracking_active && last_predict.elapsed() >= std::time::Duration::from_secs(interval_secs) {
                        last_predict = Instant::now();

                        let now = Utc::now();
                        let window_start = now - chrono::Duration::seconds(window_dur_secs);
                        buffer.retain(|e| e.ts_utc >= window_start);

                        let features = calculate_features(&buffer, window_start, now);

                        // Update latest metrics for UI
                        {
                            let mut m = app_state.latest_metrics.lock().unwrap();
                            m.mean_speed = features.mean_speed;
                            m.mean_acceleration = features.mean_acceleration;
                            m.click_rate = features.click_rate;
                            m.idle_ratio = features.idle_ratio;
                            m.event_count = buffer.len();
                        }

                        // Run ONNX inference if model is available
                        if let Some(ref mut eng) = engine {
                            if let Ok(state) = eng.predict(&features) {
                                {
                                    *app_state.current_arousal.lock().unwrap() = state.arousal;
                                    *app_state.current_valence.lock().unwrap() = state.valence;
                                }

                                // Update system tray icon based on arousal
                                if let Some(tray) = app_handle.tray_by_id("main") {
                                    let icon = if state.arousal > 0.3 {
                                        energized_icon.clone()
                                    } else if state.arousal < -0.3 {
                                        calm_icon.clone()
                                    } else {
                                        neutral_icon.clone()
                                    };
                                    let _ = tray.set_icon(Some(icon));
                                }
                            }
                        }
                    }

                    // Scheduled Self-Report popup
                    if popup_mins > 0 && last_popup.elapsed() >= std::time::Duration::from_secs(popup_mins * 60) {
                        last_popup = Instant::now();
                        if let Some(window) = app_handle.get_webview_window("self_report") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            println!("Moodtrace: Scheduled Affect Grid popup shown.");
                        }
                    }

                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
