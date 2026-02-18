import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, SignupData } from '../services/auth.service';
import './Auth.css';

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

    // Clear localStorage before signup to prevent 431 errors
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    try {
      await authService.signup(formData);
      navigate('/dashboard');
    } catch (err: any) {
      if (err.response?.status === 431) {
        // Clear everything and show helpful message
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
    <div className="auth-container">
      <div className="auth-card">
        <h1>Create Account</h1>
        <p className="auth-subtitle">Sign up to get started with Katalyst PM</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Enter your full name"
            />
          </div>

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
              minLength={6}
              placeholder="Enter your password (min 6 characters)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Role/Department</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
            >
              <option value="FOUNDER/CEO">FOUNDER/CEO</option>
              <option value="Project Manager">Project Manager</option>
              <option value="Copy Writing">Copy Writing</option>
              <option value="Designer">Designer</option>
              <option value="Developer">Developer</option>
              <option value="AI Developer">AI Developer</option>
              <option value="Social Media">Social Media</option>
              <option value="CRM">CRM</option>
              <option value="SEO/GEO">SEO/GEO</option>
            </select>
          </div>

          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{' '}
          <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>
            Log in
          </a>
        </p>
      </div>
    </div>
  );
};

export default Signup;

