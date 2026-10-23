// Rubric scoring -> quality label + evidence-backed observations.
// Rubric derived from the organiser's feedbacks.pdf: excellent classes show
// rapport building, one-to-one questions to every child, branded background /
// camera on, homework assigned, and energetic pleasant delivery.

const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

export function scoreClass(tf, af, vf) {
  const obs = [];
  const detail = {};
  let score = 0;

  // ---------- Interaction (40 pts) ----------
  let inter = 0;
  const q10 = tf.questions_per_10min || 0;
  inter += clamp(q10 / 15) * 8;
  detail.questions_per_10min = +q10.toFixed(1);
  if (q10 >= 8) obs.push(['+', `Teacher asked ~${tf.questions} questions (${q10.toFixed(0)}/10min) — highly questioning-led class`]);
  else if (q10 >= 4) obs.push(['~', `Teacher asked ~${tf.questions} questions (${q10.toFixed(0)}/10min) — moderate questioning`]);
  else obs.push(['-', `Only ~${tf.questions} teacher questions (${q10.toFixed(0)}/10min) — mostly one-way talk`]);

  const nstu = Math.max(tf.num_students || 0, 1);
  const coverage = (tf.engaged_students || 0) / nstu;
  inter += clamp(coverage) * 8;
  if (tf.num_students > 1)
    obs.push([coverage >= 0.8 ? '+' : coverage >= 0.5 ? '~' : '-',
      `${tf.engaged_students}/${tf.num_students} students actively participated (>=3 turns): ${tf.student_names.slice(0, 8).join(', ')}`]);

  const sw = tf.turn_switches_per_min || 0;
  inter += clamp(sw / 12) * 10;
  detail.switches_per_min = +sw.toFixed(1);
  if (sw < 2) obs.push(['-', `Low back-and-forth (${sw.toFixed(1)} speaker turns/min) — long monologue stretches`]);

  // substantive student responses (>=5 words) — real engagement vs one-word drills
  const sub = tf.student_substantive_ratio || 0;
  inter += clamp(sub / 0.35) * 3;
  if (tf.student_utterances > 20 && sub < 0.15)
    obs.push(['-', `Students mostly reply in 1-3 words (avg ${(tf.student_mean_words || 0).toFixed(1)} words/turn) — drill-style, shallow engagement`]);

  const praise10 = tf.praise_per_10min || 0;
  inter += clamp(praise10 / 4) * 6;
  if (praise10 >= 2) obs.push(['+', `Frequent positive reinforcement (~${tf.praise_count} praise remarks)`]);
  else if (!tf.praise_count) obs.push(['-', `No praise/encouragement phrases detected ('good job', 'well done', ...)`]);

  const nc = tf.name_calls || 0;
  inter += clamp(nc / 25) * 6;
  if (nc >= 15) {
    const top = Object.entries(tf.name_call_counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
    obs.push(['+', `Teacher addresses children by name ~${nc}x (e.g. ${top.join(', ')})`]);
  } else if (nc < 5 && tf.num_students > 1) {
    obs.push(['-', 'Teacher rarely calls children by name — weak one-to-one attention']);
  }
  score += inter;
  detail.interaction = +inter.toFixed(1);

  // ---------- Structure (25 pts) ----------
  let struct = 0;
  if (tf.has_greeting) { struct += 5; obs.push(['+', 'Class opens with greetings']); }
  else obs.push(['-', 'No greeting detected in the opening minutes — jumps straight into content']);
  if (tf.has_rapport) { struct += 10; obs.push(['+', 'Rapport building at the start (small talk / how-are-you questions)']); }
  else obs.push(['-', 'Little rapport building — no warm-up chat with the kids before teaching']);
  if (tf.has_homework) { struct += 10; obs.push(['+', 'Homework / practice task assigned']); }
  else obs.push(['-', 'No homework or take-away task mentioned']);
  if (tf.has_bye) { struct += 5; obs.push(['+', 'Clear closing / goodbye']); }
  else obs.push(['~', 'No clear wrap-up or goodbye detected at the end']);
  score += struct;
  detail.structure = +struct.toFixed(1);

  // ---------- Delivery / energy (20 pts) ----------
  let deliv = 0;
  const wpm = tf.words_per_min || 0;
  if (wpm >= 40 && wpm <= 110) deliv += 8;
  else if ((wpm >= 25 && wpm < 40) || (wpm > 110 && wpm <= 140)) deliv += 4;
  detail.words_per_min = +wpm.toFixed(1);

  const sil = af?.silence_ratio;
  if (sil != null) {
    if (sil < 0.15) deliv += 6;
    else if (sil < 0.30) deliv += 3;
    detail.silence_ratio = +sil.toFixed(2);
    if (sil > 0.30) obs.push(['-', `${(sil * 100).toFixed(0)}% of the class was dead air (silences >4s) — low energy / disengagement`]);
  }
  const ex = tf.exclaims || 0;
  deliv += clamp(ex / 40) * 6;
  if (ex >= 25) obs.push(['+', `Energetic tone (${ex} exclamations / animated remarks)`]);
  score += deliv;
  detail.delivery = +deliv.toFixed(1);

  // ---------- Visual / AV (15 pts) ----------
  let vis = 0;
  if (vf && vf.available && vf.black_ratio != null) {
    const onRatio = 1 - Math.max(vf.black_ratio, vf.dark_frame_ratio ?? 0);
    vis += clamp(onRatio / 0.85) * 9;
    if (onRatio < 0.5)
      obs.push(['-', `Screen was black / camera off for ~${((1 - onRatio) * 100).toFixed(0)}% of the class`]);
    else obs.push(['+', `Video feed active most of the time (${(onRatio * 100).toFixed(0)}% non-black frames)`]);
    if (vf.mean_brightness != null && vf.mean_brightness < 60) {
      vis -= 2;
      obs.push(['-', `Poor lighting (mean brightness ${vf.mean_brightness.toFixed(0)}/255)`]);
    }
    if (vf.freeze_ratio != null && vf.freeze_ratio > 0.5)
      obs.push(['~', 'Screen mostly static/frozen — long stretches with no visual activity']);
    else vis += 6;
    vis = Math.max(0, vis);
  } else {
    vis = 7.5;
    obs.push(['~', 'No video frames analysed (audio-only input)']);
  }
  score += vis;
  detail.visual = +vis.toFixed(1);

  // ---------- severity gates (mirroring human feedback patterns) ----------
  const caps = [];
  if (vf && vf.available) {
    const offRatio = Math.max(vf.black_ratio || 0, vf.dark_frame_ratio || 0);
    if (offRatio > 0.2) caps.push([50, 'camera off / dark screen for a large part of the class']);
    if ((vf.freeze_ratio || 0) > 0.6) caps.push([55, 'screen frozen/static for most of the class']);
  }
  if (sil != null && sil > 0.45) caps.push([50, 'majority of class time was silence']);
  if (!tf.has_rapport && !tf.has_greeting) caps.push([54, 'no greeting or rapport — class starts cold']);
  if ((tf.praise_count || 0) === 0 && q10 < 6) caps.push([54, 'flat delivery: no praise and little questioning']);
  if ((tf.student_utterances || 0) > 20 && (tf.student_substantive_ratio || 0) < 0.2
      && (tf.student_mean_words || 0) < 4)
    caps.push([62, 'students give only short 1-word answers — drill-style shallow engagement']);
  for (const [cap, why] of caps) {
    if (score > cap) {
      score = cap;
      obs.push(['-', `Grade capped: ${why}`]);
    }
  }

  score = Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
  const label = score >= 82 ? 'Excellent' : score >= 66 ? 'Good' : score >= 52 ? 'Average' : 'Poor';
  return { label, score, components: detail, observations: obs };
}
