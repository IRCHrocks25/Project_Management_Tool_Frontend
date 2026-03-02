import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaBell, FaCheckCircle, FaCircle, FaEnvelope, FaExclamationTriangle } from 'react-icons/fa';
import { authService } from '../services/auth.service';
import { notificationService, Notification } from '../services/notification.service';
import './Notifications.css';

const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await notificationService.getAll();
      
      console.log('Raw notifications from API:', {
        count: data.length,
        currentUserId: user?.id,
        sample: data[0],
        firstFew: data.slice(0, 3)
      });
      
      // Backend already filters by userId in the query, so all returned notifications are for this user
      // Just use them directly - no additional filtering needed
      // (Backend query: .where('notification.userId = :userId', { userId }))
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task':
      case 'task_completed': return <FaCheckCircle className="notification-icon task" />;
      case 'task_available': return <FaBell className="notification-icon task-available" />; // New type for unassigned tasks
      case 'email': return <FaEnvelope className="notification-icon email" />;
      case 'alert':
      case 'project_stage':
      case 'revision': return <FaExclamationTriangle className="notification-icon alert" />;
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
          {loading ? (
            <div className="empty-notifications">
              <FaBell className="empty-icon" />
              <h3>Loading...</h3>
            </div>
          ) : notifications.length === 0 ? (
            <div className="empty-notifications">
              <FaBell className="empty-icon" />
              <h3>All caught up!</h3>
              <p>You have no new notifications</p>
            </div>
          ) : (
            <>
              {unreadCount > 0 && (
                <div className="notifications-actions" style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                  <button onClick={handleMarkAllAsRead} className="mark-all-read-btn" style={{
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500
                  }}>
                    Mark all as read
                  </button>
                </div>
              )}
              <div className="notifications-list">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${notification.isRead ? 'read' : 'unread'}`}
                    onClick={() => !notification.isRead && handleMarkAsRead(notification.id)}
                    style={{ cursor: notification.isRead ? 'default' : 'pointer' }}
                  >
                    <div className="notification-icon-wrapper">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="notification-content">
                      <div className="notification-header-item">
                        <h4>{notification.title}</h4>
                        {!notification.isRead && <div className="unread-dot"></div>}
                      </div>
                      <p className="notification-message">{notification.message}</p>
                      <span className="notification-time">{formatTime(notification.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;

