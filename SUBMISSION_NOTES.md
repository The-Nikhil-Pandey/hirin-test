# Approach (≤300 words)

**What I built.** A MERN app (React + Express) that accepts a class recording
(plus an optional Zoom .vtt transcript) and returns a Poor/Average/Good/Excellent
grade with evidence-backed observations.

**Why this approach.** The provided feedbacks.pdf showed human graders care about
specific, checkable things: rapport building at the start, one-to-one questions to
every child, homework assigned, energetic pleasant delivery, and camera/background
discipline. Rather than sending confidential children's recordings to a third-party
LLM, I extract these signals locally and score them with a transparent rubric —
reproducible, explainable, and privacy-safe.

**Pipeline.** Zoom VTT transcripts (or local Whisper transcription when absent) give
interaction metrics: questions/10min, per-student participation coverage, turn-taking
rate, praise phrases, name-call frequency, greeting/rapport/homework/closing markers.
ffmpeg yields delivery + AV signals: silence ratio, loudness, black-screen
(camera-off) and frozen-screen ratios, brightness. A weighted rubric (interaction 40,
structure 25, delivery 20, AV 15) produces a 0–100 score mapped to the four labels.

**What worked.** Speaker-attributed transcripts are a goldmine — student-coverage
and name-call metrics separate coached classes from monologues. Structure markers
(rapport, homework) matched the human feedback rubric almost exactly.

**What failed / limits.** Raw question counts over-reward drill-style classes;
energy is only approximated by silence/exclamations; "branded background" is
proxied by camera-on signals rather than detected. Whisper on CPU is slow, so the
.vtt path is preferred. With only ~9 labeled samples, thresholds are indicative,
not learned.
