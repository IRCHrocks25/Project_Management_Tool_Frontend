import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaArrowRight,
  FaBell,
  FaBolt,
  FaCalendarAlt,
  FaChartLine,
  FaCheckCircle,
  FaChevronRight,
  FaClock,
  FaCog,
  FaColumns,
  FaComments,
  FaEdit,
  FaFolderPlus,
  FaInbox,
  FaLink,
  FaPlus,
  FaSave,
  FaSearch,
  FaSignOutAlt,
  FaSpinner,
  FaSyncAlt,
  FaThLarge,
  FaTicketAlt,
  FaTimes,
  FaUser,
  FaUsers,
  FaCopy,
  FaPalette,
  FaCode,
  FaRobot,
  FaShareAlt,
  FaDatabase,
} from 'react-icons/fa';
import { authService } from '../../services/auth.service';
import { projectService } from '../../services/project.service';
import { taskService } from '../../services/task.service';
import { useFocusRefetch } from '../../hooks/useFocusRefetch';
import { notificationService } from '../../services/notification.service';
import { deliverableService } from '../../services/deliverable.service';
import CreateProjectModal from '../CreateProjectModal';
import NotificationsModal from '../NotificationsModal';
import SubmitTicketModal from '../SubmitTicketModal';
import TicketsModal from '../TicketsModal';
import SendForReviewModal from '../SendForReviewModal';
import LiveChatPanel from '../LiveChatPanel';
import StatusChangeNotesModal from '../shared/StatusChangeNotesModal';
import UserAvatar from '../UserAvatar';
import AppSidebar from '../AppSidebar';
import TodaysPrioritiesCard from './TodaysPrioritiesCard';
import TaskDetailSideModal from '../TaskDetailSideModal';
import { useUnreadChatCount } from '../../hooks/useUnreadChatCount';
import DepartmentPriorityProjects from '../DepartmentPriorityProjects';
import '../Dashboard.css';
import './RoleDashboard.css';

// Role configuration mapping
const ROLE_CONFIG: Record<string, {
  taskType: string;
  stages: string[];
  departmentName: string;
  icon: React.ComponentType<any>;
  color: string;
}> = {
  'Copy Writing': {
    taskType: 'Copy',
    stages: ['Copy', 'Copy Revision'],
    departmentName: 'Copy Writing Team',
    icon: FaCopy,
    color: '#667eea',
  },
  'Designer': {
    taskType: 'Design',
    stages: ['Design'],
    departmentName: 'Design Team',
    icon: FaPalette,
    color: '#ec4899',
  },
  'Developer': {
    taskType: 'Dev',
    stages: ['Development'],
    departmentName: 'Development Team',
    icon: FaCode,
    color: '#10b981',
  },
  'AI Developer': {
    taskType: 'AI',
    stages: ['AI Development', 'Development'],
    departmentName: 'AI Development Team',
    icon: FaRobot,
    color: '#8b5cf6',
  },
  'Social Media': {
    taskType: 'Social Media',
    stages: [],
    departmentName: 'Social Media Team',
    icon: FaShareAlt,
    color: '#f59e0b',
  },
  'CRM': {
    taskType: 'CRM',
    stages: [],
    departmentName: 'CRM Team',
    icon: FaDatabase,
    color: '#3b82f6',
  },
  'SEO/GEO': {
    taskType: 'SEO/GEO',
    stages: [],
    departmentName: 'SEO/GEO Team',
    icon: FaSearch,
    color: '#06b6d4',
  },
};

type ColumnId =
  | 'not_started'
  | 'owned_in_progress'
  | 'for_approval'
  | 'revision'
  | 'elliot_review'
  | 'qa_before_client'
  | 'client_validation'
  | 'approved_completed';
type Section = 'overview' | 'my' | 'board' | 'approvals' | 'team';
type TaskAction = { key: string; label: string; run: () => void };

const COLUMN_LABEL: Record<ColumnId, string> = {
  not_started: 'Not started',
  owned_in_progress: 'In progress',
  for_approval: 'Awaiting approval',
  revision: 'Changes requested',
  elliot_review: 'Elliot review',
  qa_before_client: 'QA review',
  client_validation: 'Client validation',
  approved_completed: 'Completed',
};
const BOARD_COLUMNS: ColumnId[] = ['not_started', 'owned_in_progress', 'for_approval', 'revision', 'qa_before_client', 'client_validation', 'approved_completed'];
const CHIP_COLUMNS: ColumnId[] = ['for_approval', 'revision', 'owned_in_progress', 'not_started', 'qa_before_client', 'client_validation', 'approved_completed'];
const HEALTH_COLUMNS: ColumnId[] = ['not_started', 'owned_in_progress', 'for_approval', 'revision', 'qa_before_client', 'client_validation'];
const NEXT_STEP: Record<ColumnId, string> = {
  not_started: 'Claim this task or assign an owner, then start work.',
  owned_in_progress: 'Finish the work, then send it for review.',
  for_approval: 'A reviewer completes it or requests specific changes.',
  revision: 'Apply the requested changes, then send it back for review.',
  elliot_review: 'Waiting on Elliot. Move it forward once it is reviewed.',
  qa_before_client: 'QA checks the work before it goes to the client.',
  client_validation: 'Waiting on client feedback. Complete it once the client approves.',
  approved_completed: 'This task is complete. No further action is needed.',
};
const PROJECT_DOT_COLORS = ['#8c80ed', '#58b7c5', '#efad72', '#85c5a5', '#e58fa8', '#7ba4ed'];
const QUEUE_PAGE_SIZE = 30;
const VIEW_STORAGE_KEY = 'roleDashboard.viewMode';

const getAssigneeIds = (task: any): string[] => {
  const assignees = task?.assignees || [];
  if (assignees.length > 0) return assignees.map((a: any) => a.userId || a.user?.id);
  return task?.assignedToId ? [task.assignedToId] : [];
};

/** Which workflow stage a task is in, including the In Review sub-states kept as description markers. */
const getTaskColumn = (task: any): ColumnId => {
  if (task.status === 'Completed' || task.isCompleted) return 'approved_completed';

  const desc: string = task.description || '';
  if (desc.includes('--- Column: Revision ---')) return 'revision';
  if (desc.includes('--- Column: Elliot Review ---')) return 'elliot_review';
  if (desc.includes('--- Column: QA Review ---')) return 'qa_before_client';
  if (desc.includes('--- Column: Client Validation ---')) return 'client_validation';
  if (desc.includes('--- Column: Client Review ---')) return 'client_validation';
  if (desc.includes('--- Column: For Approval ---')) return 'for_approval';

  if (task.assignedToId) {
    if (task.status === 'In Progress') return 'owned_in_progress';
    if (task.status === 'In Review') return 'for_approval';
    if (task.status === 'Revision' || task.status === 'Needs Revision') return 'revision';
    if (task.status === 'Elliot Review') return 'elliot_review';
    if (task.status === 'QA Review' || task.status === 'QA') return 'qa_before_client';
    if (task.status === 'Client Review' || task.status === 'Client Validation') return 'client_validation';
    return 'owned_in_progress';
  }
  return 'not_started';
};

const getDueInfo = (task: any): { text: string; className: string } => {
  if (!task?.dueDate) return { text: 'No date', className: 'rd-unassigned' };
  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) return { text: 'No date', className: 'rd-unassigned' };
  const text = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (getTaskColumn(task) === 'approved_completed') return { text, className: '' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(due);
  day.setHours(0, 0, 0, 0);
  const days = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { text, className: 'rd-overdue' };
  if (days === 0) return { text: 'Today', className: 'rd-duesoon' };
  if (days <= 2) return { text, className: 'rd-duesoon' };
  return { text, className: '' };
};

type KanbanColumnSortOrder = 'newest' | 'oldest';

function sortKanbanTasksByCreatedAt(tasks: any[], order: KanbanColumnSortOrder): any[] {
  const getTime = (t: any) => {
    const raw = t.createdAt || t.updatedAt;
    return raw ? new Date(raw).getTime() : 0;
  };
  return [...tasks].sort((a, b) => {
    const ta = getTime(a);
    const tb = getTime(b);
    return order === 'oldest' ? ta - tb : tb - ta;
  });
}

type TaskDueAlert = {
  taskId: string;
  projectId: string;
  taskTitle: string;
  projectName: string;
  daysLeft: number;
  dueDate: Date;
};

interface RoleDashboardProps {
  role: string;
  pmPreviewMode?: boolean;
}

