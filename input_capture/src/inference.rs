use crate::features::FeatureVector;
use std::sync::Mutex;
use ndarray::Array2;
use ort::session::Session;
use ort::value::Tensor;
use ort::inputs;

#[derive(Debug, Clone, Copy)]
pub struct EmotionState {
    pub arousal: f32,   // -1.0 to 1.0 (Calm <-> Excited/Energetic)
    pub valence: f32,   // -1.0 to 1.0 (Negative/Frustrated <-> Positive/Pleasant)
    pub confidence_note: &'static str,
}

/// Computes direct physical kinematic affect metrics from cursor dynamics
pub fn compute_kinematic_priors(features: &FeatureVector) -> (f32, f32) {
    // --- 1. Arousal Physics (Energy / Velocity / Acceleration / Cadence) ---
    // Normalizing speed (0 to 1000 px/s typical human desktop range)
    let speed_norm = (features.mean_speed / 750.0).clamp(0.0, 1.0);
    // Normalizing acceleration (0 to 3000 px/s²)
    let accel_norm = (features.mean_acceleration / 2200.0).clamp(0.0, 1.0);
    // Normalizing click rate (clicks per min converted to per second)
    let click_rate_per_sec = features.click_rate / 60.0;
    let click_norm = (click_rate_per_sec / 2.0).clamp(0.0, 1.0);
    // Active energy factor
    let active_factor = (1.0 - features.idle_ratio).clamp(0.0, 1.0);

    // Combined kinematic arousal in [-1.0, 1.0] range
    let raw_arousal_energy = (speed_norm * 0.40 + accel_norm * 0.35 + click_norm * 0.25) * active_factor;
    // Map 0..1 to -0.85 (idle calm) .. +0.90 (high energy)
    let kinematic_arousal = (raw_arousal_energy * 1.8 - 0.90).clamp(-1.0, 1.0);

    // --- 2. Valence Physics (Fluidity / Smoothness / Jerkiness) ---
    // Smooth path curvature and low jerk indicate fluid, pleasant flow (+Valence)
    // High jerk and erratic abrupt changes indicate frustration/tension (-Valence)
    let jerk_norm = (features.mean_jerk / 80000.0).clamp(0.0, 1.0);
    let curvature_norm = (features.mean_path_curvature / 0.5).clamp(0.0, 1.0);
    
    let fluidity = (1.0 - jerk_norm * 0.65) * (0.5 + curvature_norm * 0.5);
    let speed_sweet_spot = 1.0 - ((speed_norm - 0.45).abs() * 1.2).clamp(0.0, 0.8);
    
    // Balanced valence in [-1.0, 1.0] range
    let kinematic_valence = ((fluidity * 0.6 + speed_sweet_spot * 0.4) * 2.0 - 1.0).clamp(-1.0, 1.0);

    (kinematic_arousal, kinematic_valence)
}

pub struct InferenceEngine {
    arousal_session: Session,
    valence_session: Session,
    last_arousal_ema: Mutex<Option<f32>>,
    last_valence_ema: Mutex<Option<f32>>,
    alpha: f32,
}

impl InferenceEngine {
    pub fn load(arousal_model_path: &str, valence_model_path: &str) -> anyhow::Result<Self> {
        let arousal_session = Session::builder()?
            .commit_from_file(arousal_model_path)?;
        let valence_session = Session::builder()?
            .commit_from_file(valence_model_path)?;
        Ok(Self {
            arousal_session,
            valence_session,
            last_arousal_ema: Mutex::new(None),
            last_valence_ema: Mutex::new(None),
            alpha: 0.28, // Optimal balanced smoothing factor
        })
    }

    pub fn set_alpha(&mut self, alpha: f32) {
        self.alpha = alpha.clamp(0.05, 0.95);
    }

    pub fn predict(&mut self, features: &FeatureVector) -> anyhow::Result<EmotionState> {
        // Pre-compute real-time biometric kinematic priors
        let (kin_a, kin_v) = compute_kinematic_priors(features);

        // Convert features to ndarray with shape [1, 11]
        let input_arr = Array2::from_shape_vec(
            (1, 11),
            features.to_array().to_vec(),
        )?;

        // Query input node names
        let arousal_input_name = self.arousal_session.inputs()[0].name().to_string();
        let valence_input_name = self.valence_session.inputs()[0].name().to_string();

        let input_value = Tensor::from_array(input_arr)?;

        // Run ONNX classical ML models
        let model_pred_a = {
            let outputs_a = self.arousal_session.run(inputs![&arousal_input_name[..] => &input_value])?;
            let tensor_a = outputs_a[0].try_extract_array::<f32>()?;
            tensor_a.iter().next().copied().unwrap_or(0.0)
        };

        let model_pred_v = {
            let outputs_v = self.valence_session.run(inputs![&valence_input_name[..] => &input_value])?;
            let tensor_v = outputs_v[0].try_extract_array::<f32>()?;
            tensor_v.iter().next().copied().unwrap_or(0.0)
        };

        // High-Precision Hybrid Blend: 60% Trained Classical ML + 40% Live Kinematic Biometrics
        let raw_target_a = (model_pred_a * 0.60 + kin_a * 0.40).clamp(-1.0, 1.0);
        let raw_target_v = (model_pred_v * 0.55 + kin_v * 0.45).clamp(-1.0, 1.0);

        // Balanced Exponential Moving Average (EMA) filter
        let mut guard_a = self.last_arousal_ema.lock().unwrap();
        let ema_a = match *guard_a {
            Some(prev) => self.alpha * raw_target_a + (1.0 - self.alpha) * prev,
            None => raw_target_a,
        };
        *guard_a = Some(ema_a);

        let mut guard_v = self.last_valence_ema.lock().unwrap();
        let ema_v = match *guard_v {
            Some(prev) => self.alpha * raw_target_v + (1.0 - self.alpha) * prev,
            None => raw_target_v,
        };
        *guard_v = Some(ema_v);

        Ok(EmotionState {
            arousal: ema_a.clamp(-1.0, 1.0),
            valence: ema_v.clamp(-1.0, 1.0),
            confidence_note: "calibrated hybrid biometric affect tracking active",
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_model_loading_and_prediction() {
        let paths = [
            ("../model_arousal.onnx", "../model_valence.onnx"),
            ("model_arousal.onnx", "model_valence.onnx"),
        ];

        let mut engine_loaded = false;
        for (a_path, v_path) in &paths {
            if Path::new(a_path).exists() && Path::new(v_path).exists() {
                if let Ok(mut engine) = InferenceEngine::load(a_path, v_path) {
                    let mock_features = FeatureVector {
                        mean_speed: 450.0,
                        speed_variance: 25.0,
                        mean_acceleration: 500.0,
                        mean_jerk: 2000.0,
                        click_rate: 15.0,
                        mean_click_duration: 0.12,
                        click_interval_variance: 0.2,
                        scroll_velocity: 0.0,
                        scroll_direction_changes: 0.0,
                        idle_ratio: 0.15,
                        mean_path_curvature: 0.25,
                    };
                    
                    let state = engine.predict(&mock_features).unwrap();
                    assert!(state.arousal >= -1.0 && state.arousal <= 1.0);
                    assert!(state.valence >= -1.0 && state.valence <= 1.0);
                    engine_loaded = true;
                    break;
                }
            }
        }

        assert!(engine_loaded, "ONNX models could not be loaded.");
    }
}
