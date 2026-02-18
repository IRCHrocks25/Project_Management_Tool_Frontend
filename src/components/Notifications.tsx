import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaBell, FaCheckCircle, FaCircle, FaEnvelope, FaExclamationTriangle } from 'react-icons/fa';
import { authService } from '../services/auth.service';
import './Notifications.css';

const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();
  
  // Mock notifications - in real app, fetch from API
  const [notifications] = useState([
    {
      id: '1',
      type: 'task',
      title: 'New task assigned',
      message: 'You have been assigned to "Complete C1" for Test Client Name',
      time: '2 hours ago',
      read: false,
    },
    {
      id: '2',
      type: 'email',
      title: 'Email sent',
      message: 'Email sent to client for Katalyst project',
      time: '1 day ago',
      read: false,
    },
    {
      id: '3',
      type: 'alert',
      title: 'Project needs attention',
      message: 'ICON project has been in Copy stage for 5 days',
      time: '2 days ago',
      read: true,
    },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task': return <FaCheckCircle className="notification-icon task" />;
      case 'email': return <FaEnvelope className="notification-icon email" />;
      case 'alert': return <FaExclamationTriangle className="notification-icon alert" />;
      default: return <FaBell className="notification-icon" />;
    }
  };

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <button onClick={() => navigate('/dashboard')} className="back-button-notifications">
          <FaArrowLeft /> Back to Dashboard
        </button>
        <div className="header-content">
          <h1>Notifications</h1>
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount} unread</span>
          )}
        </div>
      </div>

      <div className="notifications-content">
        <div className="notifications-card">
          {notifications.length === 0 ? (
            <div className="empty-notifications">
              <FaBell className="empty-icon" />
              <h3>All caught up!</h3>
              <p>You have no new notifications</p>
            </div>
          ) : (
            <div className="notifications-list">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                >
                  <div className="notification-icon-wrapper">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-header-item">
                      <h4>{notification.title}</h4>
                      {!notification.read && <div className="unread-dot"></div>}
                    </div>
                    <p className="notification-message">{notification.message}</p>
                    <span className="notification-time">{notification.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;

