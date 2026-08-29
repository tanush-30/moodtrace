use crate::AppState;
use tauri::Manager;

#[derive(serde::Serialize)]
pub struct CurrentStateResponse {
    pub arousal: f32,
    pub valence: f32,
    pub track_title: String,
    pub track_artist: String,
    pub track_provider_id: String,
    pub provider: String,
}

#[tauri::command]
pub fn get_current_state(state: tauri::State<'_, AppState>) -> CurrentStateResponse {
    let arousal = *state.current_arousal.lock().unwrap();
    let valence = *state.current_valence.lock().unwrap();
    let provider = state.active_provider.lock().unwrap().clone();
    
    let track_guard = state.current_track.lock().unwrap();
    if let Some(ref track) = *track_guard {
        CurrentStateResponse {
            arousal,
            valence,
            track_title: track.title.clone(),
            track_artist: track.artist.clone(),
            track_provider_id: track.provider_id.clone(),
            provider,
        }
    } else {
        CurrentStateResponse {
            arousal,
            valence,
            track_title: "No Track Active".to_string(),
            track_artist: "".to_string(),
            track_provider_id: "".to_string(),
            provider,
        }
    }
}

#[tauri::command]
pub fn set_provider(state: tauri::State<'_, AppState>, provider: String) -> Result<(), String> {
    if provider == "spotify" || provider == "youtube" {
        let mut guard = state.active_provider.lock().unwrap();
        *guard = provider.clone();
        println!("Tauri CMD: Active music provider switched to '{}'", provider);
        
        // Reset current track so the coordinator loop immediately re-matches under the new provider
        let mut track_guard = state.current_track.lock().unwrap();
        *track_guard = None;
        
        Ok(())
    } else {
        Err("Invalid provider name".to_string())
    }
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

    println!("Tauri CMD: Manual self-label submitted: valence={:.2}, arousal={:.2}", valence, arousal);
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
