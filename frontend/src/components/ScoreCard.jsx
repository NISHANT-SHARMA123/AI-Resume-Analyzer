// src/components/ScoreCard.jsx
// Updated to include an "ATS Charts" tab alongside the existing analysis view.
import { useState } from 'react';
import { ATSCharts } from './ATSCharts';

export default function ScoreCard({ result }) {
  const [activeView, setActiveView] = useState('analysis'); // 'analysis' | 'charts'

  const score    = Math.round(result?.matchScore || 0);
  const keywords = result?.keywordsMatched?.split(',').filter(Boolean) || [];
  const missing  = result?.missingKeywords?.split(',').filter(Boolean) || [];
  const feedback = result?.feedbackPoints?.split('\n').filter(Boolean) || [];
  const suggestions = result?.improvementSuggestions?.split('\n').filter(Boolean) || [];

  const getScoreColor = (s) => {
    if (s >= 80) return '#10b981';
    if (s >= 60) return '#f59e0b';
    if (s >= 40) return '#f97316';
    return '#ef4444';
  };
  const color = getScoreColor(score);

  const getScoreLabel = (s) => {
    if (s >= 80) return 'Excellent Match';
    if (s >= 60) return 'Good Match';
    if (s >= 40) return 'Fair Match';
    return 'Needs Work';
  };

  return (
    <div style={styles.wrapper}>

      {/* ── View Toggle ── */}
      <div style={styles.viewToggle}>
        <button
          style={{ ...styles.toggleBtn, ...(activeView === 'analysis' ? styles.toggleActive : {}) }}
          onClick={() => setActiveView('analysis')}>
          📋 Analysis
        </button>
        <button
          style={{ ...styles.toggleBtn, ...(activeView === 'charts' ? styles.toggleActive : {}) }}
          onClick={() => setActiveView('charts')}>
          📊 ATS Charts
        </button>
      </div>

      {/* ── Score Hero (always visible) ── */}
      <div style={styles.scoreHero}>
        <div style={{ ...styles.scoreRing, borderColor: color, boxShadow: `0 0 40px ${color}40` }}>
          <div style={{ ...styles.scoreNum, color }}>{score}%</div>
          <div style={{ ...styles.scoreLabel, color }}>{getScoreLabel(score)}</div>
        </div>
        <div style={styles.scoreMeta}>
          <h3 style={styles.metaTitle}>ATS Match Score</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.7 }}>
            Your resume matches <strong style={{ color }}>{score}%</strong> of the job requirements.
            {score >= 70
              ? ' Great job — you are a strong candidate!'
              : ' Consider adding more relevant keywords and skills.'}
          </p>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${score}%`, background: color }} />
          </div>
        </div>
      </div>

      {/* ── ANALYSIS VIEW ── */}
      {activeView === 'analysis' && (
        <div style={styles.grid}>
          {/* Keywords Matched */}
          <div style={styles.card}>
            <h4 style={{ ...styles.cardTitle, color: '#10b981' }}>✅ Keywords Matched</h4>
            <div style={styles.tagRow}>
              {keywords.length > 0
                ? keywords.map((k, i) => (
                    <span key={i} style={{ ...styles.tag, borderColor: '#10b98140', color: '#10b981' }}>
                      {k.trim()}
                    </span>
                  ))
                : <p style={styles.empty}>No matched keywords found</p>
              }
            </div>
          </div>

          {/* Missing Keywords */}
          <div style={styles.card}>
            <h4 style={{ ...styles.cardTitle, color: '#ef4444' }}>❌ Missing Keywords</h4>
            <div style={styles.tagRow}>
              {missing.length > 0
                ? missing.map((k, i) => (
                    <span key={i} style={{ ...styles.tag, borderColor: '#ef444440', color: '#ef4444' }}>
                      {k.trim()}
                    </span>
                  ))
                : <p style={styles.empty}>No missing keywords found!</p>
              }
            </div>
          </div>

          {/* AI Feedback */}
          <div style={{ ...styles.card, gridColumn: '1 / -1' }}>
            <h4 style={{ ...styles.cardTitle, color: '#00f5ff' }}>🤖 AI Feedback</h4>
            <ul style={styles.feedbackList}>
              {feedback.length > 0
                ? feedback.map((f, i) => (
                    <li key={i} style={styles.feedbackItem}>
                      <span style={styles.bullet}>›</span>
                      <span style={{ color: '#94a3b8' }}>{f.replace(/^[-•*]\s*/, '')}</span>
                    </li>
                  ))
                : <p style={styles.empty}>No feedback available</p>
              }
            </ul>
          </div>

          {/* Improvement Suggestions */}
          <div style={{ ...styles.card, gridColumn: '1 / -1' }}>
            <h4 style={{ ...styles.cardTitle, color: '#a855f7' }}>💡 Improvement Suggestions</h4>
            <ul style={styles.feedbackList}>
              {suggestions.length > 0
                ? suggestions.map((s, i) => (
                    <li key={i} style={styles.feedbackItem}>
                      <span style={{ ...styles.bullet, color: '#a855f7' }}>›</span>
                      <span style={{ color: '#94a3b8' }}>{s.replace(/^[-•*\d.]\s*/, '')}</span>
                    </li>
                  ))
                : <p style={styles.empty}>No suggestions available</p>
              }
            </ul>
          </div>

          {/* Resume Summary */}
          {result?.summary && (
            <div style={{ ...styles.card, gridColumn: '1 / -1' }}>
              <h4 style={{ ...styles.cardTitle, color: '#f59e0b' }}>📄 Resume Summary</h4>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.8 }}>
                {result.summary}
              </p>
            </div>
          )}

          {/* ── FEATURE 5: Semantic Fit Explanation ── */}
          {result?.semanticFitExplanation && (
            <div style={{ ...styles.card, gridColumn: '1 / -1',
              background: 'rgba(0,245,255,0.03)',
              border: '1px solid rgba(0,245,255,0.12)',
            }}>
              <h4 style={{ ...styles.cardTitle, color: '#00f5ff' }}>
                🧠 Semantic Fit
                {result.semanticScore != null && (
                  <span style={{
                    marginLeft: '12px', padding: '2px 10px',
                    background: 'rgba(0,245,255,0.1)',
                    border: '1px solid rgba(0,245,255,0.25)',
                    borderRadius: '12px', fontSize: '0.7rem',
                    fontFamily: "'Orbitron', monospace",
                    color: '#00f5ff',
                  }}>
                    {Math.round(result.semanticScore)}% match
                  </span>
                )}
                {result.confidenceIndicators?.semantic && (
                  <span style={{
                    marginLeft: '8px', padding: '2px 8px',
                    background: result.confidenceIndicators.semantic === 'high'
                      ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                    border: `1px solid ${result.confidenceIndicators.semantic === 'high'
                      ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    borderRadius: '10px', fontSize: '0.62rem',
                    color: result.confidenceIndicators.semantic === 'high' ? '#10b981' : '#f59e0b',
                  }}>
                    {result.confidenceIndicators.semantic} confidence
                  </span>
                )}
              </h4>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.8, margin: 0 }}>
                {result.semanticFitExplanation}
              </p>
            </div>
          )}

          {/* ── FEATURE 2 + 3: Weak Phrases & Before/After Rewrites ── */}
          {result?.bulletRewrites?.length > 0 && (
            <div style={{ ...styles.card, gridColumn: '1 / -1' }}>
              <h4 style={{ ...styles.cardTitle, color: '#a855f7' }}>
                ✍️ Bullet Point Improvements
                <span style={{
                  marginLeft: '10px', padding: '2px 8px',
                  background: 'rgba(168,85,247,0.1)',
                  border: '1px solid rgba(168,85,247,0.25)',
                  borderRadius: '10px', fontSize: '0.65rem',
                }}>
                  {result.bulletRewrites.length} rewrite{result.bulletRewrites.length > 1 ? 's' : ''}
                </span>
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {result.bulletRewrites.map((rw, i) => (
                  <div key={i} style={{
                    borderRadius: '10px', overflow: 'hidden',
                    border: '1px solid rgba(168,85,247,0.15)',
                  }}>
                    {/* Before */}
                    <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid rgba(168,85,247,0.1)' }}>
                      <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '0.55rem', color: '#ef4444', letterSpacing: '1px' }}>BEFORE</span>
                      <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '5px 0 0', lineHeight: 1.6 }}>{rw.before}</p>
                    </div>
                    {/* After */}
                    <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.05)' }}>
                      <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '0.55rem', color: '#10b981', letterSpacing: '1px' }}>AFTER</span>
                      <p style={{ color: '#e2e8f0', fontSize: '0.88rem', margin: '5px 0 0', lineHeight: 1.6, fontWeight: 600 }}>{rw.after}</p>
                      <span style={{ fontSize: '0.75rem', color: '#a855f7', marginTop: '4px', display: 'block' }}>💡 {rw.improvement_type}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── FEATURE 4: Confidence Indicators ── */}
          {result?.confidenceIndicators && (
            <div style={{ ...styles.card, gridColumn: '1 / -1',
              background: 'rgba(255,255,255,0.01)',
            }}>
              <h4 style={{ ...styles.cardTitle, color: '#64748b' }}>📊 Score Confidence</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                {Object.entries({
                  'Overall':    result.confidenceIndicators.overall,
                  'Keywords':   result.confidenceIndicators.keyword,
                  'Experience': result.confidenceIndicators.experience,
                  'Projects':   result.confidenceIndicators.project,
                  'Quality':    result.confidenceIndicators.quality,
                  'Semantic':   result.confidenceIndicators.semantic,
                }).map(([label, level]) => {
                  const col = level === 'high' ? '#10b981' : level === 'medium' ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={label} style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '5px 12px',
                      background: `${col}0f`,
                      border: `1px solid ${col}30`,
                      borderRadius: '20px',
                    }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: col }} />
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{label}</span>
                      <span style={{ fontSize: '0.72rem', color: col, fontFamily: "'Orbitron', monospace", fontWeight: 700 }}>{level}</span>
                    </div>
                  );
                })}
              </div>
              {result.confidenceIndicators.note && (
                <p style={{ color: '#475569', fontSize: '0.8rem', marginTop: '12px', marginBottom: 0 }}>
                  {result.confidenceIndicators.note}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TOP 3 IMPROVEMENTS ── */}
      {activeView === 'analysis' && result?.top3Improvements?.length > 0 && (
        <div style={{
          padding: '24px 28px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(16,185,129,0.15)',
          borderRadius: '16px',
        }}>
          <h4 style={{ ...styles.cardTitle, color: '#10b981', marginBottom: '18px' }}>
            🚀 Top {result.top3Improvements.length} Improvements to Boost Your Score
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {result.top3Improvements.map((imp, i) => (
              <div key={i} style={{
                padding: '16px 18px',
                background: 'rgba(16,185,129,0.04)',
                border: '1px solid rgba(16,185,129,0.12)',
                borderRadius: '12px',
                display: 'flex', gap: '16px', alignItems: 'flex-start',
              }}>
                {/* Rank + icon */}
                <div style={{ textAlign: 'center', minWidth: '36px' }}>
                  <div style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: '0.6rem', color: '#10b981',
                    marginBottom: '4px',
                  }}>#{i + 1}</div>
                  <span style={{ fontSize: '1.3rem' }}>{imp.icon}</span>
                </div>
                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.92rem' }}>{imp.title}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '2px 8px',
                        background: 'rgba(16,185,129,0.12)',
                        border: '1px solid rgba(16,185,129,0.3)',
                        borderRadius: '10px',
                        fontFamily: "'Orbitron', monospace",
                        fontSize: '0.6rem', color: '#10b981', fontWeight: 700,
                      }}>+{imp.estimated_gain}%</span>
                      {imp.potential_score && (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          → {imp.potential_score}% potential
                        </span>
                      )}
                    </div>
                  </div>
                  <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '8px', lineHeight: 1.6 }}>
                    {imp.description}
                  </p>
                  <div style={{
                    padding: '8px 12px',
                    background: 'rgba(0,245,255,0.04)',
                    border: '1px solid rgba(0,245,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6,
                  }}>
                    💡 <strong style={{ color: '#00f5ff' }}>Action: </strong>{imp.action}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CHARTS VIEW ── */}
      {activeView === 'charts' && (
        <ATSCharts result={result} />
      )}

    </div>
  );
}

