import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuthData, logout } from '../services/api';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName, role } = getAuthData();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Gallery removed. Contact now routes to the /contact page.
  const navLinks = [
    { label: 'Home',         href: '/'           },
    { label: 'How It Works', href: '/#how-it-works' },
    { label: 'Contact',      href: '/contact'    },
  ];

  return (
    <nav style={styles.nav}>
      <div style={styles.inner}>
        {/* Logo */}
        <div style={styles.logo} onClick={() => navigate('/')}>
          ⬡ AI<span style={{ color: '#00f5ff' }}>_RESUME_ANALYZER</span>
        </div>

        {/* Nav Links */}
        <div style={styles.links}>
          {navLinks.map((link, i) => {
            const isActive = link.href === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(link.href.split('#')[0]) && link.href !== '/';
            return (
              <a
                key={i}
                href={link.href}
                style={{
                  ...styles.link,
                  color: isActive ? '#00f5ff' : '#94a3b8',
                }}
              >
                {link.label}
              </a>
            );
          })}
        </div>

        {/* Auth Buttons */}
        <div style={styles.authRow}>
          {userName ? (
            <>
              <span style={styles.userChip}>
                {role === 'INTERVIEWER' ? '🏢' : '👤'} {userName}
              </span>
              <button style={styles.btnOutline} onClick={handleLogout}>
                Sign Out
              </button>
            </>
          ) : (
            <>
              <button style={styles.btnOutline} onClick={() => navigate('/login')}>
                Sign In
              </button>
              <button style={styles.btnPrimary} onClick={() => navigate('/register')}>
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
    background: 'rgba(5,5,16,0.85)',
    borderBottom: '1px solid rgba(0,245,255,0.08)',
    backdropFilter: 'blur(20px)',
  },
  inner: {
    maxWidth: '1200px', margin: '0 auto',
    padding: '0 32px', height: '70px',
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: '32px',
  },
  logo: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1.2rem', fontWeight: '900',
    color: 'white', cursor: 'pointer', letterSpacing: '2px',
  },
  links: { display: 'flex', gap: '32px', flex: 1, justifyContent: 'center' },
  link: {
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: '0.95rem', fontWeight: '600',
    textDecoration: 'none', transition: 'color 0.2s',
    letterSpacing: '0.5px',
  },
  authRow: { display: 'flex', alignItems: 'center', gap: '12px' },
  userChip: {
    padding: '6px 14px',
    background: 'rgba(0,245,255,0.08)',
    border: '1px solid rgba(0,245,255,0.2)',
    borderRadius: '20px', color: '#00f5ff',
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: '0.9rem', fontWeight: '600',
  },
  btnOutline: {
    padding: '8px 20px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px', color: '#94a3b8',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.65rem', cursor: 'pointer',
    letterSpacing: '1px', transition: 'all 0.2s',
  },
  btnPrimary: {
    padding: '8px 20px',
    background: 'linear-gradient(135deg, #00f5ff, #3b82f6)',
    border: 'none', borderRadius: '8px',
    color: '#000', fontFamily: "'Orbitron', monospace",
    fontSize: '0.65rem', fontWeight: '700',
    cursor: 'pointer', letterSpacing: '1px',
  },
};
