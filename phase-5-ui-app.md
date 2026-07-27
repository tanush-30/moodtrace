# Phase 5 — Tauri App Shell & UI

**Owner:** whoever's free — mostly glue code once Phases 1/3/4 expose their interfaces. **Depends on:** loose coupling to Phases 1, 3, 4 (build against mocked data first, wire in real backends as they land).

## Scope

- System tray icon (idle state indicator — e.g. icon color/shape reflects current arousal band: calm/neutral/energized).
- Self-report popup UI for Phase 0's training-mode labeling (the 2D affect grid — a simple clickable square, minimal chrome, dismissible in one click).
- Optional small dashboard window: current inferred state, currently playing track, provider toggle (Spotify/YouTube), manual override controls.
- Settings: window interval for self-report prompts, feature window size, provider credentials/login flows.

## Structure

- Tray + background logic in Rust (Tauri backend).
- Dashboard/settings/affect-grid UI in the Tauri webview (plain HTML/CSS/JS or a lightweight framework — no need for React here given the small surface area, keep it simple).
- Communicate state (current `EmotionState`, current track, provider status) from Rust to the webview via Tauri events, not polling.

## UI notes

- The affect-grid popup is the most-used screen during the project's data-collection phase — optimize ruthlessly for speed of interaction, not visual polish. One click + auto-confirm dismiss is better than a click + separate "submit" button.
- Dashboard is secondary — this is for your own debugging and demo, not really a "product" surface, so don't over-invest time here relative to the ML/pipeline work that's actually graded.
- Tray icon states should be understandable at a glance without opening the dashboard (e.g. three icon variants for calm/neutral/energized bands).

## Definition of done

- Tray icon runs persistently without a visible main window by default.
- Self-report popup fires on schedule and on hotkey, writes to Phase 0's schema, takes under 5 seconds to complete.
- Dashboard shows live `EmotionState` and current track when both Phase 3 and Phase 4 are wired in.
- Provider switch (Spotify ↔ YouTube) works without restarting the app.
