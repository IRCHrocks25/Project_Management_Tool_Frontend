import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { projectService } from '../../services/project.service';
import '../Dashboard.css';

const FounderDashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await projectService.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/');
  };

  if (loading) {
    return <div className="loading">Loading analytics...</div>;
  }

  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <div className="nav-container">
          <h2>Katalyst PM - Analytics</h2>
          <div className="nav-right">
            <div className="user-profile">
              <div className="avatar">{user?.name?.charAt(0).toUpperCase()}</div>
              <div className="user-info">
                <span className="user-name">{user?.name}</span>
                <span className="user-role">{user?.role}</span>
              </div>
            </div>
            <button onClick={handleLogout} className="btn-secondary">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="dashboard-content">
        <div className="dashboard-header">
          <h1>Analytics Dashboard</h1>
          <p className="dashboard-subtitle">Overview of all projects and performance metrics</p>
        </div>

        <div className="analytics-grid">
          <div className="analytics-card">
            <h3>Total Projects</h3>
            <div className="analytics-value">{stats?.total || 0}</div>
          </div>
          <div className="analytics-card">
            <h3>Active Projects</h3>
            <div className="analytics-value">
              {stats?.byStage?.reduce((acc: number, s: any) => acc + (s.stage !== 'Closed' ? parseInt(s.count) : 0), 0) || 0}
            </div>
          </div>
          <div className="analytics-card">
            <h3>Projects by Stage</h3>
            <div className="stage-breakdown">
              {stats?.byStage?.map((s: any) => (
                <div key={s.stage} className="stage-item">
                  <span>{s.stage}</span>
                  <span>{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FounderDashboard;

