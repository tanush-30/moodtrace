# MoodTrace — Master Plan

> Working title. "MoodTrace" = mouse trace → mood trace. Rename freely, just keep it consistent across phase docs if you do.

## 1. One-liner

A Windows tray app that infers your arousal/energy state from mouse+scroll+click dynamics (no keystroke content, ever) using a locally-trained classical ML model, then queues matching tracks from your own Spotify or YouTube Music library.

## 2. Problem statement

Source idea: an app that reads emotional state from input behavior and auto-plays matching music. The naive version of this ("ML model predicts your exact emotion, hits Spotify's recommendation endpoint, plays the perfect song") doesn't survive contact with reality for two independent reasons:

1. **Spotify's Web API gutted the relevant endpoints.** `audio-features`, `audio-analysis`, and `recommendations` are 403 for any app created after Nov 27, 2024. Feb 2026 changes also killed playlist creation for new dev-mode apps. There is no official replacement.
2. **Mouse-dynamics emotion detection is a real but limited research area.** Arousal (calm↔excited) has decent literature support from movement speed/acceleration/click timing. Valence (negative↔positive mood) is weakly supported from mouse signal alone — nobody's claiming otherwise honestly.

Both facts shape the design below. This is not a workaround-free "AI startup pitch" project — it's an honest, defensible mini-project with real constraints stated up front, which is exactly what should be in your viva.

## 3. Goals / non-goals

**Goals:**
- Real, locally-trained classifier (not deep learning) on self-labeled data, output = arousal (primary) + valence (best-effort, clearly caveated) as a 2D point.
- Two working music backends (Spotify remote-control, YouTube embedded IFrame player) behind one interface.
- Local privacy-first pipeline: no keystroke content ever logged, only timing metadata. All raw input data stays on-device.
- Runs as a lightweight Windows tray app, not a foreground window you have to babysit.

**Non-goals (say these explicitly in your report so nobody expects them):**
- Not a general-purpose, ship-to-anyone emotion AI. It's per-user calibrated — your model trained on your data won't work well on someone else's mouse behavior.
- Not claiming high-accuracy valence detection. Present it as experimental/secondary.
- Not doing anything with keystroke *content* — timing only, and say so proactively, or people will assume it's a keylogger.

## 4. High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Tauri Shell (Rust + WebView)              │
│  ┌───────────────┐   ┌────────────────┐   ┌────────────────┐ │
│  │ Input Capture  │──▶│ Feature Window │──▶│ ONNX Inference │ │
│  │ (WH_MOUSE_LL/  │   │ (rolling 30-   │   │   (ort crate)  │ │
│  │  WH_KEYBOARD_LL│   │  60s buffer)   │   │                │ │
│  │  timing only)  │   └────────────────┘   └───────┬────────┘ │
│  └───────────────┘                                 │          │
│                                                     ▼          │
│  ┌───────────────┐   ┌──────────────────────────────────────┐ │
│  │ Self-Report UI │──▶│  SQLite (labeled sessions +         │ │
│  │ (training mode)│   │  local valence/energy track table)  │ │
│  └───────────────┘   └───────────────┬──────────────────────┘ │
│                                       ▼                        │
│                     ┌─────────────────────────────┐            │
│                     │  MusicProvider trait          │            │
│                     │  ├─ SpotifyProvider           │            │
│                     │  └─ YouTubeProvider (IFrame)   │            │
│                     └─────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘

