import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { authService, LoginData } from '../services/auth.service';
import { FaEye, FaEyeSlash, FaExclamationCircle } from 'react-icons/fa';
import ForgotPasswordModal from './ForgotPasswordModal';
import './Login.css';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [formData, setFormData] = useState<LoginData>({ email: '', password: '' });
  const [error, setError] = useState<string>('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const getSafeRedirectPath = (): string => {
    const stateFrom = (location.state as { from?: string } | null)?.from;
    const queryRedirect = searchParams.get('redirect') || '';
    let storedRedirect = '';
    try {
      storedRedirect = sessionStorage.getItem('postLoginRedirect') || '';
    } catch {
      storedRedirect = '';
    }

    const candidate = [stateFrom, queryRedirect, storedRedirect].find((value) => typeof value === 'string' && !!value) || '/dashboard';
    return candidate.startsWith('/') ? candidate : '/dashboard';
  };

  useEffect(() => {
    if (searchParams.get('session') === 'expired') {
      setSessionExpired(true);
      const next = new URLSearchParams(searchParams);
      next.delete('session');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setSessionExpired(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    try {
      await authService.login(formData);
      const returnTo = getSafeRedirectPath();
      try {
        sessionStorage.removeItem('postLoginRedirect');
        sessionStorage.removeItem('roleDashboard.viewMode');
      } catch {
        // Ignore storage failures.
      }
      navigate(returnTo, { replace: true });
    } catch (err: any) {
      if (err.response?.status === 431) {
        localStorage.clear();
        setError('Request header too large. Cleared browser storage. Please try again.');
      } else {
        setError(err.response?.data?.message || 'Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="kl-page">
      <main className="kl-card">
        <a href="/" className="kl-brand">
          <span className="kl-mark" aria-hidden="true">K</span>
          <span>Katalyst PM</span>
        </a>

        <h1 className="kl-heading">Welcome back</h1>
        <p className="kl-sub">Sign in to continue to your workspace</p>

        {sessionExpired && (
          <div className="kl-notice" role="status">Your session has expired. Please log in again.</div>
        )}

        {error && (
          <div className="kl-error" role="alert">
            <FaExclamationCircle aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form className="kl-form" onSubmit={handleSubmit}>
          <div className="kl-field">
            <label htmlFor="email">Email</label>
            <input
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

          <div className="kl-field">
            <div className="kl-label-row">
              <label htmlFor="password">Password</label>
              <button type="button" className="kl-link" onClick={() => setShowForgotPassword(true)}>
                Forgot password?
              </button>
            </div>
            <div className="kl-password">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Your password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="kl-eye"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <button type="submit" className="kl-submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="kl-foot">No account yet? Ask your Head PM or Founder to add you.</p>
      </main>

      {showForgotPassword && <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />}
    </div>
  );
};

export default Login;
