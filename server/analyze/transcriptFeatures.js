// Interaction features derived from the speaker-attributed transcript.
const GREET = /\b(hi|hello|hey|good (morning|afternoon|evening)|namaste|welcome)\b/i;
const HOWAREYOU = /\b(how are you|how'?s it going|what did you do|how was your|weekend|what'?s up|tell me about)\b/i;
const HOMEWORK = /\b(home ?work|h\.?w\.?|assignment|practice (this|it|at home)|try (this|it) at home|share (it|your)|send (me|it))\b/i;
const PRAISE = /\b(very good|good job|well done|excellent|awesome|amazing|great job|fantastic|super|wonderful|nice try|proud|that'?s (right|correct|great|nice)|perfect)\b/gi;
const BYE = /\b(bye|goodbye|see you|take care|class is over|that'?s all|we (will|'?ll) (meet|continue)|next class)\b/i;
const CHECKIN = /\b(can you (hear|see) me|am i audible|turn (on|off) your (camera|mic)|unmute|mute yourself)\b/gi;
const HOUSEKEEP = /(can you (hear|see) me|am i audible|visible|screen|unmute|mute|turn (on|off)|switch on|log ?in|join|network|internet|reconnect|blurry|clear\??$|okay\??$|yes\??$|hello\??$)/i;
const QWORD = /^(what|who|where|when|why|how|which|can you|do you|did you|is it|are you|shall we|who wants)\b/i;

const count = (s, re) => (s.match(re) || []).length;

export function transcriptFeatures(t) {
  const utts = t.utterances;
  const dur = t.duration || 1;
  if (!utts.length) return { empty: true };

  const words = {}, turns = {};
  for (const u of utts) {
    words[u.speaker] = (words[u.speaker] || 0) + u.text.split(/\s+/).length;
    turns[u.speaker] = (turns[u.speaker] || 0) + 1;
  }
  const teacher = Object.entries(words).sort((a, b) => b[1] - a[1])[0][0];
  const students = Object.keys(words).filter(s => s !== teacher);
  const teacherUtts = utts.filter(u => u.speaker === teacher);
  const studentUtts = utts.filter(u => u.speaker !== teacher);
  const totalWords = Object.values(words).reduce((a, b) => a + b, 0);

  // teaching questions only — exclude housekeeping/tech-check lines
  let questions = 0;
  for (const u of teacherUtts) {
    if (HOUSEKEEP.test(u.text) && u.text.split(/\s+/).length <= 8) continue;
    questions += (u.text.match(/\?/g) || []).length;
    if (QWORD.test(u.text.trim())) questions++;
  }

  const engaged = students.filter(s => turns[s] >= 3).length;
  const allTeacher = teacherUtts.map(u => u.text).join(' ');
  const praise = count(allTeacher, PRAISE);
  const exclaims = (allTeacher.match(/!/g) || []).length;

  const introEnd = Math.min(dur * 0.12, 360);
  const outroStart = dur - Math.min(dur * 0.12, 360);
  const introTeacher = teacherUtts.filter(u => u.start < introEnd).map(u => u.text).join(' ');
  const introAll = utts.filter(u => u.start < introEnd).map(u => u.text).join(' ');
  const outroAll = utts.filter(u => u.start >= outroStart).map(u => u.text).join(' ');

  const switches = utts.slice(1).filter((u, i) => u.speaker !== utts[i].speaker).length;

  // name-calls: teacher mentions a student's first name (one-to-one attention proxy)
  const firstNames = students
    .map(s => s.split(/[’'\s(]/)[0].trim().toLowerCase())
    .filter(n => n.length >= 3);
  const nameCallCounts = {};
  let nameCalls = 0;
  for (const u of teacherUtts) {
    const low = u.text.toLowerCase();
    for (const nm of firstNames) {
      if (new RegExp(`\\b${nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(low)) {
        nameCalls++; nameCallCounts[nm] = (nameCallCounts[nm] || 0) + 1; break;
      }
    }
  }

  return {
    empty: false, duration: dur, teacher,
    num_students: students.length, engaged_students: engaged,
    student_names: students,
    teacher_talk_ratio: totalWords ? words[teacher] / totalWords : 1,
    total_words: totalWords,
    words_per_min: totalWords / (dur / 60),
    questions, questions_per_10min: questions / (dur / 600),
    praise_count: praise, praise_per_10min: praise / (dur / 600),
    exclaims,
    turn_switches_per_min: switches / (dur / 60),
    has_greeting: GREET.test(introTeacher),
    has_rapport: HOWAREYOU.test(introAll),
    has_homework: HOMEWORK.test(allTeacher),
    has_bye: BYE.test(outroAll) || BYE.test(allTeacher.slice(-2000)),
    checkins: count(allTeacher, CHECKIN),
    name_calls: nameCalls, name_call_counts: nameCallCounts,
    teacher_utterances: teacherUtts.length,
    student_utterances: utts.length - teacherUtts.length,
    // shallow-drill detector: fraction of student turns that are substantive (>=5 words)
    student_substantive_ratio: studentUtts.length
      ? studentUtts.filter(u => u.text.split(/\s+/).length >= 5).length / studentUtts.length
      : 0,
    student_mean_words: studentUtts.length
      ? studentUtts.reduce((a, u) => a + u.text.split(/\s+/).length, 0) / studentUtts.length
      : 0,
  };
}
