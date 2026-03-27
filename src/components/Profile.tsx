import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaArrowLeft,
  FaUser,
  FaEnvelope,
  FaBriefcase,
  FaSave,
  FaCamera,
  FaBirthdayCake,
  FaLock,
  FaLink,
} from 'react-icons/fa';
import { authService } from '../services/auth.service';
import { clientUpdatesService } from '../services/client-updates.service';
import './Profile.css';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || '',
    avatarUrl: user?.avatarUrl || '',
    birthday: user?.birthday ? user.birthday.split('T')[0] : '',
    bio: user?.bio || '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    setAvatarPreview(URL.createObjectURL(file));
    setLoading(true);
    try {
      const url = await clientUpdatesService.uploadImage(file);
      setFormData((prev) => ({ ...prev, avatarUrl: url }));
      setMessage('Profile picture updated. Click Save to apply.');
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Failed to upload image');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const payload: Record<string, string> = {};
      if (formData.name) payload.name = formData.name;
      if (formData.email) payload.email = formData.email;
      if (formData.avatarUrl) payload.avatarUrl = formData.avatarUrl;
      if (formData.birthday) payload.birthday = formData.birthday;
      if (formData.bio !== undefined) payload.bio = formData.bio;

      await authService.updateProfile(payload);
      setMessage('Profile updated successfully!');
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage('New passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setPasswordMessage('Password must be at least 6 characters');
      return;
    }
    setPasswordLoading(true);
    setPasswordMessage('');
    try {
      await authService.changePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordMessage('Password updated successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordSection(false);
    } catch (err: any) {
      setPasswordMessage(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleOpenMbtiTest = () => {
    navigate('/mbti-assessment');
  };

  const displayUser = { ...user, ...formData, avatarUrl: formData.avatarUrl || user?.avatarUrl };

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
            <div
              className="profile-avatar-wrapper"
              onClick={handleAvatarClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleAvatarClick()}
              aria-label="Change profile picture"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarSelect}
                className="profile-avatar-input"
              />
              <div className="profile-avatar-large">
                {avatarPreview || formData.avatarUrl ? (
                  <img src={avatarPreview || formData.avatarUrl || ''} alt="Profile" />
                ) : (
                  displayUser?.name?.charAt(0).toUpperCase() || '?'
                )}
              </div>
              <span className="profile-avatar-overlay">
                <FaCamera /> Change photo
              </span>
            </div>
            <h2>{displayUser?.name}</h2>
            <p className="profile-email">{displayUser?.email}</p>
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
              <input
                type="text"
                value={formData.role}
                readOnly
                className="profile-role-readonly"
              />
            </div>

            <div className="form-group-profile">
              <label>
                <FaBirthdayCake className="label-icon" />
                Birthday
              </label>
              <input
                type="date"
                name="birthday"
                value={formData.birthday}
                onChange={handleChange}
              />
            </div>

            <div className="form-group-profile">
              <label>Bio</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows={4}
                placeholder="Tell us a bit about yourself..."
                maxLength={1000}
              />
              <span className="profile-char-count">{formData.bio.length}/1000</span>
            </div>

            {message && (
              <div className={`profile-message ${message.includes('Failed') ? 'error' : 'success'}`}>
                {message}
              </div>
            )}

            <button type="submit" className="btn-primary-profile" disabled={loading}>
              <FaSave /> {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

          <div className="profile-password-section">
            {!showPasswordSection ? (
              <button
                type="button"
                className="profile-password-toggle"
                onClick={() => setShowPasswordSection(true)}
              >
                <FaLock /> Change Password
              </button>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="profile-password-form">
                <h3>Change Password</h3>
                <div className="form-group-profile">
                  <label>Current Password</label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <div className="form-group-profile">
                  <label>New Password</label>
                  <input
                    type="password"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <div className="form-group-profile">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    required
                    autoComplete="new-password"
                  />
                </div>
                {passwordMessage && (
                  <div
                    className={`profile-message ${
                      passwordMessage.includes('Failed') || passwordMessage.includes('do not match')
                        ? 'error'
                        : 'success'
                    }`}
                  >
                    {passwordMessage}
                  </div>
                )}
                <div className="profile-password-actions">
                  <button
                    type="button"
                    className="btn-secondary-profile"
                    onClick={() => {
                      setShowPasswordSection(false);
                      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                      setPasswordMessage('');
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary-profile" disabled={passwordLoading}>
                    {passwordLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="profile-password-section">
            <button
              type="button"
              className="profile-password-toggle"
              onClick={handleOpenMbtiTest}
            >
              <FaLink /> Take MBTI Test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
