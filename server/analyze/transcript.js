// Transcript handling: parse speaker-attributed VTT (Zoom export) or
// transcribe audio locally with Whisper (@xenova/transformers, ONNX, no API key).
import fs from 'fs';
import path from 'path';
import os from 'os';
import { extractPcm } from './ffmpeg.js';

const TS_RE = /(\d+):(\d+):(\d+)[.,](\d+)/g;

function tsToSec([h, m, s, ms]) {
  return (+h) * 3600 + (+m) * 60 + (+s) + (+ms) / 1000;
}

export function parseVtt(vttPath) {
  const raw = fs.readFileSync(vttPath, 'utf8');
  const blocks = raw.split(/\n\s*\n/);
  const utts = [];
  for (const b of blocks) {
    const lines = b.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const tsLine = lines.find(l => l.includes('-->'));
    if (!tsLine) continue;
    const m = [...tsLine.matchAll(TS_RE)].map(x => x.slice(1));
    if (m.length < 2) continue;
    const [start, end] = [tsToSec(m[0]), tsToSec(m[1])];
    const text = lines.filter(l => !l.includes('-->') && !/^\d+$/.test(l)).join(' ');
    const idx = text.indexOf(':');
    if (idx > 0 && idx < 40) {
      utts.push({ start, end, speaker: text.slice(0, idx).trim(), text: text.slice(idx + 1).trim() });
    } else if (text) {
      if (utts.length) { utts[utts.length - 1].text += ' ' + text; utts[utts.length - 1].end = end; }
      else utts.push({ start, end, speaker: 'Unknown', text });
    }
  }
  return { utterances: utts, duration: utts.length ? utts[utts.length - 1].end : 0 };
}

let whisperPipe = null;
async function getWhisper() {
  if (!whisperPipe) {
    const { pipeline } = await import('@xenova/transformers');
    whisperPipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small');
  }
  return whisperPipe;
}

export async function transcribe(videoPath, onProgress) {
  const raw = path.join(os.tmpdir(), `classrec_${Date.now()}.pcm`);
  await extractPcm(videoPath, raw);
  const buf = fs.readFileSync(raw);
  const audio = new Float32Array(buf.length / 2);
  for (let i = 0; i < audio.length; i++) audio[i] = buf.readInt16LE(i * 2) / 32768;
  fs.unlinkSync(raw);

  const asr = await getWhisper();
  const out = await asr(audio, {
    chunk_length_s: 30, stride_length_s: 5, return_timestamps: true,
    callback_function: (chunks) => {
      const last = chunks[chunks.length - 1];
      if (onProgress && last?.timestamp?.[1]) onProgress(last.timestamp[1]);
    },
  });
  const utts = (out.chunks || []).map(c => ({
    start: c.timestamp[0] ?? 0, end: c.timestamp[1] ?? c.timestamp[0] ?? 0,
    speaker: 'Speaker', text: c.text.trim(),
  }));
  return { utterances: utts, duration: utts.length ? utts[utts.length - 1].end : 0 };
}

// Prefer provided VTT (keeps speaker labels); otherwise whisper.
export async function loadTranscript(videoPath, vttPath, onProgress) {
  if (vttPath && fs.existsSync(vttPath)) {
    const t = parseVtt(vttPath);
    if (t.utterances.length) return t;
  }
  return transcribe(videoPath, onProgress);
}
