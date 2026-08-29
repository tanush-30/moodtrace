use crate::db::{fetch_all_labels, fetch_raw_events_in_range, insert_training_sample};
use crate::features::calculate_features;
use chrono::Duration;
use rusqlite::Connection;

pub fn backfill_features(conn: &Connection) -> anyhow::Result<usize> {
    // Clear existing training samples to prevent duplicates
    conn.execute("DELETE FROM training_samples", [])?;

    // Load all labels
    let labels = fetch_all_labels(conn)?;
    println!("Found {} labels to backfill features for.", labels.len());

    let mut backfilled_count = 0;

    for (ts_utc, valence, arousal, trigger) in labels {
        // Feature window of 45 seconds preceding the label timestamp
        let window_start = ts_utc - Duration::seconds(45);
        let window_end = ts_utc;

        // Fetch events in range
        let events = fetch_raw_events_in_range(conn, window_start, window_end)?;

        // Compute features
        let features = calculate_features(&events, window_start, window_end);

        // Insert into training samples
        insert_training_sample(conn, ts_utc, valence, arousal, &trigger, &features)?;
        backfilled_count += 1;
    }

    Ok(backfilled_count)
}
