import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.preprocessing import LabelEncoder
import joblib
import sys
import json

"""
FIXED CSV FORMAT - Sales Prediction Model Training

Required columns:
- date: Date in YYYY-MM-DD format
- region: Geographic region (categorical)
- product_category: Product type (categorical)
- sales_channel: Online or Offline (categorical)
- units_sold: Number of units sold (numeric)
- unit_price: Price per unit (numeric)
- marketing_spend: Marketing budget spent (numeric)
- is_holiday: Holiday indicator 0 or 1 (numeric)
- sales: Total sales amount - TARGET column (numeric)
"""

REQUIRED_COLUMNS = [
    'date', 'region', 'product_category', 'sales_channel',
    'units_sold', 'unit_price', 'marketing_spend', 'is_holiday', 'sales'
]

CATEGORICAL_COLUMNS = ['region', 'product_category', 'sales_channel']
NUMERIC_COLUMNS = ['units_sold', 'unit_price', 'marketing_spend', 'is_holiday']
TARGET_COLUMN = 'sales'
DATE_COLUMN = 'date'

def train_model():
    # Get data file from argument
    data_file = 'sample_template.csv'
    if len(sys.argv) > 1:
        data_file = sys.argv[1]

    print(f"Loading data from {data_file}...")
    try:
        df = pd.read_csv(data_file)
    except FileNotFoundError:
        print(f"ERROR: {data_file} not found.")
        sys.exit(1)

    # Normalize column names (lowercase, strip spaces)
    df.columns = df.columns.str.strip().str.lower()

    # Validate required columns
    missing_cols = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing_cols:
        print(f"ERROR: Missing required columns: {missing_cols}")
        print(f"Required columns: {REQUIRED_COLUMNS}")
        sys.exit(1)

    print(f"[OK] All required columns present")

    # ========== FEATURE ENGINEERING ==========
    
    # 1. Parse Date and extract time features
    df[DATE_COLUMN] = pd.to_datetime(df[DATE_COLUMN])
    df['day_of_week'] = df[DATE_COLUMN].dt.dayofweek
    df['month'] = df[DATE_COLUMN].dt.month
    df['day_of_year'] = df[DATE_COLUMN].dt.dayofyear
    df['week_of_year'] = df[DATE_COLUMN].dt.isocalendar().week.astype(int)
    print(f"[OK] Date features extracted: day_of_week, month, day_of_year, week_of_year")

    # 2. Encode Categorical Features
    encoders = {}
    for col in CATEGORICAL_COLUMNS:
        le = LabelEncoder()
        df[f'{col}_encoded'] = le.fit_transform(df[col].astype(str))
        encoders[col] = le
        print(f"[OK] Encoded {col}: {len(le.classes_)} unique values")

    # 3. Prepare Feature Matrix
    feature_columns = (
        [f'{col}_encoded' for col in CATEGORICAL_COLUMNS] +
        NUMERIC_COLUMNS +
        ['day_of_week', 'month', 'day_of_year', 'week_of_year']
    )

    X = df[feature_columns].fillna(0)
    y = df[TARGET_COLUMN]

    print(f"[OK] Training features: {feature_columns}")
    print(f"[OK] Target column: {TARGET_COLUMN}")
    print(f"[OK] Dataset size: {len(df)} rows")

    # ========== MODEL TRAINING ==========
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)
    
    # Evaluate
    train_preds = model.predict(X_train)
    test_preds = model.predict(X_test)
    train_mae = mean_absolute_error(y_train, train_preds)
    test_mae = mean_absolute_error(y_test, test_preds)
    
    print(f"\n========== MODEL PERFORMANCE ==========")
    print(f"Training MAE: ${train_mae:,.2f}")
    print(f"Testing MAE:  ${test_mae:,.2f}")

    # Feature Importance
    feature_importance = dict(zip(feature_columns, model.feature_importances_))
    sorted_importance = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
    print(f"\nTop 5 Important Features:")
    for i, (feat, imp) in enumerate(sorted_importance[:5], 1):
        print(f"  {i}. {feat}: {imp:.4f}")

    # ========== SAVE ARTIFACTS ==========
    joblib.dump(model, 'sales_model.pkl')
    joblib.dump(encoders, 'encoders.pkl')
    joblib.dump(feature_columns, 'model_features.pkl')
    print(f"\n[OK] Model saved: sales_model.pkl")
    print(f"[OK] Encoders saved: encoders.pkl")
    print(f"[OK] Features saved: model_features.pkl")

    # ========== GENERATE FRONTEND METADATA ==========
    metadata_features = []

    # Date input
    metadata_features.append({
        "name": "date",
        "type": "date"
    })

    # Categorical inputs with options
    for col in CATEGORICAL_COLUMNS:
        options = sorted(df[col].astype(str).unique().tolist())
        metadata_features.append({
            "name": col,
            "type": "categorical",
            "options": options
        })

    # Numeric inputs
    for col in NUMERIC_COLUMNS:
        metadata_features.append({
            "name": col,
            "type": "numeric"
        })

    frontend_meta = {
        "target_column": TARGET_COLUMN,
        "features": metadata_features,
        "model_metrics": {
            "train_mae": round(train_mae, 2),
            "test_mae": round(test_mae, 2),
            "dataset_size": len(df),
            "feature_importance": {k: round(v, 4) for k, v in sorted_importance[:5]}
        }
    }

    with open('model_metadata.json', 'w') as f:
        json.dump(frontend_meta, f, indent=2)
    print(f"[OK] Metadata saved: model_metadata.json")

    print(f"\n========== TRAINING COMPLETE ==========")

if __name__ == "__main__":
    train_model()
