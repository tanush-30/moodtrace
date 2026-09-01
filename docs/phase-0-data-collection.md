# Phase 0 — Data Collection & Self-Labeling

**Owner:** You. **Depends on:** nothing. **Start:** today, before any other phase is "ready." **This is the critical path — everything else waits on this data existing.**

## Why this phase exists on its own

Every other phase can be built and tested with fake/synthetic data. The model in Phase 2 cannot. You need real self-labeled sessions, and you cannot compress the calendar time required to collect them by working harder — it's bounded by how many hours you spend at your PC, not by engineering effort. Start collecting the day you start the project, even with a rough throwaway collector, and swap in the real Phase 1 pipeline once it exists.

## What "labeled" means here

Use the **circumplex model of affect**: two independent axes.

- **Arousal**: low energy (drowsy/calm) ↔ high energy (excited/agitated) — this is your primary, defensible signal.
- **Valence**: negative (unpleasant/frustrated) ↔ positive (pleasant/content) — secondary, best-effort.

Collect both as continuous values, e.g. `-1.0` to `1.0` on each axis, via a simple 2D clickable grid (a square where click position = (valence, arousal)). This is the standard "affect grid" instrument used in psychology research — cite it in your report, it's not something you invented, which strengthens your methodology section.

## Deliverable

A minimal, standalone data collector (can be quick-and-dirty Python or a bare Rust binary — doesn't need Tauri polish yet) that:

1. Runs in the background continuously.
2. Every 20–30 minutes (configurable), pops a small, low-friction window: the 2D affect grid + an OK button. Must take <5 seconds to fill, or you'll get label fatigue and start clicking the same spot out of annoyance.
3. Also allow a manual hotkey trigger (e.g. `Ctrl+Alt+M`) to log a label on demand — useful right after a stressful/calm moment you notice yourself, which gives cleaner labels than waiting for the timer.
4. Records timestamp + (valence, arousal) to a local SQLite table:

```sql
CREATE TABLE labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts_utc TEXT NOT NULL,          -- ISO8601
    valence REAL NOT NULL,          -- -1.0 to 1.0
    arousal REAL NOT NULL,          -- -1.0 to 1.0
    trigger TEXT NOT NULL           -- 'scheduled' or 'manual'
);
```

5. Runs input capture (even a rough version — reuse Phase 1's hook once available) in parallel, buffering raw mouse/scroll/click events with timestamps to a second table, so features can be recomputed later for whatever window size you settle on:

```sql
CREATE TABLE raw_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts_utc TEXT NOT NULL,
    event_type TEXT NOT NULL,      -- 'move' | 'click_down' | 'click_up' | 'scroll'
    x INTEGER, y INTEGER,          -- for move/click
    scroll_delta INTEGER,          -- for scroll
    button TEXT                    -- for click: 'left'|'right'|'middle'
);
```

Storing raw events (not pre-aggregated features) is deliberate — you'll want to experiment with window sizes (30s vs 60s vs 120s) during Phase 2 without re-collecting data.

## Practical warnings

- **Label fatigue is real.** If the popup is annoying, you'll rush it and get garbage labels, which poisons the model silently — it'll train "fine" and just be wrong. Keep the UI to one click + confirm.
- **Observer effect.** You'll subconsciously behave differently once you know you're being watched, especially at first. Don't worry about this — just be aware your early sessions may be slightly biased toward "performing" calm/normal behavior, and note it as a limitation in your report. It's a known issue in this kind of research, not a flaw unique to your setup.
- **Diversity of states matters more than raw volume.** 150 samples covering genuinely different states (post-exercise, mid-deadline-stress, relaxed evening, bored lecture) beats 400 samples all collected while calmly coding at 11pm. Deliberately collect during a few different real contexts if you can.
- **Target: 150–300 labeled samples minimum** before Phase 2 training becomes meaningful. Below ~100, don't bother training yet — you'll just overfit noise.

## Definition of done

- Collector running continuously in the background without you having to manually restart it.
- At least 100 labeled samples banked before Phase 2 starts (don't block Phase 2 entirely — it can start exploratory feature analysis with a partial set, just not final training).
- Raw event log growing alongside labels, timestamps aligned so you can slice a window around any label after the fact.