const styles = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: '20px' },

  // View toggle
  viewToggle: {
    display: 'flex', gap: '4px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px', padding: '4px',
    alignSelf: 'flex-start',
  },
  toggleBtn: {
    padding: '9px 20px',
    background: 'transparent', border: 'none',
    borderRadius: '9px', color: '#64748b',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.65rem', letterSpacing: '1px',
    cursor: 'pointer', transition: 'all 0.2s',
  },
  toggleActive: {
    background: 'rgba(0,245,255,0.1)', color: '#00f5ff',
    boxShadow: 'inset 0 0 0 1px rgba(0,245,255,0.2)',
  },

  scoreHero: {
    display: 'flex', gap: '36px', alignItems: 'center',
    padding: '28px', background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px',
  },
  scoreRing: {
    width: '130px', height: '130px', minWidth: '130px',
    borderRadius: '50%', border: '4px solid',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.5s',
  },
  scoreNum: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1.8rem', fontWeight: '900',
  },
  scoreLabel: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.5rem', letterSpacing: '1px', marginTop: '4px',
  },
  scoreMeta: { flex: 1 },
  metaTitle: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.85rem', color: 'white', marginBottom: '10px',
  },
  progressBar: {
    height: '6px', background: 'rgba(255,255,255,0.06)',
    borderRadius: '3px', marginTop: '16px', overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: '3px', transition: 'width 1s ease' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  card: {
    padding: '24px', background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px',
  },
  cardTitle: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.75rem', letterSpacing: '1px', marginBottom: '16px',
  },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  tag: {
    padding: '4px 12px', background: 'rgba(255,255,255,0.04)',
    border: '1px solid', borderRadius: '20px', fontSize: '0.8rem',
  },
  feedbackList: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'flex', flexDirection: 'column', gap: '10px',
  },
  feedbackItem: { display: 'flex', gap: '10px', alignItems: 'flex-start' },
  bullet: {
    color: '#00f5ff', fontSize: '1.2rem',
    lineHeight: 1.4, fontWeight: '700', minWidth: '12px',
  },
  empty: { color: '#475569', fontSize: '0.9rem', fontStyle: 'italic' },
};
