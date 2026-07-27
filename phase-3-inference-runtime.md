# Phase 3 — ONNX Inference Runtime (Rust)

**Owner:** Agent A (continuation of Phase 1). **Depends on:** Phase 1 (feature vectors) + Phase 2 (exported `.onnx` files). **Feeds:** Phase 5 (UI displays live state), Phase 4 consumer (music selection logic).

## Scope

Load the two `.onnx` models (arousal, valence) and run inference on live feature vectors from Phase 1's rolling window, on a timer (every 5–10s is plenty — emotional state doesn't need sub-second updates).

## Dependencies

```toml
[dependencies]
ort = "2.0"          # ONNX Runtime bindings for Rust
ndarray = "0.15"      # for input tensor shaping
```

`ort` will pull the ONNX Runtime native binary automatically for most targets; for Windows this should work out of the box, but confirm the resulting binary size — bundling ONNX Runtime adds real MB to your final app, worth knowing before distribution/demo day.

## Interface

```rust
pub struct EmotionState {
    pub arousal: f32,   // -1.0 to 1.0
    pub valence: f32,   // -1.0 to 1.0
    pub confidence_note: &'static str, // e.g. "arousal: model-backed, valence: experimental"
}

pub struct InferenceEngine {
    arousal_session: ort::Session,
    valence_session: ort::Session,
}

impl InferenceEngine {
    pub fn load(arousal_model_path: &str, valence_model_path: &str) -> anyhow::Result<Self> { ... }

    pub fn predict(&self, features: &FeatureVector) -> anyhow::Result<EmotionState> {
        // 1. Convert FeatureVector to ndarray in the EXACT column order
        //    used during Phase 2 training. Mismatched order = silent garbage.
        // 2. Run both sessions
        // 3. Return EmotionState
    }
}
```

**Column order is the single most dangerous silent bug across this whole project.** Phase 1 and Phase 2 owners must agree on the exact `FEATURE_COLS` order and treat it as a frozen contract — write it down in one place both phases reference (this file is a fine place), and don't let either side reorder without updating the other.

## Smoothing

Raw per-window predictions will be noisy — apply a simple exponential moving average (EMA) over the last few predictions before exposing state to the UI/music logic, so a single weird 5-second window doesn't cause a track skip:

```rust
ema_new = alpha * raw_prediction + (1.0 - alpha) * ema_previous
```

`alpha` around 0.3 is a reasonable starting point — tune by feel during testing, this doesn't need to be scientifically derived.

## Definition of done

- Both ONNX models load without error on app startup.
- Inference runs on a timer against live Phase 1 features without blocking the UI thread (run on a background task/thread, not the Tauri main thread).
- EMA smoothing in place so state doesn't flicker track-to-track on noise.
- `EmotionState` exposed via a shared state object (e.g. `Arc<Mutex<EmotionState>>` or a Tauri event emitted to the frontend) that Phase 4/5 can read.
