import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaFolder, FaClock, FaEnvelope, FaChevronDown, FaUser, FaBell, FaCog, FaSignOutAlt, FaUsers, FaArchive, FaCheckCircle, FaSearch } from 'react-icons/fa';
import { authService } from '../../services/auth.service';
import { projectService } from '../../services/project.service';
import { taskService } from '../../services/task.service';
import { notificationService } from '../../services/notification.service';
import KanbanBoard from '../KanbanBoard';
import CreateProjectModal from '../CreateProjectModal';
import NotificationsModal from '../NotificationsModal';
import ConfirmModal from '../ConfirmModal';
import '../Dashboard.css';

const PMDashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [projectToArchive, setProjectToArchive] = useState<string | null>(null);
  const [projectsToArchive, setProjectsToArchive] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [archiving, setArchiving] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [projectToComplete, setProjectToComplete] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>('All Priorities');
  const [clientTypeFilter, setClientTypeFilter] = useState<string>('All Client Types');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const skipRefreshUntilRef = useRef<number | null>(null);

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
  }, []);

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

  // Refresh data when window regains focus (user comes back to tab)
  useEffect(() => {
    const handleFocus = () => {
      loadData();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.avatar-dropdown-container')) {
        setShowAvatarDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Load projects and tasks first (critical for UI) - stats can load after
      const [projectsData, allTasksData] = await Promise.all([
        projectService.getAll(),
        taskService.getAll(), // Load all tasks for multi-column view (limited to 200 in backend)
      ]);
      
      // Set projects and tasks immediately for faster UI rendering
      setProjects(projectsData);
      setTasks(allTasksData);
      setLoading(false); // Show UI as soon as projects/tasks are loaded
      
      // Load stats in background (non-blocking)
      try {
        const statsData = await projectService.getStats();
        setStats(statsData);
      } catch (statsError) {
        console.error('Failed to load stats:', statsError);
        // Don't block UI if stats fail
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setLoading(false);
    }
  };


  const handleLogout = () => {
    authService.logout();
    navigate('/');
  };

  const handleProjectCreated = () => {
    setShowCreateModal(false);
    loadData();
  };

  const handleArchiveClick = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click navigation
    setProjectToArchive(projectId);
    setShowArchiveModal(true);
  };

  const handleBulkArchiveClick = () => {
    if (selectedProjects.size === 0) return;
    setProjectsToArchive(Array.from(selectedProjects));
    setShowArchiveModal(true);
  };

  const handleToggleSelect = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click navigation
    setSelectedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = getFilteredProjects();
    if (selectedProjects.size === filtered.length && filtered.length > 0) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(filtered.map((p: any) => p.id)));
    }
  };

  const handleArchiveConfirm = async () => {
    const projectsToArchiveList = projectToArchive 
      ? [projectToArchive] 
      : projectsToArchive;
    
    if (projectsToArchiveList.length === 0) return;
    
    try {
      setArchiving(true);
      // Archive all projects in parallel
      await Promise.all(
        projectsToArchiveList.map(projectId => projectService.archive(projectId))
      );
      await loadData(); // Refresh the list
      setShowArchiveModal(false);
      setProjectToArchive(null);
      setProjectsToArchive([]);
      setSelectedProjects(new Set()); // Clear selections
    } catch (error: any) {
      console.error('Failed to archive project(s):', error);
      alert(`Failed to archive ${projectsToArchiveList.length === 1 ? 'project' : 'projects'}. Please try again.`);
    } finally {
      setArchiving(false);
    }
  };

  const handleCompleteClick = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click navigation
    setProjectToComplete(projectId);
    setShowCompleteModal(true);
  };

  const handleCompleteConfirm = async () => {
    if (!projectToComplete) return;
    
    try {
      setCompleting(true);
      await projectService.complete(projectToComplete);
      await loadData(); // Refresh the list
      setShowCompleteModal(false);
      setProjectToComplete(null);
    } catch (error: any) {
      console.error('Failed to complete project:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      console.error('Error details:', errorMessage);
      alert(`Failed to mark project as complete: ${errorMessage}. Please try again or check the console for more details.`);
    } finally {
      setCompleting(false);
    }
  };


  const handleStatClick = (filterType: string) => {
    setActiveFilter(activeFilter === filterType ? null : filterType);
  };

  const getFilteredProjects = () => {
    let filtered = [...projects];
    
    // Exclude completed projects from main pipeline view
    filtered = filtered.filter((p: any) => !p.isCompleted);
    
    // Apply search filter (by project/client name)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((p: any) => 
        p.clientName?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply activeFilter (stat card filters)
    if (activeFilter) {
      switch (activeFilter) {
        case 'waiting':
          filtered = filtered.filter((p: any) => {
            const daysSinceEmail = p.lastEmailedAt
              ? Math.floor((Date.now() - new Date(p.lastEmailedAt).getTime()) / (1000 * 60 * 60 * 24))
              : 999;
            return daysSinceEmail > 5 && ['Copy Revision', 'Design Revision'].includes(p.stage);
          });
          break;
        default:
          break;
      }
    }
    
    // Apply priority filter
    if (priorityFilter !== 'All Priorities') {
      filtered = filtered.filter((p: any) => p.priority === priorityFilter);
    }
    
    // Apply client type filter
    if (clientTypeFilter !== 'All Client Types') {
      filtered = filtered.filter((p: any) => p.clientType === clientTypeFilter);
    }
    
    // Sort by oldest to newest (by createdAt, fallback to updatedAt or targetCloseMonth)
    filtered.sort((a: any, b: any) => {
      const aDate = a.createdAt 
        ? new Date(a.createdAt).getTime()
        : a.updatedAt 
        ? new Date(a.updatedAt).getTime()
        : a.targetCloseMonth 
        ? new Date(a.targetCloseMonth + '-01').getTime()
        : 0;
      
      const bDate = b.createdAt 
        ? new Date(b.createdAt).getTime()
        : b.updatedAt 
        ? new Date(b.updatedAt).getTime()
        : b.targetCloseMonth 
        ? new Date(b.targetCloseMonth + '-01').getTime()
        : 0;
      
      return aDate - bDate; // Oldest first (ascending)
    });
    
    return filtered;
  };

  // Clear selections when filters change
  useEffect(() => {
    setSelectedProjects(new Set());
  }, [activeFilter, priorityFilter, clientTypeFilter, searchTerm]);

  // Memoize expensive calculations to prevent recalculation on every render
  // MUST be called before any conditional returns (React Hooks rule)
  const todayTasks = useMemo(() => {
    return projects.reduce((acc, p) => {
      const tasks = p.tasks?.filter((t: any) => {
        if (!t.dueDate) return false;
        const dueDate = new Date(t.dueDate);
        const today = new Date();
        return dueDate.toDateString() === today.toDateString() && !t.isCompleted;
      }) || [];
      return acc + tasks.length;
    }, 0);
  }, [projects]);

  const waitingOnClient = useMemo(() => {
    return projects.filter((p: any) => {
      const daysSinceEmail = p.lastEmailedAt
        ? Math.floor((Date.now() - new Date(p.lastEmailedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      return daysSinceEmail > 5 && ['Copy Revision', 'Design Revision'].includes(p.stage);
    }).length;
  }, [projects]);

  const greetingMessage = useMemo(() => {
    return todayTasks === 0 
      ? 'All caught up 🎉' 
      : todayTasks === 1 
      ? '1 task needs attention today'
      : `${todayTasks} tasks need attention today`;
  }, [todayTasks]);

  // Memoize filtered projects to prevent expensive filtering/sorting on every render
  const filteredProjects = useMemo(() => {
    return getFilteredProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, searchTerm, activeFilter, priorityFilter, clientTypeFilter]);

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-cards">
            {[1, 2, 3].map(i => <div key={i} className="skeleton-card"></div>)}
          </div>
          <div className="skeleton-board">
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton-column"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard premium">
      <nav className="dashboard-nav premium-nav">
        <div className="nav-container">
          <h2 className="logo">Katalyst PM</h2>
          <div className="nav-right">
            <button 
              onClick={() => setShowCreateModal(true)} 
              className="btn-primary btn-primary-premium"
              style={{ marginRight: '1rem' }}
            >
              <FaPlus className="btn-icon" />
              New Project
            </button>
            
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
                      navigate('/clients');
                    }}
                    className="dropdown-item"
                  >
                    <FaFolder className="dropdown-icon" />
                    Clients
                  </button>
                  <button 
                    onClick={() => {
                      setShowAvatarDropdown(false);
                      navigate('/users');
                    }}
                    className="dropdown-item"
                  >
                    <FaUsers className="dropdown-icon" />
                    Users
                  </button>
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
                  <button 
                    onClick={() => {
                      setShowAvatarDropdown(false);
                      navigate('/completed-projects');
                    }}
                    className="dropdown-item"
                  >
                    <FaCheckCircle className="dropdown-icon" />
                    Completed Projects
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
        <div className="dashboard-header premium-header">
          <div className="header-left">
            <h1 className="premium-greeting">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]}.
            </h1>
            <p className="dashboard-subtitle premium-subtitle">
              {greetingMessage}
              {waitingOnClient > 0 && ` • ${waitingOnClient} ${waitingOnClient === 1 ? 'project' : 'projects'} waiting on client review`}
            </p>
          </div>
          <div className="header-right">
            <div className="view-toggle">
              <button 
                className={viewMode === 'kanban' ? 'active' : ''}
                onClick={() => setViewMode('kanban')}
              >
                Kanban
              </button>
              <button 
                className={viewMode === 'list' ? 'active' : ''}
                onClick={() => setViewMode('list')}
              >
                List
              </button>
            </div>
            <div className="filters">
              <div className="search-input-wrapper">
                <FaSearch className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search by project name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select 
                className="filter-select"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option>All Priorities</option>
                <option>Urgent</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
              <select 
                className="filter-select"
                value={clientTypeFilter}
                onChange={(e) => setClientTypeFilter(e.target.value)}
              >
                <option>All Client Types</option>
                <option>ICON</option>
                <option>STAR</option>
                <option>Katalyst</option>
                <option>Private</option>
              </select>
            </div>
          </div>
        </div>

        <div className="dashboard-stats premium-stats">
          <div 
            className={`stat-card premium-stat-card ${activeFilter === 'total' ? 'active' : ''}`}
            onClick={() => handleStatClick('total')}
          >
            <div className="stat-icon">
              <FaFolder />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats?.total || 0}</div>
              <div className="stat-label">Total Projects</div>
            </div>
          </div>
          <div 
            className={`stat-card premium-stat-card ${activeFilter === 'tasks' ? 'active' : ''}`}
            onClick={() => handleStatClick('tasks')}
          >
            <div className="stat-icon">
              <FaClock />
            </div>
            <div className="stat-content">
              <div className="stat-value">{todayTasks}</div>
              <div className="stat-label">Tasks Due Today</div>
            </div>
          </div>
          <div 
            className={`stat-card premium-stat-card ${activeFilter === 'waiting' ? 'active' : ''}`}
            onClick={() => handleStatClick('waiting')}
          >
            <div className="stat-icon">
              <FaEnvelope />
            </div>
            <div className="stat-content">
              <div className="stat-value">{waitingOnClient}</div>
              <div className="stat-label">Waiting on Client</div>
            </div>
          </div>
        </div>

        <div className="dashboard-main premium-main">
          {viewMode === 'kanban' ? (
            <KanbanBoard projects={filteredProjects} tasks={tasks} onUpdate={loadData} />
          ) : (
            <div className="projects-list-view">
              {selectedProjects.size > 0 && (
                <div style={{
                  padding: '1rem',
                  background: '#f1f5f9',
                  borderBottom: '2px solid #667eea',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1rem',
                  borderRadius: '0.5rem'
                }}>
                  <span style={{ fontWeight: 600, color: '#475569' }}>
                    {selectedProjects.size} project{selectedProjects.size === 1 ? '' : 's'} selected
                  </span>
                  <button
                    onClick={handleBulkArchiveClick}
                    style={{
                      background: '#64748b',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1.5rem',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: 600
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#475569';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#64748b';
                    }}
                  >
                    <FaArchive />
                    Archive Selected
                  </button>
                </div>
              )}
              <div className="list-header">
                <div className="list-header-cell" style={{ width: '50px', flex: '0 0 50px' }}>
                  <input
                    type="checkbox"
                    checked={filteredProjects.length > 0 && selectedProjects.size === filteredProjects.length}
                    onChange={() => {}}
                    onClick={handleSelectAll}
                    style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                  />
                </div>
                <div className="list-header-cell" style={{ flex: '2' }}>Project Name</div>
                <div className="list-header-cell">Client Type</div>
                <div className="list-header-cell">Priority</div>
                <div className="list-header-cell">Stage</div>
                <div className="list-header-cell">Days in Stage</div>
                <div className="list-header-cell">Actions</div>
              </div>
              <div className="list-content">
                {filteredProjects.length === 0 ? (
                  <div className="empty-list">
                    <FaFolder style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }} />
                    <p>No projects found matching your filters.</p>
                  </div>
                ) : (
                  filteredProjects.map((project: any) => {
                    const daysInStage = project.updatedAt
                      ? Math.ceil((Date.now() - new Date(project.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
                      : 0;
                    
                    return (
                      <div 
                        key={project.id} 
                        className="list-row"
                        onClick={() => navigate(`/project/${project.id}`)}
                        style={{
                          backgroundColor: selectedProjects.has(project.id) ? '#f1f5f9' : 'transparent'
                        }}
                      >
                        <div className="list-cell" style={{ width: '50px', flex: '0 0 50px' }}>
                          <input
                            type="checkbox"
                            checked={selectedProjects.has(project.id)}
                            onChange={() => {}}
                            onClick={(e) => handleToggleSelect(project.id, e)}
                            style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                          />
                        </div>
                        <div className="list-cell" style={{ flex: '2', fontWeight: 600 }}>
                          {project.clientName}
                        </div>
                        <div className="list-cell">
                          <span className={`client-type-badge ${project.clientType?.toLowerCase()}`}>
                            {project.clientType}
                          </span>
                        </div>
                        <div className="list-cell">
                          <span className={`priority-badge priority-${project.priority?.toLowerCase()}`}>
                            {project.priority}
                          </span>
                        </div>
                        <div className="list-cell">
                          <span className="stage-badge">{project.stage}</span>
                        </div>
                        <div className="list-cell">{daysInStage} {daysInStage === 1 ? 'day' : 'days'}</div>
                        <div className="list-cell" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button 
                            className="view-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/project/${project.id}`);
                            }}
                          >
                            View
                          </button>
                          <button 
                            className="view-btn"
                            onClick={(e) => handleCompleteClick(project.id, e)}
                            style={{
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              padding: '0.5rem 1rem',
                              borderRadius: '0.375rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              fontSize: '0.875rem'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#059669';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#10b981';
                            }}
                          >
                            <FaCheckCircle />
                            Mark Complete
                          </button>
                          <button 
                            className="view-btn"
                            onClick={(e) => handleArchiveClick(project.id, e)}
                            style={{
                              background: '#64748b',
                              color: 'white',
                              border: 'none',
                              padding: '0.5rem 1rem',
                              borderRadius: '0.375rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              fontSize: '0.875rem'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#475569';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#64748b';
                            }}
                          >
                            <FaArchive />
                            Archive
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleProjectCreated}
        />
      )}
      <NotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
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
      <ConfirmModal
        isOpen={showArchiveModal}
        onClose={() => {
          setShowArchiveModal(false);
          setProjectToArchive(null);
          setProjectsToArchive([]);
        }}
        onConfirm={handleArchiveConfirm}
        title={projectToArchive ? "Archive Project" : "Archive Projects"}
        message={
          projectToArchive
            ? "Are you sure you want to archive this project? It will be hidden from default views but can still be accessed via direct link."
            : `Are you sure you want to archive ${projectsToArchive.length} project${projectsToArchive.length === 1 ? '' : 's'}? They will be hidden from default views but can still be accessed via direct link.`
        }
        confirmText="Archive"
        cancelText="Cancel"
        type="warning"
        loading={archiving}
      />

      <ConfirmModal
        isOpen={showCompleteModal}
        onClose={() => {
          setShowCompleteModal(false);
          setProjectToComplete(null);
        }}
        onConfirm={handleCompleteConfirm}
        title="Mark Project as Complete"
        message="Are you sure you want to mark this project as complete? It will be removed from the pipeline and moved to Completed Projects."
        confirmText="Mark Complete"
        cancelText="Cancel"
        type="info"
        loading={completing}
      />
    </div>
  );
};

export default PMDashboard;
