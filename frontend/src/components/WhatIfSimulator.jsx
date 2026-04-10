// src/components/WhatIfSimulator.jsx
//
// What-If Role Simulator + Multi-Role Comparison
// ────────────────────────────────────────────────
// Accepts resumeId — Spring Boot fetches the resume text from
// MySQL and proxies the request to Flask /compare-roles.
// No raw text needed on the frontend.
//
// Props:
//   resumeId  — Long ID of the uploaded resume (from Spring Boot)

import { useState, useCallback } from 'react';
import { compareRoles } from '../services/api';

// All 18 roles grouped by domain
const DOMAIN_ROLES = {
  '💻 Technology': [
    'Frontend Developer', 'Java Developer', 'Data Analyst',
    'ML Engineer', 'DevOps Engineer',
  ],
  '📣 Marketing': [
    'Digital Marketing Intern', 'SEO Executive', 'Content Strategist',
  ],
  '💼 Sales': [
    'Sales Executive', 'Business Development Associate',
  ],
  '👥 HR': [
    'HR Intern', 'Talent Acquisition Associate',
  ],
  '💰 Finance': [
    'Finance Intern', 'Accounts Executive',
  ],
  '🔧 Operations': [
    'Operations Executive', 'Supply Chain Intern',
  ],
  '✍️ Content': [
    'Content Writer', 'Copywriter',
  ],
};

const ALL_ROLES = Object.values(DOMAIN_ROLES).flat();

const ROLE_ICONS = {
  'Frontend Developer':           '🎨',
  'Java Developer':               '☕',
  'Data Analyst':                 '📊',
  'ML Engineer':                  '🤖',
  'DevOps Engineer':              '⚙️',
  'Digital Marketing Intern':     '📣',
  'SEO Executive':                '🔍',
  'Content Strategist':           '📋',
  'Sales Executive':              '💼',
  'Business Development Associate':'🤝',
  'HR Intern':                    '👥',
  'Talent Acquisition Associate': '🎯',
  'Finance Intern':               '💰',
  'Accounts Executive':           '🧾',
  'Operations Executive':         '🔧',
  'Supply Chain Intern':          '🚚',
  'Content Writer':               '✍️',
  'Copywriter':                   '📝',
};

const scoreColor = (s) =>
  s >= 75 ? '#10b981' : s >= 55 ? '#f59e0b' : s >= 35 ? '#f97316' : '#ef4444';
const scoreLabel = (s) =>
  s >= 75 ? 'Strong' : s >= 55 ? 'Good' : s >= 35 ? 'Fair' : 'Weak';