const RoleDashboard: React.FC<RoleDashboardProps> = ({ role, pmPreviewMode = false }) => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const config = ROLE_CONFIG[role];
  
  // All hooks must be called before any conditional returns
  const [projects, setProjects] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showLiveChatPanel, setShowLiveChatPanel] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedTaskForReview, setSelectedTaskForReview] = useState<any>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- refreshUnreadChat used in LiveChatPanel onClose
  const [unreadChatCount, refreshUnreadChat] = useUnreadChatCount();
  const initialViewMode = (() => {
    try {
      return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'kanban' ? 'kanban' : 'list';
    } catch {
      return 'list';
    }
  })() as 'kanban' | 'list';
  const [section, setSection] = useState<Section>(initialViewMode === 'kanban' ? 'board' : 'overview');
  const [statusFilter, setStatusFilter] = useState<'all' | ColumnId>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(QUEUE_PAGE_SIZE);
  const [showPrioritiesModal, setShowPrioritiesModal] = useState(false);
  const [prioritiesRefreshKey, setPrioritiesRefreshKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | undefined>(undefined);
  const hasLoadedRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'created'>('due_date');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>(initialViewMode);
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);
  const skipRefreshUntilRef = useRef<number | null>(null);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [taskProjectScope, setTaskProjectScope] = useState<'department' | 'all'>('department');
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    projectId: '',
    title: '',
    description: '',
    dueDate: '',
    deliverableId: '',
    assignedToId: ''
  });
  const [showCustomDeliverableInput, setShowCustomDeliverableInput] = useState(false);
  const [customDeliverableName, setCustomDeliverableName] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit task states
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [editTaskData, setEditTaskData] = useState({
    title: '',
    description: '',
    dueDate: '',
    deliverableId: '',
    assignedToId: ''
  });
  const [, setDeliverables] = useState<any[]>([]);
  const [, setEditDeliverables] = useState<any[]>([]);
  const [showEditCustomDeliverableInput, setShowEditCustomDeliverableInput] = useState(false);
  const [editCustomDeliverableName, setEditCustomDeliverableName] = useState('');
  const [isUpdatingTaskInModal, setIsUpdatingTaskInModal] = useState(false);

  // Forward task state (for cross-department collaboration)
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardingTask, setForwardingTask] = useState<any>(null);
  const [forwarding, setForwarding] = useState(false);
  const [forwardData, setForwardData] = useState({
    targetDepartment: '',
    notes: '',
    links: ''
  });
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returningTask, setReturningTask] = useState<any>(null);
  const [returning, setReturning] = useState(false);
  const [returnData, setReturnData] = useState({
    notes: '',
    links: ''
  });

  // Assign task state (for team leads)
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningTask, setAssigningTask] = useState<any>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);

  // Bulk selection state for list view
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  // Task detail modal state
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<any>(null);
  const [taskDetailTab, setTaskDetailTab] = useState<'details' | 'conversation'>('details');

  // Drag and drop state
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  /** Per Kanban column: sort by task createdAt (newest first = default, or oldest first). */
  const [kanbanColumnSort, setKanbanColumnSort] = useState<Record<string, KanbanColumnSortOrder>>({});

  // Status change modal state (for drag and drop)
  const [showStatusChangeModal, setShowStatusChangeModal] = useState(false);
  const [statusChangeContext, setStatusChangeContext] = useState<{
    taskId: string;
    targetColumnId: string;
    targetColumnLabel: string;
  } | null>(null);
  // statusChangeNotes / statusChangeLinks state removed —
  // StatusChangeNotesModal owns these internally now (multi-link mode).
  const [statusChangeLoading, setStatusChangeLoading] = useState(false);
  const [showSubmitTicketModal, setShowSubmitTicketModal] = useState(false);
  const [showTicketsModal, setShowTicketsModal] = useState(false);
  const [showAllTaskDueAlerts, setShowAllTaskDueAlerts] = useState(false);
  const [showTestWebhookModal, setShowTestWebhookModal] = useState(false);
  const [testWebhookUserId, setTestWebhookUserId] = useState<string>('');
  const [testWebhookSending, setTestWebhookSending] = useState(false);
  const [testWebhookResult, setTestWebhookResult] = useState<{ success: boolean; message?: string } | null>(null);

  // (Department priority state is now managed by <DepartmentPriorityProjects />)

  // Department menu items
  const departmentMenuItems = [
    { id: 'Copy Writing', name: 'Copy Writing', icon: FaCopy, color: '#667eea' },
    { id: 'Designer', name: 'Design', icon: FaPalette, color: '#ec4899' },
    { id: 'Developer', name: 'Development', icon: FaCode, color: '#10b981' },
    { id: 'AI Developer', name: 'AI Development', icon: FaRobot, color: '#8b5cf6' },
    { id: 'Social Media', name: 'Social Media', icon: FaShareAlt, color: '#f59e0b' },
    { id: 'CRM', name: 'CRM', icon: FaDatabase, color: '#3b82f6' },
    { id: 'SEO/GEO', name: 'SEO/GEO', icon: FaSearch, color: '#06b6d4' },
  ];

  const getTaskTypeForDepartment = (departmentId: string): string => {
    return ROLE_CONFIG[departmentId]?.taskType || '';
  };

  const isPmDepartmentPreview = Boolean(pmPreviewMode && user?.role === 'Project Manager');
  const hasBoardManagementAccess = Boolean(
    (user?.isTeamLead && user?.role === role) ||
    user?.isHeadPM ||
    user?.role === 'FOUNDER/CEO' ||
    isPmDepartmentPreview
  );
  const canEditTeamOverride = hasBoardManagementAccess;

  // Load users once
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const usersData = await authService.getAllUsers();
        setUsers(usersData);
      } catch (error) {
        console.error('Failed to load users:', error);
      }
    };
    loadUsers();
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time notifications (like live chat): update unread count without refresh
  useEffect(() => {
    notificationService.connectSocket();
    const unsub = notificationService.onNewNotification(() => {
      loadUnreadCount();
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
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

  const notify = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  };
  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  // Reset paging and bulk selection whenever the queue changes
  useEffect(() => {
    setVisibleCount(QUEUE_PAGE_SIZE);
    setSelectedTaskIds([]);
  }, [section, statusFilter, assigneeFilter, projectFilter, searchQuery, sortBy]);

  // "/" jumps to search; Escape closes the priorities modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPrioritiesModal(false);
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) && !(e.target as HTMLElement)?.isContentEditable) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Define close handler early so it can be used across handlers
  const handleCloseTaskDetail = useCallback(() => {
    setShowTaskDetailModal(false);
    setSelectedTaskDetail(null);
  }, []);

  const loadData = useCallback(async () => {
    if (!config) return; // Early return if config is invalid

    try {
      setLoading(true);

      // Load only this department's tasks by taskType (backend filter); defensive client filter below
      const [tasksFromApi, allProjectsData] = await Promise.all([
        taskService.getAll(undefined, undefined, { all: true, taskType: config.taskType }),
        projectService.getAll()
      ]);
      // Defensive: only show tasks that match this department (in case backend filter is ignored or param lost)
      const roleTasks = tasksFromApi.filter((t: any) => t.type === config.taskType);

      // Projects that have tasks of this type
      const projectIdsWithRoleTasks = new Set<string>(
        roleTasks.map((t: any) => t.projectId)
      );
      const projectsWithRoleTasks = allProjectsData.filter((p: any) =>
        projectIdsWithRoleTasks.has(p.id)
      );

      // Projects in relevant stages (if stages are configured)
      const stageProjects = config.stages.length > 0
        ? allProjectsData.filter((p: any) => config.stages.includes(p.stage))
        : [];

      // Combine both sets of projects and de-dupe
      const combinedProjectsMap = new Map<string, any>();
      [...projectsWithRoleTasks, ...stageProjects].forEach((p: any) => {
        combinedProjectsMap.set(p.id, p);
      });
      const combinedProjects = Array.from(combinedProjectsMap.values());

      // Limit tasks to only those that belong to the combined projects
      const visibleRoleTasks = roleTasks.filter((t: any) =>
        combinedProjectsMap.has(t.projectId)
      );

      setProjects(combinedProjects);
      setAllProjects(allProjectsData);
      setTasks(visibleRoleTasks);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when tab regains focus after 30 s of inactivity
  useFocusRefetch(loadData);

  // Real-time task transfer: reload immediately when any transfer event arrives
  useEffect(() => {
    const unsub = notificationService.onTaskTransferred(() => {
      loadData();
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [loadData]);

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
    
    try {
      const freshProject = await projectService.getOne(task.projectId);
      setProjects((prevProjects: any[]) => 
        prevProjects.map((p: any) => p.id === task.projectId ? freshProject : p)
      );
    } catch (error) {
      console.error('Failed to reload project deliverables:', error);
    }
  };

  const handleOpenForwardModal = (task: any) => {
    setForwardingTask(task);
    setForwardData({
      targetDepartment: '',
      notes: '',
      links: ''
    });
    setShowForwardModal(true);
  };

  const handleOpenReturnModal = (task: any) => {
    setReturningTask(task);
    setReturnData({
      notes: '',
      links: ''
    });
    setShowReturnModal(true);
  };

  const handleForwardTask = async () => {
    if (!forwardingTask || !forwardData.targetDepartment) {
      notify('Please select a target department to forward this task to.');
      return;
    }

    const targetTaskType = getTaskTypeForDepartment(forwardData.targetDepartment);
    if (!targetTaskType) {
      notify('Selected department is not configured for tasks yet.');
      return;
    }

    setForwarding(true);
    try {
      const targetDept = departmentMenuItems.find(d => d.id === forwardData.targetDepartment);
      const deptName = targetDept?.name || forwardData.targetDepartment;

      const linkMetadata = `[[LINKED_ORIGIN_TASK_ID:${forwardingTask.id}]]\n[[LINKED_ORIGIN_DEPARTMENT:${departmentName}]]\n[[LINKED_TARGET_DEPARTMENT:${deptName}]]\n`;

      let newTaskDescription = `${linkMetadata}\nForwarded from ${departmentName}\n\nOriginal Task: ${forwardingTask.title}`;
      if (forwardingTask.description) {
        newTaskDescription += `\n\nOriginal Description:\n${forwardingTask.description}`;
      }
      if (forwardData.notes) {
        newTaskDescription += `\n\n--- Forwarding Notes ---\n${forwardData.notes}`;
      }
      if (forwardData.links) {
        newTaskDescription += `\n\n--- Forwarding Links ---\n${forwardData.links}`;
      }

      const newTaskData: any = {
        projectId: forwardingTask.projectId,
        title: `${forwardingTask.title} (Forwarded from ${departmentName})`,
        description: newTaskDescription,
        type: targetTaskType,
        status: 'Todo',
        isCompleted: false,
      };

      if (forwardingTask.dueDate) {
        newTaskData.dueDate = new Date(forwardingTask.dueDate);
      }

      if (forwardingTask.deliverableId) {
        newTaskData.deliverableId = forwardingTask.deliverableId;
      }

      const createdTask = await taskService.create(newTaskData);

      const forwardNote = `\n\n--- Forwarded to ${deptName} on ${new Date().toLocaleString()} ---\n${forwardData.notes ? `Notes: ${forwardData.notes}\n` : ''}${forwardData.links ? `Links: ${forwardData.links}` : ''}`;
      const originLinkMetadata = `\n[[LINKED_TARGET_TASK_ID:${createdTask.id}]]\n[[LINKED_TARGET_DEPARTMENT:${deptName}]]\n`;
      const updatedDescription = (forwardingTask.description || '') + originLinkMetadata + forwardNote;

      // Keep backend status unchanged (to respect allowed enum values) and just
      // append metadata + forward note for UI/tracking.
      await taskService.update(forwardingTask.id, {
        description: updatedDescription
      });

      await loadData();

      setShowForwardModal(false);
      setForwardingTask(null);
      setForwardData({
        targetDepartment: '',
        notes: '',
        links: ''
      });
      notify(`Task forwarded to ${deptName}. A new task has been created in that department.`);
    } catch (error) {
      console.error('Failed to forward task:', error);
      notify('Failed to forward task. Please try again.');
    } finally {
      setForwarding(false);
    }
  };

  const handleReturnTaskToOrigin = async () => {
    if (!returningTask) return;
    const linked = getLinkedOriginInfo(returningTask);
    if (!linked?.originTaskId) {
      notify('Linked origin task not found for this forwarded task.');
      return;
    }

    try {
      setReturning(true);
      setUpdatingTask(returningTask.id);

      // Update this department's task description with return notes/links
      if (returnData.notes || returnData.links) {
        const returnNote = `\n\n--- Returned to ${linked.originDepartmentName || 'origin department'} on ${new Date().toLocaleString()} ---\n${returnData.notes ? `Notes: ${returnData.notes}\n` : ''}${returnData.links ? `Links: ${returnData.links}` : ''}`;
        const updatedDesc = (returningTask.description || '') + returnNote;
        await taskService.update(returningTask.id, { description: updatedDesc });
      }

      await taskService.updateStatus(linked.originTaskId, 'In Review');
      await taskService.updateStatus(returningTask.id, 'Completed', true);
      await loadData();
      notify(`Task returned to ${linked.originDepartmentName || 'origin department'} for approval.`);
    } catch (error) {
      console.error('Failed to return task to origin department:', error);
      notify('Failed to return task. Please try again.');
    } finally {
      setUpdatingTask(null);
      setReturning(false);
      setShowReturnModal(false);
      setReturningTask(null);
      setReturnData({ notes: '', links: '' });
    }
  };

  const handleSendBackToTargetForRevision = async (task: any) => {
    const linked = getLinkedTargetInfo(task);
    if (!linked?.targetTaskId) {
      notify('Linked department task not found for this task.');
      return;
    }

    try {
      setUpdatingTask(task.id);
      // For now, don't change task.status to a non-enum value.
      // Just append revision notes/links to both tasks so teams see the context.
      if (returnData.notes || returnData.links) {
        const revisionNote = `\n\n--- Sent back for revision on ${new Date().toLocaleString()} ---\n${returnData.notes ? `Notes: ${returnData.notes}\n` : ''}${returnData.links ? `Links: ${returnData.links}` : ''}`;
        const updatedOriginDesc = (task.description || '') + revisionNote;
        await taskService.update(task.id, { description: updatedOriginDesc });
      }

      const targetTask = tasks.find((t: any) => t.id === linked.targetTaskId);
      const targetPrevAssignee = targetTask?.assignedToId || null;
      const targetPrevDescription = targetTask?.description || '';

      // Also append a simple revision marker on the linked department task
      await taskService.update(linked.targetTaskId, {
        description: targetPrevDescription +
          `\n\n--- Marked as Revision by ${departmentName} on ${new Date().toLocaleString()} ---`
      });

      // Ensure the task remains assigned to the same person who originally claimed it
      if (targetPrevAssignee) {
        await taskService.assign(linked.targetTaskId, targetPrevAssignee);
      }
      await loadData();
      notify(`Marked for revision and sent back to ${linked.targetDepartmentName || 'linked department'}.`);
    } catch (error) {
      console.error('Failed to send task back for revision:', error);
      notify('Failed to send back for revision. Please try again.');
    } finally {
      setUpdatingTask(null);
    }
  };

  const handleReviewSubmit = async (driveLinks: string[], deliverableType: string, deliverableId?: string) => {
    if (!selectedTaskForReview || driveLinks.length === 0) return;

    try {
      setUpdatingTask(selectedTaskForReview.id);
      const validLinks = driveLinks.map((l) => l.trim()).filter(Boolean);
      const primaryLink = validLinks[0];
      const resolvedDeliverableId = deliverableId || selectedTaskForReview.deliverableId;

      await taskService.updateStatus(
        selectedTaskForReview.id,
        'In Review',
        false,
        primaryLink,
        deliverableType,
        resolvedDeliverableId,
      );

      // Match drag-to-review: persist links as task attachments for Files & Links panel.
      await Promise.all(
        validLinks.map((link) => taskService.addLinkAttachment(selectedTaskForReview.id, link)),
      ).catch((attachmentError) => {
        console.warn('Failed to add one or more review attachment links:', attachmentError);
      });

      const timestamp = new Date().toLocaleString();
      let logBlock = `\n\n--- Status Change ---\nNew Column: For Approval\nBy: ${user?.name || 'Unknown'}\nAt: ${timestamp}`;
      if (validLinks.length === 1) {
        logBlock += `\nAttachment: ${validLinks[0]}`;
      } else if (validLinks.length > 1) {
        logBlock += `\nAttachments:\n${validLinks.map((link) => `- ${link}`).join('\n')}`;
      }

      const currentDesc = selectedTaskForReview.description || '';
      try {
        await taskService.update(selectedTaskForReview.id, { description: currentDesc + logBlock });
      } catch (descError) {
        console.warn('Failed to update task description with review log:', descError);
      }

      // Deliverable history populates Activity History in the task side panel.
      if (resolvedDeliverableId && primaryLink) {
        try {
          let baseNote = `Status moved to "For Approval" by ${user?.name || 'Unknown'}.`;
          if (validLinks.length === 1) {
            baseNote += `\nAttachment: ${validLinks[0]}`;
          } else {
            baseNote += `\nAttachments:\n${validLinks.map((link) => `- ${link}`).join('\n')}`;
          }
          await deliverableService.updateStatus(
            resolvedDeliverableId,
            'Ready for Review',
            baseNote,
            primaryLink,
          );
        } catch (historyError) {
          console.warn('Failed to record deliverable history for review:', historyError);
        }
      }

      await loadData();
      setShowReviewModal(false);
      setSelectedTaskForReview(null);
    } catch (error) {
      console.error('Failed to send for review:', error);
      notify('Failed to send for review. Please try again.');
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

  const handleOpenAssignModal = (task: any) => {
    setAssigningTask(task);
    // Initialize with existing assignees if any
    const existingAssignees: string[] = [];
    if (task.assignees && task.assignees.length > 0) {
      existingAssignees.push(...task.assignees.map((a: any) => a.userId || a.user?.id));
    } else if (task.assignedToId) {
      // Fallback to legacy assignedToId
      existingAssignees.push(task.assignedToId);
    }
    setAssignUserIds(existingAssignees);
    setShowAssignModal(true);
  };

  const handleAssignTask = async () => {
    if (!assigningTask || assignUserIds.length === 0) {
      notify('Please select at least one team member to assign this task to.');
      return;
    }

    setAssigning(true);
    try {
      setUpdatingTask(assigningTask.id);
      await taskService.assignMultiple(assigningTask.id, assignUserIds);
      await loadData();
      setShowAssignModal(false);
      setAssigningTask(null);
      setAssignUserIds([]);
      notify(`Task assigned to ${assignUserIds.length} team member(s) successfully!`);
    } catch (error) {
      console.error('Failed to assign task:', error);
      notify('Failed to assign task. Please try again.');
    } finally {
      setUpdatingTask(null);
      setAssigning(false);
    }
  };

  const toggleAssignee = (userId: string) => {
    setAssignUserIds(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Filter users by the same role/department
  const getDepartmentUsers = () => {
    return users.filter((u: any) => u.role === role);
  };

  const handleOpenTaskDetail = (task: any, tab?: 'details' | 'conversation') => {
    setSelectedTaskDetail(task);
    setTaskDetailTab(tab || 'details');
    setShowTaskDetailModal(true);
  };

  const copyTaskLink = async (task: any) => {
    if (!task?.id || !task?.projectId) {
      notify('Unable to copy task link.');
      return;
    }
    const taskUrl = `${window.location.origin}/project/${task.projectId}?task=${task.id}&tab=details`;
    try {
      await navigator.clipboard.writeText(taskUrl);
      notify('Task link copied!');
    } catch (error) {
      console.error('Failed to copy task link:', error);
      notify('Failed to copy task link.');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- used by NotificationsModal onOpenTaskConversation
  const handleOpenTaskConversationFromNotification = async (
    projectId: string,
    taskId: string,
    tab: 'details' | 'conversation' = 'conversation',
  ) => {
    try {
      const task = await taskService.getOne(taskId);
      handleOpenTaskDetail(task, tab);
    } catch (error) {
      console.error('Failed to load task:', error);
      navigate(`/project/${projectId}?task=${taskId}&tab=${tab}`);
    }
  };

  const columnCounts = useMemo(() => {
    const counts: Partial<Record<ColumnId, number>> = {};
    tasks.forEach((t: any) => {
      const column = getTaskColumn(t);
      counts[column] = (counts[column] || 0) + 1;
    });
    return counts;
  }, [tasks]);

  const queueTasks = useMemo(() => {
    let filtered = tasks;

    if (section === 'my') {
      filtered = filtered.filter((t: any) => getAssigneeIds(t).includes(user?.id || ''));
    }
    if (assigneeFilter === 'unassigned') {
      filtered = filtered.filter((t: any) => getAssigneeIds(t).length === 0);
    } else if (assigneeFilter) {
      filtered = filtered.filter((t: any) => getAssigneeIds(t).includes(assigneeFilter));
    }
    if (projectFilter) {
      filtered = filtered.filter((t: any) => t.projectId === projectFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((t: any) => getTaskColumn(t) === statusFilter);
    } else if (viewMode === 'list') {
      // The list is a work queue: finished work is one click away under "Completed"
      filtered = filtered.filter((t: any) => getTaskColumn(t) !== 'approved_completed');
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((t: any) => {
        const project = projects.find((p: any) => p.id === t.projectId);
        const assigneeNames = getAssigneeIds(t).map((id) => users.find((u: any) => u.id === id)?.name || '');
        return (
          (t.title || '').toLowerCase().includes(query) ||
          (project?.clientName || '').toLowerCase().includes(query) ||
          assigneeNames.some((name) => name.toLowerCase().includes(query))
        );
      });
    }

    return [...filtered].sort((a: any, b: any) => {
      if (sortBy === 'due_date') {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      } else if (sortBy === 'priority') {
        const priorityOrder: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tasks, section, statusFilter, assigneeFilter, projectFilter, viewMode, sortBy, user?.id, projects, users, searchQuery]);

  const groupedTasks = useMemo(() => {
    const grouped: Partial<Record<ColumnId, any[]>> = {};
    queueTasks.forEach((task: any) => {
      const column = getTaskColumn(task);
      (grouped[column] = grouped[column] || []).push(task);
    });
    return grouped;
  }, [queueTasks]);

  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) {
      map.set(project.id, project.clientName || 'Unknown Project');
    }
    return map;
  }, [projects]);

  const getProjectName = (projectId: string): string => {
    return projectNameMap.get(projectId) || 'Unknown Project';
  };

  const projectPmNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) {
      const pmName = project.pm?.name
        || (project.pmId && users.find((u: any) => u.id === project.pmId)?.name)
        || '';
      if (pmName) map.set(project.id, pmName);
    }
    return map;
  }, [projects, users]);

  const getProjectPmName = (projectId: string): string => {
    return projectPmNameMap.get(projectId) || '';
  };

  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const userItem of users) {
      map.set(userItem.id, userItem.name || 'Unassigned');
    }
    return map;
  }, [users]);

  const getUserName = (userId: string): string => {
    return userNameMap.get(userId) || 'Unassigned';
  };

  const canCreateTasksForAllProjects = hasBoardManagementAccess;
  const sortedDepartmentProjects = useMemo(
    () => [...projects].sort((a: any, b: any) => (a?.clientName || '').localeCompare(b?.clientName || '')),
    [projects]
  );
  const sortedAllProjects = useMemo(
    () => [...allProjects].sort((a: any, b: any) => (a?.clientName || '').localeCompare(b?.clientName || '')),
    [allProjects]
  );
  const taskModalProjectOptions = canCreateTasksForAllProjects && taskProjectScope === 'all'
    ? sortedAllProjects
    : sortedDepartmentProjects;

  const taskDueAlerts = useMemo<TaskDueAlert[]>(() => {
    if (!tasks.length) return [];

    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    const alerts: TaskDueAlert[] = [];
    const projectNameMap = new Map<string, string>();
    for (const p of projects) {
      projectNameMap.set(p.id, p.clientName || 'Unknown Project');
    }

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
          daysLeft,
          dueDate,
        });
      }
    }

    return alerts.sort((a, b) => a.daysLeft - b.daysLeft || a.taskTitle.localeCompare(b.taskTitle));
  }, [tasks, projects]);

  // Load deliverables when project is selected
  useEffect(() => {
    const loadDeliverables = async () => {
      if (newTaskData.projectId) {
        try {
          const projectDeliverables = await deliverableService.getAll(newTaskData.projectId);
          setDeliverables(projectDeliverables);
        } catch (error) {
          console.error('Failed to load deliverables:', error);
          setDeliverables([]);
        }
      } else {
        setDeliverables([]);
      }
    };
    loadDeliverables();
  }, [newTaskData.projectId]);

  // Load deliverables when editing a task
  useEffect(() => {
    const loadEditDeliverables = async () => {
      if (editingTask?.projectId) {
        try {
          const projectDeliverables = await deliverableService.getAll(editingTask.projectId);
          setEditDeliverables(projectDeliverables);
        } catch (error) {
          console.error('Failed to load deliverables:', error);
          setEditDeliverables([]);
        }
      } else {
        setEditDeliverables([]);
      }
    };
    if (showEditTaskModal && editingTask) {
      loadEditDeliverables();
    }
  }, [showEditTaskModal, editingTask]);

  // Early return after ALL hooks are declared
  if (!config) {
    return <div>Invalid role configuration</div>;
  }

  const { departmentName } = config;
  const color = '#6555e9';

  const handleEditTask = (task: any) => {
    setEditingTask(task);
    setEditTaskData({
      title: task.title || '',
      description: task.description || '',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      deliverableId: task.deliverableId || '',
      assignedToId: task.assignedToId || ''
    });
    setShowEditCustomDeliverableInput(false);
    setEditCustomDeliverableName('');
    setShowEditTaskModal(true);
  };

  const handleUpdateTask = async () => {
    if (!editingTask || !editTaskData.title.trim()) {
      notify('Please enter a task title');
      return;
    }

    setIsUpdatingTaskInModal(true);
    try {
      let deliverableId = editTaskData.deliverableId;

      if (showEditCustomDeliverableInput && editCustomDeliverableName.trim()) {
        const newDeliverable = await deliverableService.create(
          editingTask.projectId,
          'Other',
          editCustomDeliverableName.trim()
        );
        deliverableId = newDeliverable.id;
        const projectDeliverables = await deliverableService.getAll(editingTask.projectId);
        setEditDeliverables(projectDeliverables);
      }

      const updateData: any = {
        title: editTaskData.title,
        description: editTaskData.description,
      };

      if (editTaskData.dueDate) {
        updateData.dueDate = new Date(editTaskData.dueDate);
      }

      if (deliverableId) {
        updateData.deliverableId = deliverableId;
      }

      await taskService.update(editingTask.id, updateData);

      if (editTaskData.assignedToId !== (editingTask.assignedToId || '')) {
        if (editTaskData.assignedToId) {
          await taskService.assign(editingTask.id, editTaskData.assignedToId);
        } else if (editingTask.assignedToId) {
          try {
            await taskService.assign(editingTask.id, '');
          } catch (error) {
            console.warn('Failed to unassign task (may not be supported):', error);
          }
        }
      }

      await loadData();

      setShowEditTaskModal(false);
      setEditingTask(null);
      setEditTaskData({
        title: '',
        description: '',
        dueDate: '',
        deliverableId: '',
        assignedToId: ''
      });
      setShowEditCustomDeliverableInput(false);
      setEditCustomDeliverableName('');
      notify('Task updated successfully!');
    } catch (error) {
      console.error('Failed to update task:', error);
      notify('Failed to update task. Please try again.');
    } finally {
      setIsUpdatingTaskInModal(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskData.projectId || !newTaskData.title.trim()) {
      notify('Please select a client and enter a task title');
      return;
    }

    setCreatingTask(true);
    try {
      let deliverableId = newTaskData.deliverableId;

      if (showCustomDeliverableInput && customDeliverableName.trim()) {
        const newDeliverable = await deliverableService.create(
          newTaskData.projectId,
          'Other',
          customDeliverableName.trim()
        );
        deliverableId = newDeliverable.id;
        const projectDeliverables = await deliverableService.getAll(newTaskData.projectId);
        setDeliverables(projectDeliverables);
      }

      const taskData: any = {
        projectId: newTaskData.projectId,
        title: newTaskData.title,
        description: newTaskData.description,
        type: config?.taskType || '',
        status: 'Todo',
        isCompleted: false,
      };

      if (newTaskData.dueDate) {
        taskData.dueDate = new Date(newTaskData.dueDate);
      }

      if (deliverableId) {
        taskData.deliverableId = deliverableId;
      }

      if (newTaskData.assignedToId) {
        taskData.assignedToId = newTaskData.assignedToId;
      }

      await taskService.create(taskData);

      await loadData();

      setShowAddTaskModal(false);
      setNewTaskData({
        projectId: '',
        title: '',
        description: '',
        dueDate: '',
        deliverableId: '',
        assignedToId: ''
      });
      setTaskProjectScope('department');
      setShowCustomDeliverableInput(false);
      setCustomDeliverableName('');
      notify('Task created successfully!');
    } catch (error) {
      console.error('Failed to create task:', error);
      notify('Failed to create task. Please try again.');
    } finally {
      setCreatingTask(false);
    }
  };

  const hasRevisionDeliverables = (project: any) => {
    return project.deliverables?.some((d: any) =>
      ['Brand Book', 'Copy of Home Page', 'Home Page', 'Speaker Kit', 'Other'].includes(d.type) &&
      d.status === 'Revision'
    );
  };

  const getLinkedOriginInfo = (task: any) => {
    if (!task?.description) return null;
    const desc: string = task.description;
    const originTaskMatch = desc.match(/\[\[LINKED_ORIGIN_TASK_ID:([^\]]+)\]\]/);
    const originDeptMatch = desc.match(/\[\[LINKED_ORIGIN_DEPARTMENT:([^\]]+)\]\]/);
    const targetDeptMatch = desc.match(/\[\[LINKED_TARGET_DEPARTMENT:([^\]]+)\]\]/);

    if (!originTaskMatch) return null;

    return {
      originTaskId: originTaskMatch[1],
      originDepartmentName: originDeptMatch ? originDeptMatch[1] : '',
      targetDepartmentName: targetDeptMatch ? targetDeptMatch[1] : ''
    };
  };

  const getLinkedTargetInfo = (task: any) => {
    if (!task?.description) return null;
    const desc: string = task.description;
    const targetTaskMatch = desc.match(/\[\[LINKED_TARGET_TASK_ID:([^\]]+)\]\]/);
    const targetDeptMatch = desc.match(/\[\[LINKED_TARGET_DEPARTMENT:([^\]]+)\]\]/);

    if (!targetTaskMatch) return null;

    return {
      targetTaskId: targetTaskMatch[1],
      targetDepartmentName: targetDeptMatch ? targetDeptMatch[1] : ''
    };
  };

  // Map column ID to backend status and column marker
  const mapColumnToStatus = (columnId: string): { status: string; columnMarker?: string; isCompleted: boolean } => {
    switch (columnId) {
      case 'not_started':
        return { status: 'Todo', isCompleted: false };
      case 'owned_in_progress':
        return { status: 'In Progress', isCompleted: false };
      case 'for_approval':
        return { status: 'In Review', columnMarker: '\n\n--- Column: For Approval ---', isCompleted: false };
      case 'revision':
        return { status: 'In Review', columnMarker: '\n\n--- Column: Revision ---', isCompleted: false };
      case 'elliot_review':
        return { status: 'In Review', columnMarker: '\n\n--- Column: Elliot Review ---', isCompleted: false };
      case 'qa_before_client':
        return { status: 'In Review', columnMarker: '\n\n--- Column: QA Review ---', isCompleted: false };
      case 'client_validation':
        return { status: 'In Review', columnMarker: '\n\n--- Column: Client Validation ---', isCompleted: false };
      case 'approved_completed':
        return { status: 'Completed', isCompleted: true };
      default:
        return { status: 'Todo', isCompleted: false };
    }
  };

  // Quick move helper used by priority panel column selector.
  const handleQuickMoveTaskToColumn = async (taskId: string, columnId: string) => {
    const task = tasks.find((t: any) => t.id === taskId);
    if (!task) return;

    const { status, columnMarker, isCompleted } = mapColumnToStatus(columnId);

    if (columnMarker) {
      const currentDesc = task.description || '';
      const cleanedDesc = currentDesc.replace(/\n\n--- Column: [^-]+ ---/g, '');
      if (!cleanedDesc.includes(columnMarker)) {
        try {
          await taskService.update(task.id, {
            description: cleanedDesc + columnMarker
          });
        } catch (descError) {
          console.warn('Failed to update description with column marker:', descError);
        }
      }
    } else {
      const currentDesc = task.description || '';
      if (currentDesc.includes('--- Column:')) {
        try {
          const cleanedDesc = currentDesc.replace(/\n\n--- Column: [^-]+ ---/g, '');
          await taskService.update(task.id, {
            description: cleanedDesc
          });
        } catch (descError) {
          console.warn('Failed to clear column marker:', descError);
        }
      }
    }

    await taskService.updateStatus(taskId, status, isCompleted);
    await loadData();
  };

  // Handle status change from drag and drop modal.
  //
  // Signature changed during the StatusChangeNotesModal migration: notes
  // and links are now passed as parameters by the modal's onSave callback
  // instead of being read from local state. Behavior preserved otherwise:
  // updateStatus → per-link addLinkAttachment → description write → reload.
  //
  // Description format: hybrid per spec — singular `Attachment: <url>`
  // for one link, plural `Attachments:\n- ...` bulleted list for two or
  // more. This is a deliberate change from the previous always-plural
  // output for the 1-link case (was `Attachments:\n- url`); flagged at
  // Gate 5.
  const handleStatusChangeFromDrag = async (notes: string, links: string[]) => {
    if (!statusChangeContext) return;

    try {
      setStatusChangeLoading(true);
      const task = tasks.find((t: any) => t.id === statusChangeContext.taskId);
      if (!task) return;

      const { status, columnMarker, isCompleted } = mapColumnToStatus(statusChangeContext.targetColumnId);
      const reviewIntent =
        status === 'In Review'
          ? (statusChangeContext.targetColumnId === 'revision'
            ? 'revision'
            : statusChangeContext.targetColumnId === 'for_approval'
              ? 'for_approval'
              : undefined)
          : undefined;

      // Update task status
      await taskService.updateStatus(
        statusChangeContext.taskId,
        status,
        isCompleted,
        undefined,
        undefined,
        undefined,
        reviewIntent,
      );

      // Persist each provided link as a real attachment so it appears in
      // task side modal. Iteration matches the existing pattern at the
      // pre-migration L1334-1348 byte-for-byte.
      const validLinks = links.map((link) => link.trim()).filter(Boolean);
      if (validLinks.length > 0) {
        await Promise.all(
          validLinks.map((link) =>
            taskService.addLinkAttachment(
              statusChangeContext.taskId,
              link,
              undefined,
              notes.trim() || undefined,
            ),
          ),
        ).catch((attachmentError) => {
          console.warn('Failed to add one or more status-change attachment links:', attachmentError);
        });
      }

      // Build a single description update so marker + log stay in sync.
      const baseDesc = (task.description || '').replace(/\n\n--- Column: [^-]+ ---/g, '');
      const descWithMarker = columnMarker ? `${baseDesc}${columnMarker}` : baseDesc;
      const timestamp = new Date().toLocaleString();
      let logBlock = `\n\n--- Status Change ---\nNew Column: ${statusChangeContext.targetColumnLabel}\nBy: ${user?.name || 'Unknown'}\nAt: ${timestamp}`;

      if (notes && notes.trim()) {
        logBlock += `\nNotes: ${notes.trim()}`;
      }

      // Hybrid format: singular for length 1, plural+bullets for length >= 2.
      if (validLinks.length === 1) {
        logBlock += `\nAttachment: ${validLinks[0]}`;
      } else if (validLinks.length > 1) {
        logBlock += `\nAttachments:\n${validLinks.map((link) => `- ${link}`).join('\n')}`;
      }

      const updatedDesc = descWithMarker + logBlock;
      try {
        await taskService.update(task.id, { description: updatedDesc });
      } catch (descError) {
        console.warn('Failed to update task description with status change log:', descError);
      }

      // Reload data
      await loadData();

      // Close modal
      setShowStatusChangeModal(false);
      setStatusChangeContext(null);

      notify(`Task moved to ${statusChangeContext.targetColumnLabel} ✓`);
    } catch (error) {
      console.error('Failed to update task status:', error);
      notify('Failed to update task status. Please try again.');
    } finally {
      setStatusChangeLoading(false);
    }
  };



  const openStatusChange = (taskId: string, columnId: ColumnId) => {
    setStatusChangeContext({ taskId, targetColumnId: columnId, targetColumnLabel: COLUMN_LABEL[columnId] });
    setShowStatusChangeModal(true);
  };

  const rememberViewMode = (mode: 'kanban' | 'list') => {
    setViewMode(mode);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {
      // Remembering the layout is only a convenience
    }
  };

  const switchViewMode = (mode: 'kanban' | 'list') => {
    rememberViewMode(mode);
    if (mode === 'kanban' && section === 'overview') setSection('board');
    if (mode === 'list' && section === 'board') setSection('overview');
  };

  const goToSection = (next: Section) => {
    setSection(next);
    setProjectFilter(null);
    setAssigneeFilter(null);
    setSearchQuery('');
    setStatusFilter(next === 'approvals' ? 'for_approval' : 'all');
    if (next === 'board') rememberViewMode('kanban');
    else if (next === 'overview' || next === 'approvals') rememberViewMode('list');
  };

  const applyStatusFilter = (column: ColumnId) => {
    if (section === 'board') {
      setSection('overview');
    }
    rememberViewMode('list');
    setStatusFilter((current) => (current === column ? 'all' : column));
  };

  const handleBulkDelete = async () => {
    if (selectedTaskIds.length === 0) return;
    const confirmed = window.confirm(
      `Delete ${selectedTaskIds.length} selected task${selectedTaskIds.length > 1 ? 's' : ''}? This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      setUpdatingTask('bulk-delete');
      await Promise.all(selectedTaskIds.map((id) => taskService.delete(id)));
      await loadData();
      notify(`Deleted ${selectedTaskIds.length} task${selectedTaskIds.length > 1 ? 's' : ''}.`);
      setSelectedTaskIds([]);
    } catch (error) {
      console.error('Failed to bulk delete tasks:', error);
      await loadData();
      notify('Some tasks could not be deleted. Please try again.');
    } finally {
      setUpdatingTask(null);
    }
  };

  if (loading && !hasLoadedRef.current) {
    return (
      <div className="rd-root">
        <AppSidebar />
        <main className="rd-main rd-loading" aria-live="polite">
          <div style={{ textAlign: 'center' }}>
            <FaSpinner className="rd-spin" style={{ fontSize: 22, color: '#6555e9', marginBottom: 12 }} />
            <div>Loading {departmentName}…</div>
          </div>
        </main>
      </div>
    );
  }

  const myTasks = tasks.filter((t: any) => {
    const assignees = t.assignees || [];
    const assigneeIds = assignees.length > 0 
      ? assignees.map((a: any) => a.userId || a.user?.id)
      : (t.assignedToId ? [t.assignedToId] : []);
    return assigneeIds.includes(user?.id || '');
  });
  const isAIDeveloper = config.taskType === 'AI';
  const isTeamLead = hasBoardManagementAccess;
  const canCreateProjects = Boolean(user?.isHeadPM || isTeamLead || user?.role === 'FOUNDER/CEO');

  const countOf = (id: ColumnId) => columnCounts[id] || 0;
  const activeTasks = tasks.filter((t: any) => getTaskColumn(t) !== 'approved_completed');
  const myActiveCount = myTasks.filter((t: any) => getTaskColumn(t) !== 'approved_completed').length;
  const unassignedCount = activeTasks.filter((t: any) => getAssigneeIds(t).length === 0).length;
  const overdueCount = taskDueAlerts.filter((a) => a.daysLeft < 0).length;
  const healthRows = HEALTH_COLUMNS.map((id) => ({ id, label: COLUMN_LABEL[id], value: countOf(id) }));
  const healthMax = Math.max(1, ...healthRows.map((r) => r.value));
  const queueTotal = queueTasks.length;
  const visibleTasks = queueTasks.slice(0, visibleCount);

  const pinnedProjects = (() => {
    const openByProject = new Map<string, number>();
    myTasks.forEach((t: any) => {
      if (getTaskColumn(t) !== 'approved_completed') {
        openByProject.set(t.projectId, (openByProject.get(t.projectId) || 0) + 1);
      }
    });
    return Array.from(openByProject.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id]) => {
        const hash = id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
        return {
          id,
          label: getProjectName(id),
          color: PROJECT_DOT_COLORS[hash % PROJECT_DOT_COLORS.length],
          active: projectFilter === id,
          onClick: () => {
            setProjectFilter(id);
            setSection('overview');
            setStatusFilter('all');
            setViewMode('list');
          },
        };
      });
  })();

  const teamRows = (() => {
    const rows = new Map<string, { id: string; name: string; avatarUrl?: string; active: number; progress: number; review: number; overdue: number }>();
    const ensure = (id: string) => {
      if (!rows.has(id)) {
        const u = users.find((x: any) => x.id === id);
        rows.set(id, { id, name: u?.name || getUserName(id), avatarUrl: u?.avatarUrl, active: 0, progress: 0, review: 0, overdue: 0 });
      }
      return rows.get(id)!;
    };
    users.filter((u: any) => u.role === role).forEach((u: any) => ensure(u.id));
    activeTasks.forEach((t: any) => {
      const column = getTaskColumn(t);
      const late = getDueInfo(t).className === 'rd-overdue';
      getAssigneeIds(t).forEach((id: string) => {
        const row = ensure(id);
        row.active += 1;
        if (column === 'owned_in_progress') row.progress += 1;
        if (column === 'for_approval') row.review += 1;
        if (late) row.overdue += 1;
      });
    });
    return Array.from(rows.values()).sort((a, b) => b.active - a.active || a.name.localeCompare(b.name));
  })();

  /**
   * What the current user can do with a task. Same rules the old Kanban cards used,
   * so the board card and the task drawer always offer the same actions.
   */
  const getTaskActions = (task: any): TaskAction[] => {
    const project = projects.find((p: any) => p.id === task.projectId) || {};
    const assigneeIds = getAssigneeIds(task);
    const isMine = assigneeIds.includes(user?.id || '');
    const linkedOrigin = getLinkedOriginInfo(task);
    const linkedTarget = getLinkedTargetInfo(task);
    const revisionPending = hasRevisionDeliverables(project);
    const close = (fn: () => void) => () => {
      handleCloseTaskDetail();
      fn();
    };
    const actions: TaskAction[] = [];

    if (assigneeIds.length === 0) {
      actions.push({ key: 'claim', label: 'Claim task', run: close(() => { handleClaimTask(task.id); }) });
      if (isTeamLead) actions.push({ key: 'assign', label: 'Assign to team member', run: close(() => handleOpenAssignModal(task)) });
    }
    if (task.assignedToId && !task.isCompleted && (isMine || isTeamLead)) {
      if (task.status === 'Todo') {
        actions.push({ key: 'start', label: 'Start task', run: close(() => { handleTaskStatusUpdate(task.id, 'In Progress'); }) });
      }
      if (task.status === 'In Progress' || (revisionPending && task.status === 'In Review')) {
        actions.push({ key: 'review', label: revisionPending ? 'Resubmit' : 'Send for review', run: close(() => { handleSendForReview(task); }) });
        if (isAIDeveloper) actions.push({ key: 'forward', label: 'Forward to department', run: close(() => handleOpenForwardModal(task)) });
        if (!revisionPending && !linkedOrigin) {
          actions.push({ key: 'complete', label: 'Complete', run: close(() => { handleTaskStatusUpdate(task.id, 'Completed', true); }) });
        }
      }
      if (linkedOrigin) {
        actions.push({
          key: 'return',
          label: `Return to ${linkedOrigin.originDepartmentName || 'origin dept'} for approval`,
          run: close(() => handleOpenReturnModal(task)),
        });
      }
      if (task.status === 'In Review' && !revisionPending && !linkedTarget) {
        actions.push({ key: 'mark-complete', label: 'Mark complete', run: close(() => { handleTaskStatusUpdate(task.id, 'Completed', true); }) });
        actions.push({ key: 'request-changes', label: 'Request changes', run: close(() => openStatusChange(task.id, 'revision')) });
        actions.push({ key: 'back', label: 'Back to in progress', run: close(() => { handleTaskStatusUpdate(task.id, 'In Progress'); }) });
      }
      if (linkedTarget && task.status === 'In Review') {
        actions.push({
          key: 'send-back',
          label: `Send back to ${linkedTarget.targetDepartmentName || 'linked dept'} for revision`,
          run: close(() => { handleSendBackToTargetForRevision(task); }),
        });
      }
    }
    if (task.assignedToId && !task.isCompleted && isTeamLead) {
      actions.push({ key: 'members', label: 'Update members', run: close(() => handleOpenAssignModal(task)) });
    }
    return actions;
  };

  const renderOwner = (task: any) => {
    const ids = getAssigneeIds(task);
    if (ids.length === 0) return <span className="rd-unassigned">Unassigned</span>;
    const first = users.find((u: any) => u.id === ids[0]);
    const name = getUserName(ids[0]);
    return (
      <span className="rd-owner">
        <UserAvatar name={name} avatarUrl={first?.avatarUrl} size={25} color="#6555e9" />
        <span className="rd-owner-name">{name}{ids.length > 1 ? ` +${ids.length - 1}` : ''}</span>
      </span>
    );
  };

  const drawerTask = selectedTaskDetail
    ? tasks.find((t: any) => t.id === selectedTaskDetail.id) || selectedTaskDetail
    : null;
  const drawerActions = drawerTask ? getTaskActions(drawerTask) : [];
  const drawerColumn: ColumnId = drawerTask ? getTaskColumn(drawerTask) : 'not_started';
  const drawerFooter = drawerTask ? (
    <div className="rd-drawer-foot">
      <div className="rd-next">
        <b>What happens next?</b>
        {NEXT_STEP[drawerColumn]}
      </div>
      {drawerActions.length > 0 && (
        <div className="rd-foot-actions">
          {drawerActions.map((action, i) => (
            <button
              key={action.key}
              type="button"
              className={`rd-btn ${i === 0 ? 'rd-btn-primary' : 'rd-btn-subtle'}`}
              disabled={updatingTask === drawerTask.id}
              onClick={action.run}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      <div className="rd-foot-tools">
        <select
          className="rd-select"
          aria-label="Move task to stage"
          value=""
          onChange={(e) => {
            if (!e.target.value) return;
            const target = e.target.value as ColumnId;
            handleCloseTaskDetail();
            openStatusChange(drawerTask.id, target);
          }}
        >
          <option value="">Move to stage…</option>
          {BOARD_COLUMNS.filter((id) => id !== drawerColumn).map((id) => (
            <option key={id} value={id}>{COLUMN_LABEL[id]}</option>
          ))}
        </select>
        <button type="button" className="rd-btn rd-btn-subtle" onClick={() => { handleCloseTaskDetail(); handleEditTask(drawerTask); }}>
          <FaEdit /> Edit
        </button>
        <button type="button" className="rd-btn rd-btn-subtle" aria-label="Copy task link" title="Copy task link" onClick={() => copyTaskLink(drawerTask)}>
          <FaLink />
        </button>
      </div>
    </div>
  ) : null;

  const sectionCopy: Record<Section, { title: string; desc: string; queue: string; sub: string }> = {
    overview: { title: 'Team overview', desc: "A clear view of the work that needs your team's attention.", queue: 'Work queue', sub: 'Review, delegate, and move work forward from one place.' },
    my: { title: 'My work', desc: 'Your current tasks, handoffs and next actions.', queue: 'Your work queue', sub: 'Everything assigned to you that is still open.' },
    board: { title: 'Board', desc: 'See work by workflow stage. Drag a card to move it.', queue: 'Team board', sub: 'Open a card to see its details and next action.' },
    approvals: { title: 'Approvals', desc: 'Review submitted work and unblock the team.', queue: 'Approval inbox', sub: 'Open a task to complete it or request changes.' },
    team: { title: 'Team', desc: "See who owns what, and where someone needs help.", queue: 'Tasks', sub: 'Select a person to see their tasks.' },
  };
  const copy = sectionCopy[section];
  const pageTitle = projectFilter ? getProjectName(projectFilter) : copy.title;
  const pageDesc = projectFilter ? 'Tasks, owners and next actions for this project.' : copy.desc;
  const assigneeFilterName = assigneeFilter === 'unassigned' ? 'Unassigned' : assigneeFilter ? getUserName(assigneeFilter) : '';

  return (
    <div className="dashboard rd-root" style={{ padding: 0 }}>
      <AppSidebar
        workspace={{
          items: [
            { key: 'overview', label: 'Overview', icon: <FaThLarge />, active: section === 'overview' && !projectFilter, onClick: () => goToSection('overview') },
            { key: 'my', label: 'My work', icon: <FaCheckCircle />, count: myActiveCount, active: section === 'my', onClick: () => goToSection('my') },
            { key: 'board', label: 'Board', icon: <FaColumns />, active: section === 'board', onClick: () => goToSection('board') },
            { key: 'approvals', label: 'Approvals', icon: <FaInbox />, count: countOf('for_approval'), active: section === 'approvals', onClick: () => goToSection('approvals') },
            { key: 'team', label: 'Team', icon: <FaUsers />, active: section === 'team', onClick: () => goToSection('team') },
          ],
          pinned: pinnedProjects,
        }}
      />

      <main className="rd-main">
        <header className="rd-topbar">
          <div className="rd-crumb">
            <span className="rd-crumb-root">Workspaces /</span>
            <strong>{departmentName}</strong>
          </div>
          <div className="rd-topactions">
            <button type="button" className="rd-icon-btn" onClick={() => setShowLiveChatPanel(true)} aria-label="Live chat" title="Live chat">
              <FaComments />
              {unreadChatCount > 0 && <span className="rd-badge">{unreadChatCount > 9 ? '9+' : unreadChatCount}</span>}
            </button>
            <button type="button" className="rd-icon-btn" onClick={() => setShowNotificationsModal(true)} aria-label="Notifications" title="Notifications">
              <FaBell />
              {unreadNotifications > 0 && <span className="rd-badge">{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>}
            </button>
            {canCreateProjects && (
              <button type="button" className="rd-btn rd-btn-subtle" onClick={() => setShowCreateProjectModal(true)} aria-label="New project">
                <FaFolderPlus /> <span className="rd-btn-label">New project</span>
              </button>
            )}
            <button
              type="button"
              className="rd-btn rd-btn-primary"
              aria-label="New task"
              onClick={() => {
                setTaskProjectScope('department');
                setShowAddTaskModal(true);
              }}
            >
              <FaPlus /> <span className="rd-btn-label">New task</span>
            </button>
            <div className="rd-avatar-wrap avatar-dropdown-container">
              <button
                type="button"
                className="rd-avatar-btn"
                onClick={() => setShowAvatarDropdown(!showAvatarDropdown)}
                aria-label="Account menu"
                aria-expanded={showAvatarDropdown}
              >
                <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} size={34} color="#6555e9" />
              </button>
              {showAvatarDropdown && (
                <div className="rd-menu">
                  <div className="rd-menu-head">
                    <b>{user?.name}</b>
                    <small>{user?.email}</small>
                  </div>
                  <button type="button" onClick={() => navigate('/profile')}><FaUser /> Profile</button>
                  <button type="button" onClick={() => navigate('/timeline')}><FaClock /> My timeline</button>
                  <button type="button" onClick={() => { setShowAvatarDropdown(false); setShowSubmitTicketModal(true); }}><FaTicketAlt /> Submit ticket</button>
                  {isAIDeveloper && (
                    <button type="button" onClick={() => { setShowAvatarDropdown(false); setShowTicketsModal(true); }}><FaInbox /> View tickets</button>
                  )}
                  {isAIDeveloper && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAvatarDropdown(false);
                        setShowTestWebhookModal(true);
                        setTestWebhookUserId('');
                        setTestWebhookResult(null);
                      }}
                    >
                      <FaBolt /> Test webhook
                    </button>
                  )}
                  {isTeamLead && (
                    <button type="button" onClick={() => navigate('/pm-dashboard')}><FaThLarge /> PM dashboard</button>
                  )}
                  <button type="button" onClick={() => navigate('/settings')}><FaCog /> Settings</button>
                  <button type="button" className="danger" onClick={handleLogout}><FaSignOutAlt /> Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="rd-content">
          <div className="rd-header">
            <div>
              <div className="rd-eyebrow"><span className="rd-live" />{departmentName}</div>
              <h1 className="rd-h1">{pageTitle}</h1>
              <p className="rd-desc">{pageDesc}</p>
            </div>
            <div className="rd-today">
              <FaCalendarAlt aria-hidden="true" />
              {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          <div className="rd-stats">
            {[
              { id: 'for_approval' as ColumnId, label: 'Waiting for approval', tone: 'purple', icon: <FaInbox />, foot: 'Needs a reviewer decision' },
              { id: 'revision' as ColumnId, label: 'Changes requested', tone: 'amber', icon: <FaSyncAlt />, foot: 'Waiting for rework' },
              { id: 'owned_in_progress' as ColumnId, label: 'In progress', tone: 'blue', icon: <FaClock />, foot: unassignedCount > 0 ? `${unassignedCount} more unassigned` : 'Owned by team members' },
              { id: 'approved_completed' as ColumnId, label: 'Completed', tone: 'green', icon: <FaCheckCircle />, foot: 'Delivered by this team' },
            ].map((stat) => (
              <button
                key={stat.id}
                type="button"
                className={`rd-stat${statusFilter === stat.id ? ' active' : ''}`}
                aria-pressed={statusFilter === stat.id}
                onClick={() => applyStatusFilter(stat.id)}
              >
                <div className="rd-stat-top">
                  <span>{stat.label}</span>
                  <span className={`rd-stat-icon ${stat.tone}`} aria-hidden="true">{stat.icon}</span>
                </div>
                <div className="rd-stat-num">{countOf(stat.id)}</div>
                <div className="rd-stat-foot">{stat.foot}</div>
              </button>
            ))}
          </div>

          <div className="rd-grid">
            <div style={{ minWidth: 0 }}>
              {section === 'team' && (
                <section className="rd-panel">
                  <div className="rd-panel-head">
                    <div>
                      <h2 className="rd-panel-title">Team workload</h2>
                      <p className="rd-panel-sub">Open tasks per person. Select someone to filter the queue below.</p>
                    </div>
                  </div>
                  <div className="rd-team-row head" aria-hidden="true">
                    <span>Person</span>
                    <span className="rd-team-num">Open</span>
                    <span className="rd-team-num rd-team-hide">In progress</span>
                    <span className="rd-team-num rd-team-hide">In approval</span>
                    <span className="rd-team-num">Overdue</span>
                  </div>
                  {teamRows.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className={`rd-team-row${assigneeFilter === row.id ? ' active' : ''}`}
                      onClick={() => setAssigneeFilter(assigneeFilter === row.id ? null : row.id)}
                    >
                      <span className="rd-owner">
                        <UserAvatar name={row.name} avatarUrl={row.avatarUrl} size={25} color="#6555e9" />
                        <span className="rd-owner-name">{row.name}</span>
                      </span>
                      <span className="rd-team-num">{row.active}</span>
                      <span className="rd-team-num rd-team-hide">{row.progress}</span>
                      <span className="rd-team-num rd-team-hide">{row.review}</span>
                      <span className={`rd-team-num${row.overdue > 0 ? ' rd-overdue' : ''}`}>{row.overdue}</span>
                    </button>
                  ))}
                  {unassignedCount > 0 && (
                    <button
                      type="button"
                      className={`rd-team-row${assigneeFilter === 'unassigned' ? ' active' : ''}`}
                      onClick={() => setAssigneeFilter(assigneeFilter === 'unassigned' ? null : 'unassigned')}
                    >
                      <span className="rd-unassigned">Unassigned</span>
                      <span className="rd-team-num">{unassignedCount}</span>
                      <span className="rd-team-num rd-team-hide">–</span>
                      <span className="rd-team-num rd-team-hide">–</span>
                      <span className="rd-team-num">–</span>
                    </button>
                  )}
                </section>
              )}

              <section className="rd-panel">
                <div className="rd-panel-head">
                  <div>
                    <h2 className="rd-panel-title">{copy.queue}</h2>
                    <p className="rd-panel-sub">{copy.sub}</p>
                  </div>
                  <div className="rd-segmented" role="group" aria-label="Queue layout">
                    <button type="button" className={`rd-segment${viewMode === 'list' ? ' active' : ''}`} aria-pressed={viewMode === 'list'} onClick={() => switchViewMode('list')}>List</button>
                    <button type="button" className={`rd-segment${viewMode === 'kanban' ? ' active' : ''}`} aria-pressed={viewMode === 'kanban'} onClick={() => switchViewMode('kanban')}>Board</button>
                  </div>
                </div>

                <div className="rd-toolbar">
                  <div className="rd-chips">
                    <button type="button" className={`rd-chip${statusFilter === 'all' ? ' active' : ''}`} onClick={() => setStatusFilter('all')}>
                      {viewMode === 'list' ? 'All open' : 'All work'}
                    </button>
                    {CHIP_COLUMNS.map((id) => (
                      <button key={id} type="button" className={`rd-chip${statusFilter === id ? ' active' : ''}`} onClick={() => setStatusFilter(id)}>
                        {COLUMN_LABEL[id]}<span className="rd-chip-count">{countOf(id)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="rd-tools">
                    <label className="rd-search">
                      <FaSearch aria-hidden="true" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Find a task or project…"
                        aria-label="Find a task or project"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </label>
                    {viewMode === 'list' && (
                      <select className="rd-select" aria-label="Sort tasks" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                        <option value="due_date">Due date</option>
                        <option value="priority">Priority</option>
                        <option value="created">Newest</option>
                      </select>
                    )}
                  </div>
                </div>

                {(projectFilter || assigneeFilter) && (
                  <div className="rd-active-filters">
                    {projectFilter && (
                      <button type="button" className="rd-filter-tag" onClick={() => setProjectFilter(null)} aria-label={`Remove project filter ${getProjectName(projectFilter)}`}>
                        Project: {getProjectName(projectFilter)} <FaTimes aria-hidden="true" />
                      </button>
                    )}
                    {assigneeFilter && (
                      <button type="button" className="rd-filter-tag" onClick={() => setAssigneeFilter(null)} aria-label={`Remove assignee filter ${assigneeFilterName}`}>
                        Assignee: {assigneeFilterName} <FaTimes aria-hidden="true" />
                      </button>
                    )}
                    {projectFilter && (
                      <button type="button" className="rd-link" onClick={() => navigate(`/project/${projectFilter}`)}>Open project</button>
                    )}
                  </div>
                )}

                {isTeamLead && viewMode === 'list' && selectedTaskIds.length > 0 && (
                  <div className="rd-bulkbar">
                    <span>{selectedTaskIds.length} selected</span>
                    <button type="button" className="rd-btn rd-btn-danger" disabled={updatingTask === 'bulk-delete'} onClick={handleBulkDelete}>
                      {updatingTask === 'bulk-delete' ? 'Deleting…' : 'Delete selected'}
                    </button>
                  </div>
                )}

                {viewMode === 'list' ? (
                  <table className="rd-table">
                    <thead>
                      <tr>
                        {isTeamLead && (
                          <th className="rd-col-check">
                            <input
                              type="checkbox"
                              aria-label="Select all tasks"
                              checked={queueTotal > 0 && selectedTaskIds.length === queueTotal}
                              onChange={(e) => setSelectedTaskIds(e.target.checked ? queueTasks.map((t: any) => t.id) : [])}
                            />
                          </th>
                        )}
                        <th className="rd-col-task">Task / project</th>
                        <th className="rd-col-status">Status</th>
                        <th className="rd-col-owner">Assignee</th>
                        <th className="rd-col-date">Due date</th>
                        <th className="rd-col-arrow" aria-hidden="true"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTasks.map((task: any) => {
                        const column = getTaskColumn(task);
                        const due = getDueInfo(task);
                        const pm = getProjectPmName(task.projectId);
                        return (
                          <tr
                            key={task.id}
                            tabIndex={0}
                            onClick={() => handleOpenTaskDetail(task)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.target === e.currentTarget) handleOpenTaskDetail(task);
                            }}
                          >
                            {isTeamLead && (
                              <td className="rd-col-check" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${task.title}`}
                                  checked={selectedTaskIds.includes(task.id)}
                                  onChange={(e) =>
                                    setSelectedTaskIds((prev) =>
                                      e.target.checked ? [...prev, task.id] : prev.filter((id) => id !== task.id)
                                    )
                                  }
                                />
                              </td>
                            )}
                            <td className="rd-col-task">
                              <div className="rd-task-name">{task.title}</div>
                              <div className="rd-task-meta">
                                {getProjectName(task.projectId)}
                                {pm && <><span className="rd-dotsep">·</span>PM: {pm}</>}
                                {task.priority === 'High' && <><span className="rd-dotsep">·</span><span className="rd-high">High priority</span></>}
                              </div>
                            </td>
                            <td className="rd-col-status"><span className={`rd-pill ${column}`}>{COLUMN_LABEL[column]}</span></td>
                            <td className="rd-col-owner">{renderOwner(task)}</td>
                            <td className="rd-col-date"><span className={due.className}>{due.text}</span></td>
                            <td className="rd-col-arrow" aria-hidden="true"><FaChevronRight /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="rd-board">
                    {BOARD_COLUMNS.map((columnId) => {
                      const columnTasks = sortKanbanTasksByCreatedAt(groupedTasks[columnId] || [], kanbanColumnSort[columnId] ?? 'newest');
                      return (
                        <div
                          key={columnId}
                          className={`rd-board-col${dragOverColumn === columnId ? ' over' : ''}`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            setDragOverColumn(columnId);
                          }}
                          onDragLeave={() => setDragOverColumn(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverColumn(null);
                            if (!draggedTask) return;
                            openStatusChange(draggedTask, columnId);
                            setDraggedTask(null);
                          }}
                        >
                          <div className="rd-board-heading">
                            <span>{COLUMN_LABEL[columnId]}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <select
                                className="rd-board-sort"
                                aria-label={`Sort ${COLUMN_LABEL[columnId]}`}
                                value={kanbanColumnSort[columnId] ?? 'newest'}
                                onChange={(e) =>
                                  setKanbanColumnSort((prev) => ({ ...prev, [columnId]: e.target.value as KanbanColumnSortOrder }))
                                }
                              >
                                <option value="newest">Newest</option>
                                <option value="oldest">Oldest</option>
                              </select>
                              <span className="rd-board-count">{columnTasks.length}</span>
                            </span>
                          </div>
                          <div className="rd-board-list">
                            {columnTasks.map((task: any) => {
                              const due = getDueInfo(task);
                              const primary = getTaskActions(task)[0];
                              return (
                                <div
                                  key={task.id}
                                  className="rd-card"
                                  role="button"
                                  tabIndex={0}
                                  draggable
                                  onDragStart={(e) => {
                                    setDraggedTask(task.id);
                                    e.dataTransfer.effectAllowed = 'move';
                                  }}
                                  onDragEnd={() => setDraggedTask(null)}
                                  onClick={() => handleOpenTaskDetail(task)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.target === e.currentTarget) handleOpenTaskDetail(task);
                                  }}
                                >
                                  <small>{getProjectName(task.projectId)}</small>
                                  <b>{task.title}</b>
                                  <div className="rd-card-foot">
                                    {renderOwner(task)}
                                    <span className={due.className} style={{ flexShrink: 0 }}>{due.text}</span>
                                  </div>
                                  {primary && (
                                    <button
                                      type="button"
                                      className="rd-btn rd-btn-subtle"
                                      disabled={updatingTask === task.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        primary.run();
                                      }}
                                    >
                                      {updatingTask === task.id ? <FaSpinner className="rd-spin" /> : primary.label}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                            {columnTasks.length === 0 && <div className="rd-board-empty">Nothing here</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {viewMode === 'list' && queueTotal === 0 && (
                  <div className="rd-empty">
                    <b>No tasks match this view</b>
                    Try a different search or status.
                    {(statusFilter !== 'all' || searchQuery || projectFilter || assigneeFilter) && (
                      <div style={{ marginTop: 10 }}>
                        <button type="button" className="rd-link" onClick={() => goToSection('overview')}>Clear filters</button>
                      </div>
                    )}
                  </div>
                )}

                {viewMode === 'list' && queueTotal > 0 && (
                  <div className="rd-panel-foot">
                    <span>Showing {visibleTasks.length} of {queueTotal} {queueTotal === 1 ? 'task' : 'tasks'}</span>
                    {visibleTasks.length < queueTotal && (
                      <button type="button" className="rd-link" onClick={() => setVisibleCount((n) => n + QUEUE_PAGE_SIZE)}>Show more</button>
                    )}
                  </div>
                )}
              </section>
            </div>

            <aside className="rd-rail" aria-label="Team summary">
              <TodaysPrioritiesCard
                taskType={config.taskType}
                refreshKey={prioritiesRefreshKey}
                onManage={() => setShowPrioritiesModal(true)}
                onOpenRow={(row) => {
                  const rowTask = row.taskId ? tasks.find((t: any) => t.id === row.taskId) : null;
                  if (rowTask) handleOpenTaskDetail(rowTask);
                  else if (row.projectId) navigate(`/project/${row.projectId}`);
                }}
              />

              {taskDueAlerts.length > 0 && (
                <section className="rd-panel rd-rail-card">
                  <div className="rd-rail-title">
                    <h3>{overdueCount > 0 ? `Overdue and due soon` : 'Due soon'}</h3>
                    <span className="rd-board-count">{taskDueAlerts.length}</span>
                  </div>
                  {(showAllTaskDueAlerts ? taskDueAlerts : taskDueAlerts.slice(0, 5)).map((item) => {
                    const dueTask = tasks.find((t: any) => t.id === item.taskId);
                    return (
                      <button key={item.taskId} type="button" className="rd-due-row" onClick={() => dueTask && handleOpenTaskDetail(dueTask)}>
                        <span className="rd-due-text">
                          <span className="rd-due-title">{item.taskTitle}</span>
                          <span className="rd-due-project">{item.projectName}</span>
                        </span>
                        <span className={`rd-due-when ${item.daysLeft < 0 ? 'rd-overdue' : item.daysLeft <= 1 ? 'rd-duesoon' : ''}`}>
                          {item.daysLeft < 0 ? `${Math.abs(item.daysLeft)}d overdue` : item.daysLeft === 0 ? 'Today' : `${item.daysLeft}d left`}
                        </span>
                      </button>
                    );
                  })}
                  {taskDueAlerts.length > 5 && (
                    <button type="button" className="rd-link" style={{ marginTop: 8 }} onClick={() => setShowAllTaskDueAlerts(!showAllTaskDueAlerts)}>
                      {showAllTaskDueAlerts ? 'Show less' : `Show all ${taskDueAlerts.length}`}
                    </button>
                  )}
                </section>
              )}

              <section className="rd-panel rd-rail-card">
                <div className="rd-rail-title">
                  <h3>Workflow health</h3>
                  <FaChartLine style={{ color: '#747b8c' }} aria-hidden="true" />
                </div>
                {healthRows.map((row) => (
                  <button key={row.id} type="button" className="rd-health-row" onClick={() => applyStatusFilter(row.id)} title={`Show ${row.label.toLowerCase()} tasks`}>
                    <span className="rd-health-label"><span>{row.label}</span><b>{row.value}</b></span>
                    <span className="rd-track"><span className="rd-fill" style={{ width: `${(row.value / healthMax) * 100}%` }} /></span>
                  </button>
                ))}
              </section>

              <section className="rd-panel rd-rail-card rd-quick">
                <div className="rd-rail-title"><h3>Quick actions</h3></div>
                <button type="button" className="rd-btn rd-btn-subtle" onClick={() => goToSection('approvals')}>Open approval inbox <FaArrowRight aria-hidden="true" /></button>
                <button type="button" className="rd-btn rd-btn-subtle" onClick={() => goToSection('my')}>See my assigned work <FaArrowRight aria-hidden="true" /></button>
              </section>
            </aside>
          </div>
        </div>
      </main>

      {/* Modals */}
      <NotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => {
          setShowNotificationsModal(false);
          loadUnreadCount();
        }}
        onUpdate={loadUnreadCount}
        onOpenTaskConversation={handleOpenTaskConversationFromNotification}
      />
      <SubmitTicketModal
        isOpen={showSubmitTicketModal}
        onClose={() => setShowSubmitTicketModal(false)}
        accentColor={color}
      />
      <TicketsModal
        isOpen={showTicketsModal}
        onClose={() => setShowTicketsModal(false)}
        accentColor={color}
      />
      {/* Test notification webhook modal (AI Developer only) */}
      {showTestWebhookModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '2rem'
          }}
          onClick={() => {
            if (!testWebhookSending) {
              setShowTestWebhookModal(false);
              setTestWebhookResult(null);
            }
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 24px 80px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
                Test notification webhook
              </h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                Sends a test payload to the n8n webhook (Webhook-Token: katalystPM2026). Choose an email to receive the test.
              </p>
            </div>
            <div style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem' }}>
                Send test to
              </label>
              <select
                value={testWebhookUserId}
                onChange={(e) => setTestWebhookUserId(e.target.value)}
                disabled={testWebhookSending}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  fontSize: '0.9375rem',
                  background: 'white',
                  cursor: testWebhookSending ? 'not-allowed' : 'pointer'
                }}
              >
                <option value="">Select a user (email)...</option>
                {users.filter((u: any) => u.email).map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.name} – {u.email}
                  </option>
                ))}
              </select>
              {testWebhookResult && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    background: testWebhookResult.success ? '#ecfdf5' : '#fef2f2',
                    color: testWebhookResult.success ? '#065f46' : '#b91c1c',
                    border: `1px solid ${testWebhookResult.success ? '#a7f3d0' : '#fecaca'}`
                  }}
                >
                  {testWebhookResult.success ? '✓ ' : '✗ '}
                  {testWebhookResult.message || (testWebhookResult.success ? 'Sent.' : 'Failed.')}
                </div>
              )}
            </div>
            <div style={{ padding: '1rem 2rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => {
                  if (!testWebhookSending) {
                    setShowTestWebhookModal(false);
                    setTestWebhookResult(null);
                  }
                }}
                style={{
                  padding: '0.75rem 1.25rem',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  background: 'white',
                  color: '#374151',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: testWebhookSending ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!testWebhookUserId || testWebhookSending}
                onClick={async () => {
                  const selectedUser = users.find((u: any) => u.id === testWebhookUserId);
                  if (!selectedUser?.email) return;
                  setTestWebhookSending(true);
                  setTestWebhookResult(null);
                  try {
                    const result = await notificationService.testWebhook(selectedUser.email, selectedUser.name);
                    setTestWebhookResult(result);
                  } catch (err: any) {
                    setTestWebhookResult({ success: false, message: err?.response?.data?.message || err?.message || 'Request failed' });
                  } finally {
                    setTestWebhookSending(false);
                  }
                }}
                style={{
                  padding: '0.75rem 1.25rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: (!testWebhookUserId || testWebhookSending) ? '#9ca3af' : color,
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: (!testWebhookUserId || testWebhookSending) ? 'not-allowed' : 'pointer'
                }}
              >
                {testWebhookSending ? 'Sending...' : 'Send test'}
              </button>
            </div>
          </div>
        </div>
      )}

      <LiveChatPanel
        isOpen={showLiveChatPanel}
        onClose={() => {
          setShowLiveChatPanel(false);
          refreshUnreadChat();
        }}
        accentColor={color}
      />

      {selectedTaskForReview && (
        <SendForReviewModal
          isOpen={showReviewModal}
          taskTitle={selectedTaskForReview.title || ''}
          projectDeliverables={projects.find((p: any) => p.id === selectedTaskForReview.projectId)?.deliverables || []}
          taskDeliverableId={selectedTaskForReview.deliverableId}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedTaskForReview(null);
          }}
          onSubmit={handleReviewSubmit}
        />
      )}

      {/* Return to Origin Modal */}
      {showReturnModal && returningTask && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '2rem'
          }}
          onClick={() => {
            if (!returning) {
              setShowReturnModal(false);
              setReturningTask(null);
              setReturnData({ notes: '', links: '' });
            }
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 80px rgba(15, 23, 42, 0.35)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '1.5rem 2rem',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    margin: 0,
                    color: '#111827'
                  }}
                >
                  Return Task to Origin Department
                </h2>
                <p
                  style={{
                    margin: '0.25rem 0 0 0',
                    fontSize: '0.875rem',
                    color: '#6b7280'
                  }}
                >
                  Add any notes or links you want the origin department to see when reviewing this
                  work.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (returning) return;
                  setShowReturnModal(false);
                  setReturningTask(null);
                  setReturnData({ notes: '', links: '' });
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: returning ? 'not-allowed' : 'pointer',
                  padding: '0.5rem',
                  borderRadius: '999px',
                  color: '#6b7280'
                }}
              >
                <FaTimes />
              </button>
            </div>

            <div
              style={{
                padding: '1.75rem 2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                overflowY: 'auto'
              }}
            >
              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: '#eff6ff',
                  borderRadius: '10px',
                  border: '1px solid #bfdbfe',
                  fontSize: '0.875rem',
                  color: '#1d4ed8'
                }}
              >
                <strong>Task:</strong> {returningTask.title}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label
                  style={{
                    fontWeight: 600,
                    color: '#374151',
                    fontSize: '0.9375rem'
                  }}
                >
                  Notes (Optional)
                </label>
                <textarea
                  value={returnData.notes}
                  onChange={(e) =>
                    setReturnData({
                      ...returnData,
                      notes: e.target.value
                    })
                  }
                  rows={4}
                  disabled={returning}
                  placeholder="Explain what was done, any important decisions, or what you want the origin team to check."
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.9375rem',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label
                  style={{
                    fontWeight: 600,
                    color: '#374151',
                    fontSize: '0.9375rem'
                  }}
                >
                  Links / Documentation (Optional)
                </label>
                <textarea
                  value={returnData.links}
                  onChange={(e) =>
                    setReturnData({
                      ...returnData,
                      links: e.target.value
                    })
                  }
                  rows={3}
                  disabled={returning}
                  placeholder="Paste Drive links, Figma links, Looms, or any other relevant URLs here..."
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.9375rem',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>

            <div
              style={{
                padding: '1.5rem 2rem',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem'
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (returning) return;
                  setShowReturnModal(false);
                  setReturningTask(null);
                  setReturnData({ notes: '', links: '' });
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  background: 'white',
                  color: '#374151',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: returning ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReturnTaskToOrigin}
                disabled={returning}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: returning ? '#9ca3af' : color,
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: returning ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {returning ? (
                  <>
                    <FaSpinner className="spinner" />
                    Returning...
                  </>
                ) : (
                  'Return Task'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forward Task Modal - for AI Developer cross-department handoff */}
      {showForwardModal && forwardingTask && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '2rem'
          }}
          onClick={() => {
            if (!forwarding) {
              setShowForwardModal(false);
              setForwardingTask(null);
            }
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 80px rgba(15, 23, 42, 0.35)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '1.5rem 2rem',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    margin: 0,
                    color: '#111827'
                  }}
                >
                  Forward Task to Another Department
                </h2>
                <p
                  style={{
                    margin: '0.25rem 0 0 0',
                    fontSize: '0.875rem',
                    color: '#6b7280'
                  }}
                >
                  Share this AI task with another team along with your notes and links. A new task
                  will be created in their department.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (forwarding) return;
                  setShowForwardModal(false);
                  setForwardingTask(null);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: forwarding ? 'not-allowed' : 'pointer',
                  padding: '0.5rem',
                  borderRadius: '999px',
                  color: '#6b7280'
                }}
              >
                <FaTimes />
              </button>
            </div>

            <div
              style={{
                padding: '1.75rem 2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                overflowY: 'auto'
              }}
            >
              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: '#eff6ff',
                  borderRadius: '10px',
                  border: '1px solid #bfdbfe',
                  fontSize: '0.875rem',
                  color: '#1d4ed8'
                }}
              >
                <strong>Task:</strong> {forwardingTask.title}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label
                  style={{
                    fontWeight: 600,
                    color: '#374151',
                    fontSize: '0.9375rem'
                  }}
                >
                  Forward to Department *
                </label>
                <select
                  value={forwardData.targetDepartment}
                  onChange={(e) =>
                    setForwardData({
                      ...forwardData,
                      targetDepartment: e.target.value
                    })
                  }
                  disabled={forwarding}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.9375rem',
                    background: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">Select department...</option>
                  {departmentMenuItems
                    .filter((d) => d.id !== role)
                    .map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label
                  style={{
                    fontWeight: 600,
                    color: '#374151',
                    fontSize: '0.9375rem'
                  }}
                >
                  Notes (Optional)
                </label>
                <textarea
                  value={forwardData.notes}
                  onChange={(e) =>
                    setForwardData({
                      ...forwardData,
                      notes: e.target.value
                    })
                  }
                  rows={4}
                  disabled={forwarding}
                  placeholder="Explain what you need from the other department, context, expectations, etc."
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.9375rem',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label
                  style={{
                    fontWeight: 600,
                    color: '#374151',
                    fontSize: '0.9375rem'
                  }}
                >
                  Links / Documentation (Optional)
                </label>
                <textarea
                  value={forwardData.links}
                  onChange={(e) =>
                    setForwardData({
                      ...forwardData,
                      links: e.target.value
                    })
                  }
                  rows={3}
                  disabled={forwarding}
                  placeholder="Paste any Drive links, Looms, docs, or other URLs here..."
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.9375rem',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>

            <div
              style={{
                padding: '1.5rem 2rem',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem'
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (forwarding) return;
                  setShowForwardModal(false);
                  setForwardingTask(null);
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  background: 'white',
                  color: '#374151',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: forwarding ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleForwardTask}
                disabled={forwarding || !forwardData.targetDepartment}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  background:
                    forwarding || !forwardData.targetDepartment ? '#9ca3af' : color,
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor:
                    forwarding || !forwardData.targetDepartment
                      ? 'not-allowed'
                      : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {forwarding ? (
                  <>
                    <FaSpinner className="spinner" />
                    Forwarding...
                  </>
                ) : (
                  <>
                    <FaShareAlt />
                    Forward Task
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              padding: '2rem 2.5rem',
              borderBottom: '1px solid #f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#111827',
                margin: 0
              }}>
                Create New Task
              </h2>
              <button
                onClick={() => {
                  setShowAddTaskModal(false);
                  setNewTaskData({
                    projectId: '',
                    title: '',
                    description: '',
                    dueDate: '',
                    deliverableId: '',
                    assignedToId: ''
                  });
                  setTaskProjectScope('department');
                  setShowCustomDeliverableInput(false);
                  setCustomDeliverableName('');
                }}
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
                <FaTimes />
              </button>
            </div>

            <div style={{
              padding: '2rem 2.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}>
              <div>
                <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem', marginBottom: '0.5rem', display: 'block' }}>
                  Project *
                </label>
                {canCreateTasksForAllProjects && (
                  <div style={{ display: 'inline-flex', gap: '0.25rem', background: '#f3f4f6', padding: '0.2rem', borderRadius: '8px', marginBottom: '0.6rem' }}>
                    <button
                      type="button"
                      onClick={() => setTaskProjectScope('department')}
                      style={{
                        padding: '0.35rem 0.65rem',
                        border: 'none',
                        borderRadius: '6px',
                        background: taskProjectScope === 'department' ? color : 'transparent',
                        color: taskProjectScope === 'department' ? 'white' : '#4b5563',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Department Projects
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaskProjectScope('all')}
                      style={{
                        padding: '0.35rem 0.65rem',
                        border: 'none',
                        borderRadius: '6px',
                        background: taskProjectScope === 'all' ? color : 'transparent',
                        color: taskProjectScope === 'all' ? 'white' : '#4b5563',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      All Projects
                    </button>
                  </div>
                )}
                <select
                  value={newTaskData.projectId}
                  onChange={(e) => setNewTaskData({ ...newTaskData, projectId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.9375rem',
                    background: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">Select a project</option>
                  {taskModalProjectOptions.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.clientName}</option>
                  ))}
                </select>
                {canCreateTasksForAllProjects && (
                  <div style={{ marginTop: '0.45rem', fontSize: '0.75rem', color: '#6b7280' }}>
                    {taskProjectScope === 'all'
                      ? 'Showing all projects so you can seed this department with new tasks.'
                      : 'Showing projects currently connected to this department.'}
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem', marginBottom: '0.5rem', display: 'block' }}>
                  Task Title *
                </label>
                <input
                  type="text"
                  value={newTaskData.title}
                  onChange={(e) => setNewTaskData({ ...newTaskData, title: e.target.value })}
                  placeholder="Enter task title"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.9375rem'
                  }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem', marginBottom: '0.5rem', display: 'block' }}>
                  Description
                </label>
                <textarea
                  value={newTaskData.description}
                  onChange={(e) => setNewTaskData({ ...newTaskData, description: e.target.value })}
                  placeholder="Enter task description"
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.9375rem',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem', marginBottom: '0.5rem', display: 'block' }}>
                  Due Date
                </label>
                <input
                  type="date"
                  value={newTaskData.dueDate}
                  onChange={(e) => setNewTaskData({ ...newTaskData, dueDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.9375rem'
                  }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem', marginBottom: '0.5rem', display: 'block' }}>
                  Assign To
                </label>
                <select
                  value={newTaskData.assignedToId}
                  onChange={(e) => setNewTaskData({ ...newTaskData, assignedToId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.9375rem',
                    background: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">Unassigned</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{
              padding: '1.5rem 2.5rem',
              borderTop: '1px solid #f3f4f6',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem'
            }}>
              <button
                onClick={() => {
                  setShowAddTaskModal(false);
                  setNewTaskData({
                    projectId: '',
                    title: '',
                    description: '',
                    dueDate: '',
                    deliverableId: '',
                    assignedToId: ''
                  });
                  setTaskProjectScope('department');
                  setShowCustomDeliverableInput(false);
                  setCustomDeliverableName('');
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  background: 'white',
                  color: '#374151',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9375rem'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                disabled={creatingTask || !newTaskData.projectId || !newTaskData.title.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '8px',
                  background: creatingTask || !newTaskData.projectId || !newTaskData.title.trim() ? '#9ca3af' : color,
                  color: 'white',
                  cursor: creatingTask || !newTaskData.projectId || !newTaskData.title.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {creatingTask ? (
                  <>
                    <FaSpinner className="spinner" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FaPlus />
                    Create Task
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateProjectModal && (
        <CreateProjectModal
          onClose={() => setShowCreateProjectModal(false)}
          onSuccess={() => {
            setShowCreateProjectModal(false);
            loadData();
          }}
          onBulkSuccess={() => {
            setShowCreateProjectModal(false);
            loadData();
          }}
        />
      )}

      {/* Edit Task Modal - Similar structure to Add Task Modal */}
      {showEditTaskModal && editingTask && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              padding: '2rem 2.5rem',
              borderBottom: '1px solid #f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#111827',
                margin: 0
              }}>
                Edit Task
              </h2>
              <button
                onClick={() => {
                  setShowEditTaskModal(false);
                  setEditingTask(null);
                  setEditTaskData({
                    title: '',
                    description: '',
                    dueDate: '',
                    deliverableId: '',
                    assignedToId: ''
                  });
                  setShowEditCustomDeliverableInput(false);
                  setEditCustomDeliverableName('');
                }}
                style={{
                  padding: '0.5rem',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  color: '#6b7280'
                }}
              >
                <FaTimes />
              </button>
            </div>

            <div style={{
              padding: '2rem 2.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}>
              <div>
                <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem', marginBottom: '0.5rem', display: 'block' }}>
                  Task Title *
                </label>
                <input
                  type="text"
                  value={editTaskData.title}
                  onChange={(e) => setEditTaskData({ ...editTaskData, title: e.target.value })}
                  placeholder="Enter task title"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.9375rem'
                  }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem', marginBottom: '0.5rem', display: 'block' }}>
                  Description
                </label>
                <textarea
                  value={editTaskData.description}
                  onChange={(e) => setEditTaskData({ ...editTaskData, description: e.target.value })}
                  placeholder="Enter task description"
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.9375rem',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem', marginBottom: '0.5rem', display: 'block' }}>
                  Due Date
                </label>
                <input
                  type="date"
                  value={editTaskData.dueDate}
                  onChange={(e) => setEditTaskData({ ...editTaskData, dueDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.9375rem'
                  }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem', marginBottom: '0.5rem', display: 'block' }}>
                  Assign To
                </label>
                <select
                  value={editTaskData.assignedToId}
                  onChange={(e) => setEditTaskData({ ...editTaskData, assignedToId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.9375rem',
                    background: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">Unassigned</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{
              padding: '1.5rem 2.5rem',
              borderTop: '1px solid #f3f4f6',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem'
            }}>
              <button
                onClick={() => {
                  setShowEditTaskModal(false);
                  setEditingTask(null);
                  setEditTaskData({
                    title: '',
                    description: '',
                    dueDate: '',
                    deliverableId: '',
                    assignedToId: ''
                  });
                  setShowEditCustomDeliverableInput(false);
                  setEditCustomDeliverableName('');
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  background: 'white',
                  color: '#374151',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9375rem'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateTask}
                disabled={isUpdatingTaskInModal || !editTaskData.title.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '8px',
                  background: isUpdatingTaskInModal || !editTaskData.title.trim() ? '#9ca3af' : color,
                  color: 'white',
                  cursor: isUpdatingTaskInModal || !editTaskData.title.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {isUpdatingTaskInModal ? (
                  <>
                    <FaSpinner className="spinner" />
                    Updating...
                  </>
                ) : (
                  <>
                    <FaSave />
                    Update Task
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Task Modal - for team leads */}
      {showAssignModal && assigningTask && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '2rem'
          }}
          onClick={() => {
            if (!assigning) {
              setShowAssignModal(false);
              setAssigningTask(null);
              setAssignUserIds([]);
            }
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 80px rgba(15, 23, 42, 0.35)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '1.5rem 2rem',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    margin: 0,
                    color: '#111827'
                  }}
                >
                  {assigningTask.assignees?.length > 0 || assigningTask.assignedToId
                    ? 'Update Task Members'
                    : 'Assign Task Members'}
                </h2>
                <p
                  style={{
                    margin: '0.25rem 0 0 0',
                    fontSize: '0.875rem',
                    color: '#6b7280'
                  }}
                >
                  Select one or more team members from your department to assign this task to.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (assigning) return;
                  setShowAssignModal(false);
                  setAssigningTask(null);
                  setAssignUserIds([]);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: assigning ? 'not-allowed' : 'pointer',
                  padding: '0.5rem',
                  borderRadius: '999px',
                  color: '#6b7280'
                }}
              >
                <FaTimes />
              </button>
            </div>

            <div
              style={{
                padding: '1.75rem 2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                overflowY: 'auto'
              }}
            >
              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: '#eff6ff',
                  borderRadius: '10px',
                  border: '1px solid #bfdbfe',
                  fontSize: '0.875rem',
                  color: '#1d4ed8'
                }}
              >
                <strong>Task:</strong> {assigningTask.title}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label
                  style={{
                    fontWeight: 600,
                    color: '#374151',
                    fontSize: '0.9375rem'
                  }}
                >
                  Assign to Team Members * (Select multiple)
                </label>
                <div style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '10px',
                  padding: '0.75rem',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  background: '#ffffff'
                }}>
                  {getDepartmentUsers().length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                      No team members found in your department.
                    </p>
                  ) : (
                    getDepartmentUsers().map((teamMember: any) => (
                      <label
                        key={teamMember.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.625rem',
                          borderRadius: '6px',
                          cursor: assigning ? 'not-allowed' : 'pointer',
                          transition: 'background 0.2s',
                          opacity: assigning ? 0.6 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (!assigning) {
                            e.currentTarget.style.background = '#f9fafb';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={assignUserIds.includes(teamMember.id)}
                          onChange={() => toggleAssignee(teamMember.id)}
                          disabled={assigning}
                          style={{
                            width: '18px',
                            height: '18px',
                            cursor: assigning ? 'not-allowed' : 'pointer',
                            accentColor: color
                          }}
                        />
                        <span style={{ fontSize: '0.9375rem', color: '#374151', flex: 1 }}>
                          {teamMember.name} {teamMember.id === user?.id && <span style={{ color: '#6b7280' }}>(You)</span>}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                {assignUserIds.length > 0 && (
                  <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0 }}>
                    {assignUserIds.length} team member{assignUserIds.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            </div>

            <div
              style={{
                padding: '1.5rem 2rem',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem'
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (assigning) return;
                  setShowAssignModal(false);
                  setAssigningTask(null);
                  setAssignUserIds([]);
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  background: 'white',
                  color: '#374151',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: assigning ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignTask}
                disabled={assigning || assignUserIds.length === 0}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: assigning || assignUserIds.length === 0 ? '#9ca3af' : color,
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: assigning || assignUserIds.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {assigning ? (
                  <>
                    <FaSpinner className="spinner" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <FaUser />
                    {assignUserIds.length > 0 ? `Assign to ${assignUserIds.length} Member${assignUserIds.length > 1 ? 's' : ''}` : 'Assign Task'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <TaskDetailSideModal
        isOpen={!!(showTaskDetailModal && selectedTaskDetail)}
        task={selectedTaskDetail}
        onClose={handleCloseTaskDetail}
        allUsers={users}
        getProjectName={getProjectName}
        getProjectPmName={getProjectPmName}
        initialTab={taskDetailTab}
        footer={drawerFooter}
        onTaskDeleted={isTeamLead ? () => {
          notify('Task deleted.');
          loadData();
        } : undefined}
        onTaskUpdate={(updatedTask) => {
          setSelectedTaskDetail(updatedTask);
          setTasks((prev) => prev.map((t: any) => t.id === updatedTask?.id ? updatedTask : t));
        }}
      />

      {/* Status Change Modal (for drag and drop). Migrated to shared
          StatusChangeNotesModal — drag-only trigger preserved at L2616-2624;
          column-button click path stays silent (no modal). */}
      {showStatusChangeModal && statusChangeContext && (
        <StatusChangeNotesModal
          isOpen={true}
          targetColumnLabel={statusChangeContext.targetColumnLabel}
          notesRequired={false}
          attachmentMode="multi"
          saving={statusChangeLoading}
          onClose={() => {
            if (statusChangeLoading) return;
            setShowStatusChangeModal(false);
            setStatusChangeContext(null);
          }}
          onSave={async (notes, attachments) => {
            // handleStatusChangeFromDrag does its own loading toggle,
            // close-on-success, alert, and per-link addLinkAttachment
            // iteration. We just hand it the modal's collected values.
            await handleStatusChangeFromDrag(notes, attachments);
          }}
        />
      )}
      {showPrioritiesModal && (
        <div
          className="rd-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPrioritiesModal(false);
              setPrioritiesRefreshKey((n) => n + 1);
            }
          }}
        >
          <div className="rd-modal" role="dialog" aria-modal="true" aria-label="Today's priorities">
            <button
              type="button"
              className="rd-icon-btn rd-modal-close"
              aria-label="Close priorities"
              onClick={() => {
                setShowPrioritiesModal(false);
                setPrioritiesRefreshKey((n) => n + 1);
              }}
            >
              <FaTimes />
            </button>
            <DepartmentPriorityProjects
              taskType={config.taskType}
              departmentName={config.departmentName}
              color={color}
              tasks={tasks}
              projects={projects}
              canEditTeamOverride={canEditTeamOverride}
              onOpenTaskDetail={handleOpenTaskDetail}
              onEditTask={handleEditTask}
              onUpdateTaskColumn={async (taskId, columnId) => {
                await handleQuickMoveTaskToColumn(taskId, columnId);
              }}
            />
          </div>
        </div>
      )}

      {toast && <div className="rd-toast" role="status">{toast}</div>}
    </div>
  );
};

export default RoleDashboard;
