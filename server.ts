import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const historyBuffer: any[] = [];
  const MAX_HISTORY = 500;

  // Initialize history
  historyBuffer.push(...generateSyntheticData(100));

  // Simulated Sensor Data Stream Endpoint
  app.get("/api/sensor-stream", (req, res) => {
    const newData = generateSyntheticData(1);
    historyBuffer.push(...newData);
    if (historyBuffer.length > MAX_HISTORY) {
      historyBuffer.shift();
    }
    res.json(newData);
  });

  app.get("/api/history", (req, res) => {
    res.json(historyBuffer);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

function generateSyntheticData(count: number) {
  const data = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const timestamp = now - (count - i) * 1000;
    // Normal vibration: 0.5 to 1.5 range
    // Normal temp: 60 to 70 range
    let vibration = 1.0 + (Math.random() - 0.5) * 0.4;
    let temperature = 65 + (Math.random() - 0.5) * 5;
    let sound = 40 + (Math.random() - 0.5) * 10;
    
    // Inject occasional anomalies (2% chance)
    const isAnomaly = Math.random() < 0.02;
    if (isAnomaly) {
      vibration += (Math.random() > 0.5 ? 2.0 : -0.8);
      temperature += (Math.random() > 0.5 ? 15 : -10);
      sound += (Math.random() > 0.5 ? 30 : -20);
    }

    data.push({
      timestamp,
      vibration: parseFloat(vibration.toFixed(3)),
      temperature: parseFloat(temperature.toFixed(2)),
      sound: parseFloat(sound.toFixed(2)),
      isAnomaly, // Ground truth for evaluation
    });
  }
  return data;
}

startServer();