export default function WhatIfSimulator({ resumeId }) {
  const [selectedRoles, setSelectedRoles] = useState([
    'Frontend Developer', 'Java Developer', 'Data Analyst',
  ]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError]     = useState(null);

  const toggleRole = (role) =>
    setSelectedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : prev.length < 5 ? [...prev, role] : prev
    );

  const runComparison = useCallback(async () => {
    if (!resumeId || selectedRoles.length === 0) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await compareRoles(resumeId, selectedRoles);
      setResults(res.data);
    } catch (e) {
      setError(
        e.response?.data?.error ||
        e.message ||
        'Comparison failed — make sure both the backend and ML service are running.'
      );
    } finally {
      setLoading(false);
    }
  }, [resumeId, selectedRoles]);

  if (!resumeId) {
    return (
      <div style={s.emptyState}>
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎯</div>
        <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
          Upload and analyze a resume first to run the What-If role simulator.
        </p>
      </div>
    );
  }

  return (
    <div style={s.wrapper}>
      {/* ── Header ── */}
      <div style={s.header}>
        <h2 style={s.title}>🎯 What If I Apply For…</h2>
        <p style={s.subtitle}>
          See how your resume scores against different roles and discover your best fit instantly.
        </p>
      </div>

      {/* ── Role selector ── */}
      <div style={s.selectorCard}>
        <div style={s.selectorLabel}>SELECT ROLES TO COMPARE</div>
        {/* Domain-grouped role selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Object.entries(DOMAIN_ROLES).map(([domain, roles]) => (
            <div key={domain}>
              <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '0.55rem', color: '#475569', letterSpacing: '1px', marginBottom: '7px' }}>
                {domain}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {roles.map(role => {
                  const active = selectedRoles.includes(role);
                  return (
                    <button
                      key={role}
                      onClick={() => toggleRole(role)}
                      style={{
                        ...s.roleChip,
                        background: active ? 'rgba(0,245,255,0.1)' : 'rgba(255,255,255,0.03)',
                        border:     active ? '1px solid rgba(0,245,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                        color:      active ? '#00f5ff' : '#64748b',
                      }}
                    >
                      {ROLE_ICONS[role]} {role}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={runComparison}
          disabled={loading || selectedRoles.length === 0}
          style={{ ...s.runBtn, opacity: loading || selectedRoles.length === 0 ? 0.5 : 1 }}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={s.spinner} />
              Analyzing {selectedRoles.length} role{selectedRoles.length > 1 ? 's' : ''}…
            </span>
          ) : `⚡ Compare ${selectedRoles.length} Role${selectedRoles.length > 1 ? 's' : ''}`}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={s.errorBox}>⚠️ {error}</div>
      )}

      {/* ── Results ── */}
      {results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Best fit banner */}
          <div style={s.bestFitBanner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '2.2rem' }}>{ROLE_ICONS[results.bestFitRole] || '🏆'}</span>
              <div>
                <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '0.6rem', color: '#f59e0b', letterSpacing: '1.5px', marginBottom: '3px' }}>
                  BEST MATCH
                </div>
                <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '1.1rem', fontWeight: 900, color: 'white' }}>
                  {results.bestFitRole}
                </div>
                <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '0.8rem', color: '#10b981', marginTop: '2px' }}>
                  {results.bestFitScore}% ATS Score
                </div>
              </div>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.7, margin: 0 }}>
              {results.recommendation}
            </p>
          </div>

          {/* Ranked score bars */}
          <div style={s.compCard}>
            <div style={s.secLabel}>📊 ATS SCORE RANKING</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {results.results.map((r, i) => {
                const col    = scoreColor(r.atsScore);
                const maxS   = results.results[0]?.atsScore || 100;
                const barW   = Math.round((r.atsScore / Math.max(maxS, 1)) * 100);
                const isBest = r.role === results.bestFitRole;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.2rem', minWidth: '28px' }}>{ROLE_ICONS[r.role]}</span>
                    <span style={{
                      width: '160px', fontSize: '0.85rem',
                      color: isBest ? 'white' : '#94a3b8',
                      fontWeight: isBest ? 700 : 400,
                    }}>
                      {r.role}
                      {isBest && (
                        <span style={{ marginLeft: '6px', fontSize: '0.65rem', color: '#f59e0b' }}>★ Best</span>
                      )}
                    </span>
                    <div style={{ flex: 1, height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${barW}%`,
                        background: col, borderRadius: '5px',
                        transition: 'width 0.9s ease',
                        boxShadow: `0 0 8px ${col}40`,
                      }} />
                    </div>
                    <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '0.72rem', color: col, fontWeight: 700, width: '42px', textAlign: 'right' }}>
                      {r.atsScore}%
                    </span>
                    <span style={{ fontSize: '0.72rem', color: col, width: '46px' }}>
                      {scoreLabel(r.atsScore)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-role detail cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {results.results.map((r, i) => {
              const col    = scoreColor(r.atsScore);
              const isBest = r.role === results.bestFitRole;
              return (
                <div key={i} style={{
                  padding: '20px',
                  background: isBest ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isBest ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: '14px',
                }}>
                  {/* Role header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.3rem' }}>{ROLE_ICONS[r.role]}</span>
                      <span style={{ fontWeight: 700, color: 'white', fontSize: '0.9rem' }}>{r.role}</span>
                    </div>
                    <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '1rem', fontWeight: 900, color: col }}>
                      {r.atsScore}%
                    </span>
                  </div>

                  {/* 4 dimension mini-bars */}
                  {[
                    { label: 'Keywords',   val: r.keywordScore   || r.atsScore },
                    { label: 'Semantic',   val: r.semanticScore  || r.atsScore * 0.9 },
                    { label: 'Experience', val: r.experienceScore|| r.atsScore * 0.85 },
                    { label: 'Projects',   val: r.projectScore   || r.atsScore * 0.8 },
                  ].map((d, di) => (
                    <div key={di} style={{ marginBottom: '7px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{d.label}</span>
                        <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '0.62rem', color: scoreColor(d.val || 0) }}>
                          {Math.round(d.val || 0)}%
                        </span>
                      </div>
                      <div style={{ height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(100, d.val || 0)}%`,
                          background: scoreColor(d.val || 0),
                          borderRadius: '3px', transition: 'width 0.8s ease',
                        }} />
                      </div>
                    </div>
                  ))}

                  {/* Semantic fit */}
                  {r.semanticFit && (
                    <p style={{ color: '#64748b', fontSize: '0.78rem', lineHeight: 1.6, marginTop: '10px', marginBottom: '10px' }}>
                      {r.semanticFit}
                    </p>
                  )}

                  {/* High priority gaps */}
                  {r.missingSkills?.filter(m => m.importance === 'High').length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '0.55rem', color: '#ef4444', letterSpacing: '1px', marginBottom: '6px' }}>
                        HIGH PRIORITY GAPS
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {r.missingSkills.filter(m => m.importance === 'High').slice(0, 4).map((m, mi) => (
                          <span key={mi} style={{
                            padding: '2px 8px',
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: '10px', color: '#ef4444', fontSize: '0.72rem',
                          }}>
                            {m.skill || m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Role tip */}
                  {r.roleTip && (
                    <div style={{
                      marginTop: '12px', padding: '8px 10px',
                      background: 'rgba(0,245,255,0.04)',
                      border: '1px solid rgba(0,245,255,0.1)',
                      borderRadius: '8px', fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.6,
                    }}>
                      💡 {r.roleTip}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Full skill gap table for best-fit role */}
          {results.results[0]?.missingSkills?.length > 0 && (
            <div style={s.compCard}>
              <div style={s.secLabel}>🎯 SKILL GAPS — {results.bestFitRole}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {results.results[0].missingSkills.map((m, i) => {
                  const importance = typeof m === 'object' ? m.importance : 'Medium';
                  const skill      = typeof m === 'object' ? m.skill      : m;
                  const fixHint    = typeof m === 'object' ? m.fix_hint   : '';
                  const impCol     = importance === 'High' ? '#ef4444' : importance === 'Medium' ? '#f59e0b' : '#64748b';
                  return (
                    <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '10px',
                        background: `${impCol}12`, border: `1px solid ${impCol}30`,
                        color: impCol, fontSize: '0.65rem',
                        fontFamily: "'Orbitron', monospace", fontWeight: 700,
                        flexShrink: 0, marginTop: '2px',
                      }}>
                        {importance}
                      </span>
                      <div>
                        <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.85rem' }}>{skill}</span>
                        {fixHint && (
                          <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '3px 0 0', lineHeight: 1.6 }}>
                            {fixHint}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  wrapper:  { display: 'flex', flexDirection: 'column', gap: '20px' },
  header:   { marginBottom: '4px' },
  title: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1.1rem', fontWeight: 900, color: 'white', marginBottom: '6px',
  },
  subtitle: { color: '#64748b', fontSize: '0.9rem', margin: 0 },

  selectorCard: {
    padding: '22px 24px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
    display: 'flex', flexDirection: 'column', gap: '14px',
  },
  selectorLabel: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.6rem', color: '#64748b', letterSpacing: '1.5px',
  },
  roleChip: {
    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
    fontFamily: "'Rajdhani', sans-serif", fontSize: '0.88rem', fontWeight: 600,
    transition: 'all 0.2s',
  },
  runBtn: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #00f5ff, #3b82f6)',
    border: 'none', borderRadius: '10px',
    color: '#000', fontFamily: "'Orbitron', monospace",
    fontSize: '0.72rem', fontWeight: 700,
    cursor: 'pointer', letterSpacing: '1px',
    alignSelf: 'flex-start',
  },
  spinner: {
    width: '14px', height: '14px',
    border: '2px solid rgba(0,0,0,0.2)',
    borderTop: '2px solid #000',
    borderRadius: '50%', display: 'inline-block',
    animation: 'spin 0.8s linear infinite',
  },
  errorBox: {
    padding: '14px 18px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: '10px', color: '#ef4444', fontSize: '0.88rem',
  },
  bestFitBanner: {
    padding: '22px 24px',
    background: 'rgba(245,158,11,0.06)',
    border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: '16px',
    display: 'flex', flexDirection: 'column', gap: '14px',
  },
  compCard: {
    padding: '22px 24px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
  },
  secLabel: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.6rem', color: '#64748b',
    letterSpacing: '1.5px', marginBottom: '16px',
  },
  emptyState: {
    padding: '40px', textAlign: 'center',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px',
  },
};
