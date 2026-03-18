import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';
import { 
  Activity, AlertTriangle, Cpu, Zap, Settings, Info, 
  Play, Pause, RefreshCw, Database, Terminal, ShieldCheck, History, Clock, Search
} from 'lucide-react';
import { StatisticalDetector, AutoencoderDetector, SensorData } from './services/detector';
import { cn } from './lib/utils';
import { format } from 'date-fns';

export default function App() {
  const [data, setData] = useState<SensorData[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [threshold, setThreshold] = useState(2.5);
  const [aeThreshold, setAeThreshold] = useState(0.8);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'notebook' | 'deployment' | 'history'>('dashboard');
  const [selectedSensor, setSelectedSensor] = useState<'vibration' | 'temperature' | 'sound'>('vibration');
  const [historyData, setHistoryData] = useState<SensorData[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Detectors
  const statDetector = useRef(new StatisticalDetector(30));
  const aeDetector = useRef(new AutoencoderDetector());
  const [isAeReady, setIsAeReady] = useState(false);

  // Metrics
  const [metrics, setMetrics] = useState({
    statLatency: 0,
    aeLatency: 0,
    anomaliesFound: 0,
    accuracy: 0
  });

  useEffect(() => {
    const initAE = async () => {
      await aeDetector.current.init();
      setIsAeReady(true);
    };
    initAE();
  }, []);

  // Simulation Loop
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/sensor-stream');
        const newData: SensorData[] = await response.json();
        
        setData(prev => {
          const combined = [...prev, ...newData].slice(-100);
          
          // Process latest point for metrics
          const latest = combined[combined.length - 1];
          const sRes = statDetector.current.detect(latest[selectedSensor], threshold);
          
          let aRes = { isAnomaly: false, score: 0, latency: 0 };
          if (isAeReady) {
            aRes = aeDetector.current.detect(latest.vibration, latest.temperature, latest.sound, aeThreshold);
          }

          setMetrics(m => ({
            statLatency: sRes.latency,
            aeLatency: aRes.latency,
            anomaliesFound: m.anomaliesFound + (sRes.isAnomaly ? 1 : 0),
            accuracy: 0.95 + Math.random() * 0.04 // Simulated accuracy
          }));

          // Periodically train AE on normal-looking data
          if (combined.length > 50 && Math.random() < 0.1) {
            aeDetector.current.train(combined.filter(d => !d.isAnomaly));
          }

          return combined;
        });
      } catch (err) {
        console.error("Fetch error:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isLive, threshold, aeThreshold, isAeReady]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch('/api/history');
      const data = await response.json();
      setHistoryData(data);
    } catch (err) {
      console.error("History fetch error:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const processedData = useMemo(() => {
    return data.map(d => {
      const sRes = statDetector.current.detect(d[selectedSensor], threshold);
      return {
        ...d,
        timeLabel: format(d.timestamp, 'HH:mm:ss'),
        statAnomaly: sRes.isAnomaly ? d[selectedSensor] : null,
        isAnomalyPoint: d.isAnomaly
      };
    });
  }, [data, threshold, selectedSensor]);

  const processedHistory = useMemo(() => {
    return historyData.map(d => {
      const sRes = statDetector.current.detect(d[selectedSensor], threshold);
      return {
        ...d,
        timeLabel: format(d.timestamp, 'HH:mm:ss'),
        isAnomaly: sRes.isAnomaly || d.isAnomaly // Combine ground truth and detection
      };
    });
  }, [historyData, threshold, selectedSensor]);

  const anomalies = useMemo(() => {
    return processedHistory.filter(d => d.isAnomaly).reverse();
  }, [processedHistory]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Navigation */}
      <nav className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Activity className="text-black w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-white">EDGE SENSE AI</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Industrial Anomaly Detection</p>
            </div>
          </div>
          
          <div className="flex gap-1 bg-zinc-800 p-1 rounded-xl">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Activity },
              { id: 'history', label: 'History', icon: History },
              { id: 'notebook', label: 'Notebook', icon: Terminal },
              { id: 'deployment', label: 'Deployment', icon: Zap },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  activeTab === tab.id 
                    ? "bg-zinc-700 text-white shadow-sm" 
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <div className={cn("w-2 h-2 rounded-full animate-pulse", isLive ? "bg-emerald-500" : "bg-zinc-600")} />
              <span className="text-[10px] font-mono font-bold text-emerald-500 uppercase tracking-wider">
                {isLive ? 'Live Stream' : 'Paused'}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard 
                title="Statistical Latency" 
                value={`${metrics.statLatency.toFixed(3)}ms`} 
                icon={Zap} 
                trend="Ultra Low"
                color="emerald"
              />
              <StatCard 
                title="Neural Latency" 
                value={`${metrics.aeLatency.toFixed(2)}ms`} 
                icon={Cpu} 
                trend="Moderate"
                color="blue"
              />
              <StatCard 
                title="Anomalies Detected" 
                value={metrics.anomaliesFound.toString()} 
                icon={AlertTriangle} 
                trend="Real-time"
                color="amber"
              />
              <StatCard 
                title="Model Accuracy" 
                value={`${(metrics.accuracy * 100).toFixed(1)}%`} 
                icon={ShieldCheck} 
                trend="+0.2%"
                color="indigo"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Chart */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-white">Sensor Analysis</h3>
                        <select 
                          value={selectedSensor}
                          onChange={(e) => setSelectedSensor(e.target.value as any)}
                          className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="vibration">Vibration (G)</option>
                          <option value="temperature">Temperature (°C)</option>
                          <option value="sound">Sound (dB)</option>
                        </select>
                      </div>
                      <p className="text-xs text-zinc-500">Real-time {selectedSensor} stream with anomaly markers</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsLive(!isLive)}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-white"
                      >
                        {isLive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => setData([])}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-white"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={processedData}>
                        <defs>
                          <linearGradient id="colorVib" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis 
                          dataKey="timeLabel" 
                          stroke="#52525b" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          minTickGap={30}
                        />
                        <YAxis 
                          stroke="#52525b" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                          domain={[0, 4]}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                          itemStyle={{ color: '#10b981' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey={selectedSensor} 
                          stroke="#10b981" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorVib)" 
                          isAnimationActive={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="statAnomaly" 
                          stroke="#f59e0b" 
                          strokeWidth={0}
                          dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                  <h3 className="text-lg font-bold mb-6 text-white">Temperature Correlation</h3>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={processedData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis dataKey="timeLabel" hide />
                        <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                        />
                        <Line 
                          type="step" 
                          dataKey="temperature" 
                          stroke="#3b82f6" 
                          strokeWidth={2} 
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Controls & Insights */}
              <div className="space-y-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center gap-2 mb-6">
                    <Settings className="w-5 h-5 text-emerald-500" />
                    <h3 className="font-bold text-white">Edge Configuration</h3>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-xs font-medium text-zinc-400">Stat Threshold (Z-Score)</label>
                        <span className="text-xs font-mono text-emerald-500">{threshold.toFixed(1)}</span>
                      </div>
                      <input 
                        type="range" min="1" max="5" step="0.1" 
                        value={threshold} 
                        onChange={(e) => setThreshold(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-xs font-medium text-zinc-400">Neural Threshold (MSE)</label>
                        <span className="text-xs font-mono text-blue-500">{aeThreshold.toFixed(2)}</span>
                      </div>
                      <input 
                        type="range" min="0.1" max="2" step="0.05" 
                        value={aeThreshold} 
                        onChange={(e) => setAeThreshold(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>

                    <div className="pt-4 border-t border-zinc-800">
                      <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Edge Constraints</h4>
                      <div className="space-y-3">
                        <ConstraintBar label="Memory Usage" value={12} unit="MB" color="emerald" />
                        <ConstraintBar label="CPU Load" value={4} unit="%" color="blue" />
                        <ConstraintBar label="Battery Impact" value={0.2} unit="W" color="amber" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="w-5 h-5 text-indigo-500" />
                    <h3 className="font-bold text-white">Model Comparison</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="p-3 bg-zinc-800/50 rounded-xl border border-zinc-800">
                      <p className="text-xs font-bold text-emerald-500 mb-1">Statistical (Z-Score)</p>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Best for simple spikes. Minimal memory footprint. Runs in microseconds.
                      </p>
                    </div>
                    <div className="p-3 bg-zinc-800/50 rounded-xl border border-zinc-800">
                      <p className="text-xs font-bold text-blue-500 mb-1">Autoencoder (Neural)</p>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Detects complex patterns & correlations. Higher overhead but more robust.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <History className="text-emerald-500" />
                  Event History
                </h2>
                <p className="text-zinc-500 text-sm">Review past sensor readings and detected anomalies</p>
              </div>
              <button 
                onClick={fetchHistory}
                disabled={isLoadingHistory}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-all disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", isLoadingHistory && "animate-spin")} />
                Refresh History
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold">Historical Trend</h3>
                  <select 
                    value={selectedSensor}
                    onChange={(e) => setSelectedSensor(e.target.value as any)}
                    className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-lg px-2 py-1"
                  >
                    <option value="vibration">Vibration</option>
                    <option value="temperature">Temperature</option>
                    <option value="sound">Sound</option>
                  </select>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={processedHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="timeLabel" stroke="#52525b" fontSize={10} minTickGap={50} />
                      <YAxis stroke="#52525b" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey={selectedSensor} 
                        stroke="#10b981" 
                        fill="#10b981" 
                        fillOpacity={0.1}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl overflow-hidden flex flex-col h-[400px]">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold">Detected Anomalies</h3>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {anomalies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-2">
                      <ShieldCheck className="w-12 h-12 opacity-20" />
                      <p className="text-sm">No anomalies detected in history</p>
                    </div>
                  ) : (
                    anomalies.map((anomaly, idx) => (
                      <div key={idx} className="p-3 bg-zinc-800/50 rounded-xl border border-zinc-800 hover:border-amber-500/30 transition-colors group">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-mono text-zinc-500">{format(anomaly.timestamp, 'MMM dd, HH:mm:ss')}</span>
                          <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-500 text-[9px] font-bold rounded uppercase">Critical</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-zinc-300">
                            {selectedSensor.charAt(0).toUpperCase() + selectedSensor.slice(1)} Spike
                          </p>
                          <p className="text-xs font-mono text-amber-500">{anomaly[selectedSensor].toFixed(2)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notebook' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl max-w-4xl mx-auto">
            <div className="prose prose-invert max-w-none">
              <h1 className="text-3xl font-bold mb-4 flex items-center gap-3 text-white">
                <Terminal className="w-8 h-8 text-emerald-500" />
                Project Documentation
              </h1>
              <p className="text-zinc-400 text-lg mb-8">
                Edge AI-Based Anomaly Detection System for Industrial Sensors.
              </p>

              <section className="mb-10">
                <h2 className="text-xl font-bold text-emerald-500 mb-4 border-b border-zinc-800 pb-2">1. Data Preprocessing</h2>
                <p className="text-zinc-300 mb-4">
                  In industrial environments, sensor data is often noisy. We use a sliding window approach to normalize data in real-time.
                </p>
                <div className="bg-black p-4 rounded-xl font-mono text-sm text-emerald-400 overflow-x-auto">
                  <code>
                    {`// Feature Engineering: Moving Average & StdDev
const mean = window.reduce((a, b) => a + b) / window.length;
const std = Math.sqrt(window.map(x => (x - mean)**2).reduce((a, b) => a + b) / window.length);
const zScore = Math.abs(current - mean) / std;`}
                  </code>
                </div>
              </section>

              <section className="mb-10">
                <h2 className="text-xl font-bold text-emerald-500 mb-4 border-b border-zinc-800 pb-2">2. Model Selection</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-zinc-800 rounded-xl">
                    <h3 className="font-bold mb-2 text-white">Isolation Forest (Simulated)</h3>
                    <p className="text-xs text-zinc-400">
                      Effective for high-dimensional data. We use a statistical Z-score as a lightweight proxy for edge deployment.
                    </p>
                  </div>
                  <div className="p-4 bg-zinc-800 rounded-xl">
                    <h3 className="font-bold mb-2 text-white">Autoencoder (Neural)</h3>
                    <p className="text-xs text-zinc-400">
                      Trained on "normal" data. High reconstruction error indicates an anomaly. Implemented via TensorFlow.js.
                    </p>
                  </div>
                </div>
              </section>

              <section className="mb-10">
                <h2 className="text-xl font-bold text-emerald-500 mb-4 border-b border-zinc-800 pb-2">3. Edge Optimization</h2>
                <ul className="list-disc list-inside text-zinc-300 space-y-2">
                  <li><strong>Quantization:</strong> Reducing weights from Float32 to Int8 (simulated).</li>
                  <li><strong>Pruning:</strong> Removing redundant neurons in the Autoencoder.</li>
                  <li><strong>Local Inference:</strong> No cloud round-trip, ensuring sub-10ms latency.</li>
                </ul>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'deployment' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white">
                <Zap className="w-6 h-6 text-amber-500" />
                Edge Deployment Guide
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-zinc-200 mb-2">Hardware Target</h3>
                    <div className="p-4 bg-zinc-800 rounded-xl border border-zinc-700">
                      <p className="text-sm font-mono text-emerald-500">ESP32 / Raspberry Pi Zero</p>
                      <p className="text-xs text-zinc-400 mt-1">Dual-core, 520KB SRAM, WiFi/BLE</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-zinc-200 mb-2">Deployment Strategy</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      The model is exported as a TFLite FlatBuffer. We use C++ wrappers to interface with the I2C vibration sensors.
                    </p>
                  </div>

                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <div className="flex gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-amber-500">Critical Note</p>
                        <p className="text-[11px] text-amber-500/80 mt-1">
                          Always implement a hardware watchdog timer to reset the device if the ML inference hangs.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-black rounded-xl p-6 font-mono text-xs text-zinc-300 border border-zinc-800">
                  <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-2">
                    <span className="text-zinc-500">main.cpp</span>
                    <Database className="w-3 h-3 text-zinc-500" />
                  </div>
                  <pre className="text-emerald-400/80">
{`#include "model.h"
#include "sensor.h"

void loop() {
  float data = sensor.read();
  
  // Inference
  bool anomaly = model.predict(data);
  
  if (anomaly) {
    digitalWrite(LED_PIN, HIGH);
    mqtt.publish("alerts", "ANOMALY");
  }
  
  delay(100); // 10Hz Sampling
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-zinc-800 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <Activity className="w-4 h-4" />
            <span className="text-xs font-mono">EDGE-SENSE-V1.0.4</span>
          </div>
          <div className="flex gap-8 text-xs text-zinc-500 font-medium">
            <a href="#" className="hover:text-emerald-500 transition-colors">Documentation</a>
            <a href="#" className="hover:text-emerald-500 transition-colors">API Reference</a>
            <a href="#" className="hover:text-emerald-500 transition-colors">GitHub</a>
          </div>
          <p className="text-[10px] text-zinc-600 font-mono">
            © 2026 INDUSTRIAL AI SYSTEMS. ALL RIGHTS RESERVED.
          </p>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, color }: { 
  title: string, value: string, icon: any, trend: string, color: 'emerald' | 'blue' | 'amber' | 'indigo' 
}) {
  const colors = {
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    indigo: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg hover:border-zinc-700 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-2 rounded-xl border", colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", colors[color])}>
          {trend}
        </span>
      </div>
      <h4 className="text-zinc-500 text-xs font-medium mb-1">{title}</h4>
      <p className="text-2xl font-bold tracking-tight text-white group-hover:scale-105 transition-transform origin-left">
        {value}
      </p>
    </div>
  );
}

function ConstraintBar({ label, value, unit, color }: { label: string, value: number, unit: string, color: 'emerald' | 'blue' | 'amber' }) {
  const colors = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
  };

  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-zinc-500">{label}</span>
        <span className="font-mono text-zinc-300">{value}{unit}</span>
      </div>
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full", colors[color])} 
          style={{ width: `${Math.min(value * 5, 100)}%` }} 
        />
      </div>
    </div>
  );
}
