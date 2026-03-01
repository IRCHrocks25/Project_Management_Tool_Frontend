import React, { useState, useEffect, useCallback } from 'react';
import { FaTimes, FaBell, FaCheckCircle, FaEnvelope, FaExclamationTriangle } from 'react-icons/fa';
import { notificationService, Notification } from '../services/notification.service';
import { authService } from '../services/auth.service';
import './NotificationsModal.css';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void; // Callback to refresh unread count in parent
  onMarkAllAsRead?: () => void; // Callback to immediately reset count to 0
}

const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose, onUpdate, onMarkAllAsRead }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const user = authService.getUser();

  const loadNotifications = useCallback(async () => {
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
  }, [user?.id]);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
      // Trigger parent update to refresh unread count
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      // Immediately reset count to 0 for instant feedback
      if (onMarkAllAsRead) {
        onMarkAllAsRead();
      }
      
      // Wait for the backend request to complete
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      
      // Don't refresh immediately - the count is already 0
      // The periodic refresh (every 30 seconds) will keep it accurate
      // Only refresh if there's an error to get accurate state
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      // If error, refresh count to get accurate state
      if (onUpdate) {
        setTimeout(() => {
          onUpdate();
        }, 500);
      }
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.isRead).length;

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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task':
      case 'task_completed': return <FaCheckCircle className="notification-icon task" />;
      case 'email': return <FaEnvelope className="notification-icon email" />;
      case 'alert':
      case 'project_stage':
      case 'revision': return <FaExclamationTriangle className="notification-icon alert" />;
      default: return <FaBell className="notification-icon" />;
    }
  };

  return (
    <div className="notifications-modal-overlay" onClick={onClose}>
      <div className="notifications-modal" onClick={(e) => e.stopPropagation()}>
        <div className="notifications-modal-header">
          <div className="header-content">
            <h2>Notifications</h2>
            {unreadCount > 0 && (
              <span className="unread-badge">{unreadCount} unread</span>
            )}
          </div>
          <button className="close-button" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="notifications-modal-content">
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
                <div className="notifications-actions">
                  <button onClick={handleMarkAllAsRead} className="mark-all-read-btn">
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

export default NotificationsModal;

