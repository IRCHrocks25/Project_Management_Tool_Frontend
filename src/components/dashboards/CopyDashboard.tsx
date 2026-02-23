import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaChevronDown,
  FaUser,
  FaBell,
  FaCog,
  FaSignOutAlt,
  FaFileAlt,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaEdit,
  FaEye,
  FaFilter,
  FaSort,
  FaSpinner,
  FaHandPaper,
  FaGoogleDrive,
  FaStickyNote,
  FaLink,
  FaTimes,
} from 'react-icons/fa';
import { authService } from '../../services/auth.service';
import { projectService } from '../../services/project.service';
import { taskService } from '../../services/task.service';
import { notificationService } from '../../services/notification.service';
import NotificationsModal from '../NotificationsModal';
import SendForReviewModal from '../SendForReviewModal';
import '../Dashboard.css';
import './CopyDashboard.css';

const CopyDashboard: React.FC = () => {
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
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'in_review' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'created'>('due_date');
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const skipRefreshUntilRef = useRef<number | null>(null);
  const [deliverableHistory] = useState<Record<string, any[]>>({}); // Store full history: key = "deliverableId" (read-only for now)
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedTaskNotes, setSelectedTaskNotes] = useState<any[]>([]);
  const [selectedTaskTitle, setSelectedTaskTitle] = useState<string>('');

  useEffect(() => {
    loadData();
    loadUnreadCount();
    const interval = setInterval(() => {
      // Skip refresh if we just marked all as read (within last 5 seconds)
      if (skipRefreshUntilRef.current && Date.now() < skipRefreshUntilRef.current) {
        return;
      }
      loadUnreadCount();
    }, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.avatar-dropdown-container')) {
        setShowAvatarDropdown(false);
      }
    };
    if (showAvatarDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAvatarDropdown]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Only load tasks assigned to current user for this dashboard (much faster!)
      const allTasksData = user?.id 
        ? await taskService.getAll(undefined, user.id)
        : await taskService.getAll(); // Get ALL tasks, not just assigned ones

      // Get ALL copy tasks first (regardless of project stage or deliverable)
      const copyTasks = allTasksData.filter((t: any) => t.type === 'Copy');

      // Only load specific projects we need (much faster than loading all!)
      const projectIdsWithCopyTasks = Array.from(new Set(copyTasks.map((t: any) => t.projectId)));
      
      // Load only the specific projects we need, not all projects
      const projectsWithCopyTasks = await Promise.all(
        projectIdsWithCopyTasks.map(id => projectService.getOne(id).catch(() => null))
      ).then(projects => projects.filter(p => p !== null));

      // Don't load deliverable history on initial load - it's too slow!
      // Load history lazily only when needed (e.g., when checking for revisions)
      setProjects(projectsWithCopyTasks);
      setTasks(copyTasks);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      // Skip refresh if we just marked all as read (within last 5 seconds)
      if (skipRefreshUntilRef.current && Date.now() < skipRefreshUntilRef.current) {
        return;
      }
      const count = await notificationService.getUnreadCount();
      setUnreadNotifications(count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/');
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

  const handleClaimTask = async (taskId: string) => {
    try {
      setUpdatingTask(taskId);
      await taskService.assign(taskId, user?.id || '');
      await loadData();
    } catch (error) {
      console.error('Failed to claim task:', error);
    } finally {
      setUpdatingTask(null);
    }
  };

  const handleClaimProject = async (projectId: string) => {
    if (!user?.id) {
      alert('User not found. Please log in again.');
      return;
    }

    try {
      setUpdatingTask('project-' + projectId);
      console.log('Claiming project:', projectId, 'User:', user.id);
      
      // Get all copy tasks for this project
      const projectTasks = tasks.filter((t: any) => 
        t.projectId === projectId && t.type === 'Copy'
      );
      
      console.log('Project tasks found:', projectTasks.length);
      
      // If no tasks exist, create them first
      if (projectTasks.length === 0) {
        console.log('Creating copy tasks for project:', projectId);
        // Create copy tasks for this project
        const copyTasks = [
          {
            projectId,
            title: 'Write Copy',
            description: 'Create all copy content for the project',
            type: 'Copy',
            status: 'Todo',
            isCompleted: false,
            assignedToId: user.id,
          },
          {
            projectId,
            title: 'Review Copy',
            description: 'Review and refine copy content',
            type: 'Copy',
            status: 'Todo',
            isCompleted: false,
            assignedToId: user.id,
          },
        ];
        
        // Create tasks and assign them to current user
        const createdTasks = await Promise.all(
          copyTasks.map((task) => {
            console.log('Creating task:', task);
            return taskService.create(task);
          })
        );
        console.log('Created tasks:', createdTasks);
      } else {
        // Assign all unassigned tasks to current user
        const unassignedProjectTasks = projectTasks.filter((t: any) => !t.assignedToId);
        console.log('Unassigned tasks to claim:', unassignedProjectTasks.length);
        if (unassignedProjectTasks.length > 0) {
          await Promise.all(
            unassignedProjectTasks.map((task: any) => {
              console.log('Assigning task:', task.id);
              return taskService.assign(task.id, user.id);
            })
          );
        }
      }
      
      // Reload data to show updated tasks
      console.log('Reloading data...');
      await loadData();
      console.log('Project claimed successfully!');
    } catch (error: any) {
      console.error('Failed to claim project:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      console.error('Error details:', error.response?.data);
      alert(`Failed to claim project: ${errorMessage}`);
    } finally {
      setUpdatingTask(null);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getFilteredAndSortedTasks = () => {
    let filtered = tasks;

    // Apply filter
    if (filter === 'todo') {
      filtered = filtered.filter((t: any) => t.status === 'Todo' && !t.isCompleted);
    } else if (filter === 'in_progress') {
      filtered = filtered.filter((t: any) => t.status === 'In Progress');
    } else if (filter === 'in_review') {
      filtered = filtered.filter((t: any) => t.status === 'In Review');
    } else if (filter === 'completed') {
      filtered = filtered.filter((t: any) => t.isCompleted);
    }

    // Apply sort
    filtered = [...filtered].sort((a: any, b: any) => {
      if (sortBy === 'due_date') {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      } else if (sortBy === 'priority') {
        const priorityOrder: any = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
        const aPriority = a.project?.priority || 'Medium';
        const bPriority = b.project?.priority || 'Medium';
        return (priorityOrder[bPriority] || 0) - (priorityOrder[aPriority] || 0);
      } else {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  };

  const getTaskStatusColor = (status: string, isCompleted: boolean) => {
    if (isCompleted) return '#10b981'; // green
    if (status === 'In Progress') return '#3b82f6'; // blue
    if (status === 'In Review') return '#f59e0b'; // amber
    if (status === 'Blocked') return '#ef4444'; // red
    return '#6b7280'; // gray
  };

  const getTaskBorderColor = (status: string, isCompleted: boolean, taskInRevision: boolean) => {
    // Revision takes highest priority - red border
    if (taskInRevision) return '#dc2626'; // red
    if (isCompleted) return '#10b981'; // green
    if (status === 'In Review') return '#f59e0b'; // amber/orange
    if (status === 'In Progress') return '#3b82f6'; // blue
    if (status === 'Blocked') return '#ef4444'; // red
    return '#e5e7eb'; // default gray border
  };

  // Check if project has deliverables in revision status
  const hasRevisionDeliverables = (project: any) => {
    return project.deliverables?.some((d: any) => 
      ['Brand Book', 'Copy of Landing Page', 'Landing Page', 'Speaker Kit', 'Other'].includes(d.type) &&
      d.status === 'Revision'
    );
  };

  // Check if a specific task is in revision
  const isTaskInRevision = (task: any, project: any) => {
    // Check if task's deliverable is in revision
    if (task.deliverableId) {
      const deliverable = project.deliverables?.find((d: any) => d.id === task.deliverableId);
      if (deliverable) {
        // Check deliverable status first - this is the most reliable indicator
        if (deliverable.status === 'Revision') {
          return true;
        }
        
        // Check deliverable history for "Revision Requested" action
        // This catches cases where PM requested revision but status hasn't updated yet
        const history = deliverableHistory[deliverable.id] || [];
        if (history.length > 0) {
          // If task has been resubmitted (status is 'In Review'), it's no longer in revision
          if (task.status === 'In Review') {
            return false;
          }
          
          // Check file-specific history if task has a fileUrl
          if (task.fileUrl) {
            // Find history entries for this specific file
            const fileHistory = history.filter((h: any) => h.fileUrl === task.fileUrl);
            if (fileHistory.length > 0) {
              const latestFileHistory = fileHistory[0];
              // If latest file history is "Revision Requested", task is in revision
              if (latestFileHistory.action === 'Revision Requested') {
                return true;
              }
            }
          }
          
          // Also check general deliverable history
          // Find the most recent "Revision Requested" entry
          const revisionHistory = history.filter((h: any) => h.action === 'Revision Requested');
          if (revisionHistory.length > 0) {
            const latestRevision = revisionHistory[0];
            // If task has fileUrl, prefer matching fileUrl, but also accept general revision requests
            if (!task.fileUrl || !latestRevision.fileUrl || latestRevision.fileUrl === task.fileUrl) {
              return true;
            }
          }
        }
      }
    }
    // Don't fall back to checking project-wide revision status
    // Only mark tasks as in revision if they're specifically linked to a deliverable in revision
    return false;
  };

  // Get task-specific revision notes
  const getTaskNotes = (task: any, project: any) => {
    if (!task.deliverableId) return [];
    
    const deliverable = project.deliverables?.find((d: any) => d.id === task.deliverableId);
    if (!deliverable) return [];
    
    const history = deliverableHistory[deliverable.id] || [];
    const taskNotes: any[] = [];
    
    // Filter history entries to only include those relevant to this task
    history.forEach((h: any) => {
      if (h.notes && h.notes.trim() && h.action === 'Revision Requested') {
        // If task has a fileUrl, only include notes for that specific file
        if (task.fileUrl) {
          if (h.fileUrl === task.fileUrl) {
            taskNotes.push({
              ...h,
              deliverableType: deliverable.type || deliverable.customType,
              deliverableId: deliverable.id,
            });
          }
        } else {
          // If task doesn't have a fileUrl, include general deliverable revision notes
          // (but only if the history entry also doesn't have a specific fileUrl)
          if (!h.fileUrl) {
            taskNotes.push({
              ...h,
              deliverableType: deliverable.type || deliverable.customType,
              deliverableId: deliverable.id,
            });
          }
        }
      }
    });
    
    // Sort by date (newest first)
    return taskNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const isTaskOverdue = (task: any) => {
    if (!task.dueDate || task.isCompleted) return false;
    return new Date(task.dueDate) < new Date();
  };

  const getDaysUntilDue = (dueDate: string) => {
    if (!dueDate) return null;
    const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const myTasks = tasks.filter((t: any) => t.assignedToId === user?.id);
  const unassignedTasks = tasks.filter((t: any) => !t.assignedToId);
  const todoCount = myTasks.filter((t: any) => t.status === 'Todo' && !t.isCompleted).length;
  const inProgressCount = myTasks.filter((t: any) => t.status === 'In Progress').length;
  const inReviewCount = myTasks.filter((t: any) => t.status === 'In Review').length;
  const completedCount = myTasks.filter((t: any) => t.isCompleted).length;
  const overdueCount = myTasks.filter((t: any) => isTaskOverdue(t)).length;

  if (loading) {
    return (
      <div className="dashboard copy-dashboard">
        <div className="loading-skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-cards">
            {[1, 2, 3].map(i => <div key={i} className="skeleton-card"></div>)}
          </div>
        </div>
      </div>
    );
  }

  const filteredTasks = getFilteredAndSortedTasks();
  
  // Group tasks by project, but also include projects without tasks
  const groupedTasks: any = {};
  
  // First, initialize all Copy stage projects
  projects.forEach((project: any) => {
    groupedTasks[project.id] = {
      project,
      tasks: [],
    };
  });
  
  // Then, add tasks to their respective projects
  filteredTasks.forEach((task: any) => {
    if (groupedTasks[task.projectId]) {
      groupedTasks[task.projectId].tasks.push(task);
    }
  });

  return (
    <div className="dashboard premium copy-dashboard">
      {/* Premium Navigation Bar - Matching PM Dashboard */}
      <nav className="dashboard-nav premium-nav">
        <div className="nav-container">
          <h2 className="logo">Copy Production</h2>
          <div className="nav-right">
            {/* Notification Bell - Always Visible */}
            <button
              className="notification-button"
              onClick={() => setShowNotificationsModal(true)}
              style={{
                position: 'relative',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.5rem',
                marginRight: '1rem',
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
                      ? '#dc2626' // Red for 10+
                      : unreadNotifications >= 5 
                      ? '#f59e0b' // Orange for 5+
                      : '#10b981', // Green for 1
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
      </nav>

      <div className="dashboard-content">
        {/* Premium Header */}
        <div className="dashboard-header premium-header">
          <div className="header-left">
            <h1 className="dashboard-title premium-title">
              {getGreeting()}, {user?.name?.split(' ')[0]}.
            </h1>
            <p className="dashboard-subtitle premium-subtitle">
              {unassignedTasks.length > 0 && `${unassignedTasks.length} ${unassignedTasks.length === 1 ? 'task' : 'tasks'} available to claim`}
              {myTasks.length > 0 && ` • ${myTasks.length} ${myTasks.length === 1 ? 'task' : 'tasks'} assigned to you`}
              {todoCount === 0 && myTasks.length > 0 && ' • All caught up! 🎉'}
              {todoCount > 0 && ` • ${todoCount} ${todoCount === 1 ? 'task' : 'tasks'} ready to start`}
              {overdueCount > 0 && ` • ${overdueCount} ${overdueCount === 1 ? 'task' : 'tasks'} overdue`}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
      <div className="dashboard-stats premium-stats copy-stats">
        <div className={`stat-card premium-stat-card ${filter === 'todo' ? 'active' : ''}`}
          onClick={() => setFilter(filter === 'todo' ? 'all' : 'todo')}>
          <div className="stat-icon copy-stat-icon">
            <FaFileAlt />
          </div>
          <div className="stat-content">
            <div className="stat-value">{todoCount}</div>
            <div className="stat-label">To Do</div>
          </div>
        </div>
        <div className={`stat-card premium-stat-card ${filter === 'in_progress' ? 'active' : ''}`}
          onClick={() => setFilter(filter === 'in_progress' ? 'all' : 'in_progress')}>
          <div className="stat-icon copy-stat-icon" style={{ color: '#3b82f6' }}>
            <FaSpinner />
          </div>
          <div className="stat-content">
            <div className="stat-value">{inProgressCount}</div>
            <div className="stat-label">In Progress</div>
          </div>
        </div>
        <div className={`stat-card premium-stat-card ${filter === 'in_review' ? 'active' : ''}`}
          onClick={() => setFilter(filter === 'in_review' ? 'all' : 'in_review')}>
          <div className="stat-icon copy-stat-icon" style={{ color: '#f59e0b' }}>
            <FaEye />
          </div>
          <div className="stat-content">
            <div className="stat-value">{inReviewCount}</div>
            <div className="stat-label">In Review</div>
          </div>
        </div>
        <div className={`stat-card premium-stat-card ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter(filter === 'completed' ? 'all' : 'completed')}>
          <div className="stat-icon copy-stat-icon" style={{ color: '#10b981' }}>
            <FaCheckCircle />
          </div>
          <div className="stat-content">
            <div className="stat-value">{completedCount}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>
        {overdueCount > 0 && (
          <div className="stat-card premium-stat-card overdue-stat">
            <div className="stat-icon copy-stat-icon" style={{ color: '#ef4444' }}>
              <FaExclamationTriangle />
            </div>
            <div className="stat-content">
              <div className="stat-value">{overdueCount}</div>
              <div className="stat-label">Overdue</div>
            </div>
          </div>
        )}
      </div>

      {/* Filters and Sort */}
      <div className="copy-controls">
        <div className="filter-group">
          <FaFilter className="filter-icon" />
          <select
            className="filter-select copy-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <option value="all">All Tasks</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="in_review">In Review</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="sort-group">
          <FaSort className="sort-icon" />
          <select
            className="filter-select copy-filter"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="due_date">Sort by Due Date</option>
            <option value="priority">Sort by Priority</option>
            <option value="created">Sort by Created</option>
          </select>
        </div>
      </div>

      {/* Production Queue */}
      <div className="copy-production-queue">
        {projects.length === 0 ? (
          <div className="empty-queue">
            <FaFileAlt className="empty-icon" />
            <h3>No projects in Copy stage</h3>
            <p>Projects will appear here when moved to Copy or Copy Revision stage.</p>
          </div>
        ) : (
          Object.values(groupedTasks).map((group: any) => {
            const project = group.project;
            if (!project) return null;
            
            // Show project even if it has no tasks
            const projectTasks = group.tasks || [];
            
            // Check if project has any assigned copy tasks
            const hasAssignedTasks = projectTasks.some((t: any) => t.assignedToId);
            const hasUnassignedTasks = projectTasks.some((t: any) => !t.assignedToId);
            const canClaimProject = !hasAssignedTasks && (projectTasks.length === 0 || hasUnassignedTasks);

            return (
              <div key={project.id} className="project-group-card">
                <div className="project-group-header">
                  <div className="project-header-left">
                    <h3 className="project-name">{project.clientName}</h3>
                    <span className={`client-type-badge ${project.clientType.toLowerCase()}`}>
                      {project.clientType}
                    </span>
                    <span className={`stage-badge copy-stage ${project.stage.toLowerCase().replace(' ', '-')}`}>
                      {project.stage}
                    </span>
                      {project.copyRevisionCount > 0 && (
                        <span className="revision-badge">
                          Rev {project.copyRevisionCount}
                        </span>
                      )}
                    </div>
                  <div className="project-header-actions">
                    {canClaimProject && (
                      <button
                        className="claim-project-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Claim button clicked for project:', project.id);
                          handleClaimProject(project.id);
                        }}
                        disabled={updatingTask === 'project-' + project.id}
                      >
                        {updatingTask === 'project-' + project.id ? (
                          <>
                            <FaSpinner className="spinner" /> Claiming...
                          </>
                        ) : (
                          <>
                            <FaHandPaper /> Claim Project
                          </>
                        )}
                      </button>
                    )}
                    <button
                      className="view-project-btn"
                      onClick={() => navigate(`/project/${project.id}`)}
                    >
                      View Project <FaEdit />
                    </button>
                  </div>
                </div>

                <div className="tasks-grid">
                  {projectTasks.length === 0 ? (
                    <div className="no-tasks-message">
                      <FaFileAlt className="no-tasks-icon" />
                      <p>No copy tasks created yet.</p>
                      {canClaimProject && (
                        <p className="claim-hint">Click "Claim Project" above to get started.</p>
                      )}
                    </div>
                  ) : (
                    projectTasks.map((task: any) => {
                    const isOverdue = isTaskOverdue(task);
                    const daysUntilDue = getDaysUntilDue(task.dueDate);
                    const statusColor = getTaskStatusColor(task.status, task.isCompleted);
                    const taskInRevision = isTaskInRevision(task, project);
                    const borderColor = getTaskBorderColor(task.status, task.isCompleted, taskInRevision);
                    const taskNotes = getTaskNotes(task, project);

                    return (
                      <div
                        key={task.id}
                        className={`task-card copy-task-card ${task.isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''} ${taskInRevision ? 'revision-task' : ''}`}
                        style={{
                          border: taskInRevision ? '2px solid #dc2626' : `2px solid ${borderColor}`,
                          borderLeft: taskInRevision ? '4px solid #dc2626' : `4px solid ${borderColor}`,
                          position: 'relative'
                        }}
                      >
                        {/* Revision Ribbon */}
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
                        <div className="task-header">
                          <div className="task-status-indicator" style={{ backgroundColor: statusColor }}></div>
                          <h4 className="task-title">{task.title}</h4>
                          {task.isCompleted && (
                            <FaCheckCircle className="completed-icon" />
                          )}
                        </div>

                        {task.description && (
                          <p className="task-description">{task.description}</p>
                        )}

                        {/* Show revision badge if project has revision deliverables */}
                        {hasRevisionDeliverables(project) && (
                          <div className="revision-badge-task">
                            <FaExclamationTriangle className="revision-icon" />
                            <span>Revision Required</span>
                          </div>
                        )}

                        {/* Task-specific revision notes */}
                        {taskNotes.length > 0 && (() => {
                          // Calculate total length of all notes
                          const totalNotesLength = taskNotes.reduce((sum, note) => {
                            const notes = note.notes || '';
                            const attachmentMatch = notes.match(/Attachment:\s*(https?:\/\/[^\s]+)/i);
                            const notesText = attachmentMatch 
                              ? notes.replace(/Attachment:\s*https?:\/\/[^\s]+/i, '').trim()
                              : notes.trim();
                            return sum + notesText.length;
                          }, 0);
                          
                          const shouldTruncate = totalNotesLength > 200; // Show "View full note" if total length > 200 chars
                          const maxDisplayLength = 200;
                          
                          return (
                            <div style={{
                              marginTop: '0.75rem',
                              marginBottom: '0.75rem',
                              padding: '0.75rem',
                              background: '#fef3c7',
                              border: '1px solid #fde68a',
                              borderRadius: '8px'
                            }}>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                marginBottom: '0.5rem' 
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <FaStickyNote style={{ color: '#f59e0b', fontSize: '0.875rem' }} />
                                  <strong style={{ color: '#92400e', fontSize: '0.8125rem' }}>
                                    Revision Notes
                                  </strong>
                                </div>
                                {shouldTruncate && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTaskNotes(taskNotes);
                                      setSelectedTaskTitle(task.title);
                                      setShowNotesModal(true);
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#667eea',
                                      fontSize: '0.75rem',
                                      fontWeight: 500,
                                      cursor: 'pointer',
                                      textDecoration: 'underline',
                                      padding: '0.25rem 0.5rem',
                                      borderRadius: '4px',
                                      transition: 'background 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#f0f4ff';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'none';
                                    }}
                                  >
                                    View full note
                                  </button>
                                )}
                              </div>
                              {taskNotes.map((note, noteIdx) => {
                                const notes = note.notes || '';
                                const attachmentMatch = notes.match(/Attachment:\s*(https?:\/\/[^\s]+)/i);
                                const hasAttachment = !!attachmentMatch;
                                let notesText = attachmentMatch 
                                  ? notes.replace(/Attachment:\s*https?:\/\/[^\s]+/i, '').trim()
                                  : notes.trim();
                                const attachmentUrl = attachmentMatch ? attachmentMatch[1] : null;
                                
                                // Truncate if needed
                                let displayedText = notesText;
                                let remainingLength = maxDisplayLength;
                                if (shouldTruncate && noteIdx === 0) {
                                  // Only truncate the first note if total is too long
                                  if (notesText.length > remainingLength) {
                                    displayedText = notesText.substring(0, remainingLength) + '...';
                                  } else {
                                    remainingLength -= notesText.length;
                                  }
                                }
                                
                                return (
                                  <div 
                                    key={noteIdx}
                                    style={{
                                      marginTop: noteIdx > 0 ? '0.75rem' : 0,
                                      paddingTop: noteIdx > 0 ? '0.75rem' : 0,
                                      borderTop: noteIdx > 0 ? '1px solid #fde68a' : 'none'
                                    }}
                                  >
                                    {displayedText && (
                                      <div style={{ 
                                        color: '#92400e', 
                                        fontSize: '0.8125rem', 
                                        whiteSpace: 'pre-wrap', 
                                        lineHeight: '1.5',
                                        marginBottom: hasAttachment ? '0.5rem' : 0
                                      }}>
                                        {displayedText}
                                      </div>
                                    )}
                                    {hasAttachment && attachmentUrl && (
                                      <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '0.5rem',
                                        padding: '0.5rem',
                                        background: 'white',
                                        borderRadius: '4px'
                                      }}>
                                        <FaLink style={{ color: '#667eea', fontSize: '0.75rem' }} />
                                        <a 
                                          href={attachmentUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          style={{ 
                                            color: '#667eea', 
                                            textDecoration: 'underline', 
                                            wordBreak: 'break-all',
                                            fontSize: '0.75rem'
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
                          );
                        })()}

                        {task.fileUrl && (
                          <div className="task-drive-link">
                            <FaGoogleDrive className="drive-icon" />
                            <a 
                              href={task.fileUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="drive-link"
                            >
                              View Google Drive Files
                            </a>
                          </div>
                        )}

                        <div className="task-meta">
                          {task.dueDate && (
                            <div className={`task-due-date ${isOverdue ? 'overdue' : ''}`}>
                              <FaClock />
                              <span>
                                {isOverdue
                                  ? `Overdue ${Math.abs(daysUntilDue || 0)} ${Math.abs(daysUntilDue || 0) === 1 ? 'day' : 'days'}`
                                  : daysUntilDue === 0
                                  ? 'Due today'
                                  : daysUntilDue === 1
                                  ? 'Due tomorrow'
                                  : daysUntilDue && daysUntilDue > 0
                                  ? `${daysUntilDue} days left`
                                  : 'No due date'}
                              </span>
                            </div>
                          )}
                          <div className="task-priority">
                            <span className={`priority-dot priority-${project.priority?.toLowerCase()}`}></span>
                            {project.priority}
                          </div>
                        </div>

                        {/* Assignment/Ownership Info */}
                        <div className="task-assignment">
                          {task.assignedTo ? (
                            <div className={`assignment-info ${task.assignedToId === user?.id ? 'assigned-to-me' : 'assigned-to-other'}`}>
                              <FaUser className="assignment-icon" />
                              <span>
                                {task.assignedToId === user?.id 
                                  ? 'Assigned to you' 
                                  : `Assigned to ${task.assignedTo.name}`}
                              </span>
                            </div>
                          ) : (
                            <div className="assignment-info unassigned">
                              <FaUser className="assignment-icon" />
                              <span>Unassigned</span>
                            </div>
                          )}
                        </div>

                        {!task.isCompleted && (
                          <div className="task-actions">
                            {!task.assignedTo ? (
                              <button
                                className="task-action-btn claim-btn"
                                onClick={() => handleClaimTask(task.id)}
                                disabled={updatingTask === task.id}
                              >
                                {updatingTask === task.id ? <FaSpinner className="spinner" /> : 'Claim Task'}
                              </button>
                            ) : task.assignedToId === user?.id ? (
                              <>
                                {task.status === 'Todo' && (
                                  <button
                                    className="task-action-btn start-btn"
                                    onClick={() => handleTaskStatusUpdate(task.id, 'In Progress')}
                                    disabled={updatingTask === task.id}
                                  >
                                    {updatingTask === task.id ? <FaSpinner className="spinner" /> : 'Start'}
                                  </button>
                                )}
                                {(task.status === 'In Progress' || (hasRevisionDeliverables(project) && task.status === 'In Review')) && (
                                  <>
                                    <button
                                      className="task-action-btn review-btn"
                                      onClick={() => handleSendForReview(task)}
                                      disabled={updatingTask === task.id}
                                    >
                                      {updatingTask === task.id ? <FaSpinner className="spinner" /> : hasRevisionDeliverables(project) ? 'Resubmit for Review' : 'Send for Review'}
                                    </button>
                                    {!hasRevisionDeliverables(project) && (
                                      <button
                                        className="task-action-btn complete-btn"
                                        onClick={() => handleTaskStatusUpdate(task.id, 'Completed', true)}
                                        disabled={updatingTask === task.id}
                                      >
                                        {updatingTask === task.id ? <FaSpinner className="spinner" /> : 'Complete'}
                                      </button>
                                    )}
                                  </>
                                )}
                                {task.status === 'In Review' && !hasRevisionDeliverables(project) && (
                                  <button
                                    className="task-action-btn complete-btn"
                                    onClick={() => handleTaskStatusUpdate(task.id, 'Completed', true)}
                                    disabled={updatingTask === task.id}
                                  >
                                    {updatingTask === task.id ? <FaSpinner className="spinner" /> : 'Mark Complete'}
                                  </button>
                                )}
                              </>
                            ) : (
                              <div className="task-locked-message">
                                This task is assigned to {task.assignedTo.name}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                  )}
                </div>
              </div>
            );
          })
        )}
        </div>

        <NotificationsModal
          isOpen={showNotificationsModal}
          onClose={() => {
            setShowNotificationsModal(false);
          }}
          onUpdate={loadUnreadCount}
          onMarkAllAsRead={() => {
            setUnreadNotifications(0);
            // Prevent refresh for 5 seconds after marking all as read
            skipRefreshUntilRef.current = Date.now() + 5000;
            // After 5 seconds, refresh to get accurate count from server
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
        
        {/* Notes and Attachments Modal */}
        {/* Task Notes Modal */}
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
    </div>
  );
};

export default CopyDashboard;
