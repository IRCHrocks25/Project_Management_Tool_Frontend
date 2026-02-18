import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaChevronDown,
  FaUser,
  FaBell,
  FaCog,
  FaSignOutAlt,
  FaPalette,
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
  FaPaintBrush,
  FaFigma,
  FaPlus,
} from 'react-icons/fa';
import { authService } from '../../services/auth.service';
import { projectService } from '../../services/project.service';
import { taskService } from '../../services/task.service';
import { notificationService } from '../../services/notification.service';
import NotificationsModal from '../NotificationsModal';
import SendForReviewModal from '../SendForReviewModal';
import EditTaskModal from '../EditTaskModal';
import AddTaskModal from '../AddTaskModal';
import '../Dashboard.css';
import './DesignerDashboard.css';

const DesignerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedTaskForReview, setSelectedTaskForReview] = useState<any>(null);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<any>(null);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [selectedProjectForAddTask, setSelectedProjectForAddTask] = useState<string | null>(null);
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
    }, 30000);
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
        taskService.getAll(),
      ]);

      // Filter design-related projects
      const designProjects = projectsData.filter((p: any) =>
        ['Design', 'Design Revision'].includes(p.stage)
      );

      // Get ALL design tasks for design stage projects
      const designTasks = allTasksData.filter((t: any) =>
        t.type === 'Design' && designProjects.some((p: any) => p.id === t.projectId)
      );

      // Load deliverable history for all design projects to check for file-level revisions
      const projectsWithHistory = await Promise.all(
        designProjects.map(async (project: any) => {
          if (!project.deliverables || project.deliverables.length === 0) {
            return project;
          }

          // Check each design deliverable for file-level revision history
          const designDeliverables = project.deliverables.filter((d: any) =>
            ['Logo', 'Social Banners', 'Speaker Kit', 'Landing Page'].includes(d.type)
          );

          let hasFileRevision = false;
          for (const deliverable of designDeliverables) {
            try {
              const { deliverableService } = await import('../../services/deliverable.service');
              const history = await deliverableService.getHistory(deliverable.id);
              // Check if any history entry is a revision request
              if (history.some((h: any) => h.action === 'Revision Requested' && h.fileUrl)) {
                hasFileRevision = true;
                break;
              }
            } catch (error) {
              console.error(`Failed to load history for deliverable ${deliverable.id}:`, error);
            }
          }

          // If file-level revision exists, ensure project stage reflects it
          if (hasFileRevision && project.stage !== 'Design Revision') {
            return { ...project, stage: 'Design Revision' };
          }

          return project;
        })
      );

      setProjects(projectsWithHistory);
      setTasks(designTasks);
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
      
      const projectTasks = tasks.filter((t: any) => 
        t.projectId === projectId && t.type === 'Design'
      );
      
      // Only assign existing unassigned tasks, don't auto-create tasks
      const unassignedProjectTasks = projectTasks.filter((t: any) => !t.assignedToId);
      if (unassignedProjectTasks.length > 0) {
        await Promise.all(
          unassignedProjectTasks.map((task: any) => taskService.assign(task.id, user.id))
        );
      }
      
      await loadData();
    } catch (error: any) {
      console.error('Failed to claim project:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      alert(`Failed to claim project: ${errorMessage}`);
    } finally {
      setUpdatingTask(null);
    }
  };

  const handleEditTask = (task: any) => {
    setSelectedTaskForEdit(task);
    setShowEditTaskModal(true);
  };

  const handleDeleteTask = () => {
    loadData();
  };

  const handleAddTask = (projectId: string) => {
    setSelectedProjectForAddTask(projectId);
    setShowAddTaskModal(true);
  };

  const handleTaskAdded = () => {
    loadData();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getFilteredAndSortedTasks = () => {
    let filtered = tasks;

    if (filter === 'todo') {
      filtered = filtered.filter((t: any) => t.status === 'Todo' && !t.isCompleted);
    } else if (filter === 'in_progress') {
      filtered = filtered.filter((t: any) => t.status === 'In Progress');
    } else if (filter === 'in_review') {
      filtered = filtered.filter((t: any) => t.status === 'In Review');
    } else if (filter === 'completed') {
      filtered = filtered.filter((t: any) => t.isCompleted);
    }

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
    if (isCompleted) return '#10b981';
    if (status === 'In Progress') return '#8b5cf6';
    if (status === 'In Review') return '#f59e0b';
    if (status === 'Blocked') return '#ef4444';
    return '#6b7280';
  };

  const hasRevisionDeliverables = (project: any) => {
    // Only show revision badge if project is in Design Revision stage
    // OR if there are design-specific deliverables in revision status
    if (project.stage === 'Design Revision') {
      // Check if there are actually any design deliverables still in revision
      const designDeliverablesInRevision = project.deliverables?.some((d: any) => 
        ['Logo', 'Social Banners', 'Speaker Kit', 'Landing Page'].includes(d.type) &&
        d.status === 'Revision'
      );
      return designDeliverablesInRevision || false;
    }
    
    // Check for design-specific deliverables (not copy deliverables like Brand Book)
    return project.deliverables?.some((d: any) => 
      ['Logo', 'Social Banners', 'Speaker Kit', 'Landing Page'].includes(d.type) &&
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
      <div className="dashboard designer-dashboard">
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
  
  const groupedTasks: any = {};
  
  projects.forEach((project: any) => {
    groupedTasks[project.id] = {
      project,
      tasks: [],
    };
  });
  
  filteredTasks.forEach((task: any) => {
    if (groupedTasks[task.projectId]) {
      groupedTasks[task.projectId].tasks.push(task);
    }
  });

  // Sort tasks within each project to ensure "Create Design Concepts" comes before "Refine Design"
  Object.values(groupedTasks).forEach((group: any) => {
    if (group.tasks && group.tasks.length > 0) {
      group.tasks.sort((a: any, b: any) => {
        // Define task order priority
        const taskOrder: any = {
          'Create Design Concepts': 1,
          'Refine Design': 2,
        };
        const aOrder = taskOrder[a.title] || 999;
        const bOrder = taskOrder[b.title] || 999;
        return aOrder - bOrder;
      });
    }
  });

  return (
    <div className="dashboard premium designer-dashboard">
      {/* Premium Navigation Bar */}
      <nav className="dashboard-nav premium-nav">
        <div className="nav-container">
          <h2 className="logo">Design Studio</h2>
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
              {unassignedTasks.length > 0 && `${unassignedTasks.length} ${unassignedTasks.length === 1 ? 'project' : 'projects'} ready to design`}
              {myTasks.length > 0 && ` • ${myTasks.length} ${myTasks.length === 1 ? 'task' : 'tasks'} in your pipeline`}
              {todoCount === 0 && myTasks.length > 0 && ' • All designs complete! ✨'}
              {todoCount > 0 && ` • ${todoCount} ${todoCount === 1 ? 'design' : 'designs'} ready to start`}
              {overdueCount > 0 && ` • ${overdueCount} ${overdueCount === 1 ? 'design' : 'designs'} overdue`}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="dashboard-stats premium-stats designer-stats">
          <div className={`stat-card premium-stat-card ${filter === 'todo' ? 'active' : ''}`}
            onClick={() => setFilter(filter === 'todo' ? 'all' : 'todo')}>
            <div className="stat-icon designer-stat-icon">
              <FaPalette />
            </div>
            <div className="stat-content">
              <div className="stat-value">{todoCount}</div>
              <div className="stat-label">To Design</div>
            </div>
          </div>
          <div className={`stat-card premium-stat-card ${filter === 'in_progress' ? 'active' : ''}`}
            onClick={() => setFilter(filter === 'in_progress' ? 'all' : 'in_progress')}>
            <div className="stat-icon designer-stat-icon" style={{ color: '#8b5cf6' }}>
              <FaPaintBrush />
            </div>
            <div className="stat-content">
              <div className="stat-value">{inProgressCount}</div>
              <div className="stat-label">In Progress</div>
            </div>
          </div>
          <div className={`stat-card premium-stat-card ${filter === 'in_review' ? 'active' : ''}`}
            onClick={() => setFilter(filter === 'in_review' ? 'all' : 'in_review')}>
            <div className="stat-icon designer-stat-icon" style={{ color: '#f59e0b' }}>
              <FaEye />
            </div>
            <div className="stat-content">
              <div className="stat-value">{inReviewCount}</div>
              <div className="stat-label">In Review</div>
            </div>
          </div>
          <div className={`stat-card premium-stat-card ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter(filter === 'completed' ? 'all' : 'completed')}>
            <div className="stat-icon designer-stat-icon" style={{ color: '#10b981' }}>
              <FaCheckCircle />
            </div>
            <div className="stat-content">
              <div className="stat-value">{completedCount}</div>
              <div className="stat-label">Completed</div>
            </div>
          </div>
          {overdueCount > 0 && (
            <div className="stat-card premium-stat-card overdue-stat">
              <div className="stat-icon designer-stat-icon" style={{ color: '#ef4444' }}>
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
        <div className="designer-controls">
          <div className="filter-group">
            <FaFilter className="filter-icon" />
            <select
              className="filter-select designer-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="all">All Designs</option>
              <option value="todo">To Design</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="sort-group">
            <FaSort className="sort-icon" />
            <select
              className="filter-select designer-filter"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="due_date">Sort by Due Date</option>
              <option value="priority">Sort by Priority</option>
              <option value="created">Sort by Created</option>
            </select>
          </div>
        </div>

        {/* Design Pipeline */}
        <div className="designer-pipeline">
          {projects.length === 0 ? (
            <div className="empty-queue">
              <FaPalette className="empty-icon" />
              <h3>No projects in Design stage</h3>
              <p>Projects will appear here when moved to Design or Design Revision stage.</p>
            </div>
          ) : (
            Object.values(groupedTasks).map((group: any) => {
              const project = group.project;
              if (!project) return null;
              
              const projectTasks = group.tasks || [];
              const hasAssignedTasks = projectTasks.some((t: any) => t.assignedToId);
              const hasUnassignedTasks = projectTasks.some((t: any) => !t.assignedToId);
              const canClaimProject = !hasAssignedTasks && (projectTasks.length === 0 || hasUnassignedTasks);

              return (
                <div key={project.id} className="project-group-card designer-card">
                  <div className="project-group-header">
                    <div className="project-header-left">
                      <h3 className="project-name">{project.clientName}</h3>
                      <span className={`client-type-badge ${project.clientType.toLowerCase()}`}>
                        {project.clientType}
                      </span>
                      <span className={`stage-badge designer-stage ${project.stage.toLowerCase().replace(' ', '-')}`}>
                        {project.stage}
                      </span>
                      {project.designRevisionCount > 0 && (
                        <span className="revision-badge">
                          Rev {project.designRevisionCount}
                        </span>
                      )}
                    </div>
                    <div className="project-header-actions">
                      {canClaimProject && (
                        <button
                          className="claim-project-btn designer-claim-btn"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
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
                        className="add-task-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAddTask(project.id);
                        }}
                      >
                        <FaPlus /> Add Task
                      </button>
                      <button
                        className="view-project-btn designer-view-btn"
                        onClick={() => navigate(`/project/${project.id}`)}
                      >
                        View Project <FaEdit />
                      </button>
                    </div>
                  </div>

                  <div className="tasks-grid">
                    {projectTasks.length === 0 ? (
                      <div className="no-tasks-message">
                        <FaPalette className="no-tasks-icon" />
                        <p>No design tasks created yet.</p>
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
                            className={`task-card designer-task-card ${task.isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`}
                          >
                            <div className="task-header">
                              <div className="task-status-indicator" style={{ backgroundColor: statusColor }}></div>
                              <h4 className="task-title">{task.title}</h4>
                              <div className="task-header-actions">
                                {task.isCompleted && (
                                  <FaCheckCircle className="completed-icon" />
                                )}
                                <button
                                  className="task-edit-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditTask(task);
                                  }}
                                  title="Edit task"
                                >
                                  <FaEdit />
                                </button>
                              </div>
                            </div>

                            {task.description && (
                              <p className="task-description">{task.description}</p>
                            )}

                            {hasRevisionDeliverables(project) && (
                              <div className="revision-badge-task">
                                <FaExclamationTriangle className="revision-icon" />
                                <span>Revision Required</span>
                              </div>
                            )}

                            {task.fileUrl && (
                              <div className="task-drive-link">
                                {task.fileUrl.includes('figma.com') ? (
                                  <>
                                    <FaFigma className="drive-icon" style={{ color: '#8b5cf6' }} />
                                    <a 
                                      href={task.fileUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="drive-link"
                                    >
                                      View Figma Design
                                    </a>
                                  </>
                                ) : (
                                  <>
                                    <FaGoogleDrive className="drive-icon" />
                                    <a 
                                      href={task.fileUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="drive-link"
                                    >
                                      View Design Files
                                    </a>
                                  </>
                                )}
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
                                    className="task-action-btn claim-btn designer-claim-btn"
                                    onClick={() => handleClaimTask(task.id)}
                                    disabled={updatingTask === task.id}
                                  >
                                    {updatingTask === task.id ? <FaSpinner className="spinner" /> : 'Claim Task'}
                                  </button>
                                ) : task.assignedToId === user?.id ? (
                                  <>
                                    {task.status === 'Todo' && (
                                      <button
                                        className="task-action-btn start-btn designer-start-btn"
                                        onClick={() => handleTaskStatusUpdate(task.id, 'In Progress')}
                                        disabled={updatingTask === task.id}
                                      >
                                        {updatingTask === task.id ? <FaSpinner className="spinner" /> : 'Start Designing'}
                                      </button>
                                    )}
                                    {(task.status === 'In Progress' || (hasRevisionDeliverables(project) && task.status === 'In Review')) && (
                                      <>
                                        <button
                                          className="task-action-btn review-btn designer-review-btn"
                                          onClick={() => handleSendForReview(task)}
                                          disabled={updatingTask === task.id}
                                        >
                                          {updatingTask === task.id ? <FaSpinner className="spinner" /> : hasRevisionDeliverables(project) ? 'Resubmit Design' : 'Send for Review'}
                                        </button>
                                        {!hasRevisionDeliverables(project) && (
                                          <button
                                            className="task-action-btn complete-btn designer-complete-btn"
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
                                        className="task-action-btn complete-btn designer-complete-btn"
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
          isDesignTask={true}
        />
        <EditTaskModal
          isOpen={showEditTaskModal}
          onClose={() => {
            setShowEditTaskModal(false);
            setSelectedTaskForEdit(null);
          }}
          task={selectedTaskForEdit}
          projectId={selectedTaskForEdit?.projectId || ''}
          onUpdate={loadData}
          onDelete={handleDeleteTask}
        />
        <AddTaskModal
          isOpen={showAddTaskModal}
          onClose={() => {
            setShowAddTaskModal(false);
            setSelectedProjectForAddTask(null);
          }}
          projectId={selectedProjectForAddTask || ''}
          taskType="Design"
          onTaskAdded={handleTaskAdded}
        />
      </div>
    </div>
  );
};

export default DesignerDashboard;
