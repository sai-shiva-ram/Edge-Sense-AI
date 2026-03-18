import * as tf from '@tensorflow/tfjs';

export interface SensorData {
  timestamp: number;
  vibration: number;
  temperature: number;
  sound: number;
  isAnomaly?: boolean;
}

export interface DetectionResult {
  isAnomaly: boolean;
  score: number;
  latency: number; // ms
}

/**
 * Statistical Anomaly Detection (Z-Score)
 * Extremely lightweight, suitable for low-power edge devices.
 */
export class StatisticalDetector {
  private windowSize: number;
  private history: number[] = [];

  constructor(windowSize: number = 20) {
    this.windowSize = windowSize;
  }

  detect(value: number, threshold: number = 3): DetectionResult {
    const start = performance.now();
    this.history.push(value);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }

    if (this.history.length < 5) {
      return { isAnomaly: false, score: 0, latency: performance.now() - start };
    }

    const mean = this.history.reduce((a, b) => a + b, 0) / this.history.length;
    const stdDev = Math.sqrt(
      this.history.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / this.history.length
    );

    const zScore = stdDev === 0 ? 0 : Math.abs(value - mean) / stdDev;
    const isAnomaly = zScore > threshold;

    return {
      isAnomaly,
      score: zScore,
      latency: performance.now() - start
    };
  }
}

/**
 * Neural Network Anomaly Detection (Autoencoder)
 * More complex, higher accuracy, requires more resources.
 */
export class AutoencoderDetector {
  private model: tf.LayersModel | null = null;
  private isTraining: boolean = false;

  async init() {
    // Simple Autoencoder: Input(3) -> Hidden(6) -> Latent(2) -> Hidden(6) -> Output(3)
    const model = tf.sequential();
    
    // Encoder
    model.add(tf.layers.dense({ units: 6, activation: 'relu', inputShape: [3] }));
    model.add(tf.layers.dense({ units: 2, activation: 'relu' }));
    
    // Decoder
    model.add(tf.layers.dense({ units: 6, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 3, activation: 'linear' }));

    model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
    this.model = model;
  }

  async train(data: SensorData[]) {
    if (!this.model || this.isTraining) return;
    this.isTraining = true;

    const inputs = data.map(d => [d.vibration, d.temperature, d.sound]);
    const tensorInputs = tf.tensor2d(inputs);

    await this.model.fit(tensorInputs, tensorInputs, {
      epochs: 10,
      batchSize: 32,
      verbose: 0
    });

    tensorInputs.dispose();
    this.isTraining = false;
  }

  detect(vibration: number, temperature: number, sound: number, threshold: number = 0.5): DetectionResult {
    const start = performance.now();
    if (!this.model) return { isAnomaly: false, score: 0, latency: 0 };

    const input = tf.tensor2d([[vibration, temperature, sound]]);
    const prediction = this.model.predict(input) as tf.Tensor;
    
    // Reconstruction Error (MSE)
    const mse = tf.losses.meanSquaredError(input, prediction).dataSync()[0];
    
    input.dispose();
    prediction.dispose();

    return {
      isAnomaly: mse > threshold,
      score: mse,
      latency: performance.now() - start
    };
  }
}
