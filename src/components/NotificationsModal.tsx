import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaTimes, FaBell, FaCheckCircle, FaEnvelope, FaExclamationTriangle, FaCheck } from 'react-icons/fa';
import { notificationService, Notification } from '../services/notification.service';
import { authService } from '../services/auth.service';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
  onMarkAllAsRead?: () => void;
  onOpenTaskConversation?: (
    projectId: string,
    taskId: string,
    tab?: 'details' | 'conversation',
  ) => void | Promise<void>;
}

const DEPARTMENT_ORDER = [
  'Design',
  'Copy Writing',
  'Development',
  'AI',
  'Social Media',
  'CRM',
  'SEO/GEO',
  'General',
] as const;

const TASK_TYPE_TO_DEPARTMENT: Record<string, string> = {
  copy: 'Copy Writing',
  design: 'Design',
  dev: 'Development',
  development: 'Development',
  ai: 'AI',
  'social media': 'Social Media',
  crm: 'CRM',
  'seo/geo': 'SEO/GEO',
  seo_geo: 'SEO/GEO',
  seo: 'SEO/GEO',
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  .nm-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    padding: 56px 16px 16px;
    pointer-events: none;
  }

  .nm-panel {
    --bg: #ffffff;
    --surface: #f8f9fb;
    --border: #e8ecf0;
    --border-strong: #d0d7de;
    --text-primary: #0f1923;
    --text-secondary: #4a5568;
    --text-muted: #94a3b8;
    --accent: #2563eb;
    --accent-light: #eff6ff;
    --unread-bg: #fafbff;

    font-family: 'Instrument Sans', sans-serif;
    pointer-events: all;
    width: 380px;
    max-height: calc(100vh - 80px);
    background: var(--bg);
    border-radius: 14px;
    border: 1px solid var(--border);
    box-shadow: 0 24px 64px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: panelIn 0.18s ease;
  }
  .nm-panel.pm-columns {
    width: min(1080px, calc(100vw - 48px));
    max-width: min(1080px, calc(100vw - 48px));
  }
  @keyframes panelIn {
    from { opacity: 0; transform: translateY(-8px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* Header */
  .nm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px 14px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .nm-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .nm-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.01em;
  }
  .nm-unread-badge {
    padding: 2px 8px;
    background: var(--accent);
    color: white;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    font-family: 'DM Mono', monospace;
    letter-spacing: 0.02em;
  }
  .nm-close {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 11px;
    transition: all 0.12s;
    flex-shrink: 0;
  }
  .nm-close:hover { background: #fff1f2; border-color: #fecdd3; color: #dc2626; }

  /* Actions bar */
  .nm-actions {
    padding: 9px 18px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
  }
  .nm-mark-all {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border: 1px solid var(--border);
    border-radius: 7px;
    background: white;
    color: var(--text-secondary);
    font-family: 'Instrument Sans', sans-serif;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s;
  }
  .nm-mark-all:hover { border-color: #bbf7d0; background: #f0fdf4; color: #16a34a; }

  /* List */
  .nm-list {
    overflow-y: auto;
    flex: 1;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  .nm-list::-webkit-scrollbar { width: 4px; }
  .nm-list::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }

  .nm-columns {
    display: flex;
    gap: 10px;
    padding: 10px;
    overflow-x: auto;
    overflow-y: hidden;
    flex: 1;
    min-height: 0;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
    background: #f8fafc;
  }
  .nm-columns::-webkit-scrollbar { height: 6px; }
  .nm-columns::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 999px; }
  .nm-column {
    min-width: 240px;
    max-width: 280px;
    flex: 1 0 250px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: white;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
  .nm-column-head {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .nm-column-title {
    margin: 0;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: 0.01em;
    text-transform: uppercase;
  }
  .nm-column-count {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: var(--text-muted);
    background: white;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 2px 7px;
    font-weight: 600;
  }
  .nm-column-count.unread {
    color: #1d4ed8;
    border-color: #bfdbfe;
    background: #eff6ff;
  }
  .nm-column-body {
    overflow-y: auto;
    max-height: calc(100vh - 210px);
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  .nm-column-body::-webkit-scrollbar { width: 4px; }
  .nm-column-body::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }

  /* Notification item */
  .nm-item {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    padding: 13px 18px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    transition: background 0.1s;
    position: relative;
  }
  .nm-item:last-child { border-bottom: none; }
  .nm-item:hover { background: var(--surface); }
  .nm-item.unread { background: var(--unread-bg); }
  .nm-item.unread:hover { background: #f0f5ff; }
  .nm-column .nm-item {
    padding: 10px 11px;
    gap: 9px;
  }
  .nm-column .nm-icon-wrap {
    width: 28px;
    height: 28px;
    font-size: 11px;
  }
  .nm-column .nm-item-title {
    font-size: 12px;
  }
  .nm-column .nm-message {
    font-size: 11.5px;
    margin-bottom: 3px;
  }
  .nm-column .nm-time {
    font-size: 10px;
  }

  /* Unread left stripe */
  .nm-item.unread::before {
    content: '';
    position: absolute;
    left: 0;
    top: 12px;
    bottom: 12px;
    width: 3px;
    background: var(--accent);
    border-radius: 0 3px 3px 0;
  }

  /* Icon */
  .nm-icon-wrap {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .nm-icon-wrap.task          { background: #f0fdf4; color: #16a34a; }
  .nm-icon-wrap.task-available{ background: #eff6ff; color: #2563eb; }
  .nm-icon-wrap.email         { background: #f5f3ff; color: #6d28d9; }
  .nm-icon-wrap.alert         { background: #fff7ed; color: #d97706; }
  .nm-icon-wrap.default       { background: var(--surface); color: var(--text-muted); border: 1px solid var(--border); }

  /* Content */
  .nm-content { flex: 1; min-width: 0; }
  .nm-item-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    margin-bottom: 2px;
  }
  .nm-item-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }
  .nm-unread-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    flex-shrink: 0;
  }
  .nm-message {
    font-size: 12.5px;
    color: var(--text-secondary);
    margin: 0 0 4px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .nm-time {
    font-size: 11px;
    color: var(--text-muted);
    font-family: 'DM Mono', monospace;
  }

  /* Empty / loading */
  .nm-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 52px 24px;
    gap: 10px;
    text-align: center;
  }
  .nm-empty-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: var(--text-muted);
  }
  .nm-empty h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }
  .nm-empty p {
    font-size: 12.5px;
    color: var(--text-muted);
    margin: 0;
  }

  /* Loading skeleton */
  .nm-skeleton {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .nm-skeleton-item {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    padding: 13px 18px;
    border-bottom: 1px solid var(--border);
  }
  .nm-skel {
    background: linear-gradient(90deg, #f1f4f8 25%, #e8ecf0 50%, #f1f4f8 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 6px;
  }
  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;

const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen, onClose, onUpdate, onMarkAllAsRead,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = authService.getUser();
  const isPMViewer = currentUser?.role === 'Project Manager' || !!currentUser?.isHeadPM;

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await notificationService.getAll();
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
      if (onUpdate) onUpdate();
    }
  }, [isOpen, loadNotifications, onUpdate]);

  // Real-time: when modal is open and a new notification arrives, refresh list without closing
  useEffect(() => {
    if (!isOpen) return;
    notificationService.connectSocket();
    const unsub = notificationService.onNewNotification(() => {
      loadNotifications();
      if (onUpdate) onUpdate();
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [isOpen, loadNotifications, onUpdate]);

  const handleMarkAllAsRead = async () => {
    try {
      if (onMarkAllAsRead) onMarkAllAsRead();
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      if (onUpdate) setTimeout(() => onUpdate!(), 500);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    try {
      if (!notification.isRead) {
        await notificationService.markAsRead(notification.id);
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
        if (onUpdate) onUpdate();
      }
      const shouldOpenConversation = notification.type === 'mention' || notification.type === 'task_update';

      let path = '/dashboard';
      if (notification.projectId && notification.taskId) {
        path = `/project/${notification.projectId}?task=${notification.taskId}&tab=${shouldOpenConversation ? 'conversation' : 'details'}`;
      } else if (notification.projectId) {
        path = `/project/${notification.projectId}`;
      }

      const url = window.location.origin + path;
      window.open(url, '_blank', 'noopener,noreferrer');
      onClose();
    } catch (error) {
      console.error('Failed to handle notification click:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getDepartmentFromTaskType = (taskType?: string): string | null => {
    if (!taskType) return null;
    const normalized = taskType.toLowerCase();
    return TASK_TYPE_TO_DEPARTMENT[normalized] || null;
  };

  const inferDepartmentFromText = (title: string, message: string): string | null => {
    const combined = `${title} ${message}`.toLowerCase();
    const matches = Object.entries(TASK_TYPE_TO_DEPARTMENT).find(([token]) => combined.includes(token));
    return matches?.[1] || null;
  };

  const getNotificationDepartment = (notification: Notification): string => {
    const taskType = notification.task?.type;
    const byTask = getDepartmentFromTaskType(taskType);
    if (byTask) return byTask;
    const byText = inferDepartmentFromText(notification.title, notification.message);
    return byText || 'General';
  };

  const groupedByDepartment = useMemo(() => {
    if (!isPMViewer) return null;
    const groups: Record<string, Notification[]> = {};
    notifications.forEach((notification) => {
      const department = getNotificationDepartment(notification);
      if (!groups[department]) groups[department] = [];
      groups[department].push(notification);
    });
    return groups;
  }, [notifications, isPMViewer]);

  const pmDepartments = useMemo(() => {
    if (!groupedByDepartment) return [];
    const activeDepartments = Object.keys(groupedByDepartment);
    return [...DEPARTMENT_ORDER]
      .filter((department) => activeDepartments.includes(department))
      .sort((a, b) => DEPARTMENT_ORDER.indexOf(a) - DEPARTMENT_ORDER.indexOf(b));
  }, [groupedByDepartment]);

  if (!isOpen) return null;

  const formatTime = (dateString: string) => {
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getIconMeta = (type: string): { icon: React.ReactNode; cls: string } => {
    switch (type) {
      case 'task':
      case 'task_completed':  return { icon: <FaCheckCircle />, cls: 'task' };
      case 'task_available':  return { icon: <FaBell />,        cls: 'task-available' };
      case 'email':           return { icon: <FaEnvelope />,    cls: 'email' };
      case 'alert':
      case 'project_stage':
      case 'revision':        return { icon: <FaExclamationTriangle />, cls: 'alert' };
      default:                return { icon: <FaBell />,        cls: 'default' };
    }
  };

  const renderNotificationItem = (notification: Notification) => {
    const { icon, cls } = getIconMeta(notification.type);
    return (
      <div
        key={notification.id}
        className={`nm-item ${notification.isRead ? 'read' : 'unread'}`}
        onClick={() => handleNotificationClick(notification)}
      >
        <div className={`nm-icon-wrap ${cls}`}>{icon}</div>
        <div className="nm-content">
          <div className="nm-item-head">
            <h4 className="nm-item-title">{notification.title}</h4>
            {!notification.isRead && <div className="nm-unread-dot" />}
          </div>
          <p className="nm-message">{notification.message}</p>
          <span className="nm-time">{formatTime(notification.createdAt)}</span>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{STYLES}</style>
      <div className="nm-overlay" onClick={onClose}>
        <div className={`nm-panel ${isPMViewer ? 'pm-columns' : ''}`} onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="nm-header">
            <div className="nm-header-left">
              <h2 className="nm-title">Notifications</h2>
              {unreadCount > 0 && (
                <span className="nm-unread-badge">{unreadCount}</span>
              )}
            </div>
            <button className="nm-close" onClick={onClose}><FaTimes /></button>
          </div>

          {/* Mark all read */}
          {!loading && unreadCount > 0 && (
            <div className="nm-actions">
              <button className="nm-mark-all" onClick={handleMarkAllAsRead}>
                <FaCheck style={{ fontSize: 9 }} /> Mark all as read
              </button>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="nm-skeleton">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="nm-skeleton-item">
                  <div className="nm-skel" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div className="nm-skel" style={{ height: 12, width: '60%' }} />
                    <div className="nm-skel" style={{ height: 11, width: '90%' }} />
                    <div className="nm-skel" style={{ height: 10, width: '30%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="nm-empty">
              <div className="nm-empty-icon"><FaBell /></div>
              <h3>All caught up!</h3>
              <p>You have no new notifications</p>
            </div>
          ) : (
            isPMViewer ? (
              <div className="nm-columns">
                {pmDepartments.map((department) => {
                  const items = groupedByDepartment?.[department] || [];
                  const unreadInDepartment = items.filter(n => !n.isRead).length;
                  return (
                    <div key={department} className="nm-column">
                      <div className="nm-column-head">
                        <h3 className="nm-column-title">{department}</h3>
                        <span className={`nm-column-count ${unreadInDepartment > 0 ? 'unread' : ''}`}>
                          {items.length}
                        </span>
                      </div>
                      <div className="nm-column-body">
                        {items.map(renderNotificationItem)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="nm-list">
                {notifications.map(renderNotificationItem)}
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationsModal;