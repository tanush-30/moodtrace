use crate::hook::RawEvent;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct FeatureVector {
    pub mean_speed: f32,
    pub speed_variance: f32,
    pub mean_acceleration: f32,
    pub mean_jerk: f32,
    pub click_rate: f32,
    pub mean_click_duration: f32,
    pub click_interval_variance: f32,
    pub scroll_velocity: f32,
    pub scroll_direction_changes: f32,
    pub idle_ratio: f32,
    pub mean_path_curvature: f32,
}

impl FeatureVector {
    pub fn to_array(&self) -> [f32; 11] {
        [
            self.mean_speed,
            self.speed_variance,
            self.mean_acceleration,
            self.mean_jerk,
            self.click_rate,
            self.mean_click_duration,
            self.click_interval_variance,
            self.scroll_velocity,
            self.scroll_direction_changes,
            self.idle_ratio,
            self.mean_path_curvature,
        ]
    }
}

pub fn calculate_features(events: &[RawEvent], window_start: DateTime<Utc>, window_end: DateTime<Utc>) -> FeatureVector {
    let window_duration_secs = (window_end - window_start).num_milliseconds() as f64 / 1000.0;
    if window_duration_secs <= 0.0 || events.is_empty() {
        return empty_feature_vector();
    }

    // Sort events chronologically to be absolutely sure
    let mut sorted_events = events.to_vec();
    sorted_events.sort_by_key(|e| e.ts_utc);

    // -------------------------------------------------------------------------
    // 1. Extract Points (movement and clicks with coordinates)
    // -------------------------------------------------------------------------
    struct Point {
        t: f64, // time offset in seconds since window_start
        x: f64,
        y: f64,
    }

    let mut points = Vec::new();
    for e in &sorted_events {
        if let (Some(x), Some(y)) = (e.x, e.y) {
            let t = (e.ts_utc - window_start).num_milliseconds() as f64 / 1000.0;
            points.push(Point { t, x: x as f64, y: y as f64 });
        }
    }

    // -------------------------------------------------------------------------
    // 2. Compute Speed, Acceleration, Jerk
    // -------------------------------------------------------------------------
    let mut speeds = Vec::new();
    let mut speed_times = Vec::new();

    for idx in 1..points.len() {
        let p0 = &points[idx - 1];
        let p1 = &points[idx];
        let dt = p1.t - p0.t;
        if dt > 0.0 {
            let dist = ((p1.x - p0.x).powi(2) + (p1.y - p0.y).powi(2)).sqrt();
            let speed = dist / dt;
            speeds.push(speed);
            speed_times.push(p1.t); // speed is mapped to the end point of the segment
        }
    }

    let mean_speed = if !speeds.is_empty() {
        speeds.iter().sum::<f64>() / speeds.len() as f64
    } else {
        0.0
    };

    let speed_variance = if speeds.len() > 1 {
        let sum_sq_diff: f64 = speeds.iter().map(|&v| (v - mean_speed).powi(2)).sum();
        sum_sq_diff / (speeds.len() - 1) as f64
    } else {
        0.0
    };

    let mut accelerations = Vec::new();
    let mut accel_times = Vec::new();

    for idx in 1..speeds.len() {
        let t0 = speed_times[idx - 1];
        let t1 = speed_times[idx];
        let dt = t1 - t0;
        if dt > 0.0 {
            let accel = (speeds[idx] - speeds[idx - 1]) / dt;
            accelerations.push(accel.abs()); // absolute value represents physical effort/tension
            accel_times.push(t1);
        }
    }

    let mean_acceleration = if !accelerations.is_empty() {
        accelerations.iter().sum::<f64>() / accelerations.len() as f64
    } else {
        0.0
    };

    let mut jerks = Vec::new();
    for idx in 1..accelerations.len() {
        let t0 = accel_times[idx - 1];
        let t1 = accel_times[idx];
        let dt = t1 - t0;
        if dt > 0.0 {
            let jerk = (accelerations[idx] - accelerations[idx - 1]) / dt;
            jerks.push(jerk.abs());
        }
    }

    let mean_jerk = if !jerks.is_empty() {
        jerks.iter().sum::<f64>() / jerks.len() as f64
    } else {
        0.0
    };

    // -------------------------------------------------------------------------
    // 3. Click Features
    // -------------------------------------------------------------------------
    let click_downs: Vec<&RawEvent> = sorted_events
        .iter()
        .filter(|e| e.event_type == "click_down")
        .collect();

    let click_rate = (click_downs.len() as f64 * 60.0) / window_duration_secs;

    // Click durations mapping
    let mut click_durations = Vec::new();
    let mut active_clicks: std::collections::HashMap<String, DateTime<Utc>> = std::collections::HashMap::new();

    for e in &sorted_events {
        if e.event_type == "click_down" {
            if let Some(ref btn) = e.button {
                active_clicks.insert(btn.clone(), e.ts_utc);
            }
        } else if e.event_type == "click_up" {
            if let Some(ref btn) = e.button {
                if let Some(down_ts) = active_clicks.remove(btn) {
                    let dur = (e.ts_utc - down_ts).num_milliseconds() as f64 / 1000.0;
                    if dur >= 0.0 {
                        click_durations.push(dur);
                    }
                }
            }
        }
    }

    let mean_click_duration = if !click_durations.is_empty() {
        click_durations.iter().sum::<f64>() / click_durations.len() as f64
    } else {
        0.0
    };

    // Click intervals variance (intervals between consecutive click downs)
    let mut click_intervals = Vec::new();
    for idx in 1..click_downs.len() {
        let int = (click_downs[idx].ts_utc - click_downs[idx - 1].ts_utc).num_milliseconds() as f64 / 1000.0;
        if int >= 0.0 {
            click_intervals.push(int);
        }
    }

    let click_interval_variance = if click_intervals.len() > 1 {
        let mean_int = click_intervals.iter().sum::<f64>() / click_intervals.len() as f64;
        let sum_sq_diff: f64 = click_intervals.iter().map(|&int| (int - mean_int).powi(2)).sum();
        sum_sq_diff / (click_intervals.len() - 1) as f64
    } else {
        0.0
    };

    // -------------------------------------------------------------------------
    // 4. Scroll Features
    // -------------------------------------------------------------------------
    let scrolls: Vec<&RawEvent> = sorted_events
        .iter()
        .filter(|e| e.event_type == "scroll")
        .collect();

    let total_scroll_delta: i32 = scrolls.iter().map(|e| e.scroll_delta.unwrap_or(0).abs()).sum();
    let scroll_velocity = total_scroll_delta as f64 / window_duration_secs;

    let mut scroll_direction_changes = 0.0;
    let mut last_scroll_sign: Option<i32> = None;
    for s in &scrolls {
        if let Some(delta) = s.scroll_delta {
            if delta != 0 {
                let sign = if delta > 0 { 1 } else { -1 };
                if let Some(last_sign) = last_scroll_sign {
                    if sign != last_sign {
                        scroll_direction_changes += 1.0;
                    }
                }
                last_scroll_sign = Some(sign);
            }
        }
    }

    // -------------------------------------------------------------------------
    // 5. Idle Ratio (100ms bins)
    // -------------------------------------------------------------------------
    let num_bins = (window_duration_secs * 10.0).round() as usize;
    let idle_ratio = if num_bins > 0 {
        let mut occupied_bins = vec![false; num_bins];
        for e in &sorted_events {
            let offset = (e.ts_utc - window_start).num_milliseconds() as f64 / 100.0;
            let bin_idx = offset.floor() as usize;
            if bin_idx < num_bins {
                occupied_bins[bin_idx] = true;
            }
        }
        let empty_bins = occupied_bins.iter().filter(|&&occupied| !occupied).count();
        empty_bins as f64 / num_bins as f64
    } else {
        0.0
    };

    // -------------------------------------------------------------------------
    // 6. Path Curvature (Strokes)
    // -------------------------------------------------------------------------
    // A stroke is a sequence of consecutive points where the gap between consecutive points is < 0.5s.
    let mut strokes = Vec::new();
    let mut current_stroke = Vec::new();

    for p in points {
        if current_stroke.is_empty() {
            current_stroke.push(p);
        } else {
            let prev_t = current_stroke.last().unwrap().t;
            if p.t - prev_t < 0.5 {
                current_stroke.push(p);
            } else {
                if current_stroke.len() >= 3 {
                    strokes.push(current_stroke);
                }
                current_stroke = vec![p];
            }
        }
    }
    if current_stroke.len() >= 3 {
        strokes.push(current_stroke);
    }

    let mut stroke_curvatures = Vec::new();
    for stroke in strokes {
        let start = &stroke[0];
        let end = &stroke[stroke.len() - 1];
        let straight_dist = ((end.x - start.x).powi(2) + (end.y - start.y).powi(2)).sqrt();

        let mut path_len = 0.0;
        for idx in 1..stroke.len() {
            let s0 = &stroke[idx - 1];
            let s1 = &stroke[idx];
            path_len += ((s1.x - s0.x).powi(2) + (s1.y - s0.y).powi(2)).sqrt();
        }

        if path_len > 0.0 {
            // Deviation from straight line
            let curvature = 1.0 - (straight_dist / path_len);
            stroke_curvatures.push(curvature.max(0.0).min(1.0));
        }
    }

    let mean_path_curvature = if !stroke_curvatures.is_empty() {
        stroke_curvatures.iter().sum::<f64>() / stroke_curvatures.len() as f64
    } else {
        0.0
    };

    FeatureVector {
        mean_speed: mean_speed as f32,
        speed_variance: speed_variance as f32,
        mean_acceleration: mean_acceleration as f32,
        mean_jerk: mean_jerk as f32,
        click_rate: click_rate as f32,
        mean_click_duration: mean_click_duration as f32,
        click_interval_variance: click_interval_variance as f32,
        scroll_velocity: scroll_velocity as f32,
        scroll_direction_changes: scroll_direction_changes as f32,
        idle_ratio: idle_ratio as f32,
        mean_path_curvature: mean_path_curvature as f32,
    }
}

