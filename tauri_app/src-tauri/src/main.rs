#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use std::sync::Mutex;
use std::time::Instant;
use chrono::Utc;
use tauri::Manager;
use tauri::tray::{TrayIconBuilder, TrayIconEvent};

use input_capture::features::calculate_features;
use input_capture::hook::Hook;
use input_capture::inference::InferenceEngine;
use music_providers::MusicProvider;
use music_providers::spotify::SpotifyProvider;
use music_providers::youtube::YouTubeProvider;

pub struct AppState {
    pub db_path: String,
    pub current_arousal: Mutex<f32>,
    pub current_valence: Mutex<f32>,
    pub current_track: Mutex<Option<music_providers::Track>>,
    pub active_provider: Mutex<String>, // "spotify" or "youtube"
    pub spotify: SpotifyProvider,
    pub youtube: YouTubeProvider,
}

fn resolve_db_path() -> String {
    // Resolve relative path to moodtrace.db in parent or workspace root
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
    println!("Tauri: Database path resolved to: {}", db_path);

    // Initialize music providers and references
    {
        if let Ok(conn) = rusqlite::Connection::open(&db_path) {
            let _ = music_providers::init_track_database(&conn);
        }
    }

    let spotify = SpotifyProvider::new(&db_path, None);
    let youtube = YouTubeProvider::new(&db_path, None);

    let state = AppState {
        db_path,
        current_arousal: Mutex::new(-0.8), // starting calm
        current_valence: Mutex::new(0.5),   // starting happy
        current_track: Mutex::new(None),
        active_provider: Mutex::new("youtube".to_string()), // default to YouTube
        spotify,
        youtube,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::get_current_state,
            commands::set_provider,
            commands::submit_label,
            commands::trigger_affect_grid,
            commands::close_popup
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Load tray icon images from bytes (avoid CWD path dependencies)
            let calm_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray_calm.png")).unwrap();
            let neutral_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray_neutral.png")).unwrap();
            let energized_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray_energized.png")).unwrap();

            // Build system tray icon
            let _tray = TrayIconBuilder::with_id("main")
                .tooltip("Moodtrace")
                .icon(neutral_icon.clone())
                .on_tray_icon_event(move |tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        // Toggle Dashboard main window visibility on tray click
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            if is_visible {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // Explicitly ensure main window is visible, centered and focused on screen
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }

            // Spawn background OS thread for Hook, Inference, and Music selection to avoid future Send constraints
            std::thread::spawn(move || {
                let (a_path, v_path) = resolve_model_paths();
                println!("Tauri background: Loading model files:\n  Arousal: {}\n  Valence: {}", a_path, v_path);

                let mut engine = match InferenceEngine::load(&a_path, &v_path) {
                    Ok(eng) => eng,
                    Err(e) => {
                        eprintln!("Tauri background: Failed to load ONNX inference engine: {:?}", e);
                        return;
                    }
                };

                // Initialize Windows low-level mouse hook
                let hook = match Hook::start() {
                    Ok(h) => h,
                    Err(e) => {
                        eprintln!("Tauri background: Failed to start mouse hook: {:?}", e);
                        return;
                    }
                };

                let rx = hook.receiver();
                let mut buffer = Vec::new();
                let mut last_predict = Instant::now();
                let mut last_popup = Instant::now();

                println!("Tauri coordinator loop started successfully.");

                loop {
                    // Pull mouse events from hook
                    while let Ok(event) = rx.try_recv() {
                        buffer.push(event);
                    }

                    // Run inference prediction every 5 seconds
                    if last_predict.elapsed() >= std::time::Duration::from_secs(5) {
                        last_predict = Instant::now();

                        let now = Utc::now();
                        let window_start = now - chrono::Duration::seconds(45);
                        buffer.retain(|e| e.ts_utc >= window_start);

                        let features = calculate_features(&buffer, window_start, now);
                        
                        if let Ok(state) = engine.predict(&features) {
                            let app_state = app_handle.state::<AppState>();
                            
                            // Save prediction results
                            {
                                *app_state.current_arousal.lock().unwrap() = state.arousal;
                                *app_state.current_valence.lock().unwrap() = state.valence;
                            }

                            // Dynamic tray icon swap
                            let tray = app_handle.tray_by_id("main").unwrap();
                            let icon = if state.arousal > 0.4 {
                                energized_icon.clone()
                            } else if state.arousal < -0.4 {
                                calm_icon.clone()
                            } else {
                                neutral_icon.clone()
                            };
                            let _ = tray.set_icon(Some(icon));

                            // Find and update active track matching current emotion coordinates
                            let provider_name = app_state.active_provider.lock().unwrap().clone();
                            let target = (state.valence, state.arousal);

                            // Block on the async find_track calls using Tauri async runtime helper
                            let track_res = tauri::async_runtime::block_on(async {
                                if provider_name == "spotify" {
                                    app_state.spotify.find_track(target).await
                                } else {
                                    app_state.youtube.find_track(target).await
                                }
                            });

                            if let Ok(track) = track_res {
                                let mut track_changed = false;
                                {
                                    let mut current_track_guard = app_state.current_track.lock().unwrap();
                                    if let Some(ref current) = *current_track_guard {
                                        if current.provider_id != track.provider_id {
                                            track_changed = true;
                                        }
                                    } else {
                                        track_changed = true;
                                    }
                                    *current_track_guard = Some(track.clone());
                                }

                                if track_changed {
                                    let _ = tauri::async_runtime::block_on(async {
                                        if provider_name == "spotify" {
                                            app_state.spotify.play(&track).await
                                        } else {
                                            app_state.youtube.play(&track).await
                                        }
                                    });
                                }
                            }
                        }
                    }

                    // Periodically trigger the Affect Grid popup (every 10 minutes)
                    if last_popup.elapsed() >= std::time::Duration::from_secs(600) {
                        last_popup = Instant::now();
                        if let Some(window) = app_handle.get_webview_window("self_report") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            println!("Tauri background: Scheduled Affect Grid popup shown.");
                        }
                    }

                    // Loop pacing
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
