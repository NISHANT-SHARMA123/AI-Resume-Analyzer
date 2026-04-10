// src/pages/Contact.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function Contact() {
  const navigate = useNavigate();

  const [form, setForm]       = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus]   = useState('idle'); // idle | sending | sent | error
  const [errors, setErrors]   = useState({});

  const validate = () => {
    const e = {};
    if (!form.name.trim())    e.name    = 'Name is required';
    if (!form.email.trim())   e.email   = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.subject.trim()) e.subject = 'Subject is required';
    if (!form.message.trim()) e.message = 'Message is required';
    else if (form.message.trim().length < 20) e.message = 'Message must be at least 20 characters';
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setStatus('sending');
    // Simulate submission (replace with real API call when backend endpoint exists)
    setTimeout(() => setStatus('sent'), 1500);
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const contactCards = [
    {
      icon: '📧',
      label: 'Email Us',
      value: 'support@airesumeanalyzer.com',
      color: '#00f5ff',
      desc: 'We reply within 24 hours',
    },
    {
      icon: '💬',
      label: 'Live Chat',
      value: 'Available 9 AM – 6 PM IST',
      color: '#a855f7',
      desc: 'Mon – Fri on weekdays',
    },
    {
      icon: '🐛',
      label: 'Bug Reports',
      value: 'github.com/airesumeanalyzer',
      color: '#10b981',
      desc: 'Open an issue on GitHub',
    },
  ];

  const faqs = [
    {
      q: 'How is the resume score calculated?',
      a: 'The overall score is a weighted composite of four dimensions: Keyword Match (40%), Experience Relevance (25%), Project Depth (25%), and Resume Quality (10%). Each dimension is analyzed by our NLP + Random Forest engine.',
    },
    {
      q: 'What file formats are supported?',
      a: 'We support PDF and DOCX (Microsoft Word) resume files up to 15 MB. For best results, use text-based PDFs rather than scanned image PDFs.',
    },
    {
      q: 'Is my resume data stored permanently?',
      a: 'Uploaded resumes are stored only as long as your session requires. We do not share your data with third parties.',
    },
    {
      q: 'Why are some keywords showing as missing unfairly?',
      a: 'Our system uses a curated skill taxonomy to filter out generic JD words like "required", "qualifications", and "responsibilities". Only genuine technical skills are evaluated. If you see an incorrect missing skill, please report it.',
    },
  ];

  return (
    <div style={s.page}>
      <Navbar />

      {/* Background orbs */}
      <div style={s.orb1} />
      <div style={s.orb2} />

      <div style={s.container}>

        {/* ── Page Header ─────────────────────────────────── */}
        <div style={s.header}>
          <div style={s.badge}>📬 GET IN TOUCH</div>
          <h1 style={s.title}>
            Contact <span style={s.neon}>Us</span>
          </h1>
          <p style={s.subtitle}>
            Have a question, found a bug, or want to give feedback?
            We'd love to hear from you.
          </p>
        </div>

        {/* ── Contact Cards ────────────────────────────────── */}
        <div style={s.cardsRow}>
          {contactCards.map((c, i) => (
            <div key={i} style={{ ...s.contactCard, borderColor: `${c.color}25` }}>
              <div style={{ ...s.contactIcon, background: `${c.color}12`, border: `1px solid ${c.color}30` }}>
                <span style={{ fontSize: '1.6rem' }}>{c.icon}</span>
              </div>
              <div style={{ ...s.contactLabel, color: c.color }}>{c.label}</div>
              <div style={s.contactValue}>{c.value}</div>
              <div style={s.contactDesc}>{c.desc}</div>
            </div>
          ))}
        </div>

        {/* ── Main Content: Form + FAQ ─────────────────────── */}
        <div style={s.mainGrid}>

          {/* Contact Form */}
          <div style={s.formCard}>
            <h2 style={s.cardTitle}>✉️ Send a Message</h2>

            {status === 'sent' ? (
              <div style={s.successBox}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
                <h3 style={{ fontFamily: "'Orbitron', monospace", fontSize: '1rem', color: '#10b981', marginBottom: '10px' }}>
                  Message Sent!
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '24px' }}>
                  Thanks for reaching out. We'll get back to you within 24 hours.
                </p>
                <button
                  onClick={() => { setStatus('idle'); setForm({ name: '', email: '', subject: '', message: '' }); }}
                  style={s.btnCyan}>
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

                {/* Name + Email row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={s.label}>YOUR NAME</label>
                    <input
                      style={{ ...s.input, ...(errors.name ? s.inputError : {}) }}
                      placeholder="John Smith"
                      value={form.name}
                      onChange={e => handleChange('name', e.target.value)}
                    />
                    {errors.name && <span style={s.errorMsg}>{errors.name}</span>}
                  </div>
                  <div>
                    <label style={s.label}>EMAIL ADDRESS</label>
                    <input
                      style={{ ...s.input, ...(errors.email ? s.inputError : {}) }}
                      placeholder="john@email.com"
                      value={form.email}
                      onChange={e => handleChange('email', e.target.value)}
                    />
                    {errors.email && <span style={s.errorMsg}>{errors.email}</span>}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label style={s.label}>SUBJECT</label>
                  <input
                    style={{ ...s.input, ...(errors.subject ? s.inputError : {}) }}
                    placeholder="e.g. Bug Report / Feature Request / General Query"
                    value={form.subject}
                    onChange={e => handleChange('subject', e.target.value)}
                  />
                  {errors.subject && <span style={s.errorMsg}>{errors.subject}</span>}
                </div>

                {/* Message */}
                <div>
                  <label style={s.label}>MESSAGE</label>
                  <textarea
                    style={{ ...s.textarea, ...(errors.message ? s.inputError : {}) }}
                    placeholder="Describe your question or feedback in detail..."
                    rows={6}
                    value={form.message}
                    onChange={e => handleChange('message', e.target.value)}
                  />
                  {errors.message && <span style={s.errorMsg}>{errors.message}</span>}
                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#475569', marginTop: '4px' }}>
                    {form.message.length} characters
                  </div>
                </div>

                <button type="submit" style={s.btnSubmit} disabled={status === 'sending'}>
                  {status === 'sending' ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                      <span style={s.spinner} /> Sending...
                    </span>
                  ) : '📤 Send Message'}
                </button>

              </form>
            )}
          </div>

          {/* FAQ */}
          <div style={s.faqCard}>
            <h2 style={s.cardTitle}>❓ Frequently Asked</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {faqs.map((item, i) => (
                <FAQItem key={i} q={item.q} a={item.a} />
              ))}
            </div>

            {/* Back to home */}
            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '14px' }}>
                Ready to analyze your resume?
              </p>
              <button onClick={() => navigate('/')} style={s.btnOutline}>
                ← Back to Home
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── FAQ accordion item ────────────────────────────────────────
function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: `1px solid ${open ? 'rgba(0,245,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: '12px',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '16px 18px',
          background: 'transparent', border: 'none',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', textAlign: 'left', gap: '12px',
        }}
      >
        <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.95rem', fontWeight: 600, color: '#e2e8f0' }}>
          {q}
        </span>
        <span style={{ color: open ? '#00f5ff' : '#475569', fontSize: '1.2rem', flexShrink: 0, transition: 'color 0.2s' }}>
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 18px 16px', color: '#64748b', fontSize: '0.88rem', lineHeight: 1.7 }}>
          {a}
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const s = {
  page: {
    minHeight: '100vh',
    background: '#050510',
    fontFamily: "'Rajdhani', sans-serif",
    color: 'white',
    overflowX: 'hidden',
    position: 'relative',
  },
  orb1: {
    position: 'fixed', top: '10%', left: '5%',
    width: '400px', height: '400px',
    background: 'radial-gradient(circle, rgba(0,245,255,0.05) 0%, transparent 70%)',
    borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
  },
  orb2: {
    position: 'fixed', bottom: '10%', right: '5%',
    width: '350px', height: '350px',
    background: 'radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 70%)',
    borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
  },
  container: {
    position: 'relative', zIndex: 2,
    maxWidth: '1100px', margin: '0 auto',
    padding: '120px 24px 80px',
  },

  // Header
  header: { textAlign: 'center', marginBottom: '52px' },
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
    fontSize: '2.8rem', fontWeight: '900',
    marginBottom: '16px',
  },
  neon: {
    color: '#00f5ff',
    textShadow: '0 0 20px rgba(0,245,255,0.5)',
  },
  subtitle: { color: '#64748b', fontSize: '1.05rem', lineHeight: 1.8 },

  // Contact cards
  cardsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px', marginBottom: '48px',
  },
  contactCard: {
    padding: '28px 24px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid',
    borderRadius: '18px', textAlign: 'center',
    transition: 'border-color 0.2s',
  },
  contactIcon: {
    width: '56px', height: '56px', borderRadius: '14px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 14px',
  },
  contactLabel: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.65rem', fontWeight: '700',
    letterSpacing: '1.5px', marginBottom: '8px',
  },
  contactValue: { color: 'white', fontWeight: 600, fontSize: '0.92rem', marginBottom: '5px' },
  contactDesc: { color: '#475569', fontSize: '0.82rem' },

  // Main grid
  mainGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: '28px', alignItems: 'start',
  },

  // Form card
  formCard: {
    padding: '36px 32px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(0,245,255,0.1)',
    borderRadius: '20px',
  },
  cardTitle: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.9rem', fontWeight: '700',
    color: 'white', marginBottom: '24px',
  },

  // Form fields
  label: {
    display: 'block',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.6rem', color: '#00f5ff',
    letterSpacing: '1.5px', marginBottom: '8px',
  },
  input: {
    width: '100%', padding: '12px 16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', color: 'white',
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: '0.95rem', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.2s',
  },
  inputError: {
    borderColor: 'rgba(239,68,68,0.5)',
  },
  textarea: {
    width: '100%', padding: '12px 16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', color: 'white',
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: '0.95rem', outline: 'none',
    resize: 'vertical', boxSizing: 'border-box',
    lineHeight: 1.7, transition: 'border-color 0.2s',
  },
  errorMsg: {
    display: 'block', marginTop: '5px',
    color: '#ef4444', fontSize: '0.78rem',
  },
  btnSubmit: {
    width: '100%', padding: '14px',
    background: 'linear-gradient(135deg, #00f5ff, #3b82f6)',
    border: 'none', borderRadius: '12px',
    color: '#000', fontFamily: "'Orbitron', monospace",
    fontSize: '0.75rem', fontWeight: '700',
    cursor: 'pointer', letterSpacing: '1.5px',
    transition: 'opacity 0.2s',
  },
  btnCyan: {
    padding: '12px 28px',
    background: 'rgba(0,245,255,0.1)',
    border: '1px solid rgba(0,245,255,0.3)',
    borderRadius: '10px', color: '#00f5ff',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.7rem', cursor: 'pointer',
    letterSpacing: '1px',
  },
  btnOutline: {
    padding: '10px 22px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '10px', color: '#94a3b8',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.65rem', cursor: 'pointer',
    letterSpacing: '1px',
  },
  spinner: {
    width: '16px', height: '16px', display: 'inline-block',
    border: '2px solid rgba(0,0,0,0.2)',
    borderTop: '2px solid #000',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  successBox: {
    textAlign: 'center', padding: '40px 20px',
  },

  // FAQ card
  faqCard: {
    padding: '36px 32px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(168,85,247,0.1)',
    borderRadius: '20px',
  },
};
