import React, { useState } from 'react';

const LABEL_COLORS = {
  Excellent: '#16a34a', Good: '#65a30d', Average: '#d97706', Poor: '#dc2626',
};
const ICON = { '+': '✓', '~': '•', '-': '✗' };
const ICON_COLOR = { '+': '#16a34a', '~': '#d97706', '-': '#dc2626' };

export default function App() {
  const [rec, setRec] = useState(null);
  const [vtt, setVtt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function analyze(e) {
    e.preventDefault();
    if (!rec) return;
    setLoading(true); setError(null); setResult(null);
    const fd = new FormData();
    fd.append('recording', rec);
    if (vtt) fd.append('transcript', vtt);
    try {
      const r = await fetch('/api/analyze', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'analysis failed');
      setResult(j);
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  return (
    <div className="page">
      <h1>8x8 Class Quality Assessor</h1>
      <p className="sub">Upload a class recording — get a quality grade with specific observations.</p>

      <form onSubmit={analyze} className="card">
        <label>Class recording (video/audio) *
          <input type="file" accept="video/*,audio/*" onChange={e => setRec(e.target.files[0])} required />
        </label>
        <label>Zoom transcript .vtt (optional — improves accuracy)
          <input type="file" accept=".vtt,.txt" onChange={e => setVtt(e.target.files[0])} />
        </label>
        <button disabled={!rec || loading}>
          {loading ? 'Analysing… (transcribing may take a few minutes)' : 'Assess quality'}
        </button>
      </form>

      {error && <div className="card error">{error}</div>}

      {result && (
        <div className="card">
          <div className="verdict" style={{ borderColor: LABEL_COLORS[result.label] }}>
            <span className="label" style={{ color: LABEL_COLORS[result.label] }}>{result.label}</span>
            <span className="score">{result.score} / 100</span>
          </div>

          <div className="bars">
            {Object.entries(result.components).filter(([k]) =>
              ['interaction', 'structure', 'delivery', 'visual'].includes(k)).map(([k, v]) => (
              <div key={k} className="bar-row">
                <span className="bar-name">{k}</span>
                <div className="bar"><div className="fill" style={{
                  width: `${(v / { interaction: 40, structure: 25, delivery: 20, visual: 15 }[k]) * 100}%` }} /></div>
                <span>{v}</span>
              </div>
            ))}
          </div>

          <h3>Observations</h3>
          <ul className="obs">
            {result.observations.map(([s, text], i) => (
              <li key={i}><span style={{ color: ICON_COLOR[s] }}>{ICON[s]}</span> {text}</li>
            ))}
          </ul>

          <details>
            <summary>Raw features</summary>
            <pre>{JSON.stringify(result.features, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
