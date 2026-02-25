import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaChevronDown,
  FaUser,
  FaBell,
  FaCog,
  FaSignOutAlt,
  FaFileAlt,
  FaClock,
  FaFilter,
  FaSort,
  FaSpinner,
  FaHandPaper,
  FaStickyNote,
  FaLink,
  FaTimes,
  FaArrowLeft,
  FaPlus,
  FaCopy,
  FaPalette,
  FaCode,
  FaRobot,
  FaShareAlt,
  FaDatabase,
  FaSearch,
  FaClipboardList,
  FaEdit,
  FaSave,
  FaEllipsisV,
  FaEye,
  FaFolder,
  FaPaperPlane,
  FaEnvelope,
} from 'react-icons/fa';
import { authService } from '../../services/auth.service';
import { projectService } from '../../services/project.service';
import { taskService } from '../../services/task.service';
import { notificationService } from '../../services/notification.service';
import { deliverableService } from '../../services/deliverable.service';
import { clientUpdatesService, ClientUpdateComment } from '../../services/client-updates.service';
import NotificationsModal from '../NotificationsModal';
import SendForReviewModal from '../SendForReviewModal';
import '../Dashboard.css';
import './DeveloperDashboard.css';

const SocialMediaDashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const [projects, setProjects] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]); // All projects for task creation
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
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedTaskNotes, setSelectedTaskNotes] = useState<any[]>([]);
  const [selectedTaskTitle, setSelectedTaskTitle] = useState<string>('');
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [bulkAssignUserId] = useState<string>('');
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    projectId: '',
    title: '',
    description: '',
    dueDate: '',
    deliverableId: '',
    assignedToId: ''
  });
  const [deliverables, setDeliverables] = useState<any[]>([]);
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
  const [editDeliverables, setEditDeliverables] = useState<any[]>([]);
  const [showEditCustomDeliverableInput, setShowEditCustomDeliverableInput] = useState(false);
  const [editCustomDeliverableName, setEditCustomDeliverableName] = useState('');
  const [isUpdatingTaskInModal, setIsUpdatingTaskInModal] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  const [projectForUpdates, setProjectForUpdates] = useState<any>(null);
  const [clientUpdates, setClientUpdates] = useState<any[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [showMentionDropdown, setShowMentionDropdown] = useState<{ updateId: string; position: number } | null>(null);
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, ClientUpdateComment[]>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});

  // Load users once (they don't change often)
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
      // Skip refresh if we just marked all as read (within last 5 seconds)
      if (skipRefreshUntilRef.current && Date.now() < skipRefreshUntilRef.current) {
        return;
      }
      loadUnreadCount();
    }, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (showAvatarDropdown || actionMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAvatarDropdown, actionMenuOpen]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Always load ALL tasks for Social Media dashboard so we can see unassigned work
      const allTasksData = await taskService.getAll();

      // Get ALL Social Media tasks first (regardless of project stage or assignment)
      // Backend TaskType for social media is "Social Media", so we must match that here
      const socialMediaTasks = allTasksData.filter((t: any) => t.type === 'Social Media');

      // Load ALL projects once, then derive what we need from here
      const allProjectsData = await projectService.getAll();
      setAllProjects(allProjectsData); // Store for modal

      // Projects that already have Social Media tasks
      const projectIdsWithSocialMediaTasks = new Set<string>(
        socialMediaTasks.map((t: any) => t.projectId)
      );
      const projectsWithSocialMediaTasks = allProjectsData.filter((p: any) =>
        projectIdsWithSocialMediaTasks.has(p.id)
      );

      // Projects that are in Social Media-related stages even if they don't have Social Media tasks yet
      const socialMediaStageProjects = allProjectsData.filter((p: any) =>
        p.stage === 'Social Media Team'
      );

      // Combine both sets of projects and de‑dupe
      const combinedProjectsMap = new Map<string, any>();
      [...projectsWithSocialMediaTasks, ...socialMediaStageProjects].forEach((p: any) => {
        combinedProjectsMap.set(p.id, p);
      });
      const combinedProjects = Array.from(combinedProjectsMap.values());

      // Limit tasks to only those that belong to the combined projects
      const visibleSocialMediaTasks = socialMediaTasks.filter((t: any) =>
        combinedProjectsMap.has(t.projectId)
      );

      // Don't load deliverable history on initial load - it's too slow!
      // Load history lazily only when needed (e.g., when checking for revisions)
      setProjects(combinedProjects);
      setTasks(visibleSocialMediaTasks);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

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
    
    // Reload the project to get fresh deliverables
    try {
      const freshProject = await projectService.getOne(task.projectId);
      // Update the project in the projects array
      setProjects((prevProjects: any[]) => 
        prevProjects.map((p: any) => p.id === task.projectId ? freshProject : p)
      );
    } catch (error) {
      console.error('Failed to reload project deliverables:', error);
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

  const handleClaimProject = async (projectId: string) => {
    if (!user?.id) {
      alert('User not found. Please log in again.');
      return;
    }

    try {
      setUpdatingTask('project-' + projectId);
      console.log('Claiming project:', projectId, 'User:', user.id);
      
      // Get all social media tasks for this project
      const projectTasks = tasks.filter((t: any) => 
        t.projectId === projectId && t.type === 'Social Media'
      );
      
      console.log('Project tasks found:', projectTasks.length);
      
      // If no tasks exist, create them first
      if (projectTasks.length === 0) {
        console.log('Creating social media tasks for project:', projectId);
        // Create social media tasks for this project
        const socialMediaTasks = [
          {
            projectId,
            title: 'Social Media Content',
            description: 'Create and manage social media content',
            type: 'Social Media',
            status: 'Todo',
            isCompleted: false,
            assignedToId: user.id,
          },
          {
            projectId,
            title: 'Social Media Review',
            description: 'Review and schedule social media posts',
            type: 'Social Media',
            status: 'Todo',
            isCompleted: false,
            assignedToId: user.id,
          },
        ];
        
        // Create tasks and assign them to current user
        const createdTasks = await Promise.all(
          socialMediaTasks.map((task) => {
            console.log('Creating task:', task);
            return taskService.create(task);
          })
        );
        console.log('Created tasks:', createdTasks);
      } else {
        // Assign all unassigned tasks to current user
        const unassignedProjectTasks = projectTasks.filter((t: any) => !t.assignedToId);
        console.log('Unassigned tasks to claim:', unassignedProjectTasks.length);
        if (unassignedProjectTasks.length > 0) {
          await Promise.all(
            unassignedProjectTasks.map((task: any) => {
              console.log('Assigning task:', task.id);
              return taskService.assign(task.id, user.id);
            })
          );
        }
      }
      
      // Reload data to show updated tasks
      console.log('Reloading data...');
      await loadData();
      console.log('Project claimed successfully!');
    } catch (error: any) {
      console.error('Failed to claim project:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      console.error('Error details:', error.response?.data);
      alert(`Failed to claim project: ${errorMessage}`);
    } finally {
      setUpdatingTask(null);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // These functions are kept for potential future use but currently not called
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleTaskSelect = (taskId: string) => {
    setSelectedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSelectAll = () => {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map((t: any) => t.id)));
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleBulkAssign = async () => {
    if (selectedTasks.size === 0 || !bulkAssignUserId) {
      alert('Please select tasks and a user to assign');
      return;
    }
    // Note: This function is not currently used but kept for future functionality
  };

  const getFilteredAndSortedTasks = () => {
    let filtered = tasks;

    // Apply filter
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

    // Apply search by task title or project/client name
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((t: any) => {
        const title = (t.title || '').toLowerCase();
        const project = projects.find((p: any) => p.id === t.projectId);
        const projectName = (project?.clientName || '').toLowerCase();
        return title.includes(q) || projectName.includes(q);
      });
    }

    // Apply sort
    filtered = [...filtered].sort((a: any, b: any) => {
      if (sortBy === 'due_date') {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      } else if (sortBy === 'priority') {
        const priorityOrder: any = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
        const projectA = projects.find((p: any) => p.id === a.projectId);
        const projectB = projects.find((p: any) => p.id === b.projectId);
        const aPriority = projectA?.priority || 'Medium';
        const bPriority = projectB?.priority || 'Medium';
        return (priorityOrder[bPriority] || 0) - (priorityOrder[aPriority] || 0);
      } else {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  };

  // Group tasks by project (for list view) - optimized with Map
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const tasksByProject = useMemo(() => {
    const filtered = getFilteredAndSortedTasks();
    const grouped = new Map<string, any[]>();
    for (const task of filtered) {
      const existing = grouped.get(task.projectId) || [];
      existing.push(task);
      grouped.set(task.projectId, existing);
    }
    // Convert to object for compatibility
    const result: Record<string, any[]> = {};
    grouped.forEach((value, key) => {
      result[key] = value;
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, filter, sortBy, user?.id, projects, searchQuery]);

  // Get projects for list view (only projects with Social Media tasks)
  const projectsForListView = useMemo(() => {
    const projectIds = new Set(tasks.map((t: any) => t.projectId));
    return projects.filter((p: any) => projectIds.has(p.id));
  }, [projects, tasks]);

  // Get task status for Kanban columns
  const getTaskStatus = (task: any): string => {
    if (task.status === 'Completed' || task.isCompleted) {
      return 'approved_completed';
    }
    
    if (task.assignedTo) {
      if (task.status === 'In Progress') {
        return 'owned_in_progress';
      }
      if (task.status === 'In Review') {
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

  // Group tasks by status for Kanban view - optimized
  const tasksByStatus = useMemo(() => {
    const filtered = getFilteredAndSortedTasks();
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

  // Get project name - optimized with Map cache
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

  // Get user name - optimized with Map cache
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

  // Load deliverables when project is selected (for add task modal)
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

  // Handle opening edit modal
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

  // Handle update task
  const handleUpdateTask = async () => {
    if (!editingTask || !editTaskData.title.trim()) {
      alert('Please enter a task title');
      return;
    }

    setIsUpdatingTaskInModal(true);
    try {
      let deliverableId = editTaskData.deliverableId;

      // If custom deliverable is being created
      if (showEditCustomDeliverableInput && editCustomDeliverableName.trim()) {
        const newDeliverable = await deliverableService.create(
          editingTask.projectId,
          'Other',
          editCustomDeliverableName.trim()
        );
        deliverableId = newDeliverable.id;
        // Reload deliverables to include the new one
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

      // Update assignment if changed
      if (editTaskData.assignedToId !== (editingTask.assignedToId || '')) {
        if (editTaskData.assignedToId) {
          await taskService.assign(editingTask.id, editTaskData.assignedToId);
        } else if (editingTask.assignedToId) {
          // Unassign by assigning to empty string (if backend supports it)
          try {
            await taskService.assign(editingTask.id, '');
          } catch (error) {
            console.warn('Failed to unassign task (may not be supported):', error);
          }
        }
      }

      // Reload tasks
      await loadData();

      // Close modal and reset
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

  // Handle create task
  const handleCreateTask = async () => {
    if (!newTaskData.projectId || !newTaskData.title.trim()) {
      alert('Please select a client and enter a task title');
      return;
    }

    setCreatingTask(true);
    try {
      let deliverableId = newTaskData.deliverableId;

      // If custom deliverable is being created
      if (showCustomDeliverableInput && customDeliverableName.trim()) {
        const newDeliverable = await deliverableService.create(
          newTaskData.projectId,
          'Other',
          customDeliverableName.trim()
        );
        deliverableId = newDeliverable.id;
        // Reload deliverables to include the new one
        const projectDeliverables = await deliverableService.getAll(newTaskData.projectId);
        setDeliverables(projectDeliverables);
      }

      const taskData: any = {
        projectId: newTaskData.projectId,
        title: newTaskData.title,
        description: newTaskData.description,
        // Backend uses "Social Media" as the enum value for Social Media tasks
        type: 'Social Media',
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

      // Reload tasks
      await loadData();

      // Reset form
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getTaskBorderColor = (status: string, isCompleted: boolean, taskInRevision: boolean) => {
    // Revision takes highest priority - red border
    if (taskInRevision) return '#dc2626'; // red
    if (isCompleted) return '#10b981'; // green
    if (status === 'In Review') return '#f59e0b'; // amber/orange
    if (status === 'In Progress') return '#3b82f6'; // blue
    if (status === 'Blocked') return '#ef4444'; // red
    return '#e5e7eb'; // default gray border
  };

  // Check if project has deliverables in revision status
  const hasRevisionDeliverables = (project: any) => {
    return project.deliverables?.some((d: any) => 
      ['Brand Book', 'Copy of Landing Page', 'Landing Page', 'Speaker Kit', 'Other'].includes(d.type) &&
      d.status === 'Revision'
    );
  };

  // Check if a specific task is in revision
  const isTaskInRevision = (task: any, project: any) => {
    // Check if task's deliverable is in revision
    if (task.deliverableId) {
      const deliverable = project.deliverables?.find((d: any) => d.id === task.deliverableId);
      if (deliverable) {
        // Check deliverable status first - this is the most reliable indicator
        if (deliverable.status === 'Revision') {
          return true;
        }
        
        // Check deliverable history for "Revision Requested" action
        // This catches cases where PM requested revision but status hasn't updated yet
        const history = deliverableHistory[deliverable.id] || [];
        if (history.length > 0) {
          // If task has been resubmitted (status is 'In Review'), it's no longer in revision
          if (task.status === 'In Review') {
            return false;
          }
          
          // Check file-specific history if task has a fileUrl
          if (task.fileUrl) {
            // Find history entries for this specific file
            const fileHistory = history.filter((h: any) => h.fileUrl === task.fileUrl);
            if (fileHistory.length > 0) {
              const latestFileHistory = fileHistory[0];
              // If latest file history is "Revision Requested", task is in revision
              if (latestFileHistory.action === 'Revision Requested') {
                return true;
              }
            }
          }
          
          // Also check general deliverable history
          // Find the most recent "Revision Requested" entry
          const revisionHistory = history.filter((h: any) => h.action === 'Revision Requested');
          if (revisionHistory.length > 0) {
            const latestRevision = revisionHistory[0];
            // If task has fileUrl, prefer matching fileUrl, but also accept general revision requests
            if (!task.fileUrl || !latestRevision.fileUrl || latestRevision.fileUrl === task.fileUrl) {
              return true;
            }
          }
        }
      }
    }
    // Don't fall back to checking project-wide revision status
    // Only mark tasks as in revision if they're specifically linked to a deliverable in revision
    return false;
  };

  // Get task-specific revision notes
  const getTaskNotes = (task: any, project: any) => {
    if (!task.deliverableId) return [];
    
    const deliverable = project.deliverables?.find((d: any) => d.id === task.deliverableId);
    if (!deliverable) return [];
    
    const history = deliverableHistory[deliverable.id] || [];
    const taskNotes: any[] = [];
    
    // Filter history entries to only include those relevant to this task
    history.forEach((h: any) => {
      if (h.notes && h.notes.trim() && h.action === 'Revision Requested') {
        // If task has a fileUrl, only include notes for that specific file
        if (task.fileUrl) {
          if (h.fileUrl === task.fileUrl) {
            taskNotes.push({
              ...h,
              deliverableType: deliverable.type || deliverable.customType,
              deliverableId: deliverable.id,
            });
          }
        } else {
          // If task doesn't have a fileUrl, include general deliverable revision notes
          // (but only if the history entry also doesn't have a specific fileUrl)
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
    
    // Sort by date (newest first)
    return taskNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isTaskOverdue = (task: any) => {
    if (!task.dueDate || task.isCompleted) return false;
    return new Date(task.dueDate) < new Date();
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getDaysUntilDue = (dueDate: string) => {
    if (!dueDate) return null;
    const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const handleViewUpdatesClick = async (project: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectForUpdates(project);
    setShowUpdatesModal(true);
    await loadClientUpdates(project.id);
  };

  const loadClientUpdates = async (projectId: string) => {
    try {
      setLoadingUpdates(true);
      const updates = await clientUpdatesService.getAllByProject(projectId);
      setClientUpdates(updates);
      // Load comments for all updates
      if (updates && updates.length > 0) {
        await Promise.all(updates.map(update => loadComments(update.id)));
      }
    } catch (error) {
      console.error('Failed to load client updates:', error);
      setClientUpdates([]);
    } finally {
      setLoadingUpdates(false);
    }
  };

  const loadComments = async (updateId: string) => {
    try {
      setLoadingComments({ ...loadingComments, [updateId]: true });
      const commentsData = await clientUpdatesService.getComments(updateId);
      setComments({ ...comments, [updateId]: commentsData });
    } catch (error) {
      console.error('Failed to load comments:', error);
      if ((error as any)?.response?.status !== 404) {
        console.error('Error loading comments:', error);
      }
    } finally {
      setLoadingComments({ ...loadingComments, [updateId]: false });
    }
  };

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const matches = text.match(mentionRegex);
    if (!matches) return [];
    
    const mentionedUserIds: string[] = [];
    matches.forEach(match => {
      const username = match.substring(1);
      const user = users.find(u => u.name === username);
      if (user) {
        mentionedUserIds.push(user.id);
      }
    });
    return mentionedUserIds;
  };

  const handleCommentInput = (updateId: string, text: string, cursorPos?: number) => {
    setCommentTexts({ ...commentTexts, [updateId]: text });
    
    // Check for @ mentions
    const textBeforeCursor = text.substring(0, cursorPos || text.length);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Show dropdown if @ is followed by no space (still typing username)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setShowMentionDropdown({ updateId, position: lastAtIndex + 1 });
      } else {
        setShowMentionDropdown(null);
      }
    } else {
      setShowMentionDropdown(null);
    }
  };

  const handleAddComment = async (updateId: string) => {
    const comment = commentTexts[updateId]?.trim();
    if (!comment) return;

    try {
      setSubmittingComment({ ...submittingComment, [updateId]: true });
      const mentionedUserIds = extractMentions(comment);
      await clientUpdatesService.createComment(updateId, comment, mentionedUserIds.length > 0 ? mentionedUserIds : undefined);
      await loadComments(updateId);
      setCommentTexts({ ...commentTexts, [updateId]: '' });
    } catch (error: any) {
      console.error('Failed to add comment:', error);
      alert(`Failed to add comment: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
    } finally {
      setSubmittingComment({ ...submittingComment, [updateId]: false });
    }
  };

  // Department menu items with icons
  const departmentMenuItems = [
    { id: 'Copy Writing', name: 'Copy Writing', icon: FaCopy, color: '#667eea' },
    { id: 'Design', name: 'Design', icon: FaPalette, color: '#f59e0b' },
    { id: 'Development', name: 'Development', icon: FaCode, color: '#10b981' },
    { id: 'AI Team', name: 'AI Team', icon: FaRobot, color: '#8b5cf6' },
    { id: 'Social Media Team', name: 'Social Media', icon: FaShareAlt, color: '#ec4899' },
    { id: 'CRM', name: 'CRM', icon: FaDatabase, color: '#06b6d4' },
    { id: 'SEO/GEO Team', name: 'SEO/GEO', icon: FaSearch, color: '#14b8a6' },
    { id: 'Onboarding', name: 'Onboarding', icon: FaClipboardList, color: '#6366f1' },
  ];

  if (loading) {
    return (
      <div className="dashboard" style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
        padding: '2rem'
      }}>
        <div style={{
          textAlign: 'center',
          color: 'white'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid rgba(255, 255, 255, 0.3)',
            borderTop: '4px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1.5rem'
          }}></div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            margin: '0 0 0.5rem 0',
            color: 'white'
          }}>
            Loading Social Media Dashboard
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

  const myTasks = tasks.filter((t: any) => t.assignedToId === user?.id);

  return (
    <div className="dashboard premium" style={{ display: 'flex', minHeight: '100vh', padding: 0 }}>
      {/* Sidebar Menu - Read-only, shows current department only */}
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
          background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(219, 39, 119, 0.1) 100%)'
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
            Social Media Team
          </p>
        </div>

        {/* Department List - Only show Social Media Team */}
        <div style={{
          padding: '1rem 0.75rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {departmentMenuItems.filter(item => item.id === 'Social Media Team').map((item) => {
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
                background: 'rgba(236, 72, 153, 0.2)',
                color: 'rgba(255, 255, 255, 0.9)',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(236, 72, 153, 0.3)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(236, 72, 153, 0.2)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
              }}
            >
              View All
            </button>
          </div>
          {(() => {
            // Get projects where user has assigned tasks
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
                        e.currentTarget.style.borderLeftColor = '#ec4899';
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
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ec4899' }}></span>
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
          background: 'rgba(0, 0, 0, 0.2)'
        }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              width: '100%',
              padding: '0.875rem 1rem',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'rgba(255, 255, 255, 0.8)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
            }}
          >
            <FaArrowLeft style={{ fontSize: '0.875rem' }} />
            Back to Dashboard
          </button>
        </div>

        <style>{`
          @keyframes pulse-dot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(0.8); }
          }
          .dashboard.premium > div:first-child::-webkit-scrollbar {
            width: 6px;
          }
          .dashboard.premium > div:first-child::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
          }
          .dashboard.premium > div:first-child::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
          }
          .dashboard.premium > div:first-child::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
          }
        `}</style>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto', background: '#f8fafc' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 16px #ec489930'
            }}>
              <FaShareAlt style={{ fontSize: '1.5rem', color: 'white' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>
                Social Media Department
              </h1>
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                {getGreeting()}, {user?.name?.split(' ')[0]} • {myTasks.length} {myTasks.length === 1 ? 'task' : 'tasks'} assigned to you
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => setShowNotificationsModal(true)}
              style={{
                position: 'relative',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                fontSize: '1.25rem',
                transition: 'color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#10b981';
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
                      ? '#dc2626'
                      : unreadNotifications >= 5 
                      ? '#f59e0b'
                      : '#ec4899',
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
            <button
              onClick={() => setShowAddTaskModal(true)}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderRadius: '0.5rem',
                background: '#ec4899',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 600,
                fontSize: '0.9375rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#db2777';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ec4899';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <FaPlus /> Add New Task
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
                    {unreadNotifications > 0 && (
                      <span className="notification-badge">{unreadNotifications}</span>
                    )}
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

        {/* Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Projects</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>{projects.length}</div>
          </div>
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Active Tasks</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>{tasks.length}</div>
          </div>
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>My Tasks</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>{myTasks.length}</div>
          </div>
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Unassigned Tasks</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>
              {tasks.filter((t: any) => !t.assignedTo).length}
            </div>
          </div>
        </div>


        {/* View Toggle and Filters */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e293b', margin: 0, flex: 1 }}>
            Tasks by {viewMode === 'kanban' ? 'Status' : 'Project'}
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '0.5rem' }}>
              <button
                onClick={() => setViewMode('kanban')}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '0.375rem',
                  background: viewMode === 'kanban' ? 'white' : 'transparent',
                  color: viewMode === 'kanban' ? '#1e293b' : '#64748b',
                  cursor: 'pointer',
                  fontWeight: viewMode === 'kanban' ? 600 : 400,
                  boxShadow: viewMode === 'kanban' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
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
                  borderRadius: '0.375rem',
                  background: viewMode === 'list' ? 'white' : 'transparent',
                  color: viewMode === 'list' ? '#1e293b' : '#64748b',
                  cursor: 'pointer',
                  fontWeight: viewMode === 'list' ? 600 : 400,
                  boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                List
              </button>
            </div>
            <div style={{ 
              display: 'flex', 
              gap: '0.5rem', 
              alignItems: 'center', 
              flexWrap: 'wrap' 
            }}>
              <div style={{ 
                position: 'relative', 
                minWidth: '220px', 
                maxWidth: '260px' 
              }}>
                <FaSearch 
                  style={{ 
                    position: 'absolute', 
                    left: '0.75rem', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: '#94a3b8', 
                    fontSize: '0.875rem' 
                  }} 
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by client or task"
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    outline: 'none'
                  }}
                />
              </div>
              <FaFilter style={{ color: '#64748b', fontSize: '0.875rem' }} />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Tasks</option>
                <option value="my_tasks">My Tasks</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="completed">Completed</option>
              </select>
              <FaSort style={{ color: '#64748b', fontSize: '0.875rem', marginLeft: '0.5rem' }} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                <option value="due_date">Sort by Due Date</option>
                <option value="priority">Sort by Priority</option>
                <option value="created">Sort by Created</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tasks Display */}
        <div>
          {tasks.length === 0 ? (
            <div style={{
              background: 'white',
              padding: '3rem',
              borderRadius: '0.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
              color: '#64748b'
            }}>
              <FaFileAlt style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>
                No active tasks in Social Media
              </h3>
              <p>Tasks will appear here when projects are moved to Social Media Team stage.</p>
            </div>
          ) : viewMode === 'kanban' ? (
            /* Kanban View */
            <div>
              <div style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                background: '#f0f4ff',
                border: '1px solid #c7d2fe',
                borderRadius: '8px',
                fontSize: '0.875rem',
                color: '#4c51bf',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '1rem' }}>💡</span>
                <span><strong>Tip:</strong> Drag tasks across columns to update their status. Click "Claim Task" on unassigned tasks to assign them to yourself.</span>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '1.5rem',
                paddingBottom: '1rem',
                paddingTop: '0.5rem',
                width: '100%',
                minHeight: '400px'
              }} className="department-kanban-container">
                {[
                  { id: 'not_started', title: 'Not yet started' },
                  { id: 'owned_in_progress', title: 'Owned/In Progress' },
                  { id: 'for_approval', title: 'For Approval' },
                  { id: 'revision', title: 'Revision' },
                  { id: 'elliot_review', title: 'Elliot Review' },
                  { id: 'approved_completed', title: 'Approved/Completed' },
                  { id: 'qa_before_client', title: 'QA Before Sending to Client' },
                  { id: 'client_validation', title: 'Client Validation' }
                ].map((column) => {
                  const columnTasks = tasksByStatus[column.id] || [];
                  const isDragOver = dragOverColumn === column.id;
                  
                  return (
                    <div
                      key={column.id}
                      className="department-kanban-column"
                      style={{
                        width: '100%',
                        background: 'white',
                        borderRadius: '0.5rem',
                        boxShadow: isDragOver ? '0 4px 12px rgba(236, 72, 153, 0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
                        border: isDragOver ? '2px solid #ec4899' : '2px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.2s',
                        height: 'fit-content',
                        maxHeight: 'calc(100vh - 300px)',
                        position: 'relative'
                      }}
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
                        
                        try {
                          const task = tasks.find((t: any) => t.id === draggedTask);
                          if (!task) return;
                          
                          let newStatus = task.status;
                          if (column.id === 'revision') {
                            newStatus = 'Revision';
                          } else if (column.id === 'elliot_review') {
                            newStatus = 'Elliot Review';
                          } else if (column.id === 'approved_completed') {
                            newStatus = 'Completed';
                          } else if (column.id === 'qa_before_client') {
                            newStatus = 'QA Review';
                          } else if (column.id === 'client_validation') {
                            newStatus = 'Client Review';
                          } else if (column.id === 'for_approval') {
                            newStatus = 'For Approval';
                          } else if (column.id === 'owned_in_progress') {
                            newStatus = 'In Progress';
                          } else if (column.id === 'not_started') {
                            newStatus = 'Todo';
                          }
                          
                          await taskService.updateStatus(task.id, newStatus, column.id === 'approved_completed');
                          await loadData();
                        } catch (error) {
                          console.error('Failed to update task status:', error);
                          alert('Failed to update task status. Please try again.');
                        }
                      }}
                    >
                      <div
                        style={{
                          padding: '1rem',
                          background: '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                          borderRadius: '0.5rem 0.5rem 0 0'
                        }}
                      >
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', margin: '0 0 0.25rem 0' }}>
                          {column.title}
                        </h3>
                        <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                          {columnTasks.length} task(s)
                        </span>
                      </div>
                      <div style={{
                        padding: '0.75rem',
                        flex: 1,
                        overflowY: 'auto',
                        minHeight: '200px',
                        maxHeight: 'calc(100vh - 400px)'
                      }} className="department-kanban-column-content">
                        {columnTasks.map((task: any) => {
                          const projectName = getProjectName(task.projectId);
                          const project = projects.find((p: any) => p.id === task.projectId);
                          const taskInRevision = project ? isTaskInRevision(task, project) : false;
                          const taskNotes = project ? getTaskNotes(task, project) : [];
                          
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
                                border: taskInRevision ? '2px solid #dc2626' : '1px solid #e2e8f0',
                                borderRadius: '0.5rem',
                                background: selectedTasks.has(task.id) ? '#f0f4ff' : 'white',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                position: 'relative',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                              }}
                              onClick={(e) => {
                                const target = e.target as HTMLElement;
                                
                                // FIRST: Check if click is on the edit button or any button - this must be checked first!
                                if (target.closest('button[data-edit-task]') || 
                                    target.closest('button') ||
                                    target.tagName === 'BUTTON' ||
                                    (target.tagName === 'svg' && target.closest('button')) ||
                                    (target.tagName === 'path' && target.closest('button'))) {
                                  // Button click - let the button handle it, don't navigate
                                  return;
                                }
                                
                                // Check if click is on other interactive elements
                                if (target.closest('input[type="checkbox"]') || 
                                    target.closest('select') || 
                                    target.tagName === 'INPUT' || 
                                    target.tagName === 'SELECT') {
                                  return;
                                }
                                
                                // If we get here, it's a card click - navigate to project
                                navigate(`/project/${task.projectId}`);
                              }}
                              onMouseEnter={(e) => {
                                if (!selectedTasks.has(task.id)) {
                                  e.currentTarget.style.background = '#f8fafc';
                                  e.currentTarget.style.borderColor = '#ec4899';
                                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(236, 72, 153, 0.15)';
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!selectedTasks.has(task.id)) {
                                  e.currentTarget.style.background = 'white';
                                  e.currentTarget.style.borderColor = taskInRevision ? '#dc2626' : '#e2e8f0';
                                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }
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
                                      color: '#ec4899',
                                      fontWeight: 500
                                    }}>
                                      {projectName}
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
                                        border: '1px solid #ec4899',
                                        color: '#ec4899',
                                        cursor: 'pointer',
                                        padding: '0.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '4px',
                                        transition: 'all 0.2s',
                                        zIndex: 100,
                                        position: 'relative',
                                        outline: 'none',
                                        minWidth: '36px',
                                        minHeight: '36px'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#fdf2f8';
                                        e.currentTarget.style.color = '#db2777';
                                        e.currentTarget.style.borderColor = '#db2777';
                                        e.currentTarget.style.transform = 'scale(1.1)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = '#ec4899';
                                        e.currentTarget.style.borderColor = '#ec4899';
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
                                      color: '#1e293b',
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
                                      background: task.status === 'Completed' ? '#d1fae5' : '#fef3c7',
                                      color: task.status === 'Completed' ? '#065f46' : '#92400e',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {task.status}
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
                                    marginBottom: '0.5rem'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      <FaUser style={{ fontSize: '0.75rem' }} />
                                      <span>{getUserName(task.assignedTo || '')}</span>
                                    </div>
                                    {task.dueDate && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <FaClock style={{ fontSize: '0.75rem' }} />
                                        <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                                      </div>
                                    )}
                                  </div>
                                  {!task.assignedTo && (
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
                                        background: '#ec4899',
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
                                  )}
                                  {task.assignedTo && (
                                    <>
                                      <div style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '0.375rem',
                                        fontSize: '0.75rem',
                                        color: '#64748b',
                                        textAlign: 'center',
                                        background: task.assignedToId === user?.id ? '#d1fae5' : '#f3f4f6',
                                        marginBottom: '0.5rem'
                                      }}>
                                        {task.assignedToId === user?.id ? 'Assigned to you' : `Assigned to ${getUserName(task.assignedTo)}`}
                                      </div>
                                      {!task.isCompleted && task.assignedToId === user?.id && (
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
                                          {(task.status === 'In Progress' || (hasRevisionDeliverables(project) && task.status === 'In Review')) && (
                                            <>
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
                                                {updatingTask === task.id ? <FaSpinner className="spinner" /> : hasRevisionDeliverables(project) ? 'Resubmit' : 'Send for Review'}
                                              </button>
                                              {!hasRevisionDeliverables(project) && (
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
                                                    background: '#ec4899',
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
                                          {task.status === 'In Review' && !hasRevisionDeliverables(project) && (
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
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* List View - Table Format */
            <div style={{ background: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {projectsForListView.length === 0 ? (
                <div className="empty-list" style={{ padding: '3rem', textAlign: 'center' }}>
                  <FaFolder style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }} />
                  <p>No projects with Social Media tasks found.</p>
                </div>
              ) : (
                <>
                  <div className="list-header">
                    <div className="list-header-cell" style={{ flex: '2', minWidth: '200px' }}>Project Name</div>
                    <div className="list-header-cell" style={{ width: '120px', flex: '0 0 120px' }}>Client Type</div>
                    <div className="list-header-cell" style={{ width: '100px', flex: '0 0 100px' }}>Priority</div>
                    <div className="list-header-cell" style={{ width: '120px', flex: '0 0 120px' }}>Stage</div>
                    <div className="list-header-cell" style={{ width: '120px', flex: '0 0 120px' }}>Days in Stage</div>
                    <div className="list-header-cell" style={{ width: '120px', flex: '0 0 120px' }}>Tasks</div>
                    <div className="list-header-cell" style={{ width: '120px', flex: '0 0 120px', textAlign: 'center' }}>Update</div>
                    <div className="list-header-cell" style={{ width: '120px', flex: '0 0 120px', textAlign: 'center' }}>Actions</div>
                  </div>
                  <div className="list-content">
                    {projectsForListView.map((project: any) => {
                      const projectTasks = tasks.filter((t: any) => t.projectId === project.id);
                      const daysInStage = project.updatedAt
                        ? Math.ceil((Date.now() - new Date(project.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
                        : 0;
                      const hasAssignedTasks = projectTasks.some((t: any) => t.assignedToId);
                      const hasUnassignedTasks = projectTasks.some((t: any) => !t.assignedToId);
                      const canClaimProject = !hasAssignedTasks && (projectTasks.length === 0 || hasUnassignedTasks);
                      
                      return (
                        <div 
                          key={project.id} 
                          className="list-row"
                          onClick={() => navigate(`/project/${project.id}`)}
                        >
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
                          <div className="list-cell" style={{ width: '120px', flex: '0 0 120px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                                {projectTasks.length} {projectTasks.length === 1 ? 'task' : 'tasks'}
                              </span>
                              {projectTasks.some((t: any) => !t.assignedToId) && (
                                <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 500 }}>
                                  {projectTasks.filter((t: any) => !t.assignedToId).length} unassigned
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="list-cell" style={{ width: '120px', flex: '0 0 120px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <button
                              onClick={(e) => handleViewUpdatesClick(project, e)}
                              style={{
                                background: '#667eea',
                                color: 'white',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                borderRadius: '0.375rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#5568d3';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#667eea';
                              }}
                            >
                              <FaEnvelope style={{ fontSize: '0.875rem' }} />
                              View
                            </button>
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
                                  {canClaimProject && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActionMenuOpen(null);
                                        handleClaimProject(project.id);
                                      }}
                                      disabled={updatingTask === 'project-' + project.id}
                                      style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        background: 'transparent',
                                        border: 'none',
                                        textAlign: 'left',
                                        cursor: updatingTask === 'project-' + project.id ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        fontSize: '0.875rem',
                                        color: '#374151',
                                        transition: 'background 0.15s',
                                        opacity: updatingTask === 'project-' + project.id ? 0.5 : 1,
                                      }}
                                      onMouseEnter={(e) => {
                                        if (updatingTask !== 'project-' + project.id) {
                                          e.currentTarget.style.background = '#f8fafc';
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                      }}
                                    >
                                      {updatingTask === 'project-' + project.id ? (
                                        <FaSpinner className="spinner" style={{ fontSize: '0.875rem' }} />
                                      ) : (
                                        <FaHandPaper style={{ fontSize: '0.875rem', color: '#ec4899' }} />
                                      )}
                                      Claim Project
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Modals */}
        <NotificationsModal
          isOpen={showNotificationsModal}
          onClose={() => {
            setShowNotificationsModal(false);
          }}
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
        <SendForReviewModal
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedTaskForReview(null);
          }}
          onSubmit={handleReviewSubmit}
          taskTitle={selectedTaskForReview?.title || ''}
          projectDeliverables={selectedTaskForReview ? (projects.find((p: any) => p.id === selectedTaskForReview.projectId)?.deliverables || []) : []}
          loading={updatingTask === selectedTaskForReview?.id}
          taskDeliverableId={selectedTaskForReview?.deliverableId}
        />
        
        {/* Add New Task Modal */}
        {showAddTaskModal && (
          <div
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
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '2rem',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: '#111827' }}>
                  Add New Task
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
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.5rem',
                    color: '#6b7280',
                    padding: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FaTimes />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}>
                    Select Client (Project) *
                  </label>
                  <select
                    value={newTaskData.projectId}
                    onChange={(e) => setNewTaskData({ ...newTaskData, projectId: e.target.value, deliverableId: '' })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="">Select a client...</option>
                    {allProjects.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.clientName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}>
                    Task Title *
                  </label>
                  <input
                    type="text"
                    value={newTaskData.title}
                    onChange={(e) => setNewTaskData({ ...newTaskData, title: e.target.value })}
                    placeholder="Enter task title"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}>
                    Description
                  </label>
                  <textarea
                    value={newTaskData.description}
                    onChange={(e) => setNewTaskData({ ...newTaskData, description: e.target.value })}
                    placeholder="Enter task description"
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}>
                    Deliverable
                  </label>
                  {!showCustomDeliverableInput ? (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select
                        value={newTaskData.deliverableId}
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            setShowCustomDeliverableInput(true);
                          } else {
                            setNewTaskData({ ...newTaskData, deliverableId: e.target.value });
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem'
                        }}
                      >
                        <option value="">No deliverable</option>
                        {deliverables.map((d: any) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                        <option value="custom">+ Create custom deliverable</option>
                      </select>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        value={customDeliverableName}
                        onChange={(e) => setCustomDeliverableName(e.target.value)}
                        placeholder="Enter custom deliverable name"
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem'
                        }}
                      />
                      <button
                        onClick={() => {
                          setShowCustomDeliverableInput(false);
                          setCustomDeliverableName('');
                          setNewTaskData({ ...newTaskData, deliverableId: '' });
                        }}
                        style={{
                          padding: '0.75rem 1rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.5rem',
                          background: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newTaskData.dueDate}
                    onChange={(e) => setNewTaskData({ ...newTaskData, dueDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}>
                    Assign To
                  </label>
                  <select
                    value={newTaskData.assignedToId}
                    onChange={(e) => setNewTaskData({ ...newTaskData, assignedToId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
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
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      background: 'white',
                      cursor: 'pointer',
                      fontWeight: 500
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
                      borderRadius: '0.5rem',
                      background: creatingTask || !newTaskData.projectId || !newTaskData.title.trim() ? '#cbd5e1' : '#10b981',
                      color: 'white',
                      cursor: creatingTask || !newTaskData.projectId || !newTaskData.title.trim() ? 'not-allowed' : 'pointer',
                      fontWeight: 500
                    }}
                  >
                    {creatingTask ? 'Creating...' : 'Create Task'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes and Attachments Modal */}
        {/* Task Notes Modal */}
        {showNotesModal && (
          <div 
            className="modal-overlay" 
            onClick={() => {
              setShowNotesModal(false);
              setSelectedTaskNotes([]);
              setSelectedTaskTitle('');
            }}
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
              zIndex: 1000
            }}
          >
            <div 
              className="modal-content" 
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '2rem',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: '#111827' }}>
                  Revision Notes - {selectedTaskTitle}
                </h2>
                <button
                  onClick={() => {
                    setShowNotesModal(false);
                    setSelectedTaskNotes([]);
                    setSelectedTaskTitle('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.5rem',
                    color: '#6b7280',
                    padding: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FaTimes />
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {selectedTaskNotes.map((note, idx) => {
                  const notes = note.notes || '';
                  const attachmentMatch = notes.match(/Attachment:\s*(https?:\/\/[^\s]+)/i);
                  const hasAttachment = !!attachmentMatch;
                  const notesText = attachmentMatch 
                    ? notes.replace(/Attachment:\s*https?:\/\/[^\s]+/i, '').trim()
                    : notes.trim();
                  const attachmentUrl = attachmentMatch ? attachmentMatch[1] : null;
                  
                  return (
                    <div 
                      key={idx}
                      style={{
                        padding: '1rem',
                        background: '#fef3c7',
                        border: '1px solid #fde68a',
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FaStickyNote style={{ color: '#f59e0b', fontSize: '1rem' }} />
                        <strong style={{ color: '#92400e', fontSize: '0.875rem' }}>
                          {note.deliverableType || 'Revision Note'}
                        </strong>
                        <span style={{ color: '#9ca3af', fontSize: '0.75rem', marginLeft: 'auto' }}>
                          {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {notesText && (
                        <div style={{ marginBottom: hasAttachment ? '0.75rem' : 0, color: '#92400e', fontSize: '0.875rem', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                          {notesText}
                        </div>
                      )}
                      
                      {hasAttachment && attachmentUrl && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'white', borderRadius: '4px' }}>
                          <FaLink style={{ color: '#667eea', fontSize: '0.875rem' }} />
                          <a 
                            href={attachmentUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ 
                              color: '#667eea', 
                              textDecoration: 'underline', 
                              wordBreak: 'break-all',
                              fontSize: '0.875rem'
                            }}
                          >
                            {attachmentUrl}
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Edit Task Modal */}
        {showEditTaskModal && editingTask && (
          <div 
            className="modal-overlay" 
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
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              backdropFilter: 'blur(4px)'
            }}
          >
            <div 
              className="edit-task-modal" 
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '640px',
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                margin: '1rem'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '2rem 2.5rem 1.5rem 2.5rem',
                borderBottom: '1px solid #f3f4f6'
              }}>
                <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#111827' }}>
                  Edit Task - {getProjectName(editingTask.projectId)}
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
                    background: 'none',
                    border: 'none',
                    color: '#6b7280',
                    cursor: 'pointer',
                    fontSize: '1.25rem',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.color = '#111827';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'none';
                    e.currentTarget.style.color = '#6b7280';
                  }}
                >
                  <FaTimes />
                </button>
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '2rem 2.5rem',
                gap: '2rem',
                overflowY: 'auto',
                flex: 1
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem' }}>
                    Task Title *
                  </label>
                  <input
                    type="text"
                    value={editTaskData.title}
                    onChange={(e) => setEditTaskData({ ...editTaskData, title: e.target.value })}
                    required
                    placeholder="Enter task title"
                    style={{
                      padding: '1rem 1.25rem',
                      border: '1.5px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '1rem',
                      transition: 'all 0.2s',
                      background: '#ffffff',
                      color: '#111827',
                      fontFamily: 'inherit'
                    }}
                    onFocus={(e) => {
                      e.target.style.outline = 'none';
                      e.target.style.borderColor = '#10b981';
                      e.target.style.boxShadow = '0 0 0 4px rgba(16, 185, 129, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem' }}>
                    Description
                  </label>
                  <textarea
                    value={editTaskData.description}
                    onChange={(e) => setEditTaskData({ ...editTaskData, description: e.target.value })}
                    rows={4}
                    placeholder="Enter task description"
                    style={{
                      padding: '1rem 1.25rem',
                      border: '1.5px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '1rem',
                      transition: 'all 0.2s',
                      background: '#ffffff',
                      color: '#111827',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      minHeight: '120px',
                      lineHeight: '1.6'
                    }}
                    onFocus={(e) => {
                      e.target.style.outline = 'none';
                      e.target.style.borderColor = '#10b981';
                      e.target.style.boxShadow = '0 0 0 4px rgba(16, 185, 129, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem' }}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={editTaskData.dueDate}
                    onChange={(e) => setEditTaskData({ ...editTaskData, dueDate: e.target.value })}
                    style={{
                      padding: '1rem 1.25rem',
                      border: '1.5px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '1rem',
                      transition: 'all 0.2s',
                      background: '#ffffff',
                      color: '#111827',
                      fontFamily: 'inherit'
                    }}
                    onFocus={(e) => {
                      e.target.style.outline = 'none';
                      e.target.style.borderColor = '#10b981';
                      e.target.style.boxShadow = '0 0 0 4px rgba(16, 185, 129, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem' }}>
                    Associate with Deliverable (Optional)
                  </label>
                  <select
                    value={showEditCustomDeliverableInput ? 'custom' : editTaskData.deliverableId}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setShowEditCustomDeliverableInput(true);
                        setEditTaskData({ ...editTaskData, deliverableId: '' });
                      } else {
                        setShowEditCustomDeliverableInput(false);
                        setEditCustomDeliverableName('');
                        setEditTaskData({ ...editTaskData, deliverableId: e.target.value });
                      }
                    }}
                    style={{
                      padding: '1rem 1.25rem',
                      border: '1.5px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '1rem',
                      transition: 'all 0.2s',
                      background: '#ffffff',
                      color: '#111827',
                      cursor: 'pointer',
                      appearance: 'none',
                      backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E\")",
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 1rem center',
                      backgroundSize: '1.25em 1.25em',
                      paddingRight: '3rem'
                    }}
                    onFocus={(e) => {
                      e.target.style.outline = 'none';
                      e.target.style.borderColor = '#10b981';
                      e.target.style.boxShadow = '0 0 0 4px rgba(16, 185, 129, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <option value="">None</option>
                    {editDeliverables.map((deliverable) => (
                      <option key={deliverable.id} value={deliverable.id}>
                        {deliverable.name || deliverable.customType || deliverable.type}
                      </option>
                    ))}
                    <option value="custom">➕ Add Custom Deliverable</option>
                  </select>
                  {showEditCustomDeliverableInput && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                      <input
                        type="text"
                        placeholder="Enter custom deliverable name (e.g., Email Templates, Social Media Posts)"
                        value={editCustomDeliverableName}
                        onChange={(e) => setEditCustomDeliverableName(e.target.value)}
                        autoFocus
                        style={{
                          flex: 1,
                          padding: '1rem 1.25rem',
                          border: '1.5px solid #10b981',
                          borderRadius: '10px',
                          fontSize: '1rem',
                          transition: 'all 0.2s',
                          background: '#ffffff',
                          color: '#111827',
                          fontFamily: 'inherit'
                        }}
                        onFocus={(e) => {
                          e.target.style.outline = 'none';
                          e.target.style.borderColor = '#10b981';
                          e.target.style.boxShadow = '0 0 0 4px rgba(16, 185, 129, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#10b981';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditCustomDeliverableInput(false);
                          setEditCustomDeliverableName('');
                          setEditTaskData({ ...editTaskData, deliverableId: '' });
                        }}
                        style={{
                          background: '#f3f4f6',
                          border: '1.5px solid #e5e7eb',
                          color: '#6b7280',
                          cursor: 'pointer',
                          padding: '1rem',
                          borderRadius: '10px',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '48px',
                          height: '48px',
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#e5e7eb';
                          e.currentTarget.style.color = '#374151';
                          e.currentTarget.style.borderColor = '#d1d5db';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#f3f4f6';
                          e.currentTarget.style.color = '#6b7280';
                          e.currentTarget.style.borderColor = '#e5e7eb';
                        }}
                      >
                        <FaTimes />
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem' }}>
                    Assign To (Optional)
                  </label>
                  <select
                    value={editTaskData.assignedToId}
                    onChange={(e) => setEditTaskData({ ...editTaskData, assignedToId: e.target.value })}
                    style={{
                      padding: '1rem 1.25rem',
                      border: '1.5px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '1rem',
                      transition: 'all 0.2s',
                      background: '#ffffff',
                      color: '#111827',
                      cursor: 'pointer',
                      appearance: 'none',
                      backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E\")",
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 1rem center',
                      backgroundSize: '1.25em 1.25em',
                      paddingRight: '3rem'
                    }}
                    onFocus={(e) => {
                      e.target.style.outline = 'none';
                      e.target.style.borderColor = '#10b981';
                      e.target.style.boxShadow = '0 0 0 4px rgba(16, 185, 129, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
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
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                padding: '2rem 2.5rem',
                borderTop: '1px solid #f3f4f6',
                marginTop: 'auto',
                gap: '0.875rem'
              }}>
                <button
                  type="button"
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
                  disabled={isUpdatingTaskInModal}
                  style={{
                    background: '#ffffff',
                    color: '#374151',
                    border: '1.5px solid #e5e7eb',
                    padding: '0.875rem 1.75rem',
                    borderRadius: '10px',
                    fontWeight: 600,
                    fontSize: '0.9375rem',
                    cursor: isUpdatingTaskInModal ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    opacity: isUpdatingTaskInModal ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isUpdatingTaskInModal) {
                      e.currentTarget.style.background = '#f9fafb';
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isUpdatingTaskInModal) {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateTask}
                  disabled={isUpdatingTaskInModal || !editTaskData.title.trim()}
                  style={{
                    background: isUpdatingTaskInModal || !editTaskData.title.trim() ? '#cbd5e1' : '#10b981',
                    color: 'white',
                    border: 'none',
                    padding: '0.875rem 1.75rem',
                    borderRadius: '10px',
                    fontWeight: 600,
                    fontSize: '0.9375rem',
                    cursor: isUpdatingTaskInModal || !editTaskData.title.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s',
                    opacity: isUpdatingTaskInModal || !editTaskData.title.trim() ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isUpdatingTaskInModal && editTaskData.title.trim()) {
                      e.currentTarget.style.background = '#059669';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isUpdatingTaskInModal && editTaskData.title.trim()) {
                      e.currentTarget.style.background = '#10b981';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  <FaSave /> {isUpdatingTaskInModal ? 'Updating...' : 'Update Task'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Updates Modal */}
        {showUpdatesModal && projectForUpdates && (
          <>
            <div
              onClick={() => {
                setShowUpdatesModal(false);
                setProjectForUpdates(null);
                setClientUpdates([]);
                setCommentTexts({});
                setShowMentionDropdown(null);
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
                    PM Updates
                  </h2>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                    {projectForUpdates.clientName}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowUpdatesModal(false);
                    setProjectForUpdates(null);
                    setClientUpdates([]);
                    setCommentTexts({});
                    setShowMentionDropdown(null);
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

              {/* Body */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1.5rem',
              }}>
                {loadingUpdates ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    Loading updates...
                  </div>
                ) : clientUpdates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    <FaEnvelope style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }} />
                    <p>No updates from PM yet.</p>
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
                        {/* Update Header */}
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
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Add Comment Section */}
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
                                users.map((userItem: any) => (
                                  <div
                                    key={userItem.id}
                                    onClick={() => {
                                      const currentText = commentTexts[update.id] || '';
                                      const beforeCursor = currentText.substring(0, showMentionDropdown.position - 1);
                                      const afterCursor = currentText.substring(showMentionDropdown.position);
                                      const newText = `${beforeCursor}@${userItem.name} ${afterCursor}`;
                                      setCommentTexts({ ...commentTexts, [update.id]: newText });
                                      setShowMentionDropdown(null);
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
                                    {userItem.name} ({userItem.role || 'User'})
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
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                            }}
                          >
                            <FaPaperPlane style={{ fontSize: '0.875rem' }} />
                            {submittingComment[update.id] ? 'Posting...' : 'Post Comment'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SocialMediaDashboard;
