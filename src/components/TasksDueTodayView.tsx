import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaClock, FaUser, FaFolder, FaChevronRight, FaBell, FaCog, FaSignOutAlt } from 'react-icons/fa';
import { authService } from '../services/auth.service';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import { notificationService } from '../services/notification.service';
import NotificationsModal from './NotificationsModal';
import './Dashboard.css';

const TasksDueTodayView: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksData, projectsData, usersData] = await Promise.all([
        taskService.getAll(undefined, undefined, { all: true }),
        projectService.getAll(),
        authService.getAllUsers(),
      ]);
      setTasks(tasksData);
      setProjects(projectsData || []);
      setUsers(usersData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUnreadCount = async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadNotifications(count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  useEffect(() => {
    loadData();
    loadUnreadCount();
  }, [loadData]);

  const today = new Date();
  const todayString = today.toDateString();

  const tasksDueToday = tasks.filter((task) => {
    if (!task.dueDate || task.isCompleted || task.status === 'Completed') return false;
    const dueDate = new Date(task.dueDate);
    return dueDate.toDateString() === todayString;
  });

  const projectMap = new Map(projects.map((p: any) => [p.id, p]));
  const userMap = new Map(users.map((u: any) => [u.id, u]));

  const getProjectName = (projectId: string) => {
    const p = projectMap.get(projectId);
    return p?.clientName || 'Unknown Project';
  };

  const getAssigneeName = (task: any) => {
    const assignees = task.assignees || [];
    if (assignees.length > 0) {
      const first = assignees[0];
      const uid = first.userId || first.user?.id;
      const u = uid ? userMap.get(uid) : first.user;
      return u?.name || 'Unassigned';
    }
    const uid = task.assignedToId;
    if (!uid) return 'Unassigned';
    const u = userMap.get(uid);
    return u?.name || 'Unassigned';
  };

  const handleSignOut = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="dashboard-container premium-dashboard" style={{ minHeight: '100vh', background: '#f5f6fa' }}>
      {/* Header - match PM Dashboard style */}
      <header className="dashboard-header premium-header" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="header-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '1600px', margin: '0 auto', padding: '0 2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                padding: '0.5rem 0'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#1e293b';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#64748b';
              }}
            >
              <FaArrowLeft />
              Back to Dashboard
            </button>
            <span style={{ color: '#cbd5e1', fontSize: '0.875rem' }}>|</span>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
              Tasks Due Today
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => setShowNotificationsModal(true)}
              style={{
                position: 'relative',
                background: 'transparent',
                border: 'none',
                padding: '0.5rem',
                cursor: 'pointer',
                color: '#64748b',
                borderRadius: '8px'
              }}
            >
              <FaBell style={{ fontSize: '1.25rem' }} />
              {unreadNotifications > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    minWidth: '18px',
                    height: '18px',
                    borderRadius: '9px',
                    background: '#ef4444',
                    color: 'white',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px'
                  }}
                >
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </button>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowAvatarDropdown(!showAvatarDropdown)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {user?.name?.charAt(0) || 'U'}
              </button>
              {showAvatarDropdown && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                    onClick={() => setShowAvatarDropdown(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      minWidth: '200px',
                      background: 'white',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                      border: '1px solid #e5e7eb',
                      zIndex: 9999,
                      overflow: 'hidden'
                    }}
                  >
                    <button
                      onClick={() => { navigate('/profile'); setShowAvatarDropdown(false); }}
                      style={{ width: '100%', padding: '0.75rem 1rem', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#374151', textAlign: 'left' }}
                    >
                      <FaCog /> Profile
                    </button>
                    <button
                      onClick={handleSignOut}
                      style={{ width: '100%', padding: '0.75rem 1rem', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#dc2626', textAlign: 'left' }}
                    >
                      <FaSignOutAlt /> Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
            Loading tasks...
          </div>
        ) : tasksDueToday.length === 0 ? (
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '4rem 2rem',
              textAlign: 'center',
              boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
              border: '1px solid #e5e7eb'
            }}
          >
            <FaClock style={{ fontSize: '4rem', color: '#cbd5e1', marginBottom: '1.5rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>
              No tasks due today
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9375rem' }}>
              You're all caught up! Check back tomorrow or view your dashboard for other tasks.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                marginTop: '1.5rem',
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.9375rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
              border: '1px solid #e5e7eb',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e5e7eb',
                background: '#fafbfc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>
                {tasksDueToday.length} {tasksDueToday.length === 1 ? 'task' : 'tasks'} due today
              </h2>
              <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {tasksDueToday.map((task) => (
                <div
                  key={task.id}
                  onClick={() => navigate(`/project/${task.projectId}`)}
                  style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      flexShrink: 0
                    }}
                  >
                    <FaClock />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.25rem' }}>
                      {task.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: '#64748b' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <FaFolder style={{ fontSize: '0.75rem' }} />
                        {getProjectName(task.projectId)}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <FaUser style={{ fontSize: '0.75rem' }} />
                        {getAssigneeName(task)}
                      </span>
                      <span
                        style={{
                          padding: '0.125rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          background: task.status === 'In Review' ? '#fef3c7' : task.status === 'In Progress' ? '#dbeafe' : '#f3f4f6',
                          color: task.status === 'In Review' ? '#92400e' : task.status === 'In Progress' ? '#1e40af' : '#6b7280'
                        }}
                      >
                        {task.status || 'Todo'}
                      </span>
                    </div>
                  </div>
                  <FaChevronRight style={{ color: '#cbd5e1', fontSize: '0.875rem', flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showNotificationsModal && (
        <NotificationsModal
          isOpen={showNotificationsModal}
          onClose={() => setShowNotificationsModal(false)}
          onMarkAllAsRead={loadUnreadCount}
        />
      )}
    </div>
  );
};

export default TasksDueTodayView;
