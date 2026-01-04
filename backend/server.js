const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration - Allow all origins with all methods
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false
}));

// Handle preflight requests for all routes
app.options('*', cors());

app.use(express.json());

// Mock Database
let salesData = [];
// Current data file - defaults to standard one
let currentDataFile = 'sales_data.csv';

const loadData = () => {
    const dataPath = path.join(__dirname, 'model', currentDataFile);
    const metaPath = path.join(__dirname, 'model/model_metadata.json');

    let targetCol = 'sales';
    try {
        if (fs.existsSync(metaPath)) {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            if (meta.target_column) targetCol = meta.target_column;
        }
    } catch (e) {
        console.error("Error determining target column:", e);
    }

    if (fs.existsSync(dataPath)) {
        fs.createReadStream(dataPath)
            .pipe(csv())
            .on('data', (row) => {
                // Dynamic Date Mapping
                const keys = Object.keys(row);
                // Look for a column with 'date' in the name if 'date' doesn't exist
                if (!row.date) {
                    const dateKey = keys.find(k => k.toLowerCase().includes('date') || k.toLowerCase().includes('time'));
                    if (dateKey) row.date = row[dateKey];
                }

                // Dynamic Target Mapping
                if (row[targetCol] !== undefined) {
                    row.sales = parseFloat(row[targetCol]);
                } else if (row.sales) {
                    row.sales = parseFloat(row.sales);
                }

                // Keep these for potential backward compatibility or if they exist
                if (row.marketing_spend) row.marketing_spend = parseFloat(row.marketing_spend);
                if (row.holiday) row.holiday = parseInt(row.holiday);

                // Only push if we have at least a date and sales value (or if we want to show it anyway)
                if (row.date && !isNaN(row.sales)) {
                    salesData.push(row);
                }
            })
            .on('end', () => {
                console.log(`Sales data loaded into memory from ${currentDataFile}. Mapped '${targetCol}' to sales.`);
            });
    } else {
        console.warn(`${currentDataFile} not found.`);
    }
};

loadData();

// Multer Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'model'));
    },
    filename: (req, file, cb) => {
        // Keep original filename
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// ========== FIXED CSV SCHEMA ==========
// Users MUST upload CSV with these exact columns
const REQUIRED_COLUMNS = [
    'date',           // Format: YYYY-MM-DD
    'region',         // e.g., North, South, East, West
    'product_category', // e.g., Electronics, Clothing, Groceries
    'sales_channel',  // Online or Offline
    'units_sold',     // Numeric
    'unit_price',     // Numeric (decimal)
    'marketing_spend', // Numeric (decimal)
    'is_holiday',     // 0 or 1
    'sales'           // Numeric - TARGET column for prediction
];

// Validate CSV columns
const validateCSVColumns = (filePath) => {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('headers', (headers) => {
                const normalizedHeaders = headers.map(h => h.trim().toLowerCase());
                const normalizedRequired = REQUIRED_COLUMNS.map(c => c.toLowerCase());

                const missingColumns = normalizedRequired.filter(col => !normalizedHeaders.includes(col));
                const extraColumns = normalizedHeaders.filter(col => !normalizedRequired.includes(col));

                if (missingColumns.length > 0 || extraColumns.length > 0) {
                    let errorMsg = 'CSV Format Error:\n';
                    if (missingColumns.length > 0) {
                        errorMsg += `Missing required columns: ${missingColumns.join(', ')}\n`;
                    }
                    if (extraColumns.length > 0) {
                        errorMsg += `Unexpected columns found: ${extraColumns.join(', ')}\n`;
                    }
                    errorMsg += `\nRequired columns: ${REQUIRED_COLUMNS.join(', ')}`;
                    reject({ type: 'validation', message: errorMsg });
                }
            })
            .on('data', (row) => results.push(row))
            .on('end', () => resolve(results))
            .on('error', (err) => reject({ type: 'parse', message: err.message }));
    });
};

// Routes

app.get('/api/sales', (req, res) => {
    res.json(salesData);
});

// GET: Download sample template
app.get('/api/template', (req, res) => {
    const templatePath = path.join(__dirname, 'model/sample_template.csv');
    if (fs.existsSync(templatePath)) {
        res.download(templatePath, 'sales_data_template.csv');
    } else {
        res.status(404).json({ error: 'Template file not found' });
    }
});

