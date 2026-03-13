import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaChevronDown, FaBell, FaCog, FaSignOutAlt, FaUsers, FaFolder, FaArrowLeft, FaComments } from 'react-icons/fa';
import { authService } from '../services/auth.service';
import { projectService } from '../services/project.service';
import { notificationService } from '../services/notification.service';
import NotificationsModal from './NotificationsModal';
import LiveChatPanel from './LiveChatPanel';
import UserAvatar from './UserAvatar';
import { useUnreadChatCount } from '../hooks/useUnreadChatCount';
import './Dashboard.css';

const CompletedProjects: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const [completedProjects, setCompletedProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showLiveChatPanel, setShowLiveChatPanel] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadChatCount, refreshUnreadChat] = useUnreadChatCount();
  const [priorityFilter, setPriorityFilter] = useState<string>('All Priorities');
  const [clientTypeFilter, setClientTypeFilter] = useState<string>('All Client Types');
  const [stageFilter, setStageFilter] = useState<string>('All Stages');
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const skipRefreshUntilRef = React.useRef<number | null>(null);

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

  const loadUnreadCount = async () => {
    try {
      if (skipRefreshUntilRef.current && Date.now() < skipRefreshUntilRef.current) {
        return;
      }
      const count = await notificationService.getUnreadCount();
      setUnreadNotifications(count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await projectService.getCompleted();
      setCompletedProjects(data);
    } catch (error) {
      console.error('Failed to load completed projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/');
  };

  const getFilteredProjects = () => {
    let filtered = [...completedProjects];

    // Apply priority filter
    if (priorityFilter !== 'All Priorities') {
      filtered = filtered.filter((p: any) => p.priority === priorityFilter);
    }

    // Apply client type filter
    if (clientTypeFilter !== 'All Client Types') {
      filtered = filtered.filter((p: any) => p.clientType === clientTypeFilter);
    }

    // Apply stage filter
    if (stageFilter !== 'All Stages') {
      filtered = filtered.filter((p: any) => p.stage === stageFilter);
    }

    // Sort by completed date (newest first)
    filtered.sort((a: any, b: any) => {
      const aDate = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bDate = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bDate - aDate; // Newest first
    });

    return filtered;
  };

  const filteredProjects = getFilteredProjects();

  // Get unique stages for filter dropdown
  const uniqueStages = Array.from(new Set(completedProjects.map((p: any) => p.stage))).sort();

  if (loading) {
    return (
      <div className="dashboard premium">
        <div className="loading-skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-cards">
            {[1, 2, 3].map(i => <div key={i} className="skeleton-card"></div>)}
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
              onClick={() => navigate('/dashboard')}
              className="btn-secondary btn-secondary-premium"
              style={{ marginRight: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <FaArrowLeft />
              Back to Dashboard
            </button>
            
            {/* Live Chat - Message Icon */}
            <button
              className="notification-button"
              onClick={() => setShowLiveChatPanel(true)}
              style={{
                position: 'relative',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '0.5rem',
                marginRight: '1rem'
              }}
              title="Live Chat"
            >
              <FaComments style={{ fontSize: '1.25rem', color: '#475569' }} />
              {unreadChatCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '0',
                    right: '0',
                    background: '#ef4444',
                    color: 'white',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
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
            {/* Notification Bell - Always Visible */}
            <button
              className="notification-button"
              onClick={() => setShowNotificationsModal(true)}
              style={{
                position: 'relative',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '0.5rem',
                marginRight: '1rem'
              }}
            >
              <FaBell style={{ fontSize: '1.25rem', color: '#475569' }} />
              {unreadNotifications > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '0',
                    right: '0',
                    background: unreadNotifications >= 10 ? '#ef4444' : unreadNotifications >= 5 ? '#f97316' : '#10b981',
                    color: 'white',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
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
              Completed Projects
            </h1>
            <p className="dashboard-subtitle premium-subtitle">
              {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'} completed
            </p>
          </div>
          <div className="header-right">
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
                <option>Premium</option>
                <option>Powered-Up</option>
              </select>
              <select 
                className="filter-select"
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
              >
                <option>All Stages</option>
                {uniqueStages.map((stage: string) => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="dashboard-main premium-main">
          <div className="projects-list-view">
            {filteredProjects.length === 0 ? (
              <div className="empty-list">
                <FaCheckCircle style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }} />
                <p>No completed projects found matching your filters.</p>
              </div>
            ) : (
              <>
                <div className="list-header">
                  <div className="list-header-cell" style={{ flex: '2' }}>Project Name</div>
                  <div className="list-header-cell">Client Type</div>
                  <div className="list-header-cell">Priority</div>
                  <div className="list-header-cell">Stage</div>
                  <div className="list-header-cell">Completed Date</div>
                  <div className="list-header-cell">Actions</div>
                </div>
                <div className="list-content">
                  {filteredProjects.map((project: any) => {
                    const completedDate = project.completedAt
                      ? new Date(project.completedAt).toLocaleDateString()
                      : 'N/A';
                    
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
                        <div className="list-cell">{completedDate}</div>
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

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
        onClose={() => setShowNotificationsModal(false)}
        onMarkAllAsRead={async () => {
          try {
            await notificationService.markAllAsRead();
            setUnreadNotifications(0);
            skipRefreshUntilRef.current = Date.now() + 5000;
            setTimeout(() => {
              skipRefreshUntilRef.current = null;
              loadUnreadCount();
            }, 5000);
          } catch (error) {
            console.error('Failed to mark all as read:', error);
          }
        }}
      />
    </div>
  );
};

export default CompletedProjects;

