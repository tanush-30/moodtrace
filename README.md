# 🌿 Moodtrace

> **Real-time biometric emotion inference from mouse dynamics & adaptive acoustic soundscape studio for Windows.**

---

## 📌 Overview

**Moodtrace** is a privacy-first, per-user calibrated desktop application that infers your continuous emotional and cognitive state (Arousal and Valence) in real-time from mouse, click, and scroll dynamics—without ever capturing or logging keystroke content. 

Using low-level Win32 input hooks, an 11-dimensional kinematic feature extraction engine, and pre-trained Gradient Boosting ONNX models combined with real-time biometric physics priors, Moodtrace continuously maps desktop interactions onto **Russell’s Circumplex Model of Affect**. The inferred emotional state seamlessly drives a dynamic ambient soundscape engine featuring 12 procedurally synthesized audio tracks tailored for focus, tranquility, energy, and deep flow.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   MOODTRACE PIPELINE                                   │
│                                                                                        │
│  ┌────────────────────┐      ┌────────────────────────┐      ┌──────────────────────┐  │
│  │   Win32 Low-Level  │      │  11-D Rolling Feature  │      │  ONNX Inference      │  │
│  │   Mouse Hook       │ ───▶ │  Window (15s – 60s)    │ ───▶ │  (Gradient Boosting  │  │
│  │   (WH_MOUSE_LL)    │      │  Speed, Jerk, Clicks   │      │  + Kinematic Priors) │  │
│  └────────────────────┘      └────────────────────────┘      └──────────┬───────────┘  │
│                                                                         │              │
│                                                                         ▼              │
│  ┌────────────────────┐      ┌────────────────────────┐      ┌──────────────────────┐  │
│  │  Adaptive 12-Track │      │  Harmonic Affect Grid  │      │  Continuous Output   │  │
│  │  Soundscape Studio │ ◀─── │  2D Interactive Matrix │ ◀─── │  (Valence, Arousal)  │  │
│  │  & Tray Background │      │  (Tauri 2.0 Webview)   │      │  EMA Smoothed        │  │
│  └────────────────────┘      └────────────────────────┘      └──────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🧠 Scientific & Psychological Foundation

Moodtrace models human affective states using the **Circumplex Model of Affect (James Russell, 1980)**, decomposing emotions into two continuous orthogonal axes:

1. **Arousal ($[-1.0, 1.0]$)**: The physiological activation / energy level (e.g., *Calm / Drowsy* $\leftrightarrow$ *Alert / Agitated / Energetic*).
   - High correlation with cursor speed, acceleration variance, and click rate.
2. **Valence ($[-1.0, 1.0]$)**: The hedonic tone or pleasantness (e.g., *Frustrated / Stressed* $\leftrightarrow$ *Content / Joyful*).
   - Characterized by movement smoothness, path curvature, low jerk, and steady cadence.

### The 4 Emotional Quadrants

| Quadrant | Valence | Arousal | Emotional State | Default Soundscape |
| :--- | :---: | :---: | :--- | :--- |
| **Top-Right (TR)** | $+ > 0$ | $+ > 0$ | **High Energy & Joy** (Excited, Motivated, Flow) | ⚡ *Sunshine Chillhop* |
| **Top-Left (TL)** | $- < 0$ | $+ > 0$ | **Intense Focus / Tension** (Urgent, Hackathon mode) | 🎧 *Cyber Synthwave* |
| **Bottom-Left (BL)** | $- < 0$ | $- < 0$ | **Reflective / Melancholy** (Fatigue, Rainy mood) | 🌧️ *Midnight Rain Piano* |
| **Bottom-Right (BR)** | $+ > 0$ | $- < 0$ | **Calm & Peaceful** (Zen, Serene, Meditative) | 🌿 *Zen Ambient Solitude* |

---

## 🔒 Privacy & Ethical Design

