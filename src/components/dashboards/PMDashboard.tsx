import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaFolder, FaClock, FaEnvelope, FaChevronDown, FaUser, FaBell, FaCog, FaSignOutAlt, FaUsers, FaArchive, FaCheckCircle, FaSearch, FaTimes, FaStickyNote, FaLink, FaPaperPlane, FaEye, FaEllipsisV, FaHistory } from 'react-icons/fa';
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
  const [allEmailLogs, setAllEmailLogs] = useState<Record<string, any[]>>({});
  const [projectActivities, setProjectActivities] = useState<Record<string, any[]>>({});
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
  const [showPMActivityModal, setShowPMActivityModal] = useState<boolean>(false);
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
      
      // Load last email logs and activity data in background (non-blocking)
      loadLastEmailLogs(projectsData);
      loadProjectActivities(projectsData);
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
      
      // Also load ALL email logs for complete history (not just the most recent)
      const allLogsMap: Record<string, any[]> = {};
      await Promise.all(
        projects.map(async (project) => {
          try {
            const updates = await clientUpdatesService.getAllByProject(project.id);
            if (updates && updates.length > 0) {
              allLogsMap[project.id] = updates;
            }
          } catch (error) {
            // Silently fail for individual projects
          }
        })
      );
      setAllEmailLogs(allLogsMap);
    } catch (error) {
      console.error('Failed to load email logs:', error);
    }
  };

  // Load project activity logs to track PM interactions comprehensively
  const loadProjectActivities = async (projects: any[]) => {
    try {
      const activitiesMap: Record<string, any[]> = {};
      
      // Load activity for each project in parallel (but limit concurrent requests)
      const batchSize = 10;
      for (let i = 0; i < projects.length; i += batchSize) {
        const batch = projects.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (project) => {
            try {
              const activities = await projectService.getActivity(project.id);
              if (activities && Array.isArray(activities)) {
                activitiesMap[project.id] = activities;
              }
            } catch (error) {
              // Silently fail for individual projects
              console.error(`Failed to load activity for project ${project.id}:`, error);
            }
          })
        );
      }
      
      setProjectActivities(activitiesMap);
    } catch (error) {
      console.error('Failed to load project activities:', error);
    }
  };

  // Determine the last PM who interacted with a project
  // Priority: Most recent activity between: 1) Activity log PM actions, 2) Email log update PM, 3) Task creator/updater (if PM)
  const getLastActivePM = useMemo(() => {
    const pmMap = new Map<string, { name: string; id?: string; lastActivity?: Date; activityType?: string }>();
    
    // Create a map of user IDs to user objects for quick lookup
    const userMap = new Map<string, any>();
    users.forEach((user: any) => {
      if (user.id) {
        userMap.set(user.id, user);
      }
    });
    
    // Priority 1: Check project activity logs (most comprehensive)
    // Activity logs should contain: task creation, task updates, email logs, etc.
    for (const [projectId, activities] of Object.entries(projectActivities)) {
      if (!activities || activities.length === 0) continue;
      
      // Find the most recent PM activity
      for (const activity of activities) {
        // Check if activity has a user/PM associated with it
        const activityUserId = activity.userId || activity.user?.id || activity.createdBy || activity.pmId;
        const activityUser = activityUserId ? userMap.get(activityUserId) : activity.user;
        
        // Check if this is a PM
        if (activityUser && activityUser.role === 'Project Manager') {
          const activityDate = new Date(activity.createdAt || activity.date || activity.timestamp || 0);
          const existing = pmMap.get(projectId);
          
          if (!existing || activityDate > (existing.lastActivity || new Date(0))) {
            pmMap.set(projectId, {
              name: activityUser.name || activity.user?.name,
              id: activityUser.id || activityUserId,
              lastActivity: activityDate,
              activityType: activity.type || activity.action || 'activity'
            });
          }
        }
      }
    }
    
    // Priority 2: Check client updates (email logs)
    for (const [projectId, log] of Object.entries(lastEmailLogs)) {
      if (log.pmName && log.date) {
        const activityDate = new Date(log.date);
        const existing = pmMap.get(projectId);
        if (!existing || activityDate > (existing.lastActivity || new Date(0))) {
          pmMap.set(projectId, {
            name: log.pmName,
            id: log.pmId,
            lastActivity: activityDate,
            activityType: 'email_log'
          });
        }
      }
    }
    
    // Check tasks - find most recent task for each project
    // Priority: 1) Task created by PM (createdById/createdBy), 2) Task assigned to PM
    // Note: If backend doesn't expose createdBy, we can only check assigned users
    const projectTaskMap = new Map<string, { task: any; date: Date; pmId?: string; pmName?: string }>();
    for (const task of tasks) {
      if (!task.projectId) continue;
      
      const taskDate = new Date(task.updatedAt || task.createdAt || 0);
      const existing = projectTaskMap.get(task.projectId);
      
      // Skip if we already have a more recent task for this project
      if (existing && taskDate <= existing.date) continue;
      
      let pmId: string | undefined;
      let pmName: string | undefined;
      
      // Priority 1: Check if task has a createdBy field (most accurate for determining creator)
      if ((task as any).createdById) {
        const creator = userMap.get((task as any).createdById);
        if (creator && creator.role === 'Project Manager') {
          pmId = creator.id;
          pmName = creator.name;
        }
      }
      
      // Priority 2: Check if task has a createdBy user object
      if (!pmId && (task as any).createdBy) {
        const creator = (task as any).createdBy;
        if (creator && (creator.role === 'Project Manager' || creator.id)) {
          // If it's already a user object with role, use it
          if (creator.role === 'Project Manager') {
            pmId = creator.id;
            pmName = creator.name;
          } else {
            // If it's just an ID, look it up
            const creatorUser = userMap.get(creator.id);
            if (creatorUser && creatorUser.role === 'Project Manager') {
              pmId = creatorUser.id;
              pmName = creatorUser.name;
            }
          }
        }
      }
      
      // Priority 3: Check if task is assigned to a PM (less accurate but better than nothing)
      if (!pmId) {
        const assignedUserId = task.assignedToId || task.assignedTo;
        if (assignedUserId) {
          const assignedUser = userMap.get(assignedUserId);
          if (assignedUser && assignedUser.role === 'Project Manager') {
            pmId = assignedUser.id;
            pmName = assignedUser.name;
          }
        }
      }
      
      // If we found a PM, store this task
      if (pmId && pmName) {
        projectTaskMap.set(task.projectId, {
          task,
          date: taskDate,
          pmId,
          pmName
        });
      }
    }
    
    // Merge task PMs into the map, comparing dates
    // Only use task PMs if we actually found a PM (not just stored the task date)
    Array.from(projectTaskMap.entries()).forEach(([projectId, { date, pmId, pmName }]) => {
      // Only process if we found a PM for this task
      if (!pmId || !pmName) return;
      
      const existing = pmMap.get(projectId);
      if (!existing || date > (existing.lastActivity || new Date(0))) {
        pmMap.set(projectId, {
          name: pmName,
          id: pmId,
          lastActivity: date
        });
      }
    });
    
    return pmMap;
  }, [lastEmailLogs, tasks, users, projectActivities]);

  // Get the PM name to display for a project
  const getProjectPMName = (project: any): string => {
    // First check if there's a recent client update PM or task PM
    const lastPM = getLastActivePM.get(project.id);
    if (lastPM && lastPM.name) {
      return lastPM.name;
    }
    
    // Only fallback to project's assigned PM if we have no activity data
    // This ensures we show the PM who actually worked on the project, not just the project creator
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
                      setShowPMActivityModal(true);
                    }}
                    className="dropdown-item"
                  >
                    <FaHistory className="dropdown-icon" />
                    PM Activity Log
                  </button>
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
    {/* Overlay */}
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
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 1000,
      }}
    />

    {/* Drawer */}
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', top: 0, right: 0,
        width: '500px', height: '100vh',
        background: '#ffffff',
        borderLeft: '1px solid #e2e8f0',
        boxShadow: '-12px 0 40px rgba(15, 23, 42, 0.12)',
        zIndex: 1001,
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        fontFamily: "'DM Sans', -apple-system, sans-serif",
      }}
    >

      {/* ── Header ── */}
      <div style={{
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: '#fafbff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#7c6af7', flexShrink: 0,
          }}>
            <FaEnvelope style={{ fontSize: '0.9rem' }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
              Email Logs
            </h2>
            <p style={{ margin: 0, fontSize: '0.775rem', color: '#94a3b8', fontWeight: 400 }}>
              {projectForEmailLog.clientName}
            </p>
          </div>
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
            background: 'transparent', border: '1px solid #e2e8f0',
            cursor: 'pointer', padding: '0.4rem',
            borderRadius: '8px', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#94a3b8', width: '32px', height: '32px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f1f5f9';
            e.currentTarget.style.color = '#475569';
            e.currentTarget.style.borderColor = '#cbd5e1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#94a3b8';
            e.currentTarget.style.borderColor = '#e2e8f0';
          }}
        >
          <FaTimes style={{ fontSize: '0.7rem' }} />
        </button>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex', gap: '0.25rem',
        padding: '0.75rem 1.5rem 0',
        borderBottom: '1px solid #f1f5f9',
        background: '#fafbff',
      }}>
        {(['logs', 'new'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setEmailLogsTab(tab)}
            style={{
              padding: '0.5rem 1rem',
              background: emailLogsTab === tab ? '#7c6af7' : 'transparent',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              color: emailLogsTab === tab ? '#fff' : '#94a3b8',
              fontWeight: emailLogsTab === tab ? 600 : 500,
              cursor: 'pointer',
              fontSize: '0.8rem',
              letterSpacing: '0.01em',
              transition: 'all 0.15s',
              marginBottom: '-1px',
              borderBottom: emailLogsTab === tab ? '2px solid #7c6af7' : '2px solid transparent',
            }}
          >
            {tab === 'logs' ? `Logs (${clientUpdates.length})` : '+ New Log'}
          </button>
        ))}
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', background: '#f8fafc' }}>
        {emailLogsTab === 'logs' ? (
          loadingUpdates ? (
            <div style={{ textAlign: 'center', padding: '3rem 2rem', color: '#94a3b8' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                border: '2px solid #e2e8f0', borderTopColor: '#7c6af7',
                animation: 'spin 0.7s linear infinite', margin: '0 auto 1rem',
              }} />
              <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading logs…</p>
            </div>
          ) : clientUpdates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem',
              }}>
                <FaEnvelope style={{ fontSize: '1.25rem', color: '#7c6af7' }} />
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8', lineHeight: 1.6 }}>
                No email logs yet.<br />Click <strong style={{ color: '#7c6af7' }}>+ New Log</strong> to create one.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {clientUpdates.map((update) => (
                <div
                  key={update.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    background: '#ffffff',
                    boxShadow: '0 1px 4px rgba(15,23,42,0.05)',
                  }}
                >
                  {/* Log Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div style={{
                        width: '30px', height: '30px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #ede9fe, #c4b5fd)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#7c6af7', flexShrink: 0,
                      }}>
                        <FaUser style={{ fontSize: '0.65rem' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.8rem' }}>
                          {update.pm?.name || 'PM'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '1px' }}>
                          {new Date(update.emailSentAt).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      padding: '0.2rem 0.65rem',
                      borderRadius: '20px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      letterSpacing: '0.02em',
                      ...(update.status === 'responded'
                        ? { background: '#dcfce7', color: '#15803d' }
                        : update.status === 'published'
                        ? { background: '#dbeafe', color: '#1d4ed8' }
                        : { background: '#f1f5f9', color: '#64748b' }),
                    }}>
                      {update.status.charAt(0).toUpperCase() + update.status.slice(1)}
                    </span>
                  </div>

                  {/* Notes */}
                  {update.notes && (
                    <div style={{
                      marginBottom: '0.875rem',
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      padding: '0.75rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <FaStickyNote style={{ color: '#f59e0b', fontSize: '0.75rem', marginTop: '2px', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#92400e', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Note
                          </div>
                          <div style={{ color: '#78350f', fontSize: '0.8rem', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                            {update.notes}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Links */}
                  {update.links && update.links.length > 0 && (
                    <div style={{ marginBottom: '0.875rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                        <FaLink style={{ color: '#7c6af7', fontSize: '0.7rem' }} />
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Links</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingLeft: '1rem' }}>
                        {update.links.map((link: string, linkIndex: number) => (
                          <a
                            key={linkIndex}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#7c6af7', fontSize: '0.8rem',
                              textDecoration: 'none', wordBreak: 'break-all',
                              display: 'flex', alignItems: 'center', gap: '0.25rem',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                          >
                            ↗ {link}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Existing Comments */}
                  {comments[update.id] && comments[update.id].length > 0 && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Comments ({comments[update.id].length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {comments[update.id].map((comment) => (
                          <div
                            key={comment.id}
                            style={{
                              background: '#f8fafc', borderRadius: '8px',
                              padding: '0.75rem', border: '1px solid #f1f5f9',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <div style={{
                                  width: '20px', height: '20px', borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #ede9fe, #c4b5fd)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}>
                                  <FaUser style={{ fontSize: '0.5rem', color: '#7c6af7' }} />
                                </div>
                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b' }}>
                                  {comment.user?.name || 'User'}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                                {new Date(comment.createdAt).toLocaleString('en-US', {
                                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                              {comment.text}
                            </div>
                            {comment.mentionedUserIds && comment.mentionedUserIds.length > 0 && (
                              <div style={{ marginTop: '0.35rem', fontSize: '0.7rem', color: '#7c6af7', fontWeight: 500 }}>
                                @ {comment.mentionedUserIds.length} mention{comment.mentionedUserIds.length > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add Comment */}
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', position: 'relative' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Add comment · use @ to mention
                    </div>
                    <textarea
                      value={commentTexts[update.id] || ''}
                      onChange={(e) => {
                        const cursorPos = e.target.selectionStart || 0;
                        handleCommentInput(update.id, e.target.value, cursorPos);
                      }}
                      placeholder="Write a comment…"
                      style={{
                        width: '100%', minHeight: '72px',
                        padding: '0.65rem 0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '0.82rem', fontFamily: 'inherit',
                        resize: 'vertical', marginBottom: '0.5rem',
                        color: '#1e293b', background: '#fff',
                        outline: 'none', lineHeight: 1.5,
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#7c6af7'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
                    />
                    {showMentionDropdown && showMentionDropdown.updateId === update.id && (
                      <div style={{
                        position: 'absolute',
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
                        maxHeight: '200px', overflowY: 'auto',
                        zIndex: 10000, top: '100%', left: 0, right: 0,
                        marginTop: '0.25rem',
                      }}>
                        {users.length === 0 ? (
                          <div style={{ padding: '0.75rem', fontSize: '0.82rem', color: '#94a3b8' }}>Loading users…</div>
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
                                setTimeout(() => {
                                  const textarea = document.querySelector(`textarea[value*="${newText.substring(0, 20)}"]`) as HTMLTextAreaElement;
                                  if (textarea) {
                                    const newCursorPos = beforeCursor.length + `@${user.name} `.length;
                                    textarea.focus();
                                    textarea.setSelectionRange(newCursorPos, newCursorPos);
                                  }
                                }, 0);
                              }}
                              style={{ padding: '0.6rem 0.75rem', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                            >
                              <div style={{
                                width: '22px', height: '22px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, #ede9fe, #c4b5fd)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              }}>
                                <FaUser style={{ fontSize: '0.5rem', color: '#7c6af7' }} />
                              </div>
                              <span style={{ fontWeight: 500, color: '#0f172a' }}>{user.name}</span>
                              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{user.role || 'User'}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => handleAddComment(update.id)}
                      disabled={!commentTexts[update.id]?.trim() || submittingComment[update.id]}
                      style={{
                        background: submittingComment[update.id] || !commentTexts[update.id]?.trim() ? '#e2e8f0' : '#7c6af7',
                        border: 'none', color: submittingComment[update.id] || !commentTexts[update.id]?.trim() ? '#94a3b8' : '#fff',
                        padding: '0.45rem 0.9rem',
                        borderRadius: '7px', fontSize: '0.78rem', fontWeight: 600,
                        cursor: submittingComment[update.id] || !commentTexts[update.id]?.trim() ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                        fontFamily: 'inherit',
                      }}
                    >
                      {submittingComment[update.id] ? 'Posting…' : 'Post Comment'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* ── New Log Tab ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Notes */}
            <div style={{
              background: '#fff', border: '1px solid #e2e8f0',
              borderRadius: '12px', padding: '1.25rem',
              boxShadow: '0 1px 4px rgba(15,23,42,0.05)',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem', fontWeight: 600, color: '#0f172a', fontSize: '0.82rem' }}>
                <FaStickyNote style={{ color: '#f59e0b', fontSize: '0.8rem' }} />
                Notes <span style={{ fontWeight: 400, color: '#94a3b8' }}>(Optional)</span>
              </label>
              <textarea
                value={emailNotes}
                onChange={(e) => setEmailNotes(e.target.value)}
                placeholder="Add any notes about this email…"
                style={{
                  width: '100%', minHeight: '140px',
                  padding: '0.75rem', border: '1px solid #e2e8f0',
                  borderRadius: '8px', fontSize: '0.82rem',
                  fontFamily: 'inherit', resize: 'vertical',
                  lineHeight: 1.6, color: '#1e293b', outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#7c6af7'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
              />
            </div>

            {/* Links */}
            <div style={{
              background: '#fff', border: '1px solid #e2e8f0',
              borderRadius: '12px', padding: '1.25rem',
              boxShadow: '0 1px 4px rgba(15,23,42,0.05)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#0f172a', fontSize: '0.82rem', margin: 0 }}>
                  <FaLink style={{ color: '#7c6af7', fontSize: '0.75rem' }} />
                  Links <span style={{ fontWeight: 400, color: '#94a3b8' }}>(Optional)</span>
                </label>
                <button
                  type="button"
                  onClick={addEmailLink}
                  style={{
                    background: '#f1f5f9', border: '1px solid #e2e8f0',
                    padding: '0.3rem 0.65rem', borderRadius: '6px',
                    fontSize: '0.72rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    color: '#475569', fontWeight: 600, fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                >
                  <FaPlus style={{ fontSize: '0.55rem' }} /> Add Link
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {emailLinks.map((link, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="url"
                      value={link}
                      onChange={(e) => updateEmailLink(index, e.target.value)}
                      placeholder="https://example.com"
                      style={{
                        flex: 1, padding: '0.65rem 0.75rem',
                        border: '1px solid #e2e8f0', borderRadius: '8px',
                        fontSize: '0.82rem', fontFamily: 'inherit',
                        color: '#1e293b', outline: 'none', transition: 'border-color 0.15s',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#7c6af7'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
                    />
                    {emailLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEmailLink(index)}
                        style={{
                          background: '#fff1f2', border: '1px solid #fecdd3',
                          color: '#e11d48', padding: '0.65rem 0.75rem',
                          borderRadius: '8px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#ffe4e6'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#fff1f2'; }}
                      >
                        <FaTimes style={{ fontSize: '0.65rem' }} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.6rem', marginBottom: 0 }}>
                Attach links to relevant documents, files, or resources
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer (New Log only) ── */}
      {emailLogsTab === 'new' && (
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #f1f5f9',
          display: 'flex', gap: '0.625rem', justifyContent: 'flex-end',
          background: '#fafbff',
        }}>
          <button
            onClick={() => {
              setEmailLogsTab('logs');
              setEmailNotes('');
              setEmailLinks(['']);
            }}
            style={{
              background: '#fff', border: '1px solid #e2e8f0',
              color: '#475569', padding: '0.55rem 1.1rem',
              borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
          >
            Cancel
          </button>
          <button
            onClick={handleLogEmailSubmit}
            disabled={loggingEmail}
            style={{
              background: loggingEmail ? '#c4b5fd' : '#7c6af7',
              border: 'none', color: '#fff',
              padding: '0.55rem 1.25rem',
              borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600,
              cursor: loggingEmail ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              fontFamily: 'inherit', transition: 'all 0.15s',
              boxShadow: loggingEmail ? 'none' : '0 2px 8px rgba(124,106,247,0.35)',
            }}
            onMouseEnter={(e) => { if (!loggingEmail) e.currentTarget.style.background = '#6a58e8'; }}
            onMouseLeave={(e) => { if (!loggingEmail) e.currentTarget.style.background = '#7c6af7'; }}
          >
            <FaPaperPlane style={{ fontSize: '0.75rem' }} />
            {loggingEmail ? 'Logging…' : 'Log Email'}
          </button>
        </div>
      )}
    </div>
  </>
)}

      {/* PM Activity Log Modal */}
      {showPMActivityModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '2rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '1200px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Header */}
            <div style={{
              padding: '2rem 2.5rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#111827',
                  margin: '0 0 0.5rem 0'
                }}>
                  <FaHistory style={{ marginRight: '0.75rem', color: '#7c6af7' }} />
                  PM Activity Log
                </h2>
                <p style={{
                  fontSize: '0.875rem',
                  color: '#64748b',
                  margin: 0
                }}>
                  Track all Project Manager activities across projects
                </p>
              </div>
              <button
                onClick={() => setShowPMActivityModal(false)}
                style={{
                  padding: '0.5rem',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  color: '#6b7280',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                  e.currentTarget.style.color = '#111827';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                <FaTimes style={{ fontSize: '1.25rem' }} />
              </button>
            </div>

            {/* Content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '2rem 2.5rem'
            }}>
              {(() => {
                // Collect all PM activities from all sources
                const allPMActivities: Array<{
                  projectId: string;
                  projectName: string;
                  pmName: string;
                  pmId?: string;
                  activityType: string;
                  date: Date;
                  description: string;
                }> = [];

                // Create user map - include ALL users, especially all PMs
                const userMap = new Map<string, any>();
                const allPMs = new Map<string, any>(); // Track all PMs separately
                users.forEach((user: any) => {
                  if (user.id) {
                    userMap.set(user.id, user);
                    // Track all PMs
                    if (user.role === 'Project Manager') {
                      allPMs.set(user.id, user);
                    }
                  }
                });

                // Process activity logs
                for (const [projectId, activities] of Object.entries(projectActivities)) {
                  const project = projects.find((p: any) => p.id === projectId);
                  const projectName = project?.clientName || 'Unknown Project';

                  for (const activity of activities || []) {
                    const activityUserId = activity.userId || activity.user?.id || activity.createdBy || activity.pmId;
                    const activityUser = activityUserId ? userMap.get(activityUserId) : activity.user;
                    
                    // Check if this is a PM activity - check user role or if activity indicates PM
                    const isPM = activityUser?.role === 'Project Manager' || 
                                 activity.user?.role === 'Project Manager' ||
                                 activity.pmId || 
                                 activity.pm?.role === 'Project Manager';
                    
                    if (isPM) {
                      const activityDate = new Date(activity.createdAt || activity.date || activity.timestamp || 0);
                      const activityType = activity.type || activity.action || 'activity';
                      
                      // Get PM name from various sources
                      const pmName = activityUser?.name || 
                                    activity.user?.name || 
                                    activity.pm?.name ||
                                    'Unknown PM';
                      const pmId = activityUser?.id || 
                                  activityUserId || 
                                  activity.pmId ||
                                  activity.pm?.id;
                      
                      allPMActivities.push({
                        projectId,
                        projectName,
                        pmName,
                        pmId,
                        activityType,
                        date: activityDate,
                        description: activity.description || activity.notes || `${activityType} on ${projectName}`
                      });
                    }
                  }
                }

                // Process email logs - load ALL email logs, not just the last one
                // This ensures we capture all PM activities, not just the most recent per project
                for (const [projectId, log] of Object.entries(lastEmailLogs)) {
                  if (log.pmName && log.date) {
                    const project = projects.find((p: any) => p.id === projectId);
                    const projectName = project?.clientName || 'Unknown Project';
                    
                    // Verify this is actually a PM by checking userMap
                    let pmId = log.pmId;
                    let pmName = log.pmName;
                    
                    // If we have pmId, verify it's a PM
                    if (pmId) {
                      const pmUser = userMap.get(pmId);
                      if (pmUser && pmUser.role === 'Project Manager') {
                        pmName = pmUser.name; // Use name from userMap for consistency
                      } else if (!pmUser) {
                        // PM not found in userMap, but we have pmName, so use it
                        // This handles cases where userMap might not be fully loaded
                      }
                    } else {
                      // No pmId, try to find PM by name
                      const pmByName = Array.from(userMap.values()).find(
                        (u: any) => u.name === pmName && u.role === 'Project Manager'
                      );
                      if (pmByName) {
                        pmId = pmByName.id;
                        pmName = pmByName.name;
                      }
                    }
                    
                    // Only add if we have valid PM info
                    if (pmName && (pmId || pmName !== 'Unknown PM')) {
                      allPMActivities.push({
                        projectId,
                        projectName,
                        pmName,
                        pmId,
                        activityType: 'email_log',
                        date: new Date(log.date),
                        description: log.notes ? `Email log: ${log.notes.substring(0, 100)}` : `Email log update for ${projectName}`
                      });
                    }
                  }
                }
                
                // Process ALL email logs (not just the last one per project)
                // This ensures we capture all PM activities from email logs
                for (const [projectId, updates] of Object.entries(allEmailLogs)) {
                  const project = projects.find((p: any) => p.id === projectId);
                  const projectName = project?.clientName || 'Unknown Project';
                  
                  for (const update of updates || []) {
                    if (update.pm?.name || update.pmId) {
                      const pmId = update.pmId || (update.pm as any)?.id;
                      const pmName = update.pm?.name;
                      
                      // Verify it's a PM
                      let verifiedPM = pmId ? userMap.get(pmId) : null;
                      if (!verifiedPM && pmName) {
                        verifiedPM = Array.from(userMap.values()).find(
                          (u: any) => u.name === pmName && u.role === 'Project Manager'
                        );
                      }
                      
                      if (verifiedPM || (pmName && update.emailSentAt)) {
                        allPMActivities.push({
                          projectId,
                          projectName,
                          pmName: verifiedPM?.name || pmName,
                          pmId: verifiedPM?.id || pmId,
                          activityType: 'email_log',
                          date: new Date(update.emailSentAt),
                          description: update.notes ? `Email log: ${update.notes.substring(0, 100)}` : `Email log update for ${projectName}`
                        });
                      }
                    }
                  }
                }

                // Process task activities - check ALL tasks, not filtered by current user
                for (const task of tasks) {
                  if (!task.projectId) continue;
                  
                  const project = projects.find((p: any) => p.id === task.projectId);
                  const projectName = project?.clientName || 'Unknown Project';
                  
                  // Check task creator
                  const createdById = (task as any).createdById || (task as any).createdBy?.id;
                  if (createdById) {
                    const creator = userMap.get(createdById);
                    // Also check if createdBy object indicates PM
                    const createdByObj = (task as any).createdBy;
                    const isCreatorPM = creator?.role === 'Project Manager' || 
                                       createdByObj?.role === 'Project Manager';
                    
                    if (isCreatorPM) {
                      allPMActivities.push({
                        projectId: task.projectId,
                        projectName,
                        pmName: creator?.name || createdByObj?.name || 'Unknown PM',
                        pmId: creator?.id || createdById,
                        activityType: 'task_created',
                        date: new Date(task.createdAt || 0),
                        description: `Created task: ${task.title}`
                      });
                    }
                  }
                  
                  // Check task assignee (if PM) - check ALL assignees, not just current user
                  const assignedUserId = task.assignedToId || task.assignedTo;
                  if (assignedUserId) {
                    const assignee = userMap.get(assignedUserId);
                    // Also check if assignedTo object indicates PM
                    const assignedToObj = task.assignedTo;
                    const isAssigneePM = assignee?.role === 'Project Manager' ||
                                        assignedToObj?.role === 'Project Manager';
                    
                    if (isAssigneePM) {
                      const taskDate = new Date(task.updatedAt || task.createdAt || 0);
                      allPMActivities.push({
                        projectId: task.projectId,
                        projectName,
                        pmName: assignee?.name || assignedToObj?.name || 'Unknown PM',
                        pmId: assignee?.id || assignedUserId,
                        activityType: 'task_assigned',
                        date: taskDate,
                        description: `Assigned/updated task: ${task.title}`
                      });
                    }
                  }
                }

                // Sort by date (most recent first)
                allPMActivities.sort((a, b) => b.date.getTime() - a.date.getTime());

                // Group by PM - use pmId as primary key for proper grouping
                const activitiesByPM = new Map<string, typeof allPMActivities>();
                
                // First, add all PMs from the users list (even if no activities)
                allPMs.forEach((pm) => {
                  activitiesByPM.set(pm.id, []);
                });
                
                // Then, add activities to their respective PMs
                // Use pmId as the key for proper grouping, fallback to pmName only if pmId is missing
                for (const activity of allPMActivities) {
                  // Prefer pmId for grouping, as it's unique
                  let pmKey = activity.pmId;
                  
                  // If no pmId, try to find PM by name
                  if (!pmKey && activity.pmName) {
                    const pmByName = Array.from(allPMs.values()).find(
                      (pm: any) => pm.name === activity.pmName
                    );
                    if (pmByName) {
                      pmKey = pmByName.id;
                    } else {
                      // If we can't find PM by name, use name as fallback (but this might cause grouping issues)
                      pmKey = activity.pmName;
                    }
                  }
                  
                  if (pmKey) {
                    if (!activitiesByPM.has(pmKey)) {
                      activitiesByPM.set(pmKey, []);
                    }
                    activitiesByPM.get(pmKey)!.push(activity);
                  }
                }

                if (allPMActivities.length === 0 && allPMs.size === 0) {
                  return (
                    <div style={{
                      textAlign: 'center',
                      padding: '4rem 2rem',
                      color: '#9ca3af'
                    }}>
                      <FaHistory style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }} />
                      <p style={{ fontSize: '1rem', margin: 0 }}>
                        No PM activity found yet. Activity will appear here as PMs interact with projects.
                      </p>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Summary */}
                    <div style={{
                      padding: '1rem 1.5rem',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                            Total Project Managers
                          </div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
                            {allPMs.size} PM{allPMs.size !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                            PMs with Activity
                          </div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#7c6af7' }}>
                            {Array.from(activitiesByPM.values()).filter(acts => acts.length > 0).length}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                            Total Activities
                          </div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>
                            {allPMActivities.length}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* PM Activities */}
                    {Array.from(activitiesByPM.entries())
                      .sort(([keyA, actsA], [keyB, actsB]) => {
                        // Sort: PMs with activities first, then by name
                        if (actsA.length > 0 && actsB.length === 0) return -1;
                        if (actsA.length === 0 && actsB.length > 0) return 1;
                        const pmA = allPMs.get(keyA);
                        const pmB = allPMs.get(keyB);
                        const nameA = pmA?.name || actsA[0]?.pmName || '';
                        const nameB = pmB?.name || actsB[0]?.pmName || '';
                        return nameA.localeCompare(nameB);
                      })
                      .map(([pmKey, pmActivities]) => {
                      // Get PM info - try to find from allPMs first, then from activities
                      let pmInfo = allPMs.get(pmKey);
                      if (!pmInfo && pmActivities.length > 0) {
                        // Try to get from first activity
                        const firstActivity = pmActivities[0];
                        pmInfo = {
                          id: firstActivity.pmId || pmKey,
                          name: firstActivity.pmName,
                          role: 'Project Manager'
                        };
                      } else if (!pmInfo) {
                        // Skip if we can't identify the PM
                        return null;
                      }
                      
                      const pmName = pmInfo.name || 'Unknown PM';
                      
                      return (
                        <div key={pmKey} style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            padding: '1rem 1.5rem',
                            background: '#f8fafc',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #7c6af7 0%, #6a58e8 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 600,
                                fontSize: '1rem'
                              }}>
                                {pmName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: '#111827', fontSize: '1rem' }}>
                                  {pmName}
                                </div>
                                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                                  {pmActivities.length} {pmActivities.length === 1 ? 'activity' : 'activities'}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div style={{ padding: '1rem' }}>
                            {pmActivities.length === 0 ? (
                              <div style={{
                                padding: '2rem',
                                textAlign: 'center',
                                color: '#94a3b8',
                                fontSize: '0.875rem',
                                fontStyle: 'italic'
                              }}>
                                No activities recorded yet
                              </div>
                            ) : (
                              pmActivities.slice(0, 10).map((activity, idx) => (
                              <div
                                key={idx}
                                style={{
                                  padding: '1rem',
                                  marginBottom: idx < pmActivities.length - 1 ? '0.75rem' : 0,
                                  background: '#fff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '8px',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '1rem'
                                }}
                              >
                                <div style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: '#7c6af7',
                                  marginTop: '0.5rem',
                                  flexShrink: 0
                                }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    marginBottom: '0.5rem'
                                  }}>
                                    <span style={{
                                      fontSize: '0.875rem',
                                      fontWeight: 600,
                                      color: '#111827'
                                    }}>
                                      {activity.projectName}
                                    </span>
                                    <span style={{
                                      fontSize: '0.75rem',
                                      color: '#64748b',
                                      padding: '0.25rem 0.5rem',
                                      background: '#f1f5f9',
                                      borderRadius: '4px'
                                    }}>
                                      {activity.activityType.replace('_', ' ')}
                                    </span>
                                  </div>
                                  <p style={{
                                    fontSize: '0.875rem',
                                    color: '#475569',
                                    margin: '0 0 0.5rem 0'
                                  }}>
                                    {activity.description}
                                  </p>
                                  <div style={{
                                    fontSize: '0.75rem',
                                    color: '#94a3b8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                  }}>
                                    <FaClock style={{ fontSize: '0.625rem' }} />
                                    {activity.date.toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                </div>
                              </div>
                              ))
                            )}
                            {pmActivities.length > 10 && (
                              <div style={{
                                padding: '0.75rem',
                                textAlign: 'center',
                                color: '#64748b',
                                fontSize: '0.875rem'
                              }}>
                                + {pmActivities.length - 10} more activities
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PMDashboard;
