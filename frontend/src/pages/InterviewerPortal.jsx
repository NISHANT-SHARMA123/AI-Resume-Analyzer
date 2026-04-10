// src/pages/InterviewerPortal.jsx
import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { ATSCharts } from '../components/ATSCharts';
import {
  bulkUploadResumes, updateCandidateDecision,
  getCandidateSummary, downloadResumeByAnalysis,
  getInterviewerHistory, getAcceptedCandidates,
  downloadAcceptedZip, triggerBlobDownload, getAuthData,
  clearInterviewerHistory,
} from '../services/api';

// ─────────────────────────────────────────────────────────────
//  ConfirmDialog
//  Reusable confirmation overlay — used for Remove & Clear History
// ─────────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, confirmLabel, confirmColor, onConfirm, onCancel }) {
  return (
    <div style={dlg.overlay}>
      <div style={dlg.box}>
        <div style={dlg.iconRing}>
          <span style={{ fontSize: '1.6rem' }}>⚠️</span>
        </div>
        <h3 style={dlg.title}>{title}</h3>
        <p style={dlg.message}>{message}</p>
        <div style={dlg.btnRow}>
          <button style={dlg.btnCancel} onClick={onCancel}>Cancel</button>
          <button
            style={{ ...dlg.btnConfirm, background: confirmColor || 'linear-gradient(135deg,#ef4444,#dc2626)' }}
            onClick={onConfirm}>
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  InterviewerPortal — main component
//
//  Four tabs (all existing functionality preserved):
//    1. Upload    — bulk upload and analyze resumes
//    2. Results   — ranked candidate cards with all actions
//    3. Accepted  — all accepted candidates + bulk ZIP download
//                   NEW: Remove button per candidate
//    4. History   — full analysis history
//                   NEW: Clear History button
//
//  SummaryModal — full-screen overlay
//    NEW: ATS Charts tab alongside existing summary data
// ─────────────────────────────────────────────────────────────
export default function InterviewerPortal() {
  const { userId, userName } = getAuthData();

  // ── Existing state (unchanged) ─────────────────────────────
  const [tab, setTab]               = useState('upload');
  const [files, setFiles]           = useState([]);
  const [jd, setJd]                 = useState('');
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [minScore, setMinScore]     = useState(0);

  // Summary modal
  const [summaryData, setSummaryData]       = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Accepted tab
  const [accepted, setAccepted]               = useState([]);
  const [acceptedLoading, setAcceptedLoading] = useState(false);
  const [zipLoading, setZipLoading]           = useState(false);
  const [zipSuccess, setZipSuccess]           = useState(false);

  // History tab
  const [history, setHistory]               = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySelected, setHistorySelected] = useState(null);

  // Per-card download state
  const [downloadingId, setDownloadingId] = useState(null);

  // ── Blind screening (Feature 1) ───────────────────────────
  const [blindMode, setBlindMode] = useState(false);

  // ── Candidate comparison selection (Feature 3) ────────────
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const toggleCompare = (id) =>
    setSelectedForCompare(prev =>
      prev.includes(id) ? prev.filter(x => x !== id)
      : prev.length < 3 ? [...prev, id] : prev
    );

  // ── Settings: scoring weights (Feature 5) ─────────────────
  const [weights, setWeights] = useState({ skill: 40, experience: 20, project: 20, quality: 10, potential: 10 });
  const [roleTemplate, setRoleTemplate] = useState('general');
  const [fresherMode, setFresherMode] = useState(false);
  const updateWeight = (key, val) => setWeights(prev => ({ ...prev, [key]: Math.max(0, Math.min(100, Number(val))) }));

  // ── NEW state: Remove from Accepted ───────────────────────
  // removeConfirm holds { analysisId, fileName } or null
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const [removingId, setRemovingId]       = useState(null);

  // ── NEW state: Clear History ───────────────────────────────
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing]         = useState(false);

  // ── Load tabs ──────────────────────────────────────────────
  useEffect(() => { if (tab === 'accepted' && userId) loadAccepted(); }, [tab]);
  useEffect(() => { if (tab === 'history'  && userId) loadHistory();  }, [tab]);

  // ── Data loaders (unchanged) ───────────────────────────────
  const loadAccepted = async () => {
    setAcceptedLoading(true);
    try {
      const res = await getAcceptedCandidates(userId);
      setAccepted(res.data || []);
    } catch { setAccepted([]); }
    finally { setAcceptedLoading(false); }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await getInterviewerHistory(userId);
      setHistory(res.data || []);
    } catch { setHistory([]); }
    finally { setHistoryLoading(false); }
  };

  // ── Bulk upload (unchanged) ────────────────────────────────
  const handleUpload = async () => {
    if (!files.length)  return setError('Please select at least one resume!');
    if (!jd.trim())     return setError('Please enter the job description!');
    setLoading(true); setError('');
    try {
      const res = await bulkUploadResumes(files, jd, userId);
      setCandidates(res.data.rankedCandidates || []);
      setTab('results');
    } catch {
      setError('Upload failed. Make sure backend and ML service are running!');
    } finally { setLoading(false); }
  };

  // ── Decision accept/reject (unchanged) ────────────────────
  const handleDecision = async (analysisId, decision, idx) => {
    try {
      await updateCandidateDecision(analysisId, decision);
      const updated = [...candidates];
      updated[idx] = { ...updated[idx], decision };
      setCandidates(updated);
      if (accepted.length || tab === 'accepted') loadAccepted();
    } catch { alert('Failed to update decision'); }
  };

  // ── Summary modal (unchanged) ──────────────────────────────
  const handleViewSummary = async (analysisId) => {
    setSummaryLoading(true);
    setSummaryData(null);
    try {
      const res = await getCandidateSummary(analysisId);
      setSummaryData(res.data);
    } catch { alert('Failed to load summary.'); }
    finally { setSummaryLoading(false); }
  };

  // ── Download resume (unchanged) ────────────────────────────
  const handleDownloadResume = async (analysisId, fileName) => {
    setDownloadingId(analysisId);
    try {
      const res = await downloadResumeByAnalysis(analysisId);
      triggerBlobDownload(res.data, fileName || 'resume.pdf');
    } catch { alert('Failed to download resume.'); }
    finally { setDownloadingId(null); }
  };

  // ── Bulk ZIP download (unchanged) ─────────────────────────
  const handleBulkDownload = async () => {
    setZipLoading(true); setZipSuccess(false);
    try {
      const res = await downloadAcceptedZip(userId);
      triggerBlobDownload(res.data, 'accepted_candidates.zip');
      setZipSuccess(true);
      setTimeout(() => setZipSuccess(false), 3000);
    } catch { alert('Failed to build ZIP. Make sure there are accepted candidates.'); }
    finally { setZipLoading(false); }
  };

  // ── NEW: Remove from Accepted ──────────────────────────────
  // Reuses existing updateCandidateDecision — sets decision back to PENDING.
  // The original resume file and all analysis data remain untouched in the DB.
  const handleRemoveAccepted = async () => {
    if (!removeConfirm) return;
    setRemovingId(removeConfirm.analysisId);
    try {
      await updateCandidateDecision(removeConfirm.analysisId, 'PENDING');
      // Remove from local accepted list immediately (optimistic update)
      setAccepted(prev => prev.filter(a => a.analysisId !== removeConfirm.analysisId));
    } catch { alert('Failed to remove candidate. Please try again.'); }
    finally {
      setRemovingId(null);
      setRemoveConfirm(null);
    }
  };

  // ── NEW: Clear History ─────────────────────────────────────
  const handleClearHistory = async () => {
    setClearing(true);
    try {
      await clearInterviewerHistory(userId);
      setHistory([]);
      setHistorySelected(null);
    } catch { alert('Failed to clear history. Please try again.'); }
    finally {
      setClearing(false);
      setClearConfirm(false);
    }
  };

  // ── Helpers (unchanged) ────────────────────────────────────
  const scoreColor = (sc) => {
    if (sc >= 80) return '#10b981';
    if (sc >= 60) return '#f59e0b';
    if (sc >= 40) return '#f97316';
    return '#ef4444';
  };
  const scoreLabel = (sc) => {
    if (sc >= 80) return 'Excellent';
    if (sc >= 60) return 'Good';
    if (sc >= 40) return 'Fair';
    return 'Low';
  };

  const filtered       = candidates.filter(c => (c.matchScore || 0) >= minScore);
  const acceptedCount  = candidates.filter(c => c.decision === 'ACCEPTED').length;
  const rejectedCount  = candidates.filter(c => c.decision === 'REJECTED').length;
  const strongCount    = candidates.filter(c => c.matchScore >= 70).length;

  // ═════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════
  return (
    <div style={s.page}>
      <Navbar />
      <div style={s.orb} />
      <div style={s.orbTwo} />

      {/* ── Summary Modal (with ATS Charts tab added) ── */}
      {(summaryData || summaryLoading) && (
        <SummaryModal
          data={summaryData}
          loading={summaryLoading}
          onClose={() => { setSummaryData(null); setSummaryLoading(false); }}
          onDownload={(id, name) => handleDownloadResume(id, name)}
          downloading={downloadingId}
        />
      )}

      {/* ── Remove Confirmation Dialog ── */}
      {removeConfirm && (
        <ConfirmDialog
          title="Remove from Accepted?"
          message={`Are you sure you want to remove "${removeConfirm.fileName}" from the accepted list? The resume and analysis data will not be deleted.`}
          confirmLabel="Yes, Remove"
          confirmColor="linear-gradient(135deg, #f97316, #ea580c)"
          onConfirm={handleRemoveAccepted}
          onCancel={() => setRemoveConfirm(null)}
        />
      )}

      {/* ── Clear History Confirmation Dialog ── */}
      {clearConfirm && (
        <ConfirmDialog
          title="Clear Entire History?"
          message="Are you sure you want to clear the entire history? This action cannot be undone."
          confirmLabel="Yes, Clear All"
          confirmColor="linear-gradient(135deg, #ef4444, #dc2626)"
          onConfirm={handleClearHistory}
          onCancel={() => setClearConfirm(false)}
        />
      )}

      <div style={s.container}>

        {/* ── Page Header (unchanged) ─────────────────── */}
        <div style={s.header}>
          <div style={s.badge}>🏢 INTERVIEWER PORTAL</div>
          <h1 style={s.title}>
            Welcome, <span style={s.neon}>{userName || 'Recruiter'}</span>
          </h1>
          <p style={s.subtitle}>
            AI-powered bulk resume ranking, candidate management, and smart hiring tools
          </p>
        </div>

        {/* ── Tab Bar (unchanged) ─────────────────────── */}
        <div style={s.tabs}>
          {[
            { id: 'upload',    label: '📤 Upload'   },
            { id: 'dashboard', label: '🏠 Dashboard' },
            { id: 'results',   label: `📊 Results${candidates.length ? ` (${candidates.length})` : ''}` },
            { id: 'compare',   label: `⚖️ Compare${selectedForCompare.length ? ` (${selectedForCompare.length})` : ''}` },
            { id: 'accepted',  label: `✅ Accepted${accepted.length ? ` (${accepted.length})` : ''}` },
            { id: 'history',   label: '📂 History'  },
            { id: 'settings',  label: '⚙️ Settings' },
          ].map(t => (
            <button key={t.id}
              style={{ ...s.tab, ...(tab === t.id ? s.tabActive : {}) }}
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {error && <div style={s.errorBox}>⚠️ {error}</div>}

        {/* ══════════════════════════════════════════════
            TAB: UPLOAD  (unchanged)
        ══════════════════════════════════════════════ */}
        {tab === 'upload' && (
          <div style={s.card}>
            <h2 style={s.cardTitle}>📤 Bulk Resume Upload & Analysis</h2>

            <div style={s.field}>
              <label style={s.label}>SELECT RESUMES (PDF / DOCX)</label>
              <div style={s.fileInputRow}>
                <input type="file" multiple accept=".pdf,.docx"
                  onChange={e => setFiles(Array.from(e.target.files))}
                  style={{ display: 'none' }} id="bulk-files" />
                <label htmlFor="bulk-files" style={s.fileBtn}>📁 Browse Files</label>
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                  {files.length > 0 ? `${files.length} file(s) selected` : 'No files selected'}
                </span>
              </div>
              {files.length > 0 && (
                <div style={s.fileList}>
                  {files.map((f, i) => (
                    <div key={i} style={s.fileItem}>
                      <span>📄 {f.name}</span>
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                        ({(f.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={s.field}>
              <label style={s.label}>JOB DESCRIPTION</label>
              <textarea style={s.textarea}
                placeholder="Paste the full job description here..."
                value={jd}
                onChange={e => setJd(e.target.value)}
                rows={8} />
            </div>

            <button onClick={handleUpload} style={s.btnPurple} disabled={loading}>
              {loading
                ? `🧠 Analyzing ${files.length} resume${files.length !== 1 ? 's' : ''}...`
                : `🚀 Analyze ${files.length || ''} Resume${files.length !== 1 ? 's' : ''}`}
            </button>

            {loading && (
              <div style={s.loadingBox}>
                <div style={s.spinner} />
                <p style={{ color: '#a855f7', fontFamily: "'Orbitron', monospace", fontSize: '0.75rem', marginTop: '16px' }}>
                  Processing and ranking all candidates...
                </p>
                <p style={{ color: '#475569', fontSize: '0.82rem', marginTop: '6px' }}>
                  Extracting text • Running AI analysis • Calculating scores
                </p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: RESULTS  (unchanged)
        ══════════════════════════════════════════════ */}
        {tab === 'results' && (
          <div>
            {candidates.length === 0 ? (
              <div style={s.emptyCard}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📊</div>
                <p style={{ color: '#94a3b8' }}>No results yet — upload resumes first.</p>
                <button style={{ ...s.btnOutline, marginTop: '16px' }}
                  onClick={() => setTab('upload')}>← Go to Upload</button>
              </div>
            ) : (
              <>
                {/* Feature 2: Results bar chart */}
                <ResultsBarChart candidates={filtered} blindMode={blindMode} />

              {/* Stats + controls row */}
                <div style={s.controlsRow}>
                  <div style={s.statsRow}>
                    {[
                      { label: 'Total',    value: candidates.length,  color: 'white'   },
                      { label: 'Strong',   value: strongCount,        color: '#10b981' },
                      { label: 'Accepted', value: acceptedCount,      color: '#00f5ff' },
                      { label: 'Rejected', value: rejectedCount,      color: '#ef4444' },
                    ].map((st, i) => (
                      <div key={i} style={s.statBox}>
                        <span style={{ ...s.statNum, color: st.color }}>{st.value}</span>
                        <span style={s.statLbl}>{st.label}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ ...s.label, marginBottom: 0 }}>MIN: {minScore}%</label>
                    <input type="range" min="0" max="100" step="5" value={minScore}
                      onChange={e => setMinScore(Number(e.target.value))}
                      style={{ accentColor: '#a855f7', width: '110px' }} />
                    <button
                      onClick={() => setBlindMode(b => !b)}
                      style={{ ...s.btnOutline, ...(blindMode ? { color:'#a855f7', borderColor:'rgba(168,85,247,0.4)', background:'rgba(168,85,247,0.08)' } : {}) }}>
                      {blindMode ? '🙈 Blind ON' : '👁 Blind OFF'}
                    </button>
                    <button onClick={() => { setTab('upload'); setFiles([]); setCandidates([]); setJd(''); }}
                      style={s.btnOutline}>🔄 New Upload</button>
                  </div>
                </div>

                {/* Candidate grid */}
                <div style={s.candidateGrid}>
                  {filtered.map((c, i) => (
                    <CandidateCard
                      key={i}
                      candidate={c}
                      rank={i + 1}
                      scoreColor={scoreColor}
                      scoreLabel={scoreLabel}
                      blindMode={blindMode}
                      selectedForCompare={selectedForCompare.includes(c.analysisId)}
                      onToggleCompare={() => toggleCompare(c.analysisId)}
                      onDecision={(decision) => handleDecision(c.analysisId, decision, i)}
                      onViewSummary={() => handleViewSummary(c.analysisId)}
                      onDownload={() => handleDownloadResume(c.analysisId, c.fileName)}
                      downloading={downloadingId === c.analysisId}
                    />
                  ))}
                </div>

                {filtered.length === 0 && (
                  <div style={s.emptyCard}>
                    <p style={{ color: '#94a3b8' }}>No candidates match the minimum score of {minScore}%</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: ACCEPTED
            CHANGE: Added Remove button per candidate
        ══════════════════════════════════════════════ */}
        {tab === 'accepted' && (
          <AcceptedTab
            accepted={accepted}
            loading={acceptedLoading}
            zipLoading={zipLoading}
            zipSuccess={zipSuccess}
            downloadingId={downloadingId}
            removingId={removingId}
            scoreColor={scoreColor}
            onBulkDownload={handleBulkDownload}
            onDownloadResume={handleDownloadResume}
            onViewSummary={handleViewSummary}
            onRefresh={loadAccepted}
            onRemove={(analysisId, fileName) => setRemoveConfirm({ analysisId, fileName })}
          />
        )}

        {tab === 'dashboard' && (
          <DashboardTab candidates={candidates} accepted={accepted} scoreColor={scoreColor} />
        )}

        {tab === 'compare' && (
          <CompareTab
            candidates={candidates}
            selectedIds={selectedForCompare}
            onToggle={toggleCompare}
            onClear={() => setSelectedForCompare([])}
            scoreColor={scoreColor}
            blindMode={blindMode}
          />
        )}

        {tab === 'settings' && (
          <SettingsTab
            weights={weights}
            onUpdateWeight={updateWeight}
            roleTemplate={roleTemplate}
            onRoleTemplate={setRoleTemplate}
            fresherMode={fresherMode}
            onFresherMode={setFresherMode}
          />
        )}

        {/* ══════════════════════════════════════════════
            TAB: HISTORY
            CHANGE: Added Clear History button
        ══════════════════════════════════════════════ */}
        {tab === 'history' && (
          <HistoryTab
            history={history}
            loading={historyLoading}
            selected={historySelected}
            downloadingId={downloadingId}
            clearing={clearing}
            scoreColor={scoreColor}
            onSelect={setHistorySelected}
            onDownloadResume={handleDownloadResume}
            onViewSummary={handleViewSummary}
            onRefresh={loadHistory}
            onClearHistory={() => setClearConfirm(true)}
          />
        )}

      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
//  CANDIDATE CARD — Results tab (unchanged)
// ─────────────────────────────────────────────────────────────
function CandidateCard({
  candidate: c, rank, scoreColor, scoreLabel,
  blindMode, selectedForCompare, onToggleCompare,
  onDecision, onViewSummary, onDownload, downloading,
}) {
  const color      = scoreColor(c.matchScore || 0);
  const isAccepted = c.decision === 'ACCEPTED';
  const isRejected = c.decision === 'REJECTED';

  return (
    <div style={{
      ...s.candidateCard,
      borderColor: isAccepted ? 'rgba(16,185,129,0.3)'
                 : isRejected ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)',
    }}>
      {/* Rank + decision badge + compare */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={s.rankBadge}>#{rank}</span>
          <button onClick={onToggleCompare} style={{
            padding: '2px 8px', fontSize: '0.58rem',
            fontFamily: "'Orbitron', monospace",
            background: selectedForCompare ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${selectedForCompare ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '6px', color: selectedForCompare ? '#a855f7' : '#64748b', cursor: 'pointer',
          }}>
            {selectedForCompare ? '✓ Compare' : '+ Compare'}
          </button>
        </div>
        {c.decision && c.decision !== 'PENDING' && (
          <span style={{
            ...s.decisionPill,
            background: isAccepted ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            color: isAccepted ? '#10b981' : '#ef4444',
            borderColor: isAccepted ? '#10b981' : '#ef4444',
          }}>
            {isAccepted ? '✓ ACCEPTED' : '✗ REJECTED'}
          </span>
        )}
      </div>

      {/* Score circle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ ...s.scoreCircle, borderColor: color, color }}>
          <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '1rem', fontWeight: 900 }}>
            {Math.round(c.matchScore || 0)}%
          </div>
          <div style={{ fontSize: '0.55rem', letterSpacing: '1px', marginTop: '2px' }}>
            {scoreLabel(c.matchScore || 0)}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.82rem', color: '#94a3b8', wordBreak: 'break-all' }}>
            {blindMode ? `🔒 Candidate #${rank}` : `📄 ${c.fileName}`}
          </div>
          {c.analyzedAt && (
            <div style={{ color: '#475569', fontSize: '0.75rem', marginTop: '4px' }}>
              {c.analyzedAt}
            </div>
          )}
        </div>
      </div>

      {/* Keyword tags — hidden in blind mode */}
      {!blindMode && c.keywordsMatched && (
        <div style={s.tagRow}>
          {c.keywordsMatched.split(',').slice(0, 5).map((kw, i) => (
            <span key={i} style={s.kwTag}>{kw.trim()}</span>
          ))}
        </div>
      )}

      {/* Mini score bars — shown only when sub-scores available from ML service */}
      {(c.skillScore != null || c.experienceScore != null ||
        c.projectScore != null || c.resumeQualityScore != null) && (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '10px',
          display: 'flex', flexDirection: 'column', gap: '7px',
        }}>
          <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '0.58rem', color: '#475569', letterSpacing: '1px' }}>
            SCORE BREAKDOWN
          </span>
          {[
            { label: '⚡ Skill',      val: c.skillScore,         color: '#00f5ff' },
            { label: '💼 Experience', val: c.experienceScore,    color: '#a855f7' },
            { label: '🔧 Projects',   val: c.projectScore,       color: '#10b981' },
            { label: '📋 Quality',    val: c.resumeQualityScore, color: '#f59e0b' },
          ].filter(d => d.val != null).map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ fontSize: '0.68rem', color: '#64748b', width: '80px', flexShrink: 0 }}>
                {d.label}
              </span>
              <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.round(d.val)}%`,
                  background: d.color,
                  borderRadius: '3px',
                  transition: 'width 1s ease',
                  boxShadow: `0 0 5px ${d.color}40`,
                }} />
              </div>
              <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '0.6rem', color: d.color, width: '30px', textAlign: 'right' }}>
                {Math.round(d.val)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Summary preview — hidden in blind mode */}
      {!blindMode && c.summary && (
        <p style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.6, margin: 0 }}>
          {c.summary.length > 130 ? c.summary.substring(0, 127) + '...' : c.summary}
        </p>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onViewSummary} style={s.btnAction}>
            🔍 View Summary
          </button>
          <button onClick={onDownload} style={s.btnAction} disabled={downloading}>
            {downloading ? '⏳' : '⬇️'} Resume
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => onDecision('ACCEPTED')}
            style={{
              ...s.btnDecision,
              background:  isAccepted ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.08)',
              borderColor: '#10b981', color: '#10b981',
            }}>
            ✓ Accept
          </button>
          <button onClick={() => onDecision('REJECTED')}
            style={{
              ...s.btnDecision,
              background:  isRejected ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.08)',
              borderColor: '#ef4444', color: '#ef4444',
            }}>
            ✗ Reject
          </button>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
//  ACCEPTED TAB
//  CHANGE: Added "✕ Remove" button per candidate row.
//          Clicking triggers ConfirmDialog before calling
//          updateCandidateDecision(id, 'PENDING').
//          All other functionality (ZIP download, view summary,
//          download resume, refresh) is completely unchanged.
// ─────────────────────────────────────────────────────────────
function AcceptedTab({
  accepted, loading, zipLoading, zipSuccess, downloadingId, removingId,
  scoreColor, onBulkDownload, onDownloadResume, onViewSummary, onRefresh, onRemove,
}) {
  if (loading) return <LoadingCard message="Loading accepted candidates..." />;

  return (
    <div>
      {/* Header + bulk download (unchanged) */}
      <div style={s.controlsRow}>
        <h2 style={{ ...s.cardTitle, margin: 0 }}>
          ✅ Accepted Candidates ({accepted.length})
        </h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onRefresh} style={s.btnOutline}>🔄 Refresh</button>
          <button
            onClick={onBulkDownload}
            style={{ ...s.btnZip, ...(zipSuccess ? s.btnZipSuccess : {}) }}
            disabled={zipLoading || accepted.length === 0}>
            {zipLoading ? '⏳ Building ZIP...'
              : zipSuccess ? '✅ Downloaded!'
              : `📦 Download All Accepted (${accepted.length})`}
          </button>
        </div>
      </div>

      {accepted.length === 0 ? (
        <div style={s.emptyCard}>
          <div style={{ fontSize: '2.5rem', marginBottom: '14px' }}>✅</div>
          <p style={{ color: '#94a3b8' }}>No accepted candidates yet.</p>
          <p style={{ color: '#475569', fontSize: '0.85rem', marginTop: '6px' }}>
            Accept candidates in the Results tab to see them here.
          </p>
        </div>
      ) : (
        <>
          {/* ZIP contents description (unchanged) */}
          <div style={s.zipInfoBox}>
            <span style={{ color: '#a855f7', fontWeight: 700 }}>📦 ZIP will contain:</span>
            <span style={{ color: '#64748b' }}>
              {accepted.length} resume file{accepted.length !== 1 ? 's' : ''}
              &nbsp;·&nbsp;Full analysis report (report.txt)
              &nbsp;·&nbsp;Candidate manifest (manifest.txt)
            </span>
          </div>

          <div style={s.acceptedList}>
            {accepted.map((a, i) => {
              const color = scoreColor(a.matchScore || 0);
              return (
                <div key={i} style={s.acceptedRow}>
                  <div style={s.acceptedRank}>#{i + 1}</div>

                  <div style={{ ...s.acceptedScore, color, borderColor: color }}>
                    {a.matchScore}%
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem', marginBottom: '3px' }}>
                      📄 {a.fileName}
                    </div>
                    <div style={{ color: '#475569', fontSize: '0.78rem', marginBottom: '6px' }}>
                      {a.analyzedAt}
                    </div>
                    {a.keywordsMatched && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {a.keywordsMatched.split(',').slice(0, 5).map((kw, j) => (
                          <span key={j} style={s.kwTagGreen}>{kw.trim()}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action buttons — existing + NEW remove */}
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => onViewSummary(a.analysisId)}
                      style={s.btnActionSm}>🔍 Summary</button>
                    <button
                      onClick={() => onDownloadResume(a.analysisId, a.fileName)}
                      style={s.btnActionSm}
                      disabled={downloadingId === a.analysisId}>
                      {downloadingId === a.analysisId ? '⏳' : '⬇️'} Resume
                    </button>
                    {/* ── NEW: Remove button ── */}
                    <button
                      onClick={() => onRemove(a.analysisId, a.fileName)}
                      style={s.btnRemove}
                      disabled={removingId === a.analysisId}>
                      {removingId === a.analysisId ? '⏳' : '✕ Remove'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
//  HISTORY TAB
//  CHANGE: Added "🗑 Clear History" button.
//          Clicking triggers ConfirmDialog before calling
//          clearInterviewerHistory(userId).
//          All other functionality (row click, detail panel,
//          download, view summary, refresh) is unchanged.
// ─────────────────────────────────────────────────────────────
function HistoryTab({
  history, loading, selected, downloadingId, clearing,
  scoreColor, onSelect, onDownloadResume, onViewSummary, onRefresh, onClearHistory,
}) {
  if (loading) return <LoadingCard message="Loading analysis history..." />;

  return (
    <div>
      <div style={s.controlsRow}>
        <h2 style={{ ...s.cardTitle, margin: 0 }}>
          📂 Analysis History ({history.length})
        </h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onRefresh} style={s.btnOutline}>🔄 Refresh</button>
          {/* ── NEW: Clear History button (only shown when history exists) ── */}
          {history.length > 0 && (
            <button
              onClick={onClearHistory}
              style={s.btnDanger}
              disabled={clearing}>
              {clearing ? '⏳ Clearing...' : '🗑 Clear History'}
            </button>
          )}
        </div>
      </div>

      {history.length === 0 ? (
        <div style={s.emptyCard}>
          <div style={{ fontSize: '2.5rem', marginBottom: '14px' }}>📂</div>
          <p style={{ color: '#94a3b8' }}>No history available.</p>
          <p style={{ color: '#475569', fontSize: '0.85rem', marginTop: '6px' }}>
            Analyzed resumes will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.3fr' : '1fr', gap: '20px' }}>
          {/* History list (unchanged) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {history.map((h, i) => {
              const isSelected = selected?.analysisId === h.analysisId;
              const color      = scoreColor(h.matchScore || 0);
              const isAccepted = h.decision === 'ACCEPTED';
              const isRejected = h.decision === 'REJECTED';

              return (
                <div key={i}
                  style={{ ...s.historyRow, ...(isSelected ? s.historyRowActive : {}) }}
                  onClick={() => onSelect(isSelected ? null : h)}>

                  <div style={{ ...s.historyScore, color, borderColor: color }}>
                    {h.matchScore}%
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'white', fontSize: '0.9rem', fontWeight: 600, marginBottom: '3px' }}>
                      📄 {h.fileName}
                    </div>
                    <div style={{ color: '#475569', fontSize: '0.75rem', marginBottom: '4px' }}>
                      {h.analyzedAt}
                    </div>
                    {h.jobDescPreview && (
                      <div style={{ color: '#64748b', fontSize: '0.78rem', lineHeight: 1.4 }}>
                        {h.jobDescPreview}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                    {h.decision && h.decision !== 'PENDING' && (
                      <span style={{
                        ...s.decisionPill, fontSize: '0.55rem', padding: '3px 8px',
                        background:  isAccepted ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        color:       isAccepted ? '#10b981' : '#ef4444',
                        borderColor: isAccepted ? '#10b981' : '#ef4444',
                      }}>
                        {isAccepted ? '✓ ACCEPTED' : '✗ REJECTED'}
                      </span>
                    )}
                    {h.decision === 'PENDING' && (
                      <span style={{ ...s.decisionPill, fontSize: '0.55rem', padding: '3px 8px',
                        background: 'rgba(100,116,139,0.1)', color: '#64748b', borderColor: '#475569' }}>
                        PENDING
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detail panel (unchanged) */}
          {selected && (
            <div style={{ ...s.card, alignSelf: 'start', position: 'sticky', top: '100px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '18px' }}>
                <h3 style={{ ...s.cardTitle, fontSize: '0.85rem', margin: 0 }}>📋 Analysis Detail</h3>
                <button onClick={() => onSelect(null)}
                  style={{ ...s.btnOutline, padding: '5px 10px', fontSize: '0.6rem' }}>
                  ✕ Close
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '18px' }}>
                <div style={{
                  ...s.scoreCircle, width: '64px', height: '64px',
                  borderColor: scoreColor(selected.matchScore),
                  color: scoreColor(selected.matchScore), fontSize: '0.85rem',
                }}>
                  {selected.matchScore}%
                </div>
                <div>
                  <div style={{ color: 'white', fontWeight: 700 }}>{selected.fileName}</div>
                  <div style={{ color: '#475569', fontSize: '0.78rem', marginTop: '2px' }}>{selected.analyzedAt}</div>
                </div>
              </div>

              {selected.summary && (
                <div style={s.detailSection}>
                  <div style={{ ...s.detailLabel, color: '#f59e0b' }}>📝 Summary</div>
                  <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.7, margin: 0 }}>
                    {selected.summary}
                  </p>
                </div>
              )}

              {selected.keywordsMatched && (
                <div style={s.detailSection}>
                  <div style={{ ...s.detailLabel, color: '#10b981' }}>✅ Keywords Matched</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selected.keywordsMatched.split(',').filter(Boolean).map((kw, i) => (
                      <span key={i} style={s.kwTagGreen}>{kw.trim()}</span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
                <button onClick={() => onViewSummary(selected.analysisId)}
                  style={{ ...s.btnAction, flex: 1 }}>
                  🔍 Full Summary
                </button>
                <button
                  onClick={() => onDownloadResume(selected.analysisId, selected.fileName)}
                  style={{ ...s.btnAction, flex: 1 }}
                  disabled={downloadingId === selected.analysisId}>
                  {downloadingId === selected.analysisId ? '⏳' : '⬇️'} Resume
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
//  SUMMARY MODAL
//  CHANGE: Added "📊 ATS Charts" toggle tab.
//          All existing summary content (score, suitability,
//          keywords, feedback, suggestions, JD) is 100% unchanged.
//          The ATS Charts tab is additive — switching to it hides
//          the text content, switching back shows it again.
// ─────────────────────────────────────────────────────────────
function SummaryModal({ data, loading, onClose, onDownload, downloading }) {
  const [modalTab, setModalTab] = useState('summary'); // 'summary' | 'charts'

  const score = data?.matchScore || 0;
  const scoreColors = { 80: '#10b981', 60: '#f59e0b', 40: '#f97316', 0: '#ef4444' };
  const color = Object.entries(scoreColors).reverse().find(([t]) => score >= Number(t))?.[1] || '#ef4444';

  // Adapter: ATSCharts expects comma-separated strings,
  // but getCandidateSummary returns arrays. Convert here.
  const chartResult = data ? {
    matchScore:       data.matchScore,
    keywordsMatched:  Array.isArray(data.keywordsMatched)
                        ? data.keywordsMatched.join(', ')
                        : (data.keywordsMatched || ''),
    missingKeywords:  Array.isArray(data.missingKeywords)
                        ? data.missingKeywords.join(', ')
                        : (data.missingKeywords || ''),
  } : null;

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modalBox} onClick={e => e.stopPropagation()}>

        {/* Modal header (unchanged) */}
        <div style={s.modalHeader}>
          <div>
            <div style={{ ...s.badge, marginBottom: '8px' }}>🤖 AI CANDIDATE SUMMARY</div>
            {data && (
              <h2 style={{ fontFamily: "'Orbitron', monospace", fontSize: '1.1rem', color: 'white', margin: 0 }}>
                📄 {data.fileName}
              </h2>
            )}
          </div>
          <button onClick={onClose} style={{ ...s.btnOutline, padding: '8px 16px' }}>✕ Close</button>
        </div>

        {loading && (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ ...s.spinner, borderTopColor: '#00f5ff', margin: '0 auto 16px' }} />
            <p style={{ color: '#00f5ff', fontFamily: "'Orbitron', monospace", fontSize: '0.75rem' }}>
              Loading AI summary...
            </p>
          </div>
        )}

        {data && !loading && (
          <>
            {/* ── NEW: Summary / ATS Charts tab bar ── */}
            <div style={s.modalTabRow}>
              <button
                style={{ ...s.modalTabBtn, ...(modalTab === 'summary' ? s.modalTabBtnActive : {}) }}
                onClick={() => setModalTab('summary')}>
                📋 Summary
              </button>
              <button
                style={{ ...s.modalTabBtn, ...(modalTab === 'charts' ? s.modalTabBtnActive : {}) }}
                onClick={() => setModalTab('charts')}>
                📊 ATS Charts
              </button>
            </div>

            <div style={s.modalBody}>

              {/* ══════════════════════════════════════
                  SUMMARY TAB — all existing content,
                  completely unchanged
              ══════════════════════════════════════ */}
              {modalTab === 'summary' && (
                <>
                  {/* Score + suitability row */}
                  <div style={s.summaryScoreRow}>
                    <div style={{ ...s.scoreCircle, width: '90px', height: '90px', borderColor: color, color }}>
                      <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '1.4rem', fontWeight: 900 }}>
                        {score}%
                      </div>
                      <div style={{ fontSize: '0.5rem', letterSpacing: '1px', marginTop: '2px' }}>MATCH</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '0.75rem', color: '#64748b', marginBottom: '6px' }}>
                        OVERALL SUITABILITY
                      </div>
                      <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '1.2rem', color, fontWeight: 900 }}>
                        {data.suitability}
                      </div>
                      <div style={{ color: '#475569', fontSize: '0.82rem', marginTop: '4px' }}>
                        Analyzed: {data.analyzedAt}
                      </div>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                      <button
                        onClick={() => onDownload(data.analysisId, data.fileName)}
                        style={s.btnCyan}
                        disabled={downloading === data.analysisId}>
                        {downloading === data.analysisId ? '⏳ Downloading...' : '⬇️ Download Resume'}
                      </button>
                    </div>
                  </div>

                  {/* Score breakdown panel — 4 dimension bars + radar chart */}
                  {(data.skillScore != null || data.experienceScore != null ||
                    data.projectScore != null || data.resumeQualityScore != null) && (
                    <div style={{
                      padding: '18px 20px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: '14px',
                    }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '0.65rem', color: 'white', letterSpacing: '1.5px' }}>
                          📊 SCORE BREAKDOWN
                        </span>
                        {(() => {
                          const vals = [data.skillScore, data.experienceScore, data.projectScore, data.resumeQualityScore].filter(v => v != null);
                          if (!vals.length) return null;
                          const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
                          const col = avg >= 70 ? '#10b981' : avg >= 50 ? '#f59e0b' : '#ef4444';
                          return (
                            <span style={{
                              padding: '3px 12px', borderRadius: '20px',
                              fontFamily: "'Orbitron', monospace", fontSize: '0.62rem', fontWeight: 700,
                              color: col, border: `1px solid ${col}40`, background: `${col}10`,
                            }}>
                              Avg {avg}%
                            </span>
                          );
                        })()}
                      </div>

                      {/* 2-column grid of dimension bars */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                        {[
                          { label: '⚡ Skill Match',    val: data.skillScore,         color: '#00f5ff', desc: 'JD skills covered' },
                          { label: '💼 Experience Fit', val: data.experienceScore,    color: '#a855f7', desc: 'Work history relevance' },
                          { label: '🔧 Project Depth',  val: data.projectScore,       color: '#10b981', desc: 'Project evidence & tech' },
                          { label: '📋 Resume Quality', val: data.resumeQualityScore, color: '#f59e0b', desc: 'ATS-friendliness' },
                        ].filter(d => d.val != null).map((d, i) => {
                          const pct = Math.round(d.val);
                          const barColor = pct >= 70 ? d.color : pct >= 45 ? '#f59e0b' : '#ef4444';
                          return (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <span style={{ fontSize: '0.78rem', color: '#e2e8f0', fontWeight: 600 }}>{d.label}</span>
                                <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '0.68rem', color: barColor, fontWeight: 700 }}>
                                  {pct}%
                                </span>
                              </div>
                              <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%', width: `${pct}%`,
                                  background: `linear-gradient(90deg, ${barColor}bb, ${barColor})`,
                                  borderRadius: '4px', transition: 'width 1.1s ease',
                                  boxShadow: `0 0 8px ${barColor}50`,
                                }} />
                              </div>
                              <span style={{ fontSize: '0.68rem', color: '#475569' }}>{d.desc}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* SVG Radar chart — only when all 4 scores available */}
                      {[data.skillScore, data.experienceScore, data.projectScore, data.resumeQualityScore]
                          .every(v => v != null) && (() => {
                        const scores  = [data.skillScore, data.experienceScore, data.projectScore, data.resumeQualityScore];
                        const labels  = ['Skill', 'Experience', 'Projects', 'Quality'];
                        const colors  = ['#00f5ff', '#a855f7', '#10b981', '#f59e0b'];
                        const cx = 130, cy = 100, R = 65, n = 4;
                        const step = (2 * Math.PI) / n;
                        const pt = (idx, r) => {
                          const a = step * idx - Math.PI / 2;
                          return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
                        };
                        const rings = [0.25, 0.5, 0.75, 1.0].map((lvl, li) => {
                          const pts = Array.from({ length: n }, (_, i) => pt(i, R * lvl));
                          const d   = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';
                          return <path key={li} d={d} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />;
                        });
                        const axes = Array.from({ length: n }, (_, i) => {
                          const p = pt(i, R);
                          return <line key={i} x1={cx} y1={cy} x2={p.x.toFixed(1)} y2={p.y.toFixed(1)} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />;
                        });
                        const dataPts = scores.map((s, i) => pt(i, R * Math.min(1, (s || 0) / 100)));
                        const dPath   = dataPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';
                        const dots    = dataPts.map((p, i) => (
                          <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="4"
                            fill={colors[i]} style={{ filter: `drop-shadow(0 0 5px ${colors[i]})` }} />
                        ));
                        const lbls = labels.map((lbl, i) => {
                          const p = pt(i, R + 18);
                          return (
                            <text key={i} x={p.x.toFixed(1)} y={p.y.toFixed(1)}
                              textAnchor="middle" dominantBaseline="middle"
                              style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '10px', fill: colors[i], fontWeight: 600 }}>
                              {lbl}
                            </text>
                          );
                        });
                        return (
                          <div style={{ display: 'flex', justifyContent: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                            <svg viewBox="0 0 260 200" style={{ width: '240px' }}>
                              {rings}{axes}
                              <path d={dPath} fill="rgba(0,245,255,0.08)" stroke="#00f5ff" strokeWidth="1.5"
                                style={{ filter: 'drop-shadow(0 0 8px rgba(0,245,255,0.3))' }} />
                              {dots}{lbls}
                            </svg>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Summary paragraph */}
                  {data.summary && (
                    <SummarySection title="📝 Professional Summary" color="#f59e0b">
                      <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.8, margin: 0 }}>
                        {data.summary}
                      </p>
                    </SummarySection>
                  )}

                  {/* Keywords grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {data.keywordsMatched?.length > 0 && (
                      <SummarySection title="✅ Skills & Keywords Matched" color="#10b981">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                          {data.keywordsMatched.map((kw, i) => (
                            <span key={i} style={s.kwTagGreen}>{kw}</span>
                          ))}
                        </div>
                      </SummarySection>
                    )}
                    {data.missingKeywords?.length > 0 && (
                      <SummarySection title="❌ Missing Keywords" color="#ef4444">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                          {data.missingKeywords.map((kw, i) => (
                            <span key={i} style={s.kwTagRed}>{kw}</span>
                          ))}
                        </div>
                      </SummarySection>
                    )}
                  </div>

                  {/* AI feedback */}
                  {data.feedbackPoints?.length > 0 && (
                    <SummarySection title="🤖 AI Feedback" color="#00f5ff">
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {data.feedbackPoints.map((pt, i) => (
                          <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <span style={{ color: '#00f5ff', fontWeight: 900, fontSize: '1.1rem', lineHeight: 1.4 }}>›</span>
                            <span style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.7 }}>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </SummarySection>
                  )}

                  {/* Suggestions */}
                  {data.suggestions?.length > 0 && (
                    <SummarySection title="💡 Improvement Suggestions" color="#a855f7">
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {data.suggestions.map((sg, i) => (
                          <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <span style={{ color: '#a855f7', fontWeight: 900, fontSize: '1.1rem', lineHeight: 1.4 }}>{i + 1}.</span>
                            <span style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.7 }}>{sg}</span>
                          </li>
                        ))}
                      </ul>
                    </SummarySection>
                  )}

                  {/* JD preview */}
                  {data.jobDescription && (
                    <SummarySection title="💼 Job Description Used" color="#64748b">
                      <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.7, margin: 0 }}>
                        {data.jobDescription}
                      </p>
                    </SummarySection>
                  )}
                </>
              )}

              {/* ══════════════════════════════════════
                  NEW: ATS CHARTS TAB
                  Uses existing ATSCharts component.
                  Data is adapted (arrays → comma strings)
                  to match what ATSCharts expects.
              ══════════════════════════════════════ */}
              {modalTab === 'charts' && chartResult && (
                <div>
                  {/* Score + file header so context is clear */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px',
                    padding: '16px 20px', background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
                    <div style={{ ...s.scoreCircle, width: '60px', height: '60px', borderColor: color, color, fontSize: '0.85rem' }}>
                      {score}%
                    </div>
                    <div>
                      <div style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem' }}>{data.fileName}</div>
                      <div style={{ color: color, fontFamily: "'Orbitron', monospace", fontSize: '0.7rem', marginTop: '3px' }}>
                        {data.suitability}
                      </div>
                    </div>
                  </div>
                  {/* ATSCharts component — receives adapted result object */}
                  <ATSCharts result={chartResult} />
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummarySection({ title, color, children }) {
  return (
    <div style={{ ...s.summarySection, borderLeftColor: color }}>
      <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '0.7rem', color, letterSpacing: '1px', marginBottom: '14px' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function LoadingCard({ message }) {
  return (
    <div style={{ ...s.card, textAlign: 'center', padding: '60px' }}>
      <div style={{ ...s.spinner, margin: '0 auto 16px' }} />
      <p style={{ color: '#a855f7', fontFamily: "'Orbitron', monospace", fontSize: '0.75rem' }}>{message}</p>
    </div>
  );
}



// ─────────────────────────────────────────────────────────────
//  ResultsBarChart — Feature 2
// ─────────────────────────────────────────────────────────────
function ResultsBarChart({ candidates, blindMode }) {
  if (!candidates || candidates.length === 0) return null;
  const top = [...candidates].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0)).slice(0, 10);
  const maxS = Math.max(...top.map(c => c.matchScore || 0), 1);
  const col  = (s) => s >= 80 ? '#10b981' : s >= 60 ? '#f59e0b' : s >= 40 ? '#f97316' : '#ef4444';
  return (
    <div style={{ padding:'20px 24px', marginBottom:'20px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <span style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.68rem', color:'white', letterSpacing:'1.5px' }}>📊 CANDIDATE RANKING CHART</span>
        <span style={{ fontSize:'0.75rem', color:'#475569' }}>Top {top.length}</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {top.map((c, i) => {
          const pct  = Math.round(c.matchScore || 0);
          const barC = col(pct);
          const name = blindMode
            ? `Candidate #${i+1}`
            : (c.fileName || 'Resume').replace(/\.(pdf|docx)$/i, '').replace(/[_-]/g, ' ').slice(0, 28);
          return (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.6rem', color:'#475569', width:'22px' }}>#{i+1}</span>
              <span style={{ fontSize:'0.8rem', color:'#94a3b8', width:'170px', minWidth:'170px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</span>
              <div style={{ flex:1, height:'10px', background:'rgba(255,255,255,0.05)', borderRadius:'5px', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${Math.round((pct/maxS)*100)}%`, background:barC, borderRadius:'5px', transition:'width 0.9s ease', boxShadow:`0 0 8px ${barC}40` }} />
              </div>
              <span style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.68rem', color:barC, width:'36px', textAlign:'right' }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  CompareTab — Feature 3
// ─────────────────────────────────────────────────────────────
function CompareTab({ candidates, selectedIds, onToggle, onClear, scoreColor, blindMode }) {
  const selected = candidates.filter(c => selectedIds.includes(c.analysisId));
  const dims = [
    { key:'matchScore',         label:'Overall Match', color:'#00f5ff' },
    { key:'skillScore',         label:'Skill Match',   color:'#a855f7' },
    { key:'experienceScore',    label:'Experience',    color:'#10b981' },
    { key:'projectScore',       label:'Projects',      color:'#f59e0b' },
    { key:'resumeQualityScore', label:'Quality',       color:'#f97316' },
  ];
  if (candidates.length === 0) return (
    <div style={s.emptyCard}>
      <div style={{ fontSize:'2.5rem', marginBottom:'14px' }}>⚖️</div>
      <p style={{ color:'#94a3b8' }}>No candidates yet. Analyze resumes first.</p>
    </div>
  );
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <h2 style={{ ...s.cardTitle, margin:0 }}>⚖️ Candidate Comparison ({selected.length}/3 selected)</h2>
        {selected.length > 0 && <button onClick={onClear} style={{ ...s.btnOutline, color:'#ef4444', borderColor:'rgba(239,68,68,0.3)' }}>✕ Clear</button>}
      </div>
      {/* Selector */}
      {selected.length < 3 && (
        <div style={{ marginBottom:'20px', padding:'16px 20px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'12px' }}>
          <div style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.6rem', color:'#64748b', letterSpacing:'1px', marginBottom:'12px' }}>SELECT UP TO 3 CANDIDATES</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
            {candidates.map((c, i) => {
              const isSel = selectedIds.includes(c.analysisId);
              const col   = scoreColor(c.matchScore || 0);
              const label = blindMode ? `Candidate #${i+1}` : (c.fileName||'').replace(/\.(pdf|docx)$/i,'').slice(0,22);
              return (
                <button key={i} onClick={() => onToggle(c.analysisId)} style={{
                  padding:'6px 12px', borderRadius:'8px', cursor:'pointer',
                  border:`1px solid ${isSel ? col : 'rgba(255,255,255,0.1)'}`,
                  background: isSel ? `${col}15` : 'rgba(255,255,255,0.03)',
                  color: isSel ? col : '#64748b',
                  fontFamily:"'Orbitron', monospace", fontSize:'0.6rem',
                  opacity: !isSel && selectedIds.length >= 3 ? 0.4 : 1,
                }}>
                  {isSel ? '✓ ' : ''}{label} ({Math.round(c.matchScore||0)}%)
                </button>
              );
            })}
          </div>
        </div>
      )}
      {selected.length === 0 ? (
        <div style={s.emptyCard}><p style={{ color:'#94a3b8' }}>Select candidates above to compare.</p></div>
      ) : (
        <div>
          {/* Score circles */}
          <div style={{ display:'grid', gridTemplateColumns:`repeat(${selected.length}, 1fr)`, gap:'16px', marginBottom:'20px' }}>
            {selected.map((c, i) => {
              const col  = scoreColor(c.matchScore || 0);
              const name = blindMode ? `Candidate #${selectedIds.indexOf(c.analysisId)+1}` : (c.fileName||'').replace(/\.(pdf|docx)$/i,'').slice(0,24);
              return (
                <div key={i} style={{ padding:'20px', background:'rgba(255,255,255,0.03)', border:`1px solid ${col}30`, borderRadius:'14px', textAlign:'center' }}>
                  <div style={{ ...s.scoreCircle, width:'80px', height:'80px', borderColor:col, color:col, margin:'0 auto 14px', fontSize:'0.9rem' }}>
                    {Math.round(c.matchScore||0)}%
                  </div>
                  <div style={{ fontSize:'0.82rem', color:'#94a3b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
                  <span style={{ fontSize:'0.7rem', color:col, fontFamily:"'Orbitron', monospace", fontWeight:700 }}>
                    {c.matchScore>=80?'Excellent':c.matchScore>=60?'Good':c.matchScore>=40?'Fair':'Low'}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Dimension bars */}
          <div style={{ padding:'20px 24px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px', marginBottom:'20px' }}>
            <div style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.65rem', color:'white', letterSpacing:'1.5px', marginBottom:'18px' }}>📊 DIMENSION COMPARISON</div>
            {dims.map((d, di) => {
              const vals = selected.map(c => c[d.key]);
              if (vals.every(v => v == null)) return null;
              return (
                <div key={di} style={{ marginBottom:'14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                    <span style={{ fontSize:'0.8rem', color:'#94a3b8' }}>{d.label}</span>
                    <div style={{ display:'flex', gap:'12px' }}>
                      {selected.map((c,ci) => <span key={ci} style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.65rem', color:d.color, fontWeight:700 }}>{c[d.key]!=null?Math.round(c[d.key])+'%':'—'}</span>)}
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:`repeat(${selected.length}, 1fr)`, gap:'6px' }}>
                    {selected.map((c,ci) => {
                      const pct = c[d.key] != null ? Math.round(c[d.key]) : 0;
                      return (
                        <div key={ci} style={{ height:'8px', background:'rgba(255,255,255,0.05)', borderRadius:'4px', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background:d.color, borderRadius:'4px', transition:'width 0.9s ease' }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Keywords */}
          {!blindMode && (
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${selected.length}, 1fr)`, gap:'16px' }}>
              {selected.map((c, i) => {
                const matched = (c.keywordsMatched||'').split(',').filter(Boolean);
                const missing = (c.missingKeywords||'').split(',').filter(Boolean);
                return (
                  <div key={i} style={{ padding:'16px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'12px' }}>
                    <div style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.58rem', color:'#10b981', marginBottom:'8px' }}>✅ MATCHED ({matched.length})</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginBottom:'12px' }}>
                      {matched.slice(0,6).map((kw,j) => <span key={j} style={{ padding:'2px 8px', background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:'10px', color:'#10b981', fontSize:'0.7rem' }}>{kw.trim()}</span>)}
                    </div>
                    <div style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.58rem', color:'#ef4444', marginBottom:'8px' }}>❌ MISSING ({missing.length})</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                      {missing.slice(0,4).map((kw,j) => <span key={j} style={{ padding:'2px 8px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'10px', color:'#ef4444', fontSize:'0.7rem' }}>{kw.trim()}</span>)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  DashboardTab — Feature 4
// ─────────────────────────────────────────────────────────────
function DashboardTab({ candidates, accepted, scoreColor }) {
  const total     = candidates.length;
  const avgScore  = total ? Math.round(candidates.reduce((a,c) => a+(c.matchScore||0),0)/total) : 0;
  const strong    = candidates.filter(c => (c.matchScore||0) >= 70).length;
  const accCount  = candidates.filter(c => c.decision === 'ACCEPTED').length;
  const rejCount  = candidates.filter(c => c.decision === 'REJECTED').length;
  const bands = [
    { label:'80–100', color:'#10b981', count: candidates.filter(c=>(c.matchScore||0)>=80).length },
    { label:'60–79',  color:'#f59e0b', count: candidates.filter(c=>(c.matchScore||0)>=60&&(c.matchScore||0)<80).length },
    { label:'40–59',  color:'#f97316', count: candidates.filter(c=>(c.matchScore||0)>=40&&(c.matchScore||0)<60).length },
    { label:'0–39',   color:'#ef4444', count: candidates.filter(c=>(c.matchScore||0)<40).length },
  ];
  const maxBand = Math.max(...bands.map(b=>b.count),1);
  const kpis = [
    { icon:'👥', label:'Total Analyzed',   value:total,                   color:'white'   },
    { icon:'📊', label:'Avg Match Score',  value:total?`${avgScore}%`:'—', color:'#00f5ff' },
    { icon:'⭐', label:'Strong Fits ≥70%', value:strong,                  color:'#10b981' },
    { icon:'✅', label:'Accepted',         value:accCount,                color:'#a855f7' },
    { icon:'❌', label:'Rejected',         value:rejCount,                color:'#ef4444' },
    { icon:'⏳', label:'Pending',          value:total-accCount-rejCount, color:'#f59e0b' },
  ];
  return (
    <div>
      <h2 style={{ ...s.cardTitle, marginBottom:'20px' }}>🏠 Recruiter Dashboard</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:'14px', marginBottom:'24px' }}>
        {kpis.map((k,i) => (
          <div key={i} style={{ padding:'18px 16px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'14px', textAlign:'center' }}>
            <div style={{ fontSize:'1.5rem', marginBottom:'8px' }}>{k.icon}</div>
            <div style={{ fontFamily:"'Orbitron', monospace", fontSize:'1.4rem', fontWeight:900, color:k.color, marginBottom:'4px' }}>{k.value}</div>
            <div style={{ fontSize:'0.72rem', color:'#64748b' }}>{k.label}</div>
          </div>
        ))}
      </div>
      {total===0 ? (
        <div style={s.emptyCard}><div style={{ fontSize:'2.5rem', marginBottom:'14px' }}>🏠</div><p style={{ color:'#94a3b8' }}>No data yet. Analyze resumes to populate the dashboard.</p></div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
          {/* Score histogram */}
          <div style={{ padding:'20px 24px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px' }}>
            <div style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.65rem', color:'white', letterSpacing:'1.5px', marginBottom:'20px' }}>📊 SCORE DISTRIBUTION</div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:'16px', height:'120px', paddingBottom:'8px' }}>
              {bands.map((b,i) => {
                const h = Math.round((b.count/maxBand)*100);
                return (
                  <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', gap:'6px', height:'100%' }}>
                    <span style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.75rem', fontWeight:900, color:b.color }}>{b.count}</span>
                    <div style={{ width:'100%', height:`${h}%`, minHeight:b.count>0?'4px':'0', background:`${b.color}25`, border:`1px solid ${b.color}50`, borderRadius:'4px 4px 0 0', transition:'height 0.8s ease' }} />
                    <span style={{ color:'#64748b', fontSize:'0.65rem' }}>{b.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Shortlist funnel */}
          <div style={{ padding:'20px 24px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px' }}>
            <div style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.65rem', color:'white', letterSpacing:'1.5px', marginBottom:'20px' }}>🔽 SHORTLIST FUNNEL</div>
            {[
              { label:'Total Resumes',    val:total,    color:'#00f5ff', pct:100 },
              { label:'Strong Fits ≥70%', val:strong,   color:'#a855f7', pct:total?Math.round((strong/total)*100):0 },
              { label:'Accepted',         val:accCount, color:'#10b981', pct:total?Math.round((accCount/total)*100):0 },
            ].map((row,i) => (
              <div key={i} style={{ marginBottom:'14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
                  <span style={{ fontSize:'0.82rem', color:'#94a3b8' }}>{row.label}</span>
                  <span style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.68rem', color:row.color, fontWeight:700 }}>
                    {row.val} <span style={{ color:'#475569' }}>({row.pct}%)</span>
                  </span>
                </div>
                <div style={{ height:'8px', background:'rgba(255,255,255,0.05)', borderRadius:'4px', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${row.pct}%`, background:row.color, borderRadius:'4px', transition:'width 1s ease', boxShadow:`0 0 8px ${row.color}40` }} />
                </div>
              </div>
            ))}
          </div>
          {/* Top 5 */}
          <div style={{ padding:'20px 24px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px', gridColumn:'1 / -1' }}>
            <div style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.65rem', color:'white', letterSpacing:'1.5px', marginBottom:'16px' }}>🏆 TOP CANDIDATES</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {[...candidates].sort((a,b)=>(b.matchScore||0)-(a.matchScore||0)).slice(0,5).map((c,i) => {
                const col = scoreColor(c.matchScore||0);
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 14px', background:'rgba(255,255,255,0.02)', borderRadius:'10px' }}>
                    <span style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.65rem', color:'#475569', width:'24px' }}>#{i+1}</span>
                    <span style={{ flex:1, fontSize:'0.85rem', color:'#e2e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      📄 {(c.fileName||'').replace(/\.(pdf|docx)$/i,'')}
                    </span>
                    <div style={{ width:'120px', height:'6px', background:'rgba(255,255,255,0.05)', borderRadius:'3px', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${c.matchScore||0}%`, background:col, borderRadius:'3px' }} />
                    </div>
                    <span style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.7rem', color:col, fontWeight:700, width:'36px', textAlign:'right' }}>{Math.round(c.matchScore||0)}%</span>
                    <span style={{ fontSize:'0.72rem', padding:'2px 8px', borderRadius:'10px',
                      background: c.decision==='ACCEPTED'?'rgba(16,185,129,0.1)':c.decision==='REJECTED'?'rgba(239,68,68,0.1)':'rgba(100,116,139,0.1)',
                      color: c.decision==='ACCEPTED'?'#10b981':c.decision==='REJECTED'?'#ef4444':'#64748b',
                    }}>{c.decision||'PENDING'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  SettingsTab — Feature 5
// ─────────────────────────────────────────────────────────────
function SettingsTab({ weights, onUpdateWeight, roleTemplate, onRoleTemplate, fresherMode, onFresherMode }) {
  const total = Object.values(weights).reduce((a,b)=>a+b,0);
  const wDims = [
    { key:'skill',      label:'Skill Match',         color:'#00f5ff', desc:'Keyword & semantic skill coverage' },
    { key:'experience', label:'Experience Fit',       color:'#a855f7', desc:'Work history relevance to role' },
    { key:'project',    label:'Project Depth',        color:'#10b981', desc:'Project evidence & tech overlap' },
    { key:'quality',    label:'Resume Quality',       color:'#f59e0b', desc:'ATS-friendliness & structure' },
    { key:'potential',  label:'Candidate Potential',  color:'#f97316', desc:'Fresher potential & growth signals' },
  ];
  const templates = [
    { id:'general',   label:'General'           },
    { id:'fresher',   label:'Fresher / Intern'  },
    { id:'java',      label:'Java Backend'      },
    { id:'frontend',  label:'Frontend Dev'      },
    { id:'fullstack', label:'Full Stack'        },
    { id:'data',      label:'Data Analyst'      },
    { id:'ml',        label:'ML / Data Science' },
    { id:'devops',    label:'DevOps / Cloud'    },
  ];
  const tplWeights = {
    general:  {skill:40,experience:20,project:20,quality:10,potential:10},
    fresher:  {skill:30,experience:5, project:30,quality:10,potential:25},
    java:     {skill:45,experience:25,project:15,quality:10,potential:5 },
    frontend: {skill:40,experience:20,project:25,quality:10,potential:5 },
    fullstack:{skill:40,experience:20,project:25,quality:10,potential:5 },
    data:     {skill:40,experience:20,project:20,quality:10,potential:10},
    ml:       {skill:35,experience:15,project:30,quality:10,potential:10},
    devops:   {skill:45,experience:25,project:15,quality:10,potential:5 },
  };
  const applyTemplate = (id) => {
    onRoleTemplate(id);
    const w = tplWeights[id];
    if (w) Object.entries(w).forEach(([k,v]) => onUpdateWeight(k,v));
    onFresherMode(id === 'fresher');
  };
  return (
    <div>
      <h2 style={{ ...s.cardTitle, marginBottom:'24px' }}>⚙️ Scoring Configuration</h2>
      {/* Template picker */}
      <div style={{ padding:'20px 24px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px', marginBottom:'20px' }}>
        <div style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.65rem', color:'white', letterSpacing:'1.5px', marginBottom:'10px' }}>🎯 ROLE TEMPLATE</div>
        <p style={{ color:'#64748b', fontSize:'0.83rem', marginBottom:'14px' }}>Auto-sets recommended weights for the role type.</p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
          {templates.map(t => (
            <button key={t.id} onClick={() => applyTemplate(t.id)} style={{
              padding:'8px 16px', borderRadius:'8px', cursor:'pointer',
              fontFamily:"'Orbitron', monospace", fontSize:'0.62rem',
              background: roleTemplate===t.id ? 'rgba(0,245,255,0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${roleTemplate===t.id ? 'rgba(0,245,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
              color: roleTemplate===t.id ? '#00f5ff' : '#64748b',
            }}>{t.label}</button>
          ))}
        </div>
      </div>
      {/* Fresher mode */}
      <div style={{ padding:'18px 24px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px', marginBottom:'20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.65rem', color:'white', letterSpacing:'1px', marginBottom:'4px' }}>🎓 FRESHER-FIRST MODE</div>
          <p style={{ color:'#64748b', fontSize:'0.82rem', margin:0 }}>Boosts project & potential weight. Reduces experience penalty for 0–2 year candidates.</p>
        </div>
        <button onClick={() => onFresherMode(m => !m)} style={{
          padding:'10px 20px', borderRadius:'10px', cursor:'pointer',
          fontFamily:"'Orbitron', monospace", fontSize:'0.65rem', fontWeight:700,
          background: fresherMode ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${fresherMode ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`,
          color: fresherMode ? '#10b981' : '#64748b',
        }}>{fresherMode ? '✓ ON' : 'OFF'}</button>
      </div>
      {/* Weight sliders */}
      <div style={{ padding:'20px 24px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.65rem', color:'white', letterSpacing:'1.5px' }}>⚖️ SCORING WEIGHTS</div>
          <span style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.65rem', fontWeight:700, color:total===100?'#10b981':'#ef4444' }}>
            Total: {total}% {total!==100 ? '← adjust to 100%' : '✓'}
          </span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
          {wDims.map(d => (
            <div key={d.key}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                <div>
                  <span style={{ fontSize:'0.88rem', color:'#e2e8f0', fontWeight:600 }}>{d.label}</span>
                  <span style={{ fontSize:'0.72rem', color:'#475569', marginLeft:'8px' }}>{d.desc}</span>
                </div>
                <span style={{ fontFamily:"'Orbitron', monospace", fontSize:'0.78rem', color:d.color, fontWeight:700, minWidth:'40px', textAlign:'right' }}>{weights[d.key]}%</span>
              </div>
              <input type="range" min="0" max="60" step="5" value={weights[d.key]}
                onChange={e => onUpdateWeight(d.key, e.target.value)}
                style={{ width:'100%', accentColor:d.color }} />
              <div style={{ height:'4px', background:'rgba(255,255,255,0.05)', borderRadius:'2px', overflow:'hidden', marginTop:'4px' }}>
                <div style={{ height:'100%', width:`${(weights[d.key]/60)*100}%`, background:d.color, borderRadius:'2px', transition:'width 0.3s ease' }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:'20px', padding:'12px 16px', background:'rgba(0,245,255,0.04)', border:'1px solid rgba(0,245,255,0.1)', borderRadius:'10px' }}>
          <p style={{ color:'#64748b', fontSize:'0.82rem', margin:0 }}>
            💡 <strong style={{ color:'#00f5ff' }}>MVP note:</strong> These weights are shown for configuration. In the full version they will be passed with each analysis to adjust scoring dynamically.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  STYLES  (all existing styles unchanged + new additions)
// ─────────────────────────────────────────────────────────────
const s = {
  // ── Layout ────────────────────────────────────────────────
  page: {
    minHeight: '100vh', background: '#050510',
    fontFamily: "'Rajdhani', sans-serif", position: 'relative',
  },
  orb: {
    position: 'fixed', top: '10%', left: '5%',
    width: '400px', height: '400px',
    background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)',
    borderRadius: '50%', pointerEvents: 'none',
  },
  orbTwo: {
    position: 'fixed', bottom: '10%', right: '5%',
    width: '350px', height: '350px',
    background: 'radial-gradient(circle, rgba(0,245,255,0.04) 0%, transparent 70%)',
    borderRadius: '50%', pointerEvents: 'none',
  },
  container: {
    position: 'relative', zIndex: 2,
    maxWidth: '1100px', margin: '0 auto',
    padding: '120px 24px 80px',
  },
  header: { textAlign: 'center', marginBottom: '36px' },
  badge: {
    display: 'inline-block', padding: '6px 18px',
    background: 'rgba(168,85,247,0.1)',
    border: '1px solid rgba(168,85,247,0.3)',
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

  // ── Tabs ──────────────────────────────────────────────────
  tabs: {
    display: 'flex', gap: '4px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px', padding: '5px',
    marginBottom: '28px', flexWrap: 'wrap',
  },
  tab: {
    flex: 1, minWidth: '120px', padding: '11px 14px',
    background: 'transparent', border: 'none',
    borderRadius: '10px', color: '#64748b',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.65rem', letterSpacing: '1px',
    cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
  },
  tabActive: {
    background: 'rgba(168,85,247,0.12)', color: '#a855f7',
    boxShadow: 'inset 0 0 0 1px rgba(168,85,247,0.25)',
  },

  errorBox: {
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: '12px', padding: '14px 20px',
    color: '#ef4444', marginBottom: '24px',
  },

  // ── Cards ─────────────────────────────────────────────────
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(168,85,247,0.12)',
    borderRadius: '20px', padding: '40px',
  },
  cardTitle: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1rem', fontWeight: '700',
    color: 'white', marginBottom: '24px',
  },

  // ── Upload form ───────────────────────────────────────────
  field: { marginBottom: '24px' },
  label: {
    display: 'block', fontFamily: "'Orbitron', monospace",
    fontSize: '0.65rem', color: '#a855f7',
    letterSpacing: '2px', marginBottom: '10px',
  },
  fileInputRow: { display: 'flex', alignItems: 'center', gap: '16px' },
  fileBtn: {
    padding: '10px 20px',
    background: 'rgba(168,85,247,0.1)',
    border: '1px solid rgba(168,85,247,0.3)',
    borderRadius: '8px', color: '#a855f7',
    cursor: 'pointer', fontFamily: "'Orbitron', monospace",
    fontSize: '0.7rem', letterSpacing: '1px',
  },
  fileList: { marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' },
  fileItem: {
    padding: '8px 14px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '8px', color: '#94a3b8',
    fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between',
  },
  textarea: {
    width: '100%', padding: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px', color: 'white',
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: '0.95rem', lineHeight: 1.7,
    outline: 'none', resize: 'vertical', boxSizing: 'border-box',
  },

  // ── Buttons ───────────────────────────────────────────────
  btnPurple: {
    width: '100%', padding: '15px',
    background: 'linear-gradient(135deg, #a855f7, #6366f1)',
    border: 'none', borderRadius: '12px',
    color: 'white', fontFamily: "'Orbitron', monospace",
    fontSize: '0.78rem', fontWeight: '700',
    cursor: 'pointer', letterSpacing: '2px',
  },
  btnCyan: {
    padding: '12px 20px',
    background: 'rgba(0,245,255,0.1)',
    border: '1px solid rgba(0,245,255,0.3)',
    borderRadius: '10px', color: '#00f5ff',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.68rem', fontWeight: '700',
    cursor: 'pointer', letterSpacing: '1px', whiteSpace: 'nowrap',
  },
  btnOutline: {
    padding: '10px 18px', background: 'transparent',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px', color: '#94a3b8',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.65rem', cursor: 'pointer', letterSpacing: '1px',
  },
  btnAction: {
    flex: 1, padding: '9px 10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', color: '#94a3b8',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.6rem', cursor: 'pointer', letterSpacing: '0.5px',
    transition: 'all 0.2s',
  },
  btnActionSm: {
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', color: '#94a3b8',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.58rem', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  btnDecision: {
    flex: 1, padding: '9px',
    border: '1px solid', borderRadius: '8px',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.6rem', fontWeight: '700',
    cursor: 'pointer', letterSpacing: '1px',
    transition: 'all 0.2s',
  },
  btnZip: {
    padding: '12px 22px',
    background: 'rgba(168,85,247,0.12)',
    border: '1px solid rgba(168,85,247,0.3)',
    borderRadius: '10px', color: '#a855f7',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.68rem', fontWeight: '700',
    cursor: 'pointer', letterSpacing: '1px', whiteSpace: 'nowrap',
  },
  btnZipSuccess: {
    background: 'rgba(16,185,129,0.12)',
    border: '1px solid rgba(16,185,129,0.3)',
    color: '#10b981',
  },
  // ── NEW button styles ──────────────────────────────────────
  btnRemove: {
    padding: '8px 14px',
    background: 'rgba(249,115,22,0.08)',
    border: '1px solid rgba(249,115,22,0.3)',
    borderRadius: '8px', color: '#f97316',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.58rem', fontWeight: '700',
    cursor: 'pointer', whiteSpace: 'nowrap',
    transition: 'all 0.2s',
  },
  btnDanger: {
    padding: '10px 18px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '10px', color: '#ef4444',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.65rem', fontWeight: '700',
    cursor: 'pointer', letterSpacing: '1px', whiteSpace: 'nowrap',
  },

  // ── Loading ───────────────────────────────────────────────
  loadingBox: { textAlign: 'center', padding: '30px', marginTop: '20px' },
  spinner: {
    width: '44px', height: '44px',
    border: '3px solid rgba(168,85,247,0.1)',
    borderTop: '3px solid #a855f7',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },

  // ── Results controls ──────────────────────────────────────
  controlsRow: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', flexWrap: 'wrap',
    gap: '16px', marginBottom: '24px',
  },
  statsRow: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  statBox: {
    padding: '12px 18px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  statNum: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1.3rem', fontWeight: '900', color: 'white',
  },
  statLbl: { color: '#64748b', fontSize: '0.72rem', marginTop: '2px' },

  // ── Candidate cards ───────────────────────────────────────
  candidateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '18px',
  },
  candidateCard: {
    padding: '24px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid', borderRadius: '16px',
    display: 'flex', flexDirection: 'column', gap: '14px',
    transition: 'border-color 0.2s',
  },
  rankBadge: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.65rem', color: '#475569',
  },
  scoreCircle: {
    width: '74px', height: '74px', minWidth: '74px',
    borderRadius: '50%', border: '3px solid',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.3s',
  },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  kwTag: {
    padding: '3px 10px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px', color: '#94a3b8', fontSize: '0.75rem',
  },
  kwTagGreen: {
    padding: '3px 10px',
    background: 'rgba(16,185,129,0.08)',
    border: '1px solid rgba(16,185,129,0.25)',
    borderRadius: '12px', color: '#10b981', fontSize: '0.75rem',
  },
  kwTagRed: {
    padding: '3px 10px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: '12px', color: '#ef4444', fontSize: '0.75rem',
  },
  decisionPill: {
    padding: '4px 10px', border: '1px solid',
    borderRadius: '20px', fontFamily: "'Orbitron', monospace",
    fontSize: '0.6rem', fontWeight: '700', letterSpacing: '1px',
  },

  // ── Accepted tab ──────────────────────────────────────────
  zipInfoBox: {
    padding: '12px 20px', marginBottom: '20px',
    background: 'rgba(168,85,247,0.06)',
    border: '1px solid rgba(168,85,247,0.15)',
    borderRadius: '10px',
    display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap',
    fontFamily: "'Rajdhani', sans-serif", fontSize: '0.9rem',
  },
  acceptedList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  acceptedRow: {
    padding: '18px 20px',
    background: 'rgba(16,185,129,0.04)',
    border: '1px solid rgba(16,185,129,0.12)',
    borderRadius: '14px',
    display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
  },
  acceptedRank: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.7rem', color: '#10b981', minWidth: '28px',
  },
  acceptedScore: {
    width: '52px', height: '52px', minWidth: '52px',
    borderRadius: '50%', border: '2px solid',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Orbitron', monospace", fontSize: '0.78rem', fontWeight: 900,
  },

  // ── History tab ───────────────────────────────────────────
  historyRow: {
    padding: '16px 18px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '14px',
    transition: 'all 0.2s',
  },
  historyRowActive: {
    border: '1px solid rgba(0,245,255,0.2)',
    background: 'rgba(0,245,255,0.03)',
  },
  historyScore: {
    width: '48px', height: '48px', minWidth: '48px',
    borderRadius: '50%', border: '2px solid',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Orbitron', monospace", fontSize: '0.72rem', fontWeight: 900,
  },
  detailSection: {
    padding: '16px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '12px', marginBottom: '12px',
  },
  detailLabel: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.65rem', letterSpacing: '1px', marginBottom: '10px',
  },

  // ── Empty states ──────────────────────────────────────────
  emptyCard: {
    padding: '60px', textAlign: 'center',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '16px',
  },

  // ── Summary Modal ──────────────────────────────────────────
  modalOverlay: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '40px 20px',
    overflowY: 'auto',
  },
  modalBox: {
    width: '100%', maxWidth: '780px',
    background: '#0a0a1a',
    border: '1px solid rgba(168,85,247,0.25)',
    borderRadius: '20px', overflow: 'hidden',
    boxShadow: '0 0 80px rgba(168,85,247,0.15)',
  },
  modalHeader: {
    padding: '28px 32px',
    background: 'rgba(168,85,247,0.06)',
    borderBottom: '1px solid rgba(168,85,247,0.15)',
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: '16px',
  },
  // ── NEW: modal tab bar ─────────────────────────────────────
  modalTabRow: {
    display: 'flex', gap: '0',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    padding: '0 32px',
    background: 'rgba(255,255,255,0.01)',
  },
  modalTabBtn: {
    padding: '14px 24px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#64748b',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.65rem', letterSpacing: '1px',
    cursor: 'pointer', transition: 'all 0.2s',
    marginBottom: '-1px',
  },
  modalTabBtnActive: {
    color: '#a855f7',
    borderBottomColor: '#a855f7',
  },
  modalBody: {
    padding: '28px 32px',
    display: 'flex', flexDirection: 'column', gap: '16px',
    maxHeight: '70vh', overflowY: 'auto',
  },
  summaryScoreRow: {
    display: 'flex', gap: '20px', alignItems: 'center',
    padding: '20px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '14px', flexWrap: 'wrap',
  },
  summarySection: {
    padding: '18px',
    background: 'rgba(255,255,255,0.02)',
    borderLeft: '3px solid',
    borderRadius: '0 12px 12px 0',
  },
};

// ── Confirmation Dialog styles ──────────────────────────────
const dlg = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 2000,
    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px',
  },
  box: {
    width: '100%', maxWidth: '420px',
    background: '#0a0a1f',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '20px', padding: '36px 32px',
    textAlign: 'center',
    boxShadow: '0 0 60px rgba(239,68,68,0.1)',
  },
  iconRing: {
    width: '64px', height: '64px', borderRadius: '50%',
    background: 'rgba(239,68,68,0.1)',
    border: '2px solid rgba(239,68,68,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 18px',
  },
  title: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1.1rem', fontWeight: '900',
    color: 'white', marginBottom: '12px',
  },
  message: {
    color: '#94a3b8', fontSize: '0.92rem',
    lineHeight: 1.7, marginBottom: '24px',
  },
  btnRow: { display: 'flex', gap: '12px' },
  btnCancel: {
    flex: 1, padding: '13px', background: 'transparent',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px', color: '#94a3b8',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.68rem', cursor: 'pointer',
  },
  btnConfirm: {
    flex: 1, padding: '13px', border: 'none',
    borderRadius: '10px', color: 'white',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.68rem', fontWeight: '700', cursor: 'pointer',
  },
};
