#!/bin/bash
set -e

echo "Installing Node.js dependencies..."
yarn install

echo "Installing Python dependencies..."
pip3 install --user pandas numpy scikit-learn joblib || pip install --user pandas numpy scikit-learn joblib

echo "Build complete!"
