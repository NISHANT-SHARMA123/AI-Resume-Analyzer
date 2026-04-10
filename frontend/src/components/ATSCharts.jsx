// src/components/ATSCharts.jsx
//
// Reusable ATS visual analytics built with pure SVG + CSS.
// No external chart library needed — works with the existing
// project setup and matches the dark neon aesthetic.
//
// EXPORTS:
//   ATSCharts        — full chart dashboard for candidate portal
//   RecruiterCharts  — analytics dashboard for interviewer portal

// ─────────────────────────────────────────────────────────
//  CANDIDATE ATS CHARTS
//  Props: result (from analyzeResume API response)
//    result.matchScore         number  0-100
//    result.keywordsMatched    string  comma-separated
//    result.missingKeywords    string  comma-separated
//    result.feedbackPoints     string  newline-separated
// ─────────────────────────────────────────────────────────
export function ATSCharts({ result }) {
  if (!result) return null;

  const score    = Math.round(result.matchScore || 0);
  const matched  = (result.keywordsMatched || '').split(',').map(s => s.trim()).filter(Boolean);
  const missing  = (result.missingKeywords  || '').split(',').map(s => s.trim()).filter(Boolean);
  const total    = matched.length + missing.length || 1;
  const coverage = Math.round((matched.length / total) * 100);

  const scoreColor = score >= 80 ? '#10b981'
                   : score >= 60 ? '#f59e0b'
                   : score >= 40 ? '#f97316'
                   : '#ef4444';

  return (
    <div style={styles.chartsGrid}>

      {/* ── 1. ATS Score Gauge ── */}
      <div style={styles.chartCard}>
        <div style={styles.chartLabel}>📊 ATS Score Gauge</div>
        <ScoreGauge score={score} color={scoreColor} />
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '0.7rem', color: scoreColor }}>
            {score >= 80 ? 'EXCELLENT' : score >= 60 ? 'GOOD' : score >= 40 ? 'FAIR' : 'NEEDS WORK'}
          </span>
        </div>
      </div>

      {/* ── 2. Keyword Coverage Pie ── */}
      <div style={styles.chartCard}>
        <div style={styles.chartLabel}>🎯 Keyword Coverage</div>
        <CoveragePie matched={matched.length} missing={missing.length} />
        <div style={styles.legendRow}>
          <LegendDot color="#10b981" label={`Matched (${matched.length})`} />
          <LegendDot color="#ef4444" label={`Missing (${missing.length})`} />
        </div>
      </div>

      {/* ── 3. Skill Match Bar Chart ── */}
      <div style={{ ...styles.chartCard, gridColumn: '1 / -1' }}>
        <div style={styles.chartLabel}>⚡ Skill Match Breakdown</div>
        <SkillBars matched={matched} missing={missing} />
      </div>

      {/* ── 4. ATS Compatibility Breakdown ── */}
      <div style={{ ...styles.chartCard, gridColumn: '1 / -1' }}>
        <div style={styles.chartLabel}>📈 ATS Compatibility Analysis</div>
        <CompatibilityBars score={score} coverage={coverage} />
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  RECRUITER CHARTS
//  Props: candidates (array from bulkUpload API)
//    each candidate: { fileName, matchScore, keywordsMatched, decision }
// ─────────────────────────────────────────────────────────
export function RecruiterCharts({ candidates }) {
  if (!candidates || candidates.length === 0) return null;

  // Score distribution buckets
  const buckets = [
    { label: '80–100', color: '#10b981', count: candidates.filter(c => c.matchScore >= 80).length },
    { label: '60–79',  color: '#f59e0b', count: candidates.filter(c => c.matchScore >= 60 && c.matchScore < 80).length },
    { label: '40–59',  color: '#f97316', count: candidates.filter(c => c.matchScore >= 40 && c.matchScore < 60).length },
    { label: '0–39',   color: '#ef4444', count: candidates.filter(c => c.matchScore < 40).length },
  ];

  // Top skills across all candidates
  const skillFreq = {};
  candidates.forEach(c => {
    (c.keywordsMatched || '').split(',').forEach(kw => {
      const k = kw.trim().toLowerCase();
      if (k) skillFreq[k] = (skillFreq[k] || 0) + 1;
    });
  });
  const topSkills = Object.entries(skillFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([skill, count]) => ({ skill, count, pct: Math.round((count / candidates.length) * 100) }));

  // Decision distribution
  const accepted = candidates.filter(c => c.decision === 'ACCEPTED').length;
  const rejected = candidates.filter(c => c.decision === 'REJECTED').length;
  const pending  = candidates.filter(c => !c.decision || c.decision === 'PENDING').length;

  return (
    <div style={styles.chartsGrid}>

      {/* ── 1. Score Distribution ── */}
      <div style={styles.chartCard}>
        <div style={styles.chartLabel}>📊 Score Distribution</div>
        <ScoreDistributionChart buckets={buckets} total={candidates.length} />
      </div>

      {/* ── 2. Decision Status Pie ── */}
      <div style={styles.chartCard}>
        <div style={styles.chartLabel}>✅ Candidate Status</div>
        <DecisionPie accepted={accepted} rejected={rejected} pending={pending} />
        <div style={styles.legendRow}>
          <LegendDot color="#10b981" label={`Accepted (${accepted})`} />
          <LegendDot color="#ef4444" label={`Rejected (${rejected})`} />
          <LegendDot color="#64748b" label={`Pending (${pending})`} />
        </div>
      </div>

      {/* ── 3. Top Skills Across Applicants ── */}
      <div style={{ ...styles.chartCard, gridColumn: '1 / -1' }}>
        <div style={styles.chartLabel}>🔑 Top Skills Across All Applicants</div>
        <TopSkillsBars skills={topSkills} />
      </div>

      {/* ── 4. Candidate Score Comparison ── */}
      <div style={{ ...styles.chartCard, gridColumn: '1 / -1' }}>
        <div style={styles.chartLabel}>🏆 Candidate Score Comparison</div>
        <CandidateComparisonBars candidates={candidates} />
      </div>

    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  CHART PRIMITIVES
// ═══════════════════════════════════════════════════════════

// ── Animated SVG gauge ──────────────────────────────────────
function ScoreGauge({ score, color }) {
  const R = 64;
  const cx = 80, cy = 80;
  const circumference = Math.PI * R;               // half-circle arc length
  const filled = (score / 100) * circumference;
  const gap    = circumference - filled;

  return (
    <svg viewBox="0 0 160 100" style={{ width: '100%', maxWidth: '180px', display: 'block', margin: '0 auto' }}>
      {/* Track */}
      <path
        d={`M ${cx - R},${cy} A ${R},${R} 0 0 1 ${cx + R},${cy}`}
        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={`M ${cx - R},${cy} A ${R},${R} 0 0 1 ${cx + R},${cy}`}
        fill="none" stroke={color} strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${gap}`}
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      {/* Score text */}
      <text x={cx} y={cy - 8} textAnchor="middle"
        style={{ fontFamily: "'Orbitron', monospace", fontSize: '22px', fontWeight: 900, fill: color }}>
        {score}%
      </text>
    </svg>
  );
}

// ── Keyword coverage donut ───────────────────────────────────
function CoveragePie({ matched, missing }) {
  const total = matched + missing || 1;
  const matchedPct = matched / total;
  const r = 48, cx = 70, cy = 70;
  const circ = 2 * Math.PI * r;
  const filledArc = matchedPct * circ;

  return (
    <svg viewBox="0 0 140 140" style={{ width: '100%', maxWidth: '160px', display: 'block', margin: '0 auto' }}>
      {/* Background ring */}
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="rgba(239,68,68,0.3)" strokeWidth="16" />
      {/* Matched arc */}
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="#10b981" strokeWidth="16"
        strokeDasharray={`${filledArc} ${circ}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      {/* Center label */}
      <text x={cx} y={cy - 6} textAnchor="middle"
        style={{ fontFamily: "'Orbitron', monospace", fontSize: '18px', fontWeight: 900, fill: '#10b981' }}>
        {Math.round(matchedPct * 100)}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle"
        style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '11px', fill: '#64748b' }}>
        covered
      </text>
    </svg>
  );
}

