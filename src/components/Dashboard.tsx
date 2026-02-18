import React from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();

  const handleLogout = () => {
    authService.logout();
    navigate('/');
  };

  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <div className="nav-container">
          <h2>Katalyst PM</h2>
          <div className="nav-right">
            <span className="user-info">
              {user?.name} ({user?.role})
            </span>
            <button onClick={handleLogout} className="btn-secondary">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="dashboard-content">
        <div className="container">
          <h1>Welcome to Dashboard</h1>
          <p>You're logged in as: <strong>{user?.name}</strong></p>
          <p>Your role: <strong>{user?.role}</strong></p>
          <p>Email: <strong>{user?.email}</strong></p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

