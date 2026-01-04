#!/bin/bash
set -e

echo "Installing Node.js dependencies..."
yarn install

echo "Installing Python dependencies..."
pip install pandas numpy scikit-learn joblib

echo "Build complete!"
