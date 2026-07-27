# MoodTrace: Affect-Aware Music Selection from Input Device Dynamics

*A Mini-Project Report*

**Institution:** Loyola Academy, Old Alwal
**Domain:** Affective Computing / Human-Computer Interaction / Applied Machine Learning

---

## Abstract

Emotion-aware computing systems typically rely on invasive sensing modalities such as facial expression analysis, physiological monitoring, or explicit self-report, each of which introduces friction, hardware dependency, or privacy concerns unsuited to everyday desktop use. This project investigates a lighter-weight alternative: inferring a user's affective state directly from the passive dynamics of mouse and scroll input already generated during normal computer use, without recording keystroke content, camera input, or any biometric signal.

MoodTrace is a Windows background application that captures low-level input timing (cursor velocity, acceleration, jerk, click timing, scroll dynamics, and idle ratio) over a rolling time window and maps these handcrafted features to two independent affective dimensions drawn from the circumplex model of affect: arousal (energy level, calm to excited) and valence (mood polarity, negative to positive). Ground-truth labels are collected through a lightweight, periodic self-report interface using a two-dimensional affect grid, producing a per-user labeled dataset used to train two classical regression models (gradient-boosted trees), exported to ONNX for efficient native inference without a bundled Python runtime.

The inferred affective state is used to select and play music matching the user's current state, drawn from the user's own music library. Because official platform APIs for audio-feature-based recommendation (notably Spotify's `audio-features`, `audio-analysis`, and `recommendations` endpoints) have been progressively deprecated for third-party applications since November 2024, this project instead builds a local, platform-agnostic valence-energy reference table from a pre-existing public dataset, matched against the user's library by track metadata. A common provider interface supports two backends — Spotify (remote playback control via the Web API) and YouTube Music (search via the YouTube Data API v3 with playback through an embedded, officially supported IFrame Player) — demonstrating that the affect-inference core is independent of any single music platform.

This work does not claim general-purpose or cross-user emotion recognition. Consistent with existing literature on mouse-dynamics-based affect detection, arousal is treated as the primary, better-supported signal, while valence estimation is presented as an experimental, secondary result. The system is explicitly scoped as a per-user, locally calibrated tool rather than a deployable, population-general classifier, reflecting an honest treatment of what passive input-dynamics signals can and cannot support.

## Objectives

- Design and implement a privacy-preserving input-capture pipeline that records timing-only signals, with no keystroke content ever logged.
- Collect a self-labeled, per-user dataset of affective states using a low-friction two-dimensional self-report instrument.
- Train and evaluate lightweight, interpretable regression models for arousal and valence from handcrafted input-dynamics features.
- Design a platform-agnostic music-selection layer that maps inferred affect to tracks in the user's own library, independent of any single streaming provider's API surface.
- Demonstrate the system end-to-end as a lightweight Windows tray application with two working music backends.

## Methodology

The project follows a phased pipeline: (1) background self-report data collection running continuously from project start, given its role as the primary time constraint; (2) a Rust-based input-capture and feature-extraction layer using low-level Windows hooks; (3) an offline Python training pipeline using classical regression models evaluated via cross-validation given limited per-user sample sizes, exported to ONNX; (4) a native Rust inference runtime consuming the exported models in real time; and (5) a music-provider abstraction layer with Spotify and YouTube Music implementations, both drawing candidate tracks from a shared local valence-energy reference dataset.

## Tools and Technologies

Rust (Tauri, `windows-rs`, `ort` ONNX Runtime bindings, `rusqlite`), Python (`pandas`, `scikit-learn`, `skl2onnx`), SQLite, Spotify Web API (Authorization Code with PKCE), YouTube Data API v3 and IFrame Player API.

## Expected Outcome

A working prototype demonstrating that passive input dynamics carry a usable, if limited, affective signal — sufficient for arousal-based music selection at an individual, calibrated level — alongside a transparent, literature-grounded account of where such a signal's reliability ends, particularly with respect to valence.

**Keywords:** affective computing, mouse dynamics, human-computer interaction, classical machine learning, music recommendation, privacy-preserving sensing
