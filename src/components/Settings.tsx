import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaBell, FaEnvelope, FaSave } from 'react-icons/fa';
import './Settings.css';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    emailNotifications: true,
    dailyDigest: false,
    taskReminders: true,
    projectUpdates: true,
    theme: 'light',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleToggle = (key: string) => {
    setSettings({
      ...settings,
      [key]: !settings[key as keyof typeof settings],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    // In a real app, you'd save via API
    setTimeout(() => {
      localStorage.setItem('userSettings', JSON.stringify(settings));
      setMessage('Settings saved successfully!');
      setLoading(false);
    }, 500);
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button onClick={() => navigate('/dashboard')} className="back-button-settings">
          <FaArrowLeft /> Back to Dashboard
        </button>
        <h1>Settings</h1>
      </div>

      <div className="settings-content">
        <div className="settings-card">
          <h2 className="settings-section-title">Notifications</h2>
          
          <div className="settings-list">
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-header">
                  <FaEnvelope className="setting-icon" />
                  <div>
                    <h4>Email Notifications</h4>
                    <p>Receive email alerts for important updates</p>
                  </div>
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={() => handleToggle('emailNotifications')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-header">
                  <FaBell className="setting-icon" />
                  <div>
                    <h4>Daily Digest</h4>
                    <p>Get a summary of all project updates</p>
                  </div>
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.dailyDigest}
                  onChange={() => handleToggle('dailyDigest')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-header">
                  <FaBell className="setting-icon" />
                  <div>
                    <h4>Task Reminders</h4>
                    <p>Get notified when tasks are due</p>
                  </div>
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.taskReminders}
                  onChange={() => handleToggle('taskReminders')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-header">
                  <FaBell className="setting-icon" />
                  <div>
                    <h4>Project Updates</h4>
                    <p>Notifications when projects change stages</p>
                  </div>
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.projectUpdates}
                  onChange={() => handleToggle('projectUpdates')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          {message && (
            <div className="settings-message success">{message}</div>
          )}

          <button onClick={handleSubmit} className="btn-primary-settings" disabled={loading}>
            <FaSave /> {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;

