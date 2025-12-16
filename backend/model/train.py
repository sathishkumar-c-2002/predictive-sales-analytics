import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.preprocessing import LabelEncoder
import joblib
import sys
import json

def train_model():
    # Helper to get data file argument
    data_file = 'sales_data.csv'
    if len(sys.argv) > 1:
        data_file = sys.argv[1]

    print(f"Loading data from {data_file}...")
    try:
        df = pd.read_csv(data_file)
    except FileNotFoundError:
        print(f"{data_file} not found. Please upload a valid CSV.")
        sys.exit(1)

    # 1. Identify DATE column
    date_col = None
    for col in df.columns:
        if 'date' in col.lower() or 'time' in col.lower() or 'year' in col.lower():
            date_col = col
            break
    
    # Fallback: look for object column that parses as date
    if not date_col:
        for col in df.select_dtypes(include=['object']).columns:
            try:
                pd.to_datetime(df[col], errors='raise')
                date_col = col
                break
            except:
                pass

    if date_col:
        print(f" identified Date column: {date_col}")
        df[date_col] = pd.to_datetime(df[date_col])
        df['day_of_week'] = df[date_col].dt.dayofweek
        df['month'] = df[date_col].dt.month
        df['day_of_year'] = df[date_col].dt.dayofyear
        # Drop original date col from features
        df = df.drop(columns=[date_col])
    else:
        print("Warning: No Date column found. Skipping time-based features.")

    # 2. Identify TARGET column (Numeric)
    target_col = None
    possible_targets = ['sales', 'revenue', 'profit', 'amount', 'total', 'price']
    
    # First check for exact matches
    for t in possible_targets:
        matches = [c for c in df.columns if t in c.lower()]
        if matches:
            # Pick the one that is numeric
            for m in matches:
                if pd.api.types.is_numeric_dtype(df[m]):
                    target_col = m
                    break
        if target_col: break
    
    # Fallback: Last numeric column
    if not target_col:
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > 0:
            target_col = numeric_cols[-1]

    if not target_col:
        print("Error: Could not identify a numeric Target column.")
        sys.exit(1)

    print(f" identified Target column: {target_col}")

    # 3. Identify FEATURES
    # Everything else is a feature
    feature_cols = [c for c in df.columns if c != target_col]
    
    # 4. Handle Categorical Features
    encoders = {}
    metadata_features = []
    
    final_features = [] # Final list of columns used for training X
    
    # Re-build X dataframe
    X = pd.DataFrame()
    
    # Add time features if they exist
    # Add time features if they exist
    # (They are already in df and feature_cols, so they will be added in the loop below)


    for col in feature_cols:
        if pd.api.types.is_numeric_dtype(df[col]):
            # Numeric Feature
            X[col] = df[col].fillna(0)
            final_features.append(col)
            metadata_features.append({"name": col, "type": "numeric"})
        else:
            # Categorical Feature
            # Limit cardinality to avoid explosion? For now, just encode.
            le = LabelEncoder()
            # Convert to string to handle mixed types
            X[col] = le.fit_transform(df[col].astype(str))
            encoders[col] = le
            final_features.append(col)
            
            # Get unique options for frontend
            options = sorted(list(df[col].astype(str).unique()))
            # Limit options sent to frontend for performance
            if len(options) > 100:
                options = options[:100]
                
            metadata_features.append({
                "name": col, 
                "type": "categorical", 
                "options": options
            })

    y = df[target_col]

    # Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print(f"Training on features: {final_features}")
    
    # Train
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    print(f"Model MAE: {mae:.2f}")
    
    # Save artifacts
    joblib.dump(model, 'sales_model.pkl')
    
    # Save training metadata (encoders, feature list, target name)
    training_metadata = {
        "features": final_features,
        "target_col": target_col,
        "encoders": encoders, # Note: Encoders are not JSON serializable easily.
        # We'll save Encoders separately via joblib if needed, or re-create simple mapping.
        # For this demo, let's just save the column names needed for frontend.
    }
    
    # Save Encoders for inference
    joblib.dump(encoders, 'encoders.pkl')
    # Save Feature columns for inference alignment
    joblib.dump(final_features, 'model_features.pkl')

    # Save JSON for Frontend
    frontend_meta = {
        "target_column": target_col,
        "features": metadata_features
    }
    with open('model_metadata.json', 'w') as f:
        json.dump(frontend_meta, f, indent=2)

    print("Model and metadata saved.")

if __name__ == "__main__":
    train_model()
