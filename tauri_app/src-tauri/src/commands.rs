use crate::AppState;
use tauri::Manager;

#[derive(serde::Serialize)]
pub struct CurrentStateResponse {
    pub arousal: f32,
    pub valence: f32,
    pub tracking_enabled: bool,
    pub inference_interval_sec: u64,
    pub popup_interval_min: u64,
    pub window_duration_sec: i64,
    pub mean_speed: f32,
    pub mean_acceleration: f32,
    pub click_rate: f32,
    pub idle_ratio: f32,
    pub event_count: usize,
}

#[derive(serde::Serialize)]
pub struct TelemetryStats {
    pub raw_events_count: i64,
    pub labels_count: i64,
}

#[tauri::command]
pub fn get_current_state(state: tauri::State<'_, AppState>) -> CurrentStateResponse {
    let arousal = *state.current_arousal.lock().unwrap();
    let valence = *state.current_valence.lock().unwrap();
    let tracking_enabled = *state.tracking_enabled.lock().unwrap();
    let inference_interval_sec = *state.inference_interval_sec.lock().unwrap();
    let popup_interval_min = *state.popup_interval_min.lock().unwrap();
    let window_duration_sec = *state.window_duration_sec.lock().unwrap();
    
    let metrics = state.latest_metrics.lock().unwrap();

    CurrentStateResponse {
        arousal,
        valence,
        tracking_enabled,
        inference_interval_sec,
        popup_interval_min,
        window_duration_sec,
        mean_speed: metrics.mean_speed,
        mean_acceleration: metrics.mean_acceleration,
        click_rate: metrics.click_rate,
        idle_ratio: metrics.idle_ratio,
        event_count: metrics.event_count,
    }
}

#[tauri::command]
pub fn set_tracking(state: tauri::State<'_, AppState>, enabled: bool) -> Result<bool, String> {
    let mut guard = state.tracking_enabled.lock().unwrap();
    *guard = enabled;
    println!("Tauri CMD: Tracking state set to {}", enabled);
    Ok(enabled)
}

#[tauri::command]
pub fn update_settings(
    state: tauri::State<'_, AppState>,
    inference_sec: u64,
    popup_min: u64,
    window_sec: i64,
) -> Result<(), String> {
    *state.inference_interval_sec.lock().unwrap() = inference_sec.clamp(1, 60);
    *state.popup_interval_min.lock().unwrap() = popup_min;
    *state.window_duration_sec.lock().unwrap() = window_sec.clamp(10, 300);
    
    println!(
        "Tauri CMD: Settings updated (Inference: {}s, Popup: {}m, Window: {}s)",
        inference_sec, popup_min, window_sec
    );
    Ok(())
}

#[tauri::command]
pub fn get_telemetry_stats(state: tauri::State<'_, AppState>) -> Result<TelemetryStats, String> {
    let conn = rusqlite::Connection::open(&state.db_path).map_err(|e| e.to_string())?;
    
    let raw_events_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM raw_events", [], |r| r.get(0))
        .unwrap_or(0);
        
    let labels_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM labels", [], |r| r.get(0))
        .unwrap_or(0);

    Ok(TelemetryStats {
        raw_events_count,
        labels_count,
    })
}

#[tauri::command]
pub fn submit_label(
    state: tauri::State<'_, AppState>,
    valence: f32,
    arousal: f32,
) -> Result<(), String> {
    let conn = rusqlite::Connection::open(&state.db_path)
        .map_err(|e| e.to_string())?;
    
    let ts_now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO labels (ts_utc, valence, arousal, trigger) VALUES (?, ?, ?, ?)",
        rusqlite::params![ts_now, valence, arousal, "manual"],
    ).map_err(|e| e.to_string())?;

    println!("Tauri CMD: Self-label submitted: valence={:.2}, arousal={:.2}", valence, arousal);
    Ok(())
}

#[tauri::command]
pub fn trigger_affect_grid(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("self_report") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        println!("Tauri CMD: Self-report Affect Grid popup opened.");
    }
    Ok(())
}

#[tauri::command]
pub fn close_popup(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("self_report") {
        window.hide().map_err(|e| e.to_string())?;
        println!("Tauri CMD: Self-report Affect Grid popup closed.");
    }
    Ok(())
}

#[tauri::command]
pub fn hide_to_tray(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn quit_app(app_handle: tauri::AppHandle) {
    println!("Tauri CMD: Clean shutdown requested.");
    app_handle.exit(0);
}
