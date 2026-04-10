// src/components/RecruiterAnalytics.jsx
//
// Self-contained analytics dashboard for the Interviewer Portal.
// Drop this into the "analytics" tab of InterviewerPortal.jsx.
//
// Usage:
//   import RecruiterAnalytics from '../components/RecruiterAnalytics';
//   <RecruiterAnalytics candidates={candidates} />

import { RecruiterCharts } from './ATSCharts';

export default function RecruiterAnalytics({ candidates }) {
  if (!candidates || candidates.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📊</div>
        <p style={{ color: '#94a3b8' }}>No candidates to analyze yet.</p>
        <p style={{ color: '#475569', fontSize: '0.85rem', marginTop: '6px' }}>
          Upload and analyze resumes first to see recruiter analytics.
        </p>
      </div>
    );
  }

  const total    = candidates.length;
  const accepted = candidates.filter(c => c.decision === 'ACCEPTED').length;
  const rejected = candidates.filter(c => c.decision === 'REJECTED').length;
  const avgScore = Math.round(candidates.reduce((a, c) => a + (c.matchScore || 0), 0) / total);
  const strong   = candidates.filter(c => (c.matchScore || 0) >= 70).length;

  // Build skill frequency map for all candidates
  const skillFreq = {};
  candidates.forEach(c => {
    (c.keywordsMatched || '').split(',').forEach(kw => {
      const k = kw.trim().toLowerCase();
      if (k.length > 1) skillFreq[k] = (skillFreq[k] || 0) + 1;
    });
  });

  // Score distribution bands
  const bands = [
    { range: '80–100%', color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)', count: candidates.filter(c => (c.matchScore||0) >= 80).length,  label: 'Excellent' },
    { range: '60–79%',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)',  count: candidates.filter(c => (c.matchScore||0) >= 60 && (c.matchScore||0) < 80).length, label: 'Good' },
    { range: '40–59%',  color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.25)',  count: candidates.filter(c => (c.matchScore||0) >= 40 && (c.matchScore||0) < 60).length, label: 'Fair' },
    { range: '0–39%',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)',   count: candidates.filter(c => (c.matchScore||0) < 40).length,  label: 'Low' },
  ];

  return (
    <div style={styles.wrapper}>

      {/* ── Summary KPI Strip ── */}
      <div style={styles.kpiRow}>
        {[
          { icon: '👥', label: 'Total Analyzed',  value: total,    color: 'white'    },
          { icon: '📊', label: 'Average Score',   value: `${avgScore}%`, color: '#00f5ff' },
          { icon: '⚡', label: 'Strong Matches',  value: strong,   color: '#10b981'  },
          { icon: '✅', label: 'Accepted',        value: accepted, color: '#10b981'  },
          { icon: '❌', label: 'Rejected',        value: rejected, color: '#ef4444'  },
        ].map((kpi, i) => (
          <div key={i} style={styles.kpiCard}>
            <span style={{ fontSize: '1.4rem' }}>{kpi.icon}</span>
            <div style={{ ...styles.kpiValue, color: kpi.color }}>{kpi.value}</div>
            <div style={styles.kpiLabel}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* ── Score Distribution Bands ── */}
      <div style={styles.sectionCard}>
        <div style={styles.sectionTitle}>📈 Score Distribution</div>
        <div style={styles.bandsGrid}>
          {bands.map((b, i) => (
            <div key={i} style={{ ...styles.bandCard, background: b.bg, border: `1px solid ${b.border}` }}>
              <div style={{ ...styles.bandCount, color: b.color }}>{b.count}</div>
              <div style={styles.bandLabel}>{b.label}</div>
              <div style={{ color: '#475569', fontSize: '0.72rem', marginTop: '4px' }}>{b.range}</div>
              {/* Mini bar */}
              <div style={styles.bandBarTrack}>
                <div style={{
                  height: '100%',
                  width: total > 0 ? `${(b.count / total) * 100}%` : '0%',
                  background: b.color, borderRadius: '3px',
                  transition: 'width 0.8s ease',
                }} />
              </div>
              <div style={{ color: b.color, fontSize: '0.7rem', marginTop: '4px', fontFamily: "'Orbitron', monospace" }}>
                {total > 0 ? Math.round((b.count / total) * 100) : 0}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Full RecruiterCharts (SVG-based) ── */}
      <RecruiterCharts candidates={candidates} />

      {/* ── Ranked Shortlist Table ── */}
      <div style={styles.sectionCard}>
        <div style={styles.sectionTitle}>🏆 Ranked Candidate Shortlist</div>
        <div style={styles.tableHeader}>
          <span style={styles.th}>#</span>
          <span style={{ ...styles.th, flex: 3 }}>Resume</span>
          <span style={styles.th}>Score</span>
          <span style={styles.th}>Skills</span>
          <span style={styles.th}>Status</span>
        </div>
        {[...candidates]
          .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
          .slice(0, 10)
          .map((c, i) => {
            const sc = Math.round(c.matchScore || 0);
            const color = sc >= 80 ? '#10b981' : sc >= 60 ? '#f59e0b' : sc >= 40 ? '#f97316' : '#ef4444';
            const isAccepted = c.decision === 'ACCEPTED';
            const isRejected = c.decision === 'REJECTED';
            return (
              <div key={i} style={{
                ...styles.tableRow,
                background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
              }}>
                <span style={{ ...styles.td, color: '#475569', fontFamily: "'Orbitron', monospace", fontSize: '0.65rem' }}>
                  {i + 1}
                </span>
                <span style={{ ...styles.td, flex: 3, color: '#94a3b8', fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  📄 {c.fileName}
                </span>
                <span style={{ ...styles.td, color, fontFamily: "'Orbitron', monospace", fontSize: '0.78rem', fontWeight: 700 }}>
                  {sc}%
                </span>
                <span style={{ ...styles.td, color: '#64748b', fontSize: '0.75rem' }}>
                  {(c.keywordsMatched || '').split(',').slice(0, 2).map(s => s.trim()).filter(Boolean).join(', ') || '—'}
                </span>
                <span style={styles.td}>
                  {isAccepted && <span style={styles.badgeGreen}>✓ Accepted</span>}
                  {isRejected && <span style={styles.badgeRed}>✗ Rejected</span>}
                  {!isAccepted && !isRejected && <span style={styles.badgeGray}>Pending</span>}
                </span>
              </div>
            );
          })}
      </div>

    </div>
  );
}

const styles = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: '24px' },
  empty: {
    padding: '60px', textAlign: 'center',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '16px',
  },

  // KPI strip
  kpiRow: { display: 'flex', gap: '14px', flexWrap: 'wrap' },
  kpiCard: {
    flex: 1, minWidth: '100px', padding: '18px 14px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '14px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  kpiValue: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1.5rem', fontWeight: '900',
  },
  kpiLabel: { color: '#64748b', fontSize: '0.75rem' },

  // Score bands
  sectionCard: {
    padding: '28px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
  },
  sectionTitle: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.72rem', color: '#94a3b8',
    letterSpacing: '1px', marginBottom: '20px',
  },
  bandsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' },
  bandCard: {
    padding: '18px 14px', borderRadius: '12px',
    textAlign: 'center', display: 'flex',
    flexDirection: 'column', alignItems: 'center', gap: '2px',
  },
  bandCount: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1.8rem', fontWeight: '900',
  },
  bandLabel: { color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 },
  bandBarTrack: {
    width: '100%', height: '6px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '3px', marginTop: '10px', overflow: 'hidden',
  },

  // Ranked table
  tableHeader: {
    display: 'flex', gap: '12px', padding: '8px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '6px',
  },
  tableRow: {
    display: 'flex', gap: '12px',
    padding: '10px 12px', borderRadius: '8px',
    alignItems: 'center',
  },
  th: {
    flex: 1, fontFamily: "'Orbitron', monospace",
    fontSize: '0.58rem', color: '#475569',
    letterSpacing: '1px', textTransform: 'uppercase',
  },
  td: { flex: 1 },
  badgeGreen: {
    padding: '3px 8px', borderRadius: '20px',
    background: 'rgba(16,185,129,0.1)',
    border: '1px solid rgba(16,185,129,0.25)',
    color: '#10b981', fontSize: '0.7rem',
    fontFamily: "'Orbitron', monospace",
  },
  badgeRed: {
    padding: '3px 8px', borderRadius: '20px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.25)',
    color: '#ef4444', fontSize: '0.7rem',
    fontFamily: "'Orbitron', monospace",
  },
  badgeGray: {
    padding: '3px 8px', borderRadius: '20px',
    background: 'rgba(100,116,139,0.1)',
    border: '1px solid rgba(100,116,139,0.2)',
    color: '#64748b', fontSize: '0.7rem',
    fontFamily: "'Orbitron', monospace",
  },
};
