#!/bin/bash
set -e

echo "Installing Node.js dependencies..."
npm install

echo "Installing Python dependencies..."
pip3 install --user pandas numpy scikit-learn joblib || pip install --user pandas numpy scikit-learn joblib

echo "Build complete!"
