import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaFolder, FaClock, FaEnvelope, FaChevronDown, FaUser, FaBell, FaCog, FaSignOutAlt } from 'react-icons/fa';
import { authService } from '../../services/auth.service';
import { projectService } from '../../services/project.service';
import { taskService } from '../../services/task.service';
import KanbanBoard from '../KanbanBoard';
import CreateProjectModal from '../CreateProjectModal';
import NotificationsModal from '../NotificationsModal';
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
  const [stats, setStats] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>('All Priorities');
  const [clientTypeFilter, setClientTypeFilter] = useState<string>('All Client Types');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

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
      const [projectsData, statsData, allTasksData] = await Promise.all([
        projectService.getAll(),
        projectService.getStats(),
        taskService.getAll(), // Load all tasks for multi-column view
      ]);
      setProjects(projectsData);
      setStats(statsData);
      setTasks(allTasksData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
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

  const handleStatClick = (filterType: string) => {
    setActiveFilter(activeFilter === filterType ? null : filterType);
  };

  const getFilteredProjects = () => {
    let filtered = [...projects];
    
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
    
    return filtered;
  };

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

  const todayTasks = projects.reduce((acc, p) => {
    const tasks = p.tasks?.filter((t: any) => {
      if (!t.dueDate) return false;
      const dueDate = new Date(t.dueDate);
      const today = new Date();
      return dueDate.toDateString() === today.toDateString() && !t.isCompleted;
    }) || [];
    return acc + tasks.length;
  }, 0);

  const waitingOnClient = projects.filter((p: any) => {
    const daysSinceEmail = p.lastEmailedAt
      ? Math.floor((Date.now() - new Date(p.lastEmailedAt).getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    return daysSinceEmail > 5 && ['Copy Revision', 'Design Revision'].includes(p.stage);
  }).length;

  const greetingMessage = todayTasks === 0 
    ? 'All caught up 🎉' 
    : todayTasks === 1 
    ? '1 task needs attention today'
    : `${todayTasks} tasks need attention today`;

  const filteredProjects = getFilteredProjects();

  return (
    <div className="dashboard premium">
      <nav className="dashboard-nav premium-nav">
        <div className="nav-container">
          <h2 className="logo">Katalyst PM</h2>
          <div className="nav-right">
            <button 
              onClick={() => setShowCreateModal(true)} 
              className="btn-primary btn-primary-premium"
            >
              <FaPlus className="btn-icon" />
              New Project
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
              <div className="list-header">
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
                      >
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
                        <div className="list-cell">
                          <button 
                            className="view-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/project/${project.id}`);
                            }}
                          >
                            View
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
      />
    </div>
  );
};

export default PMDashboard;
