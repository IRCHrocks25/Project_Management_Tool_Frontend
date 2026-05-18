import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaFolder, FaFolderOpen, FaClock, FaEnvelope, FaChevronDown, FaUser, FaBell, FaCog, FaSignOutAlt, FaUsers, FaCheckCircle, FaSearch, FaTimes, FaStickyNote, FaLink, FaPaperPlane, FaHistory, FaComment, FaComments, FaTasks, FaTicketAlt } from 'react-icons/fa';
import { authService } from '../../services/auth.service';
import { projectService } from '../../services/project.service';
import { taskService } from '../../services/task.service';
import { notificationService } from '../../services/notification.service';
import { clientUpdatesService, ClientUpdateComment } from '../../services/client-updates.service';
import { MonthlyReminder, monthlyRemindersService } from '../../services/monthlyReminders.service';
import CreateProjectModal from '../CreateProjectModal';
import NotificationsModal from '../NotificationsModal';
import SubmitTicketModal from '../SubmitTicketModal';
import ConfirmModal from '../ConfirmModal';
import LiveChatPanel from '../LiveChatPanel';
import PMTasksTableView from './PMTasksTableView';
import PMListView from './PMListView';
import PMProjectsRegistryView from './PMProjectsRegistryView';
import PMKanbanView from './PMKanbanView';
import PMQuickOverview from './PMQuickOverview';
import PMAlertsPanel, { PMMonthlyReminderForm, PMTaskDueAlert } from './PMAlertsPanel';
import UserAvatar from '../UserAvatar';
import AppSidebar from '../AppSidebar';
import { useUnreadChatCount } from '../../hooks/useUnreadChatCount';
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
  const [showLiveChatPanel, setShowLiveChatPanel] = useState(false);
  const [unreadChatCount, refreshUnreadChat] = useUnreadChatCount();
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
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'overview' | 'tasks' | 'pm_list'>('overview');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>('All Priorities');
  const [clientTypeFilter, setClientTypeFilter] = useState<string>('All Client Types');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [lastEmailLogDateFilter, setLastEmailLogDateFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showAll, setShowAll] = useState<boolean>(false);
  /** For heads: when true, Kanban shows all departments; when false, only their department */
  const [headViewAllProjects, setHeadViewAllProjects] = useState<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- used in List view PM dropdown
  const [reassigningPMFor, setReassigningPMFor] = useState<string | null>(null);
  const [tasksTableSort, setTasksTableSort] = useState<{ column: string; dir: 'asc' | 'desc' }>({ column: 'updated', dir: 'desc' });
  const [showSubmitTicketModal, setShowSubmitTicketModal] = useState(false);
  const [tasksDepartmentFilter, setTasksDepartmentFilter] = useState<string>('All Departments');
  const [tasksPmFilter, setTasksPmFilter] = useState<string>('All');
  const [tasksAssigneeFilter, setTasksAssigneeFilter] = useState<string>('All');
  const [showAllTaskDueAlerts, setShowAllTaskDueAlerts] = useState(false);
  const [alertsTab, setAlertsTab] = useState<'due' | 'overdue' | 'monthly'>('due');
  const [monthlyReminders, setMonthlyReminders] = useState<MonthlyReminder[]>([]);
  const [loadingMonthlyReminders, setLoadingMonthlyReminders] = useState(false);
  const [savingMonthlyReminder, setSavingMonthlyReminder] = useState(false);
  const [editingMonthlyReminderId, setEditingMonthlyReminderId] = useState<string | null>(null);
  const [monthlyReminderForm, setMonthlyReminderForm] = useState<PMMonthlyReminderForm>({
    projectId: '',
    manualClientName: '',
    reminderDay: 24,
    note: '',
    reminderLink: '',
  });
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
      
      // Load projects, tasks, and users (users needed for PM dropdown in List view)
      const [projectsData, allTasksData, usersData] = await Promise.all([
        projectService.getAll(),
        // Load all tasks (no 200-task cap) so per-department project counts
        // and multi-department views include older tasks as well
        taskService.getAll(undefined, undefined, { all: true }),
        authService.getAllUsers(),
      ]);
      
      // Set projects, tasks, and users immediately for faster UI rendering
      setProjects(projectsData);
      setTasks(allTasksData);
      setUsers(usersData || []);
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

  const handleOpenTaskConversationFromNotification = (
    projectId: string,
    taskId: string,
    tab: 'details' | 'conversation' = 'details',
  ) => {
    navigate(`/project/${projectId}?task=${taskId}&tab=${tab}`);
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

  // Real-time notifications (like live chat): update count and list without refresh
  useEffect(() => {
    notificationService.connectSocket();
    const unsub = notificationService.onNewNotification(() => {
      loadUnreadCount();
      loadNotifications();
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once on mount
  }, []);

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
      // Email logs are stored but not currently used in this component
    } catch (error) {
      console.error('Failed to load email logs:', error);
    }
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

  const taskDueAlerts = useMemo<PMTaskDueAlert[]>(() => {
    if (!tasks.length) return [];

    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    const alerts: PMTaskDueAlert[] = [];
    const projectNameMap = new Map<string, string>();
    for (const p of projects) {
      projectNameMap.set(p.id, p.clientName || 'Unknown Project');
    }
    const getDepartmentLabel = (task: any): string => {
      const type = task?.type || 'General';
      const map: Record<string, string> = {
        Copy: 'Copy Writing',
        Design: 'Design',
        Dev: 'Development',
        AI: 'AI Development',
        'Social Media': 'Social Media',
        CRM: 'CRM',
        SEO: 'SEO/GEO',
        'SEO/GEO': 'SEO/GEO',
        Onboarding: 'Onboarding',
      };
      return map[type] || type;
    };
    const getCurrentColumn = (task: any): string => {
      if (task?.isCompleted || task?.status === 'Completed') return 'Approved/Completed';
      const desc = task?.description || '';
      if (desc.includes('--- Column: Revision ---')) return 'Revision';
      if (desc.includes('--- Column: QA Review ---')) return 'QA Before Sending to Client';
      if (desc.includes('--- Column: Client Validation ---') || desc.includes('--- Column: Client Review ---')) return 'Client Validation';
      if (desc.includes('--- Column: For Approval ---')) return 'For Approval';
      if (task?.status === 'In Review') return 'For Approval';
      if (task?.status === 'In Progress') return 'Owned/In Progress';
      return 'Not yet started';
    };

    for (const task of tasks) {
      if (task?.isCompleted || task?.status === 'Completed' || task?.isArchived || !task?.dueDate) continue;
      const dueDate = new Date(task.dueDate);
      if (Number.isNaN(dueDate.getTime())) continue;

      const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / msPerDay);
      if (daysLeft <= 5) {
        alerts.push({
          taskId: task.id,
          projectId: task.projectId,
          taskTitle: task.title || 'Untitled Task',
          projectName: projectNameMap.get(task.projectId) || 'Unknown Project',
          department: getDepartmentLabel(task),
          currentColumn: getCurrentColumn(task),
          daysLeft,
          dueDate,
        });
      }
    }

    return alerts.sort((a, b) => a.daysLeft - b.daysLeft || a.taskTitle.localeCompare(b.taskTitle));
  }, [tasks, projects]);

  const canManageMonthlyReminders = user?.role === 'Project Manager' || !!user?.isHeadPM;

  const projectOptionsForMonthlyReminders = useMemo(() => {
    return [...projects]
      .filter((p: any) => !p?.isArchived)
      .sort((a: any, b: any) => (a.clientName || '').localeCompare(b.clientName || ''));
  }, [projects]);

  const loadMonthlyReminders = useCallback(async () => {
    if (!canManageMonthlyReminders) return;
    try {
      setLoadingMonthlyReminders(true);
      const data = await monthlyRemindersService.getAll();
      setMonthlyReminders(data || []);
    } catch (error) {
      console.error('Failed to load monthly reminders:', error);
    } finally {
      setLoadingMonthlyReminders(false);
    }
  }, [canManageMonthlyReminders]);

  useEffect(() => {
    loadMonthlyReminders();
  }, [loadMonthlyReminders]);

  const resetMonthlyReminderForm = useCallback(() => {
    setEditingMonthlyReminderId(null);
    setMonthlyReminderForm({
      projectId: '',
      manualClientName: '',
      reminderDay: 24,
      note: '',
      reminderLink: '',
    });
  }, []);

  const handleSaveMonthlyReminder = useCallback(async () => {
    if (!canManageMonthlyReminders) return;
    const payload = {
      projectId: monthlyReminderForm.projectId || null,
      clientName: monthlyReminderForm.projectId ? undefined : monthlyReminderForm.manualClientName.trim(),
      reminderDay: Number(monthlyReminderForm.reminderDay),
      note: monthlyReminderForm.note.trim(),
      reminderLink: monthlyReminderForm.reminderLink.trim() || null,
    };

    if (!payload.note) {
      alert('Please add a reminder note.');
      return;
    }
    if (!payload.projectId && !payload.clientName) {
      alert('Please select a project or enter a client name manually.');
      return;
    }
    if (!Number.isFinite(payload.reminderDay) || payload.reminderDay < 1 || payload.reminderDay > 31) {
      alert('Reminder day must be between 1 and 31.');
      return;
    }

    try {
      setSavingMonthlyReminder(true);
      if (editingMonthlyReminderId) {
        await monthlyRemindersService.update(editingMonthlyReminderId, payload);
      } else {
        await monthlyRemindersService.create(payload);
      }
      await loadMonthlyReminders();
      resetMonthlyReminderForm();
    } catch (error: any) {
      console.error('Failed to save monthly reminder:', error);
      const serverMessage = error?.response?.data?.message;
      alert(typeof serverMessage === 'string' ? serverMessage : 'Failed to save monthly reminder. Please try again.');
    } finally {
      setSavingMonthlyReminder(false);
    }
  }, [canManageMonthlyReminders, monthlyReminderForm, editingMonthlyReminderId, loadMonthlyReminders, resetMonthlyReminderForm]);

  const handleEditMonthlyReminder = useCallback((item: MonthlyReminder) => {
    setEditingMonthlyReminderId(item.id);
    setAlertsTab('monthly');
    setMonthlyReminderForm({
      projectId: item.projectId || '',
      manualClientName: item.projectId ? '' : item.clientName,
      reminderDay: item.reminderDay,
      note: item.note,
      reminderLink: item.reminderLink || '',
    });
  }, []);

  const handleQuickUpdateMonthlyReminder = useCallback(
    async (id: string, payload: Partial<MonthlyReminder>) => {
      if (!canManageMonthlyReminders) return;
      await monthlyRemindersService.update(id, payload as any);
      await loadMonthlyReminders();
    },
    [canManageMonthlyReminders, loadMonthlyReminders],
  );

  const handleDeleteMonthlyReminder = useCallback(async (id: string) => {
    if (!canManageMonthlyReminders) return;
    if (!window.confirm('Delete this monthly reminder?')) return;
    try {
      await monthlyRemindersService.remove(id);
      await loadMonthlyReminders();
      if (editingMonthlyReminderId === id) resetMonthlyReminderForm();
    } catch (error) {
      console.error('Failed to delete monthly reminder:', error);
      alert('Failed to delete monthly reminder.');
    }
  }, [canManageMonthlyReminders, loadMonthlyReminders, editingMonthlyReminderId, resetMonthlyReminderForm]);

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

  const getProjectName = (projectId: string): string => {
    const p = projects.find((pr: any) => pr.id === projectId);
    return p?.clientName || 'Unknown Project';
  };

  const getProjectPmName = (projectId: string): string => {
    const p = projects.find((pr: any) => pr.id === projectId);
    const pmId = p?.pmId || (p?.pm as any)?.id;
    if (!pmId) return '';
    const u = users.find((us: any) => us.id === pmId);
    return u?.name || '';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <AppSidebar />
        <div className="dashboard" style={{
          flex: 1,
          minWidth: 0,
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
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AppSidebar />
      <div className="dashboard premium" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <nav className="dashboard-nav premium-nav">
        <div className="nav-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {user?.role !== 'Project Manager' && !!user?.isTeamLead && (
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: 'white',
                  color: '#64748b',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.color = '#667eea';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.color = '#64748b';
                }}
              >
                ← My Department
              </button>
            )}
            <h2 className="logo">Katalyst PM</h2>
          </div>
          <div className="nav-right">
            {user?.role === 'Project Manager' && (
              <button 
                onClick={() => setShowCreateModal(true)} 
                className="btn-primary btn-primary-premium"
                style={{ marginRight: '1rem' }}
              >
                <FaPlus className="btn-icon" />
                New Project
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('/tuesday')}
              style={{
                marginRight: '1rem',
                padding: '0.2rem 0.25rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Hierarchical view: Project → Deliverable → Task"
            >
              <img
                src="https://res.cloudinary.com/dcuswyfur/image/upload/v1777679193/Tuesday_iruicl.png"
                alt="Tuesday"
                style={{ height: '28px', width: 'auto', display: 'block' }}
              />
            </button>
            
            {/* Live Chat - Message Icon */}
            <button
              className="notification-button"
              onClick={() => setShowLiveChatPanel(true)}
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
                  {user?.role !== 'Project Manager' && !!user?.isTeamLead && (
                    <button 
                      onClick={() => {
                        setShowAvatarDropdown(false);
                        navigate('/dashboard');
                      }}
                      className="dropdown-item"
                    >
                      <FaFolderOpen className="dropdown-icon" />
                      My Department
                    </button>
                  )}
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
                      setShowSubmitTicketModal(true);
                    }}
                    className="dropdown-item"
                  >
                    <FaTicketAlt className="dropdown-icon" />
                    Submit Ticket
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
                      navigate('/pm-activity-log');
                    }}
                    className="dropdown-item"
                  >
                    <FaHistory className="dropdown-icon" />
                    PM Activity Log
                  </button>
                  <button 
                    onClick={() => {
                      setShowAvatarDropdown(false);
                      navigate('/department-activity-log');
                    }}
                    className="dropdown-item"
                  >
                    <FaUsers className="dropdown-icon" />
                    Department Activity Log
                  </button>
                  <button 
                    onClick={() => {
                      setShowAvatarDropdown(false);
                      navigate('/forum');
                    }}
                    className="dropdown-item"
                  >
                    <FaComment className="dropdown-icon" />
                    Forum
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
              {user?.role === 'Project Manager' && (
                <button 
                  className={viewMode === 'tasks' ? 'active' : ''}
                  onClick={() => setViewMode('tasks')}
                >
                  <FaTasks style={{ marginRight: '0.375rem', verticalAlign: 'middle' }} />
                  Tasks
                </button>
              )}
              {/* PM List temporarily hidden
              {user?.role === 'Project Manager' && (
                <button
                  className={viewMode === 'pm_list' ? 'active' : ''}
                  onClick={() => setViewMode('pm_list')}
                >
                  PM List
                </button>
              )}
              */}
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
                  placeholder={viewMode === 'tasks' ? 'Search tasks or projects...' : 'Search by project name...'}
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
                <option>Rapid Prospect</option>
              </select>
            </div>
          </div>
        </div>

        <PMAlertsPanel
          taskDueAlerts={taskDueAlerts}
          canManageMonthlyReminders={canManageMonthlyReminders}
          alertsTab={alertsTab}
          setAlertsTab={setAlertsTab}
          showAllTaskDueAlerts={showAllTaskDueAlerts}
          setShowAllTaskDueAlerts={setShowAllTaskDueAlerts}
          monthlyReminders={monthlyReminders}
          monthlyReminderForm={monthlyReminderForm}
          setMonthlyReminderForm={setMonthlyReminderForm}
          projectOptionsForMonthlyReminders={projectOptionsForMonthlyReminders}
          savingMonthlyReminder={savingMonthlyReminder}
          editingMonthlyReminderId={editingMonthlyReminderId}
          resetMonthlyReminderForm={resetMonthlyReminderForm}
          handleSaveMonthlyReminder={handleSaveMonthlyReminder}
          loadingMonthlyReminders={loadingMonthlyReminders}
          handleEditMonthlyReminder={handleEditMonthlyReminder}
          handleResolveMonthlyReminder={handleDeleteMonthlyReminder}
          handleDeleteMonthlyReminder={handleDeleteMonthlyReminder}
          handleQuickUpdateMonthlyReminder={handleQuickUpdateMonthlyReminder}
          openTask={(projectId, taskId) => navigate(`/project/${projectId}?task=${taskId}&tab=details`)}
          openProject={(projectId) => navigate(`/project/${projectId}`)}
          onCreateProjectClick={() => setShowCreateModal(true)}
        />

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
            onClick={() => navigate('/tasks-due-today')}
            style={{ cursor: 'pointer' }}
            title="View all tasks due today"
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
              <PMQuickOverview
                projects={projects}
                activeTasksCount={activeTasksCount}
                todayTasks={todayTasks}
                waitingOnClient={waitingOnClient}
                navigate={navigate}
              />

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
                                const isConversation = (notification.type === 'mention' || notification.type === 'task_update') && notification.taskId;
                                const url = isConversation
                                  ? `/project/${notification.projectId}?task=${notification.taskId}&tab=conversation`
                                  : `/project/${notification.projectId}`;
                                navigate(url);
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
            <PMKanbanView
              user={user}
              headViewAllProjects={headViewAllProjects}
              setHeadViewAllProjects={setHeadViewAllProjects}
              projectsForView={projectsForView}
              tasksForView={tasksForView}
              onKanbanUpdate={() => {
                if (!loadingRef.current) {
                  loadData();
                }
              }}
            />
          ) : viewMode === 'tasks' ? (
            <PMTasksTableView
              tasks={tasks}
              filteredProjects={filteredProjects}
              projects={projects}
              users={users}
              searchTerm={searchTerm}
              setProjects={setProjects}
              setTasks={setTasks}
              tasksRef={tasksRef}
              getProjectName={getProjectName}
              getProjectPmName={getProjectPmName}
              tasksTableSort={tasksTableSort}
              setTasksTableSort={setTasksTableSort}
              tasksDepartmentFilter={tasksDepartmentFilter}
              setTasksDepartmentFilter={setTasksDepartmentFilter}
              tasksPmFilter={tasksPmFilter}
              setTasksPmFilter={setTasksPmFilter}
              tasksAssigneeFilter={tasksAssigneeFilter}
              setTasksAssigneeFilter={setTasksAssigneeFilter}
            />
          ) : viewMode === 'pm_list' ? (
            <PMProjectsRegistryView
              projects={filteredProjects}
              users={users}
              setProjects={setProjects}
              globalSearchTerm={searchTerm}
            />
          ) : (
            <PMListView
              paginatedProjects={paginatedProjects}
              filteredProjects={filteredProjects}
              selectedProjects={selectedProjects}
              lastEmailLogDateFilter={lastEmailLogDateFilter}
              setLastEmailLogDateFilter={setLastEmailLogDateFilter}
              lastEmailLogs={lastEmailLogs}
              users={users}
              setProjects={setProjects}
              reassigningPMFor={reassigningPMFor}
              setReassigningPMFor={setReassigningPMFor}
              actionMenuOpen={actionMenuOpen}
              setActionMenuOpen={setActionMenuOpen}
              totalPages={totalPages}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              showAll={showAll}
              setShowAll={setShowAll}
              getEmailLogKeyword={getEmailLogKeyword}
              onSelectAll={handleSelectAll}
              onToggleSelect={handleToggleSelect}
              onBulkArchive={handleBulkArchiveClick}
              onLogEmail={handleLogEmailClick}
              onComplete={handleCompleteClick}
              onArchive={handleArchiveClick}
            />
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
      <LiveChatPanel
        isOpen={showLiveChatPanel}
        onClose={() => {
          setShowLiveChatPanel(false);
          refreshUnreadChat();
        }}
        accentColor="#667eea"
      />
      <SubmitTicketModal
        isOpen={showSubmitTicketModal}
        onClose={() => setShowSubmitTicketModal(false)}
        accentColor="#667eea"
      />
      <NotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
        onUpdate={loadUnreadCount}
        onOpenTaskConversation={handleOpenTaskConversationFromNotification}
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

      </div>
    </div>
  );
};

export default PMDashboard;
