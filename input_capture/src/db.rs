use crate::features::FeatureVector;
use crate::hook::RawEvent;
use anyhow::Context;
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};

pub fn init_tables(conn: &Connection) -> anyhow::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS labels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts_utc TEXT NOT NULL,
            valence REAL NOT NULL,
            arousal REAL NOT NULL,
            trigger TEXT NOT NULL
        )",
        [],
    ).context("Failed to create labels table")?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS raw_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts_utc TEXT NOT NULL,
            event_type TEXT NOT NULL,
            x INTEGER, y INTEGER,
            scroll_delta INTEGER,
            button TEXT
        )",
        [],
    ).context("Failed to create raw_events table")?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS computed_features (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts_utc TEXT NOT NULL,
            mean_speed REAL NOT NULL,
            speed_variance REAL NOT NULL,
            mean_acceleration REAL NOT NULL,
            mean_jerk REAL NOT NULL,
            click_rate REAL NOT NULL,
            mean_click_duration REAL NOT NULL,
            click_interval_variance REAL NOT NULL,
            scroll_velocity REAL NOT NULL,
            scroll_direction_changes REAL NOT NULL,
            idle_ratio REAL NOT NULL,
            mean_path_curvature REAL NOT NULL
        )",
        [],
    ).context("Failed to create computed_features table")?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS training_samples (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts_utc TEXT NOT NULL,
            valence REAL NOT NULL,
            arousal REAL NOT NULL,
            trigger TEXT NOT NULL,
            mean_speed REAL NOT NULL,
            speed_variance REAL NOT NULL,
            mean_acceleration REAL NOT NULL,
            mean_jerk REAL NOT NULL,
            click_rate REAL NOT NULL,
            mean_click_duration REAL NOT NULL,
            click_interval_variance REAL NOT NULL,
            scroll_velocity REAL NOT NULL,
            scroll_direction_changes REAL NOT NULL,
            idle_ratio REAL NOT NULL,
            mean_path_curvature REAL NOT NULL
        )",
        [],
    ).context("Failed to create training_samples table")?;

    // Create indexes for faster queries
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_raw_events_ts ON raw_events(ts_utc)",
        [],
    ).context("Failed to create index on raw_events(ts_utc)")?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_labels_ts ON labels(ts_utc)",
        [],
    ).context("Failed to create index on labels(ts_utc)")?;

    Ok(())
}

pub fn insert_raw_events(conn: &Connection, events: &[RawEvent]) -> anyhow::Result<()> {
    // Write in transaction for bulk insert efficiency
    let mut stmt = conn.prepare(
        "INSERT INTO raw_events (ts_utc, event_type, x, y, scroll_delta, button) 
         VALUES (?, ?, ?, ?, ?, ?)",
    )?;

    for event in events {
        let ts_str = event.ts_utc.to_rfc3339_opts(chrono::SecondsFormat::Micros, true);
        stmt.execute(params![
            ts_str,
            event.event_type,
            event.x,
            event.y,
            event.scroll_delta,
            event.button
        ])?;
    }

    Ok(())
}

pub fn insert_computed_features(conn: &Connection, ts_utc: DateTime<Utc>, f: &FeatureVector) -> anyhow::Result<()> {
    let ts_str = ts_utc.to_rfc3339_opts(chrono::SecondsFormat::Micros, true);
    conn.execute(
        "INSERT INTO computed_features (
            ts_utc, mean_speed, speed_variance, mean_acceleration, mean_jerk,
            click_rate, mean_click_duration, click_interval_variance,
            scroll_velocity, scroll_direction_changes, idle_ratio, mean_path_curvature
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            ts_str,
            f.mean_speed,
            f.speed_variance,
            f.mean_acceleration,
            f.mean_jerk,
            f.click_rate,
            f.mean_click_duration,
            f.click_interval_variance,
            f.scroll_velocity,
            f.scroll_direction_changes,
            f.idle_ratio,
            f.mean_path_curvature
        ],
    )?;
    Ok(())
}

pub fn insert_training_sample(
    conn: &Connection,
    ts_utc: DateTime<Utc>,
    valence: f32,
    arousal: f32,
    trigger: &str,
    f: &FeatureVector,
) -> anyhow::Result<()> {
    let ts_str = ts_utc.to_rfc3339_opts(chrono::SecondsFormat::Micros, true);
    conn.execute(
        "INSERT INTO training_samples (
            ts_utc, valence, arousal, trigger,
            mean_speed, speed_variance, mean_acceleration, mean_jerk,
            click_rate, mean_click_duration, click_interval_variance,
            scroll_velocity, scroll_direction_changes, idle_ratio, mean_path_curvature
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            ts_str,
            valence,
            arousal,
            trigger,
            f.mean_speed,
            f.speed_variance,
            f.mean_acceleration,
            f.mean_jerk,
            f.click_rate,
            f.mean_click_duration,
            f.click_interval_variance,
            f.scroll_velocity,
            f.scroll_direction_changes,
            f.idle_ratio,
            f.mean_path_curvature
        ],
    )?;
    Ok(())
}

pub fn fetch_raw_events_in_range(
    conn: &Connection,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
) -> anyhow::Result<Vec<RawEvent>> {
    let start_str = start.to_rfc3339_opts(chrono::SecondsFormat::Micros, true);
    let end_str = end.to_rfc3339_opts(chrono::SecondsFormat::Micros, true);

    let mut stmt = conn.prepare(
        "SELECT ts_utc, event_type, x, y, scroll_delta, button 
         FROM raw_events 
         WHERE ts_utc >= ? AND ts_utc <= ? 
         ORDER BY ts_utc ASC",
    )?;

    let event_iter = stmt.query_map(params![start_str, end_str], |row| {
        let ts_str: String = row.get(0)?;
        let ts_utc = DateTime::parse_from_rfc3339(&ts_str)
            .map(|dt| dt.with_timezone(&Utc))
            .map_err(|e| rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e)))?;

        Ok(RawEvent {
            ts_utc,
            event_type: row.get(1)?,
            x: row.get(2)?,
            y: row.get(3)?,
            scroll_delta: row.get(4)?,
            button: row.get(5)?,
        })
    })?;

    let mut events = Vec::new();
    for event in event_iter {
        events.push(event?);
    }
    Ok(events)
}

pub fn fetch_all_labels(conn: &Connection) -> anyhow::Result<Vec<(DateTime<Utc>, f32, f32, String)>> {
    let mut stmt = conn.prepare("SELECT ts_utc, valence, arousal, trigger FROM labels ORDER BY ts_utc ASC")?;
    let label_iter = stmt.query_map([], |row| {
        let ts_str: String = row.get(0)?;
        let ts_utc = DateTime::parse_from_rfc3339(&ts_str)
            .map(|dt| dt.with_timezone(&Utc))
            .map_err(|e| rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e)))?;

        Ok((
            ts_utc,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
        ))
    })?;

    let mut labels = Vec::new();
    for label in label_iter {
        labels.push(label?);
    }
    Ok(labels)
}
