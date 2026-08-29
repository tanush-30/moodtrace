use chrono::Utc;
use input_capture::backfill::backfill_features;
use input_capture::db::init_tables;
use input_capture::features::calculate_features;
use input_capture::hook::Hook;
use input_capture::inference::InferenceEngine;
use serde_json::Value;
use std::fs;
use std::path::Path;

fn get_db_path() -> String {
    // Look for config.json in the parent directory (workspace root) or current directory
    let paths = ["../config.json", "config.json"];
    for path in &paths {
        if let Ok(content) = fs::read_to_string(path) {
            if let Ok(v) = serde_json::from_str::<Value>(&content) {
                if let Some(db_path) = v.get("db_path").and_then(|x| x.as_str()) {
                    // Resolve relative to config.json's directory
                    if Path::new(db_path).is_absolute() {
                        return db_path.to_string();
                    } else {
                        let parent = Path::new(path).parent().unwrap_or(Path::new(""));
                        if let Some(resolved) = parent.join(db_path).to_str() {
                            return resolved.to_string();
                        }
                    }
                }
            }
        }
    }
    "moodtrace.db".to_string()
}

fn get_model_paths() -> (String, String) {
    let paths = [
        ("model_arousal.onnx", "model_valence.onnx"),
        ("../model_arousal.onnx", "../model_valence.onnx"),
    ];
    for (a_path, v_path) in &paths {
        if Path::new(a_path).exists() && Path::new(v_path).exists() {
            return (a_path.to_string(), v_path.to_string());
        }
    }
    ("model_arousal.onnx".to_string(), "model_valence.onnx".to_string())
}

fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let backfill_mode = args.iter().any(|arg| arg == "--backfill");
    let monitor_mode = args.iter().any(|arg| arg == "--monitor");
    let predict_mode = args.iter().any(|arg| arg == "--predict");

    let db_path = get_db_path();
    println!("Database Path resolved to: {}", db_path);

    if backfill_mode {
        println!("Starting Feature Backfill Mode...");
        let conn = rusqlite::Connection::open(&db_path)?;
        init_tables(&conn)?;
        let count = backfill_features(&conn)?;
        println!("Successfully backfilled features for {} labels in 'training_samples'!", count);
        return Ok(());
    }

    if predict_mode {
        let (a_path, v_path) = get_model_paths();
        println!("Loading ONNX models:\n  Arousal: {}\n  Valence: {}", a_path, v_path);
        
        let mut engine = InferenceEngine::load(&a_path, &v_path)?;
        println!("ONNX Inference Engine initialized successfully.");

        println!("Starting Live Predict Mode (Interval: 5s, Window: 45s)...");
        let hook = Hook::start()?;
        let rx = hook.receiver();
        let mut buffer = Vec::new();
        let mut last_print = std::time::Instant::now();

        println!("Move mouse and interact to see live predicted emotion state updates...");
        loop {
            while let Ok(event) = rx.try_recv() {
                buffer.push(event);
            }

            if last_print.elapsed() >= std::time::Duration::from_secs(5) {
                let now = Utc::now();
                let window_start = now - chrono::Duration::seconds(45);

                buffer.retain(|e| e.ts_utc >= window_start);

                let features = calculate_features(&buffer, window_start, now);
                let state = engine.predict(&features)?;

                println!("\n=== LIVE EMOTION PREDICTION at {} ===", now.format("%Y-%m-%d %H:%M:%S"));
                println!("Events in window: {}", buffer.len());
                println!("  Inferred Arousal (smoothed): {:.4} (calm ↔ excited)", state.arousal);
                println!("  Inferred Valence (smoothed): {:.4} (negative ↔ positive)", state.valence);
                println!("  Note:                       {}", state.confidence_note);

                last_print = std::time::Instant::now();
            }

            std::thread::sleep(std::time::Duration::from_millis(50));
        }
    }

    if monitor_mode {
        println!("Starting Real-time Feature Monitor Mode (Interval: 5s, Window: 45s)...");
        let hook = Hook::start()?;
        let rx = hook.receiver();
        let mut buffer = Vec::new();
        let mut last_print = std::time::Instant::now();

        println!("Move the mouse, scroll, or click to see computed feature vectors...");
        loop {
            // Drain all events from the hook thread channel
            while let Ok(event) = rx.try_recv() {
                buffer.push(event);
            }

            if last_print.elapsed() >= std::time::Duration::from_secs(5) {
                let now = Utc::now();
                let window_start = now - chrono::Duration::seconds(45);

                // Retain only events in the last 45s
                buffer.retain(|e| e.ts_utc >= window_start);

                // Compute features
                let features = calculate_features(&buffer, window_start, now);

                println!("\n=== LIVE FEATURE VECTOR at {} ===", now.format("%Y-%m-%d %H:%M:%S"));
                println!("Captured raw events in window: {}", buffer.len());
                println!("  Mean Speed:               {:.4} px/s", features.mean_speed);
                println!("  Speed Variance:           {:.4}", features.speed_variance);
                println!("  Mean Acceleration:        {:.4} px/s²", features.mean_acceleration);
                println!("  Mean Jerk:                {:.4} px/s³", features.mean_jerk);
                println!("  Click Rate:               {:.4} clicks/min", features.click_rate);
                println!("  Mean Click Duration:      {:.4} s", features.mean_click_duration);
                println!("  Click Interval Variance:  {:.4}", features.click_interval_variance);
                println!("  Scroll Velocity:          {:.4} units/s", features.scroll_velocity);
                println!("  Scroll Direction Changes: {:.1}", features.scroll_direction_changes);
                println!("  Idle Ratio:               {:.4} ({:.1}% idle)", features.idle_ratio, features.idle_ratio * 100.0);
                println!("  Mean Path Curvature:      {:.4}", features.mean_path_curvature);

                last_print = std::time::Instant::now();
            }

            std::thread::sleep(std::time::Duration::from_millis(50));
        }
    }

    // Default: capture & log raw events in the background
    println!("Starting Background Event Logger...");
    let conn = rusqlite::Connection::open(&db_path)?;
    init_tables(&conn)?;

    let hook = Hook::start()?;
    let rx = hook.receiver();
    let mut buffer = Vec::new();
    let mut last_flush = std::time::Instant::now();

    println!("Background logger is active. Capturing mouse inputs...");
    loop {
        while let Ok(event) = rx.try_recv() {
            buffer.push(event);
        }

        let time_since_flush = last_flush.elapsed();
        if buffer.len() >= 100 || (time_since_flush >= std::time::Duration::from_secs(5) && !buffer.is_empty()) {
            if let Err(e) = input_capture::db::insert_raw_events(&conn, &buffer) {
                eprintln!("Error writing raw events to database: {:?}", e);
            } else {
                println!("Logged {} raw events to SQLite.", buffer.len());
            }
            buffer.clear();
            last_flush = std::time::Instant::now();
        }

        std::thread::sleep(std::time::Duration::from_millis(50));
    }
}
