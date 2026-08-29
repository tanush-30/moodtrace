use crate::features::FeatureVector;
use std::sync::Mutex;
use ndarray::Array2;
use ort::session::Session;
use ort::value::Tensor;
use ort::inputs;

#[derive(Debug, Clone, Copy)]
pub struct EmotionState {
    pub arousal: f32,   // -1.0 to 1.0
    pub valence: f32,   // -1.0 to 1.0
    pub confidence_note: &'static str,
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
            alpha: 0.3,
        })
    }

    pub fn set_alpha(&mut self, alpha: f32) {
        self.alpha = alpha.max(0.0).min(1.0);
    }

    pub fn predict(&mut self, features: &FeatureVector) -> anyhow::Result<EmotionState> {
        // Convert to ndarray with shape [1, 11]
        let input_arr = Array2::from_shape_vec(
            (1, 11),
            features.to_array().to_vec(),
        )?;

        // Query input node names dynamically
        let arousal_input_name = self.arousal_session.inputs()[0].name().to_string();
        let valence_input_name = self.valence_session.inputs()[0].name().to_string();

        // Convert ndarray to ORT Tensor value
        let input_value = Tensor::from_array(input_arr)?;

        // Run both models (inputs! returns a Vec directly in rc.13, so no trailing ?)
        let outputs_a = self.arousal_session.run(inputs![&arousal_input_name[..] => &input_value])?;
        let outputs_v = self.valence_session.run(inputs![&valence_input_name[..] => &input_value])?;

        // Extract prediction arrays as ndarray views
        let tensor_a = outputs_a[0].try_extract_array::<f32>()?;
        let tensor_v = outputs_v[0].try_extract_array::<f32>()?;

        // Safely pull the scalar values
        let pred_a = tensor_a.iter().next().copied().unwrap_or(0.0);
        let pred_v = tensor_v.iter().next().copied().unwrap_or(0.0);

        // Apply EMA smoothing
        let mut guard_a = self.last_arousal_ema.lock().unwrap();
        let ema_a = match *guard_a {
            Some(prev) => self.alpha * pred_a + (1.0 - self.alpha) * prev,
            None => pred_a,
        };
        *guard_a = Some(ema_a);

        let mut guard_v = self.last_valence_ema.lock().unwrap();
        let ema_v = match *guard_v {
            Some(prev) => self.alpha * pred_v + (1.0 - self.alpha) * prev,
            None => pred_v,
        };
        *guard_v = Some(ema_v);

        Ok(EmotionState {
            arousal: ema_a.max(-1.0).min(1.0),
            valence: ema_v.max(-1.0).min(1.0),
            confidence_note: "arousal: model-backed, valence: experimental",
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
                        mean_speed: 10.0,
                        speed_variance: 5.0,
                        mean_acceleration: 2.0,
                        mean_jerk: 1.0,
                        click_rate: 1.0,
                        mean_click_duration: 0.1,
                        click_interval_variance: 0.0,
                        scroll_velocity: 0.0,
                        scroll_direction_changes: 0.0,
                        idle_ratio: 0.5,
                        mean_path_curvature: 0.1,
                    };
                    
                    let state = engine.predict(&mock_features).unwrap();
                    assert!(state.arousal >= -1.0 && state.arousal <= 1.0);
                    assert!(state.valence >= -1.0 && state.valence <= 1.0);
                    engine_loaded = true;
                    break;
                }
            }
        }

        // Assert that we successfully loaded and verified the models in at least one path
        assert!(engine_loaded, "ONNX models could not be loaded. Ensure train_model.py ran successfully.");
    }
}
