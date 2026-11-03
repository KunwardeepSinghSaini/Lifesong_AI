import 'dotenv/config'; // MUST be the first import

import express from 'express';
import cors from 'cors';
import songRoutes from './routes/song.routes.js';
import { STORAGE_DIR } from './services/storage.service.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Generated audio (supports Range requests, so seeking works)
app.use('/media', express.static(STORAGE_DIR));

// Register API Routes
app.use('/api', songRoutes);

// Healthcheck Route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[Server] AI Karaoke Backend running on http://localhost:${PORT}`);
});