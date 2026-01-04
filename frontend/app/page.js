'use client';

import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Direct API calls to Render backend (CORS is enabled)
const API_BASE = 'https://predictive-sales-analytics.onrender.com';

export default function Home() {
  const [salesData, setSalesData] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Dynamic Model State
  const [modelMetadata, setModelMetadata] = useState(null);
  const [dynamicForm, setDynamicForm] = useState({});

  // Format Info Modal
  const [showFormatInfo, setShowFormatInfo] = useState(false);

  useEffect(() => {
    fetchSalesData();
    fetchMetadata();
  }, []);

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/sales`);
      const data = await res.json();
      setSalesData(data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/metadata`);
      if (res.ok) {
        const meta = await res.json();
        setModelMetadata(meta);

        // Initialize form state
        const initialForm = {};
        meta.features.forEach(f => {
          if (f.type === 'categorical') {
            initialForm[f.name] = f.options[0] || '';
          } else if (f.type === 'date') {
            initialForm[f.name] = '2025-01-15';
          } else {
            initialForm[f.name] = 0;
          }
        });
        setDynamicForm(initialForm);
      }
    } catch (error) {
      console.error('Error fetching metadata:', error);
    }
  };

  const handleInputChange = (featureName, value) => {
    setDynamicForm(prev => ({
      ...prev,
      [featureName]: value
    }));
  };

  const handleDownloadTemplate = () => {
    window.open(`${API_BASE}/api/template`, '_blank');
  };

  const handleDownloadSample = () => {
    // Local sample file in public folder
    window.open('/sample_sales_data.csv', '_blank');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        alert('✅ Upload Successful! Model retrained.');
        setFile(null);
        const fileInput = document.getElementById('csvInput');
        if (fileInput) fileInput.value = "";
        fetchSalesData();
        fetchMetadata();
      } else {
        // Show detailed error message
        setUploadError({
          message: data.error || 'Upload failed',
          details: data.details || '',
          required: data.required_columns || []
        });
      }
    } catch (e) {
      setUploadError({ message: 'Network error. Please try again.' });
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const handlePredict = async (e) => {
    e.preventDefault();
    setLoading(true);
    setPrediction(null);
    try {
      const res = await fetch(`${API_BASE}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dynamicForm),
      });
      const data = await res.json();
      if (data.error) {
        console.error("Backend Error:", data.error);
        alert('Prediction Error: ' + data.error);
      } else {
        setPrediction(data.prediction);
      }
    } catch (error) {
      console.error('Error predicting:', error);
      alert('Failed to get prediction');
    } finally {
      setLoading(false);
    }
  };

  // Chart Data Preparation
  const aggregatedData = {};
  salesData.forEach(row => {
    if (!aggregatedData[row.date]) aggregatedData[row.date] = 0;
    aggregatedData[row.date] += row.sales;
  });

  const dates = Object.keys(aggregatedData).sort();
  const sales = dates.map(d => aggregatedData[d]);

  const lineChartData = {
    labels: dates,
    datasets: [
      {
        label: 'Daily Sales',
        data: sales,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.1
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: false },
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: '#f3f4f6' } }
    }
  };

  // Required CSV Format
  const requiredColumns = [
    { name: 'date', type: 'YYYY-MM-DD', example: '2024-01-15' },
    { name: 'region', type: 'Text', example: 'North, South, East, West' },
    { name: 'product_category', type: 'Text', example: 'Electronics, Clothing' },
    { name: 'sales_channel', type: 'Text', example: 'Online or Offline' },
    { name: 'units_sold', type: 'Number', example: '150' },
    { name: 'unit_price', type: 'Decimal', example: '299.99' },
    { name: 'marketing_spend', type: 'Decimal', example: '1200.00' },
    { name: 'is_holiday', type: '0 or 1', example: '0' },
    { name: 'sales', type: 'Decimal', example: '44998.50 (TARGET)' }
  ];

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-12 font-sans text-gray-800">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
            📊 Sales Analytics Dashboard
          </h1>
          <p className="text-gray-500">Forecast and analyze your business performance with ML</p>
        </header>

        {/* 1. Main Chart Section */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Historical Trends</h2>
          <div className="h-[500px] w-full flex items-center justify-center bg-gray-50 rounded-lg border border-gray-100 p-2">
            {loading ? (
              <div className="animate-pulse text-gray-400">Loading sales data...</div>
            ) : (
              <Line options={chartOptions} data={lineChartData} />
            )}
          </div>
        </section>

        {/* 2. Upload Section with Format Info */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-700">📤 Upload Sales Data</h2>
            <button
              onClick={() => setShowFormatInfo(!showFormatInfo)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              {showFormatInfo ? '✕ Hide Format' : 'ℹ️ View Required Format'}
            </button>
          </div>

          {/* Format Info Panel */}
          {showFormatInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-blue-900">⚠️ Required CSV Format</h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadSample}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    📊 Download Sample (60 rows)
                  </button>
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    ⬇️ Download Template
                  </button>
                </div>
              </div>
              <p className="text-sm text-blue-800">
                Your CSV file <strong>must contain exactly these 9 columns</strong> in any order:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-blue-900">Column Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-blue-900">Type</th>
                      <th className="px-3 py-2 text-left font-semibold text-blue-900">Example</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100">
                    {requiredColumns.map((col, i) => (
                      <tr key={i} className={col.name === 'sales' ? 'bg-green-50' : ''}>
                        <td className="px-3 py-2 font-mono text-blue-800">{col.name}</td>
                        <td className="px-3 py-2 text-gray-700">{col.type}</td>
                        <td className="px-3 py-2 text-gray-500">{col.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Upload Error Alert */}
          {uploadError && (
            <div className="bg-red-50 border border-red-300 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-red-800">❌ {uploadError.message}</h4>
              {uploadError.details && (
                <pre className="text-sm text-red-700 whitespace-pre-wrap font-mono bg-red-100 p-2 rounded">
                  {uploadError.details}
                </pre>
              )}
              {uploadError.required && uploadError.required.length > 0 && (
                <p className="text-sm text-red-700">
                  <strong>Required columns:</strong> {uploadError.required.join(', ')}
                </p>
              )}
              <button
                onClick={handleDownloadTemplate}
                className="text-sm text-red-700 underline hover:text-red-900"
              >
                Download correct template →
              </button>
            </div>
          )}

          {/* Upload Form */}
          <div className="flex gap-4 items-center p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="grid gap-1 flex-1">
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                Select CSV File
              </label>
              <input
                type="file"
                id="csvInput"
                accept=".csv"
                onChange={(e) => {
                  setFile(e.target.files[0]);
                  setUploadError(null);
                }}
                className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
              />
            </div>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || uploading}
              className="whitespace-nowrap px-6 py-3 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? '⏳ Training...' : '🚀 Upload & Train Model'}
            </button>
          </div>
        </section>

        {/* 3. Prediction Section */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-700">🔮 Generate Prediction</h2>
            {modelMetadata?.model_metrics && (
              <div className="text-sm text-gray-500">
                Model Accuracy: MAE ${modelMetadata.model_metrics.test_mae?.toLocaleString() || 'N/A'}
              </div>
            )}
          </div>

          {!modelMetadata ? (
            <div className="text-center py-8 text-gray-500">
              <p>📊 Upload a CSV file and train the model to see prediction parameters.</p>
              <button
                onClick={() => setShowFormatInfo(true)}
                className="mt-2 text-blue-600 hover:underline"
              >
                View required format →
              </button>
            </div>
          ) : (
            <>
              {/* Input Fields Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {modelMetadata.features.map(feature => (
                  <div key={feature.name} className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-600" title={feature.name}>
                      {feature.name.replace(/_/g, ' ').split(' ').map(word =>
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ')}
                    </label>
                    {feature.type === 'categorical' ? (
                      <select
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white text-sm"
                        value={dynamicForm[feature.name] || ''}
                        onChange={(e) => handleInputChange(feature.name, e.target.value)}
                      >
                        {feature.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : feature.type === 'date' ? (
                      <input
                        type="date"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                        value={dynamicForm[feature.name] || '2025-01-15'}
                        onChange={(e) => handleInputChange(feature.name, e.target.value)}
                      />
                    ) : (
                      <input
                        type="number"
                        step="any"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                        value={dynamicForm[feature.name] || 0}
                        onChange={(e) => handleInputChange(feature.name, parseFloat(e.target.value) || 0)}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Predict Button and Result */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handlePredict}
                  className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-lg shadow-md hover:shadow-lg transform transition-all active:scale-95 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? '⏳ Predicting...' : '✨ Generate Forecast'}
                </button>

                {prediction !== null && prediction !== undefined && (
                  <div className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 rounded-xl border-2 border-green-200 font-bold text-2xl text-center animate-pulse">
                    💰 Predicted Sales: ${Number(prediction).toLocaleString()}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

      </div>
    </main>
  );
}