fn empty_feature_vector() -> FeatureVector {
    FeatureVector {
        mean_speed: 0.0,
        speed_variance: 0.0,
        mean_acceleration: 0.0,
        mean_jerk: 0.0,
        click_rate: 0.0,
        mean_click_duration: 0.0,
        click_interval_variance: 0.0,
        scroll_velocity: 0.0,
        scroll_direction_changes: 0.0,
        idle_ratio: 1.0, // completely idle
        mean_path_curvature: 0.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    #[test]
    fn test_empty_events() {
        let start = Utc::now();
        let end = start + Duration::seconds(45);
        let f = calculate_features(&[], start, end);
        assert_eq!(f.mean_speed, 0.0);
        assert_eq!(f.idle_ratio, 1.0);
    }

    #[test]
    fn test_straight_line_movement() {
        let start = Utc::now();
        let mut events = Vec::new();

        for i in 0..10 {
            events.push(RawEvent {
                ts_utc: start + Duration::seconds(i as i64),
                event_type: "move".to_string(),
                x: Some((i * 10) as i32), // x moves by 10 every second
                y: Some(100),    // y is constant
                scroll_delta: None,
                button: None,
            });
        }

        let end = start + Duration::seconds(45);
        let f = calculate_features(&events, start, end);

        // Path curvature for straight line should be very close to 0.0
        assert!(f.mean_speed > 0.0);
        assert!(f.mean_path_curvature < 0.01);
    }
}
