import sqlite3
import os
import random
import math
from datetime import datetime, timedelta, timezone

DB_PATH = "moodtrace.db"

def get_iso_string(dt):
    return dt.isoformat().replace("+00:00", "Z")

def generate_data(num_samples=150):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Ensure tables exist
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS labels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts_utc TEXT NOT NULL,
            valence REAL NOT NULL,
            arousal REAL NOT NULL,
            trigger TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS raw_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts_utc TEXT NOT NULL,
            event_type TEXT NOT NULL,
            x INTEGER, y INTEGER,
            scroll_delta INTEGER,
            button TEXT
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_raw_events_ts ON raw_events(ts_utc)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_labels_ts ON labels(ts_utc)")
    conn.commit()

    print(f"Generating {num_samples} synthetic training samples in '{DB_PATH}'...")

    # Clear existing data to ensure a clean, clean set for testing
    cursor.execute("DELETE FROM labels")
    cursor.execute("DELETE FROM raw_events")
    conn.commit()

    now = datetime.now(timezone.utc)
    
    all_labels = []
    all_events = []

    # Let's space labels out by roughly 30 minutes over the last week
    base_time = now - timedelta(days=6)
    
    # Define emotional states templates (Arousal, Valence)
    states = [
        ("stressed", 0.7, -0.6),   # High Arousal, Low Valence
        ("excited", 0.8, 0.7),     # High Arousal, High Valence
        ("relaxed", -0.5, 0.6),    # Low Arousal, High Valence
        ("bored", -0.6, -0.5),     # Low Arousal, Low Valence
        ("calm", -0.4, 0.4),       # Neutral-Low Arousal, Positive Valence
        ("neutral", 0.0, 0.0),     # Baseline
    ]

    for i in range(num_samples):
        # Determine timestamp for this label
        time_offset = timedelta(minutes=30 * i + random.uniform(-10, 10))
        label_ts = base_time + time_offset
        if label_ts >= now:
            break
            
        # Choose a state template and add noise
        state_name, base_arousal, base_valence = random.choice(states)
        arousal = max(-1.0, min(1.0, base_arousal + random.normalvariate(0, 0.15)))
        valence = max(-1.0, min(1.0, base_valence + random.normalvariate(0, 0.15)))
        trigger = "scheduled" if random.random() > 0.3 else "manual"
        
        all_labels.append((get_iso_string(label_ts), valence, arousal, trigger))
        
        # Now, generate raw mouse events in the 45 seconds preceding this label
        start_ts = label_ts - timedelta(seconds=45)
        
        # Derive movement and click behaviors based on Arousal and Valence:
        # Arousal correlates with speed, click count, scroll count, and inversely with idle ratio
        # Valence correlates with movement smoothness (less curvature, lower jerk, smaller click dwell)
        
        idle_ratio = max(0.05, min(0.9, 0.4 - 0.4 * arousal + random.uniform(-0.1, 0.1)))
        click_count = max(0, int(3 + 5 * arousal + random.uniform(-1, 2)))
        scroll_count = max(0, int(2 + 4 * arousal + random.uniform(-1, 2)))
        
        # 1. Generate Mouse Movements
        # Divide 45 seconds into 0.2 second intervals (225 steps)
        total_steps = 225
        step_duration = 0.2
        
        active_steps = []
        for step in range(total_steps):
            if random.random() > idle_ratio:
                active_steps.append(step)
                
        x, y = 960, 540 # start at center of 1920x1080 screen
        
        for step in active_steps:
            step_ts = start_ts + timedelta(seconds=step * step_duration)
            
            # Speed depends on Arousal
            base_speed = 300 + 400 * arousal  # pixels per second
            step_speed = max(20, base_speed + random.normalvariate(0, 100))
            dist = (step_speed * step_duration)
            
            # Direction and curvature
            # Valence correlates with movement smoothness:
            # Low valence (frustrated/stressed): higher curvature and sudden direction changes
            # High valence (calm/excited): straight lines or smooth paths
            angle_noise = random.uniform(-math.pi, math.pi) if valence < 0 else random.uniform(-0.2, 0.2)
            angle = random.uniform(0, 2 * math.pi) + (angle_noise * (1.0 - valence))
            
            dx = int(dist * math.cos(angle))
            dy = int(dist * math.sin(angle))
            
            x = max(0, min(1920, x + dx))
            y = max(0, min(1080, y + dy))
            
            all_events.append((get_iso_string(step_ts), "move", x, y, None, None))
            
        # 2. Generate Click Events
        for _ in range(click_count):
            # choose a random time inside the 45s window
            click_sec = random.uniform(1, 44)
            click_ts_down = start_ts + timedelta(seconds=click_sec)
            
            # Click duration (dwell time):
            # Low valence (stress) leads to slightly longer clicks
            base_dwell = 0.12 - 0.05 * valence # seconds
            dwell = max(0.04, base_dwell + random.normalvariate(0, 0.03))
            click_ts_up = click_ts_down + timedelta(seconds=dwell)
            
            click_x = random.randint(100, 1800)
            click_y = random.randint(100, 1000)
            btn = "left" if random.random() > 0.15 else "right"
            
            all_events.append((get_iso_string(click_ts_down), "click_down", click_x, click_y, None, btn))
            all_events.append((get_iso_string(click_ts_up), "click_up", click_x, click_y, None, btn))
            
        # 3. Generate Scroll Events
        for _ in range(scroll_count):
            scroll_sec = random.uniform(1, 44)
            scroll_ts = start_ts + timedelta(seconds=scroll_sec)
            dy = random.choice([-1, 1])
            all_events.append((get_iso_string(scroll_ts), "scroll", None, None, dy, None))

    # Save to SQLite
    print("Writing labels...")
    cursor.executemany("""
        INSERT INTO labels (ts_utc, valence, arousal, trigger)
        VALUES (?, ?, ?, ?)
    """, all_labels)
    
    # Sort events by timestamp before inserting
    all_events.sort(key=lambda x: x[0])
    
    print(f"Writing {len(all_events)} raw input events...")
    cursor.executemany("""
        INSERT INTO raw_events (ts_utc, event_type, x, y, scroll_delta, button)
        VALUES (?, ?, ?, ?, ?, ?)
    """, all_events)
    
    conn.commit()
    conn.close()
    print("Database population completed successfully.")

if __name__ == "__main__":
    generate_data(150)
