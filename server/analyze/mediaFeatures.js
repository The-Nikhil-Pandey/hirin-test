// Media features via ffmpeg filters: silence, loudness, black/frozen frames, brightness.
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { FFMPEG_PATH } from './ffmpeg.js';

function ffmpegLog(args) {
  return new Promise((resolve) => {
    execFile(FFMPEG_PATH, args, { maxBuffer: 1 << 28 }, (err, stdout, stderr) => resolve(stderr || ''));
  });
}

export async function audioFeatures(mediaPath) {
  const log = await ffmpegLog(['-i', mediaPath, '-af',
    'silencedetect=noise=-35dB:d=4,volumedetect', '-f', 'null', '-']);

  const durations = [...log.matchAll(/silence_duration: ([\d.]+)/g)].map(m => +m[1]);
  const silenceSeconds = durations.reduce((a, b) => a + b, 0);
  const dm = log.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const duration = dm ? (+dm[1]) * 3600 + (+dm[2]) * 60 + (+dm[3]) : 0;
  const mean = log.match(/mean_volume: ([-\d.]+) dB/);
  const max = log.match(/max_volume: ([-\d.]+) dB/);
  return {
    duration, silence_seconds: silenceSeconds,
    silence_ratio: duration ? silenceSeconds / duration : 0,
    mean_volume_db: mean ? +mean[1] : null,
    max_volume_db: max ? +max[1] : null,
    num_silences: durations.length,
  };
}

export async function videoFeatures(videoPath) {
  // one decode pass split into 3 chains: blackdetect (camera off),
  // freezedetect (static screen), tiny grayscale frames (brightness)
  const rawOut = path.join(os.tmpdir(), `bright_${Date.now()}.raw`);
  const log = await ffmpegLog(['-i', videoPath, '-filter_complex',
    '[0:v]split=3[a][b][c];' +
    '[a]blackdetect=d=2:pix_th=0.10[outa];' +
    '[b]freezedetect=n=-55dB:d=5[outb];' +
    '[c]fps=1/20,scale=8:8[outc]',
    '-map', '[outa]', '-f', 'null', '-',
    '-map', '[outb]', '-f', 'null', '-',
    '-map', '[outc]', '-pix_fmt', 'gray', '-f', 'rawvideo', rawOut]);

  const blackIntervals = [...log.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)]
    .map(m => +m[2] - +m[1]);
  const blackSeconds = blackIntervals.reduce((a, b) => a + b, 0);
  const freezeDurs = [...log.matchAll(/freeze_duration: ([\d.]+)/g)].map(m => +m[1]);
  const freezeSeconds = freezeDurs.reduce((a, b) => a + b, 0);

  const dm = log.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const duration = dm ? (+dm[1]) * 3600 + (+dm[2]) * 60 + (+dm[3]) : 0;

  let meanBrightness = null, darkRatio = null;
  try {
    const buf = fs.readFileSync(rawOut);
    fs.unlinkSync(rawOut);
    const frameBytes = 64;
    const n = Math.floor(buf.length / frameBytes);
    let sum = 0, dark = 0;
    for (let f = 0; f < n; f++) {
      let fs2 = 0;
      for (let i = 0; i < frameBytes; i++) fs2 += buf[f * frameBytes + i];
      const m = fs2 / frameBytes;
      sum += m;
      if (m < 25) dark++;
    }
    if (n) { meanBrightness = sum / n; darkRatio = dark / n; }
  } catch { /* no video stream */ }

  return {
    available: duration > 0,
    duration,
    black_ratio: duration ? Math.min(blackSeconds / duration, 1) : null,
    freeze_ratio: duration ? Math.min(freezeSeconds / duration, 1) : null,
    mean_brightness: meanBrightness,
    dark_frame_ratio: darkRatio,
  };
}
