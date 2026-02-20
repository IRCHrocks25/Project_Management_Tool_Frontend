import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, LoginData } from '../services/auth.service';
import ForgotPasswordModal from './ForgotPasswordModal';
import './Auth.css';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<LoginData>({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Clear localStorage before login to prevent 431 errors
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    try {
      await authService.login(formData);
      navigate('/dashboard');
    } catch (err: any) {
      if (err.response?.status === 431) {
        // Clear everything and show helpful message
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
    <div className="auth-container">
      <div className="auth-card">
        <h1>Welcome Back</h1>
        <p className="auth-subtitle">Log in to your Katalyst PM account</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Enter your password"
            />
          </div>

          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1rem', marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            style={{ 
              background: 'none',
              border: 'none',
              fontSize: '0.875rem', 
              color: '#667eea', 
              textDecoration: 'none',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: 0,
            }}
          >
            Forgot password?
          </button>
        </div>

        <p className="auth-footer">
          Don't have an account?{' '}
          <a href="/signup" onClick={(e) => { e.preventDefault(); navigate('/signup'); }}>
            Sign up
          </a>
        </p>
      </div>

      {showForgotPassword && (
        <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />
      )}
    </div>
  );
};

export default Login;

