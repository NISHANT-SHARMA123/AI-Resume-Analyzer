// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser, saveAuthData } from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await loginUser(form);
      const data = response.data;

      if (data.success) {
        saveAuthData(data);
        // Redirect based on role
        if (data.role === 'INTERVIEWER') {
          navigate('/interviewer');
        } else {
          navigate('/candidate');
        }
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Server error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.orb1} />
      <div style={styles.orb2} />

      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo} onClick={() => navigate('/')}>⬡ AI<span style={{ color: '#00f5ff' }}>_RESUME_ANALYZER</span></div>
          <h2 style={styles.title}>Welcome Back</h2>
          <p style={styles.subtitle}>Sign in to your account</p>
        </div>

        {/* Error */}
        {error && <div style={styles.errorBox}>⚠️ {error}</div>}

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>EMAIL ADDRESS</label>
            <input
              type="email" name="email"
              value={form.email} onChange={handleChange}
              placeholder="your@email.com"
              style={styles.input} required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>PASSWORD</label>
            <input
              type="password" name="password"
              value={form.password} onChange={handleChange}
              placeholder="••••••••"
              style={styles.input} required
            />
          </div>

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? '⏳ Signing In...' : '⚡ Sign In'}
          </button>
        </form>

        <p style={styles.footer}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#00f5ff', textDecoration: 'none' }}>
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#050510',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Rajdhani', sans-serif",
    position: 'relative', overflow: 'hidden',
  },
  orb1: {
    position: 'fixed', top: '20%', left: '10%',
    width: '400px', height: '400px',
    background: 'radial-gradient(circle, rgba(0,245,255,0.07) 0%, transparent 70%)',
    borderRadius: '50%', pointerEvents: 'none',
  },
  orb2: {
    position: 'fixed', bottom: '20%', right: '10%',
    width: '300px', height: '300px',
    background: 'radial-gradient(circle, rgba(168,85,247,0.07) 0%, transparent 70%)',
    borderRadius: '50%', pointerEvents: 'none',
  },
  card: {
    width: '420px', padding: '48px 40px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(0,245,255,0.15)',
    borderRadius: '24px',
    backdropFilter: 'blur(20px)',
    position: 'relative', zIndex: 2,
  },
  header: { textAlign: 'center', marginBottom: '36px' },
  logo: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1.1rem', fontWeight: '900',
    color: 'white', marginBottom: '24px',
    cursor: 'pointer',
  },
  title: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1.5rem', fontWeight: '700',
    color: 'white', marginBottom: '8px',
  },
  subtitle: { color: '#64748b', fontSize: '0.95rem' },
  errorBox: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '10px', padding: '12px 16px',
    color: '#ef4444', fontSize: '0.9rem',
    marginBottom: '20px', textAlign: 'center',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  field: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.65rem', fontWeight: '700',
    color: '#00f5ff', letterSpacing: '2px',
  },
  input: {
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', color: 'white',
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: '1rem', outline: 'none',
  },
  btn: {
    padding: '15px',
    background: 'linear-gradient(135deg, #00f5ff, #3b82f6)',
    border: 'none', borderRadius: '12px',
    color: '#000',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.8rem', fontWeight: '700',
    cursor: 'pointer', letterSpacing: '2px',
    marginTop: '8px', transition: 'all 0.3s',
  },
  footer: {
    textAlign: 'center', marginTop: '24px',
    color: '#64748b', fontSize: '0.95rem',
  },
};
