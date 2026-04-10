// src/pages/CandidatePortal.jsx
import { useState, useRef, useEffect } from 'react';
import Navbar from '../components/Navbar';
import ScoreCard from '../components/ScoreCard';
import WhatIfSimulator from '../components/WhatIfSimulator';
import {
  uploadResume, analyzeResume, getAuthData,
  downloadAnalysisReport, generateImprovedResume,
  getAnalysisHistory, triggerBlobDownload, compareRoles,
} from '../services/api';

// ─────────────────────────────────────────────────────────
//  CandidatePortal
//
//  Three main tabs:
//    1. Analyze   — upload resume, paste JD, view AI results
//                   + Download Report button
//                   + Generate Improved Resume button
//    2. Improve   — AI-improved resume preview & download
//    3. History   — list of past analyses
// ─────────────────────────────────────────────────────────
export default function CandidatePortal() {
  const { userId, userName } = getAuthData();

  // ── Tab state ──────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('analyze');

  // ── Analysis flow state ────────────────────────────────
  const [file, setFile]         = useState(null);
  const [jd, setJd]             = useState('');
  const [step, setStep]         = useState('upload'); // upload | analyze | results
  const [resumeId, setResumeId] = useState(null);
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const fileRef = useRef();

  // ── Report download state ──────────────────────────────
  const [reportLoading, setReportLoading]   = useState(false);
  const [reportSuccess, setReportSuccess]   = useState(false);

  // ── Improved resume state ──────────────────────────────
  const [improveLoading, setImproveLoading] = useState(false);
  const [improvePreview, setImprovePreview] = useState(null); // structured data from ML
  const [improveStep, setImproveStep]       = useState('idle'); // idle | generating | preview

  // ── History state ──────────────────────────────────────
  const [history, setHistory]         = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);

  // Load history when tab becomes active
  useEffect(() => {
    if (activeTab === 'history' && userId) {
      fetchHistory();
    }
  }, [activeTab]);

  // ── Fetch history ──────────────────────────────────────
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await getAnalysisHistory(userId);
      setHistory(res.data || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── File handling ──────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };
  const handleDragOver = (e) => e.preventDefault();

  // ── Upload resume ──────────────────────────────────────
  const handleUpload = async () => {
    if (!file) return setError('Please select a resume file first!');
    setLoading(true); setError('');
    try {
      const res = await uploadResume(file, userId);
      setResumeId(res.data.resumeId);
      setStep('analyze');
    } catch {
      setError('Upload failed. Make sure the backend is running!');
    } finally {
      setLoading(false);
    }
  };

  // ── Analyze resume ─────────────────────────────────────
  const handleAnalyze = async () => {
    if (!jd.trim()) return setError('Please paste the job description!');
    setLoading(true); setError('');
    try {
      const res = await analyzeResume(resumeId, jd);
      setResult(res.data);
      setStep('results');
      setImproveStep('idle'); // reset improve state
      setImprovePreview(null);
    } catch {
      setError('Analysis failed. Make sure the ML service is running!');
    } finally {
      setLoading(false);
    }
  };

  // ── Download PDF report ────────────────────────────────
  const handleDownloadReport = async () => {
    if (!result?.analysisId) return;
    setReportLoading(true); setReportSuccess(false);
    try {
      const res = await downloadAnalysisReport(result.analysisId);
      const fileName = `resume_analysis_report_${result.analysisId}.pdf`;
      triggerBlobDownload(res.data, fileName);
      setReportSuccess(true);
      setTimeout(() => setReportSuccess(false), 3000);
    } catch {
      setError('Failed to download report. Please try again.');
    } finally {
      setReportLoading(false);
    }
  };

  // ── Generate AI-improved resume ────────────────────────
  const handleGenerateImproved = async () => {
    if (!resumeId) return;
    setImproveLoading(true); setImproveStep('generating'); setError('');
    try {
      // Switch to the improve tab for the preview experience
      setActiveTab('improve');
      const res = await generateImprovedResume(resumeId, jd, result?.analysisId);

      // res.data is a blob (DOCX). We store it to trigger download.
      // We also synthesise a preview object from the existing result.
      setImprovePreview({
        blob: res.data,
        fileName: `improved_resume_${file?.name?.replace(/\.(pdf|docx)$/i, '') || 'resume'}.docx`,
        analysisContext: result,
      });
      setImproveStep('preview');
    } catch {
      setError('Failed to generate improved resume. Please try again.');
      setImproveStep('idle');
    } finally {
      setImproveLoading(false);
    }
  };

  // ── Download improved resume ───────────────────────────
  const handleDownloadImproved = () => {
    if (!improvePreview?.blob) return;
    triggerBlobDownload(improvePreview.blob, improvePreview.fileName);
  };

  // ── Reset all ──────────────────────────────────────────
  const reset = () => {
    setFile(null); setJd(''); setStep('upload');
    setResumeId(null); setResult(null); setError('');
    setImproveStep('idle'); setImprovePreview(null);
    setReportSuccess(false);
  };

  // ═══════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <div style={s.page}>
      <Navbar />
      <div style={s.orb} />
      <div style={s.orbTwo} />

      <div style={s.container}>

        {/* ── Page header ───────────────────────────── */}
        <div style={s.header}>
          <div style={s.badge}>👤 CANDIDATE PORTAL</div>
          <h1 style={s.title}>
            Hey <span style={s.neon}>{userName || 'there'}</span>,<br />
            Your resume command centre
          </h1>
          <p style={s.subtitle}>
            Analyze, optimize, and download — everything you need to land the job
          </p>
        </div>

        {/* ── Tab navigation ────────────────────────── */}
        <div style={s.tabs}>
          {[
            { id: 'analyze', label: '🔍 Analyze'   },
            { id: 'improve', label: '✨ AI Improve' },
            { id: 'whatif',  label: '🎯 What-If'   },
            { id: 'history', label: '📂 History'   },
          ].map(tab => (
            <button
              key={tab.id}
              style={{ ...s.tab, ...(activeTab === tab.id ? s.tabActive : {}) }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Error banner ──────────────────────────── */}
        {error && <div style={s.errorBox}>⚠️ {error}</div>}

        {/* ═══════════════════════════════════════════
            TAB: ANALYZE
        ═══════════════════════════════════════════ */}
        {activeTab === 'analyze' && (
          <>
            {/* Step indicator */}
            <div style={s.stepIndicator}>
              {['Upload Resume', 'Add Job Description', 'View Results'].map((label, i) => {
                const stepKeys = ['upload', 'analyze', 'results'];
                const isActive = stepKeys.indexOf(step) >= i;
                return (
                  <div key={i} style={s.stepItem}>
                    <div style={{ ...s.stepCircle, ...(isActive ? s.stepCircleActive : {}) }}>
                      {i + 1}
                    </div>
                    <span style={{ ...s.stepLabel, ...(isActive ? { color: '#00f5ff' } : {}) }}>
                      {label}
                    </span>
                    {i < 2 && <div style={{ ...s.stepLine, ...(isActive ? s.stepLineActive : {}) }} />}
                  </div>
                );
              })}
            </div>

            {/* STEP 1: Upload */}
            {step === 'upload' && (
              <div style={s.card}>
                <h2 style={s.cardTitle}>📤 Upload Your Resume</h2>
                <p style={s.cardDesc}>Supported formats: PDF, DOCX (max 15MB)</p>

                <div
                  style={{ ...s.dropZone, ...(file ? s.dropZoneActive : {}) }}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileRef.current.click()}
                >
                  <input ref={fileRef} type="file" accept=".pdf,.docx"
                    style={{ display: 'none' }}
                    onChange={(e) => setFile(e.target.files[0])} />
                  {file ? (
                    <div>
                      <div style={{ fontSize: '3rem', marginBottom: '10px' }}>✅</div>
                      <div style={s.fileName}>{file.name}</div>
                      <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>📄</div>
                      <div style={s.dropText}>Drag & drop your resume here</div>
                      <div style={{ color: '#64748b', fontSize: '0.9rem' }}>or click to browse files</div>
                    </div>
                  )}
                </div>

                <button onClick={handleUpload} style={s.btn} disabled={loading || !file}>
                  {loading ? '⏳ Uploading...' : '🚀 Upload Resume'}
                </button>
              </div>
            )}

            {/* STEP 2: Job description */}
            {step === 'analyze' && (
              <div style={s.card}>
                <h2 style={s.cardTitle}>📋 Paste Job Description</h2>
                <p style={s.cardDesc}>
                  ✅ Resume uploaded: <strong style={{ color: '#10b981' }}>{file?.name}</strong>
                </p>

                <textarea
                  style={s.textarea}
                  placeholder="Paste the full job description here..."
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  rows={12}
                />

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setStep('upload')} style={s.btnOutline}>← Back</button>
                  <button onClick={handleAnalyze} style={s.btn} disabled={loading || !jd.trim()}>
                    {loading ? '🧠 Analyzing...' : '🤖 Analyze Now'}
                  </button>
                </div>

                {loading && <LoadingBox message="AI is analyzing your resume..." sub="Extracting keywords • Calculating match score • Generating feedback" />}
              </div>
            )}

            {/* STEP 3: Results */}
            {step === 'results' && result && (
              <div>
                {/* Results header + action buttons */}
                <div style={s.resultHeader}>
                  <h2 style={s.cardTitle}>📊 Your Analysis Results</h2>
                  <button onClick={reset} style={s.btnOutline}>🔄 Analyze Another</button>
                </div>

                {/* ── Action bar: Download Report + Generate Improved ── */}
                <div style={s.actionBar}>

                  {/* Download Report */}
                  <button
                    onClick={handleDownloadReport}
                    style={{ ...s.actionBtn, ...(reportSuccess ? s.actionBtnSuccess : {}) }}
                    disabled={reportLoading || !result.analysisId}
                  >
                    {reportLoading
                      ? <><Spinner small /> Generating PDF...</>
                      : reportSuccess
                      ? '✅ Report Downloaded!'
                      : '📄 Download Analysis Report'}
                  </button>

                  {/* Generate Improved Resume */}
                  <button
                    onClick={handleGenerateImproved}
                    style={s.actionBtnPurple}
                    disabled={improveLoading}
                  >
                    {improveLoading
                      ? <><Spinner small color="#a855f7" /> Generating Resume...</>
                      : '✨ Generate Improved Resume'}
                  </button>
                </div>

                {/* Report tip */}
                <p style={s.actionTip}>
                  💡 Download your analysis report as PDF · Use AI to generate an ATS-optimized resume
                </p>

                {/* ScoreCard */}
                <div style={s.card}>
                  <ScoreCard result={result} />
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════
            TAB: AI IMPROVE
        ═══════════════════════════════════════════ */}
        {activeTab === 'improve' && (
          <ImproveTab
            improveStep={improveStep}
            improvePreview={improvePreview}
            improveLoading={improveLoading}
            result={result}
            file={file}
            jd={jd}
            onDownload={handleDownloadImproved}
            onGenerateFromTab={() => {
              // If user hasn't analyzed yet, redirect them
              if (!resumeId) {
                setActiveTab('analyze');
              } else {
                handleGenerateImproved();
              }
            }}
            onGoAnalyze={() => setActiveTab('analyze')}
          />
        )}

        {/* ═══════════════════════════════════════════
            TAB: WHAT-IF
        ═══════════════════════════════════════════ */}
        {activeTab === 'whatif' && (
          <div style={s.card}>
            <WhatIfSimulator resumeId={resumeId} />
          </div>
        )}

        {/* ═══════════════════════════════════════════
            TAB: HISTORY
        ═══════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <HistoryTab
            history={history}
            loading={historyLoading}
            selected={selectedHistory}
            onSelect={setSelectedHistory}
            onRefresh={fetchHistory}
          />
        )}

      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────
//  SUB-COMPONENT: ImproveTab
// ─────────────────────────────────────────────────────────
function ImproveTab({ improveStep, improvePreview, improveLoading, result, file, jd,
                      onDownload, onGenerateFromTab, onGoAnalyze }) {

  const missing   = improvePreview?.analysisContext?.missingKeywords
                      ?.split(',').filter(Boolean) || [];
  const suggestions = improvePreview?.analysisContext?.improvementSuggestions
                      ?.split('\n').filter(Boolean) || [];

  if (improveStep === 'idle' || (!improvePreview && !improveLoading)) {
    return (
      <div style={s.card}>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>✨</div>
          <h2 style={{ ...s.cardTitle, marginBottom: '14px' }}>AI Resume Optimizer</h2>
          <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.8, maxWidth: '500px', margin: '0 auto 32px' }}>
            After completing an analysis, use AI to generate an improved,
            ATS-friendly version of your resume — with missing keywords
            added, bullet points rewritten, and a tailored professional summary.
          </p>
          {result
            ? (
              <button onClick={onGenerateFromTab} style={s.btnPurple} disabled={improveLoading}>
                ✨ Generate Improved Resume
              </button>
            ) : (
              <button onClick={onGoAnalyze} style={s.btn}>
                🔍 Analyze Your Resume First
              </button>
            )
          }
        </div>
      </div>
    );
  }

  if (improveStep === 'generating' || improveLoading) {
    return (
      <div style={s.card}>
        <LoadingBox
          message="AI is crafting your improved resume..."
          sub="Integrating keywords • Rewriting bullets • Optimizing for ATS"
          color="#a855f7"
        />
      </div>
    );
  }

  // Preview state
  return (
    <div>
      <div style={s.resultHeader}>
        <h2 style={s.cardTitle}>✨ Your AI-Improved Resume</h2>
        <button onClick={onDownload} style={s.actionBtnPurple}>
          ⬇️ Download as DOCX
        </button>
      </div>

      <p style={{ ...s.actionTip, marginBottom: '24px' }}>
        🎉 Your improved resume is ready! Download it as a DOCX file, review it, and customize as needed.
      </p>

      {/* What was improved */}
      <div style={{ ...s.card, marginBottom: '20px' }}>
        <h3 style={{ ...s.cardTitle, color: '#10b981', marginBottom: '20px' }}>
          🤖 AI Improvements Applied
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {[
            { icon: '📝', label: 'Rewrote bullet points', desc: 'Strong action verbs and quantified results' },
            { icon: '🎯', label: 'Keywords integrated',   desc: missing.slice(0, 3).join(', ') || 'Relevant keywords added' },
            { icon: '📋', label: 'Professional summary',  desc: 'Tailored to the target job description' },
            { icon: '✅', label: 'ATS-optimized format',  desc: 'Clean DOCX structure for ATS scanners' },
          ].map((item, i) => (
            <div key={i} style={s.improveFeature}>
              <span style={{ fontSize: '1.6rem' }}>{item.icon}</span>
              <div>
                <div style={{ color: 'white', fontWeight: '600', fontSize: '0.9rem', marginBottom: '4px' }}>
                  {item.label}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.82rem' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Missing keywords that were added */}
      {missing.length > 0 && (
        <div style={{ ...s.card, marginBottom: '20px' }}>
          <h3 style={{ ...s.cardTitle, color: '#a855f7', marginBottom: '14px' }}>
            🔑 Keywords Added to Resume
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {missing.map((kw, i) => (
              <span key={i} style={s.kwTag}>{kw.trim()}</span>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions applied */}
      {suggestions.length > 0 && (
        <div style={s.card}>
          <h3 style={{ ...s.cardTitle, color: '#f59e0b', marginBottom: '14px' }}>
            💡 Suggestions Applied
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {suggestions.slice(0, 5).map((sg, i) => (
              <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ color: '#f59e0b', fontWeight: '700', fontSize: '1.1rem' }}>›</span>
                <span style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.6 }}>
                  {sg.replace(/^[-•*\d.]+\s*/, '')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Big download CTA */}
      <div style={s.downloadCta}>
        <button onClick={onDownload} style={{ ...s.btnPurple, padding: '16px 48px', fontSize: '0.9rem' }}>
          ⬇️ Download Improved Resume (DOCX)
        </button>
        <p style={{ color: '#475569', fontSize: '0.82rem', marginTop: '10px' }}>
          Open in Microsoft Word, Google Docs, or any word processor to finalize
        </p>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────
//  SUB-COMPONENT: HistoryTab
// ─────────────────────────────────────────────────────────
function HistoryTab({ history, loading, selected, onSelect, onRefresh }) {
  if (loading) {
    return (
      <div style={s.card}>
        <LoadingBox message="Loading your history..." sub="Fetching previous analyses" />
      </div>
    );
  }

  if (!history.length) {
    return (
      <div style={s.card}>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>📂</div>
          <h3 style={{ ...s.cardTitle, marginBottom: '10px' }}>No analysis history yet</h3>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
            After analyzing a resume, it will appear here for easy reference.
          </p>
        </div>
      </div>
    );
  }

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getScoreColor = (s) => {
    if (s >= 80) return '#10b981';
    if (s >= 60) return '#f59e0b';
    if (s >= 40) return '#f97316';
    return '#ef4444';
  };

  return (
    <div>
      {/* Header row */}
      <div style={s.resultHeader}>
        <h2 style={s.cardTitle}>📂 Analysis History</h2>
        <button onClick={onRefresh} style={s.btnOutline}>🔄 Refresh</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.4fr' : '1fr', gap: '20px' }}>

        {/* History list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {history.map((item) => {
            const isSelected = selected?.analysisId === item.analysisId;
            const color = getScoreColor(item.matchScore);
            return (
              <div
                key={item.analysisId}
                style={{ ...s.historyCard, ...(isSelected ? s.historyCardActive : {}) }}
                onClick={() => onSelect(isSelected ? null : item)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, marginRight: '12px' }}>
                    <div style={{ color: 'white', fontWeight: '600', fontSize: '0.95rem', marginBottom: '4px' }}>
                      📄 {item.fileName}
                    </div>
                    <div style={{ color: '#475569', fontSize: '0.8rem', marginBottom: '8px' }}>
                      {formatDate(item.analyzedAt)}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.5 }}>
                      {item.jobDescriptionPreview}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '56px' }}>
                    <div style={{
                      width: '52px', height: '52px', borderRadius: '50%',
                      border: `3px solid ${color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'column',
                    }}>
                      <span style={{ color, fontWeight: '900', fontSize: '1rem', fontFamily: "'Orbitron', monospace" }}>
                        {item.matchScore}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ ...s.card, alignSelf: 'start', position: 'sticky', top: '100px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ ...s.cardTitle, fontSize: '0.85rem' }}>📊 Analysis Detail</h3>
              <button
                style={{ ...s.btnOutline, padding: '6px 12px', fontSize: '0.6rem' }}
                onClick={() => onSelect(null)}
              >✕ Close</button>
            </div>

            <ScoreCard result={{
              matchScore:            selected.matchScore,
              keywordsMatched:       selected.keywordsMatched,
              missingKeywords:       selected.missingKeywords,
              feedbackPoints:        selected.feedbackPoints,
              improvementSuggestions:selected.improvementSuggestions,
              summary:               selected.summary,
            }} />

            {/* Download report button for history item */}
            <button
              style={{ ...s.actionBtn, width: '100%', marginTop: '20px' }}
              onClick={async () => {
                try {
                  const { downloadAnalysisReport: dlr, triggerBlobDownload: tbd } =
                    await import('../services/api');
                  const res = await dlr(selected.analysisId);
                  tbd(res.data, `report_${selected.fileName}_${selected.analysisId}.pdf`);
                } catch {
                  alert('Failed to download report.');
                }
              }}
            >
              📄 Download Report PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────
//  MICRO-COMPONENTS
// ─────────────────────────────────────────────────────────
function LoadingBox({ message, sub, color = '#00f5ff' }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px' }}>
      <div style={{
        width: '48px', height: '48px',
        border: `3px solid rgba(0,0,0,0.08)`,
        borderTop: `3px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 20px',
      }} />
      <p style={{ color, fontFamily: "'Orbitron', monospace", fontSize: '0.78rem', marginBottom: '8px' }}>
        {message}
      </p>
      {sub && <p style={{ color: '#475569', fontSize: '0.83rem' }}>{sub}</p>}
    </div>
  );
}

function Spinner({ small, color = '#00f5ff' }) {
  return (
    <span style={{
      display: 'inline-block',
      width: small ? '14px' : '20px',
      height: small ? '14px' : '20px',
      border: `2px solid rgba(255,255,255,0.15)`,
      borderTop: `2px solid ${color}`,
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      marginRight: '8px',
      verticalAlign: 'middle',
    }} />
  );
}


// ─────────────────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────────────────
const s = {
  page: {
    minHeight: '100vh', background: '#050510',
    fontFamily: "'Rajdhani', sans-serif",
    position: 'relative', overflow: 'hidden',
  },
  orb: {
    position: 'fixed', top: '20%', right: '5%',
    width: '500px', height: '500px',
    background: 'radial-gradient(circle, rgba(0,245,255,0.05) 0%, transparent 70%)',
    borderRadius: '50%', pointerEvents: 'none',
  },
  orbTwo: {
    position: 'fixed', bottom: '10%', left: '2%',
    width: '400px', height: '400px',
    background: 'radial-gradient(circle, rgba(168,85,247,0.04) 0%, transparent 70%)',
    borderRadius: '50%', pointerEvents: 'none',
  },
  container: {
    position: 'relative', zIndex: 2,
    maxWidth: '900px', margin: '0 auto',
    padding: '120px 24px 80px',
  },
  header: { textAlign: 'center', marginBottom: '36px' },
  badge: {
    display: 'inline-block', padding: '6px 18px',
    background: 'rgba(0,245,255,0.08)',
    border: '1px solid rgba(0,245,255,0.2)',
    borderRadius: '20px', color: '#00f5ff',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.65rem', letterSpacing: '2px',
    marginBottom: '20px',
  },
  title: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '2.2rem', fontWeight: '900',
    lineHeight: 1.3, marginBottom: '14px',
  },
  neon: { color: '#00f5ff', textShadow: '0 0 15px rgba(0,245,255,0.5)' },
  subtitle: { color: '#64748b', fontSize: '1rem' },

  // Tabs
  tabs: {
    display: 'flex', gap: '4px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px', padding: '5px',
    marginBottom: '32px',
  },
  tab: {
    flex: 1, padding: '12px',
    background: 'transparent', border: 'none',
    borderRadius: '10px', color: '#64748b',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.68rem', letterSpacing: '1px',
    cursor: 'pointer', transition: 'all 0.2s',
  },
  tabActive: {
    background: 'rgba(0,245,255,0.1)',
    color: '#00f5ff',
    boxShadow: 'inset 0 0 0 1px rgba(0,245,255,0.2)',
  },

  // Steps
  stepIndicator: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', marginBottom: '32px',
  },
  stepItem: { display: 'flex', alignItems: 'center', gap: '8px' },
  stepCircle: {
    width: '34px', height: '34px', borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Orbitron', monospace", fontSize: '0.72rem', color: '#475569',
    transition: 'all 0.3s',
  },
  stepCircleActive: {
    border: '2px solid #00f5ff',
    background: 'rgba(0,245,255,0.12)', color: '#00f5ff',
    boxShadow: '0 0 10px rgba(0,245,255,0.25)',
  },
  stepLabel: {
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: '0.82rem', color: '#475569', whiteSpace: 'nowrap',
  },
  stepLine: { width: '44px', height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 8px' },
  stepLineActive: { background: '#00f5ff' },

  // Cards
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(0,245,255,0.08)',
    borderRadius: '20px', padding: '40px',
    backdropFilter: 'blur(10px)',
  },
  cardTitle: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1.1rem', fontWeight: '700',
    color: 'white', marginBottom: '10px',
  },
  cardDesc: { color: '#64748b', fontSize: '0.95rem', marginBottom: '24px' },

  // Dropzone
  dropZone: {
    border: '2px dashed rgba(255,255,255,0.12)',
    borderRadius: '16px', padding: '56px 40px',
    textAlign: 'center', cursor: 'pointer',
    transition: 'all 0.3s', marginBottom: '24px',
  },
  dropZoneActive: {
    border: '2px dashed #00f5ff',
    background: 'rgba(0,245,255,0.04)',
  },
  fileName: {
    fontFamily: "'Share Tech Mono', monospace",
    color: '#00f5ff', fontSize: '1rem', marginBottom: '6px',
  },
  dropText: { fontSize: '1.1rem', color: '#94a3b8', marginBottom: '6px', fontWeight: '600' },

  // Buttons
  btn: {
    padding: '14px 32px', width: '100%',
    background: 'linear-gradient(135deg, #00f5ff, #3b82f6)',
    border: 'none', borderRadius: '12px',
    color: '#000', fontFamily: "'Orbitron', monospace",
    fontSize: '0.78rem', fontWeight: '700',
    cursor: 'pointer', letterSpacing: '1.5px',
    transition: 'all 0.3s', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: '8px',
  },
  btnPurple: {
    padding: '14px 32px', width: '100%',
    background: 'linear-gradient(135deg, #a855f7, #6366f1)',
    border: 'none', borderRadius: '12px',
    color: 'white', fontFamily: "'Orbitron', monospace",
    fontSize: '0.78rem', fontWeight: '700',
    cursor: 'pointer', letterSpacing: '1.5px',
  },
  btnOutline: {
    padding: '12px 20px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '10px', color: '#94a3b8',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.68rem', cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  textarea: {
    width: '100%', padding: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px', color: 'white',
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: '0.95rem', lineHeight: 1.7,
    outline: 'none', resize: 'vertical', marginBottom: '20px',
    boxSizing: 'border-box',
  },
  errorBox: {
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: '12px', padding: '14px 20px',
    color: '#ef4444', marginBottom: '24px', fontSize: '0.95rem',
  },

  // Results
  resultHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px',
  },

  // Action bar (under results)
  actionBar: {
    display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap',
  },
  actionBtn: {
    flex: 1, minWidth: '220px',
    padding: '14px 24px',
    background: 'rgba(0,245,255,0.08)',
    border: '1px solid rgba(0,245,255,0.25)',
    borderRadius: '12px', color: '#00f5ff',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.72rem', fontWeight: '700',
    cursor: 'pointer', letterSpacing: '1px',
    transition: 'all 0.3s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
  },
  actionBtnSuccess: {
    background: 'rgba(16,185,129,0.1)',
    border: '1px solid rgba(16,185,129,0.3)',
    color: '#10b981',
  },
  actionBtnPurple: {
    flex: 1, minWidth: '220px',
    padding: '14px 24px',
    background: 'rgba(168,85,247,0.1)',
    border: '1px solid rgba(168,85,247,0.3)',
    borderRadius: '12px', color: '#a855f7',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.72rem', fontWeight: '700',
    cursor: 'pointer', letterSpacing: '1px',
    transition: 'all 0.3s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
  },
  actionTip: {
    color: '#475569', fontSize: '0.83rem',
    marginBottom: '20px', textAlign: 'center',
  },

  // Improve tab
  improveFeature: {
    display: 'flex', gap: '14px', alignItems: 'flex-start',
    padding: '16px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '12px',
  },
  kwTag: {
    padding: '5px 13px',
    background: 'rgba(168,85,247,0.1)',
    border: '1px solid rgba(168,85,247,0.25)',
    borderRadius: '20px', color: '#a855f7', fontSize: '0.82rem',
  },
  downloadCta: {
    textAlign: 'center', marginTop: '32px', padding: '32px',
    background: 'rgba(168,85,247,0.05)',
    border: '1px solid rgba(168,85,247,0.15)',
    borderRadius: '16px',
  },

  // History
  historyCard: {
    padding: '20px 24px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px', cursor: 'pointer',
    transition: 'all 0.2s',
  },
  historyCardActive: {
    border: '1px solid rgba(0,245,255,0.25)',
    background: 'rgba(0,245,255,0.04)',
  },
};
