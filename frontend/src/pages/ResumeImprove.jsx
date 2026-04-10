// src/pages/ResumeImprove.jsx
import { useState } from 'react';
import Navbar from '../components/Navbar';
import { uploadResume, improveResume, getAuthData } from '../services/api';

export default function ResumeImprove() {
  const { userId } = getAuthData();
  const [file, setFile]       = useState(null);
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState('upload');
  const [error, setError]     = useState('');

  const handleProcess = async () => {
    if (!file) return setError('Please select a resume file.');
    setLoading(true); setError('');
    try {
      const uploadRes = await uploadResume(file, userId);
      const improveRes = await improveResume(uploadRes.data.resumeId);
      setResult(improveRes.data);
      setStep('results');
    } catch {
      setError('Failed to process resume. Ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const issueColor = (type) => {
    if (type === 'grammar')    return '#ef4444';
    if (type === 'formatting') return '#f59e0b';
    if (type === 'missing')    return '#a855f7';
    return '#00f5ff';
  };

  return (
    <div style={styles.page}>
      <Navbar />
      <div style={styles.orb} />

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.badge}>✨ RESUME IMPROVEMENT TOOL</div>
          <h1 style={styles.title}>
            Improve Your <span style={styles.neon}>Resume</span>
          </h1>
          <p style={styles.subtitle}>
            Detect grammar issues, formatting problems, and missing skills — then get a corrected version
          </p>
        </div>

        {/* Issue Legend */}
        <div style={styles.legendRow}>
          {[
            { color: '#ef4444', label: 'Grammar Issues' },
            { color: '#f59e0b', label: 'Formatting Problems' },
            { color: '#a855f7', label: 'Missing Skills' },
            { color: '#00f5ff', label: 'Suggestions' },
          ].map((item, i) => (
            <div key={i} style={styles.legendItem}>
              <div style={{ ...styles.legendDot, background: item.color }} />
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{item.label}</span>
            </div>
          ))}
        </div>

        {error && <div style={styles.errorBox}>⚠️ {error}</div>}

        {/* Upload Step */}
        {step === 'upload' && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>📤 Upload Resume to Improve</h2>

            <div
              style={{ ...styles.dropZone, ...(file ? styles.dropActive : {}) }}
              onClick={() => document.getElementById('imp-file').click()}
            >
              <input
                id="imp-file" type="file" accept=".pdf,.docx"
                style={{ display: 'none' }}
                onChange={(e) => { setFile(e.target.files[0]); setError(''); }}
              />
              {file ? (
                <>
                  <div style={{ fontSize: '3rem', marginBottom: '10px' }}>✅</div>
                  <div style={styles.fileName}>{file.name}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '3.5rem', marginBottom: '14px' }}>🔍</div>
                  <div style={styles.dropText}>Click to select your resume</div>
                  <div style={{ color: '#64748b', fontSize: '0.9rem' }}>PDF or DOCX</div>
                </>
              )}
            </div>

            {/* What it checks */}
            <div style={styles.checkList}>
              {[
                { icon: '📝', label: 'Grammar & Spelling Mistakes' },
                { icon: '🎨', label: 'Formatting & Structure Problems' },
                { icon: '🎯', label: 'Missing Skills & Keywords' },
                { icon: '🤖', label: 'AI-Enhanced Corrected Version' },
              ].map((item, i) => (
                <div key={i} style={styles.checkItem}>
                  <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{item.label}</span>
                </div>
              ))}
            </div>

            <button
              style={styles.btn}
              onClick={handleProcess}
              disabled={loading || !file}
            >
              {loading ? '🧠 Analyzing Issues...' : '🔍 Analyze & Improve'}
            </button>

            {loading && (
              <div style={styles.loadingBox}>
                <div style={styles.spinner} />
                <p style={styles.loadingText}>Scanning for issues…</p>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '8px' }}>
                  Checking grammar • Analyzing formatting • Finding missing skills
                </p>
              </div>
            )}
          </div>
        )}

        {/* Results Step */}
        {step === 'results' && result && (
          <div>
            <div style={styles.resultHeader}>
              <h2 style={styles.cardTitle}>🔍 Issues Found & Fixes</h2>
              <button
                style={styles.btnOutline}
                onClick={() => { setFile(null); setResult(null); setStep('upload'); }}
              >
                🔄 Analyze Another
              </button>
            </div>

            {/* Score Summary */}
            <div style={styles.scoreRow}>
              {[
                { label: 'Grammar Issues',  value: result.grammarIssues    || 0, color: '#ef4444' },
                { label: 'Format Issues',   value: result.formatIssues     || 0, color: '#f59e0b' },
                { label: 'Missing Skills',  value: result.missingSkillsCount || 0, color: '#a855f7' },
                { label: 'Score After Fix', value: `${result.improvedScore || 0}%`, color: '#10b981' },
              ].map((item, i) => (
                <div key={i} style={styles.scoreBox}>
                  <div style={{ ...styles.scoreNum, color: item.color }}>{item.value}</div>
                  <div style={styles.scoreLbl}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* Improvement Points */}
            {result.improvementSuggestions && (
              <div style={{ ...styles.card, marginBottom: '20px' }}>
                <h3 style={{ ...styles.sectionTitle, color: '#00f5ff' }}>
                  💡 Improvement Suggestions
                </h3>
                <div style={styles.issueList}>
                  {result.improvementSuggestions.split('\n').filter(Boolean).map((issue, i) => {
                    const type = issue.toLowerCase().includes('grammar') ? 'grammar'
                      : issue.toLowerCase().includes('format') ? 'formatting'
                      : issue.toLowerCase().includes('skill') ? 'missing' : 'suggestion';
                    return (
                      <div key={i} style={styles.issueItem}>
                        <div style={{ ...styles.issueDot, background: issueColor(type) }} />
                        <span style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.6 }}>
                          {issue.replace(/^[-•*\d.]\s*/, '')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Missing Keywords */}
            {result.missingKeywords && (
              <div style={{ ...styles.card, marginBottom: '20px' }}>
                <h3 style={{ ...styles.sectionTitle, color: '#a855f7' }}>
                  🎯 Missing Skills to Add
                </h3>
                <div style={styles.tagRow}>
                  {result.missingKeywords.split(',').filter(Boolean).map((k, i) => (
                    <span key={i} style={styles.missingTag}>{k.trim()}</span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Enhanced Version */}
            {result.feedbackPoints && (
              <div style={styles.card}>
                <h3 style={{ ...styles.sectionTitle, color: '#10b981' }}>
                  🤖 AI-Enhanced Feedback
                </h3>
                <ul style={styles.bulletList}>
                  {result.feedbackPoints.split('\n').filter(Boolean).map((pt, i) => (
                    <li key={i} style={styles.bulletItem}>
                      <span style={styles.bulletDot}>›</span>
                      <span style={{ color: '#94a3b8', lineHeight: 1.7 }}>
                        {pt.replace(/^[-•*]\s*/, '')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh', background: '#050510',
    fontFamily: "'Rajdhani', sans-serif",
    position: 'relative', overflowX: 'hidden',
  },
  orb: {
    position: 'fixed', bottom: '10%', left: '5%',
    width: '400px', height: '400px',
    background: 'radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 70%)',
    borderRadius: '50%', pointerEvents: 'none',
  },
  container: {
    position: 'relative', zIndex: 2,
    maxWidth: '840px', margin: '0 auto',
    padding: '120px 24px 60px',
  },
  header: { textAlign: 'center', marginBottom: '32px' },
  badge: {
    display: 'inline-block', padding: '6px 18px',
    background: 'rgba(168,85,247,0.08)',
    border: '1px solid rgba(168,85,247,0.25)',
    borderRadius: '20px', color: '#a855f7',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.65rem', letterSpacing: '2px', marginBottom: '18px',
  },
  title: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '2rem', fontWeight: '900', marginBottom: '12px',
  },
  neon: { color: '#00f5ff', textShadow: '0 0 15px rgba(0,245,255,0.5)' },
  subtitle: { color: '#64748b', fontSize: '1rem' },
  legendRow: {
    display: 'flex', gap: '24px', justifyContent: 'center',
    flexWrap: 'wrap', marginBottom: '32px',
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: '8px' },
  legendDot: { width: '10px', height: '10px', borderRadius: '50%' },
  errorBox: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '12px', padding: '14px 20px',
    color: '#ef4444', marginBottom: '24px',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(168,85,247,0.12)',
    borderRadius: '20px', padding: '36px',
  },
  cardTitle: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1.1rem', fontWeight: '700',
    color: 'white', marginBottom: '20px',
  },
  dropZone: {
    border: '2px dashed rgba(255,255,255,0.15)',
    borderRadius: '16px', padding: '50px 40px',
    textAlign: 'center', cursor: 'pointer',
    transition: 'all 0.3s', marginBottom: '28px',
  },
  dropActive: {
    border: '2px dashed #a855f7',
    background: 'rgba(168,85,247,0.05)',
  },
  fileName: {
    fontFamily: "'Share Tech Mono', monospace",
    color: '#00f5ff', fontSize: '1rem', marginBottom: '8px',
  },
  dropText: {
    fontSize: '1.1rem', color: '#94a3b8',
    marginBottom: '8px', fontWeight: '600',
  },
  checkList: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: '12px', marginBottom: '28px',
  },
  checkItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
  },
  btn: {
    width: '100%', padding: '15px',
    background: 'linear-gradient(135deg, #a855f7, #6366f1)',
    border: 'none', borderRadius: '12px',
    color: 'white', fontFamily: "'Orbitron', monospace",
    fontSize: '0.8rem', fontWeight: '700',
    cursor: 'pointer', letterSpacing: '2px',
  },
  loadingBox: { textAlign: 'center', padding: '28px', marginTop: '20px' },
  spinner: {
    width: '44px', height: '44px',
    border: '3px solid rgba(168,85,247,0.1)',
    borderTop: '3px solid #a855f7',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite', margin: '0 auto',
  },
  loadingText: {
    color: '#a855f7', marginTop: '16px',
    fontFamily: "'Orbitron', monospace", fontSize: '0.75rem',
  },
  resultHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '20px',
  },
  btnOutline: {
    padding: '10px 20px', background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '10px', color: '#94a3b8',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.65rem', cursor: 'pointer',
  },
  scoreRow: {
    display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap',
  },
  scoreBox: {
    flex: 1, minWidth: '120px', padding: '20px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '14px', textAlign: 'center',
  },
  scoreNum: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1.6rem', fontWeight: '900',
  },
  scoreLbl: { color: '#64748b', fontSize: '0.78rem', marginTop: '4px' },
  sectionTitle: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.78rem', letterSpacing: '1px', marginBottom: '18px',
  },
  issueList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  issueItem: { display: 'flex', gap: '12px', alignItems: 'flex-start' },
  issueDot: {
    width: '8px', height: '8px', borderRadius: '50%',
    marginTop: '7px', minWidth: '8px',
  },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  missingTag: {
    padding: '5px 14px',
    background: 'rgba(168,85,247,0.08)',
    border: '1px solid rgba(168,85,247,0.25)',
    borderRadius: '20px', color: '#a855f7', fontSize: '0.82rem',
  },
  bulletList: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexDirection: 'column', gap: '10px',
  },
  bulletItem: { display: 'flex', gap: '10px', alignItems: 'flex-start' },
  bulletDot: {
    color: '#10b981', fontSize: '1.3rem',
    lineHeight: 1.3, fontWeight: '900', minWidth: '14px',
  },
};
