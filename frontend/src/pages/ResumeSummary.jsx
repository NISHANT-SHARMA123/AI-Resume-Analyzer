// src/pages/ResumeSummary.jsx
import { useState } from 'react';
import Navbar from '../components/Navbar';
import { uploadResume, generateSummary, getAuthData } from '../services/api';

export default function ResumeSummary() {
  const { userId } = getAuthData();
  const [file, setFile]         = useState(null);
  const [resumeId, setResumeId] = useState(null);
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [step, setStep]         = useState('upload'); // upload | results
  const [error, setError]       = useState('');

  const handleUploadAndSummarize = async () => {
    if (!file) return setError('Please select a resume file.');
    setLoading(true); setError('');
    try {
      // Step 1: Upload
      const uploadRes = await uploadResume(file, userId);
      const id = uploadRes.data.resumeId;
      setResumeId(id);
      // Step 2: Summarize
      const summaryRes = await generateSummary(id);
      setResult(summaryRes.data);
      setStep('results');
    } catch (e) {
      setError('Failed to process resume. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <Navbar />
      <div style={styles.orb} />

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.badge}>📄 RESUME SUMMARY GENERATOR</div>
          <h1 style={styles.title}>
            Generate AI <span style={styles.neon}>Summary</span>
          </h1>
          <p style={styles.subtitle}>
            Upload your resume and get an instant paragraph + bullet-point summary
          </p>
        </div>

        {error && <div style={styles.errorBox}>⚠️ {error}</div>}

        {/* Upload Card */}
        {step === 'upload' && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>📤 Upload Resume</h2>

            <div
              style={{ ...styles.dropZone, ...(file ? styles.dropZoneActive : {}) }}
              onClick={() => document.getElementById('sum-file').click()}
            >
              <input
                id="sum-file" type="file" accept=".pdf,.docx"
                style={{ display: 'none' }}
                onChange={(e) => { setFile(e.target.files[0]); setError(''); }}
              />
              {file ? (
                <>
                  <div style={{ fontSize: '3rem', marginBottom: '10px' }}>✅</div>
                  <div style={styles.fileName}>{file.name}</div>
                  <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                    {(file.size / 1024).toFixed(0)} KB
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '3.5rem', marginBottom: '14px' }}>📋</div>
                  <div style={styles.dropText}>Click to browse your resume</div>
                  <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                    PDF or DOCX, max 15 MB
                  </div>
                </>
              )}
            </div>

            <button
              style={styles.btn}
              onClick={handleUploadAndSummarize}
              disabled={loading || !file}
            >
              {loading ? '🧠 Generating Summary...' : '✨ Generate Summary'}
            </button>

            {loading && (
              <div style={styles.loadingBox}>
                <div style={styles.spinner} />
                <p style={styles.loadingText}>AI is reading your resume…</p>
              </div>
            )}
          </div>
        )}

        {/* Results Card */}
        {step === 'results' && result && (
          <div>
            <div style={styles.resultHeader}>
              <h2 style={styles.cardTitle}>📊 Summary Results</h2>
              <button
                style={styles.btnOutline}
                onClick={() => { setFile(null); setResult(null); setStep('upload'); }}
              >
                🔄 New Summary
              </button>
            </div>

            {/* Paragraph Summary */}
            <div style={styles.card}>
              <h3 style={{ ...styles.sectionTitle, color: '#00f5ff' }}>
                📝 Paragraph Summary
              </h3>
              <p style={styles.summaryText}>{result.summary || 'No summary available.'}</p>
            </div>

            {/* Bullet Points */}
            {result.feedbackPoints && (
              <div style={{ ...styles.card, marginTop: '20px' }}>
                <h3 style={{ ...styles.sectionTitle, color: '#a855f7' }}>
                  🎯 Key Highlights
                </h3>
                <ul style={styles.bulletList}>
                  {result.feedbackPoints.split('\n').filter(Boolean).map((pt, i) => (
                    <li key={i} style={styles.bulletItem}>
                      <span style={styles.bulletDot}>›</span>
                      <span style={{ color: '#94a3b8' }}>{pt.replace(/^[-•*]\s*/, '')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Skills Detected */}
            {result.keywordsMatched && (
              <div style={{ ...styles.card, marginTop: '20px' }}>
                <h3 style={{ ...styles.sectionTitle, color: '#10b981' }}>
                  💼 Skills Detected
                </h3>
                <div style={styles.tagRow}>
                  {result.keywordsMatched.split(',').filter(Boolean).map((k, i) => (
                    <span key={i} style={styles.skillTag}>{k.trim()}</span>
                  ))}
                </div>
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
    position: 'fixed', top: '15%', right: '5%',
    width: '450px', height: '450px',
    background: 'radial-gradient(circle, rgba(0,245,255,0.05) 0%, transparent 70%)',
    borderRadius: '50%', pointerEvents: 'none',
  },
  container: {
    position: 'relative', zIndex: 2,
    maxWidth: '800px', margin: '0 auto',
    padding: '120px 24px 60px',
  },
  header: { textAlign: 'center', marginBottom: '44px' },
  badge: {
    display: 'inline-block', padding: '6px 18px',
    background: 'rgba(0,245,255,0.08)',
    border: '1px solid rgba(0,245,255,0.2)',
    borderRadius: '20px', color: '#00f5ff',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.65rem', letterSpacing: '2px', marginBottom: '18px',
  },
  title: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '2rem', fontWeight: '900', marginBottom: '12px',
  },
  neon: { color: '#00f5ff', textShadow: '0 0 15px rgba(0,245,255,0.5)' },
  subtitle: { color: '#64748b', fontSize: '1rem' },
  errorBox: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '12px', padding: '14px 20px',
    color: '#ef4444', marginBottom: '24px',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(0,245,255,0.1)',
    borderRadius: '20px', padding: '36px',
    backdropFilter: 'blur(10px)',
  },
  cardTitle: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1.1rem', fontWeight: '700',
    color: 'white', marginBottom: '24px',
  },
  dropZone: {
    border: '2px dashed rgba(255,255,255,0.15)',
    borderRadius: '16px', padding: '60px 40px',
    textAlign: 'center', cursor: 'pointer',
    transition: 'all 0.3s', marginBottom: '24px',
  },
  dropZoneActive: {
    border: '2px dashed #00f5ff',
    background: 'rgba(0,245,255,0.04)',
  },
  fileName: {
    fontFamily: "'Share Tech Mono', monospace",
    color: '#00f5ff', fontSize: '1rem', marginBottom: '8px',
  },
  dropText: {
    fontSize: '1.1rem', color: '#94a3b8',
    marginBottom: '8px', fontWeight: '600',
  },
  btn: {
    width: '100%', padding: '15px',
    background: 'linear-gradient(135deg, #00f5ff, #3b82f6)',
    border: 'none', borderRadius: '12px',
    color: '#000', fontFamily: "'Orbitron', monospace",
    fontSize: '0.8rem', fontWeight: '700',
    cursor: 'pointer', letterSpacing: '2px',
  },
  loadingBox: { textAlign: 'center', padding: '30px', marginTop: '20px' },
  spinner: {
    width: '44px', height: '44px',
    border: '3px solid rgba(0,245,255,0.1)',
    borderTop: '3px solid #00f5ff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite', margin: '0 auto',
  },
  loadingText: {
    color: '#00f5ff', marginTop: '16px',
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
    fontSize: '0.65rem', cursor: 'pointer', letterSpacing: '1px',
  },
  sectionTitle: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.8rem', letterSpacing: '1px', marginBottom: '18px',
  },
  summaryText: {
    color: '#94a3b8', fontSize: '1rem',
    lineHeight: 1.9, fontStyle: 'italic',
  },
  bulletList: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexDirection: 'column', gap: '10px',
  },
  bulletItem: { display: 'flex', gap: '10px', alignItems: 'flex-start' },
  bulletDot: {
    color: '#a855f7', fontSize: '1.3rem',
    lineHeight: 1.3, fontWeight: '900', minWidth: '14px',
  },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  skillTag: {
    padding: '5px 14px',
    background: 'rgba(16,185,129,0.08)',
    border: '1px solid rgba(16,185,129,0.25)',
    borderRadius: '20px', color: '#10b981', fontSize: '0.82rem',
  },
};
