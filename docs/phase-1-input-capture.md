# Phase 1 — Input Capture & Feature Extraction (Rust)

**Owner:** Agent A. **Depends on:** nothing (can build/test against synthetic mouse data immediately). **Feeds:** Phase 0 (raw collection), Phase 3 (real-time inference).

## Scope

Low-level Windows input hooks + a rolling feature-extraction pipeline. This produces the feature vectors that both the training data (Phase 0/2) and live inference (Phase 3) consume — same code path for both, so training/serving skew isn't a problem you have to debug later.

## Hard rule

**Never capture or store keystroke characters.** Only key-down/key-up timestamps (for dwell/flight timing) if you choose to include keyboard dynamics at all. Logging actual keys typed makes this a keylogger, full stop — that's an ethics problem for your report, a Defender/AV flag problem for distribution, and honestly not needed since mouse dynamics carry most of the signal in the literature anyway. If short on time, **skip keyboard entirely** and ship mouse+scroll+click only — simpler and avoids the whole issue.

## Capture layer

Use `windows-rs` directly (not a cross-platform abstraction — you don't need portability here, and abstraction layers cost you debugging time for zero benefit on a single-target app):

```toml
[dependencies]
windows = { version = "0.58", features = [
    "Win32_Foundation",
    "Win32_UI_WindowsAndMessaging",
    "Win32_UI_Input_KeyboardAndMouse",
] }
```

Install two low-level hooks via `SetWindowsHookExW`:
- `WH_MOUSE_LL` → `WM_MOUSEMOVE`, `WM_LBUTTONDOWN/UP`, `WM_RBUTTONDOWN/UP`, `WM_MBUTTONDOWN/UP`, `WM_MOUSEWHEEL`
- `WH_KEYBOARD_LL` → only if you decide to keep keyboard timing; capture `WM_KEYDOWN`/`WM_KEYUP` timestamps only, discard the virtual-key code immediately after computing dwell time (don't even hold it in memory longer than needed)

These hooks must run on a dedicated thread with a Windows message loop (`GetMessage`/`DispatchMessage`) — they will not fire on a thread without one. This is the most common thing people get wrong first try; test it early, not after building everything else on top.

## Feature window

Rolling window, default **45 seconds** (tune later — this is why raw events are stored, not baked-in features). Recompute on a sliding basis (e.g. every 5s, using the last 45s of events) for live inference; for training, compute one feature vector per labeled sample using the window immediately preceding that label's timestamp.

### Feature set (start here, literature-supported for arousal detection)

| Feature | Computation |
|---|---|
| Mean cursor speed | `Σ dist(p_i, p_{i-1}) / dt` over window |
| Speed variance | variance of per-segment speed |
| Mean acceleration | first derivative of speed |
| Jerk (rate of accel change) | second derivative of speed — correlates well with tension/frustration in the literature |
| Click rate | clicks per minute |
| Click duration (dwell) | mean `up_ts - down_ts` per click |
| Double-click interval variance | for repeated clicks close in time |
| Scroll velocity | mean scroll delta / dt |
| Scroll direction changes | count of sign flips in scroll delta per window |
| Idle ratio | fraction of window with zero movement |
| Path curvature | deviation from straight-line movement between points |
| (optional) Key dwell/flight time | mean key-down duration, mean gap between key-up and next key-down — timing only |

11 features is plenty for a classical model on a few hundred samples — don't over-engineer the feature set before you have data to validate it against. Add more later only if evaluation in Phase 2 shows you need them.

## Output contract (what Phase 3 and Phase 0 both consume)

```rust
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
    // optional, omit column if you dropped keyboard entirely:
    pub mean_key_dwell: Option<f32>,
}
```

Serialize as a fixed-order `f32` array when writing to SQLite/passing to ONNX — order must match exactly what Phase 2's training script expects as input columns. Pin this down explicitly between Phase 1 and Phase 2 owners early — mismatched column order is a silent bug that just produces garbage predictions with no error.

## Definition of done

- Hooks reliably capture without dropping events under normal use (test with rapid clicking/scrolling, not just idle mouse movement).
- Feature extraction produces stable, sane values (sanity-check by printing features while deliberately moving the mouse fast/slow, clicking rapidly, etc. — values should visibly track).
- Raw events + computed features both written to the Phase 0 SQLite schema.
- No keystroke content anywhere in memory or storage, verifiable by code review.
