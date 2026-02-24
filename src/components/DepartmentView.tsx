import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaUser, FaClock, FaPlus, FaTimes, FaCopy, FaPalette, FaCode, FaRobot, FaShareAlt, FaDatabase, FaSearch, FaClipboardList, FaUpload, FaFileExcel, FaSave, FaEdit } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import { authService } from '../services/auth.service';
import { deliverableService } from '../services/deliverable.service';
import './Dashboard.css';

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
  useEffect(() => {
    const loadData = async () => {
      if (!department) return;
      
      try {
        setLoading(true);
        const taskType = getTaskTypeForDepartment(department);
        const internalStages = getInternalStagesForDepartment(department);
        
        // Step 1: Fetch ALL tasks first (we need to filter by type)
        // This is still needed to find which projects have tasks of this type
        const allTasksData = await taskService.getAll();
        
        // Step 2: Quickly filter tasks by type (early filtering)
        const departmentTaskType = taskType;
        const relevantTasks = allTasksData.filter((t: any) => 
          t.type === departmentTaskType && 
          !t.isCompleted &&
          t.status !== 'Completed'
        );
        
        // Step 3: Get unique project IDs from relevant tasks (Set for O(1) lookup)
        const projectIdsWithTasks = new Set(relevantTasks.map((t: any) => t.projectId));
        
        // Step 4: Fetch projects - use cache if available
        let allProjectsData: any[];
        if (allProjectsCacheRef.current.length > 0) {
          allProjectsData = allProjectsCacheRef.current;
        } else {
          allProjectsData = await projectService.getAll();
          allProjectsCacheRef.current = allProjectsData; // Cache for future use
        }
        setAllProjects(allProjectsData); // Store for modal
        
        // Step 5: Filter projects efficiently using Set lookup
        // Include projects that:
        // 1. Have tasks of this department type, OR
        // 2. Are in the department stage, OR
        // 3. Match CRM special case
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
          
          // CRM special case
          if (department === 'CRM') {
            const allClientTypes = [
              project.clientType,
              ...(project.secondaryClientTypes 
                ? (Array.isArray(project.secondaryClientTypes) 
                    ? project.secondaryClientTypes 
                    : project.secondaryClientTypes.split(',').map((t: string) => t.trim()).filter((t: string) => !!t))
                : [])
            ];
            if (allClientTypes.some(isKatalyst)) {
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
    };

    loadData();
  }, [department]);

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
      const allTasksData = await taskService.getAll();
      const taskType = getTaskTypeForDepartment(department || '');
      const projectIdsSet = new Set(projects.map((p: any) => p.id));
      const departmentTasks = allTasksData.filter((t: any) => 
        t.type === taskType && 
        !t.isCompleted &&
        t.status !== 'Completed' &&
        projectIdsSet.has(t.projectId)
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
    for (const task of tasks) {
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
  }, [tasks]);

  // Get task status for Kanban columns (similar to ProjectDetail)
  const getTaskStatus = (task: any): string => {
    // If task has a file URL and deliverable, check deliverable status
    if (task.fileUrl && task.deliverableId) {
      // This would require fetching deliverable data, but for now we'll use task status
      // You might need to load deliverable data separately if needed
    }
    
    // Use task status to determine column
    if (task.status === 'Completed' || task.isCompleted) {
      return 'approved_completed';
    }
    
    // Check if assigned
    if (task.assignedTo) {
      if (task.status === 'In Progress' || task.status === 'In Review') {
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
      // Default for assigned tasks
      return 'owned_in_progress';
    }
    
    // Unassigned tasks
    return 'not_started';
  };

  // Group tasks by status for Kanban view - optimized
  const tasksByStatus = useMemo(() => {
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
    
    // Use for loop for better performance
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const status = getTaskStatus(task);
      const group = grouped[status];
      if (group) {
        group.push(task);
      }
    }
    
    return grouped;
  }, [tasks]);

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
    for (const user of users) {
      map.set(user.id, user.name || 'Unassigned');
    }
    return map;
  }, [users]);

  const getUserName = (userId: string): string => {
    return userNameMap.get(userId) || 'Unassigned';
  };

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
        const hasClient = 'Client' in firstRow || 'client' in firstRow || 'CLIENT' in firstRow;

        if (!hasClient) {
          setImportError('Excel file must contain a "Client" column');
          return;
        }

        // Normalize column names and prepare preview
        const normalizedData = jsonData.map((row: any, index: number) => {
          const client = row.Client || row.client || row.CLIENT || '';
          const status = row.Status || row.status || row.STATUS || '';
          const systemStatus = row['System = Status'] || row['system = status'] || row['SYSTEM = STATUS'] || status;
          
          // Find matching project
          const project = findProjectByClientName(client);
          const taskStatus = mapStatusToTaskStatus(systemStatus || status);
          
          return {
            rowIndex: index + 2, // Excel row number (1-indexed, +1 for header)
            client,
            status,
            systemStatus: systemStatus || status,
            taskStatus,
            project: project ? { id: project.id, name: project.clientName } : null,
            matched: !!project,
            error: !project ? 'Project not found' : null
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

    const validRows = excelPreview.filter((row: any) => row.matched && row.project);
    if (validRows.length === 0) {
      setImportError('No valid projects found. Please ensure client names match existing projects.');
      return;
    }

    setUploadingTasks(true);
    setImportError('');

    const taskType = getTaskTypeForDepartment(department || '');
    const results = { success: 0, failed: 0 };
    const errors: string[] = [];

    try {
      // Process tasks in batches to avoid overwhelming the backend
      const BATCH_SIZE = 5;
      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const batch = validRows.slice(i, i + BATCH_SIZE);
        
        await Promise.allSettled(
          batch.map(async (row: any) => {
            if (!row.project || !row.project.id) {
              errors.push(`Row ${row.rowIndex}: Missing project`);
              results.failed++;
              return;
            }

            try {
              // Create task - always start with 'Todo' status, then update if needed
              // The backend might not accept certain statuses on initial creation
              const taskData: any = {
                projectId: row.project.id,
                title: `${department} Task - ${row.client}`,
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
      const allTasksData = await taskService.getAll();
      const taskTypeForFilter = getTaskTypeForDepartment(department || '');
      const projectIdsSet = new Set(projects.map((p: any) => p.id));
      const departmentTasks = allTasksData.filter((t: any) => 
        t.type === taskTypeForFilter && 
        !t.isCompleted &&
        t.status !== 'Completed' &&
        projectIdsSet.has(t.projectId)
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
      const allTasksData = await taskService.getAll();
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

      // Reload tasks - optimized
      const allTasksData = await taskService.getAll();
      const taskTypeForFilter = getTaskTypeForDepartment(department || '');
      const projectIdsSet = new Set(projects.map((p: any) => p.id));
      const departmentTasks = allTasksData.filter((t: any) => 
        t.type === taskTypeForFilter && 
        !t.isCompleted &&
        t.status !== 'Completed' &&
        projectIdsSet.has(t.projectId)
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
            {tasks.filter((t: any) => !t.assignedTo).length}
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
                {users.map((u: any) => (
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

      {/* View Toggle */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e293b', margin: 0, flex: 1 }}>
          Tasks by Project
        </h2>
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
                      boxShadow: isDragOver ? '0 4px 12px rgba(102, 126, 234, 0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
                      border: isDragOver ? '2px solid #667eea' : '2px solid #e2e8f0',
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
                      
                      // Update task status based on column
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
                        
                        // Reload tasks - optimized
                        const allTasksData = await taskService.getAll();
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
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
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
                            navigate(`/project/${task.projectId}`);
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
                                  <span>{getUserName(task.assignedTo || '')}</span>
                                </div>
                                {task.dueDate && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <FaClock style={{ fontSize: '0.75rem' }} />
                                    <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                                  </div>
                                )}
                              </div>
                              <select
                                value={task.assignedTo || ''}
                                onChange={async (e) => {
                                  try {
                                    await taskService.assign(task.id, e.target.value);
                                    setTasks((prev) =>
                                      prev.map((t: any) =>
                                        t.id === task.id ? { ...t, assignedTo: e.target.value } : t
                                      )
                                    );
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
                                  fontSize: '0.75rem'
                                }}
                              >
                                <option value="">Unassigned</option>
                                {users.map((u: any) => (
                                  <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                              </select>
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
          /* List View */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {Object.entries(tasksByProject).map(([projectId, projectTasks]) => (
              <div
                key={projectId}
                style={{
                  background: 'white',
                  borderRadius: '0.5rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden'
                }}
              >
                <div
                  onClick={() => navigate(`/project/${projectId}`)}
                  style={{
                    padding: '1rem 1.5rem',
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>
                    {getProjectName(projectId)}
                  </h3>
                  <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                    {projectTasks.length} task(s)
                  </span>
                </div>
                <div style={{ padding: '1rem 1.5rem' }}>
                  {projectTasks.map((task: any) => (
                    <div
                      key={task.id}
                      style={{
                        padding: '1rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.375rem',
                        marginBottom: '0.75rem',
                        background: selectedTasks.has(task.id) ? '#f0f4ff' : 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
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
                        navigate(`/project/${task.projectId}`);
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
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                        <input
                          type="checkbox"
                          checked={selectedTasks.has(task.id)}
                          onChange={() => handleTaskSelect(task.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTaskSelect(task.id);
                          }}
                          style={{ marginTop: '0.25rem', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.75rem',
                            marginBottom: '0.5rem'
                          }}>
                            <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', margin: 0, flex: 1 }}>
                              {task.title}
                            </h4>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              background: task.status === 'Completed' ? '#d1fae5' : '#fef3c7',
                              color: task.status === 'Completed' ? '#065f46' : '#92400e'
                            }}>
                              {task.status}
                            </span>
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
                                padding: '0.5rem',
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
                              <FaEdit style={{ fontSize: '0.875rem' }} />
                            </button>
                          </div>
                          {task.description && (
                            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 0.5rem 0' }}>
                              {task.description}
                            </p>
                          )}
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '1.5rem',
                            fontSize: '0.875rem',
                            color: '#64748b'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <FaUser />
                              <span>{getUserName(task.assignedTo || '')}</span>
                            </div>
                            {task.dueDate && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FaClock />
                                <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <select
                          value={task.assignedTo || ''}
                          onChange={async (e) => {
                            try {
                              await taskService.assign(task.id, e.target.value);
                              // Update local state
                              setTasks((prev) =>
                                prev.map((t: any) =>
                                  t.id === task.id ? { ...t, assignedTo: e.target.value } : t
                                )
                              );
                            } catch (error) {
                              console.error('Failed to assign task:', error);
                              alert('Failed to assign task. Please try again.');
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            padding: '0.5rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '0.375rem',
                            minWidth: '150px'
                          }}
                        >
                          <option value="">Unassigned</option>
                          {users.map((u: any) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
                  Select Client (Project) *
                </label>
                <select
                  value={newTaskData.projectId}
                  onChange={(e) => {
                    setNewTaskData({ ...newTaskData, projectId: e.target.value, deliverableId: '' });
                    setShowCustomDeliverableInput(false);
                    setCustomDeliverableName('');
                  }}
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
                  <option value="">Select a client...</option>
                  {allProjects.map((project: any) => (
                    <option key={project.id} value={project.id}>
                      {project.clientName || 'Unknown Client'}
                    </option>
                  ))}
                </select>
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
                disabled={uploadingTasks || excelPreview.length === 0 || excelPreview.filter((r: any) => r.matched).length === 0}
                style={{
                  background: uploadingTasks || excelPreview.length === 0 || excelPreview.filter((r: any) => r.matched).length === 0 ? '#cbd5e1' : '#667eea',
                  color: 'white',
                  border: 'none',
                  padding: '0.875rem 1.75rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: uploadingTasks || excelPreview.length === 0 || excelPreview.filter((r: any) => r.matched).length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                  opacity: uploadingTasks || excelPreview.length === 0 || excelPreview.filter((r: any) => r.matched).length === 0 ? 0.5 : 1
                }}
              >
                <FaUpload /> {uploadingTasks ? 'Creating Tasks...' : `Create ${excelPreview.filter((r: any) => r.matched).length} Task(s)`}
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
                      placeholder="e.g., Create Copy for Landing Page"
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
      </div>
    </div>
  );
};

export default DepartmentView;

