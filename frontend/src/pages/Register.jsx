// src/pages/Register.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser, saveAuthData } from '../services/api';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'CANDIDATE', phone: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await registerUser(form);
      const data = response.data;
      if (data.success) {
        saveAuthData(data);
        navigate(data.role === 'INTERVIEWER' ? '/interviewer' : '/candidate');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.orb1} />
      <div style={styles.orb2} />

      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo} onClick={() => navigate('/')}>⬡ AI<span style={{ color: '#00f5ff' }}>_RESUME_ANALYZER</span></div>
          <h2 style={styles.title}>Create Account</h2>
          <p style={styles.subtitle}>Join thousands of job seekers</p>
        </div>

        {error && <div style={styles.errorBox}>⚠️ {error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>

          <div style={styles.field}>
            <label style={styles.label}>FULL NAME</label>
            <input name="name" value={form.name} onChange={handleChange}
              placeholder="John Doe" style={styles.input} required />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>EMAIL ADDRESS</label>
            <input type="email" name="email" value={form.email} onChange={handleChange}
              placeholder="your@email.com" style={styles.input} required />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>PHONE NUMBER</label>
            <input name="phone" value={form.phone} onChange={handleChange}
              placeholder="+91 9876543210" style={styles.input} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>PASSWORD</label>
            <input type="password" name="password" value={form.password}
              onChange={handleChange} placeholder="Min 8 characters"
              style={styles.input} required minLength={8} />
          </div>

          {/* Role Selection */}
          <div style={styles.field}>
            <label style={styles.label}>I AM A</label>
            <div style={styles.roleRow}>
              {['CANDIDATE', 'INTERVIEWER'].map(role => (
                <div key={role}
                  onClick={() => setForm({ ...form, role })}
                  style={{
                    ...styles.roleOption,
                    ...(form.role === role ? styles.roleSelected : {})
                  }}>
                  {role === 'CANDIDATE' ? '👤' : '🏢'}
                  <span>{role === 'CANDIDATE' ? 'Job Seeker' : 'Recruiter'}</span>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? '⏳ Creating Account...' : '🚀 Create Account'}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#00f5ff', textDecoration: 'none' }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh', background: '#050510',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Rajdhani', sans-serif",
    position: 'relative', overflow: 'hidden', padding: '20px',
  },
  orb1: {
    position: 'fixed', top: '10%', right: '10%',
    width: '350px', height: '350px',
    background: 'radial-gradient(circle, rgba(0,245,255,0.07) 0%, transparent 70%)',
    borderRadius: '50%', pointerEvents: 'none',
  },
  orb2: {
    position: 'fixed', bottom: '10%', left: '5%',
    width: '300px', height: '300px',
    background: 'radial-gradient(circle, rgba(168,85,247,0.07) 0%, transparent 70%)',
    borderRadius: '50%', pointerEvents: 'none',
  },
  card: {
    width: '460px', padding: '44px 40px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(0,245,255,0.15)',
    borderRadius: '24px', backdropFilter: 'blur(20px)',
    position: 'relative', zIndex: 2,
  },
  header: { textAlign: 'center', marginBottom: '32px' },
  logo: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1.1rem', fontWeight: '900',
    color: 'white', marginBottom: '20px', cursor: 'pointer',
  },
  title: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1.4rem', fontWeight: '700',
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
  form: { display: 'flex', flexDirection: 'column', gap: '18px' },
  field: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.65rem', fontWeight: '700',
    color: '#00f5ff', letterSpacing: '2px',
  },
  input: {
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', color: 'white',
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: '1rem', outline: 'none',
  },
  roleRow: { display: 'flex', gap: '12px' },
  roleOption: {
    flex: 1, padding: '14px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', cursor: 'pointer',
    display: 'flex', alignItems: 'center',
    gap: '10px', color: '#94a3b8',
    fontSize: '0.95rem', fontWeight: '600',
    transition: 'all 0.2s',
  },
  roleSelected: {
    background: 'rgba(0,245,255,0.08)',
    border: '1px solid rgba(0,245,255,0.4)',
    color: '#00f5ff',
  },
  btn: {
    padding: '15px',
    background: 'linear-gradient(135deg, #00f5ff, #3b82f6)',
    border: 'none', borderRadius: '12px',
    color: '#000', fontFamily: "'Orbitron', monospace",
    fontSize: '0.8rem', fontWeight: '700',
    cursor: 'pointer', letterSpacing: '2px',
    marginTop: '6px',
  },
  footer: {
    textAlign: 'center', marginTop: '24px',
    color: '#64748b', fontSize: '0.95rem',
  },
};
