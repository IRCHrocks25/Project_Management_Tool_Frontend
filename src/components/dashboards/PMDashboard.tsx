import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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

const ITEMS_PER_PAGE = 10; // Constant for pagination

const PMDashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const tasksRef = useRef<any[]>([]);
  const loadingRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);
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
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'overview'>('overview');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>('All Priorities');
  const [clientTypeFilter, setClientTypeFilter] = useState<string>('All Client Types');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showAll, setShowAll] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const skipRefreshUntilRef = useRef<number | null>(null);

  // Define loadData first so it can be used in useEffect hooks
  const loadData = useCallback(async () => {
    // Prevent concurrent calls
    if (loadingRef.current) {
      console.log('[PMDashboard] loadData already in progress, skipping...');
      return;
    }
    
    try {
      loadingRef.current = true;
      // Only show full-page loading spinner on the very first load
      const isInitialLoad = !hasLoadedOnceRef.current;
      if (isInitialLoad) {
        setLoading(true);
      }
      
      // Load projects and tasks first (critical for UI) - stats can load after
      const [projectsData, allTasksData] = await Promise.all([
        projectService.getAll(),
        taskService.getAll(), // Load all tasks for multi-column view (limited to 200 in backend)
      ]);
      
      // Set projects and tasks immediately for faster UI rendering
      setProjects(projectsData);
      setTasks(allTasksData);
      tasksRef.current = allTasksData; // Keep ref in sync
      hasLoadedOnceRef.current = true;
      setLoading(false); // Hide loading spinner (if it was shown)
      
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
    } finally {
      loadingRef.current = false;
    }
  }, []); // Empty dependency array - loadData doesn't depend on any props/state

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

  const loadNotifications = useCallback(async () => {
    try {
      const allNotifications = await notificationService.getAll();
      // Optimized: Pre-allocate array and use for loop for sorting
      const notificationsArray = Array.isArray(allNotifications) ? allNotifications : [];
      if (notificationsArray.length === 0) {
        setNotifications([]);
        return;
      }
      
      // Use a more efficient approach: only sort if we have more than 50
      let sorted;
      if (notificationsArray.length > 50) {
        // Quick partial sort - get top 50
        const withTimestamps = notificationsArray.map((n: any) => ({
          ...n,
          _sortKey: new Date(n.createdAt).getTime()
        }));
        sorted = withTimestamps
          .sort((a: any, b: any) => b._sortKey - a._sortKey)
          .slice(0, 50)
          .map(({ _sortKey, ...n }: any) => n);
      } else {
        // Small array - regular sort is fine
        sorted = notificationsArray.sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      setNotifications(sorted);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, []);

  useEffect(() => {
    // Only load data once on mount - prevent multiple calls
    let mounted = true;
    let hasLoaded = false;
    
    const initializeData = async () => {
      if (!loadingRef.current && !hasLoaded && mounted) {
        hasLoaded = true;
        await loadData();
      }
      if (mounted) {
        loadUnreadCount();
        loadNotifications(); // Load notifications for overview
      }
    };
    
    initializeData();
    
    const interval = setInterval(() => {
      // Skip refresh if we just marked all as read (within last 5 seconds)
      if (skipRefreshUntilRef.current && Date.now() < skipRefreshUntilRef.current) {
        return;
      }
      if (mounted) {
        loadUnreadCount();
        loadNotifications(); // Load notifications for overview
      }
    }, 30000); // Refresh every 30 seconds
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  // Refresh data when window regains focus (user comes back to tab)
  // Use a debounce to prevent multiple rapid calls
  useEffect(() => {
    let focusTimeout: NodeJS.Timeout;
    const handleFocus = () => {
      // Debounce focus events - only reload if focus hasn't been triggered recently
      clearTimeout(focusTimeout);
      focusTimeout = setTimeout(() => {
        // Only reload if not currently loading
        // Don't reload while create-project modal is open (avoids hiding the modal after file picker closes)
        if (!loadingRef.current && !showCreateModal) {
          loadData();
        }
      }, 500); // Wait 500ms after focus to avoid rapid-fire calls
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearTimeout(focusTimeout);
    };
  }, [loadData, showCreateModal]);

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

  // Optimized filtering function - use for loops and early returns
  const getFilteredProjects = useCallback(() => {
    if (!projects || projects.length === 0) return [];
    
    const filtered: any[] = [];
    const searchLower = searchTerm.trim().toLowerCase();
    const now = Date.now();
    const oneDay = 1000 * 60 * 60 * 24;
    
    // Pre-compute date strings for sorting
    const projectDates = new Map<string, number>();
    
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      
      // Skip archived or completed projects
      if (p.isArchived) continue;
      if (p.isCompleted) continue;
      
      // Apply search filter
      if (searchLower && !p.clientName?.toLowerCase().includes(searchLower)) continue;
      
      // Apply priority filter
      if (priorityFilter !== 'All Priorities' && p.priority !== priorityFilter) continue;
      
      // Apply client type filter
      if (clientTypeFilter !== 'All Client Types' && p.clientType !== clientTypeFilter) continue;
      
      // Apply activeFilter
      if (activeFilter === 'waiting') {
        if (!['Copy Revision', 'Design Revision'].includes(p.stage)) continue;
        if (p.lastEmailedAt) {
          const daysSinceEmail = Math.floor((now - new Date(p.lastEmailedAt).getTime()) / oneDay);
          if (daysSinceEmail <= 5) continue;
        } else {
          continue;
        }
      }
      
      // Calculate sort date once
      let sortDate = 0;
      if (p.createdAt) {
        sortDate = new Date(p.createdAt).getTime();
      } else if (p.updatedAt) {
        sortDate = new Date(p.updatedAt).getTime();
      } else if (p.targetCloseMonth) {
        sortDate = new Date(p.targetCloseMonth + '-01').getTime();
      }
      projectDates.set(p.id, sortDate);
      
      filtered.push(p);
    }
    
    // Sort by date (oldest first)
    filtered.sort((a, b) => {
      const aDate = projectDates.get(a.id) || 0;
      const bDate = projectDates.get(b.id) || 0;
      return aDate - bDate;
    });
    
    return filtered;
  }, [projects, searchTerm, activeFilter, priorityFilter, clientTypeFilter]);

  // Clear selections when filters change
  useEffect(() => {
    setSelectedProjects(new Set());
  }, [activeFilter, priorityFilter, clientTypeFilter, searchTerm]);

  // Memoize expensive calculations - optimized to use tasks array directly instead of iterating projects
  const activeTasksCount = useMemo(() => {
    if (!tasks || tasks.length === 0 || !projects || projects.length === 0) return 0;
    const activeProjectIds = new Set(
      projects
        .filter((p: any) => !p.isArchived)
        .map((p: any) => p.id)
    );
    let count = 0;
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (!activeProjectIds.has(task.projectId)) continue;
      if (!task.isCompleted && task.status !== 'Completed') {
        count++;
      }
    }
    return count;
  }, [tasks, projects]);

  const todayTasks = useMemo(() => {
    if (!tasks || tasks.length === 0) return 0;
    const today = new Date();
    const todayString = today.toDateString();
    let count = 0;
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (task.dueDate && !task.isCompleted && task.status !== 'Completed') {
        const dueDate = new Date(task.dueDate);
        if (dueDate.toDateString() === todayString) {
          count++;
        }
      }
    }
    return count;
  }, [tasks]);

  const waitingOnClient = useMemo(() => {
    if (!projects || projects.length === 0) return 0;
    let count = 0;
    const now = Date.now();
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      if (['Copy Revision', 'Design Revision'].includes(p.stage)) {
        if (p.lastEmailedAt) {
          const daysSinceEmail = Math.floor((now - new Date(p.lastEmailedAt).getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceEmail > 5) {
            count++;
          }
        }
      }
    }
    return count;
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
  }, [getFilteredProjects]);
  
  // Pre-compute stage projects mapping to avoid recalculating in render - MAJOR PERFORMANCE OPTIMIZATION
  const stageProjectsMap = useMemo(() => {
    if (!tasks || tasks.length === 0 || !filteredProjects || filteredProjects.length === 0) {
      const emptyMap = new Map<string, any[]>();
      ['Onboarding', 'Copy Writing', 'Design', 'Development', 'AI Team', 'Social Media Team', 'CRM', 'SEO/GEO Team', 'Ready to Close'].forEach(stage => {
        emptyMap.set(stage, []);
      });
      return emptyMap;
    }
    
    const map = new Map<string, any[]>();
    const stages = ['Onboarding', 'Copy Writing', 'Design', 'Development', 'AI Team', 'Social Media Team', 'CRM', 'SEO/GEO Team', 'Ready to Close'];
    
    // Pre-build task type to stage mapping
    const taskTypeToStage: Record<string, string[]> = {
      'Copy': ['Copy Writing'],
      'Design': ['Design'],
      'Dev': ['Development'],
      'AI': ['AI Team'],
      'Social Media': ['Social Media Team'],
      'CRM': ['CRM'],
      'SEO/GEO': ['SEO/GEO Team'],
      'Onboarding': ['Onboarding']
    };
    
    // Build project ID sets for each stage based on tasks - single pass
    const stageProjectIds = new Map<string, Set<string>>();
    stages.forEach(stage => stageProjectIds.set(stage, new Set()));
    
    // Single optimized pass through tasks
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (task.isCompleted || task.status === 'Completed') continue;
      
      const stagesForTask = taskTypeToStage[task.type] || [];
      for (let j = 0; j < stagesForTask.length; j++) {
        stageProjectIds.get(stagesForTask[j])?.add(task.projectId);
      }
    }
    
    // Build stage to internal stage mapping
    const stageToInternal: Record<string, string[]> = {
      'Copy Writing': ['Copy', 'Copy Revision'],
      'Design': ['Design', 'Design Revision'],
      'Development': ['Dev'],
      'AI Team': ['AI Team'],
      'Social Media Team': ['Social Media Team'],
      'CRM': ['CRM'],
      'SEO/GEO Team': ['SEO/GEO Team'],
      'Onboarding': ['Onboarding', 'Intake'],
      'Ready to Close': ['Ready to Close', 'Closed']
    };
    
    // Calculate projects for each stage - optimized with Set lookups
    for (let stageIdx = 0; stageIdx < stages.length; stageIdx++) {
      const displayStage = stages[stageIdx];
      const projectIds = stageProjectIds.get(displayStage) || new Set();
      const internalStages = stageToInternal[displayStage] || [];
      const stageProjectsList: any[] = [];
      const projectSet = new Set<string>();
      
      // Single pass through filtered projects
      for (let i = 0; i < filteredProjects.length; i++) {
        const p = filteredProjects[i];
        
        // Fast Set lookup
        if (projectIds.has(p.id)) {
          if (!projectSet.has(p.id)) {
            stageProjectsList.push(p);
            projectSet.add(p.id);
          }
          continue;
        }
        
        // Check internal stage match
        if (internalStages.includes(p.stage)) {
          if (!projectSet.has(p.id)) {
            stageProjectsList.push(p);
            projectSet.add(p.id);
          }
          continue;
        }
        
        // CRM special case
        if (displayStage === 'CRM') {
          const allClientTypes = [
            p.clientType,
            ...(p.secondaryClientTypes 
              ? (Array.isArray(p.secondaryClientTypes) 
                  ? p.secondaryClientTypes 
                  : p.secondaryClientTypes.split(',').map((t: string) => t.trim()).filter((t: string) => !!t))
              : [])
          ];
          if (allClientTypes.some((type: string) => 
            type === 'Katalyst' || type === 'KATALYST' || type?.toLowerCase() === 'katalyst'
          )) {
            if (!projectSet.has(p.id)) {
              stageProjectsList.push(p);
              projectSet.add(p.id);
            }
          }
        }
      }
      
      map.set(displayStage, stageProjectsList);
    }
    
    return map;
  }, [tasks, filteredProjects]);

  // Paginate filtered projects
  const paginatedProjects = useMemo(() => {
    if (showAll) {
      return filteredProjects;
    }
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredProjects.slice(startIndex, endIndex);
  }, [filteredProjects, currentPage, showAll]);

  // For Kanban view, use ALL filtered projects (not paginated) so all stages can show their projects
  // For List view, use paginated projects
  const projectsForView = useMemo(() => {
    if (viewMode === 'kanban') {
      return filteredProjects; // Kanban needs all projects to show across all stages
    }
    return paginatedProjects; // List view uses pagination
  }, [viewMode, filteredProjects, paginatedProjects]);

  // Filter tasks to match the projects being shown
  const tasksForView = useMemo(() => {
    if (viewMode === 'kanban') {
      // For Kanban, use all tasks since we're showing all projects
      return tasks;
    }
    // For List view, tasks aren't used for filtering, so return all
    return tasks;
  }, [tasks, viewMode]);

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.ceil(filteredProjects.length / ITEMS_PER_PAGE);
  }, [filteredProjects.length]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
    setShowAll(false);
  }, [searchTerm, activeFilter, priorityFilter, clientTypeFilter]);

  // Helper function to format time ago
  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };


  if (loading) {
    return (
      <div className="dashboard" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          textAlign: 'center',
          color: 'white'
        }}>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
            .dashboard-loader-spinner {
              width: 80px;
              height: 80px;
              margin: 0 auto 2rem;
              border: 4px solid rgba(255, 255, 255, 0.2);
              border-top: 4px solid white;
              border-radius: 50%;
              animation: spin 1s linear infinite;
            }
            .dashboard-loader-text {
              animation: pulse 2s ease-in-out infinite;
            }
          `}</style>
          <div className="dashboard-loader-spinner" />
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            marginBottom: '0.5rem'
          }} className="dashboard-loader-text">
            Loading Dashboard...
          </h2>
          <p style={{
            fontSize: '0.875rem',
            opacity: 0.9
          }} className="dashboard-loader-text">
            Fetching your projects and tasks
          </p>
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
              <button 
                className={viewMode === 'overview' ? 'active' : ''}
                onClick={() => {
                  setViewMode('overview');
                  loadNotifications(); // Refresh notifications when switching to overview
                }}
              >
                Overview
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
          {viewMode === 'overview' ? (
            <div className="overview-view" style={{ padding: '2rem' }}>
              {/* Key Metrics Section */}
              <div style={{ marginBottom: '3rem' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: '1.5rem'
                }}>
                  <h2 style={{ 
                    fontSize: '1.75rem', 
                    fontWeight: 700, 
                    color: '#1e293b',
                    margin: 0,
                    letterSpacing: '-0.02em'
                  }}>
                    Quick Overview
                  </h2>
                </div>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
                  gap: '1.25rem'
                }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    padding: '1.75rem',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px rgba(102, 126, 234, 0.2)',
                    border: 'none',
                    color: 'white',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '-20px',
                      right: '-20px',
                      width: '100px',
                      height: '100px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '50%'
                    }}></div>
                    <div style={{ 
                      fontSize: '0.875rem', 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      marginBottom: '0.75rem',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <FaFolder style={{ fontSize: '1rem' }} />
                      Total Projects
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'white', lineHeight: 1 }}>
                      {projects.filter((p: any) => !p.isArchived).length}
                    </div>
                  </div>
                  <div style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    padding: '1.75rem',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px rgba(16, 185, 129, 0.2)',
                    border: 'none',
                    color: 'white',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '-20px',
                      right: '-20px',
                      width: '100px',
                      height: '100px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '50%'
                    }}></div>
                    <div style={{ 
                      fontSize: '0.875rem', 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      marginBottom: '0.75rem',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <FaCheckCircle style={{ fontSize: '1rem' }} />
                      Active Tasks
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'white', lineHeight: 1 }}>{activeTasksCount}</div>
                  </div>
                  <div style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    padding: '1.75rem',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px rgba(245, 158, 11, 0.2)',
                    border: 'none',
                    color: 'white',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '-20px',
                      right: '-20px',
                      width: '100px',
                      height: '100px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '50%'
                    }}></div>
                    <div style={{ 
                      fontSize: '0.875rem', 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      marginBottom: '0.75rem',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <FaClock style={{ fontSize: '1rem' }} />
                      Tasks Due Today
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'white', lineHeight: 1 }}>{todayTasks}</div>
                  </div>
                  <div style={{
                    background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                    padding: '1.75rem',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px rgba(236, 72, 153, 0.2)',
                    border: 'none',
                    color: 'white',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '-20px',
                      right: '-20px',
                      width: '100px',
                      height: '100px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '50%'
                    }}></div>
                    <div style={{ 
                      fontSize: '0.875rem', 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      marginBottom: '0.75rem',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <FaEnvelope style={{ fontSize: '1rem' }} />
                      Waiting on Client
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'white', lineHeight: 1 }}>{waitingOnClient}</div>
                  </div>
                </div>
              </div>

              {/* Recent Activity Section */}
              <div style={{ marginBottom: '3rem' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: '1.5rem'
                }}>
                  <h2 style={{ 
                    fontSize: '1.75rem', 
                    fontWeight: 700, 
                    color: '#1e293b',
                    margin: 0,
                    letterSpacing: '-0.02em'
                  }}>
                    Recent Activity
                  </h2>
                </div>
                <div style={{
                  background: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0',
                  maxHeight: '600px',
                  overflowY: 'auto',
                  overflowX: 'hidden'
                }}>
                  {notifications.length === 0 ? (
                    <div style={{ 
                      padding: '4rem 2rem', 
                      textAlign: 'center', 
                      color: '#94a3b8',
                      fontSize: '0.9375rem'
                    }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📭</div>
                      <div style={{ fontWeight: 500 }}>No recent activity</div>
                      <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Activity will appear here as projects and tasks are updated</div>
                    </div>
                  ) : (
                    <div>
                      {notifications.map((notification: any) => {
                        const timeAgo = getTimeAgo(notification.createdAt);
                        const getNotificationIcon = () => {
                          switch (notification.type) {
                            case 'task_completed': return '✅';
                            case 'project_stage': return '🔄';
                            case 'project_created': return '➕';
                            case 'task': return '📋';
                            case 'email': return '📧';
                            case 'revision': return '✏️';
                            case 'alert': return '⚠️';
                            default: return '📌';
                          }
                        };
                        const getNotificationColor = () => {
                          switch (notification.type) {
                            case 'task_completed': return '#10b981';
                            case 'project_stage': return '#3b82f6';
                            case 'project_created': return '#8b5cf6';
                            case 'alert': return '#f59e0b';
                            default: return '#64748b';
                          }
                        };
                        return (
                          <div
                            key={notification.id}
                            onClick={() => {
                              if (notification.projectId) {
                                navigate(`/project/${notification.projectId}`);
                              }
                            }}
                            style={{
                              padding: '1.25rem 1.5rem',
                              borderBottom: '1px solid #f1f5f9',
                              cursor: notification.projectId ? 'pointer' : 'default',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '1.25rem',
                              transition: 'all 0.2s ease',
                              backgroundColor: notification.isRead ? 'white' : '#f8fafc',
                              position: 'relative'
                            }}
                            onMouseEnter={(e) => {
                              if (notification.projectId) {
                                e.currentTarget.style.backgroundColor = '#f1f5f9';
                                e.currentTarget.style.transform = 'translateX(4px)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = notification.isRead ? 'white' : '#f8fafc';
                              e.currentTarget.style.transform = 'translateX(0)';
                            }}
                          >
                            {!notification.isRead && (
                              <div style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: '4px',
                                background: getNotificationColor(),
                                borderRadius: '0 4px 4px 0'
                              }}></div>
                            )}
                            <div style={{ 
                              fontSize: '1.75rem',
                              flexShrink: 0,
                              width: '40px',
                              height: '40px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: `${getNotificationColor()}15`,
                              borderRadius: '10px'
                            }}>{getNotificationIcon()}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ 
                                fontWeight: notification.isRead ? 500 : 600, 
                                color: '#1e293b',
                                marginBottom: '0.375rem',
                                fontSize: '0.9375rem',
                                lineHeight: 1.4
                              }}>
                                {notification.title}
                              </div>
                              <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem', lineHeight: 1.5 }}>
                                {notification.message}
                              </div>
                              <div style={{ 
                                fontSize: '0.75rem', 
                                color: '#94a3b8',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}>
                                <span>{timeAgo}</span>
                                {!notification.isRead && (
                                  <span style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: getNotificationColor(),
                                    display: 'inline-block'
                                  }}></span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Projects by Stage Summary */}
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem', color: '#1e293b' }}>
                  Projects by Stage
                </h2>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem'
                }}>
                  {['Onboarding', 'Copy Writing', 'Design', 'Development', 'AI Team', 'Social Media Team', 'CRM', 'SEO/GEO Team', 'Ready to Close'].map((displayStage) => {
                    // Use pre-computed stage projects map for instant lookup
                    const stageProjects = stageProjectsMap.get(displayStage) || [];
                    // Get color for each stage
                    const getStageColor = (stage: string) => {
                      const colors: Record<string, string> = {
                        'Onboarding': '#667eea',
                        'Copy Writing': '#8b5cf6',
                        'Design': '#f59e0b',
                        'Development': '#10b981',
                        'AI Team': '#ec4899',
                        'Social Media Team': '#06b6d4',
                        'CRM': '#3b82f6',
                        'SEO/GEO Team': '#14b8a6',
                        'Ready to Close': '#64748b'
                      };
                      return colors[stage] || '#667eea';
                    };
                    
                    const stageColor = getStageColor(displayStage);
                    
                    return (
                      <div
                        key={displayStage}
                        onClick={() => {
                          navigate(`/department/${encodeURIComponent(displayStage)}`);
                        }}
                        style={{
                          background: 'white',
                          padding: '1.5rem',
                          borderRadius: '16px',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
                          border: `1px solid ${stageColor}20`,
                          cursor: 'pointer',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-4px)';
                          e.currentTarget.style.boxShadow = `0 12px 24px ${stageColor}25, 0 4px 8px rgba(0, 0, 0, 0.1)`;
                          e.currentTarget.style.borderColor = `${stageColor}40`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)';
                          e.currentTarget.style.borderColor = `${stageColor}20`;
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '4px',
                          background: `linear-gradient(90deg, ${stageColor} 0%, ${stageColor}dd 100%)`
                        }}></div>
                        <div style={{ 
                          fontSize: '0.875rem', 
                          color: '#64748b', 
                          marginBottom: '0.75rem',
                          fontWeight: 500,
                          letterSpacing: '0.01em'
                        }}>
                          {displayStage}
                        </div>
                        <div style={{ 
                          fontSize: '2.25rem', 
                          fontWeight: 700, 
                          color: '#1e293b',
                          lineHeight: 1,
                          marginBottom: '0.25rem'
                        }}>
                          {stageProjects.length}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#94a3b8',
                          fontWeight: 500
                        }}>
                          {stageProjects.length === 1 ? 'project' : 'projects'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : viewMode === 'kanban' ? (
            <>
              <KanbanBoard 
                projects={projectsForView} 
                tasks={tasksForView} 
                onUpdate={() => {
                  // Debounce onUpdate to prevent rapid-fire reloads
                  if (!loadingRef.current) {
                    loadData();
                  }
                }} 
              />
              
              {/* Note: Kanban view shows all filtered projects to populate all stage columns */}
              {/* Pagination removed - Kanban needs all projects to show across all stages */}
            </>
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
                  paginatedProjects.map((project: any) => {
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
              
              {/* Pagination Controls */}
              {filteredProjects.length > ITEMS_PER_PAGE && !showAll && (
                <div style={{
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #e2e8f0',
                  background: '#f8fafc'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      style={{
                        padding: '0.5rem 1rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.375rem',
                        background: currentPage === 1 ? '#f1f5f9' : 'white',
                        color: currentPage === 1 ? '#94a3b8' : '#475569',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (currentPage !== 1) {
                          e.currentTarget.style.background = '#f8fafc';
                          e.currentTarget.style.borderColor = '#cbd5e1';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentPage !== 1) {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.borderColor = '#e2e8f0';
                        }
                      }}
                    >
                      Previous
                    </button>
                    
                    <span style={{ 
                      color: '#64748b', 
                      fontSize: '0.875rem',
                      minWidth: '120px',
                      textAlign: 'center'
                    }}>
                      Page {currentPage} of {totalPages}
                    </span>
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      style={{
                        padding: '0.5rem 1rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.375rem',
                        background: currentPage === totalPages ? '#f1f5f9' : 'white',
                        color: currentPage === totalPages ? '#94a3b8' : '#475569',
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (currentPage !== totalPages) {
                          e.currentTarget.style.background = '#f8fafc';
                          e.currentTarget.style.borderColor = '#cbd5e1';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentPage !== totalPages) {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.borderColor = '#e2e8f0';
                        }
                      }}
                    >
                      Next
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                      Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredProjects.length)} of {filteredProjects.length} projects
                    </span>
                    <button
                      onClick={() => setShowAll(true)}
                      style={{
                        padding: '0.5rem 1rem',
                        border: '1px solid #667eea',
                        borderRadius: '0.375rem',
                        background: 'white',
                        color: '#667eea',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#667eea';
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'white';
                        e.currentTarget.style.color = '#667eea';
                      }}
                    >
                      See All
                    </button>
                  </div>
                </div>
              )}
              
              {/* Show All Active - Show "Show Less" button */}
              {showAll && filteredProjects.length > ITEMS_PER_PAGE && (
                <div style={{
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderTop: '1px solid #e2e8f0',
                  background: '#f8fafc'
                }}>
                  <span style={{ color: '#64748b', fontSize: '0.875rem', marginRight: '1rem' }}>
                    Showing all {filteredProjects.length} projects
                  </span>
                  <button
                    onClick={() => {
                      setShowAll(false);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '1px solid #667eea',
                      borderRadius: '0.375rem',
                      background: 'white',
                      color: '#667eea',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#667eea';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.color = '#667eea';
                    }}
                  >
                    Show Less
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          // Single-project create: close modal and refresh
          onSuccess={handleProjectCreated}
          // Bulk Excel create: just refresh data, keep modal open so user can see summary/errors
          onBulkSuccess={loadData}
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
