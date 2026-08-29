import os
import sqlite3
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from skl2onnx import to_onnx

def train_and_export():
    # -------------------------------------------------------------------------
    # 1. Load Data from SQLite
    # -------------------------------------------------------------------------
    db_path = "moodtrace.db"
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"Database file not found at '{db_path}'. Did you run Phase 1 backfill?")

    print(f"Connecting to database: {db_path}...")
    conn = sqlite3.connect(db_path)
    
    # Read training samples
    try:
        df = pd.read_sql("SELECT * FROM training_samples", conn)
    except Exception as e:
        conn.close()
        raise RuntimeError(f"Failed to query 'training_samples' table. Ensure Phase 1 backfiller ran successfully: {e}")
    
    conn.close()
    
    print(f"Loaded {len(df)} samples from database.")
    if len(df) < 10:
        raise ValueError(f"Too few samples ({len(df)}) in training_samples table to train a model.")

    # -------------------------------------------------------------------------
    # 2. Extract Features and Targets
    # -------------------------------------------------------------------------
    FEATURE_COLS = [
        "mean_speed",
        "speed_variance",
        "mean_acceleration",
        "mean_jerk",
        "click_rate",
        "mean_click_duration",
        "click_interval_variance",
        "scroll_velocity",
        "scroll_direction_changes",
        "idle_ratio",
        "mean_path_curvature"
    ]
    
    X = df[FEATURE_COLS].values.astype(np.float32)
    y_arousal = df["arousal"].values.astype(np.float32)
    y_valence = df["valence"].values.astype(np.float32)

    # Split into Train and Test sets
    X_train, X_test, ya_train, ya_test, yv_train, yv_test = train_test_split(
        X, y_arousal, y_valence, test_size=0.2, random_state=42
    )

    print(f"Dataset split: {len(X_train)} training samples, {len(X_test)} testing samples.")

    # -------------------------------------------------------------------------
    # 3. Train Arousal Model
    # -------------------------------------------------------------------------
    print("\n--- Training Arousal Regressor ---")
    model_arousal = GradientBoostingRegressor(n_estimators=100, max_depth=3, random_state=42)
    model_arousal.fit(X_train, ya_train)
    
    # Evaluate on test set
    pred_a = model_arousal.predict(X_test)
    mae_a = mean_absolute_error(ya_test, pred_a)
    r2_a = r2_score(ya_test, pred_a)
    print(f"Arousal Test MAE: {mae_a:.4f}")
    print(f"Arousal Test R2 Score: {r2_a:.4f}")
    
    # 5-fold cross validation
    cv_scores_a = cross_val_score(model_arousal, X, y_arousal, cv=5, scoring="r2")
    print(f"Arousal 5-fold CV R2 Score: {cv_scores_a.mean():.4f} +/- {cv_scores_a.std():.4f}")

    # Feature Importance
    print("\nArousal Feature Importances:")
    importances_a = model_arousal.feature_importances_
    indices_a = np.argsort(importances_a)[::-1]
    for i in range(len(FEATURE_COLS)):
        print(f"  {FEATURE_COLS[indices_a[i]]:<25} : {importances_a[indices_a[i]]:.4f}")

    # Plot Arousal Predicted vs Actual
    plt.figure(figsize=(6, 6))
    plt.scatter(ya_test, pred_a, alpha=0.7, color='#89b4fa', edgecolors='#1e1e2e', s=50)
    plt.plot([-1, 1], [-1, 1], color='#f38ba8', linestyle='--', linewidth=2)
    plt.title('Arousal: Predicted vs Actual')
    plt.xlabel('Actual Arousal')
    plt.ylabel('Predicted Arousal')
    plt.xlim([-1.1, 1.1])
    plt.ylim([-1.1, 1.1])
    plt.grid(True, linestyle=':', alpha=0.6)
    plt.tight_layout()
    plt.savefig('arousal_evaluation.png', dpi=150)
    plt.close()
    print("Saved arousal evaluation plot to 'arousal_evaluation.png'.")

    # -------------------------------------------------------------------------
    # 4. Train Valence Model
    # -------------------------------------------------------------------------
    print("\n--- Training Valence Regressor ---")
    model_valence = GradientBoostingRegressor(n_estimators=100, max_depth=3, random_state=42)
    model_valence.fit(X_train, yv_train)
    
    # Evaluate on test set
    pred_v = model_valence.predict(X_test)
    mae_v = mean_absolute_error(yv_test, pred_v)
    r2_v = r2_score(yv_test, pred_v)
    print(f"Valence Test MAE: {mae_v:.4f}")
    print(f"Valence Test R2 Score: {r2_v:.4f}")
    
    # 5-fold cross validation
    cv_scores_v = cross_val_score(model_valence, X, y_valence, cv=5, scoring="r2")
    print(f"Valence 5-fold CV R2 Score: {cv_scores_v.mean():.4f} +/- {cv_scores_v.std():.4f}")

    # Feature Importance
    print("\nValence Feature Importances:")
    importances_v = model_valence.feature_importances_
    indices_v = np.argsort(importances_v)[::-1]
    for i in range(len(FEATURE_COLS)):
        print(f"  {FEATURE_COLS[indices_v[i]]:<25} : {importances_v[indices_v[i]]:.4f}")

    # Plot Valence Predicted vs Actual
    plt.figure(figsize=(6, 6))
    plt.scatter(yv_test, pred_v, alpha=0.7, color='#a6e3a1', edgecolors='#1e1e2e', s=50)
    plt.plot([-1, 1], [-1, 1], color='#f38ba8', linestyle='--', linewidth=2)
    plt.title('Valence: Predicted vs Actual')
    plt.xlabel('Actual Valence')
    plt.ylabel('Predicted Valence')
    plt.xlim([-1.1, 1.1])
    plt.ylim([-1.1, 1.1])
    plt.grid(True, linestyle=':', alpha=0.6)
    plt.tight_layout()
    plt.savefig('valence_evaluation.png', dpi=150)
    plt.close()
    print("Saved valence evaluation plot to 'valence_evaluation.png'.")

    # -------------------------------------------------------------------------
    # 5. Export Models to ONNX
    # -------------------------------------------------------------------------
    print("\n--- Exporting Models to ONNX ---")
    
    # Convert models to ONNX (specifying float32 input shape [None, 11])
    # The X_train[:1] sample allows skl2onnx to automatically infer structural dimensions and types.
    onnx_arousal = to_onnx(model_arousal, X_train[:1])
    onnx_valence = to_onnx(model_valence, X_train[:1])
    
    with open("model_arousal.onnx", "wb") as f:
        f.write(onnx_arousal.SerializeToString())
    print("Successfully exported 'model_arousal.onnx'")

    with open("model_valence.onnx", "wb") as f:
        f.write(onnx_valence.SerializeToString())
    print("Successfully exported 'model_valence.onnx'")

if __name__ == "__main__":
    train_and_export()
