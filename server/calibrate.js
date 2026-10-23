// Run the pipeline over the labeled dataset; print predicted vs true labels.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseVtt } from './analyze/transcript.js';
import { transcriptFeatures } from './analyze/transcriptFeatures.js';
import { audioFeatures, videoFeatures } from './analyze/mediaFeatures.js';
import { scoreClass } from './analyze/scoring.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = path.join(ROOT, 'dataset', 'class recordings');
const TRUE = { 'weak': 'Poor', 'quality issue': 'Poor', 'average': 'Average', 'good': 'Good', 'excellent': 'Excellent' };

const rows = [];
for (const [folder, trueLabel] of Object.entries(TRUE)) {
  const dir = path.join(BASE, folder);
  if (!fs.existsSync(dir)) continue;
  const mp4s = fs.readdirSync(dir).filter(f => f.endsWith('.mp4'));
  const vtts = fs.readdirSync(dir).filter(f => f.endsWith('.vtt'));
  for (const vtt of vtts) {
    const stem = vtt.toLowerCase().split('-transcript')[0].split(' transcript')[0].split(' part')[0].trim();
    const vid = mp4s.find(m => m.toLowerCase().includes(stem)) || mp4s[0] || null;
    console.log(`\n=== ${folder}: ${vtt} (video: ${vid || 'NONE'})`);
    const t = parseVtt(path.join(dir, vtt));
    const tf = transcriptFeatures(t);
    // audio+video features are the expensive part -> cache by video file
    const cacheFile = path.join(ROOT, 'feature_cache.json');
    const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
    const key = `${folder}/${vid || vtt}`;
    if (!cache[key]) {
      cache[key] = {
        af: vid ? await audioFeatures(path.join(dir, vid)) : {},
        vf: vid ? await videoFeatures(path.join(dir, vid)) : null,
      };
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
    }
    const r = scoreClass(tf, cache[key].af, cache[key].vf);
    r.features = { ...tf,
      ...Object.fromEntries(Object.entries(cache[key].af).map(([k, v]) => [`audio_${k}`, v])),
      ...(cache[key].vf ? Object.fromEntries(Object.entries(cache[key].vf).map(([k, v]) => [`video_${k}`, v])) : {}) };
    const f = r.features;
    console.log(`  TRUE=${trueLabel} PRED=${r.label} score=${r.score}`);
    console.log(`  comp=${JSON.stringify(r.components)}`);
    console.log(`  q/10m=${f.questions_per_10min?.toFixed(1)} engaged=${f.engaged_students}/${f.num_students} ` +
      `sw/min=${f.turn_switches_per_min?.toFixed(1)} praise10=${f.praise_per_10min?.toFixed(1)} ` +
      `names=${f.name_calls} sil=${f.audio_silence_ratio?.toFixed(2)} ` +
      `black=${f.video_black_ratio?.toFixed(2) ?? '-'} dark=${f.video_dark_frame_ratio?.toFixed(2) ?? '-'} ` +
      `freeze=${f.video_freeze_ratio?.toFixed(2) ?? '-'} bright=${f.video_mean_brightness?.toFixed(0) ?? '-'} wpm=${f.words_per_min?.toFixed(0)}`);
    rows.push({ folder, vtt, true: trueLabel, pred: r.label, score: r.score, components: r.components });
  }
}
console.log('\n===== SUMMARY =====');
let correct = 0;
for (const r of rows) {
  const ok = r.true === r.pred; correct += ok;
  console.log(`${ok ? 'OK ' : 'MISS'} ${r.true.padEnd(9)} -> ${r.pred.padEnd(9)} (${r.score})  ${r.vtt}`);
}
console.log(`accuracy: ${correct}/${rows.length}`);
fs.writeFileSync(path.join(ROOT, 'calibration_results.json'), JSON.stringify(rows, null, 2));
