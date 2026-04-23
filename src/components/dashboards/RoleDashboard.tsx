import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaChevronDown,
  FaUser,
  FaBell,
  FaCog,
  FaSignOutAlt,
  FaClock,
  FaSpinner,
  FaHandPaper,
  FaStickyNote,
  FaTimes,
  FaPlus,
  FaCopy,
  FaPalette,
  FaCode,
  FaRobot,
  FaShareAlt,
  FaDatabase,
  FaSearch,
  FaEdit,
  FaSave,
  FaLink,
  FaComments,
  FaTicketAlt,
} from 'react-icons/fa';
import { authService } from '../../services/auth.service';
import { projectService } from '../../services/project.service';
import { taskService } from '../../services/task.service';
import { notificationService } from '../../services/notification.service';
import { deliverableService } from '../../services/deliverable.service';
import CreateProjectModal from '../CreateProjectModal';
import NotificationsModal from '../NotificationsModal';
import SubmitTicketModal from '../SubmitTicketModal';
import TicketsModal from '../TicketsModal';
import SendForReviewModal from '../SendForReviewModal';
import LiveChatPanel from '../LiveChatPanel';
import UserAvatar from '../UserAvatar';
import UserGreeting from '../UserGreeting';
import TaskDetailSideModal from '../TaskDetailSideModal';
import { useUnreadChatCount } from '../../hooks/useUnreadChatCount';
import DepartmentPriorityProjects from '../DepartmentPriorityProjects';
import '../Dashboard.css';

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
  const [filter, setFilter] = useState<'all' | 'my_tasks' | 'todo' | 'in_progress' | 'in_review' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'created'>('due_date');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const skipRefreshUntilRef = useRef<number | null>(null);
  const [deliverableHistory] = useState<Record<string, any[]>>({});
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
  const [statusChangeNotes, setStatusChangeNotes] = useState('');
  const [statusChangeLinks, setStatusChangeLinks] = useState<string[]>(['']);
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

  // Define close handler early so it can be used across handlers
  const handleCloseTaskDetail = useCallback(() => {
    setShowTaskDetailModal(false);
    setSelectedTaskDetail(null);
  }, []);

  const loadData = async () => {
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
      setLoading(false);
    }
  };

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
      alert('Please select a target department to forward this task to.');
      return;
    }

    const targetTaskType = getTaskTypeForDepartment(forwardData.targetDepartment);
    if (!targetTaskType) {
      alert('Selected department is not configured for tasks yet.');
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
      alert(`Task forwarded to ${deptName}. A new task has been created in that department.`);
    } catch (error) {
      console.error('Failed to forward task:', error);
      alert('Failed to forward task. Please try again.');
    } finally {
      setForwarding(false);
    }
  };

  const handleReturnTaskToOrigin = async () => {
    if (!returningTask) return;
    const linked = getLinkedOriginInfo(returningTask);
    if (!linked?.originTaskId) {
      alert('Linked origin task not found for this forwarded task.');
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
      alert(`Task returned to ${linked.originDepartmentName || 'origin department'} for approval.`);
    } catch (error) {
      console.error('Failed to return task to origin department:', error);
      alert('Failed to return task. Please try again.');
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
      alert('Linked department task not found for this task.');
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
      alert(`Marked for revision and sent back to ${linked.targetDepartmentName || 'linked department'}.`);
    } catch (error) {
      console.error('Failed to send task back for revision:', error);
      alert('Failed to send back for revision. Please try again.');
    } finally {
      setUpdatingTask(null);
    }
  };

  const handleReviewSubmit = async (driveLinks: string[], deliverableType: string, deliverableId?: string) => {
    if (!selectedTaskForReview || driveLinks.length === 0) return;
    
    try {
      setUpdatingTask(selectedTaskForReview.id);
      const primaryLink = driveLinks[0];
      await taskService.updateStatus(selectedTaskForReview.id, 'In Review', false, primaryLink, deliverableType, deliverableId);
      if (driveLinks.length > 1) {
        const extraLinksBlock = `\n\n--- Additional Links ---\n${driveLinks.slice(1).map((l) => `- ${l.trim()}`).join('\n')}`;
        const currentDesc = selectedTaskForReview.description || '';
        await taskService.update(selectedTaskForReview.id, { description: currentDesc + extraLinksBlock });
      }
      await loadData();
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
      alert('Please select at least one team member to assign this task to.');
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
      alert(`Task assigned to ${assignUserIds.length} team member(s) successfully!`);
    } catch (error) {
      console.error('Failed to assign task:', error);
      alert('Failed to assign task. Please try again.');
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
      alert('Unable to copy task link.');
      return;
    }
    const taskUrl = `${window.location.origin}/project/${task.projectId}?task=${task.id}&tab=details`;
    try {
      await navigator.clipboard.writeText(taskUrl);
      alert('Task link copied!');
    } catch (error) {
      console.error('Failed to copy task link:', error);
      alert('Failed to copy task link.');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- used by NotificationsModal onOpenTaskConversation
  const handleOpenTaskConversationFromNotification = async (projectId: string, taskId: string) => {
    try {
      const task = await taskService.getOne(taskId);
      handleOpenTaskDetail(task, 'conversation');
    } catch (error) {
      console.error('Failed to load task:', error);
      navigate(`/project/${projectId}?task=${taskId}&tab=conversation`);
    }
  };

  const getFilteredAndSortedTasks = () => {
    let filtered = tasks;

    if (filter === 'my_tasks') {
      filtered = filtered.filter((t: any) => t.assignedToId === user?.id);
    } else if (filter === 'todo') {
      filtered = filtered.filter((t: any) => t.status === 'Todo' && !t.isCompleted);
    } else if (filter === 'in_progress') {
      filtered = filtered.filter((t: any) => t.status === 'In Progress');
    } else if (filter === 'in_review') {
      filtered = filtered.filter((t: any) => t.status === 'In Review');
    } else if (filter === 'completed') {
      filtered = filtered.filter((t: any) => t.isCompleted);
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter((t: any) => {
        const project = projects.find((p: any) => p.id === t.projectId);
        const projectName = project?.clientName || '';
        return (
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          projectName.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
    }

    filtered = [...filtered].sort((a: any, b: any) => {
      if (sortBy === 'due_date') {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      } else if (sortBy === 'priority') {
        const priorityOrder: Record<string, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      } else {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  };


  const getGroupedTasks = useMemo(() => {
    const filtered = getFilteredAndSortedTasks();
    
    // Get task status for Kanban columns - comprehensive status handling
    const getTaskStatus = (task: any): string => {
      // Completed always goes to Approved/Completed
      if (task.status === 'Completed' || task.isCompleted) {
        return 'approved_completed';
      }

      const desc: string = task.description || '';

      // Column markers in description (for In Review sub-states)
      if (desc.includes('--- Column: Revision ---')) return 'revision';
      if (desc.includes('--- Column: Elliot Review ---')) return 'elliot_review';
      if (desc.includes('--- Column: QA Review ---')) return 'qa_before_client';
      if (desc.includes('--- Column: Client Validation ---')) return 'client_validation';
      if (desc.includes('--- Column: Client Review ---')) return 'client_validation';
      if (desc.includes('--- Column: For Approval ---')) return 'for_approval';

      if (task.assignedToId) {
        if (task.status === 'In Progress') {
          return 'owned_in_progress';
        }
        if (task.status === 'In Review') {
          // In Review with no marker defaults to For Approval
          return 'for_approval';
        }
        if (task.status === 'Revision' || task.status === 'Needs Revision') {
          return 'revision';
        }
        if (task.status === 'Elliot Review') {
          return 'elliot_review';
        }
        if (task.status === 'QA Review' || task.status === 'QA') {
          return 'qa_before_client';
        }
        if (task.status === 'Client Review' || task.status === 'Client Validation') {
          return 'client_validation';
        }
        return 'owned_in_progress';
      }
      
      return 'not_started';
    };

    const grouped: Record<string, any[]> = {
      'not_started': [],
      'owned_in_progress': [],
      'for_approval': [],
      'revision': [],
      'elliot_review': [],
      'approved_completed': [],
      'qa_before_client': [],
      'client_validation': []
    };
    
    for (let i = 0; i < filtered.length; i++) {
      const task = filtered[i];
      const status = getTaskStatus(task);
      const group = grouped[status];
      if (group) {
        group.push(task);
      }
    }
    
    return grouped;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, filter, sortBy, user?.id, projects, searchQuery]);

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
      if (daysLeft >= 1 && daysLeft <= 5) {
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

  const { departmentName, color } = config;

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
      alert('Please enter a task title');
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
      alert('Task updated successfully!');
    } catch (error) {
      console.error('Failed to update task:', error);
      alert('Failed to update task. Please try again.');
    } finally {
      setIsUpdatingTaskInModal(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskData.projectId || !newTaskData.title.trim()) {
      alert('Please select a client and enter a task title');
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
      alert('Task created successfully!');
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('Failed to create task. Please try again.');
    } finally {
      setCreatingTask(false);
    }
  };

  const getTaskBorderColor = (status: string, isCompleted: boolean, taskInRevision: boolean) => {
    if (taskInRevision) return '#dc2626';
    if (isCompleted) return '#10b981';
    if (status === 'In Review') return '#f59e0b';
    if (status === 'In Progress') return '#3b82f6';
    if (status === 'Blocked') return '#ef4444';
    return '#e5e7eb';
  };

  const hasRevisionDeliverables = (project: any) => {
    return project.deliverables?.some((d: any) => 
      ['Brand Book', 'Copy of Home Page', 'Home Page', 'Speaker Kit', 'Other'].includes(d.type) &&
      d.status === 'Revision'
    );
  };

  const isTaskInRevision = (task: any, project: any) => {
    if (task.deliverableId) {
      const deliverable = project.deliverables?.find((d: any) => d.id === task.deliverableId);
      if (deliverable) {
        if (deliverable.status === 'Revision') {
          return true;
        }
        
        const history = deliverableHistory[deliverable.id] || [];
        if (history.length > 0) {
          if (task.status === 'In Review') {
            return false;
          }
          
          if (task.fileUrl) {
            const fileHistory = history.filter((h: any) => h.fileUrl === task.fileUrl);
            if (fileHistory.length > 0) {
              const latestFileHistory = fileHistory[0];
              if (latestFileHistory.action === 'Revision Requested') {
                return true;
              }
            }
          }
          
          const revisionHistory = history.filter((h: any) => h.action === 'Revision Requested');
          if (revisionHistory.length > 0) {
            const latestRevision = revisionHistory[0];
            if (!task.fileUrl || !latestRevision.fileUrl || latestRevision.fileUrl === task.fileUrl) {
              return true;
            }
          }
        }
      }
    }
    return false;
  };

  const getTaskNotes = (task: any, project: any) => {
    if (!task.deliverableId) return [];
    
    const deliverable = project.deliverables?.find((d: any) => d.id === task.deliverableId);
    if (!deliverable) return [];
    
    const history = deliverableHistory[deliverable.id] || [];
    const taskNotes: any[] = [];
    
    history.forEach((h: any) => {
      if (h.notes && h.notes.trim() && h.action === 'Revision Requested') {
        if (task.fileUrl) {
          if (h.fileUrl === task.fileUrl) {
            taskNotes.push({
              ...h,
              deliverableType: deliverable.type || deliverable.customType,
              deliverableId: deliverable.id,
            });
          }
        } else {
          if (!h.fileUrl) {
            taskNotes.push({
              ...h,
              deliverableType: deliverable.type || deliverable.customType,
              deliverableId: deliverable.id,
            });
          }
        }
      }
    });
    
    return taskNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

  // Handle status change from drag and drop modal
  const handleStatusChangeFromDrag = async () => {
    if (!statusChangeContext) return;
    
    try {
      setStatusChangeLoading(true);
      const task = tasks.find((t: any) => t.id === statusChangeContext.taskId);
      if (!task) return;

      const { status, columnMarker, isCompleted } = mapColumnToStatus(statusChangeContext.targetColumnId);

      // Update task status
      await taskService.updateStatus(statusChangeContext.taskId, status, isCompleted);

      // Build a single description update so marker + log stay in sync.
      const baseDesc = (task.description || '').replace(/\n\n--- Column: [^-]+ ---/g, '');
      const descWithMarker = columnMarker ? `${baseDesc}${columnMarker}` : baseDesc;
      const timestamp = new Date().toLocaleString();
      let logBlock = `\n\n--- Status Change ---\nNew Column: ${statusChangeContext.targetColumnLabel}\nBy: ${user?.name || 'Unknown'}\nAt: ${timestamp}`;
      
      if (statusChangeNotes && statusChangeNotes.trim()) {
        logBlock += `\nNotes: ${statusChangeNotes.trim()}`;
      }
      
      const validLinks = statusChangeLinks.filter(link => link.trim());
      if (validLinks.length > 0) {
        logBlock += `\nAttachments:\n${validLinks.map(link => `- ${link.trim()}`).join('\n')}`;
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
      setStatusChangeNotes('');
      setStatusChangeLinks(['']);
      
      alert(`Task moved to ${statusChangeContext.targetColumnLabel} ✓`);
    } catch (error) {
      console.error('Failed to update task status:', error);
      alert('Failed to update task status. Please try again.');
    } finally {
      setStatusChangeLoading(false);
    }
  };



  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <FaSpinner className="spinner" style={{
            fontSize: '3rem',
            marginBottom: '1rem',
            animation: 'spin 1s linear infinite'
          }} />
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            margin: '0 0 0.5rem 0',
            color: 'white'
          }}>
            Loading {departmentName}
          </h2>
          <p style={{
            fontSize: '1rem',
            margin: 0,
            opacity: 0.9,
            animation: 'pulse 2s ease-in-out infinite'
          }}>
            Fetching projects and tasks...
          </p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.9; }
            50% { opacity: 0.6; }
          }
        `}</style>
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
  const groupedTasks = getGroupedTasks; // This is already a useMemo result, use it directly
  const isAIDeveloper = config.taskType === 'AI';
  const isTeamLead = hasBoardManagementAccess;
  const canCreateProjects = Boolean(user?.isHeadPM || isTeamLead || user?.role === 'FOUNDER/CEO');

  // Continue with the rest of the component JSX...
  // Due to size limits, I'll create a simplified version that includes the key parts
  // The full JSX structure would be identical to CopyDashboard but using config values

  return (
    <div className="dashboard premium" style={{ display: 'flex', minHeight: '100vh', padding: 0 }}>
      {/* Sidebar */}
      <div
        className="role-dashboard-sidebar"
        style={{
          width: '280px',
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.12)',
          zIndex: 100
        }}
      >
        {/* Sidebar Header */}
        <div style={{
          padding: '2rem 1.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          background: `linear-gradient(135deg, ${color}15 0%, ${color}25 100%)`
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'white',
            margin: '0 0 0.5rem 0',
            letterSpacing: '-0.02em'
          }}>
            {departmentName}
          </h2>
          
        </div>

        {/* Department List - Only show current role */}
        <div style={{
          padding: '1rem 0.75rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {departmentMenuItems.filter(item => item.id === role).map((item) => {
            const Icon = item.icon;
            
            return (
              <div
                key={item.id}
                style={{
                  width: '100%',
                  padding: '1rem 1.25rem',
                  marginBottom: '0.5rem',
                  border: 'none',
                  borderRadius: '12px',
                  background: `linear-gradient(135deg, ${item.color}15 0%, ${item.color}25 100%)`,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  position: 'relative',
                  textAlign: 'left',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  boxShadow: `0 4px 12px ${item.color}30`,
                  borderLeft: `3px solid ${item.color}`
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: `linear-gradient(135deg, ${item.color} 0%, ${item.color}dd 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: `0 4px 12px ${item.color}40`
                }}>
                  <Icon style={{
                    fontSize: '1.125rem',
                    color: 'white'
                  }} />
                </div>
                <span style={{
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {item.name}
                </span>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: item.color,
                  boxShadow: `0 0 8px ${item.color}`,
                  animation: 'pulse-dot 2s ease-in-out infinite'
                }} />
              </div>
            );
          })}
        </div>

        {/* My Projects Section */}
        <div
          className="role-dashboard-sidebar-projects"
          style={{
            flex: 1,
            padding: '1rem 0.75rem',
            overflowY: 'auto',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div style={{
            padding: '0.5rem 0.75rem',
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: 0
            }}>
              My Projects
            </h3>
            <button
              onClick={() => navigate('/my-projects')}
              style={{
                padding: '0.25rem 0.5rem',
                border: 'none',
                borderRadius: '6px',
                background: `${color}33`,
                color: 'rgba(255, 255, 255, 0.9)',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${color}4d`;
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${color}33`;
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
              }}
            >
              View All
            </button>
          </div>
          {(() => {
            const myProjectIds = new Set(
              myTasks.map((t: any) => t.projectId)
            );
            const myProjectsList = projects.filter((p: any) => myProjectIds.has(p.id));
            
            if (myProjectsList.length === 0) {
              return (
                <div style={{
                  padding: '1rem',
                  textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontSize: '0.8125rem'
                }}>
                  No projects yet
                </div>
              );
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {myProjectsList.map((project: any) => {
                  const projectTasks = myTasks.filter((t: any) => t.projectId === project.id);
                  const inProgressCount = projectTasks.filter((t: any) => t.status === 'In Progress').length;
                  const inReviewCount = projectTasks.filter((t: any) => t.status === 'In Review').length;
                  const completedCount = projectTasks.filter((t: any) => t.isCompleted).length;
                  
                  return (
                    <button
                      key={project.id}
                      onClick={() => navigate(`/project/${project.id}`)}
                      style={{
                        width: '100%',
                        padding: '0.875rem 1rem',
                        border: 'none',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'rgba(255, 255, 255, 0.9)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                        borderLeft: '2px solid transparent'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.borderLeftColor = color;
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.borderLeftColor = 'transparent';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <div style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'white',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {project.clientName}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        fontSize: '0.75rem',
                        color: 'rgba(255, 255, 255, 0.6)'
                      }}>
                        {inProgressCount > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6' }}></span>
                            {inProgressCount} in progress
                          </span>
                        )}
                        {inReviewCount > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }}></span>
                            {inReviewCount} in review
                          </span>
                        )}
                        {completedCount > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                            {completedCount} done
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Sidebar Footer */}
        <div style={{
          padding: '1.5rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <button
            onClick={() => navigate('/forum')}
            style={{
              width: '100%',
              padding: '0.875rem 1rem',
              border: `1px solid ${color}`,
              borderRadius: '10px',
              background: `${color}20`,
              color: 'rgba(255, 255, 255, 0.95)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${color}40`;
              e.currentTarget.style.borderColor = color;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `${color}20`;
              e.currentTarget.style.borderColor = color;
            }}
          >
            <FaStickyNote style={{ fontSize: '0.875rem' }} />
            Forum
          </button>
          <button
            onClick={() => navigate('/timeline')}
            style={{
              width: '100%',
              padding: '0.875rem 1rem',
              border: `1px solid ${color}`,
              borderRadius: '10px',
              background: `${color}20`,
              color: 'rgba(255, 255, 255, 0.95)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${color}40`;
              e.currentTarget.style.borderColor = color;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `${color}20`;
              e.currentTarget.style.borderColor = color;
            }}
          >
            <FaClock style={{ fontSize: '0.875rem' }} />
            My Timeline
          </button>
          {isAIDeveloper && (
            <button
              onClick={() => setShowTicketsModal(true)}
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                border: `1px solid ${color}`,
                borderRadius: '10px',
                background: `${color}20`,
                color: 'rgba(255, 255, 255, 0.95)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${color}40`;
                e.currentTarget.style.borderColor = color;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${color}20`;
                e.currentTarget.style.borderColor = color;
              }}
            >
              <FaTicketAlt style={{ fontSize: '0.875rem' }} />
              Tickets
            </button>
          )}
          {isTeamLead && (
            <button
              onClick={() => navigate('/pm-dashboard')}
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'rgba(255, 255, 255, 0.9)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              ← See Full Dashboard
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Navigation Bar */}
        <div style={{
          background: 'white',
          borderBottom: '1px solid #e5e7eb',
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flex: 1 }}>
            <UserGreeting userName={user?.name} accentColor={color} compact />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => setShowLiveChatPanel(true)}
              style={{
                position: 'relative',
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
              title="Live Chat"
            >
              <FaComments style={{ fontSize: '1.25rem' }} />
              {unreadChatCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '0.25rem',
                  right: '0.25rem',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 600
                }}>
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowNotificationsModal(true)}
              style={{
                position: 'relative',
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
              <FaBell style={{ fontSize: '1.25rem' }} />
              {unreadNotifications > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '0.25rem',
                  right: '0.25rem',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 600
                }}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </button>
            {isAIDeveloper && (
              <button
                onClick={() => {
                  setShowTestWebhookModal(true);
                  setTestWebhookUserId('');
                  setTestWebhookResult(null);
                }}
                style={{
                  padding: '0.5rem 0.75rem',
                  border: `1px solid ${color}`,
                  background: 'transparent',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  color: color,
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${color}15`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
                title="Send test notification to webhook (n8n)"
              >
                Test webhook
              </button>
            )}

            <div className="avatar-dropdown-container" style={{ position: 'relative' }}>
              <button
                onClick={() => setShowAvatarDropdown(!showAvatarDropdown)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <UserAvatar
                  name={user?.name}
                  avatarUrl={user?.avatarUrl}
                  size={36}
                  color={color}
                />
                <span style={{ color: '#111827', fontWeight: 500, fontSize: '0.875rem' }}>
                  {user?.name}
                </span>
                <FaChevronDown style={{ color: '#6b7280', fontSize: '0.75rem' }} />
              </button>

              {showAvatarDropdown && (
                <div ref={dropdownRef} style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                  minWidth: '200px',
                  zIndex: 1000,
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '0.75rem' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', marginBottom: '0.25rem' }}>
                      {user?.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {user?.role}
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid #e5e7eb' }}>
                    <button
                      onClick={() => navigate('/profile')}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        color: '#374151',
                        fontSize: '0.875rem',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f9fafb';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <FaUser style={{ fontSize: '0.875rem' }} />
                      Profile
                    </button>
                    <button
                      onClick={() => {
                        setShowAvatarDropdown(false);
                        navigate('/timeline');
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        color: '#374151',
                        fontSize: '0.875rem',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f9fafb';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <FaClock style={{ fontSize: '0.875rem' }} />
                      My Timeline
                    </button>
                    <button
                      onClick={() => {
                        setShowAvatarDropdown(false);
                        setShowSubmitTicketModal(true);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        color: '#374151',
                        fontSize: '0.875rem',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f9fafb';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <FaTicketAlt style={{ fontSize: '0.875rem' }} />
                      Submit Ticket
                    </button>
                    <button
                      onClick={() => navigate('/settings')}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        color: '#374151',
                        fontSize: '0.875rem',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f9fafb';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <FaCog style={{ fontSize: '0.875rem' }} />
                      Settings
                    </button>
                    <button
                      onClick={handleLogout}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        color: '#ef4444',
                        fontSize: '0.875rem',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fef2f2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <FaSignOutAlt style={{ fontSize: '0.875rem' }} />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div style={{
          background: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          padding: '1.5rem 2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            <FaSearch style={{ color: '#9ca3af', fontSize: '1rem' }} />
            <input
              type="text"
              placeholder="Search tasks or projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: '0.625rem 1rem',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: 'white',
                outline: 'none',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = color;
                e.target.style.boxShadow = `0 0 0 3px ${color}20`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              style={{
                padding: '0.625rem 1rem',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: 'white',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="all">All Tasks</option>
              <option value="my_tasks">My Tasks</option>
              <option value="todo">Todo</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="completed">Completed</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                padding: '0.625rem 1rem',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: 'white',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="due_date">Sort by Due Date</option>
              <option value="priority">Sort by Priority</option>
              <option value="created">Sort by Created</option>
            </select>

            <div style={{ display: 'flex', gap: '0.25rem', background: 'white', padding: '0.25rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <button
                onClick={() => setViewMode('kanban')}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '6px',
                  background: viewMode === 'kanban' ? color : 'transparent',
                  color: viewMode === 'kanban' ? 'white' : '#6b7280',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
              >
                Kanban
              </button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '6px',
                  background: viewMode === 'list' ? color : 'transparent',
                  color: viewMode === 'list' ? 'white' : '#6b7280',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
              >
                List
              </button>
            </div>

            <button
              onClick={() => {
                setTaskProjectScope('department');
                setShowAddTaskModal(true);
              }}
              style={{
                padding: '0.625rem 1.25rem',
                border: 'none',
                borderRadius: '8px',
                background: color,
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <FaPlus />
              Add Task
            </button>

            {canCreateProjects && (
              <button
                onClick={() => setShowCreateProjectModal(true)}
                style={{
                  padding: '0.625rem 1.25rem',
                  border: `1px solid ${color}`,
                  borderRadius: '8px',
                  background: 'white',
                  color: color,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${color}15`;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                title="Create project (head access)"
              >
                <FaPlus />
                Create Project
              </button>
            )}

            {isTeamLead && viewMode === 'list' && (
              <button
                onClick={async () => {
                  if (selectedTaskIds.length === 0) return;
                  const confirmed = window.confirm(
                    `Delete ${selectedTaskIds.length} selected task${selectedTaskIds.length > 1 ? 's' : ''}? This cannot be undone.`
                  );
                  if (!confirmed) return;

                  try {
                    // Mark as updating to block other actions while deleting
                    setUpdatingTask('bulk-delete');

                    // Delete all selected tasks in parallel so failures surface clearly
                    await Promise.all(
                      selectedTaskIds.map((id) =>
                        taskService.delete(id).catch((error) => {
                          console.error('Failed to delete task in bulk operation:', error);
                          throw error;
                        })
                      )
                    );

                    await loadData();
                    setSelectedTaskIds([]);
                    alert(`Deleted ${selectedTaskIds.length} task${selectedTaskIds.length > 1 ? 's' : ''}.`);
                  } catch (error) {
                    console.error('Failed to bulk delete tasks:', error);
                    alert('Failed to delete the selected tasks. Please check the console for details or try again.');
                  } finally {
                    setUpdatingTask(null);
                  }
                }}
                disabled={selectedTaskIds.length === 0 || updatingTask === 'bulk-delete'}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: selectedTaskIds.length === 0 ? '#e5e7eb' : '#fee2e2',
                  color: selectedTaskIds.length === 0 ? '#9ca3af' : '#b91c1c',
                  cursor:
                    selectedTaskIds.length === 0 || updatingTask === 'bulk-delete'
                      ? 'not-allowed'
                      : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
              >
                {updatingTask === 'bulk-delete'
                  ? 'Deleting selected...'
                  : `Delete Selected (${selectedTaskIds.length})`}
              </button>
            )}
          </div>
        </div>

        {taskDueAlerts.length > 0 && (
          <div style={{
            margin: '0.85rem 2rem 0',
            padding: '1rem 1.1rem',
            borderRadius: '14px',
            border: '1px solid #fca5a5',
            background: 'linear-gradient(135deg, #fff1f2 0%, #fffbeb 100%)',
            boxShadow: '0 10px 28px rgba(239, 68, 68, 0.18)',
            animation: 'taskDuePulse 1.8s ease-in-out infinite',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <style>{`
              @keyframes taskDuePulse {
                0%, 100% { box-shadow: 0 10px 28px rgba(239, 68, 68, 0.18); }
                50% { box-shadow: 0 16px 34px rgba(239, 68, 68, 0.3); }
              }
            `}</style>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #ef4444 0%, #f97316 100%)',
            }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1rem' }}>🚨</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#991b1b' }}>
                  Task Due Alarm
                </div>
              </div>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#9a3412',
                background: '#ffedd5',
                border: '1px solid #fdba74',
                borderRadius: '999px',
                padding: '0.2rem 0.6rem',
              }}>
                {taskDueAlerts.length} due soon
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#7f1d1d', marginTop: '0.3rem', marginBottom: '0.6rem', fontWeight: 600 }}>
              1-2 days = Critical · 3-5 days = High
            </div>
            <div style={{ marginTop: '0.6rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {(showAllTaskDueAlerts ? taskDueAlerts : taskDueAlerts.slice(0, 8)).map((item) => (
                <button
                  key={item.taskId}
                  type="button"
                  onClick={() => navigate(`/project/${item.projectId}?task=${item.taskId}&tab=details`)}
                  style={{
                    border: item.daysLeft <= 2 ? '1px solid #ef4444' : '1px solid #f97316',
                    borderRadius: '10px',
                    background: item.daysLeft <= 2 ? '#fef2f2' : '#fff7ed',
                    color: item.daysLeft <= 2 ? '#b91c1c' : '#c2410c',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.4rem 0.65rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    maxWidth: '360px',
                    textAlign: 'left',
                    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
                  }}
                  title={`Due ${item.dueDate.toLocaleDateString()}`}
                >
                  <span style={{
                    fontSize: '0.65rem',
                    borderRadius: '999px',
                    padding: '0.15rem 0.45rem',
                    background: item.daysLeft <= 2 ? '#ef4444' : '#f97316',
                    color: 'white',
                    flexShrink: 0,
                  }}>
                    {item.daysLeft}d
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.projectName} · {item.taskTitle}
                  </span>
                </button>
              ))}
              {taskDueAlerts.length > 8 && !showAllTaskDueAlerts && (
                <button
                  type="button"
                  onClick={() => setShowAllTaskDueAlerts(true)}
                  style={{
                    fontSize: '0.75rem',
                    color: '#9a3412',
                    fontWeight: 700,
                    padding: '0.34rem 0.6rem',
                    borderRadius: '999px',
                    border: '1px solid #fdba74',
                    background: '#fff7ed',
                    cursor: 'pointer',
                  }}
                >
                  +{taskDueAlerts.length - 8} more
                </button>
              )}
              {taskDueAlerts.length > 8 && showAllTaskDueAlerts && (
                <button
                  type="button"
                  onClick={() => setShowAllTaskDueAlerts(false)}
                  style={{
                    fontSize: '0.75rem',
                    color: '#9a3412',
                    fontWeight: 700,
                    padding: '0.34rem 0.6rem',
                    borderRadius: '999px',
                    border: '1px solid #fdba74',
                    background: '#fff7ed',
                    cursor: 'pointer',
                  }}
                >
                  Show less
                </button>
              )}
            </div>
          </div>
        )}

        {/* Task Content Area */}
        <div style={{
          flex: 1,
          padding: '2rem',
          overflowY: 'auto',
          background: '#f9fafb'
        }}>
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

          {viewMode === 'kanban' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(280px, 1fr))',
              gridAutoRows: 'minmax(400px, 1fr)',
              gap: '1.5rem',
              paddingBottom: '1rem',
              paddingTop: '0.5rem',
              width: '100%',
              minHeight: '500px',
              gridAutoFlow: 'row',
              alignItems: 'stretch'
            }}>
              {[
                { id: 'not_started', title: 'Not yet started', color: '#6b7280' },
                { id: 'owned_in_progress', title: 'Owned/In Progress', color: '#3b82f6' },
                { id: 'for_approval', title: 'For Approval', color: '#f59e0b' },
                { id: 'revision', title: 'Revision', color: '#ef4444' },
                // { id: 'elliot_review', title: 'Elliot Review', color: '#8b5cf6' },
                { id: 'approved_completed', title: 'Approved/Completed', color: '#10b981' },
                { id: 'qa_before_client', title: 'QA Before Sending to Client', color: '#06b6d4' },
                { id: 'client_validation', title: 'Client Validation', color: '#f97316' }
              ].map((column) => {
                const statusTasks = groupedTasks[column.id] || [];
                const sortOrder = kanbanColumnSort[column.id] ?? 'newest';
                const sortedStatusTasks = sortKanbanTasksByCreatedAt(statusTasks, sortOrder);

                return (
                  <div 
                    key={column.id} 
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverColumn(column.id);
                    }}
                    onDragLeave={() => setDragOverColumn(null)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setDragOverColumn(null);
                      if (!draggedTask) return;
                      
                      const task = tasks.find((t: any) => t.id === draggedTask);
                      if (!task) return;
                      
                      // Map column ID to status label
                      const columnLabelMap: Record<string, string> = {
                        'not_started': 'Not Yet Started',
                        'owned_in_progress': 'Owned/In Progress',
                        'for_approval': 'For Approval',
                        'revision': 'Revision',
                        'elliot_review': 'Elliot Review',
                        'approved_completed': 'Approved/Completed',
                        'qa_before_client': 'QA Before Sending to Client',
                        'client_validation': 'Client Validation',
                      };
                      
                      const targetLabel = columnLabelMap[column.id] || column.title;
                      
                      // Open modal to capture notes and links
                      setStatusChangeContext({
                        taskId: draggedTask,
                        targetColumnId: column.id,
                        targetColumnLabel: targetLabel,
                      });
                      setStatusChangeNotes('');
                      setStatusChangeLinks(['']);
                      setShowStatusChangeModal(true);
                      setDraggedTask(null);
                    }}
                    style={{
                      width: '100%',
                      minWidth: '280px',
                      maxWidth: '100%',
                      background: 'white',
                      borderRadius: '12px',
                      boxShadow: dragOverColumn === column.id ? '0 4px 12px rgba(99,102,241,0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
                      border: dragOverColumn === column.id ? '2px solid #6366f1' : '2px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.2s',
                      minHeight: '400px',
                      maxHeight: 'calc(100vh - 300px)',
                      position: 'relative'
                    }}
                  >
                    <div style={{
                      padding: '1rem',
                      background: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      borderRadius: '12px 12px 0 0'
                    }}>
                      <h3 style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: '#1e293b',
                        margin: '0 0 0.25rem 0'
                      }}>
                        {column.title}
                      </h3>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        marginTop: '0.35rem',
                      }}>
                        <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                          {statusTasks.length} task(s)
                        </span>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.75rem',
                          color: '#64748b',
                          fontWeight: 500,
                          margin: 0,
                          cursor: 'pointer',
                        }}>
                          <span style={{ whiteSpace: 'nowrap' }}>Sort</span>
                          <select
                            value={sortOrder}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const v = e.target.value as KanbanColumnSortOrder;
                              setKanbanColumnSort((prev) => ({ ...prev, [column.id]: v }));
                            }}
                            style={{
                              padding: '0.2rem 0.4rem',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              fontSize: '0.75rem',
                              color: '#334155',
                              background: 'white',
                              cursor: 'pointer',
                              maxWidth: '140px',
                            }}
                          >
                            <option value="newest">Newest → oldest</option>
                            <option value="oldest">Oldest → newest</option>
                          </select>
                        </label>
                      </div>
                    </div>
                    <div style={{
                      padding: '0.75rem',
                      flex: 1,
                      overflowY: 'auto',
                      minHeight: '200px',
                      maxHeight: 'calc(100vh - 400px)'
                    }}>
                      {sortedStatusTasks.map((task: any) => {
                        const project = projects.find((p: any) => p.id === task.projectId);
                        const taskInRevision = project ? isTaskInRevision(task, project) : false;
                        const taskNotes = project ? getTaskNotes(task, project) : [];
                        const borderColor = getTaskBorderColor(task.status, task.isCompleted, taskInRevision);
                        const linkedOrigin = getLinkedOriginInfo(task);
                        const linkedTarget = getLinkedTargetInfo(task);

                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => {
                              setDraggedTask(task.id);
                              e.dataTransfer.effectAllowed = 'move';
                              const target = e.target as HTMLElement;
                              if (target.closest('.kanban-task-card')) {
                                (target.closest('.kanban-task-card') as HTMLElement).style.opacity = '0.5';
                              }
                            }}
                            onDragEnd={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.closest('.kanban-task-card')) {
                                (target.closest('.kanban-task-card') as HTMLElement).style.opacity = '1';
                              }
                              setDraggedTask(null);
                              setDragOverColumn(null);
                            }}
                            className="kanban-task-card"
                            style={{
                              padding: '0.75rem',
                              marginBottom: '0.75rem',
                              border: taskInRevision ? '2px solid #dc2626' : `1px solid ${borderColor}`,
                              borderRadius: '8px',
                              background: 'white',
                              cursor: draggedTask === task.id ? 'grabbing' : 'grab',
                              transition: 'all 0.2s',
                              position: 'relative',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              
                              // Don't navigate if clicking buttons or interactive elements
                              if (target.closest('button[data-edit-task]') || 
                                  target.closest('button') ||
                                  target.tagName === 'BUTTON' ||
                                  (target.tagName === 'svg' && target.closest('button')) ||
                                  (target.tagName === 'path' && target.closest('button'))) {
                                return;
                              }
                              
                              if (target.closest('input[type="checkbox"]') || 
                                  target.closest('select') || 
                                  target.tagName === 'INPUT' || 
                                  target.tagName === 'SELECT') {
                                return;
                              }
                              
                              // Open task detail modal instead of navigating
                              handleOpenTaskDetail(task);
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f8fafc';
                              e.currentTarget.style.borderColor = color;
                              e.currentTarget.style.boxShadow = `0 4px 8px ${color}25`;
                              e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'white';
                              e.currentTarget.style.borderColor = taskInRevision ? '#dc2626' : borderColor;
                              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            {taskInRevision && (
                              <div style={{
                                position: 'absolute',
                                top: '0',
                                right: '0',
                                background: '#dc2626',
                                color: 'white',
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.625rem',
                                fontWeight: 600,
                                borderBottomLeftRadius: '6px',
                                borderTopRightRadius: '6px',
                                zIndex: 10
                              }}>
                                REVISION
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginBottom: '0.25rem'
                                }}>
                                  <div>
                                    <div style={{
                                      fontSize: '0.75rem',
                                      color: color,
                                      fontWeight: 500
                                    }}>
                                      {getProjectName(task.projectId)}
                                    </div>
                                    {getProjectPmName(task.projectId) && (
                                      <div style={{
                                        fontSize: '0.6875rem',
                                        color: '#94a3b8',
                                        marginTop: '0.125rem'
                                      }}>
                                        PM: {getProjectPmName(task.projectId)}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    data-edit-task="true"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleEditTask(task);
                                    }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                    }}
                                    style={{
                                      background: 'transparent',
                                      border: `1px solid ${color}`,
                                      color: color,
                                      cursor: 'pointer',
                                      padding: '0.5rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderRadius: '6px',
                                      transition: 'all 0.2s',
                                      zIndex: 100,
                                      position: 'relative',
                                      outline: 'none',
                                      minWidth: '36px',
                                      minHeight: '36px'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = `${color}15`;
                                      e.currentTarget.style.color = color;
                                      e.currentTarget.style.borderColor = color;
                                      e.currentTarget.style.transform = 'scale(1.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'transparent';
                                      e.currentTarget.style.color = color;
                                      e.currentTarget.style.borderColor = color;
                                      e.currentTarget.style.transform = 'scale(1)';
                                    }}
                                    title="Edit Task"
                                  >
                                    <FaEdit style={{ fontSize: '1rem', pointerEvents: 'none' }} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      copyTaskLink(task);
                                    }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                    }}
                                    style={{
                                      background: 'transparent',
                                      border: '1px solid #d1d5db',
                                      color: '#4b5563',
                                      cursor: 'pointer',
                                      padding: '0.5rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderRadius: '6px',
                                      transition: 'all 0.2s',
                                      zIndex: 100,
                                      position: 'relative',
                                      outline: 'none',
                                      minWidth: '36px',
                                      minHeight: '36px'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#f3f4f6';
                                      e.currentTarget.style.borderColor = '#9ca3af';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'transparent';
                                      e.currentTarget.style.borderColor = '#d1d5db';
                                    }}
                                    title="Copy task link"
                                  >
                                    <FaLink style={{ fontSize: '0.95rem', pointerEvents: 'none' }} />
                                  </button>
                                </div>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  marginBottom: '0.5rem',
                                  flexWrap: 'wrap'
                                }}>
                                  <h4 style={{
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    color: '#111827',
                                    margin: 0,
                                    flex: 1,
                                    minWidth: 0
                                  }}>
                                    {task.title}
                                  </h4>
                                  <span style={{
                                    padding: '0.125rem 0.5rem',
                                    borderRadius: '0.25rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    background: task.isCompleted ? '#d1fae5' : task.status === 'In Review' ? '#fef3c7' : '#f3f4f6',
                                    color: task.isCompleted ? '#065f46' : task.status === 'In Review' ? '#92400e' : '#374151',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {task.isCompleted ? 'Completed' : task.status}
                                  </span>
                                </div>
                                {task.description && (
                                  <p style={{
                                    color: '#64748b',
                                    fontSize: '0.75rem',
                                    margin: '0 0 0.5rem 0',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical'
                                  }}>
                                    {task.description}
                                  </p>
                                )}
                                {taskNotes.length > 0 && (
                                  <div style={{
                                    marginTop: '0.5rem',
                                    marginBottom: '0.5rem',
                                    padding: '0.5rem',
                                    background: '#fef3c7',
                                    border: '1px solid #fde68a',
                                    borderRadius: '6px',
                                    fontSize: '0.7rem',
                                    color: '#92400e'
                                  }}>
                                    <FaStickyNote style={{ fontSize: '0.625rem', marginRight: '0.25rem', display: 'inline' }} />
                                    Revision notes available
                                  </div>
                                )}
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '1rem',
                                  fontSize: '0.75rem',
                                  color: '#64748b',
                                  marginBottom: '0.5rem',
                                  flexWrap: 'wrap'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                                    <FaUser style={{ fontSize: '0.75rem' }} />
                                    {(() => {
                                      const assignees = task.assignees || [];
                                      const assigneeIds = assignees.length > 0 
                                        ? assignees.map((a: any) => a.userId || a.user?.id)
                                        : (task.assignedToId ? [task.assignedToId] : []);
                                      
                                      if (assigneeIds.length === 0) {
                                        return <span>Unassigned</span>;
                                      } else if (assigneeIds.length === 1) {
                                        return <span>{getUserName(assigneeIds[0])}</span>;
                                      } else {
                                        return (
                                          <span>
                                            {assigneeIds.slice(0, 2).map((id: string) => getUserName(id)).join(', ')}
                                            {assigneeIds.length > 2 && ` +${assigneeIds.length - 2} more`}
                                          </span>
                                        );
                                      }
                                    })()}
                                  </div>
                                  {task.dueDate && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      <FaClock style={{ fontSize: '0.75rem' }} />
                                      <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                                    </div>
                                  )}
                                </div>
                                {(() => {
                                  const assignees = task.assignees || [];
                                  const assigneeIds = assignees.length > 0 
                                    ? assignees.map((a: any) => a.userId || a.user?.id)
                                    : (task.assignedToId ? [task.assignedToId] : []);
                                  return assigneeIds.length === 0;
                                })() && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          await handleClaimTask(task.id);
                                        } catch (error) {
                                          console.error('Failed to claim task:', error);
                                        }
                                      }}
                                      disabled={updatingTask === task.id}
                                      style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        border: 'none',
                                        borderRadius: '0.375rem',
                                        background: '#10b981',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem'
                                      }}
                                    >
                                      {updatingTask === task.id ? (
                                        <FaSpinner className="spinner" />
                                      ) : (
                                        <>
                                          <FaHandPaper /> Claim Task
                                        </>
                                      )}
                                    </button>
                                    {isTeamLead && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenAssignModal(task);
                                        }}
                                        disabled={updatingTask === task.id}
                                        style={{
                                          width: '100%',
                                          padding: '0.5rem',
                                          border: `1px solid ${color}`,
                                          borderRadius: '0.375rem',
                                          background: 'transparent',
                                          color: color,
                                          cursor: 'pointer',
                                          fontSize: '0.75rem',
                                          fontWeight: 500,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '0.5rem'
                                        }}
                                      >
                                        <FaUser /> Assign to Team Member
                                      </button>
                                    )}
                                  </div>
                                )}
                                {task.assignedToId && (
                                  <>
                                    {(() => {
                                      const assignees = task.assignees || [];
                                      const assigneeIds = assignees.length > 0 
                                        ? assignees.map((a: any) => a.userId || a.user?.id)
                                        : (task.assignedToId ? [task.assignedToId] : []);
                                      const isAssignedToMe = assigneeIds.includes(user?.id || '');
                                      const displayText = assigneeIds.length === 0 
                                        ? 'Unassigned'
                                        : assigneeIds.length === 1
                                        ? (isAssignedToMe ? 'Assigned to you' : `Assigned to ${getUserName(assigneeIds[0])}`)
                                        : isAssignedToMe
                                        ? `Assigned to you + ${assigneeIds.length - 1} other${assigneeIds.length > 2 ? 's' : ''}`
                                        : `Assigned to ${assigneeIds.length} team member${assigneeIds.length > 1 ? 's' : ''}`;
                                      
                                      return (
                                        <div style={{
                                          width: '100%',
                                          padding: '0.35rem 0.75rem',
                                          borderRadius: '999px',
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                          color: isAssignedToMe ? '#047857' : '#4b5563',
                                          textAlign: 'center',
                                          background: isAssignedToMe ? '#ecfdf5' : '#f3f4f6',
                                          marginBottom: '0.5rem',
                                          borderLeft: isAssignedToMe ? '4px solid #10b981' : '4px solid #e5e7eb',
                                          boxShadow: '0 0 0 1px rgba(148, 163, 184, 0.15)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: '0.5rem'
                                        }}>
                                          <span style={{ flex: 1, textAlign: 'left' }}>
                                            {displayText}
                                            {assigneeIds.length > 1 && !isAssignedToMe && (
                                              <span style={{ fontSize: '0.625rem', opacity: 0.7, display: 'block', marginTop: '0.125rem' }}>
                                                {assigneeIds.slice(0, 2).map((id: string) => getUserName(id)).join(', ')}
                                                {assigneeIds.length > 2 && ` +${assigneeIds.length - 2} more`}
                                              </span>
                                            )}
                                          </span>
                                          {isTeamLead && !task.isCompleted && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenAssignModal(task);
                                              }}
                                              style={{
                                                padding: '0.25rem 0.5rem',
                                                border: `1px solid ${color}`,
                                                borderRadius: '0.25rem',
                                                background: 'transparent',
                                                color: color,
                                                cursor: 'pointer',
                                                fontSize: '0.625rem',
                                                fontWeight: 600,
                                                whiteSpace: 'nowrap'
                                              }}
                                              title="Update members for this task"
                                            >
                                              {assigneeIds.length > 0 ? 'Update Members' : 'Assign Members'}
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })()}
                                    {(() => {
                                      const assignees = task.assignees || [];
                                      const assigneeIds = assignees.length > 0 
                                        ? assignees.map((a: any) => a.userId || a.user?.id)
                                        : (task.assignedToId ? [task.assignedToId] : []);
                                      const isAssignedToMe = assigneeIds.includes(user?.id || '');
                                      return !task.isCompleted && (isAssignedToMe || isTeamLead);
                                    })() && (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                                        {task.status === 'Todo' && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleTaskStatusUpdate(task.id, 'In Progress');
                                            }}
                                            disabled={updatingTask === task.id}
                                            style={{
                                              width: '100%',
                                              padding: '0.5rem',
                                              border: 'none',
                                              borderRadius: '0.375rem',
                                              background: '#3b82f6',
                                              color: 'white',
                                              cursor: 'pointer',
                                              fontSize: '0.75rem',
                                              fontWeight: 500,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              gap: '0.5rem'
                                            }}
                                          >
                                            {updatingTask === task.id ? <FaSpinner className="spinner" /> : 'Start'}
                                          </button>
                                        )}
                                        {(task.status === 'In Progress' || (hasRevisionDeliverables(project || {}) && task.status === 'In Review')) && (
                                          <>
                                            {/* Primary review action */}
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSendForReview(task);
                                              }}
                                              disabled={updatingTask === task.id}
                                              style={{
                                                width: '100%',
                                                padding: '0.5rem',
                                                border: 'none',
                                                borderRadius: '0.375rem',
                                                background: '#f59e0b',
                                                color: 'white',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem'
                                              }}
                                            >
                                              {updatingTask === task.id ? (
                                                <FaSpinner className="spinner" />
                                              ) : hasRevisionDeliverables(project || {}) ? (
                                                'Resubmit'
                                              ) : (
                                                'Send for Review'
                                              )}
                                            </button>

                                            {/* For AI Developer only: extra option to forward instead of just review */}
                                            {isAIDeveloper && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleOpenForwardModal(task);
                                                }}
                                                disabled={updatingTask === task.id}
                                                style={{
                                                  width: '100%',
                                                  padding: '0.5rem',
                                                  border: 'none',
                                                  borderRadius: '0.375rem',
                                                  background: '#4f46e5',
                                                  color: 'white',
                                                  cursor: 'pointer',
                                                  fontSize: '0.75rem',
                                                  fontWeight: 500,
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  gap: '0.5rem'
                                                }}
                                              >
                                                {updatingTask === task.id ? (
                                                  <FaSpinner className="spinner" />
                                                ) : (
                                                  'Forward to Department'
                                                )}
                                              </button>
                                            )}
                                            {!hasRevisionDeliverables(project || {}) && !linkedOrigin && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleTaskStatusUpdate(task.id, 'Completed', true);
                                                }}
                                                disabled={updatingTask === task.id}
                                                style={{
                                                  width: '100%',
                                                  padding: '0.5rem',
                                                  border: 'none',
                                                  borderRadius: '0.375rem',
                                                  background: '#10b981',
                                                  color: 'white',
                                                  cursor: 'pointer',
                                                  fontSize: '0.75rem',
                                                  fontWeight: 500,
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  gap: '0.5rem'
                                                }}
                                              >
                                                {updatingTask === task.id ? <FaSpinner className="spinner" /> : 'Complete'}
                                              </button>
                                            )}
                                          </>
                                        )}
                                        {linkedOrigin && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenReturnModal(task);
                                            }}
                                            disabled={updatingTask === task.id}
                                            style={{
                                              width: '100%',
                                              padding: '0.5rem',
                                              border: 'none',
                                              borderRadius: '0.375rem',
                                              background: '#4f46e5',
                                              color: 'white',
                                              cursor: 'pointer',
                                              fontSize: '0.75rem',
                                              fontWeight: 500,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              gap: '0.5rem'
                                            }}
                                          >
                                            {updatingTask === task.id ? (
                                              <FaSpinner className="spinner" />
                                            ) : (
                                              `Return to ${linkedOrigin.originDepartmentName || 'Origin Dept'} for Approval`
                                            )}
                                          </button>
                                        )}
                                        {task.status === 'In Review' && !hasRevisionDeliverables(project || {}) && !linkedTarget && (
                                          <>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleTaskStatusUpdate(task.id, 'In Progress');
                                              }}
                                              disabled={updatingTask === task.id}
                                              style={{
                                                width: '100%',
                                                padding: '0.5rem',
                                                border: 'none',
                                                borderRadius: '0.375rem',
                                                background: '#3b82f6',
                                                color: 'white',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem'
                                              }}
                                            >
                                              {updatingTask === task.id ? <FaSpinner className="spinner" /> : 'Back to In Progress'}
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleTaskStatusUpdate(task.id, 'Completed', true);
                                              }}
                                              disabled={updatingTask === task.id}
                                              style={{
                                                width: '100%',
                                                padding: '0.5rem',
                                                border: 'none',
                                                borderRadius: '0.375rem',
                                                background: '#10b981',
                                                color: 'white',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem'
                                              }}
                                            >
                                              {updatingTask === task.id ? <FaSpinner className="spinner" /> : 'Mark Complete'}
                                            </button>
                                          </>
                                        )}
                                        {linkedTarget && task.status === 'In Review' && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleSendBackToTargetForRevision(task);
                                            }}
                                            disabled={updatingTask === task.id}
                                            style={{
                                              width: '100%',
                                              padding: '0.5rem',
                                              border: 'none',
                                              borderRadius: '0.375rem',
                                              background: '#dc2626',
                                              color: 'white',
                                              cursor: 'pointer',
                                              fontSize: '0.75rem',
                                              fontWeight: 500,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              gap: '0.5rem'
                                            }}
                                          >
                                            {updatingTask === task.id ? (
                                              <FaSpinner className="spinner" />
                                            ) : (
                                              `Send Back to ${linkedTarget.targetDepartmentName || 'Linked Dept'} for Revision`
                                            )}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {sortedStatusTasks.length === 0 && (
                        <div style={{
                          padding: '2rem',
                          textAlign: 'center',
                          color: '#9ca3af',
                          fontSize: '0.875rem'
                        }}>
                          No tasks
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                    {isTeamLead && (
                      <th style={{ padding: '1rem', textAlign: 'center', width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={getFilteredAndSortedTasks().length > 0 && selectedTaskIds.length === getFilteredAndSortedTasks().length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTaskIds(getFilteredAndSortedTasks().map((t: any) => t.id));
                            } else {
                              setSelectedTaskIds([]);
                            }
                          }}
                        />
                      </th>
                    )}
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Task</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Project</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>PM</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Status</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Due Date</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Assigned To</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredAndSortedTasks().map((task: any) => {
                    const isSelected = selectedTaskIds.includes(task.id);
                    return (
                      <tr key={task.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        {isTeamLead && (
                          <td style={{ padding: '1rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTaskIds((prev) => [...prev, task.id]);
                                } else {
                                  setSelectedTaskIds((prev) => prev.filter((id) => id !== task.id));
                                }
                              }}
                            />
                          </td>
                        )}
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: 600, color: '#111827', marginBottom: '0.25rem' }}>
                            {task.title}
                          </div>
                          {task.description && (
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                              {task.description.substring(0, 100)}...
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#374151' }}>
                          {getProjectName(task.projectId)}
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
                          {getProjectPmName(task.projectId) || '—'}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            background: task.isCompleted ? '#d1fae5' : task.status === 'In Progress' ? '#dbeafe' : task.status === 'In Review' ? '#fef3c7' : '#f3f4f6',
                            color: task.isCompleted ? '#065f46' : task.status === 'In Progress' ? '#1e40af' : task.status === 'In Review' ? '#92400e' : '#374151'
                          }}>
                            {task.isCompleted ? 'Completed' : task.status}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#374151' }}>
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#374151' }}>
                          {task.assignedToId ? getUserName(task.assignedToId) : 'Unassigned'}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => navigate(`/project/${task.projectId}`)}
                              style={{
                                padding: '0.375rem 0.75rem',
                                border: 'none',
                                borderRadius: '6px',
                                background: '#f3f4f6',
                                color: '#374151',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 500
                              }}
                            >
                              View
                            </button>
                            <button
                              onClick={() => copyTaskLink(task)}
                              style={{
                                padding: '0.375rem 0.75rem',
                                border: 'none',
                                borderRadius: '6px',
                                background: '#f3f4f6',
                                color: '#374151',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 500
                              }}
                            >
                              Copy Link
                            </button>
                            <button
                              onClick={() => handleEditTask(task)}
                              style={{
                                padding: '0.375rem 0.75rem',
                                border: 'none',
                                borderRadius: '6px',
                                background: '#f3f4f6',
                                color: '#374151',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 500
                              }}
                            >
                              Edit
                            </button>
                            {isTeamLead && (
                              <button
                                onClick={async () => {
                                  const confirmed = window.confirm('Are you sure you want to delete this task? This cannot be undone.');
                                  if (!confirmed) return;
                                  try {
                                    setUpdatingTask(task.id);
                                    await taskService.delete(task.id);
                                    await loadData();
                                  } catch (error) {
                                    console.error('Failed to delete task:', error);
                                    alert('Failed to delete task. Please try again.');
                                  } finally {
                                    setUpdatingTask(null);
                                  }
                                }}
                                disabled={updatingTask === task.id}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: '#fee2e2',
                                  color: '#b91c1c',
                                  cursor: updatingTask === task.id ? 'not-allowed' : 'pointer',
                                  fontSize: '0.75rem',
                                  fontWeight: 500
                                }}
                              >
                                {updatingTask === task.id ? 'Deleting…' : 'Delete'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {getFilteredAndSortedTasks().length === 0 && (
                <div style={{
                  padding: '3rem',
                  textAlign: 'center',
                  color: '#9ca3af',
                  fontSize: '0.875rem'
                }}>
                  No tasks found
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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
        onEditTask={handleEditTask}
        initialTab={taskDetailTab}
        onTaskUpdate={(updatedTask) => {
          setSelectedTaskDetail(updatedTask);
          setTasks((prev) => prev.map((t: any) => t.id === updatedTask?.id ? updatedTask : t));
        }}
      />

      {/* Status Change Modal (for drag and drop) */}
      {showStatusChangeModal && statusChangeContext && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2100,
          }}
          onClick={() => {
            if (statusChangeLoading) return;
            setShowStatusChangeModal(false);
            setStatusChangeContext(null);
            setStatusChangeNotes('');
            setStatusChangeLinks(['']);
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              margin: '1rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '1.5rem 2rem',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: '#111827',
                }}
              >
                Update Status – {statusChangeContext.targetColumnLabel}
              </h2>
              <button
                onClick={() => {
                  if (statusChangeLoading) return;
                  setShowStatusChangeModal(false);
                  setStatusChangeContext(null);
                  setStatusChangeNotes('');
                  setStatusChangeLinks(['']);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  padding: '0.5rem',
                  borderRadius: '999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FaTimes />
              </button>
            </div>

            <div
              style={{
                padding: '1.5rem 2rem',
                flex: 1,
                overflowY: 'auto',
              }}
            >
              <p style={{ marginBottom: '1.5rem', color: '#6b7280', fontSize: '0.9rem' }}>
                Add notes and links so PMs and team leads can see why this task moved into "{statusChangeContext.targetColumnLabel}".
              </p>

              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="status-change-notes"
                  style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}
                >
                  Notes (Optional)
                </label>
                <textarea
                  id="status-change-notes"
                  value={statusChangeNotes}
                  onChange={(e) => setStatusChangeNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    minHeight: '100px',
                    fontFamily: 'inherit',
                    fontSize: '0.9rem',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                  }}
                  placeholder="Add context about this status change..."
                  disabled={statusChangeLoading}
                />
              </div>

              <div>
                <label
                  style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}
                >
                  Links / Attachments (Optional)
                </label>
                {statusChangeLinks.map((link, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <FaLink style={{ color: '#6b7280', fontSize: '0.875rem', flexShrink: 0 }} />
                    <input
                      type="url"
                      value={link}
                      onChange={(e) => {
                        const newLinks = [...statusChangeLinks];
                        newLinks[index] = e.target.value;
                        setStatusChangeLinks(newLinks);
                      }}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #d1d5db',
                        fontSize: '0.9rem',
                      }}
                      placeholder="https://example.com or Google Drive/Figma link..."
                      disabled={statusChangeLoading}
                    />
                    {statusChangeLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newLinks = statusChangeLinks.filter((_, i) => i !== index);
                          setStatusChangeLinks(newLinks);
                        }}
                        disabled={statusChangeLoading}
                        style={{
                          padding: '0.5rem',
                          border: 'none',
                          background: 'transparent',
                          color: '#ef4444',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#fef2f2';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <FaTimes />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setStatusChangeLinks([...statusChangeLinks, ''])}
                  disabled={statusChangeLoading}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem 1rem',
                    border: '1px solid #d1d5db',
                    background: 'white',
                    color: '#374151',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f9fafb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                  }}
                >
                  <FaPlus style={{ fontSize: '0.75rem' }} />
                  Add Another Link
                </button>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem', marginBottom: 0 }}>
                  Use this to attach references, client feedback, or handoff links.
                </p>
              </div>
            </div>

            <div
              style={{
                padding: '1.25rem 2rem',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (statusChangeLoading) return;
                  setShowStatusChangeModal(false);
                  setStatusChangeContext(null);
                  setStatusChangeNotes('');
                  setStatusChangeLinks(['']);
                }}
                disabled={statusChangeLoading}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  color: '#374151',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: statusChangeLoading ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStatusChangeFromDrag}
                disabled={statusChangeLoading}
                style={{
                  background: statusChangeLoading ? '#9ca3af' : color,
                  border: 'none',
                  color: 'white',
                  padding: '0.6rem 1.4rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: statusChangeLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {statusChangeLoading ? (
                  <>
                    <FaSpinner className="spinner" />
                    Updating...
                  </>
                ) : (
                  'Update Status'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleDashboard;

