# Phase 2 — Emotion Model Training (Python, offline only)

**Owner:** Agent B, or you directly (this is the academic core of the project — worth doing yourself even if agents build everything else). **Depends on:** Phase 0 data (need 100+ labeled samples to start meaningfully). **Feeds:** Phase 3 (consumes the exported `.onnx` file).

## Scope

This is a one-time offline training pipeline, not something that ships or runs at app runtime. Output is a single `.onnx` file checked into the repo; the Rust app never touches Python.

## Model choice — and why

**Two independent regressors (arousal, valence), each a small `GradientBoostingRegressor` or `RandomForestRegressor` from scikit-learn.** Not a neural net. Reasons, stated plainly for your report too:

- At 150–300 samples, a deep model will overfit badly and you'll have no reliable way to prove otherwise (no data for a real validation split large enough to trust).
- Classical models on 11 handcrafted features are already close to the ceiling of what mouse-only signal can support — the bottleneck is signal, not model capacity.
- Tree ensembles give you feature importances for free, which is a genuinely useful result for your report ("jerk and click-interval variance were the strongest predictors of arousal" is a real finding you can show, not a black box you have to hand-wave about).

Train **arousal and valence as separate regression targets**, don't try to jointly predict a single "emotion class" — keeps each problem simpler and lets you honestly report that arousal performs better than valence, which you already expect from the literature.

## Pipeline

```python
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from skl2onnx import to_onnx
import numpy as np

# 1. Load features + labels joined by nearest-preceding-window timestamp
df = pd.read_sql("SELECT * FROM training_samples", conn)  # built by joining
                                                            # labels + feature windows

FEATURE_COLS = [
    "mean_speed", "speed_variance", "mean_acceleration", "mean_jerk",
    "click_rate", "mean_click_duration", "click_interval_variance",
    "scroll_velocity", "scroll_direction_changes", "idle_ratio",
    "mean_path_curvature",
]

X = df[FEATURE_COLS].values.astype(np.float32)
y_arousal = df["arousal"].values
y_valence = df["valence"].values

X_train, X_test, ya_train, ya_test, yv_train, yv_test = train_test_split(
    X, y_arousal, y_valence, test_size=0.2, random_state=42
)

# 2. Train, evaluate honestly
model_arousal = GradientBoostingRegressor(n_estimators=100, max_depth=3, random_state=42)
model_arousal.fit(X_train, ya_train)
pred = model_arousal.predict(X_test)
print("Arousal MAE:", mean_absolute_error(ya_test, pred))
print("Arousal R2:", r2_score(ya_test, pred))

model_valence = GradientBoostingRegressor(n_estimators=100, max_depth=3, random_state=42)
model_valence.fit(X_train, yv_train)
pred_v = model_valence.predict(X_test)
print("Valence MAE:", mean_absolute_error(yv_test, pred_v))
print("Valence R2:", r2_score(yv_test, pred_v))

# 3. Cross-validate given small dataset size (single train/test split is noisy at this scale)
cv_scores = cross_val_score(model_arousal, X, y_arousal, cv=5, scoring="r2")
print("Arousal 5-fold CV R2:", cv_scores.mean(), "+/-", cv_scores.std())

# 4. Export both to ONNX
onnx_arousal = to_onnx(model_arousal, X_train[:1])
onnx_valence = to_onnx(model_valence, X_train[:1])
with open("model_arousal.onnx", "wb") as f:
    f.write(onnx_arousal.SerializeToString())
with open("model_valence.onnx", "wb") as f:
    f.write(onnx_valence.SerializeToString())
```

Install:
```
pip install pandas scikit-learn skl2onnx --break-system-packages
```

## Evaluation — be honest, this is graded on rigor not on hype

- Report R² and MAE for both axes separately, with the 5-fold CV mean/std (single train/test split at this sample size will have high variance — don't present it as if it's a stable number).
- **Expect valence R² to be meaningfully lower than arousal R².** If it isn't, double check for a data leak (e.g. accidentally correlated timestamp features) before celebrating.
- Plot predicted vs. actual scatter for both axes — this is your headline figure for the report, more convincing than a bare metric table.
- Print feature importances (`model.feature_importances_`) and discuss which features actually drove arousal predictions — ties back to the mouse-dynamics literature you cited in the abstract.

## Calibration note

Since this is per-user, retrain whenever you have meaningfully more data (e.g. after another 100 samples). Keep the training script rerunnable, not a one-off notebook you'll lose track of — Phase 6 will want to demonstrate retraining if asked in the viva.

## Definition of done

- `model_arousal.onnx` and `model_valence.onnx` produced from real Phase 0 data (not synthetic placeholders).
- Evaluation metrics + scatter plots saved for the report.
- Feature importance results documented.
- Training script re-runnable end to end from raw SQLite tables to `.onnx` output with one command.
