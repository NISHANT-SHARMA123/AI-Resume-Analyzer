import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Home              from './pages/Home';
import Login             from './pages/Login';
import Register          from './pages/Register';
import CandidatePortal   from './pages/CandidatePortal';
import InterviewerPortal from './pages/InterviewerPortal';
import ResumeSummary     from './pages/ResumeSummary';
import ResumeImprove     from './pages/ResumeImprove';
import Contact           from './pages/Contact';

// ─────────────────────────────────────────────────────────
//  AccessDeniedPopup
//  Shown when a logged-in user tries to visit a page that
//  requires a different role (e.g. candidate → /interviewer)
// ─────────────────────────────────────────────────────────
function AccessDeniedPopup({ userRole, requiredRole, onClose, onGoLogin }) {
  const roleLabel = (r) =>
    r === 'CANDIDATE' ? 'Candidate' : r === 'INTERVIEWER' ? 'Interviewer' : r;

  return (
    <div style={popupStyles.overlay}>
      <div style={popupStyles.box}>
        {/* Icon */}
        <div style={popupStyles.iconRing}>
          <span style={{ fontSize: '1.8rem' }}>🔒</span>
        </div>

        {/* Title */}
        <h2 style={popupStyles.title}>Access Denied</h2>

        {/* Message */}
        <p style={popupStyles.message}>
          You are signed in as a{' '}
          <span style={popupStyles.roleHighlight}>{roleLabel(userRole)}</span>.
          <br />
          This page is only accessible to{' '}
          <span style={popupStyles.roleRequired}>{roleLabel(requiredRole)}s</span>.
        </p>

        <p style={popupStyles.sub}>
          Please sign in with an {roleLabel(requiredRole)} account to continue.
        </p>

        {/* Divider */}
        <div style={popupStyles.divider} />

        {/* Buttons */}
        <div style={popupStyles.btnRow}>
          <button style={popupStyles.btnSecondary} onClick={onClose}>
            ← Go Back
          </button>
          <button style={popupStyles.btnPrimary} onClick={onGoLogin}>
            Switch Account
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  PrivateRoute
//  Wraps protected pages. If not logged in → redirect to
//  /login. If wrong role → show AccessDeniedPopup instead
//  of a silent redirect.
// ─────────────────────────────────────────────────────────
function PrivateRoute({ children, role }) {
  const [showPopup, setShowPopup] = useState(true);
  const navigate = useNavigate();

  const raw = localStorage.getItem('resumeai_user');

  // Not logged in at all → send to login
  if (!raw) return <Navigate to="/login" replace />;

  const user = JSON.parse(raw);

  // Role matches → render the protected page
  if (!role || user.role === role) return children;

  // Role mismatch → show popup over a blank background
  if (!showPopup) return <Navigate to="/" replace />;

  return (
    <>
      {/* Dim background so the popup feels intentional */}
      <div style={{ minHeight: '100vh', background: '#050510' }} />

      <AccessDeniedPopup
        userRole={user.role}
        requiredRole={role}
        onClose={() => {
          setShowPopup(false);
          navigate(-1);           // go back to wherever they came from
        }}
        onGoLogin={() => {
          localStorage.removeItem('resumeai_user'); // clear current session
          navigate('/login');
        }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────
//  App
// ─────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/"         element={<Home />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/contact"  element={<Contact />} />

        {/* Candidate */}
        <Route path="/candidate" element={
          <PrivateRoute role="CANDIDATE"><CandidatePortal /></PrivateRoute>
        } />
        <Route path="/candidate/summary" element={
          <PrivateRoute role="CANDIDATE"><ResumeSummary /></PrivateRoute>
        } />
        <Route path="/candidate/improve" element={
          <PrivateRoute role="CANDIDATE"><ResumeImprove /></PrivateRoute>
        } />

        {/* Interviewer */}
        <Route path="/interviewer" element={
          <PrivateRoute role="INTERVIEWER"><InterviewerPortal /></PrivateRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// ─────────────────────────────────────────────────────────
//  Popup styles — matches the existing dark/neon aesthetic
// ─────────────────────────────────────────────────────────
const popupStyles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px',
    fontFamily: "'Rajdhani', sans-serif",
  },
  box: {
    width: '100%', maxWidth: '420px',
    background: '#0a0a1f',
    border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: '20px',
    padding: '40px 36px',
    textAlign: 'center',
    boxShadow: '0 0 60px rgba(239,68,68,0.12)',
    animation: 'fadeInScale 0.2s ease',
  },
  iconRing: {
    width: '72px', height: '72px',
    borderRadius: '50%',
    background: 'rgba(239,68,68,0.1)',
    border: '2px solid rgba(239,68,68,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 20px',
  },
  title: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1.3rem', fontWeight: '900',
    color: 'white', marginBottom: '14px',
  },
  message: {
    color: '#94a3b8', fontSize: '1rem',
    lineHeight: 1.8, marginBottom: '8px',
  },
  roleHighlight: {
    color: '#f59e0b', fontWeight: '700',
  },
  roleRequired: {
    color: '#00f5ff', fontWeight: '700',
  },
  sub: {
    color: '#475569', fontSize: '0.88rem',
    marginBottom: '4px',
  },
  divider: {
    height: '1px',
    background: 'rgba(255,255,255,0.07)',
    margin: '24px 0',
  },
  btnRow: {
    display: 'flex', gap: '12px',
  },
  btnSecondary: {
    flex: 1, padding: '13px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '10px', color: '#94a3b8',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.68rem', cursor: 'pointer',
    letterSpacing: '1px',
  },
  btnPrimary: {
    flex: 1, padding: '13px',
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    border: 'none',
    borderRadius: '10px', color: 'white',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.68rem', fontWeight: '700',
    cursor: 'pointer', letterSpacing: '1px',
  },
};
