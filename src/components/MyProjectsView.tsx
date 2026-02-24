import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaArrowLeft,
  FaUser,
  FaClock,
  FaBell,
  FaCog,
  FaSignOutAlt,
  FaChevronDown,
  FaFileAlt,
  FaExclamationTriangle,
  FaSpinner,
  FaGoogleDrive,
  FaStickyNote,
  FaLink,
  FaTimes,
} from 'react-icons/fa';
import { authService } from '../services/auth.service';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import { notificationService } from '../services/notification.service';
import NotificationsModal from './NotificationsModal';
import SendForReviewModal from './SendForReviewModal';
import './Dashboard.css';

const MyProjectsView: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedTaskForReview, setSelectedTaskForReview] = useState<any>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('list');
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const skipRefreshUntilRef = useRef<number | null>(null);
  const [deliverableHistory] = useState<Record<string, any[]>>({});
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedTaskNotes, setSelectedTaskNotes] = useState<any[]>([]);
  const [selectedTaskTitle, setSelectedTaskTitle] = useState<string>('');

  const loadUnreadCount = async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadNotifications(count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const handleTaskStatusUpdate = async (taskId: string, status: string, isCompleted?: boolean, fileUrl?: string, deliverableType?: string) => {
    try {
      setUpdatingTask(taskId);
      await taskService.updateStatus(taskId, status, isCompleted, fileUrl, deliverableType);
      await loadData();
    } catch (error) {
      console.error('Failed to update task:', error);
    } finally {
      setUpdatingTask(null);
    }
  };

  const handleSendForReview = async (task: any) => {
    setSelectedTaskForReview(task);
    setShowReviewModal(true);
    
    // Reload the project to get fresh deliverables
    try {
      const freshProject = await projectService.getOne(task.projectId);
      // Update the project in the projects array
      setProjects((prevProjects: any[]) => 
        prevProjects.map((p: any) => p.id === task.projectId ? freshProject : p)
      );
    } catch (error) {
      console.error('Failed to reload project deliverables:', error);
    }
  };

  const handleReviewSubmit = async (driveLink: string, deliverableType: string, deliverableId?: string) => {
    if (!selectedTaskForReview) return;
    
    try {
      setUpdatingTask(selectedTaskForReview.id);
      await taskService.updateStatus(selectedTaskForReview.id, 'In Review', false, driveLink, deliverableType, deliverableId);
      await loadData();
      setShowReviewModal(false);
      setSelectedTaskForReview(null);
    } catch (error) {
      console.error('Failed to send for review:', error);
      alert('Failed to send for review. Please try again.');
    } finally {
      setUpdatingTask(null);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Get all tasks assigned to the current user
      const allTasksData = await taskService.getAll();
      const myTasks = allTasksData.filter((t: any) => t.assignedToId === user?.id);
      
      // Get unique project IDs from user's tasks
      const projectIds = new Set(myTasks.map((t: any) => t.projectId));
      
      // Load all projects
      const allProjects = await projectService.getAll();
      
      // Filter to only projects where user has tasks
      const myProjects = allProjects.filter((p: any) => projectIds.has(p.id));

      setProjects(myProjects);
      setTasks(myTasks);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadUnreadCount();
    const interval = setInterval(() => {
      if (skipRefreshUntilRef.current && Date.now() < skipRefreshUntilRef.current) {
        return;
      }
      loadUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAvatarDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const isTaskOverdue = (task: any) => {
    if (!task.dueDate) return false;
    return new Date(task.dueDate).getTime() < Date.now() && !task.isCompleted;
  };

  const getDaysUntilDue = (dueDate: string) => {
    if (!dueDate) return null;
    const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getTaskBorderColor = (status: string, isCompleted: boolean, taskInRevision: boolean) => {
    if (taskInRevision) return '#dc2626';
    if (isCompleted) return '#10b981';
    if (status === 'In Review') return '#f59e0b';
    if (status === 'In Progress') return '#3b82f6';
    if (status === 'Blocked') return '#ef4444';
    return '#e5e7eb';
  };

  const hasRevisionDeliverables = (project: any) => {
    return project.deliverables?.some((d: any) => 
      ['Brand Book', 'Copy of Landing Page', 'Landing Page', 'Speaker Kit', 'Other'].includes(d.type) &&
      d.status === 'Revision'
    );
  };

  const isTaskInRevision = (task: any, project: any) => {
    if (task.deliverableId) {
      const deliverable = project.deliverables?.find((d: any) => d.id === task.deliverableId);
      if (deliverable) {
        if (deliverable.status === 'Revision') {
          return true;
        }
        const history = deliverableHistory[deliverable.id] || [];
        const hasRevisionRequest = history.some((h: any) => 
          h.action === 'Revision Requested' || h.action === 'Requested Revision'
        );
        if (hasRevisionRequest) {
          return true;
        }
      }
    }
    return false;
  };

  const getTaskNotes = (task: any, project: any) => {
    if (!task.deliverableId || !project.deliverables) return [];
    
    const deliverable = project.deliverables.find((d: any) => d.id === task.deliverableId);
    if (!deliverable) return [];
    
    const history = deliverableHistory[deliverable.id] || [];
    return history.filter((h: any) => 
      h.notes && (h.action === 'Revision Requested' || h.action === 'Requested Revision')
    );
  };

  // Group tasks by project
  const tasksByProject = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    for (const task of tasks) {
      if (!grouped[task.projectId]) {
        grouped[task.projectId] = [];
      }
      grouped[task.projectId].push(task);
    }
    return grouped;
  }, [tasks]);

  // Get project name
  const getProjectName = (projectId: string): string => {
    const project = projects.find((p: any) => p.id === projectId);
    return project?.clientName || 'Unknown Project';
  };

  if (loading) {
    return (
      <div className="dashboard" style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2rem'
      }}>
        <div style={{
          textAlign: 'center',
          color: 'white'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid rgba(255, 255, 255, 0.3)',
            borderTop: '4px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1.5rem'
          }}></div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            margin: '0 0 0.5rem 0',
            color: 'white'
          }}>
            Loading My Projects
          </h2>
          <p style={{
            fontSize: '1rem',
            margin: 0,
            opacity: 0.9,
            animation: 'pulse 2s ease-in-out infinite'
          }}>
            Fetching your projects and tasks...
          </p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.9; }
            50% { opacity: 0.6; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="dashboard premium" style={{ minHeight: '100vh', padding: '2rem', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '0.5rem',
              border: 'none',
              borderRadius: '0.5rem',
              background: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.transform = 'translateX(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            <FaArrowLeft style={{ fontSize: '1rem', color: '#64748b' }} />
          </button>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #667eea 0%, #667eeadd 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px #667eea30'
          }}>
            <FaFileAlt style={{ fontSize: '1.5rem', color: 'white' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>
              My Projects
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
              {getGreeting()}, {user?.name?.split(' ')[0]} • {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} across {projects.length} {projects.length === 1 ? 'project' : 'projects'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => setShowNotificationsModal(true)}
            style={{
              position: 'relative',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              fontSize: '1.25rem',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#667eea';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#64748b';
            }}
          >
            <FaBell />
            {unreadNotifications > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-0.25rem',
                  right: '-0.25rem',
                  minWidth: '1.5rem',
                  height: '1.5rem',
                  padding: '0 0.375rem',
                  borderRadius: '0.75rem',
                  background: unreadNotifications >= 10 
                    ? '#dc2626'
                    : unreadNotifications >= 5 
                    ? '#f59e0b'
                    : '#10b981',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </span>
            )}
          </button>
          <div className="avatar-dropdown-container" ref={dropdownRef}>
            <button
              className="avatar-button"
              onClick={() => setShowAvatarDropdown(!showAvatarDropdown)}
            >
              <div className="avatar premium-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
              <FaChevronDown className="dropdown-chevron" />
            </button>
            {showAvatarDropdown && (
              <div className="avatar-dropdown">
                <div className="dropdown-header">
                  <div className="avatar premium-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="dropdown-name">{user?.name}</div>
                    <div className="dropdown-email">{user?.email}</div>
                  </div>
                </div>
                <div className="dropdown-divider"></div>
                <button
                  onClick={() => {
                    setShowAvatarDropdown(false);
                    navigate('/profile');
                  }}
                  className="dropdown-item"
                >
                  <FaUser className="dropdown-icon" />
                  Profile
                </button>
                <button
                  onClick={() => {
                    setShowAvatarDropdown(false);
                    setShowNotificationsModal(true);
                  }}
                  className="dropdown-item"
                >
                  <FaBell className="dropdown-icon" />
                  Notifications
                  {unreadNotifications > 0 && (
                    <span className="notification-badge">{unreadNotifications}</span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowAvatarDropdown(false);
                    navigate('/settings');
                  }}
                  className="dropdown-item"
                >
                  <FaCog className="dropdown-icon" />
                  Settings
                </button>
                <div className="dropdown-divider"></div>
                <button onClick={handleLogout} className="dropdown-item dropdown-item-danger">
                  <FaSignOutAlt className="dropdown-icon" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>My Projects</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>{projects.length}</div>
        </div>
        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Total Tasks</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>{tasks.length}</div>
        </div>
        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>In Progress</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>
            {tasks.filter((t: any) => t.status === 'In Progress').length}
          </div>
        </div>
        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>In Review</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>
            {tasks.filter((t: any) => t.status === 'In Review').length}
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e293b', margin: 0, flex: 1 }}>
          My Tasks by Project
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '0.5rem' }}>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '0.375rem',
              background: viewMode === 'list' ? 'white' : 'transparent',
              color: viewMode === 'list' ? '#1e293b' : '#64748b',
              cursor: 'pointer',
              fontWeight: viewMode === 'list' ? 600 : 400,
              boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '0.375rem',
              background: viewMode === 'kanban' ? 'white' : 'transparent',
              color: viewMode === 'kanban' ? '#1e293b' : '#64748b',
              cursor: 'pointer',
              fontWeight: viewMode === 'kanban' ? 600 : 400,
              boxShadow: viewMode === 'kanban' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Kanban
          </button>
        </div>
      </div>

      {/* Tasks Display */}
      <div>
        {tasks.length === 0 ? (
          <div style={{
            background: 'white',
            padding: '3rem',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0',
            textAlign: 'center',
            color: '#64748b'
          }}>
            <FaFileAlt style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>
              No tasks assigned to you
            </h3>
            <p>Tasks will appear here once they are assigned to you.</p>
          </div>
        ) : viewMode === 'list' ? (
          /* List View - Grouped by Project */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {Object.entries(tasksByProject).map(([projectId, projectTasks]) => {
              const project = projects.find((p: any) => p.id === projectId);
              if (!project) return null;
              
              return (
                <div
                  key={projectId}
                  style={{
                    background: 'white',
                    borderRadius: '0.5rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    onClick={() => navigate(`/project/${projectId}`)}
                    style={{
                      padding: '1rem 1.5rem',
                      background: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f8fafc';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>
                        {project.clientName}
                      </h3>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        background: '#e0e7ff',
                        color: '#4338ca'
                      }}>
                        {project.stage}
                      </span>
                    </div>
                    <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                      {projectTasks.length} task(s)
                    </span>
                  </div>
                  <div style={{ padding: '1rem 1.5rem' }}>
                    {projectTasks.map((task: any) => {
                      const isOverdue = isTaskOverdue(task);
                      const daysUntilDue = getDaysUntilDue(task.dueDate);
                      const taskInRevision = isTaskInRevision(task, project);
                      const borderColor = getTaskBorderColor(task.status, task.isCompleted, taskInRevision);
                      const taskNotes = getTaskNotes(task, project);
                      
                      return (
                        <div
                          key={task.id}
                          style={{
                            padding: '1rem',
                            border: taskInRevision ? '2px solid #dc2626' : `1px solid ${borderColor}`,
                            borderRadius: '0.375rem',
                            marginBottom: '0.75rem',
                            background: 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            position: 'relative'
                          }}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest('button') ||
                                target.tagName === 'BUTTON') {
                              return;
                            }
                            navigate(`/project/${task.projectId}`);
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f8fafc';
                            e.currentTarget.style.borderColor = '#667eea';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.15)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'white';
                            e.currentTarget.style.borderColor = taskInRevision ? '#dc2626' : borderColor;
                            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          {taskInRevision && (
                            <div style={{
                              position: 'absolute',
                              top: '0',
                              right: '0',
                              background: '#dc2626',
                              color: 'white',
                              padding: '0.25rem 0.75rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              borderBottomLeftRadius: '8px',
                              borderTopRightRadius: '8px',
                              zIndex: 10,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)'
                            }}>
                              <FaExclamationTriangle style={{ fontSize: '0.625rem' }} />
                              REVISION
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.75rem',
                                marginBottom: '0.5rem'
                              }}>
                                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>
                                  {task.title}
                                </h4>
                                <span style={{
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '0.25rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                  background: task.status === 'Completed' ? '#d1fae5' : '#fef3c7',
                                  color: task.status === 'Completed' ? '#065f46' : '#92400e'
                                }}>
                                  {task.status}
                                </span>
                              </div>
                              {task.description && (
                                <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 0.5rem 0' }}>
                                  {task.description}
                                </p>
                              )}
                              {taskNotes.length > 0 && (
                                <div style={{
                                  marginTop: '0.5rem',
                                  marginBottom: '0.5rem',
                                  padding: '0.5rem',
                                  background: '#fef3c7',
                                  border: '1px solid #fde68a',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  color: '#92400e'
                                }}>
                                  <FaStickyNote style={{ fontSize: '0.75rem', marginRight: '0.25rem', display: 'inline' }} />
                                  {taskNotes.length} revision note{taskNotes.length > 1 ? 's' : ''} available
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTaskNotes(taskNotes);
                                      setSelectedTaskTitle(task.title);
                                      setShowNotesModal(true);
                                    }}
                                    style={{
                                      marginLeft: '0.5rem',
                                      background: 'none',
                                      border: 'none',
                                      color: '#667eea',
                                      fontSize: '0.75rem',
                                      fontWeight: 500,
                                      cursor: 'pointer',
                                      textDecoration: 'underline'
                                    }}
                                  >
                                    View notes
                                  </button>
                                </div>
                              )}
                              {task.fileUrl && (
                                <div style={{
                                  marginTop: '0.5rem',
                                  marginBottom: '0.5rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem'
                                }}>
                                  <FaGoogleDrive style={{ color: '#4285f4', fontSize: '0.875rem' }} />
                                  <a 
                                    href={task.fileUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ 
                                      color: '#667eea', 
                                      textDecoration: 'underline',
                                      fontSize: '0.875rem'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    View Google Drive Files
                                  </a>
                                </div>
                              )}
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '1.5rem',
                                fontSize: '0.875rem',
                                color: '#64748b',
                                marginTop: '0.5rem'
                              }}>
                                {task.dueDate && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <FaClock />
                                    <span style={{ color: isOverdue ? '#dc2626' : 'inherit' }}>
                                      {isOverdue
                                        ? `Overdue ${Math.abs(daysUntilDue || 0)} ${Math.abs(daysUntilDue || 0) === 1 ? 'day' : 'days'}`
                                        : daysUntilDue === 0
                                        ? 'Due today'
                                        : daysUntilDue === 1
                                        ? 'Due tomorrow'
                                        : daysUntilDue && daysUntilDue > 0
                                        ? `${daysUntilDue} days left`
                                        : new Date(task.dueDate).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                              {!task.isCompleted && (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  {task.status === 'Todo' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTaskStatusUpdate(task.id, 'In Progress');
                                      }}
                                      disabled={updatingTask === task.id}
                                      style={{
                                        padding: '0.375rem 0.75rem',
                                        border: 'none',
                                        borderRadius: '0.375rem',
                                        background: '#3b82f6',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '0.75rem',
                                        fontWeight: 500
                                      }}
                                    >
                                      {updatingTask === task.id ? <FaSpinner className="spinner" /> : 'Start'}
                                    </button>
                                  )}
                                  {(task.status === 'In Progress' || (hasRevisionDeliverables(project) && task.status === 'In Review')) && (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSendForReview(task);
                                        }}
                                        disabled={updatingTask === task.id}
                                        style={{
                                          padding: '0.375rem 0.75rem',
                                          border: 'none',
                                          borderRadius: '0.375rem',
                                          background: '#f59e0b',
                                          color: 'white',
                                          cursor: 'pointer',
                                          fontSize: '0.75rem',
                                          fontWeight: 500
                                        }}
                                      >
                                        {updatingTask === task.id ? <FaSpinner className="spinner" /> : hasRevisionDeliverables(project) ? 'Resubmit' : 'Send for Review'}
                                      </button>
                                      {!hasRevisionDeliverables(project) && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleTaskStatusUpdate(task.id, 'Completed', true);
                                          }}
                                          disabled={updatingTask === task.id}
                                          style={{
                                            padding: '0.375rem 0.75rem',
                                            border: 'none',
                                            borderRadius: '0.375rem',
                                            background: '#10b981',
                                            color: 'white',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem',
                                            fontWeight: 500
                                          }}
                                        >
                                          {updatingTask === task.id ? <FaSpinner className="spinner" /> : 'Complete'}
                                        </button>
                                      )}
                                    </>
                                  )}
                                  {task.status === 'In Review' && !hasRevisionDeliverables(project) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTaskStatusUpdate(task.id, 'Completed', true);
                                      }}
                                      disabled={updatingTask === task.id}
                                      style={{
                                        padding: '0.375rem 0.75rem',
                                        border: 'none',
                                        borderRadius: '0.375rem',
                                        background: '#10b981',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '0.75rem',
                                        fontWeight: 500
                                      }}
                                    >
                                      {updatingTask === task.id ? <FaSpinner className="spinner" /> : 'Mark Complete'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Kanban View */
          <div>
            <div style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              background: '#f0f4ff',
              border: '1px solid #c7d2fe',
              borderRadius: '8px',
              fontSize: '0.875rem',
              color: '#4c51bf',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: '1rem' }}>💡</span>
              <span><strong>Tip:</strong> Drag tasks across columns to update their status. Click "Send for Review" to attach links and submit your work.</span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1.5rem',
              paddingBottom: '1rem',
              paddingTop: '0.5rem',
              width: '100%',
              minHeight: '400px'
            }} className="department-kanban-container">
              {[
                { id: 'todo', title: 'To Do', status: 'Todo' },
                { id: 'in_progress', title: 'In Progress', status: 'In Progress' },
                { id: 'in_review', title: 'In Review', status: 'In Review' },
                { id: 'completed', title: 'Completed', status: 'Completed' },
              ].map((column) => {
                const columnTasks = tasks.filter((t: any) => {
                  if (column.id === 'completed') {
                    return t.isCompleted || t.status === 'Completed';
                  }
                  return t.status === column.status && !t.isCompleted;
                });
                
                return (
                  <div
                    key={column.id}
                    className="department-kanban-column"
                    style={{
                      width: '100%',
                      background: 'white',
                      borderRadius: '0.5rem',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      border: '2px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.2s',
                      height: 'fit-content',
                      maxHeight: 'calc(100vh - 300px)',
                      position: 'relative'
                    }}
                  >
                    <div
                      style={{
                        padding: '1rem',
                        background: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        borderRadius: '0.5rem 0.5rem 0 0'
                      }}
                    >
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', margin: '0 0 0.25rem 0' }}>
                        {column.title}
                      </h3>
                      <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                        {columnTasks.length} task(s)
                      </span>
                    </div>
                    <div style={{
                      padding: '0.75rem',
                      flex: 1,
                      overflowY: 'auto',
                      minHeight: '200px',
                      maxHeight: 'calc(100vh - 400px)'
                    }} className="department-kanban-column-content">
                      {columnTasks.map((task: any) => {
                        const project = projects.find((p: any) => p.id === task.projectId);
                        const taskInRevision = project ? isTaskInRevision(task, project) : false;
                        const taskNotes = project ? getTaskNotes(task, project) : [];
                        
                        return (
                          <div
                            key={task.id}
                            className="kanban-task-card"
                            style={{
                              padding: '0.75rem',
                              marginBottom: '0.75rem',
                              border: taskInRevision ? '2px solid #dc2626' : '1px solid #e2e8f0',
                              borderRadius: '0.5rem',
                              background: 'white',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              position: 'relative',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.closest('button') ||
                                  target.tagName === 'BUTTON') {
                                return;
                              }
                              navigate(`/project/${task.projectId}`);
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f8fafc';
                              e.currentTarget.style.borderColor = '#667eea';
                              e.currentTarget.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.15)';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'white';
                              e.currentTarget.style.borderColor = taskInRevision ? '#dc2626' : '#e2e8f0';
                              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            {taskInRevision && (
                              <div style={{
                                position: 'absolute',
                                top: '0',
                                right: '0',
                                background: '#dc2626',
                                color: 'white',
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                borderBottomLeftRadius: '6px',
                                borderTopRightRadius: '6px',
                                zIndex: 10
                              }}>
                                REVISION
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontSize: '0.75rem',
                                  color: '#667eea',
                                  fontWeight: 500,
                                  marginBottom: '0.25rem'
                                }}>
                                  {getProjectName(task.projectId)}
                                </div>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  marginBottom: '0.5rem',
                                  flexWrap: 'wrap'
                                }}>
                                  <h4 style={{
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    color: '#1e293b',
                                    margin: 0,
                                    flex: 1,
                                    minWidth: 0
                                  }}>
                                    {task.title}
                                  </h4>
                                  <span style={{
                                    padding: '0.125rem 0.5rem',
                                    borderRadius: '0.25rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    background: task.status === 'Completed' ? '#d1fae5' : '#fef3c7',
                                    color: task.status === 'Completed' ? '#065f46' : '#92400e',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {task.status}
                                  </span>
                                </div>
                                {task.description && (
                                  <p style={{
                                    color: '#64748b',
                                    fontSize: '0.75rem',
                                    margin: '0 0 0.5rem 0',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical'
                                  }}>
                                    {task.description}
                                  </p>
                                )}
                                {taskNotes.length > 0 && (
                                  <div style={{
                                    marginTop: '0.5rem',
                                    marginBottom: '0.5rem',
                                    padding: '0.5rem',
                                    background: '#fef3c7',
                                    border: '1px solid #fde68a',
                                    borderRadius: '6px',
                                    fontSize: '0.7rem',
                                    color: '#92400e'
                                  }}>
                                    <FaStickyNote style={{ fontSize: '0.625rem', marginRight: '0.25rem', display: 'inline' }} />
                                    Revision notes available
                                  </div>
                                )}
                                {task.fileUrl && (
                                  <div style={{
                                    marginTop: '0.5rem',
                                    marginBottom: '0.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                  }}>
                                    <FaGoogleDrive style={{ color: '#4285f4', fontSize: '0.75rem' }} />
                                    <a 
                                      href={task.fileUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      style={{ 
                                        color: '#667eea', 
                                        textDecoration: 'underline',
                                        fontSize: '0.7rem'
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      View Files
                                    </a>
                                  </div>
                                )}
                                {task.dueDate && (
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.75rem',
                                    color: '#64748b',
                                    marginTop: '0.5rem'
                                  }}>
                                    <FaClock style={{ fontSize: '0.75rem' }} />
                                    <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                                  </div>
                                )}
                                {!task.isCompleted && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', marginTop: '0.5rem' }}>
                                    {task.status === 'Todo' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleTaskStatusUpdate(task.id, 'In Progress');
                                        }}
                                        disabled={updatingTask === task.id}
                                        style={{
                                          width: '100%',
                                          padding: '0.5rem',
                                          border: 'none',
                                          borderRadius: '0.375rem',
                                          background: '#3b82f6',
                                          color: 'white',
                                          cursor: 'pointer',
                                          fontSize: '0.75rem',
                                          fontWeight: 500,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '0.5rem'
                                        }}
                                      >
                                        {updatingTask === task.id ? <FaSpinner className="spinner" /> : 'Start'}
                                      </button>
                                    )}
                                    {(task.status === 'In Progress' || (project && hasRevisionDeliverables(project) && task.status === 'In Review')) && (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSendForReview(task);
                                          }}
                                          disabled={updatingTask === task.id}
                                          style={{
                                            width: '100%',
                                            padding: '0.5rem',
                                            border: 'none',
                                            borderRadius: '0.375rem',
                                            background: '#f59e0b',
                                            color: 'white',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem',
                                            fontWeight: 500,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem'
                                          }}
                                        >
                                          {updatingTask === task.id ? <FaSpinner className="spinner" /> : project && hasRevisionDeliverables(project) ? 'Resubmit' : 'Send for Review'}
                                        </button>
                                        {project && !hasRevisionDeliverables(project) && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleTaskStatusUpdate(task.id, 'Completed', true);
                                            }}
                                            disabled={updatingTask === task.id}
                                            style={{
                                              width: '100%',
                                              padding: '0.5rem',
                                              border: 'none',
                                              borderRadius: '0.375rem',
                                              background: '#10b981',
                                              color: 'white',
                                              cursor: 'pointer',
                                              fontSize: '0.75rem',
                                              fontWeight: 500,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              gap: '0.5rem'
                                            }}
                                          >
                                            {updatingTask === task.id ? <FaSpinner className="spinner" /> : 'Complete'}
                                          </button>
                                        )}
                                      </>
                                    )}
                                    {task.status === 'In Review' && project && !hasRevisionDeliverables(project) && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleTaskStatusUpdate(task.id, 'Completed', true);
                                        }}
                                        disabled={updatingTask === task.id}
                                        style={{
                                          width: '100%',
                                          padding: '0.5rem',
                                          border: 'none',
                                          borderRadius: '0.375rem',
                                          background: '#10b981',
                                          color: 'white',
                                          cursor: 'pointer',
                                          fontSize: '0.75rem',
                                          fontWeight: 500,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '0.5rem'
                                        }}
                                      >
                                        {updatingTask === task.id ? <FaSpinner className="spinner" /> : 'Mark Complete'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <NotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => {
          setShowNotificationsModal(false);
        }}
        onUpdate={loadUnreadCount}
        onMarkAllAsRead={() => {
          setUnreadNotifications(0);
          skipRefreshUntilRef.current = Date.now() + 5000;
          setTimeout(() => {
            skipRefreshUntilRef.current = null;
            loadUnreadCount();
          }, 5000);
        }}
      />
      <SendForReviewModal
        isOpen={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setSelectedTaskForReview(null);
        }}
        onSubmit={handleReviewSubmit}
        taskTitle={selectedTaskForReview?.title || ''}
        projectDeliverables={selectedTaskForReview ? (projects.find((p: any) => p.id === selectedTaskForReview.projectId)?.deliverables || []) : []}
        loading={updatingTask === selectedTaskForReview?.id}
        taskDeliverableId={selectedTaskForReview?.deliverableId}
      />
      
      {/* Notes Modal */}
      {showNotesModal && (
        <div 
          className="modal-overlay" 
          onClick={() => {
            setShowNotesModal(false);
            setSelectedTaskNotes([]);
            setSelectedTaskTitle('');
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: '#111827' }}>
                Revision Notes - {selectedTaskTitle}
              </h2>
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  setSelectedTaskNotes([]);
                  setSelectedTaskTitle('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  color: '#6b7280',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <FaTimes />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {selectedTaskNotes.map((note, idx) => {
                const notes = note.notes || '';
                const attachmentMatch = notes.match(/Attachment:\s*(https?:\/\/[^\s]+)/i);
                const hasAttachment = !!attachmentMatch;
                const notesText = attachmentMatch 
                  ? notes.replace(/Attachment:\s*https?:\/\/[^\s]+/i, '').trim()
                  : notes.trim();
                const attachmentUrl = attachmentMatch ? attachmentMatch[1] : null;
                
                return (
                  <div 
                    key={idx}
                    style={{
                      padding: '1rem',
                      background: '#fef3c7',
                      border: '1px solid #fde68a',
                      borderRadius: '8px'
                    }}
                  >
                    <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FaStickyNote style={{ color: '#f59e0b', fontSize: '1rem' }} />
                      <strong style={{ color: '#92400e', fontSize: '0.875rem' }}>
                        {note.deliverableType || 'Revision Note'}
                      </strong>
                      <span style={{ color: '#9ca3af', fontSize: '0.75rem', marginLeft: 'auto' }}>
                        {new Date(note.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {notesText && (
                      <div style={{ marginBottom: hasAttachment ? '0.75rem' : 0, color: '#92400e', fontSize: '0.875rem', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                        {notesText}
                      </div>
                    )}
                    
                    {hasAttachment && attachmentUrl && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'white', borderRadius: '4px' }}>
                        <FaLink style={{ color: '#667eea', fontSize: '0.875rem' }} />
                        <a 
                          href={attachmentUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ 
                            color: '#667eea', 
                            textDecoration: 'underline', 
                            wordBreak: 'break-all',
                            fontSize: '0.875rem'
                          }}
                        >
                          {attachmentUrl}
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyProjectsView;

