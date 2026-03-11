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
  FaFileAlt,
  FaLink,
} from 'react-icons/fa';
import { authService } from '../../services/auth.service';
import { projectService } from '../../services/project.service';
import { taskService } from '../../services/task.service';
import { notificationService } from '../../services/notification.service';
import { deliverableService } from '../../services/deliverable.service';
import NotificationsModal from '../NotificationsModal';
import SendForReviewModal from '../SendForReviewModal';
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
    taskType: 'SEO',
    stages: [],
    departmentName: 'SEO/GEO Team',
    icon: FaSearch,
    color: '#06b6d4',
  },
};

interface RoleDashboardProps {
  role: string;
}

const RoleDashboard: React.FC<RoleDashboardProps> = ({ role }) => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const config = ROLE_CONFIG[role];
  
  // All hooks must be called before any conditional returns
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedTaskForReview, setSelectedTaskForReview] = useState<any>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [filter, setFilter] = useState<'all' | 'my_tasks' | 'todo' | 'in_progress' | 'in_review' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'created'>('due_date');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const skipRefreshUntilRef = useRef<number | null>(null);
  const [deliverableHistory] = useState<Record<string, any[]>>({});
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
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
  
  // Conversation state
  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newCommentTexts, setNewCommentTexts] = useState<Record<string, string>>({});
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [submittingComments, setSubmittingComments] = useState<Record<string, boolean>>({});
  const [showMentionDropdown, setShowMentionDropdown] = useState<{ questionId?: string; commentId?: string; position: number } | null>(null);
  
  // Helper to get display text (without USER_ID patterns) for textarea
  const getDisplayText = (text: string): string => {
    return renderTextWithMentions(text);
  };
  
  // Helper to update text while preserving USER_ID patterns
  const updateTextWithMentions = (currentText: string, newDisplayText: string): string => {
    // Extract all existing mentions with IDs from current text
    // eslint-disable-next-line no-useless-escape
    const mentionRegex = /@([^\[]+)\[\[USER_ID:([^\]]+)\]\]/g;
    const existingMentions = new Map<string, string>(); // Map of name -> userId
    
    let match;
    const regex = new RegExp(mentionRegex);
    while ((match = regex.exec(currentText)) !== null) {
      const name = match[1].trim();
      const userId = match[2];
      existingMentions.set(name, userId);
    }
    
    // Find mentions in new display text and restore IDs
    const newMentionRegex = /@([^\s@\n]+(?:\s+[^\s@\n]+)*)/g;
    let result = newDisplayText;
    const matches = Array.from(newDisplayText.matchAll(newMentionRegex));
    
    // Process from end to start to maintain correct indices
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      const name = match[1].trim();
      const userId = existingMentions.get(name);
      
      if (userId && match.index !== undefined) {
        // Replace name-only mention with full mention including ID
        const start = match.index;
        const end = start + match[0].length;
        result = result.substring(0, start) + `@${name}[[USER_ID:${userId}]]` + result.substring(end);
      }
    }
    
    return result;
  };

  // Drag and drop state
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

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

      const [allTasksData, allProjectsData] = await Promise.all([
        taskService.getAll(undefined, undefined, { all: true }),
        projectService.getAll()
      ]);

      // Filter tasks by type
      const roleTasks = allTasksData.filter((t: any) => t.type === config.taskType);

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

  const handleReviewSubmit = async (driveLink: string, deliverableType: string, deliverableId?: string) => {
    if (!selectedTaskForReview) return;
    
    try {
      setUpdatingTask(selectedTaskForReview.id);
      await taskService.updateStatus(selectedTaskForReview.id, 'In Review', false, driveLink, deliverableType, deliverableId);
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
    if (task?.id) {
      loadConversations(task.id);
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

  const loadConversations = async (taskId: string) => {
    try {
      setLoadingConversations(true);
      const data = await taskService.getConversations(taskId);
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  };

  const extractMentions = (text: string): string[] => {
    // Match @name[[USER_ID:uuid]] format - extract the ID directly
    // eslint-disable-next-line no-useless-escape
    const mentionRegex = /@[^\[]+\[\[USER_ID:([^\]]+)\]\]/g;
    const matches = Array.from(text.matchAll(mentionRegex));
    if (!matches || matches.length === 0) return [];
    
    const mentionedUserIds: string[] = [];
    const foundIds = new Set<string>(); // Prevent duplicates
    
    matches.forEach(match => {
      const userId = match[1]; // Extract the user ID from the pattern
      if (userId && !foundIds.has(userId)) {
        foundIds.add(userId);
        mentionedUserIds.push(userId);
      }
    });
    return mentionedUserIds;
  };

  // Render text with mentions - show name but hide the ID part
  const renderTextWithMentions = (text: string) => {
    if (!text) return text;
    // Replace @name[[USER_ID:uuid]] with just @name for display
    // eslint-disable-next-line no-useless-escape
    return text.replace(/@([^\[]+)\[\[USER_ID:[^\]]+\]\]/g, '@$1');
  };

  const handleCreateQuestion = async () => {
    if (!selectedTaskDetail?.id || !newQuestionText.trim()) return;
    
    try {
      setSubmittingQuestion(true);
      const mentionedUserIds = extractMentions(newQuestionText);
      console.log('Extracted mentions:', mentionedUserIds, 'from text:', newQuestionText);
      if (mentionedUserIds.length > 0) {
        console.log('Mentioned users:', mentionedUserIds.map(id => {
          const user = users.find((u: any) => u.id === id);
          return user ? user.name : id;
        }));
      }
      await taskService.createQuestion(selectedTaskDetail.id, newQuestionText, mentionedUserIds);
      setNewQuestionText('');
      await loadConversations(selectedTaskDetail.id);
    } catch (error: any) {
      console.error('Failed to create question:', error);
      alert(`Failed to create question: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
    } finally {
      setSubmittingQuestion(false);
    }
  };

  const handleCreateComment = async (questionId: string) => {
    const commentText = newCommentTexts[questionId];
    if (!commentText?.trim()) return;
    
    try {
      setSubmittingComments({ ...submittingComments, [questionId]: true });
      const mentionedUserIds = extractMentions(commentText);
      console.log('Extracted mentions from comment:', mentionedUserIds, 'from text:', commentText);
      if (mentionedUserIds.length > 0) {
        console.log('Mentioned users:', mentionedUserIds.map(id => {
          const user = users.find((u: any) => u.id === id);
          return user ? user.name : id;
        }));
      }
      await taskService.createComment(questionId, commentText, mentionedUserIds);
      setNewCommentTexts({ ...newCommentTexts, [questionId]: '' });
      if (selectedTaskDetail?.id) {
        await loadConversations(selectedTaskDetail.id);
      }
    } catch (error: any) {
      console.error('Failed to create comment:', error);
      alert(`Failed to create comment: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
    } finally {
      setSubmittingComments({ ...submittingComments, [questionId]: false });
    }
  };

  const handleMentionInput = (text: string, questionId?: string, commentId?: string) => {
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const afterAt = text.substring(lastAtIndex + 1);
      // Check if we're typing a mention (not already completed with USER_ID)
      // Allow word characters and spaces, but not if it already has [[USER_ID:
      // eslint-disable-next-line no-useless-escape
      if (afterAt.match(/^[^\[]*$/) && !afterAt.includes('[[USER_ID:')) {
        setShowMentionDropdown({ questionId, commentId, position: lastAtIndex + 1 });
      } else {
        setShowMentionDropdown(null);
      }
    } else {
      setShowMentionDropdown(null);
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

  // Convert URLs in text to clickable links
  const renderDescriptionWithLinks = (text: string) => {
    if (!text) return null;
    
    // URL regex pattern - matches http://, https://, and www. URLs
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = urlRegex.exec(text)) !== null) {
      // Add text before the URL
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Add the URL as a clickable link
      let url = match[0];
      // Add https:// if it starts with www.
      if (url.startsWith('www.')) {
        url = 'https://' + url;
      }
      
      parts.push(
        <a
          key={key++}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#2563eb',
            textDecoration: 'none',
            wordBreak: 'break-all',
            borderBottom: '1px solid transparent',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textDecoration = 'underline';
            e.currentTarget.style.borderBottomColor = '#2563eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecoration = 'none';
            e.currentTarget.style.borderBottomColor = 'transparent';
          }}
        >
          {match[0]}
        </a>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? <>{parts}</> : text;
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
        return { status: 'In Review', columnMarker: '\n\n--- Column: Client Review ---', isCompleted: false };
      case 'approved_completed':
        return { status: 'Completed', isCompleted: true };
      default:
        return { status: 'Todo', isCompleted: false };
    }
  };

  // Handle status change from drag and drop modal
  const handleStatusChangeFromDrag = async () => {
    if (!statusChangeContext) return;
    
    try {
      setStatusChangeLoading(true);
      const task = tasks.find((t: any) => t.id === statusChangeContext.taskId);
      if (!task) return;

      const { status, columnMarker, isCompleted } = mapColumnToStatus(statusChangeContext.targetColumnId);
      
      // Update description with column marker if needed
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
        // Clear column markers when moving to non-review columns
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

      // Update task status
      await taskService.updateStatus(statusChangeContext.taskId, status, isCompleted);

      // Log status change with notes and links
      const currentDesc = task.description || '';
      const timestamp = new Date().toLocaleString();
      let logBlock = `\n\n--- Status Change ---\nNew Column: ${statusChangeContext.targetColumnLabel}\nBy: ${user?.name || 'Unknown'}\nAt: ${timestamp}`;
      
      if (statusChangeNotes && statusChangeNotes.trim()) {
        logBlock += `\nNotes: ${statusChangeNotes.trim()}`;
      }
      
      const validLinks = statusChangeLinks.filter(link => link.trim());
      if (validLinks.length > 0) {
        logBlock += `\nAttachments:\n${validLinks.map(link => `- ${link.trim()}`).join('\n')}`;
      }

      const updatedDesc = currentDesc + logBlock;
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
  const isTeamLead = !!user?.isTeamLead;

  // Continue with the rest of the component JSX...
  // Due to size limits, I'll create a simplified version that includes the key parts
  // The full JSX structure would be identical to CopyDashboard but using config values

  return (
    <div className="dashboard premium" style={{ display: 'flex', minHeight: '100vh', padding: 0 }}>
      {/* Sidebar */}
      <div style={{
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
      }}>
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
            Your Department
          </h2>
          <p style={{
            fontSize: '0.875rem',
            color: 'rgba(255, 255, 255, 0.6)',
            margin: 0
          }}>
            {departmentName}
          </p>
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
        <div style={{
          flex: 1,
          padding: '1rem 0.75rem',
          overflowY: 'auto',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
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
            onClick={() => navigate('/dashboard')}
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
            ← Back to Dashboard
          </button>
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
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#111827',
              margin: 0
            }}>
              {departmentName}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.875rem'
                }}>
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
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
              onClick={() => setShowAddTaskModal(true)}
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

        {/* Task Content Area */}
        <div style={{
          flex: 1,
          padding: '2rem',
          overflowY: 'auto',
          background: '#f9fafb'
        }}>
          {viewMode === 'kanban' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(280px, 1fr))',
              gap: '1.5rem',
              paddingBottom: '1rem',
              paddingTop: '0.5rem',
              width: '100%',
              minHeight: '400px',
              gridAutoFlow: 'row'
            }}>
              {[
                { id: 'not_started', title: 'Not yet started', color: '#6b7280' },
                { id: 'owned_in_progress', title: 'Owned/In Progress', color: '#3b82f6' },
                { id: 'for_approval', title: 'For Approval', color: '#f59e0b' },
                { id: 'revision', title: 'Revision', color: '#ef4444' },
                { id: 'elliot_review', title: 'Elliot Review', color: '#8b5cf6' },
                { id: 'approved_completed', title: 'Approved/Completed', color: '#10b981' },
                { id: 'qa_before_client', title: 'QA Before Sending to Client', color: '#06b6d4' },
                { id: 'client_validation', title: 'Client Validation', color: '#f97316' }
              ].map((column) => {
                const statusTasks = groupedTasks[column.id] || [];

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
                      height: 'fit-content',
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
                      <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                        {statusTasks.length} task(s)
                      </span>
                    </div>
                    <div style={{
                      padding: '0.75rem',
                      flex: 1,
                      overflowY: 'auto',
                      minHeight: '200px',
                      maxHeight: 'calc(100vh - 400px)'
                    }}>
                      {statusTasks.map((task: any) => {
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
                                  <div style={{
                                    fontSize: '0.75rem',
                                    color: color,
                                    fontWeight: 500
                                  }}>
                                    {getProjectName(task.projectId)}
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
                      {statusTasks.length === 0 && (
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
          loadData();
        }}
        onOpenTaskConversation={handleOpenTaskConversationFromNotification}
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
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.clientName}</option>
                  ))}
                </select>
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

      {/* Task Detail Side Modal */}
      {showTaskDetailModal && selectedTaskDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '500px',
            background: 'white',
            boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
            zIndex: 1200,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'slideInRight 0.3s ease-out'
          }}
        >
          <style>{`
            @keyframes slideInRight {
              from {
                transform: translateX(100%);
              }
              to {
                transform: translateX(0);
              }
            }
          `}</style>
          
          {/* Modal Header */}
          <div style={{
            padding: '1.5rem 2rem',
            borderBottom: '1px solid #e5e7eb',
            background: '#f9fafb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}>
            <div style={{ flex: 1 }}>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#111827',
                margin: '0 0 0.25rem 0'
              }}>
                Task Details
              </h2>
              <p style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {selectedTaskDetail.title}
              </p>
            </div>
            <button
              onClick={handleCloseTaskDetail}
              style={{
                padding: '0.5rem',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: '8px',
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e5e7eb';
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

          {/* Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid #e5e7eb',
            background: '#f9fafb',
            padding: '0 2rem'
          }}>
            <button
              onClick={() => setTaskDetailTab('details')}
              style={{
                padding: '0.75rem 1rem',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: taskDetailTab === 'details' ? color : '#6b7280',
                borderBottom: taskDetailTab === 'details' ? `2px solid ${color}` : '2px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              Details
            </button>
            <button
              onClick={() => setTaskDetailTab('conversation')}
              style={{
                padding: '0.75rem 1rem',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: taskDetailTab === 'conversation' ? color : '#6b7280',
                borderBottom: taskDetailTab === 'conversation' ? `2px solid ${color}` : '2px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              Conversation
            </button>
          </div>

          {/* Modal Content */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem 2rem'
          }}>
            {taskDetailTab === 'details' ? (
              <>
            {/* Task Status Badge */}
            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 600,
                background: selectedTaskDetail.isCompleted ? '#d1fae5' : 
                           selectedTaskDetail.status === 'In Review' ? '#fef3c7' : 
                           selectedTaskDetail.status === 'In Progress' ? '#dbeafe' : '#f3f4f6',
                color: selectedTaskDetail.isCompleted ? '#065f46' : 
                       selectedTaskDetail.status === 'In Review' ? '#92400e' : 
                       selectedTaskDetail.status === 'In Progress' ? '#1e40af' : '#374151',
                display: 'inline-block'
              }}>
                {selectedTaskDetail.isCompleted ? 'Completed' : selectedTaskDetail.status}
              </span>
            </div>

            {/* Project Info */}
            <div style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              background: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.5rem'
              }}>
                Project
              </div>
              <div style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: '#111827'
              }}>
                {getProjectName(selectedTaskDetail.projectId)}
              </div>
            </div>

            {/* Assignees */}
            <div style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              background: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <FaUser style={{ fontSize: '0.75rem' }} />
                Assigned To
              </div>
              {(() => {
                const assignees = selectedTaskDetail.assignees || [];
                const assigneeIds = assignees.length > 0 
                  ? assignees.map((a: any) => a.userId || a.user?.id)
                  : (selectedTaskDetail.assignedToId ? [selectedTaskDetail.assignedToId] : []);
                
                if (assigneeIds.length === 0) {
                  return (
                    <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                      Unassigned
                    </div>
                  );
                }
                
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {assigneeIds.map((id: string) => (
                      <div key={id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.875rem',
                        color: '#374151'
                      }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          flexShrink: 0
                        }}>
                          {getUserName(id).charAt(0).toUpperCase()}
                        </div>
                        <span>{getUserName(id)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Due Date - always show */}
            <div style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              background: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <FaClock style={{ fontSize: '0.75rem' }} />
                Due Date
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: selectedTaskDetail.dueDate ? '#374151' : '#9ca3af'
              }}>
                {selectedTaskDetail.dueDate
                  ? new Date(selectedTaskDetail.dueDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : 'No due date set'}
              </div>
            </div>

            {/* Description */}
            {selectedTaskDetail.description && (
              <div style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                background: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <FaStickyNote style={{ fontSize: '0.75rem' }} />
                  Description
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: '#374151',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.6'
                }}>
                  {renderDescriptionWithLinks(selectedTaskDetail.description)}
                </div>
              </div>
            )}

            {/* Files/Links */}
            {selectedTaskDetail.fileUrl && (
              <div style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                background: '#eff6ff',
                borderRadius: '8px',
                border: '1px solid #bfdbfe'
              }}>
                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#1d4ed8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <FaLink style={{ fontSize: '0.75rem' }} />
                  Files & Links
                </div>
                <a
                  href={selectedTaskDetail.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: '#2563eb',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    wordBreak: 'break-all'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none';
                  }}
                >
                  <FaFileAlt style={{ fontSize: '0.875rem', flexShrink: 0 }} />
                  <span>{selectedTaskDetail.fileUrl}</span>
                </a>
              </div>
            )}

            {/* Task History now handled inside TaskDetailSideModal */}

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              marginTop: '2rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid #e5e7eb'
            }}>
              <button
                onClick={() => {
                  handleCloseTaskDetail();
                  navigate(`/project/${selectedTaskDetail.projectId}`);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: `1px solid ${color}`,
                  borderRadius: '8px',
                  background: 'transparent',
                  color: color,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${color}15`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                View Full Project
              </button>
              <button
                onClick={() => {
                  handleCloseTaskDetail();
                  handleEditTask(selectedTaskDetail);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: 'none',
                  borderRadius: '8px',
                  background: color,
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <FaEdit />
                Edit Task
              </button>
            </div>
              </>
            ) : (
              /* Conversation Tab */
              <div>
                {/* Conversations List */}
                {loadingConversations ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                    <FaSpinner className="spinner" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }} />
                    <div>Loading conversations...</div>
                  </div>
                ) : conversations.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                    No questions yet. Be the first to ask!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {conversations.map((question: any) => (
                      <div key={question.id} style={{
                        padding: '1rem',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        {/* Question */}
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.5rem'
                          }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              flexShrink: 0
                            }}>
                              {question.user?.name?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                color: '#111827'
                              }}>
                                {question.user?.name || 'Unknown'}
                              </div>
                              <div style={{
                                fontSize: '0.75rem',
                                color: '#6b7280'
                              }}>
                                {new Date(question.createdAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '0.875rem',
                            color: '#374151',
                            whiteSpace: 'pre-wrap',
                            lineHeight: '1.5',
                            marginLeft: '2.25rem'
                          }}>
                            {renderTextWithMentions(question.text)}
                          </div>
                        </div>

                        {/* Comments */}
                        {question.comments && question.comments.length > 0 && (
                          <div style={{
                            marginLeft: '2.25rem',
                            paddingLeft: '1rem',
                            borderLeft: '2px solid #e5e7eb',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                          }}>
                            {question.comments.map((comment: any) => (
                              <div key={comment.id} style={{
                                padding: '0.75rem',
                                background: 'white',
                                borderRadius: '6px',
                                border: '1px solid #e5e7eb'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  marginBottom: '0.5rem'
                                }}>
                                  <div style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 600,
                                    fontSize: '0.625rem',
                                    flexShrink: 0
                                  }}>
                                    {comment.user?.name?.charAt(0).toUpperCase() || '?'}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{
                                      fontSize: '0.8125rem',
                                      fontWeight: 600,
                                      color: '#111827'
                                    }}>
                                      {comment.user?.name || 'Unknown'}
                                    </div>
                                    <div style={{
                                      fontSize: '0.6875rem',
                                      color: '#6b7280'
                                    }}>
                                      {new Date(comment.createdAt).toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                                <div style={{
                                  fontSize: '0.8125rem',
                                  color: '#374151',
                                  whiteSpace: 'pre-wrap',
                                  lineHeight: '1.5',
                                  marginLeft: '1.75rem'
                                }}>
                                  {renderTextWithMentions(comment.text)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Comment Input */}
                        <div style={{
                          marginTop: '0.75rem',
                          marginLeft: '2.25rem',
                          paddingLeft: '1rem',
                          borderLeft: '2px solid #e5e7eb'
                        }}>
                          <div style={{ position: 'relative' }}>
                            <textarea
                              value={getDisplayText(newCommentTexts[question.id] || '')}
                              onChange={(e) => {
                                const displayValue = e.target.value;
                                const currentText = newCommentTexts[question.id] || '';
                                // Update text while preserving existing USER_ID patterns
                                const updatedText = updateTextWithMentions(currentText, displayValue);
                                setNewCommentTexts({ ...newCommentTexts, [question.id]: updatedText });
                                handleMentionInput(updatedText, question.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                  handleCreateComment(question.id);
                                }
                              }}
                              placeholder="Add a comment... Use @ to mention someone"
                              rows={2}
                              style={{
                                width: '100%',
                                padding: '0.5rem 0.75rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '0.8125rem',
                                fontFamily: 'inherit',
                                resize: 'vertical'
                              }}
                            />
                            {showMentionDropdown && showMentionDropdown.questionId === question.id && (
                              <div style={{
                                position: 'absolute',
                                bottom: '100%',
                                left: 0,
                                right: 0,
                                marginBottom: '0.5rem',
                                background: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                maxHeight: '200px',
                                overflowY: 'auto',
                                zIndex: 1000
                              }}>
                                {users.filter((u: any) => {
                                  const commentText = newCommentTexts[question.id] || '';
                                  const textAfterAt = commentText.substring(showMentionDropdown.position);
                                  // Remove any existing USER_ID pattern for matching
                                  const searchTerm = textAfterAt.replace(/\[\[USER_ID:[^\]]+\]\]/g, '').toLowerCase();
                                  return u.name.toLowerCase().includes(searchTerm);
                                }).slice(0, 5).map((u: any) => (
                                  <div
                                    key={u.id}
                                    onClick={() => {
                                      const commentText = newCommentTexts[question.id] || '';
                                      const beforeCursor = commentText.substring(0, showMentionDropdown.position - 1);
                                      const afterCursor = commentText.substring(showMentionDropdown.position);
                                      // Insert mention with user ID: @Name[[USER_ID:uuid]]
                                      const newText = beforeCursor + `@${u.name}[[USER_ID:${u.id}]] ` + afterCursor.replace(/^@[^\s@]*/, '');
                                      setNewCommentTexts({ ...newCommentTexts, [question.id]: newText });
                                      setShowMentionDropdown(null);
                                    }}
                                    style={{
                                      padding: '0.5rem 0.75rem',
                                      cursor: 'pointer',
                                      fontSize: '0.8125rem',
                                      borderBottom: '1px solid #f3f4f6'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#f9fafb';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'white';
                                    }}
                                  >
                                    {u.name}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleCreateComment(question.id)}
                            disabled={!newCommentTexts[question.id]?.trim() || submittingComments[question.id]}
                            style={{
                              marginTop: '0.5rem',
                              padding: '0.375rem 0.75rem',
                              border: 'none',
                              borderRadius: '6px',
                              background: (!newCommentTexts[question.id]?.trim() || submittingComments[question.id]) ? '#9ca3af' : color,
                              color: 'white',
                              cursor: (!newCommentTexts[question.id]?.trim() || submittingComments[question.id]) ? 'not-allowed' : 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}
                          >
                            {submittingComments[question.id] ? 'Posting...' : 'Post Comment'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* New Question Form - At the bottom */}
                <div style={{
                  marginTop: '2rem',
                  padding: '1rem',
                  background: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}>
                    Ask a Question
                  </label>
                  <div style={{ position: 'relative' }}>
                    <textarea
                      value={getDisplayText(newQuestionText)}
                      onChange={(e) => {
                        const displayValue = e.target.value;
                        // Update text while preserving existing USER_ID patterns
                        const updatedText = updateTextWithMentions(newQuestionText, displayValue);
                        setNewQuestionText(updatedText);
                        handleMentionInput(updatedText);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          handleCreateQuestion();
                        }
                      }}
                      placeholder="Type your question... Use @ to mention someone"
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }}
                    />
                    {showMentionDropdown && !showMentionDropdown.questionId && !showMentionDropdown.commentId && (
                      <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        right: 0,
                        marginBottom: '0.5rem',
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 1000
                      }}>
                      {users.filter((u: any) => {
                        const textAfterAt = newQuestionText.substring(showMentionDropdown.position);
                        // Remove any existing USER_ID pattern for matching
                        const searchTerm = textAfterAt.replace(/\[\[USER_ID:[^\]]+\]\]/g, '').toLowerCase();
                        return u.name.toLowerCase().includes(searchTerm);
                      }).slice(0, 5).map((u: any) => (
                          <div
                            key={u.id}
                            onClick={() => {
                              const beforeCursor = newQuestionText.substring(0, showMentionDropdown.position - 1);
                              const afterCursor = newQuestionText.substring(showMentionDropdown.position);
                              // Insert mention with user ID: @Name[[USER_ID:uuid]]
                              const newText = beforeCursor + `@${u.name}[[USER_ID:${u.id}]] ` + afterCursor.replace(/^@[^\s@]*/, '');
                              setNewQuestionText(newText);
                              setShowMentionDropdown(null);
                            }}
                            style={{
                              padding: '0.5rem 0.75rem',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              borderBottom: '1px solid #f3f4f6'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f9fafb';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'white';
                            }}
                          >
                            {u.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleCreateQuestion}
                    disabled={!newQuestionText.trim() || submittingQuestion}
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem 1rem',
                      border: 'none',
                      borderRadius: '6px',
                      background: (!newQuestionText.trim() || submittingQuestion) ? '#9ca3af' : color,
                      color: 'white',
                      cursor: (!newQuestionText.trim() || submittingQuestion) ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600
                    }}
                  >
                    {submittingQuestion ? 'Posting...' : 'Post Question'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backdrop for task detail modal */}
      {showTaskDetailModal && (
        <div
          onClick={handleCloseTaskDetail}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1199,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
        </div>
      )}

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