// GET: Required format info
app.get('/api/format', (req, res) => {
    res.json({
        required_columns: REQUIRED_COLUMNS,
        column_descriptions: {
            date: 'Date in YYYY-MM-DD format (e.g., 2024-01-15)',
            region: 'Geographic region (e.g., North, South, East, West)',
            product_category: 'Product type (e.g., Electronics, Clothing, Groceries)',
            sales_channel: 'Sales channel - must be "Online" or "Offline"',
            units_sold: 'Number of units sold (integer)',
            unit_price: 'Price per unit (decimal)',
            marketing_spend: 'Marketing budget spent (decimal)',
            is_holiday: 'Holiday indicator - 0 for No, 1 for Yes',
            sales: 'Total sales amount (decimal) - THIS IS THE TARGET FOR PREDICTION'
        },
        example_row: {
            date: '2024-01-15',
            region: 'North',
            product_category: 'Electronics',
            sales_channel: 'Online',
            units_sold: 150,
            unit_price: 299.99,
            marketing_spend: 1200,
            is_holiday: 0,
            sales: 44998.50
        }
    });
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const uploadedFilePath = path.join(__dirname, 'model', req.file.originalname);

    // ========== VALIDATE CSV FORMAT FIRST ==========
    try {
        await validateCSVColumns(uploadedFilePath);
    } catch (validationError) {
        // Delete the invalid file
        try {
            fs.unlinkSync(uploadedFilePath);
        } catch (e) { }

        return res.status(400).json({
            error: 'Invalid CSV Format',
            details: validationError.message,
            required_columns: REQUIRED_COLUMNS,
            download_template: '/api/template'
        });
    }

    // Cleanup: Delete old CSVs and model artifacts
    const modelDir = path.join(__dirname, 'model');
    try {
        const files = fs.readdirSync(modelDir);
        files.forEach(file => {
            const filePath = path.join(modelDir, file);
            // Delete if it's a CSV and NOT the current uploaded file AND NOT the template
            // OR if it's a model artifact
            if (
                (file.endsWith('.csv') && file !== req.file.originalname && file !== 'sample_template.csv') ||
                file.endsWith('.pkl') ||
                file === 'model_metadata.json'
            ) {
                fs.unlinkSync(filePath);
                console.log(`Deleted old file: ${file}`);
            }
        });
    } catch (err) {
        console.error("Error during cleanup:", err);
        // Continue anyway, don't block upload
    }

    console.log(`CSV validated and uploaded: ${req.file.originalname}. Starting model training...`);

    // Update current file reference
    currentDataFile = req.file.originalname;

    // Determine Python path (same logic as predict)
    // Dynamic Python Path Resolution
    const venvPathWindows = path.join(__dirname, 'model/venv/Scripts/python.exe');
    const venvPathLinux = path.join(__dirname, 'model/venv/bin/python');

    let cmd = 'python'; // Default fallback
    if (fs.existsSync(venvPathWindows)) {
        cmd = venvPathWindows;
    } else if (fs.existsSync(venvPathLinux)) {
        cmd = venvPathLinux;
    } else {
        if (process.platform === 'linux') {
            cmd = 'python3';
        }
    }

    // Path to training script
    const trainScript = path.join(__dirname, 'model/train.py');

    // Pass the filename as argument
    const trainProcess = spawn(cmd, [trainScript, currentDataFile], {
        cwd: path.join(__dirname, 'model')
    });
    console.log(`Spawning Python process: ${cmd} ${trainScript} ${currentDataFile}`);

    let output = '';

    trainProcess.on('error', (err) => {
        console.error('Failed to start Python process:', err);
        res.status(500).json({ error: 'Failed to start training script', details: err.message });
    });

    trainProcess.stdout.on('data', (data) => {
        console.log(`Training stdout: ${data}`);
        output += data.toString();
    });

    trainProcess.stderr.on('data', (data) => {
        console.error(`Training stderr: ${data}`);
    });

    trainProcess.on('close', (code) => {
        if (code === 0) {
            console.log('Model training completed successfully.');
            // Reset and reload
            salesData = [];
            loadData();
            res.json({ message: 'Data updated and model retrained successfully', output: output });
        } else {
            console.error('Model training failed.');
            res.status(500).json({ error: 'Model training failed', details: output });
        }
    });
});