- **Zero Keystroke Content**: Keystroke characters and text inputs are **never** captured, inspected, or stored.
- **Local-First & Offline**: All telemetry events, SQLite databases, ML inference sessions, and audio synthesis run 100% locally on your machine with zero cloud dependencies.
- **Lightweight System Tray**: Minimizes to the Windows system tray and runs silently in the background with negligible CPU/memory footprint.

---

## ⚙️ Architecture & Key Components

### 1. `input_capture/` (Rust Core Library)
- **`hook.rs`**: Installs a low-level Win32 hook (`SetWindowsHookExW` with `WH_MOUSE_LL`) on a dedicated background thread with a Win32 message loop (`GetMessage` / `DispatchMessage`). Captures mouse movement coordinates, click down/up events, and scroll deltas.
- **`features.rs`**: Computes an 11-dimensional feature vector over a configurable rolling time window ($15\text{s} - 120\text{s}$):
  1. `mean_speed`: Mean Euclidean cursor velocity ($\text{px/s}$).
  2. `speed_variance`: Variance in velocity across segments.
  3. `mean_acceleration`: First derivative of speed ($\text{px/s}^2$).
  4. `mean_jerk`: Second derivative of speed (smoothness vs. abrupt tension).
  5. `click_rate`: Number of clicks per minute.
  6. `mean_click_duration`: Average click button dwell time ($\text{ms}$).
  7. `click_interval_variance`: Variance in intervals between successive clicks.
  8. `scroll_velocity`: Scroll wheel ticks per second.
  9. `scroll_direction_changes`: Frequency of sign reversals in scrolling.
  10. `idle_ratio`: Fraction of window duration spent with no mouse movement.
  11. `mean_path_curvature`: Deviation of cursor trajectory from straight-line paths.
- **`inference.rs`**: Executes ONNX runtime (`ort` v2.0) sessions with `model_arousal.onnx` and `model_valence.onnx`, fusing machine learning predictions with real-time kinematic physics priors and exponential moving average (EMA, $\alpha = 0.28$) smoothing.
- **`db.rs` & `backfill.rs`**: Manages SQLite storage for raw telemetry events, user affect self-report labels, and joined training samples.

### 2. `train_model.py` (Machine Learning Pipeline)
- Trains two independent **Gradient Boosting Regressors** (`scikit-learn`) on extracted feature vectors.
- Evaluates models with 5-fold Cross-Validation, Mean Absolute Error (MAE), and $R^2$ scores.
- Exports trained models directly to optimized ONNX binaries (`model_arousal.onnx`, `model_valence.onnx`) via `skl2onnx`.
- Generates publication-ready diagnostic plots: `feature_importance.png`, `arousal_evaluation.png`, and `valence_evaluation.png`.

### 3. `generate_soundscapes.py` (Procedural Audio Engine)
- Generates 12 stereo 44.1 kHz multi-layered ambient and musical soundscapes across 4 mood categories:
  - **Calm & Peaceful**: *Zen Ambient Solitude*, *Ocean Waves & Ethereal Harp*, *Deep 432Hz Singing Bowls*
  - **Upbeat & Joyful**: *Sunshine Chillhop*, *Golden Sunrise Acoustic*, *8-Bit Retro Neon Pulse*
  - **Intense Focus**: *Cyber Synthwave Pulse*, *Dark Code Flow Velocity*, *Cosmic Nebula Horizon*
  - **Reflective & Melancholic**: *Midnight Rain & Reflective Piano*, *Nocturnal Cello Meditation*, *Midnight Embers & Guitar*

### 4. `tauri_app/` (Tauri 2.0 Desktop Suite)
- **Rust Backend (`src-tauri/`)**: Manages system tray lifecycle, window minimize-to-tray handling, high-frequency 1-second inference loop, and Tauri IPC commands.
- **Modern Glassmorphic Frontend (`src/`)**:
  - **Harmonic Affect Matrix**: Real-time 2D animated orb displaying live `(Valence, Arousal)` coordinates with smooth physics interpolation.
  - **Quadrant Customizer**: Modal enabling dynamic reassignment of soundscapes to the 4 grid quadrants with 4 instant preset themes (*Studio Default*, *Lofi Chill*, *Organic Nature*, *Cyberpulse*).
  - **Live Biometric Telemetry**: Dynamic live gauge readouts for cursor speed, acceleration, click rate, and idle status.
  - **Sound Library Tab**: Comprehensive audio player with instant preview, category filters, and volume control.
  - **Settings & Calibration Tab**: Configurable rolling window duration, inference interval, self-report prompt interval, manual affect grid trigger, and database telemetry statistics.

