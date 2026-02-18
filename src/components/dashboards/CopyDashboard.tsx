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

  useEffect(() => {
    loadData();
    loadUnreadCount();
    const interval = setInterval(() => {
      loadUnreadCount();
    }, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
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
      const [projectsData, allTasksData] = await Promise.all([
        projectService.getAll(),
        taskService.getAll(), // Get ALL tasks, not just assigned ones
      ]);

      // Filter copy-related projects
      const copyProjects = projectsData.filter((p: any) =>
        ['Copy', 'Copy Revision'].includes(p.stage)
      );

      // Get ALL copy tasks for copy stage projects (not filtered by assignment)
      const copyTasks = allTasksData.filter((t: any) =>
        t.type === 'Copy' && copyProjects.some((p: any) => p.id === t.projectId)
      );

      setProjects(copyProjects);
      setTasks(copyTasks);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleSendForReview = (task: any) => {
    setSelectedTaskForReview(task);
    setShowReviewModal(true);
  };

  const handleReviewSubmit = async (driveLink: string, deliverableType: string) => {
    if (!selectedTaskForReview) return;
    
    try {
      setUpdatingTask(selectedTaskForReview.id);
      await handleTaskStatusUpdate(selectedTaskForReview.id, 'In Review', false, driveLink, deliverableType);
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

  // Check if project has deliverables in revision status
  const hasRevisionDeliverables = (project: any) => {
    return project.deliverables?.some((d: any) => 
      ['Brand Book', 'Copy of Landing Page', 'Landing Page', 'Speaker Kit', 'Other'].includes(d.type) &&
      d.status === 'Revision'
    );
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

                    return (
                      <div
                        key={task.id}
                        className={`task-card copy-task-card ${task.isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`}
                      >
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
            loadUnreadCount();
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
        />
      </div>
    </div>
  );
};

export default CopyDashboard;
