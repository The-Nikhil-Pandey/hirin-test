# 8x8 Class Quality Assessor

AI-powered app that grades an online class recording **Poor / Average / Good / Excellent**
and explains *why*, with specific evidence (question rate, student coverage, rapport,
homework, energy, camera-on time).

## Architecture (MERN-style: React + Express + Node)

```
client/  React (Vite) UI — upload recording + optional .vtt transcript
server/  Express API — POST /api/analyze
server/analyze/
  transcript.js          Zoom VTT parser, Whisper transcription (@xenova/transformers, local ONNX)
  transcriptFeatures.js  interaction metrics (questions, turn-taking, praise, name-calls, structure)
  mediaFeatures.js       ffmpeg: silence ratio, loudness, black/frozen-frame ratio, brightness
  scoring.js             rubric -> 0-100 score -> label + observations
  pipeline.js            orchestration
server/calibrate.js      replays the labeled sample dataset, prints true vs predicted
```

## How it works

1. **Transcript** — if you upload a Zoom `.vtt`, speaker labels give per-student
   participation. Otherwise the server transcribes audio locally with Whisper
   (Xenova/whisper-small, ONNX — no API key, nothing leaves the machine).
2. **Signals**
   - *Interaction (40 pts)*: teacher questions /10 min, % of students actively speaking,
     speaker turn-taking rate, praise phrases, addressing kids by name.
   - *Structure (25 pts)*: greeting + rapport in the opening minutes, homework assigned,
     clear wrap-up.
   - *Delivery (20 pts)*: speaking pace, dead-air ratio, energetic tone.
   - *AV quality (15 pts)*: camera-off/black-screen time, frozen screen, lighting.
3. **Rubric** is calibrated on the sample set and mirrors `feedbacks.pdf`
   (rapport, one-to-one attention, homework, energy, camera on).

## Run locally

Requirements: Node 18+, ffmpeg on PATH (or edit `server/analyze/ffmpeg.js` BIN path).

```bash
cd server && npm install && npm start        # API on :4000
cd client && npm install && npm run dev      # UI on :5173
```

Open http://localhost:5173, upload a recording (add the Zoom `.vtt` if you have it —
much faster and more accurate), click *Assess quality*.

## Calibrate / evaluate on the sample dataset

```bash
cd server && npm run calibrate
```

Prints predicted vs human label for every sample and writes `calibration_results.json`.

## Calibration results (sample dataset)

`npm run calibrate` replays all 10 labeled transcripts. Current accuracy **7/10**
with sensible ordering (no weak class scores above Average):

- All 3 Excellent + the testable Good sample: correct
- Weak + quality-issue classes: Poor/Average via severity gates (silence>45%,
  camera-off>20%, no greeting+rapport, shallow drill engagement)
- Misses: B435-good has a corrupt ASR transcript (nonsense text, wrong speaker
  detection); B516/B558 are borderline one-level errors

## Notes / limitations

- Whisper transcription of a 60-min class takes a few minutes on CPU; supplying the
  `.vtt` skips it entirely.
- No paid LLM/vision APIs — everything is deterministic and offline, so results are
  reproducible and the confidential recordings never leave the machine.
- "Branded 8x8 background" is approximated by camera-on/brightness signals, not logo
  detection.
