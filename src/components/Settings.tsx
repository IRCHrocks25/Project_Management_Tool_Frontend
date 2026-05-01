import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaBell, FaEnvelope, FaSave } from 'react-icons/fa';
import { authService } from '../services/auth.service';
import './Settings.css';

type SettingsState = {
  emailNotifications: boolean;
  dailyDigest: boolean;
  taskReminders: boolean;
  projectUpdates: boolean;
  theme: 'light' | 'dark';
};

type ToggleSettingKey = Exclude<keyof SettingsState, 'theme'>;

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SettingsState>({
    emailNotifications: true,
    dailyDigest: false,
    taskReminders: true,
    projectUpdates: true,
    theme: 'light',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const user = authService.getUser();
    const saved = localStorage.getItem('userSettings');
    const localSettings = saved ? JSON.parse(saved) : null;

    setSettings({
      emailNotifications:
        typeof user?.emailNotificationsEnabled === 'boolean'
          ? user.emailNotificationsEnabled
          : localSettings?.emailNotifications ?? true,
      dailyDigest: localSettings?.dailyDigest ?? false,
      taskReminders: localSettings?.taskReminders ?? true,
      projectUpdates: localSettings?.projectUpdates ?? true,
      theme: localSettings?.theme === 'dark' ? 'dark' : 'light',
    });
  }, []);

  const handleToggle = (key: ToggleSettingKey) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setMessage('');
    setErrorMessage('');

    try {
      // Persist notification preference on backend so email webhook obeys the toggle.
      await authService.updateProfile({
        emailNotificationsEnabled: settings.emailNotifications,
      });

      // Keep non-backend settings local for now.
      localStorage.setItem('userSettings', JSON.stringify(settings));
      setMessage('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      setErrorMessage('Failed to save settings. Please try again.');
    } finally {
      setLoading(false);
    }
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

          {errorMessage && (
            <div className="settings-message" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
              {errorMessage}
            </div>
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

