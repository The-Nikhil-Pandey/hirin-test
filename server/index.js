import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { analyzeRecording } from './analyze/pipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ dest: path.join(__dirname, 'uploads') });
const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/analyze', upload.fields([
  { name: 'recording', maxCount: 1 },
  { name: 'transcript', maxCount: 1 },
]), async (req, res) => {
  const rec = req.files?.recording?.[0];
  if (!rec) return res.status(400).json({ error: 'recording file is required' });
  const vtt = req.files?.transcript?.[0];
  try {
    const result = await analyzeRecording(rec.path, vtt?.path || null);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  } finally {
    fs.rm(rec.path, { force: true }, () => {});
    if (vtt) fs.rm(vtt.path, { force: true }, () => {});
  }
});

// quick health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