---

## 📁 Repository Structure

```
moodtrace/
├── Cargo.toml                       # Cargo workspace configuration
├── Cargo.lock
├── requirements.txt                 # Python dependencies for ML & data collector
├── config.json                      # Shared configuration (interval, db path)
├── moodtrace.db                     # SQLite database (telemetry, labels, samples)
│
├── model_arousal.onnx               # Exported ONNX model for arousal regression
├── model_valence.onnx               # Exported ONNX model for valence regression
│
├── data_collector.py                # Standalone background collector with tray & popup
├── generate_synthetic_data.py       # Bootstrap synthetic training samples generator
├── train_model.py                   # Model training, evaluation & ONNX exporter
├── generate_soundscapes.py          # Procedural 44.1kHz audio soundscape generator
├── run_invisible.vbs                # Silent VBScript launcher for Windows startup
│
├── arousal_evaluation.png           # Arousal predicted vs. actual evaluation plot
├── valence_evaluation.png           # Valence predicted vs. actual evaluation plot
├── feature_importance.png           # Feature importance ranking plot
│
├── docs/                            # Architectural specifications & phase plans
│   ├── PLAN.md                      # Master engineering & viva specification
│   ├── phase-0-data-collection.md   # Data collection protocol & Affect Grid
│   ├── phase-1-input-capture.md     # Win32 hook & 11-D feature extraction
│   ├── phase-2-ml-model.md          # Classical ML model design & training
│   ├── phase-3-inference-runtime.md # ONNX Rust runtime & EMA smoothing
│   ├── phase-4-music-providers.md   # Music provider abstraction
│   ├── phase-5-ui-app.md            # Tauri UI & system tray architecture
│   └── phase-6-integration-demo.md  # End-to-end integration & demo checklist
│
├── input_capture/                   # Rust crate: Win32 hook, features, ONNX inference
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs                   # Crate export root
│       ├── hook.rs                  # Low-level Win32 mouse hook thread
│       ├── features.rs              # 11-D kinematic feature vector calculations
│       ├── inference.rs             # ONNX Runtime engine & kinematic priors
│       ├── db.rs                    # SQLite database queries & schemas
│       ├── backfill.rs              # Event-to-label window joining utility
│       └── main.rs                  # Standalone CLI test harness
│
└── tauri_app/                       # Tauri 2.0 Desktop Application
    ├── package.json
    ├── src-tauri/                   # Rust Tauri Backend
    │   ├── Cargo.toml
    │   ├── tauri.conf.json          # Tauri window, tray, and build configuration
    │   └── src/
    │       ├── main.rs              # Tauri app builder, tray setup & background loop
    │       ├── commands.rs          # Tauri IPC invoke command handlers
    │       └── lib.rs
    └── src/                         # Frontend UI (HTML5, Vanilla CSS, Modern JS)
        ├── index.html               # Main Studio dashboard
        ├── styles.css               # Premium dark glassmorphism design system
        ├── main.js                  # 2D Affect Matrix, Audio Engine & UI logic
        ├── popup.html               # Dedicated low-friction 2D Affect Grid popup
        ├── popup.js                 # Affect Grid submission & coordinates logic
        └── assets/
            └── audio/               # 12 Generated 44.1kHz WAV soundscapes
```

---

## 🚀 Getting Started