// ── Decision donut for recruiter ────────────────────────────
function DecisionPie({ accepted, rejected, pending }) {
  const total = accepted + rejected + pending || 1;
  const r = 48, cx = 70, cy = 70;
  const circ = 2 * Math.PI * r;

  const acceptedArc = (accepted / total) * circ;
  const rejectedArc = (rejected / total) * circ;
  const pendingArc  = (pending  / total) * circ;

  const acceptOffset = circ * 0.25;
  const rejectOffset = acceptOffset - acceptedArc;
  const pendingOffset = rejectOffset - rejectedArc;

  return (
    <svg viewBox="0 0 140 140" style={{ width: '100%', maxWidth: '160px', display: 'block', margin: '0 auto' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth="16" />
      {/* Pending (gray) */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#64748b" strokeWidth="16"
        strokeDasharray={`${pendingArc} ${circ}`}
        strokeDashoffset={pendingOffset} />
      {/* Rejected (red) */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ef4444" strokeWidth="16"
        strokeDasharray={`${rejectedArc} ${circ}`}
        strokeDashoffset={rejectOffset} />
      {/* Accepted (green) */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#10b981" strokeWidth="16"
        strokeDasharray={`${acceptedArc} ${circ}`}
        strokeDashoffset={acceptOffset} />
      <text x={cx} y={cy - 6} textAnchor="middle"
        style={{ fontFamily: "'Orbitron', monospace", fontSize: '18px', fontWeight: 900, fill: 'white' }}>
        {total}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle"
        style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '11px', fill: '#64748b' }}>
        total
      </text>
    </svg>
  );
}

// ── Skill match bars ─────────────────────────────────────────
function SkillBars({ matched, missing }) {
  const allSkills = [
    ...matched.slice(0, 6).map(s => ({ name: s, matched: true })),
    ...missing.slice(0, 4).map(s => ({ name: s, matched: false })),
  ];

  if (allSkills.length === 0) {
    return <p style={{ color: '#475569', fontSize: '0.88rem', textAlign: 'center', padding: '20px 0' }}>No keyword data available</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
      {allSkills.map((sk, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '130px', fontSize: '0.82rem', color: '#94a3b8',
            textAlign: 'right', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap',
          }}>
            {sk.name}
          </div>
          <div style={{
            flex: 1, height: '10px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '5px', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: sk.matched ? '100%' : '0%',
              background: sk.matched ? 'linear-gradient(90deg, #10b981, #059669)' : '#ef4444',
              borderRadius: '5px',
              transition: 'width 0.8s ease',
              animationDelay: `${i * 0.1}s`,
            }} />
          </div>
          <div style={{
            width: '20px', height: '20px',
            borderRadius: '50%',
            background: sk.matched ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.6rem',
          }}>
            {sk.matched ? '✓' : '✗'}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── ATS compatibility multi-bar ──────────────────────────────
function CompatibilityBars({ score, coverage }) {
  const metrics = [
    { label: 'ATS Score',         value: score,    color: '#00f5ff' },
    { label: 'Keyword Coverage',  value: coverage, color: '#a855f7' },
    { label: 'Format Score',      value: Math.min(100, score + 10), color: '#10b981' },
    { label: 'Overall Readiness', value: Math.round((score + coverage) / 2), color: '#f59e0b' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
      {metrics.map((m, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{m.label}</span>
            <span style={{ color: m.color, fontFamily: "'Orbitron', monospace", fontSize: '0.75rem', fontWeight: 700 }}>
              {m.value}%
            </span>
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${m.value}%`,
              background: m.color, borderRadius: '4px',
              transition: 'width 1s ease',
              boxShadow: `0 0 8px ${m.color}60`,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Score distribution (recruiter) ──────────────────────────
function ScoreDistributionChart({ buckets, total }) {
  const max = Math.max(...buckets.map(b => b.count), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', height: '120px', marginTop: '12px' }}>
      {buckets.map((b, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%' }}>
          <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '0.7rem', fontWeight: 900, color: b.color }}>
            {b.count}
          </span>
          <div style={{
            width: '100%',
            height: `${(b.count / max) * 80}px`,
            background: `${b.color}30`,
            border: `1px solid ${b.color}60`,
            borderRadius: '4px 4px 0 0',
            transition: 'height 0.8s ease',
            minHeight: b.count > 0 ? '8px' : '2px',
          }} />
          <span style={{ color: '#64748b', fontSize: '0.7rem', textAlign: 'center' }}>{b.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Top skills bar chart (recruiter) ────────────────────────
function TopSkillsBars({ skills }) {
  if (!skills.length) {
    return <p style={{ color: '#475569', fontSize: '0.88rem', padding: '16px 0' }}>No skill data yet.</p>;
  }
  const max = skills[0]?.pct || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
      {skills.map((sk, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '120px', fontSize: '0.82rem', color: '#94a3b8', textAlign: 'right', textTransform: 'capitalize' }}>
            {sk.skill}
          </div>
          <div style={{ flex: 1, height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(sk.pct / max) * 100}%`,
              background: `linear-gradient(90deg, #a855f7, #6366f1)`,
              borderRadius: '5px',
              transition: 'width 0.8s ease',
            }} />
          </div>
          <span style={{ color: '#a855f7', fontFamily: "'Orbitron', monospace", fontSize: '0.7rem', minWidth: '36px' }}>
            {sk.pct}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Candidate score comparison bars (recruiter) ─────────────
function CandidateComparisonBars({ candidates }) {
  const top = [...candidates].sort((a, b) => b.matchScore - a.matchScore).slice(0, 8);
  const max = top[0]?.matchScore || 100;

  const color = (s) => s >= 80 ? '#10b981' : s >= 60 ? '#f59e0b' : s >= 40 ? '#f97316' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
      {top.map((c, i) => {
        const sc = Math.round(c.matchScore || 0);
        const name = (c.fileName || 'Resume').replace(/\.(pdf|docx)$/i, '').slice(0, 28);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '0.65rem', color: '#475569', minWidth: '20px' }}>
              #{i + 1}
            </span>
            <div style={{ width: '160px', fontSize: '0.8rem', color: '#94a3b8', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {name}
            </div>
            <div style={{ flex: 1, height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(sc / max) * 100}%`,
                background: color(sc),
                borderRadius: '5px',
                transition: 'width 0.8s ease',
                boxShadow: `0 0 6px ${color(sc)}50`,
              }} />
            </div>
            <span style={{ color: color(sc), fontFamily: "'Orbitron', monospace", fontSize: '0.72rem', minWidth: '36px', textAlign: 'right' }}>
              {sc}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Shared: legend dot ───────────────────────────────────────
function LegendDot({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
      <span style={{ color: '#64748b', fontSize: '0.78rem' }}>{label}</span>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════
const styles = {
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    marginTop: '28px',
  },
  chartCard: {
    padding: '24px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
  },
  chartLabel: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.68rem', color: '#94a3b8',
    letterSpacing: '1px', marginBottom: '16px',
  },
  legendRow: {
    display: 'flex', gap: '16px', justifyContent: 'center',
    flexWrap: 'wrap', marginTop: '12px',
  },
};
