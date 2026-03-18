# Edge AI Anomaly Detection System

A real-time industrial monitoring system designed for edge deployment. This project demonstrates how to detect anomalies in sensor data (vibration, temperature) using both lightweight statistical methods and neural networks.

## 🚀 Features
- **Dual-Model Architecture**: 
  - **Statistical (Z-Score)**: Sub-millisecond latency, minimal memory footprint.
  - **Autoencoder (Neural Network)**: Pattern-based detection using TensorFlow.js.
- **Real-time Visualization**: Live dashboard with Recharts.
- **Edge Simulation**: Visualizes memory usage, CPU load, and inference latency.
- **Threshold Tuning**: Dynamic sensitivity adjustment for different industrial environments.

## 🛠️ Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Recharts.
- **Machine Learning**: TensorFlow.js.
- **Backend**: Node.js, Express (Synthetic Data Generator).
- **Icons**: Lucide React.

## 📈 ML Models
1. **Z-Score Detector**: Calculates the standard deviation of a sliding window. If a point deviates beyond the threshold (e.g., 3σ), it's flagged.
2. **Autoencoder**: A neural network that learns to reconstruct "normal" data. High reconstruction error (MSE) indicates an anomaly.

## 📦 Installation
1. Clone the repository.
2. Install dependencies: `npm install`.
3. Start the dev server: `npm run dev`.

## 📖 Documentation
See the **Notebook** tab in the application for detailed explanations of feature engineering and model selection.