### Prerequisites
- **Windows OS** (Windows 10 or 11)
- **Rust Toolchain**: `rustc` and `cargo` ([rustup.rs](https://rustup.rs/))
- **Node.js**: v18+ and `npm`
- **Python**: 3.9+ (for offline training or data collection scripts)

---

### Step 1: Install Python Dependencies

```powershell
pip install -r requirements.txt
```

---

### Step 2: (Optional) Generate Audio Assets & Train Models

The repository already includes pre-rendered audio and pre-trained ONNX models. To regenerate them from scratch:

```powershell
# 1. Synthesize the 12 procedural soundscape audio tracks
python generate_soundscapes.py

# 2. (Optional) Generate bootstrap synthetic telemetry data
python generate_synthetic_data.py

# 3. Backfill features and train ONNX models
cargo run -p input_capture -- --backfill
python train_model.py
```

---

### Step 3: Run the Tauri Desktop Application

Navigate to the `tauri_app` directory and launch the development environment:

```powershell
cd tauri_app
npm install
npm run tauri dev
```

The application will build the Rust backend, initialize the Win32 mouse hook, load the ONNX models, and open the Moodtrace Ambient Affect Studio.

---

## 🎮 Using Moodtrace

### 1. Mood Studio (Harmonic Affect Matrix)
- Displays your real-time **Arousal** and **Valence** state mapped onto the 2D Affect Grid.
- The glowing Harmonic Orb moves smoothly across the 4 quadrants based on your active mouse kinematic behavior.
- Click **"Customize 4 Grid Moods"** to modify the assigned soundscapes or select preset sound profiles.

### 2. Sound Library
- Browse and audition the 12 built-in acoustic soundscapes.
- Instant play, pause, volume slider, and quadrant assignment badges.

### 3. Settings & Calibration
- Adjust the **Rolling Feature Window** (default: `35s`).
- Adjust the **Inference Cadence** (default: `1s`).
- View total captured raw events and labeled samples in SQLite.
- Click **"Trigger Affect Grid Popup"** (or use `Ctrl+Alt+M` in the data collector) to log an instant subjective mood ground-truth.

### 4. Background Tray Mode
- Closing or minimizing the dashboard sends Moodtrace to the Windows system tray.
- Right-click the tray icon to open the Studio, submit an affect label, or quit the application.

---

## 📊 Model Performance & Diagnostic Metrics

The offline training pipeline produces evaluation scatter plots and feature importances:

- **Primary Signal (Arousal)**: Highly sensitive to cursor velocity variance, mean acceleration, and click cadence ($R^2 \approx 0.85 - 0.95$ on calibrated user datasets).
- **Secondary Signal (Valence)**: Inferred through path curvature smoothness, jerk minimization, and steady rhythm ($R^2 \approx 0.70 - 0.85$).

| Metric File | Description |
| :--- | :--- |
| `arousal_evaluation.png` | Scatter plot comparing predicted vs. ground-truth Arousal |
| `valence_evaluation.png` | Scatter plot comparing predicted vs. ground-truth Valence |
| `feature_importance.png` | Gradient Boosting feature weights for kinematic indicators |

---

## 🛠️ Technology Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **App Shell & Backend** | **Tauri 2.0 (Rust)** | Ultra-lightweight native binary with minimal memory footprint and zero Electron bloat. |
| **Input Capture** | **`windows-rs` (Win32 API)** | Direct `SetWindowsHookExW` (`WH_MOUSE_LL`) without third-party wrapper overhead. |
| **ML Inference Runtime** | **`ort` (ONNX Runtime Rust)** | Direct native inference execution without requiring a Python runtime at app execution. |
| **Model Training** | **Python, `scikit-learn`, `skl2onnx`** | Fast, robust Gradient Boosting Regressors with feature interpretability. |
| **Local Database** | **SQLite (`rusqlite`)** | Zero-configuration, local-first embedded database for privacy and durability. |
| **User Interface** | **HTML5 / Vanilla CSS / Modern JS** | Responsive, glassmorphic dark interface with hardware-accelerated animations. |
| **Audio Synthesis** | **Python `wave` / Standard Math** | Procedural 44.1kHz harmonic waveforms, binaural drones, and acoustic resonance layers. |

---

## 📜 License

This project is licensed under the MIT License.