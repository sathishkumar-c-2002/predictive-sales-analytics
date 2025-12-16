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

export default function Home() {
  const [salesData, setSalesData] = useState([]);
  const [regions, setRegions] = useState([]); // This might become redundant if regions are part of dynamicForm
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true); // General loading state for data fetching and prediction
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Dynamic Model State
  const [modelMetadata, setModelMetadata] = useState(null); // { features: [], target_column: '' }
  const [dynamicForm, setDynamicForm] = useState({}); // { feature_name: value }

  // Form state (old, will be removed by dynamic form)
  // const [formData, setFormData] = useState({
  //   date: '2025-01-01',
  //   region: 'North',
  //   marketing_spend: 100,
  //   holiday: 0
  // });

  useEffect(() => {
    fetchSalesData();
    fetchMetadata();
  }, []);

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/sales');
      const data = await res.json();
      setSalesData(data);
      // Extract unique regions (still useful for historical data display if needed)
      const uniqueRegions = [...new Set(data.map(item => item.region))].sort();
      setRegions(uniqueRegions);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/metadata');
      if (res.ok) {
        const meta = await res.json();
        setModelMetadata(meta);

        // Initialize form state
        const initialForm = {};
        meta.features.forEach(f => {
          if (f.type === 'categorical') {
            initialForm[f.name] = f.options[0] || '';
          } else if (f.type === 'date') {
            initialForm[f.name] = '2025-01-01'; // Default date
          } else {
            initialForm[f.name] = 0; // Default for numerical
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

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        alert('Upload Successful! Model retrained.');
        setFile(null);
        // Clear file input
        const fileInput = document.getElementById('csvInput');
        if (fileInput) fileInput.value = "";
        fetchSalesData();
        fetchMetadata(); // Refresh form fields
      } else {
        alert('Upload Failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Upload failed');
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
      const res = await fetch('http://localhost:5000/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
        borderColor: 'rgb(59, 130, 246)', // Tailwind blue-500
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

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-12 font-sans text-gray-800">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
            Sales Analytics Dashboard
          </h1>
          <p className="text-gray-500">Forecast and analyze your business performance</p>
        </header>

        {/* 1. Main Chart Section - Bigger & Top */}
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

        {/* 2. Action Bar - Upload & Train + Generate Forecast */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">

          {/* Upload Section */}
          <div className="flex-1 w-full md:w-auto">
            <div className="flex gap-4 items-center p-2 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="grid gap-1">
                <label className="text-xs font-bold text-blue-800 uppercase tracking-wide">Update Dataset</label>
                <input
                  type="file"
                  id="csvInput"
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />
              </div>

              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || uploading}
                className="whitespace-nowrap px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed h-fit"
              >
                {uploading ? 'Training...' : 'Upload & Train'}
              </button>
            </div>
          </div>

          {/* Prediction Button */}
          <div className="flex-1 w-full md:w-auto flex justify-end items-center gap-4">
            {prediction !== null && prediction !== undefined && (
              <div className="px-6 py-2 bg-green-100 text-green-800 rounded-xl border border-green-200 font-bold text-lg animate-in fade-in">
                Forecast: ${Number(prediction).toFixed(2)}
              </div>
            )}

            <button
              type="button"
              onClick={handlePredict}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md hover:shadow-lg transform transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !modelMetadata}
            >
              {loading ? 'Predicting...' : 'Generate Forecast'}
            </button>
          </div>
        </section>

        {/* 3. Input Fields - 5 Columns */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold mb-6 text-gray-700">Prediction Parameters</h2>
          {!modelMetadata ? (
            <p className="text-gray-500 text-center py-8">Upload a CSV and train the model to see prediction parameters.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {modelMetadata.features.map(feature => (
                <div key={feature.name} className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-600 truncate" title={feature.name}>
                    {feature.name.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
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
                      value={dynamicForm[feature.name] || '2025-01-01'}
                      onChange={(e) => handleInputChange(feature.name, e.target.value)}
                    />
                  ) : (
                    <input
                      type="number"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                      value={dynamicForm[feature.name] || 0}
                      onChange={(e) => handleInputChange(feature.name, parseFloat(e.target.value))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
