import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaUser, FaClock, FaPlus, FaTimes, FaCopy, FaPalette, FaCode, FaRobot, FaShareAlt, FaDatabase, FaSearch, FaClipboardList, FaUpload, FaFileExcel, FaSave, FaEdit, FaStickyNote, FaLink, FaEnvelope } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import { authService } from '../services/auth.service';
import { deliverableService } from '../services/deliverable.service';
import { clientUpdatesService, ClientUpdateComment } from '../services/client-updates.service';
import { notificationService } from '../services/notification.service';
import { useFocusRefetch } from '../hooks/useFocusRefetch';
import TaskDetailSideModal from './TaskDetailSideModal';
import './Dashboard.css';

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

const DepartmentView: React.FC = () => {
  const { department } = useParams<{ department: string }>();
  const navigate = useNavigate();
  
  const [projects, setProjects] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]); // All projects for task creation
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const allProjectsCacheRef = useRef<any[]>([]); // Cache all projects
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [bulkAssignUserId, setBulkAssignUserId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [kanbanColumnSort, setKanbanColumnSort] = useState<Record<string, KanbanColumnSortOrder>>({});
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
  const [markTaskCompleteOnCreate, setMarkTaskCompleteOnCreate] = useState(false);
  
  // Searchable client dropdown states
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  
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
  const [updatingTask, setUpdatingTask] = useState(false);
  
  // Excel import states
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [excelPreview, setExcelPreview] = useState<any[]>([]);
  const [uploadingTasks, setUploadingTasks] = useState(false);
  const [importError, setImportError] = useState('');
  
  // Template task states
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [taskTemplates, setTaskTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templateData, setTemplateData] = useState({
    name: '',
    title: '',
    description: '',
    deliverableType: '',
    defaultStatus: 'Todo'
  });
  
  // Forward task modal states (for CRM)
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardingTask, setForwardingTask] = useState<any>(null);
  const [forwardData, setForwardData] = useState({
    targetDepartment: '',
    notes: '',
    links: ''
  });
  const [forwarding, setForwarding] = useState(false);
  
  // Client Validation modal states (for CRM)
  const [showClientValidationModal, setShowClientValidationModal] = useState(false);
  const [taskForClientValidation, setTaskForClientValidation] = useState<any>(null);
  const [projectForClientValidation, setProjectForClientValidation] = useState<any>(null);
  const [clientValidationNotes, setClientValidationNotes] = useState('');
  const [clientValidationLinks, setClientValidationLinks] = useState<string[]>(['']);
  const [loggingClientValidation, setLoggingClientValidation] = useState(false);
  const [clientValidationTab, setClientValidationTab] = useState<'logs' | 'new'>('logs');
  const [clientValidationUpdates, setClientValidationUpdates] = useState<any[]>([]);
  const [loadingClientValidationUpdates, setLoadingClientValidationUpdates] = useState(false);
  const [clientValidationCommentTexts, setClientValidationCommentTexts] = useState<Record<string, string>>({});
  const [showClientValidationMentionDropdown, setShowClientValidationMentionDropdown] = useState<{ updateId: string; position: number } | null>(null);
  const [submittingClientValidationComment, setSubmittingClientValidationComment] = useState<Record<string, boolean>>({});
  const [clientValidationComments, setClientValidationComments] = useState<Record<string, ClientUpdateComment[]>>({});
  const [loadingClientValidationComments, setLoadingClientValidationComments] = useState<Record<string, boolean>>({});

  // Status change modal state for task status dropdown (mirror ProjectDetail behavior)
  const [showStatusChangeModal, setShowStatusChangeModal] = useState(false);
  const [statusChangeContext, setStatusChangeContext] = useState<{
    taskId: string;
    newStatus: string;
    label: string;
  } | null>(null);
  const [statusChangeNotes, setStatusChangeNotes] = useState('');
  const [statusChangeAttachment, setStatusChangeAttachment] = useState('');
  const [statusChangeLoading, setStatusChangeLoading] = useState(false);
  
  // Notification modal state
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'success' | 'error'>('success');

  // Task detail modal state
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<any>(null);
  const currentUser = authService.getUser?.();

  // Map department name to task type
  const getTaskTypeForDepartment = (dept: string): string => {
    const mapping: Record<string, string> = {
      'Copy Writing': 'Copy',
      'Design': 'Design',
      'Development': 'Dev',
      'AI Team': 'AI',
      'Social Media Team': 'Social Media',
      'CRM': 'CRM',
      'SEO/GEO Team': 'SEO/GEO',
      'Onboarding': 'Onboarding',
    };
    return mapping[dept] || dept;
  };

  // Map department to internal stages
  const getInternalStagesForDepartment = (dept: string): string[] => {
    const mapping: Record<string, string[]> = {
      'Copy Writing': ['Copy', 'Copy Revision'],
      'Design': ['Design', 'Design Revision'],
      'Development': ['Dev'],
      'AI Team': ['AI Team'],
      'Social Media Team': ['Social Media Team'],
      'CRM': ['CRM'],
      'SEO/GEO Team': ['SEO/GEO Team'],
      'Onboarding': ['Onboarding', 'Intake'],
      'Ready to Close': ['Ready to Close', 'Closed'],
    };
    return mapping[dept] || [dept];
  };

  // Map department to user roles (for filtering users in Assign To dropdown)
  const getRolesForDepartment = (dept: string): string[] => {
    const mapping: Record<string, string[]> = {
      'Copy Writing': ['Copy Writer', 'Copy', 'Copy Writing', 'Copywriter'],
      'Design': ['Designer', 'Design', 'Graphic Designer', 'UI/UX Designer'],
      'Development': ['Developer', 'Dev', 'Web Developer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer'],
      'AI Team': ['AI Developer', 'AI', 'AI Team', 'Machine Learning Engineer'],
      'Social Media Team': ['Social Media', 'Social Media Manager', 'Social Media Specialist', 'Content Creator'],
      'CRM': ['CRM', 'CRM Manager', 'CRM Specialist', 'Account Manager'],
      'SEO/GEO Team': ['SEO', 'GEO', 'SEO Specialist', 'SEO Manager', 'GEO Specialist'],
      'Onboarding': ['Onboarding', 'Onboarding Specialist', 'Project Manager', 'PM'],
    };
    return mapping[dept] || [];
  };

  // Filter users by department
  const getDepartmentUsers = useMemo(() => {
    if (!department) return users;
    const departmentRoles = getRolesForDepartment(department);
    if (departmentRoles.length === 0) return users; // If no roles mapped, show all users
    
    return users.filter((user: any) => {
      const userRole = (user.role || '').toLowerCase();
      return departmentRoles.some(role => 
        userRole === role.toLowerCase() || 
        userRole.includes(role.toLowerCase()) ||
        role.toLowerCase().includes(userRole)
      );
    });
  }, [users, department]);

  // Filter projects for searchable dropdown
  const filteredProjects = useMemo(() => {
    if (!clientSearchQuery.trim()) return allProjects;
    const query = clientSearchQuery.toLowerCase();
    return allProjects.filter((project: any) => {
      const clientName = (project.clientName || 'Unknown Client').toLowerCase();
      return clientName.includes(query);
    });
  }, [allProjects, clientSearchQuery]);

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
  }, []); // Only load once on mount

  // Optimized data loading - fetch only what's needed
  const loadData = useCallback(async () => {
    if (!department) return;

    try {
      setLoading(true);
      const taskType = getTaskTypeForDepartment(department);
      const internalStages = getInternalStagesForDepartment(department);
        
        // Step 1: Fetch ALL tasks first (we need to filter by type)
        // This is still needed to find which projects have tasks of this type
        // Use all=true to avoid the default 200-task limit from the backend
        const allTasksData = await taskService.getAll(undefined, undefined, { all: true });
        
        // Step 2: Quickly filter tasks by type (early filtering)
        // Include completed tasks so they can appear in "Approved/Completed" column
        const departmentTaskType = taskType;
        const relevantTasks = allTasksData.filter((t: any) => 
          t.type === departmentTaskType
          // Removed filter for completed tasks - they should show in approved_completed column
        );
        
        // Step 3: Fetch projects - use cache if available
        let allProjectsData: any[];
        if (allProjectsCacheRef.current.length > 0) {
          allProjectsData = allProjectsCacheRef.current;
        } else {
          allProjectsData = await projectService.getAll();
          allProjectsCacheRef.current = allProjectsData; // Cache for future use
        }
        setAllProjects(allProjectsData); // Store for modal
        
        // Step 4: Get unique project IDs from relevant tasks (Set for O(1) lookup)
        const projectIdsWithTasks = new Set(relevantTasks.map((t: any) => t.projectId));
        
        // Step 5: Filter projects efficiently using Set lookup
        // Include projects that:
        // 1. Have tasks of this department type, OR
        // 2. Are in the department stage, OR
        // 3. Match CRM special case (Katalyst, Premium, or Powered-Up)
        const departmentProjectsMap = new Map();
        const isKatalyst = (clientType: string) => 
          clientType === 'Katalyst' || clientType === 'KATALYST' || clientType?.toLowerCase() === 'katalyst';
        
        for (const project of allProjectsData) {
          // Fast checks using Set lookup (O(1))
          if (projectIdsWithTasks.has(project.id)) {
            departmentProjectsMap.set(project.id, project);
            continue;
          }
          
          if (internalStages.includes(project.stage)) {
            departmentProjectsMap.set(project.id, project);
            continue;
          }
          
          // CRM special case - include Premium and Powered-Up projects even if they don't have tasks yet
          if (department === 'CRM') {
            const allClientTypes = [
              project.clientType,
              ...(project.secondaryClientTypes 
                ? (Array.isArray(project.secondaryClientTypes) 
                    ? project.secondaryClientTypes 
                    : project.secondaryClientTypes.split(',').map((t: string) => t.trim()).filter((t: string) => !!t))
                : [])
            ];
            // Include projects with Katalyst (primary or secondary), Premium, or Powered-Up
            const hasKatalyst = allClientTypes.some(isKatalyst);
            const isPremium = project.clientType === 'Premium' || allClientTypes.includes('Premium');
            const isPoweredUp = project.clientType === 'Powered-Up' || allClientTypes.includes('Powered-Up');
            
            if (hasKatalyst || isPremium || isPoweredUp) {
              departmentProjectsMap.set(project.id, project);
            }
          }
        }
        
        const departmentProjects = Array.from(departmentProjectsMap.values());
        
        // Step 6: Filter tasks to only those belonging to department projects (using Set for fast lookup)
        const departmentProjectIds = new Set(departmentProjects.map((p: any) => p.id));
        const departmentTasks = relevantTasks.filter((t: any) => 
          departmentProjectIds.has(t.projectId)
        );

        setProjects(departmentProjects);
        setTasks(departmentTasks);
      } catch (error) {
        console.error('Failed to load department data:', error);
      } finally {
        setLoading(false);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refetch when tab regains focus after 30 s of inactivity
  useFocusRefetch(loadData);

  // Real-time task transfer: reload immediately when any transfer event arrives
  useEffect(() => {
    notificationService.connectSocket();
    const unsub = notificationService.onTaskTransferred(() => {
      loadData();
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [loadData]);

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

  const handleSelectAll = () => {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map((t: any) => t.id)));
    }
  };

  const handleBulkAssign = async () => {
    if (selectedTasks.size === 0 || !bulkAssignUserId) {
      alert('Please select tasks and a user to assign');
      return;
    }

    try {
      setAssigning(true);
      await Promise.all(
        Array.from(selectedTasks).map((taskId) =>
          taskService.assign(taskId, bulkAssignUserId)
        )
      );
      
      // Reload tasks - optimized
      // Include completed tasks so they can appear in "Approved/Completed" column
      const allTasksData = await taskService.getAll(undefined, undefined, { all: true });
      const taskType = getTaskTypeForDepartment(department || '');
      const projectIdsSet = new Set(projects.map((p: any) => p.id));
      const departmentTasks = allTasksData.filter((t: any) => 
        t.type === taskType && 
        projectIdsSet.has(t.projectId)
        // Removed filter for completed tasks - they should show in approved_completed column
      );
      setTasks(departmentTasks);
      setSelectedTasks(new Set());
      setBulkAssignUserId('');
      alert(`Successfully assigned ${selectedTasks.size} task(s)`);
    } catch (error) {
      console.error('Failed to assign tasks:', error);
      alert('Failed to assign tasks. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  // Group tasks by project (for list view) - optimized with Map
  const tasksByProject = useMemo(() => {
    const grouped = new Map<string, any[]>();
    const hasSearch = searchQuery.trim().length > 0;
    const q = searchQuery.toLowerCase();

    for (const task of tasks) {
      if (hasSearch) {
        const title = (task.title || '').toLowerCase();
        const project = projects.find((p: any) => p.id === task.projectId);
        const projectName = (project?.clientName || 'Unknown Project').toLowerCase();
        if (!title.includes(q) && !projectName.includes(q)) {
          continue;
        }
      }

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
  }, [tasks, projects, searchQuery]);

  // Get task status for Kanban columns (similar to ProjectDetail)
  const getTaskStatus = useCallback((task: any): string => {
    // CRM-specific status mapping
    if (department === 'CRM') {
      // Map Blocked status to stuck column (we use Blocked enum value but display as Stuck)
      if (task.status === 'Blocked' || task.status === 'Stuck' || task.status === 'stuck') {
        return 'stuck';
      }
      // Check if task has been forwarded by looking for forward marker in description
      if (task.description && task.description.includes('--- Forwarded to')) {
        return 'forwarded';
      }
      // For CRM, "In Review" status maps to Client Validation column
      if (task.status === 'In Review' || task.status === 'Client Validation' || task.status === 'Client Review') {
        return 'client_validation';
      }
      // If task is assigned, it should be in "Owned/In Progress" (unless it's in a special status above)
      if (task.assignedTo || task.assignedToId) {
        return 'owned_in_progress';
      }
      // Default for CRM unassigned or Todo
      return 'not_started';
    }
    
    // Standard status mapping for other departments

    // FIRST: Try to derive the lane from the latest structured
    // "--- Status Change --- / New Column: X" block in the description.
    // This reflects the user's last explicit move regardless of raw enum.
    if (task.description) {
      try {
        const desc: string = task.description;
        const regex = /--- Status Change ---[\s\S]*?New Column:\s*(.+?)\s*(?:\r?\n|$)/g;
        let match: RegExpExecArray | null;
        let lastLabel: string | null = null;
        // Walk all matches and keep the last one
        while ((match = regex.exec(desc)) !== null) {
          lastLabel = (match[1] || '').trim();
        }

        if (lastLabel) {
          const labelToColumn: Record<string, string> = {
            'Not Yet Started': 'not_started',
            'Owned/In Progress': 'owned_in_progress',
            'For Approval': 'for_approval',
            'Revision': 'revision',
            'Elliot Review': 'elliot_review',
            'Approved/Completed': 'approved_completed',
            'QA Before Sending to Client': 'qa_before_client',
            'Client Validation': 'client_validation',
          };
          const colId = labelToColumn[lastLabel];
          if (colId) {
            return colId;
          }
        }
      } catch (e) {
        console.warn('Failed to parse status change blocks for task:', task.id, e);
      }
    }

    // PRIORITY 1: Check for revision status/markers FIRST (revision takes highest priority)
    // BUT: don't force "Revision" column when backend status is generic "In Review"
    // In Review uses explicit column markers (For Approval / Elliot / QA / Client Validation)
    if (task.status !== 'In Review') {
      if (task.description && task.description.includes('--- Column: Revision ---')) {
        return 'revision';
      }
      if (task.status === 'Revision' || task.status === 'Needs Revision') {
        return 'revision';
      }
    }
    
    // PRIORITY 2: Completed tasks automatically go to "Approved/Completed" column
    // This takes high priority (after revision) - completed tasks should move here automatically
    if (task.status === 'Completed' || task.isCompleted) {
      // Only return approved_completed if not in revision (revision takes priority)
      // We already checked for revision above, so if we reach here, it's safe to mark as completed
      return 'approved_completed';
    }
    
    // If task has a file URL and deliverable, check deliverable status
    if (task.fileUrl && task.deliverableId) {
      // This would require fetching deliverable data, but for now we'll use task status
      // You might need to load deliverable data separately if needed
    }
    
    // Check for column markers in description (regardless of assignment status)
    // This ensures tasks moved to specific columns appear in the correct column even if unassigned
    if (task.status === 'In Review' && task.description) {
      // For In Review, let the *latest* explicit marker win; we prefer specific review lanes
      if (task.description.includes('--- Column: For Approval ---')) {
        return 'for_approval';
      }
      if (task.description.includes('--- Column: Elliot Review ---')) {
        return 'elliot_review';
      }
      if (task.description.includes('--- Column: QA Review ---')) {
        return 'qa_before_client';
      }
      if (task.description.includes('--- Column: Client Review ---')) {
        return 'client_validation';
      }
      if (task.description.includes('--- Column: Revision ---')) {
        return 'revision';
      }
    }
    
    // If task is in Blocked status (we label it as Client Validation in the UI),
    // keep it in the Client Validation column, regardless of assignment.
    if (task.status === 'Blocked') {
      return 'client_validation';
    }

    // Check if assigned
    if (task.assignedTo) {
      // Legacy status checks (for backward compatibility)
      if (task.status === 'In Progress') {
        return 'owned_in_progress';
      }
      if (task.status === 'For Approval' || task.status === 'Ready for Review') {
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
      // Default for assigned tasks with In Review status (no marker)
      // For department view, treat assigned "In Review" tasks as "For Approval"
      // so they show in the same column as on the role dashboards.
      if (task.status === 'In Review') {
        return 'for_approval';
      }
      // Default for assigned tasks
      return 'owned_in_progress';
    }
    
    // Unassigned tasks - check for legacy status values
    if (task.status === 'In Review') {
      // If unassigned and In Review but no column marker, default to not_started
      return 'not_started';
    }
    if (task.status === 'In Progress') {
      return 'owned_in_progress';
    }
    
    // Default for unassigned tasks
    return 'not_started';
  }, [department]);

  // Group tasks by status for Kanban view - optimized
  const tasksByStatus = useMemo(() => {
    // CRM-specific columns
    const grouped: Record<string, any[]> = department === 'CRM' ? {
      'not_started': [],
      'owned_in_progress': [],
      'client_validation': [],
      'forwarded': [],
      'stuck': []
    } : {
      'not_started': [],
      'owned_in_progress': [],
      'for_approval': [],
      'revision': [],
      'elliot_review': [],
      'approved_completed': [],
      'qa_before_client': [],
      'client_validation': []
    };
    
    const hasSearch = searchQuery.trim().length > 0;
    const q = searchQuery.toLowerCase();

    // Use for loop for better performance
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (hasSearch) {
        const title = (task.title || '').toLowerCase();
        const project = projects.find((p: any) => p.id === task.projectId);
        const projectName = (project?.clientName || 'Unknown Project').toLowerCase();
        if (!title.includes(q) && !projectName.includes(q)) {
          continue;
        }
      }
      const status = getTaskStatus(task);
      const group = grouped[status];
      if (group) {
        group.push(task);
      }
    }
    
    return grouped;
  }, [tasks, projects, searchQuery, department, getTaskStatus]);

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

  const projectPmNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) {
      const pmName = project.pm?.name || (project.pmId && users.find((u: any) => u.id === project.pmId)?.name);
      if (pmName) map.set(project.id, pmName);
    }
    return map;
  }, [projects, users]);

  const getProjectPmName = (projectId: string): string => {
    return projectPmNameMap.get(projectId) || '';
  };

  // Get user name - optimized with Map cache
  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users) {
      map.set(user.id, user.name || 'Unassigned');
    }
    return map;
  }, [users]);

  const getUserName = (userId: string): string => {
    return userNameMap.get(userId) || 'Unassigned';
  };

  // Check if a project is active (has active tasks) - for CRM department
  const isProjectActive = useMemo(() => {
    if (department !== 'CRM') return new Map<string, boolean>();
    
    const activeMap = new Map<string, boolean>();
    // A project is active if it has any tasks that are not completed
    for (const task of tasks) {
      if (!task.isCompleted && task.status !== 'Completed') {
        activeMap.set(task.projectId, true);
      }
    }
    return activeMap;
  }, [tasks, department]);

  // Fuzzy match client name to project
  const findProjectByClientName = (clientName: string): any | null => {
    if (!clientName || !allProjects.length) return null;
    
    const normalizedSearch = clientName.toLowerCase().trim();
    
    // First, try exact match
    let match = allProjects.find((p: any) => 
      p.clientName?.toLowerCase().trim() === normalizedSearch
    );
    if (match) return match;
    
    // Try partial match (client name contains search or vice versa)
    match = allProjects.find((p: any) => {
      const projectName = p.clientName?.toLowerCase().trim() || '';
      return projectName.includes(normalizedSearch) || normalizedSearch.includes(projectName);
    });
    if (match) return match;
    
    // Try matching by removing common suffixes/prefixes
    const cleanSearch = normalizedSearch
      .replace(/:\s*(speaker kit|services page|black friday|offer|content)/gi, '')
      .trim();
    
    match = allProjects.find((p: any) => {
      const projectName = p.clientName?.toLowerCase().trim() || '';
      const cleanProject = projectName
        .replace(/:\s*(speaker kit|services page|black friday|offer|content)/gi, '')
        .trim();
      return cleanProject === cleanSearch || 
             cleanProject.includes(cleanSearch) || 
             cleanSearch.includes(cleanProject);
    });
    if (match) return match;
    
    return null;
  };

  // Get current month in YYYY-MM format (for new projects created from Excel)
  const getCurrentMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  // Map Excel status to task status
  const mapStatusToTaskStatus = (excelStatus: string): string => {
    const statusLower = excelStatus?.toLowerCase().trim() || '';
    
    // Map common statuses
    if (statusLower.includes('client validation') || statusLower === 'client validation') {
      return 'Client Review';
    }
    if (statusLower.includes('completed') || statusLower === 'completed') {
      return 'Completed';
    }
    if (statusLower.includes('pending requirements') || statusLower.includes('for approval')) {
      return 'For Approval';
    }
    if (statusLower.includes('on hold') || statusLower.includes('not started')) {
      return 'Todo';
    }
    if (statusLower.includes('in progress') || statusLower.includes('owned')) {
      return 'In Progress';
    }
    if (statusLower.includes('revision')) {
      return 'Revision';
    }
    if (statusLower.includes('elliot review')) {
      return 'Elliot Review';
    }
    if (statusLower.includes('qa') || statusLower.includes('qa review')) {
      return 'QA Review';
    }
    if (statusLower.includes('in review')) {
      return 'In Review';
    }
    
    // Default to Todo if no match
    return 'Todo';
  };

  // Handle Excel file upload
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError('');
    setExcelPreview([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        // Validate columns
        if (jsonData.length === 0) {
          setImportError('Excel file is empty');
          return;
        }

        const firstRow = jsonData[0] as any;
        const hasClient =
          'Clients' in firstRow ||
          'clients' in firstRow ||
          'CLIENTS' in firstRow ||
          'Client' in firstRow ||
          'client' in firstRow ||
          'CLIENT' in firstRow;

        if (!hasClient) {
          setImportError('Excel file must contain a "Clients" (or legacy "Client") column');
          return;
        }

        // Normalize column names and prepare preview
        const normalizedData = jsonData.map((row: any, index: number) => {
          // Support both legacy "Client" and new "Clients" column names
          const client =
            row.Clients ||
            row.clients ||
            row.CLIENTS ||
            row.Client ||
            row.client ||
            row.CLIENT ||
            '';
          const status = row.Status || row.status || row.STATUS || '';
          const systemStatus = row['System = Status'] || row['system = status'] || row['SYSTEM = STATUS'] || status;
          const taskTitle =
            row['Task Title'] ||
            row['task title'] ||
            row.TaskTitle ||
            row.taskTitle ||
            '';
          
          // Find matching project
          const project = findProjectByClientName(client);
          const taskStatus = mapStatusToTaskStatus(systemStatus || status);
          
          // Compute final task title (same logic as in handleBulkCreateTasks)
          const finalTaskTitle = (taskTitle && String(taskTitle).trim()) || 
            `${department} Task - ${client}`;
          
          return {
            rowIndex: index + 2, // Excel row number (1-indexed, +1 for header)
            client,
            status,
            systemStatus: systemStatus || status,
            taskStatus,
            project: project ? { id: project.id, name: project.clientName } : null,
            matched: !!project,
            error: !project ? 'Project not found (will be created automatically)' : null,
            taskTitle: finalTaskTitle,
          };
        });

        setExcelPreview(normalizedData);
      } catch (err: any) {
        setImportError('Failed to parse Excel file: ' + (err.message || 'Invalid file format'));
        setExcelPreview([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle bulk task creation from Excel
  const handleBulkCreateTasks = async () => {
    if (excelPreview.length === 0) {
      setImportError('No tasks to create');
      return;
    }

    // Process all rows that have a client name; if a matching project is not found,
    // a new project will be created automatically during import.
    const validRows = excelPreview.filter((row: any) => !!row.client);
    if (validRows.length === 0) {
      setImportError('No valid rows found. Please ensure the "Clients" column has values.');
      return;
    }

    setUploadingTasks(true);
    setImportError('');

    const taskType = getTaskTypeForDepartment(department || '');
    const results = { success: 0, failed: 0 };
    const errors: string[] = [];
    const currentMonth = getCurrentMonth();
    const currentUser = authService.getUser?.();
    const pmId = currentUser?.id || '';

    try {
      // Process tasks in batches to avoid overwhelming the backend
      const BATCH_SIZE = 5;
      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const batch = validRows.slice(i, i + BATCH_SIZE);
        
        await Promise.allSettled(
          batch.map(async (row: any) => {
            try {
              // Ensure we have a project for this client - create one if it doesn't exist
              let projectId = row.project?.id;
              let projectName = row.project?.name;

              if (!projectId) {
                try {
                  const createdProject = await projectService.create({
                    clientName: row.client,
                    clientType: 'Private',
                    package: 'Standard',
                    priority: 'Medium',
                    targetCloseMonth: currentMonth,
                    notes: '',
                    pmId,
                  });
                  projectId = createdProject.id;
                  projectName = createdProject.clientName;
                  // Update row so subsequent logic can treat this as matched
                  row.project = { id: projectId, name: projectName };
                  row.matched = true;
                  row.error = null;
                } catch (projectErr: any) {
                  const errorMsg = projectErr.response?.data?.message || projectErr.message || 'Unknown error';
                  errors.push(`Row ${row.rowIndex} (${row.client}): Failed to create project - ${errorMsg}`);
                  results.failed++;
                  return;
                }
              }

              if (!projectId) {
                errors.push(`Row ${row.rowIndex} (${row.client}): Missing project`);
                results.failed++;
                return;
              }

              // Create task - always start with 'Todo' status, then update if needed
              // The backend might not accept certain statuses on initial creation
              const taskTitle =
                (row.taskTitle && String(row.taskTitle).trim()) ||
                `${department} Task - ${row.client}`;

              const taskData: any = {
                projectId,
                title: taskTitle,
                description: `Task created from Excel import. Original Status: ${row.status}`,
                type: taskType,
                status: 'Todo', // Always start with Todo
                isCompleted: false, // Never set completed on creation
              };

              const createdTask = await taskService.create(taskData);
              
              // If the mapped status is not 'Todo', update it after creation
              if (row.taskStatus && row.taskStatus !== 'Todo' && row.taskStatus !== 'Completed') {
                try {
                  await taskService.updateStatus(
                    createdTask.id, 
                    row.taskStatus, 
                    false // Don't mark as completed yet
                  );
                } catch (updateErr: any) {
                  console.warn(`Failed to update status for task ${createdTask.id}:`, updateErr);
                  // Task was created, so count as success even if status update failed
                }
              } else if (row.taskStatus === 'Completed') {
                // If status should be Completed, update it
                try {
                  await taskService.updateStatus(createdTask.id, 'Completed', true);
                } catch (updateErr: any) {
                  console.warn(`Failed to mark task ${createdTask.id} as completed:`, updateErr);
                }
              }
              
              results.success++;
            } catch (err: any) {
              const errorMsg = err.response?.data?.message || err.message || 'Unknown error';
              const errorDetails = err.response?.data?.error || err.response?.data || '';
              const fullError = errorDetails 
                ? `${errorMsg} - ${JSON.stringify(errorDetails)}`
                : errorMsg;
              errors.push(`Row ${row.rowIndex} (${row.client}): ${fullError}`);
              results.failed++;
            }
          })
        );
        
        // Small delay between batches to avoid overwhelming the server
        if (i + BATCH_SIZE < validRows.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (results.failed > 0) {
        setImportError(`${results.success} tasks created successfully. ${results.failed} failed:\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... and ${errors.length - 10} more errors` : ''}`);
      } else {
        setImportError(`Successfully created ${results.success} task(s)!`);
      }

      // Reload tasks
      // Include completed tasks so they can appear in "Approved/Completed" column
      const allTasksData = await taskService.getAll(undefined, undefined, { all: true });
      const taskTypeForFilter = getTaskTypeForDepartment(department || '');
      const projectIdsSet = new Set(projects.map((p: any) => p.id));
      const departmentTasks = allTasksData.filter((t: any) => 
        t.type === taskTypeForFilter && 
        projectIdsSet.has(t.projectId)
        // Removed filter for completed tasks - they should show in approved_completed column
      );
      setTasks(departmentTasks);

      // Clear preview after successful import
      if (results.failed === 0) {
        setTimeout(() => {
          setExcelPreview([]);
          setShowExcelImportModal(false);
        }, 2000);
      }
    } catch (err: any) {
      setImportError('Failed to create tasks: ' + (err.message || 'Unknown error'));
    } finally {
      setUploadingTasks(false);
    }
  };

  // Load task templates from localStorage
  useEffect(() => {
    const savedTemplates = localStorage.getItem(`taskTemplates_${department}`);
    if (savedTemplates) {
      try {
        setTaskTemplates(JSON.parse(savedTemplates));
      } catch (error) {
        console.error('Failed to load task templates:', error);
      }
    }
  }, [department]);

  // Save task template
  const handleSaveTemplate = () => {
    if (!templateData.name.trim() || !templateData.title.trim()) {
      alert('Please enter a template name and task title');
      return;
    }

    const newTemplate = {
      id: Date.now().toString(),
      department: department || '',
      ...templateData
    };

    const updatedTemplates = [...taskTemplates, newTemplate];
    setTaskTemplates(updatedTemplates);
    localStorage.setItem(`taskTemplates_${department}`, JSON.stringify(updatedTemplates));
    
    setTemplateData({
      name: '',
      title: '',
      description: '',
      deliverableType: '',
      defaultStatus: 'Todo'
    });
    setShowTemplateModal(false);
    alert('Template saved successfully!');
  };

  // Load template into task form
  const handleLoadTemplate = () => {
    const template = taskTemplates.find((t: any) => t.id === selectedTemplate);
    if (template) {
      setNewTaskData({
        ...newTaskData,
        title: template.title,
        description: template.description,
      });
      setShowTemplateModal(false);
      setShowAddTaskModal(true);
    }
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

  // Handle click outside client dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.client-searchable-dropdown')) {
        setShowClientDropdown(false);
      }
    };
    if (showClientDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showClientDropdown]);

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

  const handleCloseTaskDetail = useCallback(() => {
    setShowTaskDetailModal(false);
    setSelectedTaskDetail(null);
  }, []);

  const handleOpenTaskDetail = (task: any) => {
    setSelectedTaskDetail(task);
    setShowTaskDetailModal(true);
  };

  // Handle update task
  const handleUpdateTask = async () => {
    if (!editingTask || !editTaskData.title.trim()) {
      alert('Please enter a task title');
      return;
    }

    setUpdatingTask(true);
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
          // Otherwise, we'll need to check if there's an unassign endpoint
          try {
            await taskService.assign(editingTask.id, '');
          } catch (error) {
            console.warn('Failed to unassign task (may not be supported):', error);
          }
        }
      }

      // Reload tasks - optimized
      const allTasksData = await taskService.getAll(undefined, undefined, { all: true });
      const taskTypeForFilter = getTaskTypeForDepartment(department || '');
      const projectIdsSet = new Set(projects.map((p: any) => p.id));
      const departmentTasks = allTasksData.filter((t: any) => 
        t.type === taskTypeForFilter && 
        !t.isCompleted &&
        t.status !== 'Completed' &&
        projectIdsSet.has(t.projectId)
      );
      setTasks(departmentTasks);

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
      setUpdatingTask(false);
    }
  };

  // Handle forward task (CRM)
  const handleForwardTask = async () => {
    if (!forwardingTask || !forwardData.targetDepartment) {
      showNotification('Please select a target department', 'error');
      return;
    }

    setForwarding(true);
    try {
      // Get department name for display
      const targetDept = departmentMenuItems.find(d => d.id === forwardData.targetDepartment);
      const deptName = targetDept?.name || forwardData.targetDepartment;
      
      // Get task type for target department
      const targetTaskType = getTaskTypeForDepartment(forwardData.targetDepartment);
      
      // Build description for new task with forwarding information
      let newTaskDescription = `Forwarded from CRM\n\nOriginal Task: ${forwardingTask.title}`;
      if (forwardingTask.description) {
        newTaskDescription += `\n\nOriginal Description:\n${forwardingTask.description}`;
      }
      if (forwardData.notes) {
        newTaskDescription += `\n\n--- Forwarding Notes ---\n${forwardData.notes}`;
      }
      if (forwardData.links) {
        newTaskDescription += `\n\n--- Forwarding Links ---\n${forwardData.links}`;
      }
      
      // Create new task in target department
      const newTaskData: any = {
        projectId: forwardingTask.projectId, // Same project/client
        title: `${forwardingTask.title} (Forwarded from CRM)`,
        description: newTaskDescription,
        type: targetTaskType,
        status: 'Todo',
        isCompleted: false,
      };
      
      // Copy due date if exists
      if (forwardingTask.dueDate) {
        newTaskData.dueDate = new Date(forwardingTask.dueDate);
      }
      
      // Copy deliverable if exists
      if (forwardingTask.deliverableId) {
        newTaskData.deliverableId = forwardingTask.deliverableId;
      }
      
      await taskService.create(newTaskData);
      
      // Update original task description to include forward information (for tracking)
      const forwardNote = `\n\n--- Forwarded to ${deptName} on ${new Date().toLocaleString()} ---\n${forwardData.notes ? `Notes: ${forwardData.notes}\n` : ''}${forwardData.links ? `Links: ${forwardData.links}` : ''}`;
      const updatedDescription = (forwardingTask.description || '') + forwardNote;
      
      await taskService.update(forwardingTask.id, {
        description: updatedDescription
      });

      // Reload tasks - optimized
      const allTasksData = await taskService.getAll(undefined, undefined, { all: true });
      const taskType = getTaskTypeForDepartment(department || '');
      const projectIdsSet = new Set(projects.map((p: any) => p.id));
      const departmentTasks = allTasksData.filter((t: any) => 
        t.type === taskType && 
        !t.isCompleted &&
        t.status !== 'Completed' &&
        projectIdsSet.has(t.projectId)
      );
      setTasks(departmentTasks);

      // Close modal and reset
      setShowForwardModal(false);
      setForwardingTask(null);
      setForwardData({
        targetDepartment: '',
        notes: '',
        links: ''
      });
      showNotification(`Task forwarded to ${deptName} successfully! A new task has been created in that department.`, 'success');
    } catch (error) {
      console.error('Failed to forward task:', error);
      showNotification('Failed to forward task. Please try again.', 'error');
    } finally {
      setForwarding(false);
    }
  };

  // Load client validation updates
  const loadClientValidationUpdates = async (projectId: string) => {
    try {
      setLoadingClientValidationUpdates(true);
      const updates = await clientUpdatesService.getAllByProject(projectId);
      setClientValidationUpdates(updates || []);
      
      // Load comments for each update
      const commentsMap: Record<string, ClientUpdateComment[]> = {};
      const loadingMap: Record<string, boolean> = {};
      for (const update of updates || []) {
        loadingMap[update.id] = true;
        setLoadingClientValidationComments({ ...loadingClientValidationComments, ...loadingMap });
        try {
          const updateComments = await clientUpdatesService.getComments(update.id);
          commentsMap[update.id] = updateComments || [];
        } catch (error) {
          console.error(`Failed to load comments for update ${update.id}:`, error);
          commentsMap[update.id] = [];
        }
        loadingMap[update.id] = false;
      }
      setClientValidationComments(commentsMap);
      setLoadingClientValidationComments({ ...loadingClientValidationComments, ...loadingMap });
    } catch (error) {
      console.error('Failed to load client validation updates:', error);
      setClientValidationUpdates([]);
    } finally {
      setLoadingClientValidationUpdates(false);
    }
  };

  // Add client validation link
  const addClientValidationLink = () => {
    setClientValidationLinks([...clientValidationLinks, '']);
  };

  // Remove client validation link
  const removeClientValidationLink = (index: number) => {
    const newLinks = clientValidationLinks.filter((_, i) => i !== index);
    if (newLinks.length === 0) {
      setClientValidationLinks(['']);
    } else {
      setClientValidationLinks(newLinks);
    }
  };

  // Update client validation link
  const updateClientValidationLink = (index: number, value: string) => {
    const newLinks = [...clientValidationLinks];
    newLinks[index] = value;
    setClientValidationLinks(newLinks);
  };

  // Show notification modal
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotificationModal(true);
    // Auto-close after 3 seconds
    setTimeout(() => {
      setShowNotificationModal(false);
    }, 3000);
  };

  // Handle client validation log submit
  const handleClientValidationLogSubmit = async () => {
    if (!projectForClientValidation) return;
    
    try {
      setLoggingClientValidation(true);
      const validLinks = clientValidationLinks.filter(link => link.trim() !== '');
      await clientUpdatesService.create(
        projectForClientValidation.id,
        clientValidationNotes || undefined,
        validLinks.length > 0 ? validLinks : undefined
      );
      // Reload updates
      await loadClientValidationUpdates(projectForClientValidation.id);
      // Switch to logs tab and reset form
      setClientValidationTab('logs');
      setClientValidationNotes('');
      setClientValidationLinks(['']);
      showNotification('Client validation log saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save client validation log:', error);
      showNotification('Failed to save client validation log. Please try again.', 'error');
    } finally {
      setLoggingClientValidation(false);
    }
  };

  // Handle client validation comment input with @ mentions
  const handleClientValidationCommentInput = (updateId: string, text: string, cursorPosition: number) => {
    setClientValidationCommentTexts({ ...clientValidationCommentTexts, [updateId]: text });
    
    // Check for @ mention
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Check if there's a space after @, meaning we should show dropdown
      if (!textAfterAt.includes(' ') && textAfterAt.length > 0) {
        setShowClientValidationMentionDropdown({ updateId, position: cursorPosition });
      } else {
        setShowClientValidationMentionDropdown(null);
      }
    } else {
      setShowClientValidationMentionDropdown(null);
    }
  };

  // Handle add client validation comment
  const handleAddClientValidationComment = async (updateId: string) => {
    const commentText = clientValidationCommentTexts[updateId]?.trim();
    if (!commentText) return;

    try {
      setSubmittingClientValidationComment({ ...submittingClientValidationComment, [updateId]: true });
      
      // Extract mentions from comment text
      const mentionRegex = /@(\w+)/g;
      const mentions: string[] = [];
      let match;
      while ((match = mentionRegex.exec(commentText)) !== null) {
        const mentionedName = match[1];
        const user = users.find((u: any) => u.name === mentionedName);
        if (user) {
          mentions.push(user.id);
        }
      }

      await clientUpdatesService.createComment(updateId, commentText, mentions.length > 0 ? mentions : undefined);
      
      // Reload comments for this update
      const updateComments = await clientUpdatesService.getComments(updateId);
      setClientValidationComments({ ...clientValidationComments, [updateId]: updateComments || [] });
      
      // Clear comment text
      setClientValidationCommentTexts({ ...clientValidationCommentTexts, [updateId]: '' });
      setShowClientValidationMentionDropdown(null);
      showNotification('Comment added successfully!', 'success');
    } catch (error) {
      console.error('Failed to add comment:', error);
      showNotification('Failed to add comment. Please try again.', 'error');
    } finally {
      setSubmittingClientValidationComment({ ...submittingClientValidationComment, [updateId]: false });
    }
  };

  // Helper: log status change to task description + deliverable history (mirrors ProjectDetail behavior)
  const logStatusChangeForTask = async (
    task: any,
    backendStatus: string,
    columnId?: string,
    extraNotes?: string,
    extraAttachment?: string
  ) => {
    try {
      const project = projects.find((p: any) => p.id === task.projectId);
      if (!project) return;

      const deliverableId: string | undefined = task.deliverableId || undefined;
      const fileUrl: string | undefined = task.fileUrl || undefined;

      // 1) Append structured status-change block to description
      const currentDesc: string = task.description || '';
      let updatedDesc = currentDesc;

      const statusLabelMap: Record<string, string> = {
        not_started: 'Not Yet Started',
        owned_in_progress: 'Owned/In Progress',
        for_approval: 'For Approval',
        revision: 'Revision',
        elliot_review: 'Elliot Review',
        approved_completed: 'Approved/Completed',
        qa_before_client: 'QA Before Sending to Client',
        client_validation: 'Client Validation',
        Todo: 'Not Yet Started',
        'In Progress': 'Owned/In Progress',
        'In Review': 'For Approval',
        Completed: 'Approved/Completed',
        Blocked: 'Client Validation',
      };

      const key = columnId || backendStatus;
      const targetLabel = statusLabelMap[key] || backendStatus;
      const timestamp = new Date().toLocaleString();

      let logBlock = `\n\n--- Status Change ---\nNew Column: ${targetLabel}\nBy: ${currentUser?.name || 'Unknown'}\nAt: ${timestamp}`;
      if (extraNotes && extraNotes.trim()) {
        logBlock += `\nNotes: ${extraNotes.trim()}`;
      }
      if (extraAttachment && extraAttachment.trim()) {
        logBlock += `\nAttachment: ${extraAttachment.trim()}`;
      }

      updatedDesc += logBlock;

      if (updatedDesc !== currentDesc) {
        try {
          await taskService.update(task.id, { description: updatedDesc });
        } catch (descError) {
          console.warn('Failed to update task description with status change log:', descError);
        }
      }

      // 2) Also push an entry into deliverable history so Task Detail Activity History shows it
      if (deliverableId && fileUrl) {
        try {
          // Map to deliverable status similar to ProjectDetail
          let deliverableStatus =
            project.deliverables?.find((d: any) => d.id === deliverableId)?.status || 'Not Started';

          switch (columnId) {
            case 'revision':
              deliverableStatus = 'Revision';
              break;
            case 'elliot_review':
              deliverableStatus = 'Ready for Review';
              break;
            case 'approved_completed':
              deliverableStatus = 'Approved';
              break;
            case 'qa_before_client':
              deliverableStatus = 'Ready for Review';
              break;
            case 'client_validation':
              deliverableStatus = 'Client Review';
              break;
            case 'for_approval':
              deliverableStatus = 'Ready for Review';
              break;
            default:
              // For non-review moves, leave deliverable status as-is
              break;
          }

          let details = '';
          if (extraNotes && extraNotes.trim()) {
            details += `Notes: ${extraNotes.trim()}`;
          }
          if (extraAttachment && extraAttachment.trim()) {
            if (details) details += '\n';
            details += `Attachment: ${extraAttachment.trim()}`;
          }

          let baseNote = `Status moved to "${targetLabel}" by ${currentUser?.name || 'Unknown'}.`;
          if (details) {
            baseNote += `\n${details}`;
          }

          await deliverableService.updateStatus(
            deliverableId,
            deliverableStatus,
            baseNote,
            fileUrl
          );
        } catch (historyError) {
          console.warn('Failed to record deliverable history for department status change:', historyError);
        }
      }
    } catch (e) {
      console.warn('logStatusChangeForTask failed:', e);
    }
  };

  // Handle task status change (list/table dropdown)
  const handleTaskStatusChange = async (
    taskId: string,
    newStatus: string,
    extraNotes?: string,
    extraAttachment?: string
  ) => {
    try {
      // Map UI statuses to backend enum-safe statuses
      // Backend only accepts: 'Todo', 'In Progress', 'In Review', 'Completed', 'Blocked'
      let backendStatus = newStatus;
      switch (newStatus) {
        case 'Revision':
        case 'Elliot Review':
        case 'QA Review':
          backendStatus = 'In Review';
          break;
        default:
          backendStatus = newStatus;
      }

      const isCompleted = backendStatus === 'Completed';
      const task = tasks.find((t: any) => t.id === taskId);

      // For non-CRM departments, keep column markers in sync with status changes
      if (task && department !== 'CRM') {
        const currentDesc: string = task.description || '';
        // Remove any existing column markers (more lenient pattern – matches with or without leading newlines)
        let cleanedDesc = currentDesc.replace(/--- Column: [^-]+ ---/g, '');

        let columnMarker: string | null = null;
        switch (newStatus) {
          case 'In Review':
            // Treat plain "In Review" from dropdown as "For Approval" column
            columnMarker = '\n\n--- Column: For Approval ---';
            break;
          case 'Revision':
            columnMarker = '\n\n--- Column: Revision ---';
            break;
          case 'Elliot Review':
            columnMarker = '\n\n--- Column: Elliot Review ---';
            break;
          case 'QA Review':
            columnMarker = '\n\n--- Column: QA Review ---';
            break;
          case 'Blocked':
            // Blocked in department view corresponds to Client Validation column
            columnMarker = '\n\n--- Column: Client Review ---';
            break;
          default:
            // Todo, In Progress, Completed → clear markers (stay with cleanedDesc)
            break;
        }

        const updatedDesc = columnMarker ? cleanedDesc + columnMarker : cleanedDesc;
        if (updatedDesc !== currentDesc) {
          try {
            await taskService.update(task.id, { description: updatedDesc });
          } catch (descError) {
            console.warn('Failed to sync column marker for department status change:', descError);
          }
        }
      }

      await taskService.updateStatus(taskId, backendStatus, isCompleted);

      // Log description + deliverable history similar to ProjectDetail
      if (task) {
        // Map plain enum to a pseudo column id for logging
        let columnId: string | undefined;
        switch (newStatus) {
          case 'Todo':
            columnId = 'not_started';
            break;
          case 'In Progress':
            columnId = 'owned_in_progress';
            break;
          case 'In Review':
            columnId = 'for_approval';
            break;
          case 'Revision':
            columnId = 'revision';
            break;
          case 'Elliot Review':
            columnId = 'elliot_review';
            break;
          case 'QA Review':
            columnId = 'qa_before_client';
            break;
          case 'Completed':
            columnId = 'approved_completed';
            break;
          case 'Blocked':
            columnId = 'client_validation';
            break;
          default:
            columnId = undefined;
        }
        await logStatusChangeForTask(task, newStatus, columnId, extraNotes, extraAttachment);
      }
      
      // Reload tasks to reflect changes
      const allTasksData = await taskService.getAll(undefined, undefined, { all: true });
      const taskType = getTaskTypeForDepartment(department || '');
      const projectIdsSet = new Set(projects.map((p: any) => p.id));
      const departmentTasks = allTasksData.filter((t: any) => 
        t.type === taskType && 
        projectIdsSet.has(t.projectId)
        // Include completed tasks so they can appear in approved_completed column
      );
      setTasks(departmentTasks);
      
      showNotification(`Task status updated to ${newStatus} ✓`, 'success');
    } catch (error) {
      console.error('Failed to update task status:', error);
      showNotification('Failed to update task status', 'error');
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

      const taskType = getTaskTypeForDepartment(department || '');
      const taskData: any = {
        projectId: newTaskData.projectId,
        title: newTaskData.title,
        description: newTaskData.description,
        type: taskType,
        status: markTaskCompleteOnCreate ? 'Completed' : 'Todo', // Apply quick complete status
        isCompleted: markTaskCompleteOnCreate, // Apply quick complete flag
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

      // Reload tasks - optimized
      // Include completed tasks so they can appear in "Approved/Completed" column
      const allTasksData = await taskService.getAll(undefined, undefined, { all: true });
      const taskTypeForFilter = getTaskTypeForDepartment(department || '');
      const projectIdsSet = new Set(projects.map((p: any) => p.id));
      const departmentTasks = allTasksData.filter((t: any) => 
        t.type === taskTypeForFilter && 
        projectIdsSet.has(t.projectId)
        // Removed filter for completed tasks - they should show in approved_completed column
      );
      setTasks(departmentTasks);

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
      setClientSearchQuery('');
      setShowClientDropdown(false);
      setMarkTaskCompleteOnCreate(false); // Reset checkbox state
      alert('Task created successfully!');
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('Failed to create task. Please try again.');
    } finally {
      setCreatingTask(false);
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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
            Loading {department} Department
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

  return (
    <div className="dashboard premium" style={{ display: 'flex', minHeight: '100vh', padding: 0 }}>
      {/* Sidebar Menu */}
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
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'white',
            margin: '0 0 0.5rem 0',
            letterSpacing: '-0.02em'
          }}>
            Departments
          </h2>
          <p style={{
            fontSize: '0.875rem',
            color: 'rgba(255, 255, 255, 0.6)',
            margin: 0
          }}>
            Navigate between teams
          </p>
        </div>

        {/* Department List */}
        <div style={{
          flex: 1,
          padding: '1rem 0.75rem',
          overflowY: 'auto'
        }}>
          {departmentMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = department === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => navigate(`/department/${encodeURIComponent(item.id)}`)}
                style={{
                  width: '100%',
                  padding: '1rem 1.25rem',
                  marginBottom: '0.5rem',
                  border: 'none',
                  borderRadius: '12px',
                  background: isActive 
                    ? `linear-gradient(135deg, ${item.color}15 0%, ${item.color}25 100%)`
                    : 'transparent',
                  color: isActive ? 'white' : 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  textAlign: 'left',
                  fontSize: '0.9375rem',
                  fontWeight: isActive ? 600 : 500,
                  boxShadow: isActive ? `0 4px 12px ${item.color}30` : 'none',
                  borderLeft: isActive ? `3px solid ${item.color}` : '3px solid transparent'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: isActive 
                    ? `linear-gradient(135deg, ${item.color} 0%, ${item.color}dd 100%)`
                    : 'rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.3s',
                  boxShadow: isActive ? `0 4px 12px ${item.color}40` : 'none'
                }}>
                  <Icon style={{
                    fontSize: '1.125rem',
                    color: isActive ? 'white' : 'rgba(255, 255, 255, 0.7)',
                    transition: 'all 0.3s'
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
                {isActive && (
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: item.color,
                    boxShadow: `0 0 8px ${item.color}`,
                    animation: 'pulse-dot 2s ease-in-out infinite'
                  }} />
                )}
              </button>
            );
          })}
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
              border: '1px solid rgba(102, 126, 234, 0.6)',
              borderRadius: '10px',
              background: 'rgba(102, 126, 234, 0.15)',
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
              e.currentTarget.style.background = 'rgba(102, 126, 234, 0.3)';
              e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.8)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(102, 126, 234, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.6)';
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
          /* Custom scrollbar for sidebar */
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
          {(() => {
            const currentDept = departmentMenuItems.find(d => d.id === department);
            const Icon = currentDept?.icon || FaClipboardList;
            const color = currentDept?.color || '#667eea';
            
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 8px 16px ${color}30`
                }}>
                  <Icon style={{ fontSize: '1.5rem', color: 'white' }} />
                </div>
                <div>
                  <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>
                    {department} Department
                  </h1>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                    Manage tasks and projects for this department
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => setShowExcelImportModal(true)}
            style={{
              padding: '0.75rem 1.5rem',
              border: '1px solid #667eea',
              borderRadius: '0.5rem',
              background: 'white',
              color: '#667eea',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 600,
              fontSize: '0.9375rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f0f4ff';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <FaFileExcel /> Import from Excel
          </button>
          <button
            onClick={() => setShowAddTaskModal(true)}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '0.5rem',
              background: '#667eea',
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
              e.currentTarget.style.background = '#5568d3';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#667eea';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <FaPlus /> Add New Task
          </button>
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
        <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Unassigned Tasks</div>
        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>
          {tasks.filter((t: any) => {
            const assignees = t.assignees || [];
            const assigneeIds = assignees.length > 0
              ? assignees.map((a: any) => a.userId || a.user?.id)
              : (t.assignedToId ? [t.assignedToId] : []);
            return assigneeIds.length === 0;
          }).length}
        </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {tasks.length > 0 && (
        <div style={{
          background: 'white',
          padding: '1rem 1.5rem',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={handleSelectAll}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '0.375rem',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              {selectedTasks.size === tasks.length ? 'Deselect All' : 'Select All'}
            </button>
            {selectedTasks.size > 0 && (
              <span style={{ color: '#64748b' }}>
                {selectedTasks.size} task(s) selected
              </span>
            )}
          </div>
          {selectedTasks.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <select
                value={bulkAssignUserId}
                onChange={(e) => setBulkAssignUserId(e.target.value)}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.375rem',
                  minWidth: '200px'
                }}
              >
                <option value="">Select user to assign...</option>
                {getDepartmentUsers.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <button
                onClick={handleBulkAssign}
                disabled={!bulkAssignUserId || assigning}
                style={{
                  padding: '0.5rem 1.5rem',
                  border: 'none',
                  borderRadius: '0.375rem',
                  background: bulkAssignUserId && !assigning ? '#667eea' : '#cbd5e1',
                  color: 'white',
                  cursor: bulkAssignUserId && !assigning ? 'pointer' : 'not-allowed',
                  fontWeight: 500
                }}
              >
                {assigning ? 'Assigning...' : 'Assign Selected'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* View Toggle + Search */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e293b', margin: 0, flex: 1 }}>
          Tasks by Project
        </h2>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
          <div style={{ position: 'relative', minWidth: '220px', maxWidth: '260px' }}>
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
        </div>
      </div>

      {/* Tasks by Project */}
      <div>
        {Object.keys(tasksByProject).length === 0 ? (
          <div style={{
            background: 'white',
            padding: '3rem',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0',
            textAlign: 'center',
            color: '#64748b'
          }}>
            No active tasks in this department
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
              <span><strong>Tip:</strong> Drag tasks across columns to update their status. Use checkboxes and bulk assign to assign multiple tasks at once.</span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: department === 'CRM' ? 'repeat(5, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
              gap: '1.5rem',
              paddingBottom: '1rem',
              paddingTop: '0.5rem',
              width: '100%',
              minHeight: '400px',
              overflow: 'hidden'
            }} className="department-kanban-container">
              {(department === 'CRM' ? [
                { id: 'not_started', title: 'Not Yet Started' },
                { id: 'owned_in_progress', title: 'Owned/ In Progress' },
                { id: 'client_validation', title: 'Client Validation' },
                { id: 'forwarded', title: 'Forwarded' },
                { id: 'stuck', title: 'Stuck' }
              ] : [
                { id: 'not_started', title: 'Not yet started' },
                { id: 'owned_in_progress', title: 'Owned/In Progress' },
                { id: 'for_approval', title: 'For Approval' },
                { id: 'revision', title: 'Revision' },
                { id: 'elliot_review', title: 'Elliot Review' },
                { id: 'approved_completed', title: 'Approved/Completed' },
                { id: 'qa_before_client', title: 'QA Before Sending to Client' },
                { id: 'client_validation', title: 'Client Validation' }
              ]).map((column) => {
                const columnTasks = tasksByStatus[column.id] || [];
                const sortOrder = kanbanColumnSort[column.id] ?? 'newest';
                const sortedColumnTasks = sortKanbanTasksByCreatedAt(columnTasks, sortOrder);
                const isDragOver = dragOverColumn === column.id;
                
                return (
                  <div
                    key={column.id}
                    className="department-kanban-column"
                    style={{
                      width: '100%',
                      minWidth: 0,
                      maxWidth: '100%',
                      background: 'white',
                      borderRadius: '0.5rem',
                      boxShadow: isDragOver ? '0 4px 12px rgba(102, 126, 234, 0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
                      border: isDragOver ? '2px solid #667eea' : '2px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.2s',
                      height: 'fit-content',
                      maxHeight: 'calc(100vh - 300px)',
                      position: 'relative',
                      overflow: 'hidden'
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
                      
                      // Update task status based on column
                      try {
                        const task = tasks.find((t: any) => t.id === draggedTask);
                        if (!task) return;
                        
                        // Special handling for CRM Forwarded column
                        if (department === 'CRM' && column.id === 'forwarded') {
                          setForwardingTask(task);
                          setForwardData({
                            targetDepartment: '',
                            notes: '',
                            links: ''
                          });
                          setShowForwardModal(true);
                          return;
                        }
                        
                        // Special handling for CRM Client Validation column
                        if (department === 'CRM' && column.id === 'client_validation') {
                          const project = projects.find((p: any) => p.id === task.projectId);
                          setTaskForClientValidation(task);
                          setProjectForClientValidation(project);
                          // Pre-populate notes with task title
                          setClientValidationNotes(`Task: ${task.title}`);
                          setClientValidationLinks(['']);
                          setClientValidationTab('new'); // Open to New Log tab automatically
                          setClientValidationCommentTexts({});
                          // Load existing client updates for this project
                          if (project) {
                            loadClientValidationUpdates(project.id);
                          }
                          setShowClientValidationModal(true);
                          // Update task status to "In Review" (valid enum value) - we track client validation separately in logs
                          await taskService.updateStatus(task.id, 'In Review', false);
                          // Reload tasks
                          const allTasksData = await taskService.getAll(undefined, undefined, { all: true });
                          const taskType = getTaskTypeForDepartment(department || '');
                          const projectIdsSet = new Set(projects.map((p: any) => p.id));
                          const departmentTasks = allTasksData.filter((t: any) => 
                            t.type === taskType && 
                            !t.isCompleted &&
                            t.status !== 'Completed' &&
                            projectIdsSet.has(t.projectId)
                          );
                          setTasks(departmentTasks);
                          return;
                        }
                        
                        let newStatus = task.status;
                        if (department === 'CRM') {
                          // CRM-specific status mapping - use valid enum values
                          if (column.id === 'stuck') {
                            newStatus = 'Blocked'; // Use Blocked enum value for Stuck column
                          } else if (column.id === 'owned_in_progress') {
                            newStatus = 'In Progress';
                          } else if (column.id === 'not_started') {
                            newStatus = 'Todo';
                          }
                        } else {
                          // Standard status mapping - use valid enum values
                          // Valid enum values: 'Todo', 'In Progress', 'In Review', 'Completed', 'Blocked'
                          // For review columns, we store the column info in description to distinguish them
                          if (column.id === 'revision') {
                            newStatus = 'In Review'; // Map Revision to In Review (valid enum)
                            // Store column marker in description
                            const columnMarker = '\n\n--- Column: Revision ---';
                            const currentDesc = task.description || '';
                            if (!currentDesc.includes('--- Column: Revision ---')) {
                              try {
                                // Remove any existing column markers first
                                const cleanedDesc = currentDesc.replace(/\n\n--- Column: [^-]+ ---/g, '');
                                await taskService.update(task.id, {
                                  description: cleanedDesc + columnMarker
                                });
                              } catch (descError) {
                                console.warn('Failed to update description with column marker:', descError);
                                // Continue with status update even if description update fails
                              }
                            }
                          } else if (column.id === 'elliot_review') {
                            newStatus = 'In Review'; // Map Elliot Review to In Review (valid enum)
                            const columnMarker = '\n\n--- Column: Elliot Review ---';
                            const currentDesc = task.description || '';
                            if (!currentDesc.includes('--- Column: Elliot Review ---')) {
                              try {
                                const cleanedDesc = currentDesc.replace(/\n\n--- Column: [^-]+ ---/g, '');
                                await taskService.update(task.id, {
                                  description: cleanedDesc + columnMarker
                                });
                              } catch (descError) {
                                console.warn('Failed to update description with column marker:', descError);
                              }
                            }
                          } else if (column.id === 'approved_completed') {
                            newStatus = 'Completed'; // Valid enum value
                          } else if (column.id === 'qa_before_client') {
                            newStatus = 'In Review'; // Map QA Review to In Review (valid enum)
                            const columnMarker = '\n\n--- Column: QA Review ---';
                            const currentDesc = task.description || '';
                            if (!currentDesc.includes('--- Column: QA Review ---')) {
                              try {
                                const cleanedDesc = currentDesc.replace(/\n\n--- Column: [^-]+ ---/g, '');
                                await taskService.update(task.id, {
                                  description: cleanedDesc + columnMarker
                                });
                              } catch (descError) {
                                console.warn('Failed to update description with column marker:', descError);
                              }
                            }
                          } else if (column.id === 'client_validation') {
                            // Special handling for Client Validation column - open modal like CRM
                            const project = projects.find((p: any) => p.id === task.projectId);
                            setTaskForClientValidation(task);
                            setProjectForClientValidation(project);
                            // Pre-populate notes with task title
                            setClientValidationNotes(`Task: ${task.title}`);
                            setClientValidationLinks(['']);
                            setClientValidationTab('new'); // Open to New Log tab automatically
                            setClientValidationCommentTexts({});
                            // Load existing client updates for this project
                            if (project) {
                              loadClientValidationUpdates(project.id);
                            }
                            setShowClientValidationModal(true);
                            // Update task status to "In Review" (valid enum value) - we track client validation separately in logs
                            newStatus = 'In Review';
                            const columnMarker = '\n\n--- Column: Client Review ---';
                            const currentDesc = task.description || '';
                            if (!currentDesc.includes('--- Column: Client Review ---')) {
                              try {
                                const cleanedDesc = currentDesc.replace(/\n\n--- Column: [^-]+ ---/g, '');
                                await taskService.update(task.id, {
                                  description: cleanedDesc + columnMarker
                                });
                              } catch (descError) {
                                console.warn('Failed to update description with column marker:', descError);
                              }
                            }
                            await taskService.updateStatus(task.id, newStatus, false);
                            // Reload tasks
                            const allTasksData = await taskService.getAll(undefined, undefined, { all: true });
                            const taskType = getTaskTypeForDepartment(department || '');
                            const projectIdsSet = new Set(projects.map((p: any) => p.id));
                            const departmentTasks = allTasksData.filter((t: any) => 
                              t.type === taskType && 
                              !t.isCompleted &&
                              t.status !== 'Completed' &&
                              projectIdsSet.has(t.projectId)
                            );
                            setTasks(departmentTasks);
                            return; // Return early to prevent further status update
                          } else if (column.id === 'for_approval') {
                            newStatus = 'In Review'; // Map For Approval to In Review (valid enum)
                            const columnMarker = '\n\n--- Column: For Approval ---';
                            const currentDesc = task.description || '';
                            if (!currentDesc.includes('--- Column: For Approval ---')) {
                              try {
                                const cleanedDesc = currentDesc.replace(/\n\n--- Column: [^-]+ ---/g, '');
                                await taskService.update(task.id, {
                                  description: cleanedDesc + columnMarker
                                });
                              } catch (descError) {
                                console.warn('Failed to update description with column marker:', descError);
                              }
                            }
                          } else if (column.id === 'owned_in_progress') {
                            newStatus = 'In Progress'; // Valid enum value
                            // Clear any column markers when moving to in progress
                            const currentDesc = task.description || '';
                            if (currentDesc.includes('--- Column:')) {
                              try {
                                const cleanedDesc = currentDesc.replace(/\n\n--- Column: [^-]+ ---/g, '');
                                await taskService.update(task.id, {
                                  description: cleanedDesc
                                });
                              } catch (descError) {
                                console.warn('Failed to clear column marker from description:', descError);
                              }
                            }
                          } else if (column.id === 'not_started') {
                            newStatus = 'Todo'; // Valid enum value
                            // Clear any column markers when moving to not started
                            const currentDesc = task.description || '';
                            if (currentDesc.includes('--- Column:')) {
                              try {
                                const cleanedDesc = currentDesc.replace(/\n\n--- Column: [^-]+ ---/g, '');
                                await taskService.update(task.id, {
                                  description: cleanedDesc
                                });
                              } catch (descError) {
                                console.warn('Failed to clear column marker from description:', descError);
                              }
                            }
                          }
                        }

                        await taskService.updateStatus(task.id, newStatus, column.id === 'approved_completed');

                        // Log status change & deliverable history (mirror ProjectDetail)
                        await logStatusChangeForTask(task, newStatus, column.id);
                        
                        // Reload tasks - optimized
                        const allTasksData = await taskService.getAll(undefined, undefined, { all: true });
                        const taskType = getTaskTypeForDepartment(department || '');
                        const projectIdsSet = new Set(projects.map((p: any) => p.id));
                        const departmentTasks = allTasksData.filter((t: any) => 
                          t.type === taskType && 
                          !t.isCompleted &&
                          t.status !== 'Completed' &&
                          projectIdsSet.has(t.projectId)
                        );
                        setTasks(departmentTasks);
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
                        borderRadius: '0.5rem 0.5rem 0 0',
                        minWidth: 0,
                        width: '100%',
                        overflow: 'hidden'
                      }}
                    >
                      <h3 style={{ 
                        fontSize: '1rem', 
                        fontWeight: 600, 
                        color: '#1e293b', 
                        margin: '0 0 0.25rem 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
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
                          {columnTasks.length} task(s)
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
                      overflowX: 'hidden',
                      minHeight: '200px',
                      maxHeight: 'calc(100vh - 400px)',
                      minWidth: 0,
                      width: '100%'
                    }} className="department-kanban-column-content">
                      {sortedColumnTasks.map((task: any) => {
                        const projectName = getProjectName(task.projectId);
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
                            border: '1px solid #e2e8f0',
                            borderRadius: '0.5rem',
                            background: selectedTasks.has(task.id) ? '#f0f4ff' : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            position: 'relative',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            minWidth: 0,
                            width: '100%',
                            maxWidth: '100%',
                            boxSizing: 'border-box'
                          }}
                          onClick={(e) => {
                            // Don't navigate if clicking on checkbox, select, button, or interactive elements
                            const target = e.target as HTMLElement;
                            if (target.closest('input[type="checkbox"]') || 
                                target.closest('select') || 
                                target.closest('button') ||
                                target.tagName === 'INPUT' || 
                                target.tagName === 'SELECT' ||
                                target.tagName === 'BUTTON') {
                              return;
                            }
                            // Open task detail modal instead of navigating
                            handleOpenTaskDetail(task);
                          }}
                          onMouseEnter={(e) => {
                            if (!selectedTasks.has(task.id)) {
                              e.currentTarget.style.background = '#f8fafc';
                              e.currentTarget.style.borderColor = '#667eea';
                              e.currentTarget.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.15)';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!selectedTasks.has(task.id)) {
                              e.currentTarget.style.background = 'white';
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                            <input
                              type="checkbox"
                              checked={selectedTasks.has(task.id)}
                              onChange={() => handleTaskSelect(task.id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTaskSelect(task.id);
                              }}
                              style={{ marginTop: '0.25rem', flexShrink: 0, cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '0.25rem'
                              }}>
                                <div style={{
                                  fontSize: '0.75rem',
                                  color: '#667eea',
                                  fontWeight: 500
                                }}>
                                  {projectName}
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditTask(task);
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#667eea',
                                    cursor: 'pointer',
                                    padding: '0.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '4px',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f0f4ff';
                                    e.currentTarget.style.color = '#5568d3';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#667eea';
                                  }}
                                  title="Edit Task"
                                >
                                  <FaEdit style={{ fontSize: '0.75rem' }} />
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
                                  <span>
                                    {(() => {
                                      const assignees = task.assignees || [];
                                      const assigneeIds = assignees.length > 0
                                        ? assignees.map((a: any) => a.userId || a.user?.id)
                                        : (task.assignedToId ? [task.assignedToId] : []);
                                      
                                      if (assigneeIds.length === 0) {
                                        return 'Unassigned';
                                      } else if (assigneeIds.length === 1) {
                                        return getUserName(assigneeIds[0]);
                                      } else {
                                        return `${assigneeIds.slice(0, 2).map((id: string) => getUserName(id)).join(', ')}${
                                          assigneeIds.length > 2 ? ` +${assigneeIds.length - 2} more` : ''
                                        }`;
                                      }
                                    })()}
                                  </span>
                                </div>
                                {task.dueDate && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <FaClock style={{ fontSize: '0.75rem' }} />
                                    <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                                  </div>
                                )}
                              </div>
                              <select
                                value={task.assignedToId || task.assignedTo || ''}
                                onChange={async (e) => {
                                  try {
                                    const newAssignedToId = e.target.value;
                                    await taskService.assign(task.id, newAssignedToId);
                                    
                                    // For CRM: If assigning a task, update status to "In Progress" to keep it in "Owned/In Progress" column
                                    if (department === 'CRM' && newAssignedToId && task.status !== 'In Progress' && task.status !== 'Blocked') {
                                      try {
                                        await taskService.updateStatus(task.id, 'In Progress', false);
                                        setTasks((prev) =>
                                          prev.map((t: any) =>
                                            t.id === task.id ? { ...t, assignedTo: newAssignedToId, status: 'In Progress' } : t
                                          )
                                        );
                                      } catch (statusError) {
                                        console.error('Failed to update task status:', statusError);
                                        // Still update assignment even if status update fails
                                        setTasks((prev) =>
                                          prev.map((t: any) =>
                                            t.id === task.id ? { ...t, assignedTo: newAssignedToId } : t
                                          )
                                        );
                                      }
                                    } else {
                                      setTasks((prev) =>
                                        prev.map((t: any) =>
                                          t.id === task.id ? { ...t, assignedTo: newAssignedToId } : t
                                        )
                                      );
                                    }
                                  } catch (error) {
                                    console.error('Failed to assign task:', error);
                                    alert('Failed to assign task. Please try again.');
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  width: '100%',
                                  padding: '0.375rem',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '0.375rem',
                                  fontSize: '0.75rem',
                                  marginBottom: '0.5rem'
                                }}
                              >
                                <option value="">Unassigned</option>
                                {getDepartmentUsers.map((u: any) => (
                                  <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                              </select>
                              
                              {/* Status Dropdown */}
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem'
                              }}>
                                <label style={{
                                  fontSize: '0.7rem',
                                  color: '#64748b',
                                  fontWeight: 500
                                }}>
                                  Status:
                                </label>
                                <select
                                  value={task.status || 'Todo'}
                              onChange={(e) => {
                                const selectedStatus = e.target.value;

                                // For CRM, keep simple behavior (no notes modal here)
                                if (department === 'CRM') {
                                  handleTaskStatusChange(task.id, selectedStatus);
                                  return;
                                }

                                // For department boards, open notes modal for review/approval-style moves
                                const modalStatuses = [
                                  'In Review',      // For Approval
                                  'Revision',       // Revision column
                                  'Elliot Review',  // Elliot Review column
                                  'QA Review',      // QA Before Sending to Client
                                  'Completed',      // Approved/Completed
                                  'Blocked',        // Client Validation
                                ];

                                if (modalStatuses.includes(selectedStatus)) {
                                  const labelMap: Record<string, string> = {
                                    'Todo': 'Not Yet Started',
                                    'In Progress': 'Owned/In Progress',
                                    'In Review': 'For Approval',
                                    'Revision': 'Revision',
                                    'Elliot Review': 'Elliot Review',
                                    'QA Review': 'QA Before Sending to Client',
                                    'Completed': 'Approved/Completed',
                                    'Blocked': 'Client Validation',
                                  };

                                  setStatusChangeContext({
                                    taskId: task.id,
                                    newStatus: selectedStatus,
                                    label: labelMap[selectedStatus] || selectedStatus,
                                  });
                                  setStatusChangeNotes('');
                                  setStatusChangeAttachment('');
                                  setShowStatusChangeModal(true);
                                } else {
                                  // Simple statuses can update immediately
                                  handleTaskStatusChange(task.id, selectedStatus);
                                }
                              }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    width: '100%',
                                    padding: '0.375rem',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '0.375rem',
                                    fontSize: '0.75rem',
                                    background: 'white',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {department === 'CRM' ? (
                                    <>
                                      {/* Keep CRM labels as-is for clarity in that workflow */}
                                      <option value="Todo">Todo</option>
                                      <option value="In Progress">In Progress</option>
                                      <option value="In Review">In Review</option>
                                      <option value="Blocked">Blocked</option>
                                    </>
                                  ) : (
                                    <>
                                      {/* Mirror core enum statuses to kanban language without changing underlying values */}
                                      <option value="Todo">Not Yet Started</option>
                                      <option value="In Progress">Owned/In Progress</option>
                                      <option value="In Review">For Approval</option>
                                <option value="Revision">Revision</option>
                                <option value="Elliot Review">Elliot Review</option>
                                <option value="QA Review">QA Before Sending to Client</option>
                                      <option value="Completed">Approved/Completed</option>
                                      <option value="Blocked">Client Validation</option>
                                    </>
                                  )}
                                </select>
                              </div>
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
          <div style={{
            background: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden'
          }}>
            <div style={{
              overflowX: 'auto',
              overflowY: 'visible'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.875rem'
              }}>
                <thead>
                  <tr style={{
                    background: '#f8fafc',
                    borderBottom: '2px solid #e2e8f0'
                  }}>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#374151',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      width: '40px'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedTasks.size === tasks.length && tasks.length > 0}
                        onChange={handleSelectAll}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#374151',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      TASK TITLE
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#374151',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      PROJECT/CLIENT
                    </th>
                    {department === 'CRM' && (
                      <th style={{
                        padding: '1rem',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#374151',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        width: '120px'
                      }}>
                        CLIENT STATUS
                      </th>
                    )}
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#374151',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      STATUS
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#374151',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      ASSIGNED TO
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#374151',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      DUE DATE
                    </th>
                    <th style={{
                      padding: '1rem',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#374151',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      width: '100px'
                    }}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Filter tasks by search query
                    const hasSearch = searchQuery.trim().length > 0;
                    const q = searchQuery.toLowerCase();
                    const filteredTasks = hasSearch
                      ? tasks.filter((task: any) => {
                          const title = (task.title || '').toLowerCase();
                          const project = projects.find((p: any) => p.id === task.projectId);
                          const projectName = (project?.clientName || 'Unknown Project').toLowerCase();
                          return title.includes(q) || projectName.includes(q);
                        })
                      : tasks;
                    
                    if (filteredTasks.length === 0) {
                      return (
                        <tr>
                          <td colSpan={department === 'CRM' ? 8 : 7} style={{
                            padding: '3rem',
                            textAlign: 'center',
                            color: '#64748b',
                            fontSize: '0.875rem'
                          }}>
                            {hasSearch ? 'No tasks match your search' : 'No active tasks in this department'}
                          </td>
                        </tr>
                      );
                    }
                    
                    return filteredTasks.map((task: any) => {
                      const projectName = getProjectName(task.projectId);
                      const isSelected = selectedTasks.has(task.id);
                      
                      return (
                        <tr
                          key={task.id}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest('input[type="checkbox"]') || 
                                target.closest('select') || 
                                target.closest('button') ||
                                target.tagName === 'INPUT' || 
                                target.tagName === 'SELECT' ||
                                target.tagName === 'BUTTON') {
                              return;
                            }
                            // Open task detail modal instead of navigating
                            handleOpenTaskDetail(task);
                          }}
                          style={{
                            background: isSelected ? '#f0f4ff' : 'white',
                            borderBottom: '1px solid #e2e8f0',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = '#f8fafc';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = 'white';
                            }
                          }}
                        >
                          <td style={{ padding: '1rem' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleTaskSelect(task.id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTaskSelect(task.id);
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <div style={{
                              fontWeight: 600,
                              color: '#1e293b',
                              fontSize: '0.875rem',
                              marginBottom: '0.25rem'
                            }}>
                              {task.title}
                            </div>
                            {task.description && (
                              <div style={{
                                color: '#64748b',
                                fontSize: '0.75rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '300px'
                              }}>
                                {task.description}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <div style={{
                              color: '#667eea',
                              fontWeight: 500,
                              fontSize: '0.875rem'
                            }}>
                              {projectName}
                            </div>
                          </td>
                          {department === 'CRM' && (
                            <td style={{ padding: '1rem' }}>
                              <span style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                background: isProjectActive.get(task.projectId) ? '#d1fae5' : '#fee2e2',
                                color: isProjectActive.get(task.projectId) ? '#065f46' : '#991b1b',
                                whiteSpace: 'nowrap',
                                display: 'inline-block'
                              }}>
                                {isProjectActive.get(task.projectId) ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          )}
                          <td style={{ padding: '1rem' }}>
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              background: task.status === 'Completed' ? '#d1fae5' : 
                                         task.status === 'In Progress' ? '#dbeafe' :
                                         task.status === 'In Review' ? '#fef3c7' :
                                         task.status === 'Blocked' ? '#fee2e2' : '#f3f4f6',
                              color: task.status === 'Completed' ? '#065f46' : 
                                    task.status === 'In Progress' ? '#1e40af' :
                                    task.status === 'In Review' ? '#92400e' :
                                    task.status === 'Blocked' ? '#991b1b' : '#374151',
                              whiteSpace: 'nowrap'
                            }}>
                              {task.status}
                            </span>
                          </td>
                          <td style={{ padding: '1rem' }}>
                            {(() => {
                              const assignees = task.assignees || [];
                              const assigneeIds = assignees.length > 0
                                ? assignees.map((a: any) => a.userId || a.user?.id)
                                : (task.assignedToId ? [task.assignedToId] : []);
                              const primaryAssigneeId = assigneeIds[0] || '';
                              
                              return (
                                <select
                                  value={primaryAssigneeId}
                                  onChange={async (e) => {
                                    try {
                                      const newAssignedToId = e.target.value;
                                      await taskService.assign(task.id, newAssignedToId);
                                      
                                      // For CRM: If assigning a task, update status to "In Progress" to keep it in "Owned/In Progress" column
                                      if (department === 'CRM' && newAssignedToId && task.status !== 'In Progress' && task.status !== 'Blocked') {
                                        try {
                                          await taskService.updateStatus(task.id, 'In Progress', false);
                                          setTasks((prev) =>
                                            prev.map((t: any) =>
                                              t.id === task.id
                                                ? {
                                                    ...t,
                                                    assignedToId: newAssignedToId,
                                                    assignedTo: newAssignedToId,
                                                    assignees: newAssignedToId ? [{ userId: newAssignedToId }] : [],
                                                    status: 'In Progress',
                                                  }
                                                : t
                                            )
                                          );
                                        } catch (statusError) {
                                          console.error('Failed to update task status:', statusError);
                                          // Still update assignment even if status update fails
                                          setTasks((prev) =>
                                            prev.map((t: any) =>
                                              t.id === task.id
                                                ? {
                                                    ...t,
                                                    assignedToId: newAssignedToId,
                                                    assignedTo: newAssignedToId,
                                                    assignees: newAssignedToId ? [{ userId: newAssignedToId }] : [],
                                                  }
                                                : t
                                            )
                                          );
                                        }
                                      } else {
                                        setTasks((prev) =>
                                          prev.map((t: any) =>
                                            t.id === task.id
                                              ? {
                                                  ...t,
                                                  assignedToId: newAssignedToId,
                                                  assignedTo: newAssignedToId,
                                                  assignees: newAssignedToId ? [{ userId: newAssignedToId }] : [],
                                                }
                                              : t
                                          )
                                        );
                                      }
                                    } catch (error) {
                                      console.error('Failed to assign task:', error);
                                      alert('Failed to assign task. Please try again.');
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    padding: '0.5rem 0.75rem',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '0.375rem',
                                    fontSize: '0.875rem',
                                    background: 'white',
                                    color: '#1e293b',
                                    cursor: 'pointer',
                                    minWidth: '150px',
                                    maxWidth: '200px'
                                  }}
                                  onFocus={(e) => {
                                    e.target.style.borderColor = '#667eea';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                                  }}
                                  onBlur={(e) => {
                                    e.target.style.borderColor = '#e2e8f0';
                                    e.target.style.boxShadow = 'none';
                                  }}
                                >
                                  <option value="">Unassigned</option>
                                  {getDepartmentUsers.map((u: any) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                  ))}
                                </select>
                              );
                            })()}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            {task.dueDate ? (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                color: '#64748b',
                                fontSize: '0.875rem'
                              }}>
                                <FaClock style={{ fontSize: '0.75rem' }} />
                                <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                              </div>
                            ) : (
                              <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditTask(task);
                              }}
                              style={{
                                background: 'transparent',
                                border: '1px solid #e2e8f0',
                                color: '#667eea',
                                cursor: 'pointer',
                                padding: '0.5rem',
                                borderRadius: '0.375rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                                width: '36px',
                                height: '36px'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#f0f4ff';
                                e.currentTarget.style.borderColor = '#667eea';
                                e.currentTarget.style.color = '#5568d3';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.color = '#667eea';
                              }}
                              title="Edit Task"
                            >
                              <FaEdit style={{ fontSize: '0.875rem' }} />
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <div 
          className="modal-overlay" 
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
            setClientSearchQuery('');
            setShowClientDropdown(false);
            setMarkTaskCompleteOnCreate(false); // Reset checkbox
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
            className="add-task-modal" 
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
              <div>
                <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#111827' }}>
                  Add New Task - {department}
                </h2>
                {taskTemplates.length > 0 && (
                  <button
                    onClick={() => setShowTemplateModal(true)}
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem 1rem',
                      background: 'transparent',
                      border: '1px solid #667eea',
                      color: '#667eea',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <FaSave /> Use Template
                  </button>
                )}
              </div>
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
                  setMarkTaskCompleteOnCreate(false); // Reset checkbox
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative' }} className="client-searchable-dropdown">
                <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem' }}>
                  Select Client (Project) *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={newTaskData.projectId ? allProjects.find((p: any) => p.id === newTaskData.projectId)?.clientName || '' : clientSearchQuery}
                    onChange={(e) => {
                      setClientSearchQuery(e.target.value);
                      setShowClientDropdown(true);
                      if (newTaskData.projectId) {
                        setNewTaskData({ ...newTaskData, projectId: '', deliverableId: '' });
                        setShowCustomDeliverableInput(false);
                        setCustomDeliverableName('');
                      }
                    }}
                    placeholder="Search for a client..."
                    required={!newTaskData.projectId}
                    style={{
                      width: '100%',
                      padding: '1rem 1.25rem',
                      paddingRight: '3rem',
                      border: '1.5px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '1rem',
                      transition: 'all 0.2s',
                      background: '#ffffff',
                      color: '#111827',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#667eea';
                      e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
                      setShowClientDropdown(true);
                      if (!newTaskData.projectId) {
                        setClientSearchQuery('');
                      }
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowClientDropdown(false);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      right: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      color: '#6b7280'
                    }}
                  >
                    <FaSearch style={{ fontSize: '1rem' }} />
                  </div>
                  {showClientDropdown && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '0.25rem',
                        background: 'white',
                        border: '1.5px solid #e5e7eb',
                        borderRadius: '10px',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        zIndex: 1000,
                        marginBottom: '1rem'
                      }}
                    >
                      {filteredProjects.length === 0 ? (
                        <div style={{
                          padding: '1rem',
                          textAlign: 'center',
                          color: '#64748b',
                          fontSize: '0.875rem'
                        }}>
                          No clients found
                        </div>
                      ) : (
                        filteredProjects.map((project: any) => (
                          <div
                            key={project.id}
                            onClick={() => {
                              setNewTaskData({ ...newTaskData, projectId: project.id, deliverableId: '' });
                              setShowCustomDeliverableInput(false);
                              setCustomDeliverableName('');
                              setClientSearchQuery('');
                              setShowClientDropdown(false);
                            }}
                            style={{
                              padding: '0.875rem 1.25rem',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f3f4f6',
                              transition: 'background 0.15s',
                              color: '#111827',
                              fontSize: '0.9375rem'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f9fafb';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'white';
                            }}
                          >
                            {project.clientName || 'Unknown Client'}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem' }}>
                  Task Title *
                </label>
                <input
                  type="text"
                  value={newTaskData.title}
                  onChange={(e) => setNewTaskData({ ...newTaskData, title: e.target.value })}
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
                    e.target.style.borderColor = '#667eea';
                    e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
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
                  value={newTaskData.description}
                  onChange={(e) => setNewTaskData({ ...newTaskData, description: e.target.value })}
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
                    e.target.style.borderColor = '#667eea';
                    e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
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
                  value={newTaskData.dueDate}
                  onChange={(e) => setNewTaskData({ ...newTaskData, dueDate: e.target.value })}
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
                    e.target.style.borderColor = '#667eea';
                    e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {newTaskData.projectId && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem' }}>
                    Associate with Deliverable (Optional)
                  </label>
                  <select
                    value={showCustomDeliverableInput ? 'custom' : newTaskData.deliverableId}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setShowCustomDeliverableInput(true);
                        setNewTaskData({ ...newTaskData, deliverableId: '' });
                      } else {
                        setShowCustomDeliverableInput(false);
                        setCustomDeliverableName('');
                        setNewTaskData({ ...newTaskData, deliverableId: e.target.value });
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
                      e.target.style.borderColor = '#667eea';
                      e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <option value="">None</option>
                    {deliverables.map((deliverable) => (
                      <option key={deliverable.id} value={deliverable.id}>
                        {deliverable.customType || deliverable.type}
                      </option>
                    ))}
                    <option value="custom">➕ Add Custom Deliverable</option>
                  </select>
                  {showCustomDeliverableInput && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                      <input
                        type="text"
                        placeholder="Enter custom deliverable name (e.g., Email Templates, Social Media Posts)"
                        value={customDeliverableName}
                        onChange={(e) => setCustomDeliverableName(e.target.value)}
                        autoFocus
                        style={{
                          flex: 1,
                          padding: '1rem 1.25rem',
                          border: '1.5px solid #667eea',
                          borderRadius: '10px',
                          fontSize: '1rem',
                          transition: 'all 0.2s',
                          background: '#ffffff',
                          color: '#111827',
                          fontFamily: 'inherit'
                        }}
                        onFocus={(e) => {
                          e.target.style.outline = 'none';
                          e.target.style.borderColor = '#667eea';
                          e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#667eea';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomDeliverableInput(false);
                          setCustomDeliverableName('');
                          setNewTaskData({ ...newTaskData, deliverableId: '' });
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
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem' }}>
                  Assign To (Optional)
                </label>
                <select
                  value={newTaskData.assignedToId}
                  onChange={(e) => setNewTaskData({ ...newTaskData, assignedToId: e.target.value })}
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
                    e.target.style.borderColor = '#667eea';
                    e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="">Unassigned</option>
                  {getDepartmentUsers.map((u: any) => (
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
                  setClientSearchQuery('');
                  setShowClientDropdown(false);
                  setMarkTaskCompleteOnCreate(false); // Reset checkbox
                }}
                disabled={creatingTask}
                style={{
                  background: '#ffffff',
                  color: '#374151',
                  border: '1.5px solid #e5e7eb',
                  padding: '0.875rem 1.75rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: creatingTask ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: creatingTask ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!creatingTask) {
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!creatingTask) {
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
                onClick={handleCreateTask}
                disabled={creatingTask || !newTaskData.projectId || !newTaskData.title.trim()}
                style={{
                  background: creatingTask || !newTaskData.projectId || !newTaskData.title.trim() ? '#cbd5e1' : '#667eea',
                  color: 'white',
                  border: 'none',
                  padding: '0.875rem 1.75rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: creatingTask || !newTaskData.projectId || !newTaskData.title.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                  opacity: creatingTask || !newTaskData.projectId || !newTaskData.title.trim() ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!creatingTask && newTaskData.projectId && newTaskData.title.trim()) {
                    e.currentTarget.style.background = '#5568d3';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!creatingTask && newTaskData.projectId && newTaskData.title.trim()) {
                    e.currentTarget.style.background = '#667eea';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <FaPlus /> {creatingTask ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {showExcelImportModal && (
        <div 
          className="modal-overlay" 
          onClick={() => {
            setShowExcelImportModal(false);
            setExcelPreview([]);
            setImportError('');
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
            className="excel-import-modal" 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '900px',
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
                Import Tasks from Excel
              </h2>
              <button 
                onClick={() => {
                  setShowExcelImportModal(false);
                  setExcelPreview([]);
                  setImportError('');
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
              gap: '1.5rem',
              overflowY: 'auto',
              flex: 1
            }}>
              <div style={{
                padding: '1rem',
                background: '#f0f4ff',
                border: '1px solid #c7d2fe',
                borderRadius: '8px',
                fontSize: '0.875rem',
                color: '#4c51bf'
              }}>
                <strong>Instructions:</strong> Upload an Excel file with "Client" and "Status" columns. 
                The system will match client names to existing projects and create tasks with the appropriate status.
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  fontWeight: 600, 
                  color: '#374151', 
                  fontSize: '0.9375rem',
                  marginBottom: '0.5rem'
                }}>
                  Select Excel File
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelUpload}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1.5px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.9375rem',
                    cursor: 'pointer'
                  }}
                />
              </div>

              {importError && (
                <div style={{
                  padding: '1rem',
                  background: importError.includes('Successfully') ? '#d1fae5' : '#fee2e2',
                  border: `1px solid ${importError.includes('Successfully') ? '#86efac' : '#fca5a5'}`,
                  borderRadius: '8px',
                  color: importError.includes('Successfully') ? '#065f46' : '#991b1b',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-line'
                }}>
                  {importError}
                </div>
              )}

              {excelPreview.length > 0 && (
                <div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>
                      Preview ({excelPreview.length} rows)
                    </h3>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      {excelPreview.filter((r: any) => r.matched).length} matched, {excelPreview.filter((r: any) => !r.matched).length} not found
                    </div>
                  </div>
                  <div style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Row</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Client</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Status</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Task Title</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Task Status</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Project</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Match</th>
                        </tr>
                      </thead>
                      <tbody>
                        {excelPreview.map((row: any, index: number) => (
                          <tr 
                            key={index}
                            style={{
                              borderBottom: '1px solid #e5e7eb',
                              background: row.matched ? 'white' : '#fef2f2'
                            }}
                          >
                            <td style={{ padding: '0.75rem', color: '#6b7280' }}>{row.rowIndex}</td>
                            <td style={{ padding: '0.75rem', color: '#111827' }}>{row.client}</td>
                            <td style={{ padding: '0.75rem', color: '#111827' }}>{row.status}</td>
                            <td style={{ padding: '0.75rem', color: '#111827', fontWeight: 500 }}>
                              {row.taskTitle || '-'}
                            </td>
                            <td style={{ padding: '0.75rem', color: '#111827' }}>
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                background: '#f3f4f6',
                                fontSize: '0.75rem',
                                fontWeight: 500
                              }}>
                                {row.taskStatus}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem', color: '#111827' }}>
                              {row.project ? row.project.name : '-'}
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              {row.matched ? (
                                <span style={{ color: '#10b981', fontWeight: 500 }}>✓ Matched</span>
                              ) : (
                                <span style={{ color: '#ef4444', fontWeight: 500 }}>✗ Not Found</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              padding: '2rem 2.5rem',
              borderTop: '1px solid #f3f4f6',
              gap: '0.875rem'
            }}>
              <button
                type="button"
                onClick={() => {
                  setShowExcelImportModal(false);
                  setExcelPreview([]);
                  setImportError('');
                }}
                disabled={uploadingTasks}
                style={{
                  background: '#ffffff',
                  color: '#374151',
                  border: '1.5px solid #e5e7eb',
                  padding: '0.875rem 1.75rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: uploadingTasks ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: uploadingTasks ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkCreateTasks}
        disabled={
          uploadingTasks ||
          excelPreview.length === 0 ||
          excelPreview.filter((r: any) => !!r.client).length === 0
        }
                style={{
          background:
            uploadingTasks ||
            excelPreview.length === 0 ||
            excelPreview.filter((r: any) => !!r.client).length === 0
              ? '#cbd5e1'
              : '#667eea',
                  color: 'white',
                  border: 'none',
                  padding: '0.875rem 1.75rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
          cursor:
            uploadingTasks ||
            excelPreview.length === 0 ||
            excelPreview.filter((r: any) => !!r.client).length === 0
              ? 'not-allowed'
              : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
          opacity:
            uploadingTasks ||
            excelPreview.length === 0 ||
            excelPreview.filter((r: any) => !!r.client).length === 0
              ? 0.5
              : 1
                }}
              >
        <FaUpload />{' '}
        {uploadingTasks
          ? 'Creating Tasks...'
          : `Create ${excelPreview.filter((r: any) => !!r.client).length} Task(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Task Modal */}
      {showTemplateModal && (
        <div 
          className="modal-overlay" 
          onClick={() => {
            setShowTemplateModal(false);
            setTemplateData({
              name: '',
              title: '',
              description: '',
              deliverableType: '',
              defaultStatus: 'Todo'
            });
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
            className="template-modal" 
            onClick={(e) => e.stopPropagation()}
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
                Task Templates
              </h2>
              <button 
                onClick={() => {
                  setShowTemplateModal(false);
                  setTemplateData({
                    name: '',
                    title: '',
                    description: '',
                    deliverableType: '',
                    defaultStatus: 'Todo'
                  });
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
              >
                <FaTimes />
              </button>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '2rem 2.5rem',
              gap: '1.5rem',
              overflowY: 'auto',
              flex: 1
            }}>
              {taskTemplates.length > 0 && (
                <div>
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#374151' }}>
                    Existing Templates
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    {taskTemplates.map((template: any) => (
                      <div
                        key={template.id}
                        style={{
                          padding: '1rem',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#111827', marginBottom: '0.25rem' }}>
                            {template.name}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            {template.title}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedTemplate(template.id);
                            handleLoadTemplate();
                          }}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: 500
                          }}
                        >
                          Use Template
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#374151' }}>
                  Create New Template
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, color: '#374151', fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
                      Template Name *
                    </label>
                    <input
                      type="text"
                      value={templateData.name}
                      onChange={(e) => setTemplateData({ ...templateData, name: e.target.value })}
                      placeholder="e.g., Standard Copy Task"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1.5px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '0.9375rem'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, color: '#374151', fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
                      Task Title *
                    </label>
                    <input
                      type="text"
                      value={templateData.title}
                      onChange={(e) => setTemplateData({ ...templateData, title: e.target.value })}
                      placeholder="e.g., Create Copy for Home Page"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1.5px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '0.9375rem'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, color: '#374151', fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
                      Description
                    </label>
                    <textarea
                      value={templateData.description}
                      onChange={(e) => setTemplateData({ ...templateData, description: e.target.value })}
                      rows={3}
                      placeholder="Task description..."
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1.5px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '0.9375rem',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, color: '#374151', fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
                      Default Status
                    </label>
                    <select
                      value={templateData.defaultStatus}
                      onChange={(e) => setTemplateData({ ...templateData, defaultStatus: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1.5px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '0.9375rem'
                      }}
                    >
                      <option value="Todo">Todo</option>
                      <option value="In Progress">In Progress</option>
                      <option value="In Review">In Review</option>
                      <option value="For Approval">For Approval</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              padding: '2rem 2.5rem',
              borderTop: '1px solid #f3f4f6',
              gap: '0.875rem'
            }}>
              <button
                type="button"
                onClick={() => {
                  setShowTemplateModal(false);
                  setTemplateData({
                    name: '',
                    title: '',
                    description: '',
                    deliverableType: '',
                    defaultStatus: 'Todo'
                  });
                }}
                style={{
                  background: '#ffffff',
                  color: '#374151',
                  border: '1.5px solid #e5e7eb',
                  padding: '0.875rem 1.75rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={!templateData.name.trim() || !templateData.title.trim()}
                style={{
                  background: !templateData.name.trim() || !templateData.title.trim() ? '#cbd5e1' : '#667eea',
                  color: 'white',
                  border: 'none',
                  padding: '0.875rem 1.75rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: !templateData.name.trim() || !templateData.title.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                  opacity: !templateData.name.trim() || !templateData.title.trim() ? 0.5 : 1
                }}
              >
                <FaSave /> Save Template
              </button>
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
                    e.target.style.borderColor = '#667eea';
                    e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
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
                    e.target.style.borderColor = '#667eea';
                    e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
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
                    e.target.style.borderColor = '#667eea';
                    e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
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
                    e.target.style.borderColor = '#667eea';
                    e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="">None</option>
                  {editDeliverables.map((deliverable) => (
                    <option key={deliverable.id} value={deliverable.id}>
                      {deliverable.customType || deliverable.type}
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
                        border: '1.5px solid #667eea',
                        borderRadius: '10px',
                        fontSize: '1rem',
                        transition: 'all 0.2s',
                        background: '#ffffff',
                        color: '#111827',
                        fontFamily: 'inherit'
                      }}
                      onFocus={(e) => {
                        e.target.style.outline = 'none';
                        e.target.style.borderColor = '#667eea';
                        e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#667eea';
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

              {/* Mark as Completed Checkbox - for PMs to quickly mark tasks as done */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.75rem',
                padding: '1rem',
                background: '#f9fafb',
                borderRadius: '10px',
                border: '1px solid #e5e7eb'
              }}>
                <input
                  type="checkbox"
                  id="markCompleteCheckbox"
                  checked={markTaskCompleteOnCreate}
                  onChange={(e) => setMarkTaskCompleteOnCreate(e.target.checked)}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                    accentColor: '#667eea'
                  }}
                />
                <label 
                  htmlFor="markCompleteCheckbox"
                  style={{ 
                    fontWeight: 500, 
                    color: '#374151', 
                    fontSize: '0.9375rem',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  ✓ Mark as completed (for work already done)
                </label>
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
                    e.target.style.borderColor = '#667eea';
                    e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="">Unassigned</option>
                  {getDepartmentUsers.map((u: any) => (
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
                disabled={updatingTask}
                style={{
                  background: '#ffffff',
                  color: '#374151',
                  border: '1.5px solid #e5e7eb',
                  padding: '0.875rem 1.75rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: updatingTask ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: updatingTask ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!updatingTask) {
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!updatingTask) {
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
                disabled={updatingTask || !editTaskData.title.trim()}
                style={{
                  background: updatingTask || !editTaskData.title.trim() ? '#cbd5e1' : '#667eea',
                  color: 'white',
                  border: 'none',
                  padding: '0.875rem 1.75rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: updatingTask || !editTaskData.title.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                  opacity: updatingTask || !editTaskData.title.trim() ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!updatingTask && editTaskData.title.trim()) {
                    e.currentTarget.style.background = '#5568d3';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!updatingTask && editTaskData.title.trim()) {
                    e.currentTarget.style.background = '#667eea';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <FaSave /> {updatingTask ? 'Updating...' : 'Update Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forward Task Modal (CRM) */}
      {showForwardModal && forwardingTask && (
        <div 
          className="modal-overlay" 
          onClick={() => {
            setShowForwardModal(false);
            setForwardingTask(null);
            setForwardData({
              targetDepartment: '',
              notes: '',
              links: ''
            });
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
            className="forward-task-modal" 
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
                Forward Task - {getProjectName(forwardingTask.projectId)}
              </h2>
              <button 
                onClick={() => {
                  setShowForwardModal(false);
                  setForwardingTask(null);
                  setForwardData({
                    targetDepartment: '',
                    notes: '',
                    links: ''
                  });
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
              <div style={{
                padding: '1rem',
                background: '#f0f4ff',
                border: '1px solid #c7d2fe',
                borderRadius: '8px',
                fontSize: '0.875rem',
                color: '#4c51bf'
              }}>
                <strong>Task:</strong> {forwardingTask.title}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem' }}>
                  Forward to Department *
                </label>
                <select
                  value={forwardData.targetDepartment}
                  onChange={(e) => setForwardData({ ...forwardData, targetDepartment: e.target.value })}
                  required
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
                    e.target.style.borderColor = '#667eea';
                    e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="">Select department...</option>
                  {departmentMenuItems.filter(d => d.id !== 'CRM').map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem' }}>
                  Notes (Optional)
                </label>
                <textarea
                  value={forwardData.notes}
                  onChange={(e) => setForwardData({ ...forwardData, notes: e.target.value })}
                  rows={4}
                  placeholder="Add any notes about forwarding this task..."
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
                    e.target.style.borderColor = '#667eea';
                    e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9375rem' }}>
                  Links (Optional)
                </label>
                <textarea
                  value={forwardData.links}
                  onChange={(e) => setForwardData({ ...forwardData, links: e.target.value })}
                  rows={3}
                  placeholder="Add any relevant links (one per line or comma-separated)..."
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
                    minHeight: '90px',
                    lineHeight: '1.6'
                  }}
                  onFocus={(e) => {
                    e.target.style.outline = 'none';
                    e.target.style.borderColor = '#667eea';
                    e.target.style.boxShadow = '0 0 0 4px rgba(102, 126, 234, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
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
                  setShowForwardModal(false);
                  setForwardingTask(null);
                  setForwardData({
                    targetDepartment: '',
                    notes: '',
                    links: ''
                  });
                }}
                disabled={forwarding}
                style={{
                  background: '#ffffff',
                  color: '#374151',
                  border: '1.5px solid #e5e7eb',
                  padding: '0.875rem 1.75rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: forwarding ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: forwarding ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!forwarding) {
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!forwarding) {
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
                onClick={handleForwardTask}
                disabled={forwarding || !forwardData.targetDepartment}
                style={{
                  background: forwarding || !forwardData.targetDepartment ? '#cbd5e1' : '#667eea',
                  color: 'white',
                  border: 'none',
                  padding: '0.875rem 1.75rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: forwarding || !forwardData.targetDepartment ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                  opacity: forwarding || !forwardData.targetDepartment ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!forwarding && forwardData.targetDepartment) {
                    e.currentTarget.style.background = '#5568d3';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!forwarding && forwardData.targetDepartment) {
                    e.currentTarget.style.background = '#667eea';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <FaShareAlt /> {forwarding ? 'Forwarding...' : 'Forward Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Validation Modal (CRM) */}
      {showClientValidationModal && taskForClientValidation && projectForClientValidation && (
        <>
          <div 
            className="modal-overlay" 
            onClick={() => {
              setShowClientValidationModal(false);
              setTaskForClientValidation(null);
              setProjectForClientValidation(null);
              setClientValidationNotes('');
              setClientValidationLinks(['']);
              setClientValidationUpdates([]);
              setClientValidationTab('logs');
              setClientValidationCommentTexts({});
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
                  Client Validation Logs
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                  {projectForClientValidation.clientName} - {taskForClientValidation.title}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowClientValidationModal(false);
                  setTaskForClientValidation(null);
                  setProjectForClientValidation(null);
                  setClientValidationNotes('');
                  setClientValidationLinks(['']);
                  setClientValidationUpdates([]);
                  setClientValidationTab('logs');
                  setClientValidationCommentTexts({});
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
                onClick={() => setClientValidationTab('logs')}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: clientValidationTab === 'logs' ? '2px solid #667eea' : '2px solid transparent',
                  color: clientValidationTab === 'logs' ? '#667eea' : '#64748b',
                  fontWeight: clientValidationTab === 'logs' ? 600 : 500,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Logs ({clientValidationUpdates.length})
              </button>
              <button
                onClick={() => setClientValidationTab('new')}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: clientValidationTab === 'new' ? '2px solid #667eea' : '2px solid transparent',
                  color: clientValidationTab === 'new' ? '#667eea' : '#64748b',
                  fontWeight: clientValidationTab === 'new' ? 600 : 500,
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
              {clientValidationTab === 'logs' ? (
                /* Existing Logs Tab */
                loadingClientValidationUpdates ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    Loading logs...
                  </div>
                ) : clientValidationUpdates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    <FaEnvelope style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }} />
                    <p>No client validation logs yet. Click "New Log" to create one.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {clientValidationUpdates.map((update) => (
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
                                {update.pm?.name || 'User'}
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
                        {clientValidationComments[update.id] && clientValidationComments[update.id].length > 0 && (
                          <div style={{
                            marginTop: '1rem',
                            paddingTop: '1rem',
                            borderTop: '1px solid #e5e7eb',
                          }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b', marginBottom: '0.75rem' }}>
                              Comments ({clientValidationComments[update.id].length}):
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {clientValidationComments[update.id].map((comment) => (
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
                            value={clientValidationCommentTexts[update.id] || ''}
                            onChange={(e) => {
                              const cursorPos = e.target.selectionStart || 0;
                              handleClientValidationCommentInput(update.id, e.target.value, cursorPos);
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
                          {showClientValidationMentionDropdown && showClientValidationMentionDropdown.updateId === update.id && (
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
                                    const currentText = clientValidationCommentTexts[update.id] || '';
                                    const beforeCursor = currentText.substring(0, showClientValidationMentionDropdown.position - 1);
                                    const afterCursor = currentText.substring(showClientValidationMentionDropdown.position);
                                    const newText = `${beforeCursor}@${user.name} ${afterCursor}`;
                                    setClientValidationCommentTexts({ ...clientValidationCommentTexts, [update.id]: newText });
                                    setShowClientValidationMentionDropdown(null);
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
                            onClick={() => handleAddClientValidationComment(update.id)}
                            disabled={!clientValidationCommentTexts[update.id]?.trim() || submittingClientValidationComment[update.id]}
                            style={{
                              background: submittingClientValidationComment[update.id] ? '#9ca3af' : '#667eea',
                              border: 'none',
                              color: 'white',
                              padding: '0.5rem 1rem',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              fontWeight: 500,
                              cursor: submittingClientValidationComment[update.id] ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {submittingClientValidationComment[update.id] ? 'Posting...' : 'Post Comment'}
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
                  value={clientValidationNotes}
                  onChange={(e) => setClientValidationNotes(e.target.value)}
                  placeholder="Add any notes about this client validation..."
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
                    onClick={addClientValidationLink}
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
                {clientValidationLinks.map((link, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    gap: '0.5rem', 
                    marginBottom: index < clientValidationLinks.length - 1 ? '0.5rem' : '0',
                    alignItems: 'flex-start'
                  }}>
                    <input
                      type="url"
                      value={link}
                      onChange={(e) => updateClientValidationLink(index, e.target.value)}
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
                    {clientValidationLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeClientValidationLink(index)}
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
                  Attach links to relevant documents, files, or resources sent for client validation
                </p>
                  </div>
                </>
              )}
            </div>

            {/* Footer - Only show in New Log tab */}
            {clientValidationTab === 'new' && (
              <div style={{
                padding: '1.5rem',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'flex-end',
              }}>
                <button
                  onClick={() => {
                    setClientValidationTab('logs');
                    setClientValidationNotes('');
                    setClientValidationLinks(['']);
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
                  onClick={handleClientValidationLogSubmit}
                  disabled={loggingClientValidation}
                  style={{
                    background: loggingClientValidation ? '#9ca3af' : '#667eea',
                    border: 'none',
                    color: 'white',
                    padding: '0.625rem 1.25rem',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: loggingClientValidation ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                  onMouseEnter={(e) => {
                    if (!loggingClientValidation) {
                      e.currentTarget.style.background = '#5568d3';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loggingClientValidation) {
                      e.currentTarget.style.background = '#667eea';
                    }
                  }}
                >
                  <FaSave /> {loggingClientValidation ? 'Saving...' : 'Save Log'}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Status Change Notes Modal for task status updates (Department boards) */}
      {showStatusChangeModal && statusChangeContext && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (statusChangeLoading) return;
            setShowStatusChangeModal(false);
            setStatusChangeContext(null);
            setStatusChangeNotes('');
            setStatusChangeAttachment('');
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
            zIndex: 2100,
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
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
          >
            <div
              className="modal-header"
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
                Update Status – {statusChangeContext.label}
              </h2>
              <button
                className="close-button"
                onClick={() => {
                  if (statusChangeLoading) return;
                  setShowStatusChangeModal(false);
                  setStatusChangeContext(null);
                  setStatusChangeNotes('');
                  setStatusChangeAttachment('');
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
              className="modal-body"
              style={{
                padding: '1.5rem 2rem',
                flex: 1,
                overflowY: 'auto',
              }}
            >
              <p style={{ marginBottom: '1.5rem', color: '#6b7280', fontSize: '0.9rem' }}>
                Add notes and links so PMs and team leads can see why this task moved into "
                {statusChangeContext.label}".
              </p>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
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
                  className="form-input"
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

              <div className="form-group">
                <label
                  htmlFor="status-change-attachment"
                  style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}
                >
                  Attachment/Link (Optional)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FaLink style={{ color: '#6b7280', fontSize: '0.875rem' }} />
                  <input
                    id="status-change-attachment"
                    type="url"
                    value={statusChangeAttachment}
                    onChange={(e) => setStatusChangeAttachment(e.target.value)}
                    className="form-input"
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
                </div>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem', marginBottom: 0 }}>
                  Use this to attach references, client feedback, or handoff links.
                </p>
              </div>
            </div>

            <div
              className="modal-footer"
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
                className="btn-secondary"
                onClick={() => {
                  if (statusChangeLoading) return;
                  setShowStatusChangeModal(false);
                  setStatusChangeContext(null);
                  setStatusChangeNotes('');
                  setStatusChangeAttachment('');
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
                className="btn-primary"
                onClick={async () => {
                  if (!statusChangeContext) return;
                  try {
                    setStatusChangeLoading(true);
                    await handleTaskStatusChange(
                      statusChangeContext.taskId,
                      statusChangeContext.newStatus,
                      statusChangeNotes,
                      statusChangeAttachment
                    );
                    setShowStatusChangeModal(false);
                    setStatusChangeContext(null);
                    setStatusChangeNotes('');
                    setStatusChangeAttachment('');
                  } finally {
                    setStatusChangeLoading(false);
                  }
                }}
                disabled={statusChangeLoading}
                style={{
                  background: statusChangeLoading ? '#9ca3af' : '#667eea',
                  border: 'none',
                  color: 'white',
                  padding: '0.6rem 1.4rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: statusChangeLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {statusChangeLoading ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {showNotificationModal && (
        <div 
          className="modal-overlay" 
          onClick={() => setShowNotificationModal(false)}
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
            zIndex: 2000,
            backdropFilter: 'blur(4px)'
          }}
        >
          <div 
            className="notification-modal" 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '400px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              margin: '1rem',
              animation: 'slideUp 0.3s ease-out'
            }}
          >
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              background: notificationType === 'success' 
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: 'white'
            }}>
              <div style={{
                fontSize: '3rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                {notificationType === 'success' ? '✓' : '✗'}
              </div>
              <h3 style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 600,
                color: 'white'
              }}>
                {notificationType === 'success' ? 'Success!' : 'Error'}
              </h3>
            </div>
            <div style={{
              padding: '1.5rem 2rem',
              textAlign: 'center'
            }}>
              <p style={{
                margin: 0,
                fontSize: '1rem',
                color: '#374151',
                lineHeight: '1.6'
              }}>
                {notificationMessage}
              </p>
            </div>
            <div style={{
              padding: '1rem 2rem 2rem 2rem',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => setShowNotificationModal(false)}
                style={{
                  background: notificationType === 'success' ? '#10b981' : '#ef4444',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 2rem',
                  borderRadius: '8px',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                }}
              >
                OK
              </button>
            </div>
          </div>
          </div>
        )}
      </div>

      <TaskDetailSideModal
        isOpen={showTaskDetailModal}
        task={selectedTaskDetail}
        onClose={handleCloseTaskDetail}
        allUsers={users}
        getProjectName={getProjectName}
        getProjectPmName={getProjectPmName}
        onTaskUpdate={(updatedTask: any) => {
          setSelectedTaskDetail(updatedTask);
          setTasks((prev) => prev.map((t: any) => (t.id === updatedTask.id ? updatedTask : t)));
        }}
      />
    </div>
  );
};

export default DepartmentView;

