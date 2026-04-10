// src/pages/Home.jsx
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function Home() {
  const navigate = useNavigate();
  const bgRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (bgRef.current) {
        const x = (e.clientX / window.innerWidth - 0.5) * 30;
        const y = (e.clientY / window.innerHeight - 0.5) * 30;
        bgRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const floatingDocs = ['📄', '📋', '📝', '🗂️', '📊', '📈', '💼', '🎯'];

  // ── Feature highlights (replaces the "98% Accuracy" stat) ──
  const features = [
    {
      icon: '🤖',
      title: 'AI Resume Analysis',
      desc: 'Deep NLP analysis powered by spaCy, TF-IDF, and Random Forest to understand your resume content semantically.',
      color: '#00f5ff',
    },
    {
      icon: '📊',
      title: 'ATS Score Detection',
      desc: 'Instant ATS compatibility scoring with visual gauge charts, skill match bars, and keyword coverage analytics.',
      color: '#a855f7',
    },
    {
      icon: '💡',
      title: 'Smart Resume Feedback',
      desc: 'AI-generated improvement suggestions, missing keyword detection, and bullet-point rewriting recommendations.',
      color: '#10b981',
    },
    {
      icon: '🏢',
      title: 'Recruiter Shortlisting',
      desc: 'Rank hundreds of candidates by ATS score, compare skill profiles, and download accepted candidates in bulk.',
      color: '#f59e0b',
    },
  ];

  return (
    <div style={styles.page}>
      <Navbar />

      {/* ── Floating Background ── */}
      <div ref={bgRef} style={styles.floatingBg}>
        {floatingDocs.map((emoji, i) => (
          <div key={i} style={{
            ...styles.floatingDoc,
            top: `${8 + (i * 12)}%`,
            left: `${3 + (i * 12)}%`,
            animationDuration: `${4 + i * 0.5}s`,
            animationDelay: `${i * 0.4}s`,
            fontSize: `${2 + (i % 3) * 0.8}rem`,
            opacity: 0.04 + (i % 3) * 0.02,
          }}>
            {emoji}
          </div>
        ))}
        <div style={styles.gridOverlay} />
      </div>

      {/* ── Hero Section ── */}
      <main style={styles.hero}>
        <div style={styles.orb1} />
        <div style={styles.orb2} />

        <div style={styles.badge}>
          <span style={styles.badgeDot} />
          AI-POWERED RESUME INTELLIGENCE
        </div>

        <h1 style={styles.heroTitle}>
          Analyze Your Resume<br />
          <span style={styles.neon}>With Precision</span>
        </h1>

        <p style={styles.heroSubtitle}>
          Upload your resume, paste a job description, and get instant<br />
          AI-powered feedback, ATS scores, and improvement tips.
        </p>

        {/* ── Portal Buttons ── */}
        <div style={styles.portalRow}>
          <div style={styles.portalCard} onClick={() => navigate('/candidate')}>
            <div style={styles.portalIcon}>👤</div>
            <h3 style={styles.portalTitle}>Candidate Portal</h3>
            <p style={styles.portalDesc}>
              Upload your resume, get AI feedback, view ATS score charts,
              and improve your chances of getting hired.
            </p>
            <div style={styles.portalArrow}>→</div>
          </div>

          <div style={{ ...styles.portalCard, ...styles.portalCardPurple }}
            onClick={() => navigate('/interviewer')}>
            <div style={styles.portalIcon}>🏢</div>
            <h3 style={styles.portalTitle}>Interviewer Portal</h3>
            <p style={styles.portalDesc}>
              Upload multiple resumes, rank candidates with AI analytics,
              compare skill distributions, and make smarter hiring decisions.
            </p>
            <div style={{ ...styles.portalArrow, color: '#a855f7' }}>→</div>
          </div>
        </div>

        {/* ── Stats Row — NO accuracy metric, replaced with capability stats ── */}
        <div style={styles.statsRow}>
          {[
            { value: '< 30s',  label: 'Analysis Time'     },
            { value: 'NLP',    label: 'Deep Text Analysis' },
            { value: 'ATS',    label: 'Score Engine'       },
            { value: 'RF + TF-IDF', label: 'ML Pipeline'  },
          ].map((stat, i) => (
            <div key={i} style={styles.statItem}>
              <div style={styles.statValue}>{stat.value}</div>
              <div style={styles.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>
      </main>

      {/* ── Feature Highlights Section ── */}
      <section style={styles.featuresSection}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionBadge}>PLATFORM CAPABILITIES</div>
          <h2 style={styles.sectionTitle}>
            Everything You Need to <span style={styles.neon}>Get Hired</span>
          </h2>
          <p style={styles.sectionSubtitle}>
            Built on a multi-layer ML pipeline combining NLP, TF-IDF, and Random Forest classification
          </p>

          <div style={styles.featuresGrid}>
            {features.map((f, i) => (
              <div key={i} style={{ ...styles.featureCard, '--accent': f.color }}>
                <div style={{ ...styles.featureIconBox, background: `${f.color}15`, border: `1px solid ${f.color}30` }}>
                  <span style={{ fontSize: '1.6rem' }}>{f.icon}</span>
                </div>
                <h3 style={{ ...styles.featureTitle, color: f.color }}>{f.title}</h3>
                <p style={styles.featureDesc}>{f.desc}</p>
                <div style={{ ...styles.featureAccent, background: f.color }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works Section ── */}
      <section id="how-it-works" style={styles.section}>
        <h2 style={styles.sectionTitle}>How It <span style={styles.neon}>Works</span></h2>
        <div style={styles.stepsRow}>
          {[
            { step: '01', icon: '📤', title: 'Upload Resume',        desc: 'Upload your PDF or DOCX resume file' },
            { step: '02', icon: '📋', title: 'Paste Job Description', desc: 'Add the job description you want to apply for' },
            { step: '03', icon: '🧠', title: 'AI Analysis',           desc: 'NLP + Random Forest algorithms analyze and score your resume' },
            { step: '04', icon: '📊', title: 'View ATS Charts',       desc: 'See score gauges, skill bars, keyword coverage charts' },
          ].map((item, i) => (
            <div key={i} style={styles.stepCard}>
              <div style={styles.stepNumber}>{item.step}</div>
              <div style={styles.stepIcon}>{item.icon}</div>
              <h4 style={styles.stepTitle}>{item.title}</h4>
              <p style={styles.stepDesc}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#050510',
    color: 'white',
    overflowX: 'hidden',
    fontFamily: "'Rajdhani', sans-serif",
  },
  floatingBg: {
    position: 'fixed', top: '-10%', left: '-10%',
    width: '120%', height: '120%',
    transition: 'transform 0.15s ease',
    zIndex: 0, pointerEvents: 'none',
  },
  floatingDoc: {
    position: 'absolute',
    animation: 'float 4s ease-in-out infinite alternate',
  },
  gridOverlay: {
    position: 'absolute', inset: 0,
    backgroundImage: `
      linear-gradient(rgba(0,245,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,245,255,0.03) 1px, transparent 1px)
    `,
    backgroundSize: '60px 60px',
  },
  hero: {
    position: 'relative', zIndex: 2,
    textAlign: 'center',
    padding: '160px 40px 80px',
  },
  orb1: {
    position: 'absolute', top: '10%', left: '15%',
    width: '400px', height: '400px',
    background: 'radial-gradient(circle, rgba(0,245,255,0.08) 0%, transparent 70%)',
    borderRadius: '50%', pointerEvents: 'none',
  },
  orb2: {
    position: 'absolute', top: '20%', right: '15%',
    width: '350px', height: '350px',
    background: 'radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)',
    borderRadius: '50%', pointerEvents: 'none',
  },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '6px 18px',
    background: 'rgba(0,245,255,0.08)',
    border: '1px solid rgba(0,245,255,0.2)',
    borderRadius: '20px', color: '#00f5ff',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.65rem', fontWeight: '700',
    letterSpacing: '2px', marginBottom: '30px',
  },
  badgeDot: {
    width: '6px', height: '6px',
    background: '#00f5ff', borderRadius: '50%',
    animation: 'pulse-neon 2s infinite',
    display: 'inline-block',
  },
  heroTitle: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '3.5rem', fontWeight: '900',
    lineHeight: 1.15, marginBottom: '24px',
    letterSpacing: '-1px',
  },
  neon: {
    color: '#00f5ff',
    textShadow: '0 0 20px #00f5ff, 0 0 40px rgba(0,245,255,0.4)',
  },
  heroSubtitle: {
    color: '#94a3b8', fontSize: '1.15rem',
    lineHeight: 1.9, marginBottom: '60px',
  },
  portalRow: {
    display: 'flex', gap: '28px',
    justifyContent: 'center', flexWrap: 'wrap',
    marginBottom: '70px',
  },
  portalCard: {
    width: '300px', padding: '36px 30px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(0,245,255,0.15)',
    borderRadius: '20px', cursor: 'pointer',
    transition: 'all 0.35s ease',
    backdropFilter: 'blur(10px)',
    textAlign: 'left', position: 'relative', overflow: 'hidden',
  },
  portalCardPurple: { border: '1px solid rgba(168,85,247,0.2)' },
  portalIcon: { fontSize: '2.5rem', marginBottom: '16px' },
  portalTitle: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1rem', fontWeight: '700',
    color: 'white', marginBottom: '12px',
  },
  portalDesc: { color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.7 },
  portalArrow: {
    position: 'absolute', bottom: '20px', right: '24px',
    fontSize: '1.5rem', color: '#00f5ff', fontWeight: '900',
  },
  statsRow: {
    display: 'flex', gap: '40px', justifyContent: 'center', flexWrap: 'wrap',
  },
  statItem: { textAlign: 'center' },
  statValue: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1.5rem', fontWeight: '900', color: '#00f5ff',
    textShadow: '0 0 15px rgba(0,245,255,0.5)',
  },
  statLabel: { color: '#64748b', fontSize: '0.85rem', marginTop: '4px' },

  // Feature Highlights section
  featuresSection: {
    position: 'relative', zIndex: 2,
    padding: '100px 40px',
    background: 'rgba(255,255,255,0.01)',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  sectionInner: { maxWidth: '1100px', margin: '0 auto' },
  sectionBadge: {
    display: 'inline-block',
    padding: '5px 16px',
    background: 'rgba(168,85,247,0.1)',
    border: '1px solid rgba(168,85,247,0.25)',
    borderRadius: '20px', color: '#a855f7',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.6rem', letterSpacing: '2px',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '2.2rem', fontWeight: '900',
    textAlign: 'center', marginBottom: '14px',
  },
  sectionSubtitle: {
    color: '#64748b', textAlign: 'center',
    fontSize: '1rem', marginBottom: '56px',
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '24px',
  },
  featureCard: {
    padding: '32px 28px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '18px', position: 'relative', overflow: 'hidden',
    transition: 'border-color 0.3s',
  },
  featureIconBox: {
    width: '52px', height: '52px',
    borderRadius: '14px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: '18px',
  },
  featureTitle: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.85rem', fontWeight: '700',
    marginBottom: '12px', letterSpacing: '0.5px',
  },
  featureDesc: {
    color: '#64748b', fontSize: '0.9rem', lineHeight: 1.75,
  },
  featureAccent: {
    position: 'absolute', bottom: 0, left: 0,
    height: '2px', width: '40%',
    borderRadius: '0 2px 0 0', opacity: 0.6,
  },

  // How It Works section
  section: {
    position: 'relative', zIndex: 2,
    padding: '80px 60px',
    background: 'rgba(255,255,255,0.01)',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  stepsRow: {
    display: 'flex', gap: '24px',
    justifyContent: 'center', flexWrap: 'wrap',
  },
  stepCard: {
    width: '220px', padding: '30px 24px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px', textAlign: 'center',
  },
  stepNumber: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.7rem', color: '#00f5ff',
    letterSpacing: '2px', marginBottom: '14px',
  },
  stepIcon: { fontSize: '2rem', marginBottom: '14px' },
  stepTitle: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.85rem', color: 'white', marginBottom: '10px',
  },
  stepDesc: { color: '#64748b', fontSize: '0.9rem', lineHeight: 1.7 },
};
