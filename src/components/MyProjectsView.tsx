import React, { useState, useEffect, useRef } from 'react';
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
  FaSpinner,
  FaGoogleDrive,
  FaStickyNote,
  FaLink,
  FaTimes,
  FaEllipsisV,
  FaEnvelope,
  FaEye,
  FaFolder,
  FaPaperPlane,
  FaComments,
} from 'react-icons/fa';
import { authService } from '../services/auth.service';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import { notificationService } from '../services/notification.service';
import { clientUpdatesService } from '../services/client-updates.service';
import NotificationsModal from './NotificationsModal';
import LiveChatPanel from './LiveChatPanel';
import SendForReviewModal from './SendForReviewModal';
import UserAvatar from './UserAvatar';
import { useUnreadChatCount } from '../hooks/useUnreadChatCount';
import './Dashboard.css';

const MyProjectsView: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showLiveChatPanel, setShowLiveChatPanel] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedTaskForReview, setSelectedTaskForReview] = useState<any>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadChatCount, refreshUnreadChat] = useUnreadChatCount();
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('list');
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const skipRefreshUntilRef = useRef<number | null>(null);
  const [deliverableHistory] = useState<Record<string, any[]>>({});
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedTaskNotes, setSelectedTaskNotes] = useState<any[]>([]);
  const [selectedTaskTitle, setSelectedTaskTitle] = useState<string>('');
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  const [projectForUpdates, setProjectForUpdates] = useState<any>(null);
  const [clientUpdates, setClientUpdates] = useState<any[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});
  const [showMentionDropdown, setShowMentionDropdown] = useState<{ updateId: string; position: number } | null>(null);
  const [lastViewedUpdates, setLastViewedUpdates] = useState<Record<string, Date>>({});
  const [newUpdatesCount, setNewUpdatesCount] = useState<Record<string, number>>({});

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

  const handleReviewSubmit = async (driveLinks: string[], deliverableType: string, deliverableId?: string) => {
    if (!selectedTaskForReview || driveLinks.length === 0) return;
    
    try {
      setUpdatingTask(selectedTaskForReview.id);
      const primaryLink = driveLinks[0];
      await taskService.updateStatus(selectedTaskForReview.id, 'In Review', false, primaryLink, deliverableType, deliverableId);
      if (driveLinks.length > 1) {
        const extraLinksBlock = `\n\n--- Additional Links ---\n${driveLinks.slice(1).map((l) => `- ${l.trim()}`).join('\n')}`;
        const currentDesc = selectedTaskForReview.description || '';
        await taskService.update(selectedTaskForReview.id, { description: currentDesc + extraLinksBlock });
      }
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
      const isProjectManager = user?.role === 'Project Manager';

      if (isProjectManager) {
        // PM view should include all projects owned by this PM (not only projects with assigned tasks).
        const [allProjects, allTasks] = await Promise.all([
          projectService.getAll(),
          taskService.getAll(undefined, undefined, { all: true }),
        ]);

        const myProjects = (allProjects || []).filter((p: any) => {
          const pmId = p.pmId || p.pm?.id;
          return pmId === user?.id && !p?.isArchived;
        });
        const myProjectIds = new Set(myProjects.map((p: any) => p.id));
        const tasksForMyProjects = (allTasks || []).filter((t: any) => myProjectIds.has(t.projectId));

        setProjects(myProjects);
        setTasks(tasksForMyProjects);

        loadLastEmailLogs(myProjects).catch((err) => {
          console.error('Failed to load email logs:', err);
        });
      } else {
        // Non-PM fallback: keep existing "assigned to me" behavior.
        const myTasks = await taskService.getAll(undefined, user?.id);
        const projectIds = Array.from(new Set(myTasks.map((t: any) => t.projectId)));
        const projectPromises = projectIds.map((id: string) => projectService.getOne(id));
        const myProjects = await Promise.all(projectPromises);

        setProjects(myProjects);
        setTasks(myTasks);

        loadLastEmailLogs(myProjects).catch((err) => {
          console.error('Failed to load email logs:', err);
        });
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadUnreadCount();
    loadUsers();
    
    // Set up interval to check for new updates
    const interval = setInterval(() => {
      if (skipRefreshUntilRef.current && Date.now() < skipRefreshUntilRef.current) {
        return;
      }
      loadUnreadCount();
    }, 30000); // Check every 30 seconds
    
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

  const hasRevisionDeliverables = (project: any) => {
    return project.deliverables?.some((d: any) => 
      ['Brand Book', 'Copy of Home Page', 'Home Page', 'Speaker Kit', 'Other'].includes(d.type) &&
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

  // Get project name
  const getProjectName = (projectId: string): string => {
    const project = projects.find((p: any) => p.id === projectId);
    return project?.clientName || 'Unknown Project';
  };

  const loadLastEmailLogs = async (projectsList: any[]) => {
    try {
      const newUpdatesMap: Record<string, number> = {};
      
      // Load last viewed timestamps from localStorage
      const storedLastViewed = localStorage.getItem('lastViewedUpdates');
      const lastViewed = storedLastViewed ? JSON.parse(storedLastViewed) : {};
      
      await Promise.all(
        projectsList.map(async (project) => {
          try {
            const updates = await clientUpdatesService.getAllByProject(project.id);
            if (updates && updates.length > 0) {
              // Check for new updates
              const lastViewedDate = lastViewed[project.id] ? new Date(lastViewed[project.id]) : null;
              if (lastViewedDate) {
                const newUpdates = updates.filter((update: any) => 
                  new Date(update.emailSentAt) > lastViewedDate
                );
                if (newUpdates.length > 0) {
                  newUpdatesMap[project.id] = newUpdates.length;
                }
              } else if (updates.length > 0) {
                // If never viewed, all updates are new
                newUpdatesMap[project.id] = updates.length;
              }
            }
          } catch (error) {
            console.error(`Failed to load email logs for project ${project.id}:`, error);
          }
        })
      );
      
      setNewUpdatesCount(newUpdatesMap);
    } catch (error) {
      console.error('Failed to load email logs:', error);
    }
  };

  const loadClientUpdates = async (projectId: string) => {
    try {
      setLoadingUpdates(true);
      const updates = await clientUpdatesService.getAllByProject(projectId);
      setClientUpdates(updates);
      // Load comments for all updates
      if (updates && updates.length > 0) {
        await Promise.all(updates.map(update => loadComments(update.id)));
      }
    } catch (error) {
      console.error('Failed to load client updates:', error);
      setClientUpdates([]);
    } finally {
      setLoadingUpdates(false);
    }
  };

  const loadComments = async (updateId: string) => {
    try {
      setLoadingComments({ ...loadingComments, [updateId]: true });
      const commentsData = await clientUpdatesService.getComments(updateId);
      setComments({ ...comments, [updateId]: commentsData });
    } catch (error) {
      console.error('Failed to load comments:', error);
      if ((error as any)?.response?.status !== 404) {
        console.error('Error loading comments:', error);
      }
    } finally {
      setLoadingComments({ ...loadingComments, [updateId]: false });
    }
  };

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const matches = text.match(mentionRegex);
    if (!matches) return [];
    
    const mentionedUserIds: string[] = [];
    matches.forEach(match => {
      const username = match.substring(1);
      const user = users.find(u => u.name === username);
      if (user) {
        mentionedUserIds.push(user.id);
      }
    });
    return mentionedUserIds;
  };

  const handleCommentInput = (updateId: string, text: string, cursorPos?: number) => {
    setCommentTexts({ ...commentTexts, [updateId]: text });
    
    // Check for @ mentions
    const textBeforeCursor = text.substring(0, cursorPos || text.length);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Show dropdown if @ is followed by no space (still typing username)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setShowMentionDropdown({ updateId, position: lastAtIndex + 1 });
      } else {
        setShowMentionDropdown(null);
      }
    } else {
      setShowMentionDropdown(null);
    }
  };

  const handleAddComment = async (updateId: string) => {
    const comment = commentTexts[updateId]?.trim();
    if (!comment) return;

    try {
      setSubmittingComment({ ...submittingComment, [updateId]: true });
      const mentionedUserIds = extractMentions(comment);
      await clientUpdatesService.createComment(updateId, comment, mentionedUserIds.length > 0 ? mentionedUserIds : undefined);
      await loadComments(updateId);
      setCommentTexts({ ...commentTexts, [updateId]: '' });
    } catch (error: any) {
      console.error('Failed to add comment:', error);
      alert(`Failed to add comment: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
    } finally {
      setSubmittingComment({ ...submittingComment, [updateId]: false });
    }
  };

  const handleViewUpdatesClick = async (project: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectForUpdates(project);
    setShowUpdatesModal(true);
    await loadClientUpdates(project.id);
    
    // Mark updates as viewed
    const now = new Date();
    setLastViewedUpdates({ ...lastViewedUpdates, [project.id]: now });
    
    // Update localStorage
    const storedLastViewed = localStorage.getItem('lastViewedUpdates');
    const lastViewed = storedLastViewed ? JSON.parse(storedLastViewed) : {};
    lastViewed[project.id] = now.toISOString();
    localStorage.setItem('lastViewedUpdates', JSON.stringify(lastViewed));
    
    // Clear new updates count for this project
    setNewUpdatesCount({ ...newUpdatesCount, [project.id]: 0 });
  };

  const loadUsers = async () => {
    try {
      const usersData = await authService.getAllUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
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
            onClick={() => setShowLiveChatPanel(true)}
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
            title="Live Chat"
          >
            <FaComments />
            {unreadChatCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-0.25rem',
                  right: '-0.25rem',
                  minWidth: '1.5rem',
                  height: '1.5rem',
                  padding: '0 0.375rem',
                  borderRadius: '0.75rem',
                  background: '#ef4444',
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
                {unreadChatCount > 99 ? '99+' : unreadChatCount}
              </span>
            )}
          </button>
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
              <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} className="avatar premium-avatar" />
              <FaChevronDown className="dropdown-chevron" />
            </button>
            {showAvatarDropdown && (
              <div className="avatar-dropdown">
                <div className="dropdown-header">
                  <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} className="avatar premium-avatar" />
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
          /* List View - Table Format (Projects) */
          <div className="projects-list-view" style={{ background: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div className="list-header">
              <div className="list-header-cell" style={{ flex: '2', minWidth: '200px' }}>Project Name</div>
              <div className="list-header-cell" style={{ width: '120px', flex: '0 0 120px' }}>Client Type</div>
              <div className="list-header-cell" style={{ width: '100px', flex: '0 0 100px' }}>Priority</div>
              <div className="list-header-cell" style={{ width: '120px', flex: '0 0 120px' }}>Stage</div>
              <div className="list-header-cell" style={{ width: '120px', flex: '0 0 120px' }}>Days in Stage</div>
              <div className="list-header-cell" style={{ width: '120px', flex: '0 0 120px' }}>Tasks</div>
              <div className="list-header-cell" style={{ width: '160px', flex: '0 0 160px' }}>Update</div>
              <div className="list-header-cell" style={{ width: '120px', flex: '0 0 120px', textAlign: 'center' }}>Actions</div>
            </div>
            <div className="list-content" style={{ minHeight: '400px' }}>
              {projects.length === 0 ? (
                <div className="empty-list">
                  <FaFolder style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }} />
                  <p>No projects found</p>
                </div>
              ) : (
                projects.map((project: any) => {
                  const projectTasks = tasks.filter((t: any) => t.projectId === project.id);
                  const daysInStage = project.updatedAt
                    ? Math.ceil((Date.now() - new Date(project.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
                    : 0;
                  
                  return (
                    <div
                      key={project.id}
                      className="list-row"
                      onClick={() => navigate(`/project/${project.id}`)}
                    >
                      <div className="list-cell" style={{ flex: '2', minWidth: '200px', fontWeight: 600 }}>
                        {project.clientName}
                      </div>
                      <div className="list-cell" style={{ width: '120px', flex: '0 0 120px' }}>
                        <span className={`client-type-badge ${project.clientType?.toLowerCase()}`}>
                          {project.clientType || 'N/A'}
                        </span>
                      </div>
                      <div className="list-cell" style={{ width: '100px', flex: '0 0 100px' }}>
                        <span className={`priority-badge priority-${project.priority?.toLowerCase()}`}>
                          {project.priority || 'N/A'}
                        </span>
                      </div>
                      <div className="list-cell" style={{ width: '120px', flex: '0 0 120px' }}>
                        <span className="stage-badge">{project.stage}</span>
                      </div>
                      <div className="list-cell" style={{ width: '120px', flex: '0 0 120px' }}>
                        {daysInStage} {daysInStage === 1 ? 'day' : 'days'}
                      </div>
                      <div className="list-cell" style={{ width: '120px', flex: '0 0 120px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                            {projectTasks.length} {projectTasks.length === 1 ? 'task' : 'tasks'}
                          </span>
                          {projectTasks.some((t: any) => !t.assignedToId) && (
                            <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>
                              {projectTasks.filter((t: any) => !t.assignedToId).length} unassigned
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="list-cell" style={{ width: '160px', flex: '0 0 160px', position: 'relative' }}>
                        <button
                          onClick={(e) => handleViewUpdatesClick(project, e)}
                          style={{
                            background: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            padding: '0.5rem 0.75rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s',
                            position: 'relative'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#5568d3';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#667eea';
                          }}
                        >
                          <FaEnvelope style={{ fontSize: '0.875rem' }} />
                          View
                          {newUpdatesCount[project.id] > 0 && (
                            <span
                              style={{
                                position: 'absolute',
                                top: '-6px',
                                right: '-6px',
                                background: '#dc2626',
                                color: 'white',
                                borderRadius: '50%',
                                width: '20px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                border: '2px solid white',
                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                                animation: 'pulse 2s infinite'
                              }}
                              title={`${newUpdatesCount[project.id]} new update${newUpdatesCount[project.id] > 1 ? 's' : ''}`}
                            >
                              {newUpdatesCount[project.id] > 9 ? '9+' : newUpdatesCount[project.id]}
                            </span>
                          )}
                        </button>
                      </div>
                      <div className="list-cell" style={{ width: '120px', flex: '0 0 120px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }} data-action-menu>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionMenuOpen(actionMenuOpen === project.id ? null : project.id);
                            }}
                            style={{
                              background: 'transparent',
                              border: '1px solid #e2e8f0',
                              borderRadius: '0.375rem',
                              padding: '0.5rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '36px',
                              height: '36px',
                              color: '#64748b',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f1f5f9';
                              e.currentTarget.style.borderColor = '#cbd5e1';
                              e.currentTarget.style.color = '#475569';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.color = '#64748b';
                            }}
                          >
                            <FaEllipsisV style={{ fontSize: '1rem' }} />
                          </button>
                          {actionMenuOpen === project.id && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '0.25rem',
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '0.5rem',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                zIndex: 9999,
                                minWidth: '180px',
                                overflow: 'hidden',
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActionMenuOpen(null);
                                  navigate(`/project/${project.id}`);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '0.75rem 1rem',
                                  background: 'transparent',
                                  border: 'none',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.75rem',
                                  fontSize: '0.875rem',
                                  color: '#374151',
                                  transition: 'background 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#f8fafc';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <FaEye style={{ fontSize: '0.875rem', color: '#3b82f6' }} />
                                View
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
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
      <LiveChatPanel
        isOpen={showLiveChatPanel}
        onClose={() => {
          setShowLiveChatPanel(false);
          refreshUnreadChat();
        }}
        accentColor="#667eea"
      />
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

      {/* Updates Modal */}
      {showUpdatesModal && projectForUpdates && (
        <>
          <div
            onClick={() => {
              setShowUpdatesModal(false);
              setProjectForUpdates(null);
              setClientUpdates([]);
              setCommentTexts({});
              setShowMentionDropdown(null);
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: '500px',
              height: '100vh',
              background: 'white',
              boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.15)',
              zIndex: 1001,
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInRight 0.3s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#1e293b' }}>
                  PM Updates
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                  {projectForUpdates.clientName}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowUpdatesModal(false);
                  setProjectForUpdates(null);
                  setClientUpdates([]);
                  setCommentTexts({});
                  setShowMentionDropdown(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <FaTimes />
              </button>
            </div>

            {/* Body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
            }}>
              {loadingUpdates ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  Loading updates...
                </div>
              ) : clientUpdates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  <FaEnvelope style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }} />
                  <p>No updates from PM yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {clientUpdates.map((update) => (
                    <div
                      key={update.id}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '1.5rem',
                        background: 'white',
                      }}
                    >
                      {/* Update Header */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '1rem',
                      }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <FaUser style={{ fontSize: '0.875rem', color: '#64748b' }} />
                            <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.875rem' }}>
                              {update.pm?.name || 'PM'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {new Date(update.emailSentAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          background: update.status === 'responded' ? '#d1fae5' : update.status === 'published' ? '#dbeafe' : '#f3f4f6',
                          color: update.status === 'responded' ? '#065f46' : update.status === 'published' ? '#1e40af' : '#374151',
                        }}>
                          {update.status.charAt(0).toUpperCase() + update.status.slice(1)}
                        </span>
                      </div>

                      {/* Notes */}
                      {update.notes && (
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <FaStickyNote style={{ color: '#f59e0b', fontSize: '0.875rem', marginTop: '0.125rem', flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b', marginBottom: '0.25rem' }}>
                                Note:
                              </div>
                              <div style={{ color: '#374151', fontSize: '0.875rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                {update.notes}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Links */}
                      {update.links && update.links.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <FaLink style={{ color: '#667eea', fontSize: '0.875rem', flexShrink: 0 }} />
                            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>
                              Links:
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '1.5rem' }}>
                            {update.links.map((link: string, linkIndex: number) => (
                              <a
                                key={linkIndex}
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: '#667eea',
                                  fontSize: '0.875rem',
                                  textDecoration: 'none',
                                  wordBreak: 'break-all',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.textDecoration = 'underline';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.textDecoration = 'none';
                                }}
                              >
                                {link}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Existing Comments */}
                      {comments[update.id] && comments[update.id].length > 0 && (
                        <div style={{
                          marginTop: '1rem',
                          paddingTop: '1rem',
                          borderTop: '1px solid #e5e7eb',
                        }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b', marginBottom: '0.75rem' }}>
                            Comments ({comments[update.id].length}):
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {comments[update.id].map((comment) => (
                              <div
                                key={comment.id}
                                style={{
                                  background: '#f9fafb',
                                  borderRadius: '6px',
                                  padding: '0.75rem',
                                  border: '1px solid #e5e7eb',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <FaUser style={{ fontSize: '0.75rem', color: '#64748b' }} />
                                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1e293b' }}>
                                      {comment.user?.name || 'User'}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    {new Date(comment.createdAt).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                  {comment.text}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Add Comment Section */}
                      <div style={{
                        marginTop: '1rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid #e5e7eb',
                        position: 'relative',
                      }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b', marginBottom: '0.75rem' }}>
                          Add Comment (use @ to mention users):
                        </div>
                        <textarea
                          value={commentTexts[update.id] || ''}
                          onChange={(e) => {
                            const cursorPos = e.target.selectionStart || 0;
                            handleCommentInput(update.id, e.target.value, cursorPos);
                          }}
                          placeholder="Write a comment... Use @ to mention users"
                          style={{
                            width: '100%',
                            minHeight: '80px',
                            padding: '0.75rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            marginBottom: '0.5rem',
                          }}
                        />
                        {showMentionDropdown && showMentionDropdown.updateId === update.id && (
                          <div style={{
                            position: 'absolute',
                            background: 'white',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 10000,
                            top: '100%',
                            left: '0',
                            right: '0',
                            marginTop: '0.25rem',
                            minWidth: '200px',
                          }}>
                            {users.length === 0 ? (
                              <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: '#64748b' }}>
                                Loading users...
                              </div>
                            ) : (
                              users.map((userItem: any) => (
                                <div
                                  key={userItem.id}
                                  onClick={() => {
                                    const currentText = commentTexts[update.id] || '';
                                    const beforeCursor = currentText.substring(0, showMentionDropdown.position - 1);
                                    const afterCursor = currentText.substring(showMentionDropdown.position);
                                    const newText = `${beforeCursor}@${userItem.name} ${afterCursor}`;
                                    setCommentTexts({ ...commentTexts, [update.id]: newText });
                                    setShowMentionDropdown(null);
                                  }}
                                  style={{
                                    padding: '0.5rem 0.75rem',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f3f4f6';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'white';
                                  }}
                                >
                                  {userItem.name} ({userItem.role || 'User'})
                                </div>
                              ))
                            )}
                          </div>
                        )}
                        <button
                          onClick={() => handleAddComment(update.id)}
                          disabled={!commentTexts[update.id]?.trim() || submittingComment[update.id]}
                          style={{
                            background: submittingComment[update.id] ? '#9ca3af' : '#667eea',
                            border: 'none',
                            color: 'white',
                            padding: '0.5rem 1rem',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            cursor: submittingComment[update.id] ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <FaPaperPlane style={{ fontSize: '0.875rem' }} />
                          {submittingComment[update.id] ? 'Posting...' : 'Post Comment'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MyProjectsView;