// New Endpoint: Get Model Metadata for Frontend Form
app.get('/api/metadata', (req, res) => {
    const metaPath = path.join(__dirname, 'model/model_metadata.json');
    if (fs.existsSync(metaPath)) {
        res.sendFile(metaPath);
    } else {
        res.status(404).json({ error: 'Metadata not found. Model might not be trained yet.' });
    }
});

app.post('/api/predict', (req, res) => {
    // Inline Python script for prediction with FIXED SCHEMA
    const modelPath = path.join(__dirname, 'model/sales_model.pkl').replace(/\\/g, '/');
    const featuresPath = path.join(__dirname, 'model/model_features.pkl').replace(/\\/g, '/');
    const encodersPath = path.join(__dirname, 'model/encoders.pkl').replace(/\\/g, '/');

    const pythonCode = `
import sys, json, joblib
import pandas as pd
import numpy as np

# Fixed schema columns
CATEGORICAL_COLUMNS = ['region', 'product_category', 'sales_channel']
NUMERIC_COLUMNS = ['units_sold', 'unit_price', 'marketing_spend', 'is_holiday']

try:
    # Load artifacts
    model = joblib.load('${modelPath}')
    features = joblib.load('${featuresPath}')
    encoders = joblib.load('${encodersPath}')
    
    # Read input from stdin
    input_str = sys.stdin.read()
    if not input_str:
        print(json.dumps({"error": "No input received"}))
        sys.exit(0)
    
    input_data = json.loads(input_str)
    df = pd.DataFrame([input_data])
    
    # 1. Handle date - extract time features
    if 'date' in df.columns:
        df['date'] = pd.to_datetime(df['date'])
        df['day_of_week'] = df['date'].dt.dayofweek
        df['month'] = df['date'].dt.month
        df['day_of_year'] = df['date'].dt.dayofyear
        df['week_of_year'] = df['date'].dt.isocalendar().week.astype(int)
    
    # 2. Encode Categoricals (matching train.py format)
    for col in CATEGORICAL_COLUMNS:
        if col in df.columns and col in encoders:
            le = encoders[col]
            val = str(df.iloc[0][col])
            if val in le.classes_:
                df[f'{col}_encoded'] = le.transform([val])
            else:
                df[f'{col}_encoded'] = 0
    
    # 3. Ensure numeric columns are present
    for col in NUMERIC_COLUMNS:
        if col not in df.columns:
            df[col] = 0
        else:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    
    # 4. Align columns with training features
    X = df.reindex(columns=features, fill_value=0)
    
    # Predict
    prediction = float(model.predict(X)[0])
    print(json.dumps({"prediction": round(prediction, 2)}))

except Exception as e:
    import traceback
    traceback.print_exc()
    print(json.dumps({"error": str(e)}))
`;

    const venvPathWindows = path.join(__dirname, 'model/venv/Scripts/python.exe');
    const venvPathLinux = path.join(__dirname, 'model/venv/bin/python');
    let cmd = 'python';
    if (fs.existsSync(venvPathWindows)) cmd = venvPathWindows;
    else if (fs.existsSync(venvPathLinux)) cmd = venvPathLinux;
    else if (process.platform === 'linux') cmd = 'python3';

    const predictProcess = spawn(cmd, ['-c', pythonCode]);

    predictProcess.stdin.write(JSON.stringify(req.body));
    predictProcess.stdin.end();

    let dataString = '';
    predictProcess.stdout.on('data', (data) => {
        dataString += data.toString();
    });

    predictProcess.stderr.on('data', (data) => {
        console.error(`Python Stderr: ${data}`);
    });

    predictProcess.on('close', (code) => {
        try {
            // Find just the JSON part in case there's other stdout noise
            const jsonStart = dataString.indexOf('{');
            const jsonEnd = dataString.lastIndexOf('}');
            if (jsonStart === -1 || jsonEnd === -1) {
                throw new Error("No JSON found in output");
            }
            const jsonPart = dataString.substring(jsonStart, jsonEnd + 1);

            const result = JSON.parse(jsonPart);
            res.json(result);
        } catch (e) {
            console.error('Failed to parse python output:', dataString);
            res.status(500).json({ error: 'Prediction script failed', details: dataString });
        }
    });
});

app.get('/test', async (req, res) => {
    res.json({ a: 1 })
})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