Offline, separate, not shipped at runtime:
┌────────────────────────────┐
│ Python training pipeline    │
│ pandas/sklearn → skl2onnx   │──▶ model.onnx (checked into repo, loaded by Rust)
└────────────────────────────┘
```

## 5. Tech stack

| Layer | Choice | Why |
|---|---|---|
| App shell / UI / tray | Tauri (Rust) | You already decided this. Right call — no Electron bloat. |
| Input hooks | `windows-rs` (`SetWindowsHookEx`, `WH_MOUSE_LL`/`WH_KEYBOARD_LL`) | Direct Win32, no wrapper overhead |
| Feature storage | SQLite (`rusqlite`) | Zero-config, local-first, fits your existing pattern (WinTime) |
| Model training | Python: `pandas`, `scikit-learn`, `skl2onnx` | Small-data classical ML, offline only |
| Model runtime | `ort` (ONNX Runtime Rust bindings) | No Python runtime shipped in the built app |
| Spotify backend | Web API, Authorization Code + PKCE | Remote-control an already-open Premium session |
| YouTube backend | YouTube Data API v3 (search) + IFrame Player API (embedded in webview) | Official, self-contained, no separate app needed |
| Reference dataset | Kaggle "Spotify Tracks Dataset" (pre-deprecation audio features) | Local valence/energy lookup by artist+title, platform-agnostic |

## 6. Phase list & suggested agent ownership

Designed so phases 1, 2, and 4 have almost no interdependency — good split for running Codex/ChatGPT and Gemini in parallel, same pattern as SlotForge.

| Phase | Doc | Depends on | Suggested owner |
|---|---|---|---|
| 0 | `phases/phase-0-data-collection.md` | none — **start today** | You (needs to run continuously in background while other phases build) |
| 1 | `phases/phase-1-input-capture.md` | none | Agent A |
| 2 | `phases/phase-2-ml-model.md` | Phase 0 data | Agent B (or you, it's the academic core) |
| 3 | `phases/phase-3-inference-runtime.md` | Phase 1 + Phase 2 output | Agent A (continues from Phase 1) |
| 4 | `phases/phase-4-music-providers.md` | none | Agent B (parallel to Phase 2) |
| 5 | `phases/phase-5-ui-app.md` | Phases 1, 3, 4 loosely | Whoever's free — mostly glue + Tauri UI |
| 6 | `phases/phase-6-integration-demo.md` | everything | Both, together |

## 7. Timeline (rough, adjust to your actual deadline)

- **Week 1:** Phase 0 self-report collector running in background from day 1. Phases 1 and 4 in parallel.
- **Weeks 2–3:** Keep collecting labels (don't stop). Phase 2 starts once you have ~100+ labeled samples. Phase 3 starts once Phase 1 has real feature output to test against.
- **Week 4:** Phase 5 UI glue. Continue collecting labels until you have enough for a real train/test split (150–300+ recommended).
- **Final week:** Phase 6 integration, demo script rehearsal, report writing (abstract already done — see below).

**The actual bottleneck is calendar time for Phase 0, not engineering effort.** You cannot compress "collect self-labeled sessions across several days of normal computer use" by throwing more agents at it. Start it first, today, regardless of what else is ready.

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Not enough labeled data by deadline | Start Phase 0 immediately; lower popup interval if behind schedule; accept a smaller, clearly-stated sample size in the report rather than fabricating confidence |
| Valence detection is inaccurate | Report it as secondary/experimental from the start; lead with arousal as the primary, defensible result |
| Windows Defender/AV flags the low-level hook as keylogger-like | Never log key characters, only timing; disclose this clearly in-app and in the report; consider signing the binary if time allows |
| Spotify quota / YouTube Data API quota (100 units per search, ~100 searches/day free tier) | Cache search results locally after first lookup per track; don't re-query on every playback |
| Model doesn't generalize across people | Explicitly scope this as per-user calibrated in goals/non-goals — it's a feature of the design, not a bug you're hiding |
| Timeline slip | Phases 1/4 have zero interdependency — parallelize hard here to buy slack for Phase 0's data collection |

## 9. Success criteria / demo script

For the viva, a clean demo beats a technically-impressive-but-flaky one:

1. Show the self-report training UI briefly (proves real data collection happened).
2. Show a short offline evaluation: predicted vs actual arousal/valence on a held-out test split, with a plotted confusion matrix or scatter — this is your actual "ML" evidence.
3. Live demo: sit and work normally for ~60–90 seconds, let the app infer state, show it queueing a track from your library that plausibly matches (energetic → upbeat track, calm → mellow track).
4. State the valence caveat out loud before anyone asks. Own the limitation, don't get caught by it.

## 10. Related docs

- `abstract.md` / `abstract.html` — project abstract for submission
- `phases/phase-0-data-collection.md` through `phase-6-integration-demo.md` — detailed phase specs
