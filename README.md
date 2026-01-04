# 📊 Predictive Sales Analytics Dashboard

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://python.org/)
[![Scikit-learn](https://img.shields.io/badge/Scikit--learn-ML-F7931E?logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A **full-stack machine learning application** that forecasts sales trends and visualizes business metrics. Upload your sales data in the specified format, train ML models automatically, and generate real-time predictions through an interactive dashboard.

---

## ✨ Features

- **🤖 ML-Powered Predictions** — RandomForest model trained on your sales data
- **📊 Interactive Charts** — Visualize historical sales trends with Chart.js
- **📤 File Upload & Validation** — Upload CSV files with automatic format validation
- **🔄 Auto Feature Engineering** — Extracts date features (day_of_week, month, etc.)
- **📋 Template Download** — Download sample CSV template for correct format
- **📈 Model Metrics** — View MAE and feature importance after training

---

## 📁 Required CSV Format

Your CSV file **must contain exactly these 9 columns**:

| Column Name | Type | Description | Example |
|-------------|------|-------------|---------|
| `date` | YYYY-MM-DD | Transaction date | 2024-01-15 |
| `region` | Text | Geographic region | North, South, East, West |
| `product_category` | Text | Product type | Electronics, Clothing, Groceries |
| `sales_channel` | Text | Sales channel | Online, Offline |
| `units_sold` | Integer | Units sold | 150 |
| `unit_price` | Decimal | Price per unit | 299.99 |
| `marketing_spend` | Decimal | Marketing budget | 1200.00 |
| `is_holiday` | 0 or 1 | Holiday indicator | 0 |
| `sales` | Decimal | **TARGET** - Total sales | 44998.50 |

> ⚠️ **Files with missing or extra columns will be rejected with a detailed error message.**

### Sample CSV Row
```csv
date,region,product_category,sales_channel,units_sold,unit_price,marketing_spend,is_holiday,sales
2024-01-15,North,Electronics,Online,150,299.99,1200,0,44998.50
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend (Next.js/React)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  │
│  │  Chart.js   │  │ Prediction  │  │   CSV Upload + Validation   │  │
│  │  Trend View │  │    Form     │  │   + Format Requirements     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ REST API
┌────────────────────────────▼────────────────────────────────────────┐
│                         Backend (Node.js/Express)                    │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────┐  │
│  │ /api/sales   │  │ /api/upload   │  │ /api/predict             │  │
│  │ GET data     │  │ POST CSV      │  │ POST → ML inference      │  │
│  └──────────────┘  │ + Validation  │  └──────────────────────────┘  │
│                    └───────────────┘                                 │
│  ┌──────────────┐  ┌───────────────┐                                │
│  │ /api/template│  │ /api/format   │                                │
│  │ Download CSV │  │ GET schema    │                                │
│  └──────────────┘  └───────────────┘                                │
└────────────────────────────┬────────────────────────────────────────┘
                             │ Child Process
┌────────────────────────────▼────────────────────────────────────────┐
│                      ML Engine (Python/Scikit-learn)                 │
│  ┌──────────────────┐  ┌────────────────┐  ┌─────────────────────┐  │
│  │  train.py        │  │ RandomForest   │  │ Model Artifacts     │  │
│  │  Fixed schema    │  │ Regressor      │  │ .pkl files          │  │
│  │  Feature eng.    │  │ (100 trees)    │  │ + metadata.json     │  │
│  └──────────────────┘  └────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Next.js 16, Chart.js 4, TailwindCSS |
| **Backend** | Node.js, Express.js, Multer (file uploads) |
| **ML/Data** | Python 3.10+, Scikit-learn, Pandas, NumPy, Joblib |
| **Validation** | CSV column validation with detailed error messages |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- npm

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/predictive-sales-analytics.git
cd predictive-sales-analytics
```

### 2. Backend Setup

```bash
cd backend
npm install

# Python environment
cd model
python -m venv venv

# Windows
.\venv\Scripts\activate
# Linux/macOS
# source venv/bin/activate

pip install -r requirements.txt

# Train initial model with sample data
python train.py sample_template.csv

cd ..
npm run dev
```

Backend runs on `http://localhost:5000`

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/sales` | Returns all sales data as JSON |
| `GET` | `/api/metadata` | Model metadata (features, options, metrics) |
| `GET` | `/api/template` | Download sample CSV template |
| `GET` | `/api/format` | Get required format specification |
| `POST` | `/api/upload` | Upload CSV → validates → trains model |
| `POST` | `/api/predict` | Submit features → get sales prediction |

### Upload Response Examples

**Success:**
```json
{
  "message": "Data updated and model retrained successfully",
  "output": "Training complete..."
}
```

**Validation Error:**
```json
{
  "error": "Invalid CSV Format",
  "details": "Missing required columns: sales_channel, is_holiday",
  "required_columns": ["date", "region", "product_category", "sales_channel", "units_sold", "unit_price", "marketing_spend", "is_holiday", "sales"],
  "download_template": "/api/template"
}
```

---

## 📂 Project Structure

```
predictive-sales-analytics/
├── backend/
│   ├── server.js              # Express API + validation logic
│   ├── package.json
│   └── model/
│       ├── train.py           # ML training pipeline (fixed schema)
│       ├── sample_template.csv # Sample CSV template
│       ├── requirements.txt
│       ├── sales_model.pkl    # Trained model
│       ├── encoders.pkl       # Label encoders
│       └── model_metadata.json # Frontend config + metrics
│
├── frontend/
│   ├── app/
│   │   ├── page.js            # Main dashboard
│   │   └── globals.css
│   └── package.json
│
├── README.md
└── LICENSE
```

---

## 🧠 How It Works

1. **Upload CSV** → File is validated against fixed schema (9 required columns)
2. **Validation** → Missing/extra columns trigger detailed error messages
3. **Feature Engineering** → Date parsing extracts day_of_week, month, day_of_year, week_of_year
4. **Encoding** → Categorical columns (region, product_category, sales_channel) are label-encoded
5. **Training** → RandomForest Regressor (100 trees) trained on processed data
6. **Artifacts Saved** → Model, encoders, feature list, metadata with metrics
7. **Prediction** → User inputs are processed identically and passed to model

---

## 📄 License

MIT License - see [LICENSE](LICENSE)

---

## 👤 Author

**Your Name**
- GitHub: [@yourusername](https://github.com/yourusername)

---

<p align="center">Made with ❤️ for data-driven decisions</p>
