import { loadTranscript } from './transcript.js';
import { transcriptFeatures } from './transcriptFeatures.js';
import { audioFeatures, videoFeatures } from './mediaFeatures.js';
import { scoreClass } from './scoring.js';

export async function analyzeRecording(videoPath, vttPath = null, opts = {}) {
  const t = await loadTranscript(videoPath, vttPath, opts.onProgress);
  const tf = transcriptFeatures(t);
  if (tf.empty) {
    return { label: 'Poor', score: 0, components: {},
      observations: [['-', 'No speech detected in the recording']], features: {} };
  }
  const af = await audioFeatures(videoPath);
  const vf = opts.skipVideo ? null : await videoFeatures(videoPath);
  const result = scoreClass(tf, af, vf);
  result.features = { ...tf,
    ...Object.fromEntries(Object.entries(af).map(([k, v]) => [`audio_${k}`, v])),
    ...(vf ? Object.fromEntries(Object.entries(vf).map(([k, v]) => [`video_${k}`, v])) : {}) };
  result.transcript_preview = t.utterances.slice(0, 40);
  result.teacher = tf.teacher;
  return result;
}
