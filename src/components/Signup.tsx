import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, SignupData } from '../services/auth.service';

const ROLES = [
  'FOUNDER/CEO',
  'Project Manager',
  'Copy Writing',
  'Designer',
  'Developer',
  'AI Developer',
  'Social Media',
  'CRM',
  'SEO/GEO',
];

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<SignupData>({
    name: '',
    email: '',
    password: '',
    role: 'Project Manager',
  });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    try {
      await authService.signup(formData);
      navigate('/dashboard');
    } catch (err: any) {
      if (err.response?.status === 431) {
        localStorage.clear();
        setError('Request header too large. Cleared browser storage. Please try again.');
      } else {
        setError(err.response?.data?.message || 'Signup failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:wght@600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .kp-root {
          display: flex;
          min-height: 100vh;
          font-family: 'DM Sans', sans-serif;
          background: #0a0a0f;
          color: #f0eff4;
        }

        /* ── LEFT PANEL ── */
        .kp-panel-left {
          position: relative;
          flex: 1;
          display: none;
          overflow: hidden;
        }
        @media (min-width: 900px) { .kp-panel-left { display: flex; } }

        .kp-panel-bg {
          position: absolute;
          inset: 0;
          background-image: url('https://katalyst-crm.com/wp-content/uploads/2024/10/Katalyst-Project-2.1.png');
          background-size: cover;
          background-position: center top;
          filter: brightness(0.45);
          transition: transform 8s ease;
        }
        .kp-panel-left:hover .kp-panel-bg { transform: scale(1.04); }

        .kp-panel-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg,
            rgba(10,10,20,0.7) 0%,
            rgba(30,20,60,0.5) 60%,
            rgba(10,10,20,0.8) 100%
          );
        }

        .kp-panel-content {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 3rem;
          gap: 1rem;
          width: 100%;
        }

        .kp-panel-tagline {
          font-family: 'Playfair Display', serif;
          font-size: clamp(2rem, 3.5vw, 3rem);
          line-height: 1.2;
          color: #fff;
          max-width: 380px;
        }

        .kp-panel-sub {
          font-size: 0.95rem;
          color: rgba(255,255,255,0.55);
          max-width: 340px;
          line-height: 1.6;
          letter-spacing: 0.01em;
        }

        .kp-panel-dots {
          display: flex;
          gap: 6px;
          margin-top: 0.5rem;
        }
        .kp-panel-dots span {
          width: 28px; height: 3px;
          border-radius: 2px;
          background: rgba(255,255,255,0.2);
        }
        .kp-panel-dots span:first-child { background: #7c6af7; width: 48px; }

        /* ── RIGHT PANEL ── */
        .kp-panel-right {
          flex: 0 0 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 2.5rem 1.5rem;
          background: #0d0d18;
          position: relative;
          overflow-y: auto;
        }
        @media (min-width: 900px) {
          .kp-panel-right { flex: 0 0 460px; }
        }

        .kp-panel-right::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(124,106,247,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,106,247,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }

        .kp-card {
          position: relative;
          width: 100%;
          max-width: 380px;
          display: flex;
          flex-direction: column;
          padding: 2rem 0;
          animation: kp-fade-up 0.55s ease both;
        }
        @keyframes kp-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .kp-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 2rem;
        }
        .kp-logo img {
          width: 36px;
          height: 36px;
          object-fit: contain;
          border-radius: 8px;
        }
        .kp-logo-name {
          font-size: 1.1rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          color: #fff;
          text-transform: uppercase;
        }
        .kp-logo-name em {
          font-style: normal;
          color: #7c6af7;
        }

        .kp-heading {
          font-family: 'Playfair Display', serif;
          font-size: 2rem;
          font-weight: 600;
          color: #fff;
          line-height: 1.2;
          margin-bottom: 0.4rem;
        }

        .kp-sub {
          font-size: 0.875rem;
          color: rgba(255,255,255,0.45);
          margin-bottom: 1.75rem;
          letter-spacing: 0.01em;
        }

        /* ── ERROR ── */
        .kp-error {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 10px;
          padding: 0.75rem 1rem;
          font-size: 0.82rem;
          color: #fca5a5;
          margin-bottom: 1.25rem;
          line-height: 1.5;
          animation: kp-fade-up 0.3s ease;
        }
        .kp-error-icon { flex-shrink: 0; margin-top: 1px; opacity: 0.8; }

        /* ── FORM ── */
        .kp-form { display: flex; flex-direction: column; gap: 1rem; }

        /* Two-column row for name + email on wider right panel */
        .kp-field { display: flex; flex-direction: column; gap: 0.4rem; }

        .kp-label {
          font-size: 0.78rem;
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.4);
        }

        .kp-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .kp-input, .kp-select {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 0.75rem 1rem;
          font-size: 0.92rem;
          font-family: inherit;
          color: #fff;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          -webkit-appearance: none;
        }
        .kp-input::placeholder { color: rgba(255,255,255,0.2); }
        .kp-input:focus, .kp-select:focus {
          border-color: #7c6af7;
          background: rgba(124,106,247,0.06);
          box-shadow: 0 0 0 3px rgba(124,106,247,0.15);
        }
        .kp-input-pass { padding-right: 3rem; }

        /* custom select arrow */
        .kp-select-wrap {
          position: relative;
        }
        .kp-select-wrap::after {
          content: '';
          position: absolute;
          right: 1rem;
          top: 50%;
          transform: translateY(-50%);
          width: 0;
          height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-top: 5px solid rgba(255,255,255,0.35);
          pointer-events: none;
        }
        .kp-select {
          cursor: pointer;
          padding-right: 2.5rem;
        }
        .kp-select option {
          background: #1a1a2e;
          color: #f0eff4;
        }

        /* eye toggle */
        .kp-eye {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: rgba(255,255,255,0.3);
          display: flex;
          align-items: center;
          transition: color 0.2s;
          line-height: 0;
        }
        .kp-eye:hover { color: rgba(255,255,255,0.7); }

        /* ── SUBMIT ── */
        .kp-btn-submit {
          margin-top: 0.5rem;
          width: 100%;
          padding: 0.85rem 1rem;
          background: #7c6af7;
          border: none;
          border-radius: 10px;
          font-family: inherit;
          font-size: 0.92rem;
          font-weight: 600;
          letter-spacing: 0.03em;
          color: #fff;
          cursor: pointer;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s, opacity 0.2s;
          position: relative;
          overflow: hidden;
        }
        .kp-btn-submit::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent);
          pointer-events: none;
        }
        .kp-btn-submit:hover:not(:disabled) {
          background: #6a58e8;
          box-shadow: 0 4px 24px rgba(124,106,247,0.4);
          transform: translateY(-1px);
        }
        .kp-btn-submit:active:not(:disabled) { transform: translateY(0); }
        .kp-btn-submit:disabled { opacity: 0.55; cursor: not-allowed; }

        .kp-btn-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        .kp-spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: kp-spin 0.7s linear infinite;
        }
        @keyframes kp-spin { to { transform: rotate(360deg); } }

        /* ── FOOTER ── */
        .kp-links {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.85rem;
          margin-top: 1.5rem;
        }

        .kp-divider {
          width: 100%;
          height: 1px;
          background: rgba(255,255,255,0.06);
        }

        .kp-signup {
          font-size: 0.83rem;
          color: rgba(255,255,255,0.35);
        }
        .kp-signup a {
          color: #7c6af7;
          text-decoration: none;
          font-weight: 500;
          transition: opacity 0.2s;
        }
        .kp-signup a:hover { opacity: 0.75; }

        /* password strength bar */
        .kp-strength {
          display: flex;
          gap: 4px;
          margin-top: 0.4rem;
          height: 3px;
        }
        .kp-strength-seg {
          flex: 1;
          border-radius: 2px;
          background: rgba(255,255,255,0.08);
          transition: background 0.3s;
        }
        .kp-strength-seg.active-weak   { background: #ef4444; }
        .kp-strength-seg.active-fair   { background: #f97316; }
        .kp-strength-seg.active-good   { background: #eab308; }
        .kp-strength-seg.active-strong { background: #22c55e; }
      `}</style>

      <div className="kp-root">
        {/* LEFT: hero panel */}
        <div className="kp-panel-left">
          <div className="kp-panel-bg" />
          <div className="kp-panel-overlay" />
          <div className="kp-panel-content">
            <p className="kp-panel-tagline">Your team starts here.</p>
            <p className="kp-panel-sub">
              Set up your workspace in seconds and start shipping projects that matter.
            </p>
            <div className="kp-panel-dots">
              <span /><span /><span />
            </div>
          </div>
        </div>

        {/* RIGHT: form panel */}
        <div className="kp-panel-right">
          <div className="kp-card">
            {/* Logo */}
            <div className="kp-logo">
              <img
                src="https://katalyst-crm.com/wp-content/uploads/2024/09/K-1.png"
                alt="Katalyst"
              />
              <span className="kp-logo-name">Kata<em>lyst</em> PM</span>
            </div>

            <h1 className="kp-heading">Create account</h1>
            <p className="kp-sub">Get started — it only takes a moment</p>

            {error && (
              <div className="kp-error">
                <svg className="kp-error-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <form className="kp-form" onSubmit={handleSubmit}>
              {/* Full Name */}
              <div className="kp-field">
                <label className="kp-label" htmlFor="name">Full Name</label>
                <div className="kp-input-wrap">
                  <input
                    className="kp-input"
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Jane Smith"
                    autoComplete="name"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="kp-field">
                <label className="kp-label" htmlFor="email">Email</label>
                <div className="kp-input-wrap">
                  <input
                    className="kp-input"
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="you@company.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="kp-field">
                <label className="kp-label" htmlFor="password">Password</label>
                <div className="kp-input-wrap">
                  <input
                    className="kp-input kp-input-pass"
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                    placeholder="Min. 6 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="kp-eye"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    )}
                  </button>
                </div>
                {/* Password strength indicator */}
                {formData.password.length > 0 && (
                  <PasswordStrength password={formData.password} />
                )}
              </div>

              {/* Role */}
              <div className="kp-field">
                <label className="kp-label" htmlFor="role">Role / Department</label>
                <div className="kp-select-wrap">
                  <select
                    className="kp-select"
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    required
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="kp-btn-submit"
                disabled={loading}
              >
                {loading ? (
                  <span className="kp-btn-loading">
                    <span className="kp-spinner" />
                    Creating account…
                  </span>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            <div className="kp-links">
              <div className="kp-divider" />
              <p className="kp-signup">
                Already have an account?{' '}
                <a
                  href="/login"
                  onClick={(e) => { e.preventDefault(); navigate('/login'); }}
                >
                  Sign in
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

/* ── Password strength sub-component ── */
const getStrength = (pw: string): { level: number; label: string } => {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: 'weak' };
  if (score === 2) return { level: 2, label: 'fair' };
  if (score === 3) return { level: 3, label: 'good' };
  return { level: 4, label: 'strong' };
};

const PasswordStrength: React.FC<{ password: string }> = ({ password }) => {
  const { level, label } = getStrength(password);
  return (
    <div className="kp-strength" aria-label={`Password strength: ${label}`}>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`kp-strength-seg${i <= level ? ` active-${label}` : ''}`}
        />
      ))}
    </div>
  );
};

export default Signup;