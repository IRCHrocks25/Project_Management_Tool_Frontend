import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaUser, FaEnvelope, FaBriefcase, FaSave } from 'react-icons/fa';
import { authService } from '../services/auth.service';
import './Profile.css';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    // In a real app, you'd update via API
    setTimeout(() => {
      localStorage.setItem('user', JSON.stringify({ ...user, ...formData }));
      setMessage('Profile updated successfully!');
      setLoading(false);
    }, 500);
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <button onClick={() => navigate('/dashboard')} className="back-button-profile">
          <FaArrowLeft /> Back to Dashboard
        </button>
        <h1>Profile Settings</h1>
      </div>

      <div className="profile-content">
        <div className="profile-card">
          <div className="profile-avatar-section">
            <div className="profile-avatar-large">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <h2>{user?.name}</h2>
            <p className="profile-email">{user?.email}</p>
          </div>

          <form onSubmit={handleSubmit} className="profile-form">
            <div className="form-group-profile">
              <label>
                <FaUser className="label-icon" />
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group-profile">
              <label>
                <FaEnvelope className="label-icon" />
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group-profile">
              <label>
                <FaBriefcase className="label-icon" />
                Role/Department
              </label>
              <select name="role" value={formData.role} onChange={handleChange} required>
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

            {message && (
              <div className="profile-message success">{message}</div>
            )}

            <button type="submit" className="btn-primary-profile" disabled={loading}>
              <FaSave /> {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;

