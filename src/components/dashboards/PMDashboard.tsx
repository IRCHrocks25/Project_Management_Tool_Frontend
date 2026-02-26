import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaFolder, FaClock, FaEnvelope, FaChevronDown, FaUser, FaBell, FaCog, FaSignOutAlt, FaUsers, FaArchive, FaCheckCircle, FaSearch, FaTimes, FaStickyNote, FaLink, FaPaperPlane, FaEye, FaEllipsisV } from 'react-icons/fa';
import { authService } from '../../services/auth.service';
import { projectService } from '../../services/project.service';
import { taskService } from '../../services/task.service';
import { notificationService } from '../../services/notification.service';
import { clientUpdatesService, ClientUpdateComment } from '../../services/client-updates.service';
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
  const [showLogEmailModal, setShowLogEmailModal] = useState(false);
  const [projectForEmailLog, setProjectForEmailLog] = useState<any>(null);
  const [emailNotes, setEmailNotes] = useState('');
  const [emailLinks, setEmailLinks] = useState<string[]>(['']);
  const [loggingEmail, setLoggingEmail] = useState(false);
  const [emailLogsTab, setEmailLogsTab] = useState<'logs' | 'new'>('logs');
  const [clientUpdates, setClientUpdates] = useState<any[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [showMentionDropdown, setShowMentionDropdown] = useState<{ updateId: string; position: number } | null>(null);
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, ClientUpdateComment[]>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const [lastEmailLogs, setLastEmailLogs] = useState<Record<string, { date: string; pmName?: string; notes?: string; pmId?: string }>>({});
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'overview'>('overview');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>('All Priorities');
  const [clientTypeFilter, setClientTypeFilter] = useState<string>('All Client Types');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [lastEmailLogDateFilter, setLastEmailLogDateFilter] = useState<string>('');
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
      
      // Load last email logs in background (non-blocking)
      loadLastEmailLogs(projectsData);
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
      if (!target.closest('[data-action-menu]')) {
        setActionMenuOpen(null);
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

  const handleLogEmailClick = async (project: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectForEmailLog(project);
    setShowLogEmailModal(true);
    setEmailNotes('');
    setEmailLinks(['']);
    setEmailLogsTab('logs');
    // Load existing client updates
    const updates = await loadClientUpdates(project.id);
    // Load users for mentions
    await loadUsers();
    // Load comments for all updates (in parallel)
    if (updates && updates.length > 0) {
      await Promise.all(updates.map(update => loadComments(update.id)));
    }
  };

  const loadClientUpdates = async (projectId: string) => {
    try {
      setLoadingUpdates(true);
      const updates = await clientUpdatesService.getAllByProject(projectId);
      setClientUpdates(updates);
      return updates;
    } catch (error) {
      console.error('Failed to load client updates:', error);
      setClientUpdates([]);
      return [];
    } finally {
      setLoadingUpdates(false);
    }
  };

  const loadUsers = async () => {
    try {
      const usersData = await authService.getAllUsers();
      console.log('Loaded users:', usersData);
      setUsers(usersData || []);
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsers([]);
    }
  };

  const handleLogEmailSubmit = async () => {
    if (!projectForEmailLog) return;
    
    try {
      setLoggingEmail(true);
      const validLinks = emailLinks.filter(link => link.trim() !== '');
      await clientUpdatesService.create(
        projectForEmailLog.id,
        emailNotes || undefined,
        validLinks.length > 0 ? validLinks : undefined
      );
      // Reload updates
      await loadClientUpdates(projectForEmailLog.id);
      // Update last email log for this project
      const updates = await clientUpdatesService.getAllByProject(projectForEmailLog.id);
      if (updates && updates.length > 0) {
        const lastUpdate = updates[0];
        setLastEmailLogs(prev => ({
          ...prev,
          [projectForEmailLog.id]: {
            date: lastUpdate.emailSentAt,
            pmName: lastUpdate.pm?.name,
            pmId: lastUpdate.pmId || (lastUpdate.pm as any)?.id,
            notes: lastUpdate.notes,
          }
        }));
      }
      // Switch to logs tab and reset form
      setEmailLogsTab('logs');
      setEmailNotes('');
      setEmailLinks(['']);
      alert('Email logged successfully!');
    } catch (error: any) {
      console.error('Failed to log email:', error);
      alert('Failed to log email. Please try again.');
    } finally {
      setLoggingEmail(false);
    }
  };

  const handleAddComment = async (updateId: string) => {
    const comment = commentTexts[updateId]?.trim();
    if (!comment) return;

    try {
      setSubmittingComment({ ...submittingComment, [updateId]: true });
      // Extract mentioned user IDs from text (look for @username patterns)
      const mentionedUserIds = extractMentions(comment);
      
      // Call backend API
      await clientUpdatesService.createComment(updateId, comment, mentionedUserIds.length > 0 ? mentionedUserIds : undefined);
      
      // Reload comments
      await loadComments(updateId);
      
      // Clear comment text
      setCommentTexts({ ...commentTexts, [updateId]: '' });
    } catch (error: any) {
      console.error('Failed to add comment:', error);
      if (error?.response?.status === 404) {
        alert('Comment functionality is not yet available. Please run the migration script and implement the backend endpoints.');
      } else {
        alert(`Failed to add comment: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
      }
    } finally {
      setSubmittingComment({ ...submittingComment, [updateId]: false });
    }
  };

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const matches = text.match(mentionRegex);
    if (!matches) return [];
    
    // Convert usernames to user IDs
    const mentionedUserIds: string[] = [];
    matches.forEach(match => {
      const username = match.substring(1); // Remove @
      const user = users.find(u => u.name === username);
      if (user) {
        mentionedUserIds.push(user.id);
      }
    });
    return mentionedUserIds;
  };

  const loadComments = async (updateId: string) => {
    try {
      setLoadingComments({ ...loadingComments, [updateId]: true });
      const commentsData = await clientUpdatesService.getComments(updateId);
      setComments({ ...comments, [updateId]: commentsData });
    } catch (error) {
      console.error('Failed to load comments:', error);
      // Don't show error if endpoint doesn't exist yet
      if ((error as any)?.response?.status !== 404) {
        console.error('Error loading comments:', error);
      }
    } finally {
      setLoadingComments({ ...loadingComments, [updateId]: false });
    }
  };

  const loadLastEmailLogs = async (projects: any[]) => {
    try {
      const logsMap: Record<string, { date: string; pmName?: string; notes?: string; pmId?: string }> = {};
      
      // Load last email log for each project in parallel
      await Promise.all(
        projects.map(async (project) => {
          try {
            const updates = await clientUpdatesService.getAllByProject(project.id);
            if (updates && updates.length > 0) {
              // Get the most recent update (they're already sorted DESC by createdAt)
              const lastUpdate = updates[0];
              logsMap[project.id] = {
                date: lastUpdate.emailSentAt,
                pmName: lastUpdate.pm?.name,
                pmId: lastUpdate.pmId || (lastUpdate.pm as any)?.id,
                notes: lastUpdate.notes,
              };
            }
          } catch (error) {
            // Silently fail for individual projects
            console.error(`Failed to load email logs for project ${project.id}:`, error);
          }
        })
      );
      
      setLastEmailLogs(logsMap);
    } catch (error) {
      console.error('Failed to load email logs:', error);
    }
  };

  // Determine the last PM who interacted with a project
  // Priority: 1) Most recent client update PM, 2) Most recent task creator/updater (if PM), 3) Project's assigned PM
  const getLastActivePM = useMemo(() => {
    const pmMap = new Map<string, { name: string; id?: string; lastActivity?: Date }>();
    
    // Check client updates (most reliable source)
    for (const [projectId, log] of Object.entries(lastEmailLogs)) {
      if (log.pmName && log.date) {
        const activityDate = new Date(log.date);
        const existing = pmMap.get(projectId);
        if (!existing || activityDate > (existing.lastActivity || new Date(0))) {
          pmMap.set(projectId, {
            name: log.pmName,
            id: log.pmId,
            lastActivity: activityDate
          });
        }
      }
    }
    
    // Check tasks - find most recent task for each project
    // Note: Tasks might not have PM info directly, but we can check if assignedTo is a PM
    const projectTaskMap = new Map<string, { task: any; date: Date }>();
    for (const task of tasks) {
      if (!task.projectId) continue;
      const taskDate = new Date(task.updatedAt || task.createdAt || 0);
      const existing = projectTaskMap.get(task.projectId);
      if (!existing || taskDate > existing.date) {
        projectTaskMap.set(task.projectId, { task, date: taskDate });
      }
    }
    
    // For tasks, if the assigned user is a PM, use that
    // We'll need to check if the user is a PM by their role
    // Note: This would require loading all users to check roles, so we'll skip for now
    // Backend support would be needed to track task creator/updater as PM
    Array.from(projectTaskMap.entries()).forEach(([projectId, { task, date }]) => {
      if (task.assignedTo) {
        // Check if assigned user is a PM (we'd need users list, but for now we'll skip this)
        // This would require loading all users, which we might not have
      }
    });
    
    return pmMap;
  }, [lastEmailLogs, tasks]);

  // Get the PM name to display for a project
  const getProjectPMName = (project: any): string => {
    // First check if there's a recent client update PM
    const lastPM = getLastActivePM.get(project.id);
    if (lastPM && lastPM.name) {
      return lastPM.name;
    }
    
    // Fallback to project's assigned PM
    return project.pm?.name || 'Unassigned';
  };

  const handleCommentInput = (updateId: string, value: string, cursorPosition: number) => {
    setCommentTexts({ ...commentTexts, [updateId]: value });
    
    // Check if user typed @
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Show dropdown if @ is followed by no space (still typing username)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        console.log('Showing mention dropdown for update:', updateId, 'Users available:', users.length);
        setShowMentionDropdown({ updateId, position: lastAtIndex + 1 });
      } else {
        // Hide dropdown if there's a space or newline after @
        setShowMentionDropdown(null);
      }
    } else {
      // No @ found, hide dropdown
      setShowMentionDropdown(null);
    }
  };

  const addEmailLink = () => {
    setEmailLinks([...emailLinks, '']);
  };

  const removeEmailLink = (index: number) => {
    const newLinks = emailLinks.filter((_, i) => i !== index);
    if (newLinks.length === 0) {
      setEmailLinks(['']);
    } else {
      setEmailLinks(newLinks);
    }
  };

  const updateEmailLink = (index: number, value: string) => {
    const newLinks = [...emailLinks];
    newLinks[index] = value;
    setEmailLinks(newLinks);
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
      
      // Apply last email log date filter
      if (lastEmailLogDateFilter) {
        const lastLog = lastEmailLogs[p.id];
        if (!lastLog || !lastLog.date) continue; // Skip if no email log
        
        const logDate = new Date(lastLog.date);
        const filterDate = new Date(lastEmailLogDateFilter);
        
        // Compare dates (ignore time, only compare year/month/day)
        const logDateOnly = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
        const filterDateOnly = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate());
        
        if (logDateOnly.getTime() !== filterDateOnly.getTime()) continue;
      }
      
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
  }, [projects, searchTerm, activeFilter, priorityFilter, clientTypeFilter, lastEmailLogDateFilter, lastEmailLogs]);

  // Clear selections when filters change
  useEffect(() => {
    setSelectedProjects(new Set());
  }, [activeFilter, priorityFilter, clientTypeFilter, searchTerm, lastEmailLogDateFilter]);

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
          // Include projects with Katalyst (primary or secondary), Premium, or Powered-Up
          if (allClientTypes.some((type: string) => 
            type === 'Katalyst' || type === 'KATALYST' || type?.toLowerCase() === 'katalyst'
          ) || p.clientType === 'Premium' || p.clientType === 'Powered-Up') {
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
  }, [searchTerm, activeFilter, priorityFilter, clientTypeFilter, lastEmailLogDateFilter]);

  // Helper function to extract a keyword/snippet from email log notes
  const getEmailLogKeyword = (notes?: string): string => {
    if (!notes || notes.trim().length === 0) return '';
    
    // Remove common prefixes and clean up
    let text = notes.trim();
    
    // Remove common prefixes like "Task:", "Note:", etc.
    text = text.replace(/^(Task|Note|Email|Log):\s*/i, '');
    
    // Get first sentence or first 50 characters, whichever is shorter
    const firstSentence = text.split(/[.!?]\s+/)[0];
    const snippet = firstSentence.length <= 50 ? firstSentence : text.substring(0, 50);
    
    // Clean up and return
    return snippet.trim() + (snippet.length < text.length ? '...' : '');
  };

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
                <option>Premium</option>
                <option>Powered-Up</option>
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
                <div className="list-header-cell" style={{ flex: '2', minWidth: '200px' }}>Project Name</div>
                <div className="list-header-cell" style={{ width: '120px', flex: '0 0 120px' }}>Client Type</div>
                <div className="list-header-cell" style={{ width: '100px', flex: '0 0 100px' }}>Priority</div>
                <div className="list-header-cell" style={{ width: '120px', flex: '0 0 120px' }}>Stage</div>
                <div className="list-header-cell" style={{ width: '120px', flex: '0 0 120px' }}>Days in Stage</div>
                <div className="list-header-cell" style={{ width: '150px', flex: '0 0 150px' }}>Who</div>
                <div className="list-header-cell" style={{ width: '200px', flex: '0 0 200px', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <div>Last Email Log</div>
                  <input
                    type="date"
                    value={lastEmailLogDateFilter}
                    onChange={(e) => setLastEmailLogDateFilter(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Filter by date"
                    style={{
                      width: '100%',
                      padding: '0.375rem 0.5rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      background: 'white',
                      color: '#374151',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#667eea';
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  {lastEmailLogDateFilter && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLastEmailLogDateFilter('');
                      }}
                      style={{
                        padding: '0.25rem 0.5rem',
                        background: '#fee2e2',
                        border: '1px solid #fecaca',
                        borderRadius: '0.25rem',
                        color: '#dc2626',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fecaca';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#fee2e2';
                      }}
                    >
                      <FaTimes style={{ fontSize: '0.625rem' }} />
                      Clear
                    </button>
                  )}
                </div>
                <div className="list-header-cell" style={{ width: '120px', flex: '0 0 120px', textAlign: 'center' }}>Actions</div>
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
                        <div className="list-cell" style={{ flex: '2', minWidth: '200px', fontWeight: 600 }}>
                          {project.clientName}
                        </div>
                        <div className="list-cell" style={{ width: '120px', flex: '0 0 120px' }}>
                          <span className={`client-type-badge ${project.clientType?.toLowerCase()}`}>
                            {project.clientType}
                          </span>
                        </div>
                        <div className="list-cell" style={{ width: '100px', flex: '0 0 100px' }}>
                          <span className={`priority-badge priority-${project.priority?.toLowerCase()}`}>
                            {project.priority}
                          </span>
                        </div>
                        <div className="list-cell" style={{ width: '120px', flex: '0 0 120px' }}>
                          <span className="stage-badge">{project.stage}</span>
                        </div>
                        <div className="list-cell" style={{ width: '120px', flex: '0 0 120px' }}>
                          {daysInStage} {daysInStage === 1 ? 'day' : 'days'}
                        </div>
                        <div className="list-cell" style={{ width: '150px', flex: '0 0 150px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <FaUser style={{ fontSize: '0.875rem', color: '#64748b' }} />
                          <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                            {getProjectPMName(project)}
                          </span>
                        </div>
                        <div className="list-cell" style={{ width: '200px', flex: '0 0 200px' }}>
                          {lastEmailLogs[project.id] ? (() => {
                            const lastLog = lastEmailLogs[project.id];
                            const logDate = new Date(lastLog.date);
                            const daysSinceLog = Math.floor((Date.now() - logDate.getTime()) / (1000 * 60 * 60 * 24));
                            const isOverdue = daysSinceLog >= 7;
                            const keyword = getEmailLogKeyword(lastLog.notes);
                            
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <div style={{ 
                                  fontSize: '0.875rem', 
                                  color: isOverdue ? '#dc2626' : '#374151',
                                  fontWeight: isOverdue ? 600 : 400,
                                }}>
                                  {logDate.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </div>
                                <div style={{ 
                                  fontSize: '0.75rem', 
                                  color: isOverdue ? '#dc2626' : '#64748b',
                                }}>
                                  {logDate.toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                                {keyword && (
                                  <div style={{ 
                                    fontSize: '0.75rem', 
                                    color: '#667eea',
                                    fontWeight: 500,
                                    marginTop: '0.25rem',
                                    fontStyle: 'italic',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    maxWidth: '100%'
                                  }}>
                                    "{keyword}"
                                  </div>
                                )}
                                {isOverdue && (
                                  <div style={{ 
                                    fontSize: '0.75rem', 
                                    color: '#dc2626',
                                    fontWeight: 500,
                                    marginTop: '0.25rem',
                                  }}>
                                    {daysSinceLog} days ago
                                  </div>
                                )}
                              </div>
                            );
                          })() : (
                            <span style={{ fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>
                              No logs
                            </span>
                          )}
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
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActionMenuOpen(null);
                                    handleLogEmailClick(project, e);
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
                                  <FaEnvelope style={{ fontSize: '0.875rem', color: '#667eea' }} />
                                  Log Email
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActionMenuOpen(null);
                                    handleCompleteClick(project.id, e);
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
                                  <FaCheckCircle style={{ fontSize: '0.875rem', color: '#10b981' }} />
                                  Mark Complete
                                </button>
                                <div style={{ height: '1px', background: '#e2e8f0', margin: '0.25rem 0' }} />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActionMenuOpen(null);
                                    handleArchiveClick(project.id, e);
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
                                  <FaArchive style={{ fontSize: '0.875rem', color: '#64748b' }} />
                                  Archive
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

      {/* Log Email Side Modal */}
      {showLogEmailModal && projectForEmailLog && (
        <>
          <div 
            className="modal-overlay" 
            onClick={() => {
              setShowLogEmailModal(false);
              setProjectForEmailLog(null);
              setEmailNotes('');
              setEmailLinks(['']);
              setClientUpdates([]);
                  setEmailLogsTab('logs');
                  setCommentTexts({});
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
                  Email Logs
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                  {projectForEmailLog.clientName}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowLogEmailModal(false);
                  setProjectForEmailLog(null);
                  setEmailNotes('');
                  setEmailLinks(['']);
                  setClientUpdates([]);
                  setEmailLogsTab('logs');
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

            {/* Tabs */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid #e5e7eb',
              padding: '0 1.5rem',
            }}>
              <button
                onClick={() => setEmailLogsTab('logs')}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: emailLogsTab === 'logs' ? '2px solid #667eea' : '2px solid transparent',
                  color: emailLogsTab === 'logs' ? '#667eea' : '#64748b',
                  fontWeight: emailLogsTab === 'logs' ? 600 : 500,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Logs ({clientUpdates.length})
              </button>
              <button
                onClick={() => setEmailLogsTab('new')}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: emailLogsTab === 'new' ? '2px solid #667eea' : '2px solid transparent',
                  color: emailLogsTab === 'new' ? '#667eea' : '#64748b',
                  fontWeight: emailLogsTab === 'new' ? 600 : 500,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                New Log
              </button>
            </div>

            {/* Body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
            }}>
              {emailLogsTab === 'logs' ? (
                /* Existing Logs Tab */
                loadingUpdates ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    Loading logs...
                  </div>
                ) : clientUpdates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    <FaEnvelope style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }} />
                    <p>No email logs yet. Click "New Log" to create one.</p>
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
                        {/* Log Header */}
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
                                  {comment.mentionedUserIds && comment.mentionedUserIds.length > 0 && (
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#667eea' }}>
                                      Mentioned: {comment.mentionedUserIds.length} user(s)
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Comments Section with @ Mentions */}
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
                                users.map((user: any) => (
                                <div
                                  key={user.id}
                                  onClick={() => {
                                    const currentText = commentTexts[update.id] || '';
                                    const beforeCursor = currentText.substring(0, showMentionDropdown.position - 1);
                                    const afterCursor = currentText.substring(showMentionDropdown.position);
                                    const newText = `${beforeCursor}@${user.name} ${afterCursor}`;
                                    setCommentTexts({ ...commentTexts, [update.id]: newText });
                                    setShowMentionDropdown(null);
                                    // Focus back on textarea
                                    setTimeout(() => {
                                      const textarea = document.querySelector(`textarea[value*="${newText.substring(0, 20)}"]`) as HTMLTextAreaElement;
                                      if (textarea) {
                                        const newCursorPos = beforeCursor.length + `@${user.name} `.length;
                                        textarea.focus();
                                        textarea.setSelectionRange(newCursorPos, newCursorPos);
                                      }
                                    }, 0);
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
                                  {user.name} ({user.role || 'User'})
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
                            }}
                          >
                            {submittingComment[update.id] ? 'Posting...' : 'Post Comment'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* New Log Tab */
                <>
                  <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 500, 
                  color: '#1e293b',
                  fontSize: '0.875rem'
                }}>
                  <FaStickyNote style={{ marginRight: '0.5rem', color: '#f59e0b', display: 'inline' }} />
                  Notes (Optional)
                </label>
                <textarea
                  value={emailNotes}
                  onChange={(e) => setEmailNotes(e.target.value)}
                  placeholder="Add any notes about this email..."
                  style={{
                    width: '100%',
                    minHeight: '150px',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    lineHeight: '1.5',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <label style={{ 
                    fontWeight: 500, 
                    color: '#1e293b',
                    fontSize: '0.875rem',
                    margin: 0
                  }}>
                    <FaLink style={{ marginRight: '0.5rem', color: '#667eea', display: 'inline' }} />
                    Links (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={addEmailLink}
                    style={{
                      background: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      padding: '0.375rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      color: '#374151',
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#e5e7eb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f3f4f6';
                    }}
                  >
                    <FaPlus style={{ fontSize: '0.625rem' }} /> Add Link
                  </button>
                </div>
                {emailLinks.map((link, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    gap: '0.5rem', 
                    marginBottom: index < emailLinks.length - 1 ? '0.5rem' : '0',
                    alignItems: 'flex-start'
                  }}>
                    <input
                      type="url"
                      value={link}
                      onChange={(e) => updateEmailLink(index, e.target.value)}
                      placeholder="https://example.com"
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit',
                      }}
                    />
                    {emailLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEmailLink(index)}
                        style={{
                          background: '#fee2e2',
                          border: '1px solid #fecaca',
                          color: '#dc2626',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '40px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#fecaca';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#fee2e2';
                        }}
                      >
                        <FaTimes style={{ fontSize: '0.75rem' }} />
                      </button>
                    )}
                  </div>
                ))}
                <p style={{ 
                  fontSize: '0.75rem', 
                  color: '#64748b', 
                  marginTop: '0.5rem',
                  marginBottom: 0
                }}>
                  Attach links to relevant documents, files, or resources
                </p>
                  </div>
                </>
              )}
            </div>

            {/* Footer - Only show in New Log tab */}
            {emailLogsTab === 'new' && (
              <div style={{
                padding: '1.5rem',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'flex-end',
              }}>
                <button
                  onClick={() => {
                    setEmailLogsTab('logs');
                    setEmailNotes('');
                    setEmailLinks(['']);
                  }}
                  style={{
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    color: '#374151',
                    padding: '0.625rem 1.25rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e5e7eb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f3f4f6';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogEmailSubmit}
                  disabled={loggingEmail}
                  style={{
                    background: loggingEmail ? '#9ca3af' : '#667eea',
                    border: 'none',
                    color: 'white',
                    padding: '0.625rem 1.25rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: loggingEmail ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                  onMouseEnter={(e) => {
                    if (!loggingEmail) {
                      e.currentTarget.style.background = '#5568d3';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loggingEmail) {
                      e.currentTarget.style.background = '#667eea';
                    }
                  }}
                >
                  <FaPaperPlane />
                  {loggingEmail ? 'Logging...' : 'Log Email'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PMDashboard;
