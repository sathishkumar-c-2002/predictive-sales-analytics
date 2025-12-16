const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
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

// Routes

app.get('/api/sales', (req, res) => {
    res.json(salesData);
});

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    // Cleanup: Delete old CSVs and model artifacts
    const modelDir = path.join(__dirname, 'model');
    try {
        const files = fs.readdirSync(modelDir);
        files.forEach(file => {
            const filePath = path.join(modelDir, file);
            // Delete if it's a CSV and NOT the current uploaded file
            // OR if it's a model artifact
            if (
                (file.endsWith('.csv') && file !== req.file.originalname) ||
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

    console.log(`New CSV uploaded: ${req.file.originalname}. Starting model training...`);

    // Update current file reference
    currentDataFile = req.file.originalname;

    // Determine Python path (same logic as predict)
    const pythonPath = path.join(__dirname, 'model/venv/Scripts/python.exe');
    const cmd = fs.existsSync(pythonPath) ? pythonPath : 'python';

    // Path to training script
    const trainScript = path.join(__dirname, 'model/train.py');

    // Pass the filename as argument
    const process = spawn(cmd, [trainScript, currentDataFile], {
        cwd: path.join(__dirname, 'model')
    });
    console.log(`Spawning Python process: ${cmd} ${trainScript} ${currentDataFile}`);

    let output = '';

    process.on('error', (err) => {
        console.error('Failed to start Python process:', err);
        res.status(500).json({ error: 'Failed to start training script', details: err.message });
    });

    process.stdout.on('data', (data) => {
        console.log(`Training stdout: ${data}`);
        output += data.toString();
    });

    process.stderr.on('data', (data) => {
        console.error(`Training stderr: ${data}`);
    });

    process.on('close', (code) => {
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
    // Inline Python script logic
    // Using forward slashes for paths to avoid running into escape character issues in Python string
    const modelPath = path.join(__dirname, 'model/sales_model.pkl').replace(/\\/g, '/');
    const featuresPath = path.join(__dirname, 'model/model_features.pkl').replace(/\\/g, '/');
    const encodersPath = path.join(__dirname, 'model/encoders.pkl').replace(/\\/g, '/');

    const pythonCode = `
import sys, json, joblib
import pandas as pd
import numpy as np

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
    
    # Preprocessing (Dynamic)
    # 1. Handle dates if present (assuming input might have date components directly)
    if 'date' in df.columns:
        df['date'] = pd.to_datetime(df['date'])
        df['day_of_week'] = df['date'].dt.dayofweek
        df['month'] = df['date'].dt.month
        df['day_of_year'] = df['date'].dt.dayofyear
        
    # 2. Encode Categoricals
    for col, le in encoders.items():
        if col in df.columns:
            # Handle unknown labels
            val = str(df.iloc[0][col])
            if val in le.classes_:
                df[col] = le.transform([val])
            else:
                # Fallback for unknown: use first class or specific unknown handling
                # ideally we should have an 'unknown' class, but for now just use 0
                df[col] = 0 
    
    # 3. Align columns
    # Reindex checks if col exists, fills 0 if missing, drops extras
    X = df.reindex(columns=features, fill_value=0)
    
    # Predict
    prediction = model.predict(X)[0]
    print(json.dumps({"prediction": prediction}))

except Exception as e:
    import traceback
    traceback.print_exc()
    print(json.dumps({"error": str(e)}))
`;

    const pythonPath = path.join(__dirname, 'model/venv/Scripts/python.exe');
    const cmd = fs.existsSync(pythonPath) ? pythonPath : 'python';

    const process = spawn(cmd, ['-c', pythonCode]);

    process.stdin.write(JSON.stringify(req.body));
    process.stdin.end();

    let dataString = '';
    process.stdout.on('data', (data) => {
        dataString += data.toString();
    });

    process.stderr.on('data', (data) => {
        console.error(`Python Stderr: ${data}`);
    });

    process.on('close', (code) => {
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

app.get('/test',async(req,res)=>{
    res.json({"a":1})
})
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
