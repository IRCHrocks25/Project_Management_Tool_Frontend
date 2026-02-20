import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FaArrowLeft, 
  FaCheckCircle, 
  FaCircle, 
  FaClock, 
  FaEnvelope, 
  FaExclamationTriangle,
  FaChartBar,
  FaCheck,
  FaBox,
  FaEnvelopeOpen,
  FaHistory,
  FaPaperPlane,
  FaChevronRight,
  FaChevronDown,
  FaLink,
  FaFileAlt,
  FaPlus,
  FaTimes,
  FaEdit,
  FaUser,
  FaStickyNote,
  FaArchive,
  FaClipboard,
} from 'react-icons/fa';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import { emailService } from '../services/email.service';
import { deliverableService } from '../services/deliverable.service';
import { authService } from '../services/auth.service';
import './ProjectDetail.css';

// Activity Log Kanban Component
const ActivityLogKanban: React.FC<{ activities: any[] }> = ({ activities }) => {
  // Group activities by department
  // Activities are already sorted oldest first (newest at bottom) from backend
  const groupedByDepartment: Record<string, any[]> = {};
  
  activities.forEach((activity) => {
    const dept = activity.department || 'General';
    if (!groupedByDepartment[dept]) {
      groupedByDepartment[dept] = [];
    }
    groupedByDepartment[dept].push(activity); // Maintains order - oldest first
  });

  const departments = Object.keys(groupedByDepartment).sort();
  
  const getActionIcon = (action: string) => {
    if (action.includes('Created')) return <FaCheckCircle style={{ color: '#10b981' }} />;
    if (action.includes('Approved')) return <FaCheck style={{ color: '#10b981' }} />;
    if (action.includes('Revision')) return <FaExclamationTriangle style={{ color: '#f59e0b' }} />;
    if (action.includes('Submitted')) return <FaPaperPlane style={{ color: '#3b82f6' }} />;
    if (action.includes('Updated')) return <FaEdit style={{ color: '#8b5cf6' }} />;
    if (action.includes('Email')) return <FaEnvelope style={{ color: '#6366f1' }} />;
    return <FaHistory style={{ color: '#6b7280' }} />;
  };

  const formatDateTime = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDepartmentColor = (dept: string) => {
    const colors: Record<string, string> = {
      'Design': '#8b5cf6',
      'Copy Writing': '#3b82f6',
      'Development': '#10b981',
      'Project Management': '#6366f1',
      'Onboarding': '#f59e0b',
      'General': '#6b7280',
    };
    return colors[dept] || '#6b7280';
  };

  if (activities.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        <FaHistory style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }} />
        <h3 style={{ marginBottom: '0.5rem' }}>No activity yet</h3>
        <p>Activity will appear here as the project progresses.</p>
      </div>
    );
  }

  return (
    <div className="activity-log-kanban">
      <div className="activity-log-header">
        <h2>Activity Log</h2>
        <p className="activity-log-subtitle">Track all project activities by department</p>
      </div>
      <div className="activity-log-columns">
        {departments.map((dept) => (
          <div key={dept} className="activity-log-column">
            <div className="activity-log-column-header" style={{ borderLeftColor: getDepartmentColor(dept) }}>
              <h3>{dept}</h3>
              <span className="activity-count">{groupedByDepartment[dept].length}</span>
            </div>
            <div className="activity-log-column-content">
              {groupedByDepartment[dept].map((activity) => (
                <div key={activity.id} className="activity-log-card">
                  <div className="activity-log-card-header">
                    <div className="activity-icon-wrapper">
                      {getActionIcon(activity.action)}
                    </div>
                    <div className="activity-action-text">
                      <span className="activity-action">{activity.action}</span>
                    </div>
                  </div>
                  <div className="activity-log-card-body">
                    {activity.metadata?.taskTitle && (
                      <div className="activity-meta-item">
                        <strong>Task:</strong> {activity.metadata.taskTitle}
                      </div>
                    )}
                    {activity.metadata?.deliverableType && (
                      <div className="activity-meta-item">
                        <strong>Deliverable:</strong> {activity.metadata.deliverableType}
                        {activity.metadata.deliverableCustomType && ` (${activity.metadata.deliverableCustomType})`}
                      </div>
                    )}
                    {activity.metadata?.fileUrl && (
                      <div className="activity-meta-item">
                        <strong>File:</strong>{' '}
                        <a 
                          href={activity.metadata.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="activity-file-link"
                        >
                          {activity.metadata.fileUrl.length > 50 
                            ? activity.metadata.fileUrl.substring(0, 50) + '...' 
                            : activity.metadata.fileUrl}
                        </a>
                      </div>
                    )}
                    {activity.metadata?.previousStatus && activity.metadata?.newStatus && (
                      <div className="activity-meta-item">
                        <strong>Status:</strong> {activity.metadata.previousStatus} → {activity.metadata.newStatus}
                      </div>
                    )}
                    {activity.metadata?.notes && (
                      <div className="activity-meta-item">
                        <strong>Notes:</strong>
                        <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>
                          {(() => {
                            const notes = activity.metadata.notes;
                            // Check if notes contain an attachment link
                            const attachmentMatch = notes.match(/Attachment:\s*(https?:\/\/[^\s]+)/i);
                            if (attachmentMatch) {
                              const attachmentUrl = attachmentMatch[1];
                              const notesText = notes.replace(/Attachment:\s*https?:\/\/[^\s]+/i, '').trim();
                              return (
                                <>
                                  {notesText && <div style={{ marginBottom: '0.5rem' }}>{notesText}</div>}
                                  <div>
                                    <strong>Attachment: </strong>
                                    <a 
                                      href={attachmentUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      style={{ color: '#667eea', textDecoration: 'underline', wordBreak: 'break-all' }}
                                    >
                                      {attachmentUrl}
                                    </a>
                                  </div>
                                </>
                              );
                            }
                            return <div>{notes}</div>;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="activity-log-card-footer">
                    <div className="activity-user">
                      {activity.user ? (
                        <>
                          <FaUser style={{ fontSize: '0.75rem', marginRight: '0.25rem' }} />
                          {activity.user.name || activity.user.email || 'Unknown'}
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>System</span>
                      )}
                    </div>
                    <div className="activity-time">
                      <FaClock style={{ fontSize: '0.75rem', marginRight: '0.25rem' }} />
                      {formatDateTime(activity.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeDeliverableTab, setActiveDeliverableTab] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [progressAnimation, setProgressAnimation] = useState(false);
  const [hideOnboardingPhase, setHideOnboardingPhase] = useState(true);
  const [updatingDeliverable, setUpdatingDeliverable] = useState<string | null>(null);
  const [showRevisionConfirm, setShowRevisionConfirm] = useState(false);
  const [revisionDeliverable, setRevisionDeliverable] = useState<{ id: string; type: string; fileUrl?: string } | null>(null);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [revisionAttachment, setRevisionAttachment] = useState('');
  const [deliverableHistory, setDeliverableHistory] = useState<Record<string, any[]>>({});
  const [draggedFile, setDraggedFile] = useState<{ deliverableId: string; fileUrl: string; department: string } | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [brandingCalls, setBrandingCalls] = useState<Record<string, { zoomLink: string; isDone: boolean; notes: string; attachmentLink: string }>>({
    'call1': { zoomLink: '', isDone: false, notes: '', attachmentLink: '' },
    'call2': { zoomLink: '', isDone: false, notes: '', attachmentLink: '' },
    'preC3': { zoomLink: '', isDone: false, notes: '', attachmentLink: '' },
    'call3': { zoomLink: '', isDone: false, notes: '', attachmentLink: '' },
    'preC4': { zoomLink: '', isDone: false, notes: '', attachmentLink: '' },
    'call4': { zoomLink: '', isDone: false, notes: '', attachmentLink: '' },
    'call5': { zoomLink: '', isDone: false, notes: '', attachmentLink: '' },
    'preC6': { zoomLink: '', isDone: false, notes: '', attachmentLink: '' },
    'call6': { zoomLink: '', isDone: false, notes: '', attachmentLink: '' },
    'call7': { zoomLink: '', isDone: false, notes: '', attachmentLink: '' },
  });
  const [showBrandingNotesModal, setShowBrandingNotesModal] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [brandingNotes, setBrandingNotes] = useState('');
  const [brandingAttachment, setBrandingAttachment] = useState('');
  const [submittingTask, setSubmittingTask] = useState<string | null>(null);
  const [submissionForm, setSubmissionForm] = useState<{ taskId: string; data: string; type: 'url' | 'text' } | null>(null);
  const [showAddDeliverableModal, setShowAddDeliverableModal] = useState(false);
  const [newDeliverableName, setNewDeliverableName] = useState('');
  const [creatingDeliverable, setCreatingDeliverable] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showAddTeamMemberModal, setShowAddTeamMemberModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [addingTeamMember, setAddingTeamMember] = useState(false);
  const [deliverableTeamMembers, setDeliverableTeamMembers] = useState<Record<string, any[]>>({});
  const [showAddDeliverableTeamMemberModal, setShowAddDeliverableTeamMemberModal] = useState(false);
  const [selectedDeliverableForTeam, setSelectedDeliverableForTeam] = useState<string | null>(null);
  const [selectedDeliverableUserId, setSelectedDeliverableUserId] = useState('');
  const [addingDeliverableTeamMember, setAddingDeliverableTeamMember] = useState(false);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [showAddTaskFromDeliverableModal, setShowAddTaskFromDeliverableModal] = useState(false);
  const [selectedDeliverableForTask, setSelectedDeliverableForTask] = useState<string | null>(null);
  const [newTaskData, setNewTaskData] = useState({ department: '', notes: '', assignedToId: '' });
  const [creatingTask, setCreatingTask] = useState(false);

  useEffect(() => {
    if (id) {
      loadProject();
      loadTeamMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    // Load all users for team member dropdown
    const loadUsers = async () => {
      try {
        const users = await authService.getAllUsers();
        setAllUsers(users);
      } catch (error) {
        console.error('Failed to load users:', error);
      }
    };
    loadUsers();
  }, []);

  useEffect(() => {
    if (project) {
      setProgressAnimation(true);
    }
  }, [project]);

  useEffect(() => {
    // Set first deliverable as active when deliverables are loaded
    if (project?.deliverables && project.deliverables.length > 0 && !activeDeliverableTab) {
      setActiveDeliverableTab(project.deliverables[0].id);
    }
  }, [project?.deliverables, activeDeliverableTab]);

  useEffect(() => {
    // Load team members for active deliverable
    if (activeDeliverableTab) {
      loadDeliverableTeamMembers(activeDeliverableTab);
    }
  }, [activeDeliverableTab]);

  useEffect(() => {
    // Load activity log when timeline tab is active
    if (activeTab === 'timeline' && id) {
      loadActivityLog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id]);

  const loadActivityLog = async () => {
    if (!id) return;
    try {
      setLoadingActivity(true);
      const activity = await projectService.getActivity(id);
      console.log('Activity log loaded:', activity);
      setActivityLog(activity || []);
    } catch (error: any) {
      console.error('Failed to load activity log:', error);
      console.error('Error details:', error?.response?.data || error?.message);
      setActivityLog([]);
    } finally {
      setLoadingActivity(false);
    }
  };

  const loadProject = async () => {
    try {
      const [projectData, tasksData, emailsData] = await Promise.all([
        projectService.getOne(id!),
        taskService.getByProject(id!),
        emailService.getByProject(id!),
      ]);
      setProject(projectData);
      // Use tasks from projectData if available (includes relations), otherwise use tasksData from API
      let tasksToUse = projectData?.tasks && projectData.tasks.length > 0 ? projectData.tasks : (tasksData || []);
      
      // Backend should auto-create tasks in findOne, but if they're missing, reload once
      if (projectData?.stage === 'Onboarding') {
        const onboardingTasks = tasksToUse.filter((t: any) => t.type === 'Onboarding' || t.type === 'Intake');
        console.log(`[ProjectDetail] Project stage: ${projectData?.stage}`);
        console.log(`[ProjectDetail] Found ${onboardingTasks.length} onboarding tasks out of ${tasksToUse.length} total tasks`);
        
        // If no onboarding tasks found, reload once (backend should auto-create them synchronously in findOne)
        if (onboardingTasks.length === 0) {
          console.log('[ProjectDetail] No onboarding tasks found, reloading once (backend should auto-create)...');
          try {
            const newProjectData = await projectService.getOne(id!);
            const newTasksData = await taskService.getByProject(id!);
            const reloadedTasks = newProjectData?.tasks && newProjectData.tasks.length > 0 ? newProjectData.tasks : (newTasksData || []);
            
            setProject(newProjectData);
            tasksToUse = reloadedTasks;
            console.log('[ProjectDetail] Reloaded - found', reloadedTasks.length, 'tasks');
          } catch (error: any) {
            console.error('[ProjectDetail] Failed to reload:', error);
          }
        }
      }
      
      setTasks(tasksToUse);
      setEmails(emailsData || []);
      
      console.log('[ProjectDetail] Loaded tasks from API:', tasksData);
      console.log('[ProjectDetail] Tasks from project data:', projectData?.tasks);
      console.log('[ProjectDetail] Using tasks:', tasksToUse);
      
      // Load team members if available in project data
      if (projectData?.teamMembers) {
        setTeamMembers(projectData.teamMembers.map((tm: any) => ({
          id: tm.id,
          userId: tm.userId,
          user: tm.user,
          assignedAt: tm.assignedAt,
        })));
      }
      
      // Log tasks with deliverableId
      const tasksWithDeliverable = tasksToUse.filter((t: any) => t.deliverableId);
      console.log('[ProjectDetail] Tasks with deliverableId:', tasksWithDeliverable.map((t: any) => ({
        id: t.id,
        title: t.title,
        type: t.type,
        deliverableId: t.deliverableId,
        assignedToId: t.assignedToId
      })));
      
      // Load history for all deliverables and their files
      if (projectData?.deliverables) {
        const historyMap: Record<string, any[]> = {};
        
        // Get all unique file URLs from tasks
        const allFileUrls = new Set<string>();
        tasksData.forEach((task: any) => {
          if (task.fileUrl) {
            allFileUrls.add(task.fileUrl);
          }
        });
        
        // Convert Set to Array for iteration
        const fileUrlsArray = Array.from(allFileUrls);
        
        // Load history for each deliverable and each file
        for (const deliverable of projectData.deliverables) {
          // Load general deliverable history
          const deliverableHist = await deliverableService.getHistory(deliverable.id).catch(() => []);
          historyMap[deliverable.id] = deliverableHist || [];
          
          // Load history for each file URL associated with this deliverable
          for (const fileUrl of fileUrlsArray) {
            const fileHist = await deliverableService.getHistory(deliverable.id, fileUrl).catch(() => []);
            const key = `${deliverable.id}:${fileUrl}`;
            historyMap[key] = fileHist || [];
          }
        }
        
        setDeliverableHistory(historyMap);
      }
    } catch (error: any) {
      console.error('Failed to load project:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to load project';
      setError(errorMessage);
      console.error('Error details:', {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        url: error?.config?.url,
      });
    } finally {
      setLoading(false);
    }
  };

  const getIntakeProgress = () => {
    if (!project?.tasks) return 0;
    const intakeTasks = project.tasks.filter((t: any) => t.type === 'Onboarding');
    const completed = intakeTasks.filter((t: any) => t.isCompleted).length;
    return intakeTasks.length > 0 ? Math.round((completed / intakeTasks.length) * 100) : 0;
  };

  const getDaysInStage = () => {
    if (!project?.updatedAt) return 0;
    const updatedAt = new Date(project.updatedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - updatedAt.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getDaysSinceEmail = () => {
    if (!project?.lastEmailedAt) return null;
    const lastEmail = new Date(project.lastEmailedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastEmail.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getProjectHealth = () => {
    const daysInStage = getDaysInStage();
    const daysSinceEmail = getDaysSinceEmail();
    const copyRevisions = project?.copyRevisionCount || 0;
    const designRevisions = project?.designRevisionCount || 0;
    const totalRevisions = copyRevisions + designRevisions;

    let score = 100;
    
    // Deduct for days in stage
    if (daysInStage > 7) score -= 30;
    else if (daysInStage > 5) score -= 15;
    else if (daysInStage > 3) score -= 5;

    // Deduct for revisions
    if (totalRevisions > 4) score -= 25;
    else if (totalRevisions > 2) score -= 10;

    // Deduct for no recent email
    if (daysSinceEmail === null || daysSinceEmail > 5) score -= 15;

    if (score >= 80) return { status: 'On Track', color: '#10b981', icon: '🟢' };
    if (score >= 60) return { status: 'Needs Attention', color: '#f59e0b', icon: '🟡' };
    return { status: 'At Risk', color: '#dc2626', icon: '🔴' };
  };

  const getNextAction = () => {
    if (!project) return null;
    
    const daysSinceEmail = getDaysSinceEmail();
    const intakeProgress = getIntakeProgress();
    
    if (project.stage === 'Onboarding' && intakeProgress === 0) {
      return 'Waiting on client requirements';
    }
    if (project.stage === 'Onboarding' && intakeProgress < 100) {
      return 'Complete onboarding tasks';
    }
    if (project.stage === 'Copy' && daysSinceEmail === null) {
      return 'Send copy for approval';
    }
    if (['Copy Revision', 'Design Revision'].includes(project.stage) && daysSinceEmail && daysSinceEmail > 3) {
      return 'Follow up with client';
    }
    if (project.stage === 'Design') {
      return 'Upload design deliverables';
    }
    if (project.stage === 'Dev') {
      return 'Complete development tasks';
    }
    
    return null;
  };

  // Helper function to get deliverable display name
  const getDeliverableDisplayName = (deliverable: any) => {
    return deliverable.customType || deliverable.type;
  };

  const handleCreateCustomDeliverable = async () => {
    if (!newDeliverableName.trim() || !project) return;

    try {
      setCreatingDeliverable(true);
      const newDeliverable = await deliverableService.create(
        project.id,
        'Other',
        newDeliverableName.trim()
      );
      
      // Reload project to get updated deliverables
      const updatedProject = await projectService.getOne(id!);
      setProject(updatedProject);
      
      // Set the new deliverable as active
      setActiveDeliverableTab(newDeliverable.id);
      
      // Reset form
      setNewDeliverableName('');
      setShowAddDeliverableModal(false);
    } catch (error: any) {
      console.error('Failed to create custom deliverable:', error);
      alert(error.response?.data?.message || 'Failed to create custom deliverable');
    } finally {
      setCreatingDeliverable(false);
    }
  };

  const getIntakeStatus = () => {
    const progress = getIntakeProgress();
    const daysInStage = getDaysInStage();
    
    if (progress === 0 && daysInStage >= 3) {
      return { message: 'Waiting on Client', type: 'warning' };
    }
    
    const intakeTasks = project?.tasks?.filter((t: any) => t.type === 'Onboarding') || [];
    const nextTask = intakeTasks.find((t: any) => !t.isCompleted);
    
    if (nextTask) {
      return { message: `Next Action: ${nextTask.title}`, type: 'info' };
    }
    
    return null;
  };

  const handleTaskComplete = async (taskId: string, isCompleted: boolean) => {
    try {
      await taskService.updateStatus(taskId, isCompleted ? 'Completed' : 'Todo', isCompleted);
      loadProject();
      showToast(isCompleted ? 'Task completed ✓' : 'Task reopened');
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleSubmitOnboarding = async (taskId: string, submissionData: string, submissionType: 'url' | 'text') => {
    try {
      setSubmittingTask(taskId);
      await taskService.submitOnboardingData(taskId, submissionData, submissionType);
      await loadProject();
      setSubmissionForm(null);
      showToast('Onboarding data submitted ✓');
    } catch (error: any) {
      console.error('Failed to submit onboarding data:', error);
      showToast(error?.response?.data?.message || 'Failed to submit data');
    } finally {
      setSubmittingTask(null);
    }
  };

  const loadTeamMembers = async () => {
    if (!id) return;
    try {
      const members = await projectService.getTeamMembers(id);
      setTeamMembers(members);
    } catch (error) {
      console.error('Failed to load team members:', error);
    }
  };

  const handleAddTeamMember = async () => {
    if (!selectedUserId || !id) return;
    setAddingTeamMember(true);
    try {
      await projectService.addTeamMember(id, selectedUserId);
      await loadTeamMembers();
      setShowAddTeamMemberModal(false);
      setSelectedUserId('');
    } catch (error: any) {
      console.error('Failed to add team member:', error);
      alert(error.response?.data?.message || 'Failed to add team member');
    } finally {
      setAddingTeamMember(false);
    }
  };

  // Commented out - Team Members section is disabled
  // const handleRemoveTeamMember = async (userId: string) => {
  //   if (!id) return;
  //   if (!window.confirm('Are you sure you want to remove this team member?')) return;
  //   try {
  //     await projectService.removeTeamMember(id, userId);
  //     await loadTeamMembers();
  //   } catch (error: any) {
  //     console.error('Failed to remove team member:', error);
  //     alert(error.response?.data?.message || 'Failed to remove team member');
  //   }
  // };

  const loadDeliverableTeamMembers = async (deliverableId: string) => {
    try {
      const members = await deliverableService.getTeamMembers(deliverableId);
      setDeliverableTeamMembers(prev => ({ ...prev, [deliverableId]: members }));
    } catch (error) {
      console.error('Failed to load deliverable team members:', error);
    }
  };

  const handleAddDeliverableTeamMember = async () => {
    if (!selectedDeliverableForTeam || !selectedDeliverableUserId) return;
    setAddingDeliverableTeamMember(true);
    try {
      await deliverableService.addTeamMember(selectedDeliverableForTeam, selectedDeliverableUserId);
      await loadDeliverableTeamMembers(selectedDeliverableForTeam);
      setShowAddDeliverableTeamMemberModal(false);
      setSelectedDeliverableForTeam(null);
      setSelectedDeliverableUserId('');
    } catch (error: any) {
      console.error('Failed to add deliverable team member:', error);
      alert(error.response?.data?.message || 'Failed to add team member');
    } finally {
      setAddingDeliverableTeamMember(false);
    }
  };

  const handleRemoveDeliverableTeamMember = async (deliverableId: string, userId: string) => {
    if (!window.confirm('Are you sure you want to remove this team member?')) return;
    try {
      await deliverableService.removeTeamMember(deliverableId, userId);
      await loadDeliverableTeamMembers(deliverableId);
    } catch (error: any) {
      console.error('Failed to remove deliverable team member:', error);
      alert(error.response?.data?.message || 'Failed to remove team member');
    }
  };

  const handleCloseProject = async () => {
    if (!window.confirm('Are you sure you want to close this project?')) return;
    
    try {
      await projectService.close(id!);
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to close project:', error);
    }
  };

  const handleArchiveProject = async () => {
    if (!window.confirm('Are you sure you want to archive this project? It will be hidden from default views but can still be accessed via direct link.')) return;
    
    try {
      await projectService.archive(id!);
      alert('Project archived successfully');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Failed to archive project:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to archive project';
      console.error('Error details:', {
        status: error.response?.status,
        message: errorMessage,
        userRole: authService.getUser()?.role,
      });
      alert(errorMessage);
    }
  };

  const handleRequestRevisionClick = (deliverableId: string, deliverableType: string, fileUrl?: string) => {
    setRevisionDeliverable({ id: deliverableId, type: deliverableType, fileUrl });
    setRevisionNotes('');
    setRevisionAttachment('');
    setShowRevisionConfirm(true);
  };

  const handleConfirmRevision = async () => {
    if (!revisionDeliverable) return;

    try {
      setUpdatingDeliverable(revisionDeliverable.id);
      console.log('Requesting revision for deliverable:', revisionDeliverable.id);
      
      // Combine notes and attachment into a formatted note
      let combinedNotes = revisionNotes.trim();
      if (revisionAttachment.trim()) {
        if (combinedNotes) {
          combinedNotes += `\n\nAttachment: ${revisionAttachment.trim()}`;
        } else {
          combinedNotes = `Attachment: ${revisionAttachment.trim()}`;
        }
      }
      
      console.log('[Revision] Sending revision request with:', {
        deliverableId: revisionDeliverable.id,
        fileUrl: revisionDeliverable.fileUrl,
        notes: combinedNotes || 'No notes',
        notesLength: combinedNotes?.length || 0
      });
      
      const result = await deliverableService.updateStatus(
        revisionDeliverable.id, 
        'Revision', 
        combinedNotes || undefined,
        revisionDeliverable.fileUrl
      );
      console.log('[Revision] Revision request successful:', result);
      
      // Reload project to get updated history
      await loadProject();
      
      // Also explicitly reload history for this specific file to ensure notes are visible
      if (revisionDeliverable.fileUrl) {
        try {
          const fileHist = await deliverableService.getHistory(revisionDeliverable.id, revisionDeliverable.fileUrl);
          const historyKey = `${revisionDeliverable.id}:${revisionDeliverable.fileUrl}`;
          console.log('[Revision] Loaded file history after revision:', {
            historyKey,
            historyLength: fileHist.length,
            latestEntry: fileHist[0],
            hasNotes: !!fileHist[0]?.notes,
            notes: fileHist[0]?.notes
          });
          setDeliverableHistory(prev => ({
            ...prev,
            [historyKey]: fileHist
          }));
        } catch (error) {
          console.error('[Revision] Failed to reload file history:', error);
        }
      }
      showToast('Revision requested ✓');
      setShowRevisionConfirm(false);
      setRevisionDeliverable(null);
      setRevisionNotes('');
      setRevisionAttachment('');
    } catch (error: any) {
      console.error('Failed to request revision:', error);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      console.error('Error response:', error?.response);
      console.error('Request URL:', error?.config?.url);
      const errorMessage = error?.response?.data?.message || error?.message || error?.response?.statusText || 'Unknown error';
      console.error('Error details:', errorMessage);
      showToast(`Failed to request revision: ${errorMessage}`);
    } finally {
      setUpdatingDeliverable(null);
    }
  };

  // Create task from deliverable
  const handleCreateTaskFromDeliverable = async () => {
    if (!selectedDeliverableForTask || !newTaskData.department || !id || !project) return;

    try {
      setCreatingTask(true);
      
      // Find the deliverable from project
      const deliverable = project.deliverables?.find((d: any) => d.id === selectedDeliverableForTask);
      const deliverableType = deliverable?.customType || deliverable?.type || 'Task';
      
      // Map department to task type
      const departmentToTaskType: Record<string, string> = {
        'Design': 'Design',
        'Copy Writing': 'Copy',
        'Development': 'Dev',
        'AI Team': 'AI',
        'Social Media Team': 'Social Media',
        'CRM': 'CRM',
        'SEO/GEO Team': 'SEO/GEO',
        'Onboarding': 'Onboarding',
      };

      const taskType = departmentToTaskType[newTaskData.department] || 'General';
      
      const taskData: any = {
        projectId: id,
        title: `${deliverableType} - ${newTaskData.department}`,
        description: newTaskData.notes || '',
        type: taskType,
        status: 'Todo',
        isCompleted: false,
        deliverableId: selectedDeliverableForTask,
      };

      if (newTaskData.assignedToId) {
        taskData.assignedToId = newTaskData.assignedToId;
      }

      await taskService.create(taskData);
      showToast('Task created successfully ✓');
      await loadProject();
      setShowAddTaskFromDeliverableModal(false);
      setSelectedDeliverableForTask(null);
      setNewTaskData({ department: '', notes: '', assignedToId: '' });
    } catch (error: any) {
      console.error('Failed to create task:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      showToast(`Failed to create task: ${errorMessage}`);
    } finally {
      setCreatingTask(false);
    }
  };

  // Approve individual file
  const handleApproveFile = async (deliverableId: string, deliverableType: string, fileUrl: string, department: string) => {
    try {
      setUpdatingDeliverable(deliverableId);
      console.log('Approving file:', fileUrl, 'for deliverable:', deliverableId);
      const result = await deliverableService.updateStatus(deliverableId, 'Approved', undefined, fileUrl);
      console.log('File approved successfully:', result);
      await loadProject();
      
      // Check if this was a Landing Page design approval - if so, show special message
      const isDesignFile = fileUrl.includes('figma.com') || fileUrl.includes('figma');
      if (deliverableType === 'Landing Page' && isDesignFile) {
        showToast('Landing Page design approved ✓ - Project moved to Development');
      } else {
        showToast(`${department} file approved ✓`);
      }
    } catch (error: any) {
      console.error('Failed to approve file:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      showToast(`Failed to approve file: ${errorMessage}`);
    } finally {
      setUpdatingDeliverable(null);
    }
  };

  // Approve overall deliverable (only if all files are approved)
  const handleApproveDeliverable = async (deliverableId: string, deliverableType: string) => {
    try {
      setUpdatingDeliverable(deliverableId);
      console.log('Approving overall deliverable:', deliverableId);
      const result = await deliverableService.updateStatus(deliverableId, 'Approved');
      console.log('Deliverable approved successfully:', result);
      await loadProject();
      showToast(`${deliverableType} approved ✓`);
    } catch (error: any) {
      console.error('Failed to approve deliverable:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      showToast(`Failed to approve: ${errorMessage}`);
    } finally {
      setUpdatingDeliverable(null);
    }
  };


  const showToast = (message: string) => {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 2000);
  };

  const getClientTypeColor = (clientType: string) => {
    switch (clientType) {
      case 'ICON': return { bg: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', color: 'white' };
      case 'STAR': return { bg: '#a855f7', color: 'white' };
      case 'Katalyst': return { bg: '#667eea', color: 'white' };
      default: return { bg: '#64748b', color: 'white' };
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return '#dc2626';
      case 'High': return '#ea580c';
      case 'Medium': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="project-detail">
        <div className="loading-skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-content"></div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="project-detail-container" style={{ padding: '3rem', textAlign: 'center' }}>
        <div className="loading-spinner">Loading project...</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="project-detail-container" style={{ padding: '3rem', textAlign: 'center' }}>
        <div className="error" style={{ color: '#dc2626', fontSize: '1.2rem', marginBottom: '1rem' }}>
          {error || 'Project not found'}
        </div>
        <p style={{ color: '#64748b', marginBottom: '1rem' }}>
          Project ID: {id}
        </p>
        <button
          className="btn-primary"
          onClick={() => navigate('/dashboard')}
          style={{ marginTop: '1rem' }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const intakeProgress = getIntakeProgress();
  const daysInStage = getDaysInStage();
  const daysSinceEmail = getDaysSinceEmail();
  const health = getProjectHealth();
  const nextAction = getNextAction();
  const intakeStatus = getIntakeStatus();
  const clientTypeStyle = getClientTypeColor(project.clientType);
  const priorityColor = getPriorityColor(project.priority);

  return (
    <div className="project-detail premium-project-detail">
      {/* Premium Header Bar */}
      <div className="project-summary-bar">
        <div className="summary-bar-content">
          <button onClick={() => navigate('/dashboard')} className="back-button-premium">
            <FaArrowLeft /> Back to Dashboard
          </button>
          
          <div className="summary-main">
            <div className="summary-left">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <h1 className="project-title-premium" style={{ margin: 0 }}>{project.clientName}</h1>
                <div className="project-meta-badges">
                  <span 
                    className="client-badge-premium"
                    style={{ background: clientTypeStyle.bg, color: clientTypeStyle.color }}
                  >
                    {project.clientType}
                  </span>
                  <span className="meta-separator">•</span>
                  <span className="priority-badge-premium">
                    <span 
                      className="priority-dot-small"
                      style={{ backgroundColor: priorityColor }}
                    ></span>
                    {project.priority}
                  </span>
                  <span className="meta-separator">•</span>
                  <span className="stage-badge-premium">{project.stage}</span>
                </div>
              </div>
            </div>
            
            <div className="summary-right">
              <div className="summary-stats">
                <div className="summary-stat">
                  <span className="stat-label">Days in stage</span>
                  <span className="stat-value">{daysInStage} {daysInStage === 1 ? 'day' : 'days'}</span>
                </div>
                {daysSinceEmail !== null && (
                  <div className="summary-stat">
                    <span className="stat-label">Last emailed</span>
                    <span className="stat-value">{daysSinceEmail}d ago</span>
                  </div>
                )}
                <div className="summary-stat health-stat">
                  <span className="stat-label">Project Health</span>
                  <span 
                    className="health-indicator"
                    style={{ color: health.color }}
                  >
                    {health.icon} {health.status}
                  </span>
                </div>
              </div>
              <button className="btn-primary-action">
                <FaPaperPlane /> Send Update
              </button>
              {(authService.getUser()?.role === 'Project Manager' || authService.getUser()?.role === 'FOUNDER/CEO') && !project?.isArchived && (
                <button 
                  onClick={handleArchiveProject} 
                  className="btn-primary-action"
                  style={{ marginLeft: '0.5rem', backgroundColor: '#6b7280' }}
                >
                  <FaArchive /> Archive Project
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Next Action Banner */}
      {nextAction && (
        <div className="next-action-banner">
          <FaExclamationTriangle className="action-icon" />
          <span>Next Action: {nextAction}</span>
        </div>
      )}

      {/* Premium Onboarding Progress */}
      {project.stage === 'Onboarding' && !hideOnboardingPhase && (
        <div className="milestone-card">
          <div className="milestone-header">
            <h3>Onboarding Phase</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span className="progress-percentage">{intakeProgress}% Complete</span>
              <button
                onClick={() => setHideOnboardingPhase(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                  e.currentTarget.style.color = '#374151';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none';
                  e.currentTarget.style.color = '#6b7280';
                }}
                title="Hide Onboarding Phase"
              >
                <FaTimes /> Hide
              </button>
            </div>
          </div>
          <div className="progress-bar-container">
            <div 
              className={`progress-bar-fill ${progressAnimation ? 'animated' : ''}`}
              style={{ width: `${intakeProgress}%` }}
            ></div>
          </div>
          <div className="milestone-tasks">
            {project.tasks?.filter((t: any) => t.type === 'Onboarding').map((task: any, index: number) => (
              <div key={task.id} className="milestone-task-item">
                <button
                  className={`milestone-checkbox ${task.isCompleted ? 'completed' : ''}`}
                  onClick={() => handleTaskComplete(task.id, !task.isCompleted)}
                >
                  {task.isCompleted ? <FaCheckCircle /> : <FaCircle />}
                </button>
                <span className={task.isCompleted ? 'task-completed' : ''}>{task.title}</span>
              </div>
            ))}
          </div>
          {intakeStatus && (
            <div className={`milestone-status ${intakeStatus.type}`}>
              {intakeStatus.message}
            </div>
          )}
        </div>
      )}
      
      {/* Show button when hidden */}
      {project.stage === 'Onboarding' && hideOnboardingPhase && (
        <div style={{ 
          maxWidth: '1600px', 
          margin: '2rem auto', 
          padding: '0 2rem' 
        }}>
          <button
            onClick={() => setHideOnboardingPhase(false)}
            style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              color: '#6b7280',
              cursor: 'pointer',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f9fafb';
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            <FaChevronDown style={{ transform: 'rotate(-90deg)' }} /> Show Onboarding Phase
          </button>
        </div>
      )}

      {/* Activity Summary */}
      {emails.length > 0 && (
        <div className="activity-summary">
          <h3>Recent Activity</h3>
          <div className="activity-list">
            {emails.slice(0, 3).map((email) => (
              <div key={email.id} className="activity-item">
                <FaEnvelope className="activity-icon" />
                <div className="activity-content">
                  <span className="activity-text">{email.subject}</span>
                  <span className="activity-time">
                    {new Date(email.sentAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Premium Tabs */}
      <div className="project-tabs premium-tabs">
        <button
          className={`tab-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <FaChartBar className="tab-icon" />
          Overview
        </button>
        <button
          className={`tab-item ${activeTab === 'deliverables' ? 'active' : ''}`}
          onClick={() => setActiveTab('deliverables')}
        >
          <FaBox className="tab-icon" />
          Deliverables
        </button>
        <button
          className={`tab-item ${activeTab === 'revisions' ? 'active' : ''}`}
          onClick={() => setActiveTab('revisions')}
        >
          <FaExclamationTriangle className="tab-icon" />
          Revisions
        </button>
        <button
          className={`tab-item ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <FaCheck className="tab-icon" />
          Client Tasks
        </button>
        
        <button
          className={`tab-item ${activeTab === 'onboarding' ? 'active' : ''}`}
          onClick={() => setActiveTab('onboarding')}
        >
          <FaFileAlt className="tab-icon" />
          Onboarding
        </button>
        <button
          className={`tab-item ${activeTab === 'emails' ? 'active' : ''}`}
          onClick={() => setActiveTab('emails')}
        >
          <FaEnvelopeOpen className="tab-icon" />
          Emails
        </button>
        <button
          className={`tab-item ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          <FaHistory className="tab-icon" />
          Timeline
        </button>
        <button
          className={`tab-item ${activeTab === 'branding' ? 'active' : ''}`}
          onClick={() => setActiveTab('branding')}
        >
          <FaClipboard className="tab-icon" />
          Branding Management
        </button>
        
      </div>

      {/* Tab Content with Fade Animation */}
      <div className={`project-content tab-content-wrapper ${activeTab}`}>
        {activeTab === 'overview' && (
          <div className="tab-content fade-in">
            <div className="overview-grid premium-grid">
              <div className="overview-card premium-card">
                <h3 className="card-title">Project Details</h3>
                <div className="detail-list">
                  <div className="detail-item-premium">
                    <span className="detail-label">PM</span>
                    <span className="detail-value">{project.pm?.name || 'Unassigned'}</span>
                  </div>
                  <div className="detail-item-premium">
                    <span className="detail-label">Package</span>
                    <span className="detail-value">{project.package}</span>
                  </div>
                  <div className="detail-item-premium">
                    <span className="detail-label">Target Close</span>
                    <span className="detail-value">
                      {new Date(project.targetCloseMonth + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="detail-item-premium">
                    <span className="detail-label">Days in Stage</span>
                    <span className="detail-value">{daysInStage} {daysInStage === 1 ? 'day' : 'days'}</span>
                  </div>
                  {project.notes && (
                    <div className="detail-item-premium notes-item">
                      <span className="detail-label">Notes</span>
                      <span className="detail-value notes-value">{project.notes}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="overview-card premium-card">
                <h3 className="card-title">Recent Activity</h3>
                {(() => {
                  // Collect all deliverable activities from history
                  const allActivities: any[] = [];
                  
                  // Debug: Log deliverableHistory structure
                  console.log('[Recent Activity] deliverableHistory keys:', Object.keys(deliverableHistory));
                  console.log('[Recent Activity] deliverableHistory:', deliverableHistory);
                  
                  Object.keys(deliverableHistory).forEach((key) => {
                    const history = deliverableHistory[key];
                    if (!history || !Array.isArray(history) || history.length === 0) return;
                    
                    // Extract deliverable info from the key
                    // Key format can be: "deliverableId" or "deliverableId:fileUrl"
                    const parts = key.split(':');
                    const deliverableId = parts[0];
                    const fileUrl = parts[1]; // May be undefined for general deliverable history
                    
                    // Try to find deliverable
                    let deliverable = project?.deliverables?.find((d: any) => d.id === deliverableId);
                    
                    // If not found, check if key itself is a deliverable ID (general history)
                    if (!deliverable) {
                      deliverable = project?.deliverables?.find((d: any) => d.id === key);
                    }
                    
                    if (!deliverable) {
                      console.log('[Recent Activity] Deliverable not found for key:', key);
                      return;
                    }
                    
                    // Get deliverable type
                    const deliverableType = deliverable.customType || deliverable.type || 'Deliverable';
                    
                    // Process each history entry
                    history.forEach((entry: any, index: number) => {
                      const action = entry.action || entry.status || '';
                      const actionLower = action.toLowerCase();
                      
                      // Debug: Log each entry
                      console.log(`[Recent Activity] Entry ${index} for ${key}:`, {
                        action,
                        status: entry.status,
                        createdAt: entry.createdAt,
                        user: entry.user
                      });
                      
                      // Check for important actions (more flexible matching)
                      const isImportantAction = 
                        actionLower.includes('approved') || 
                        actionLower.includes('revision') || 
                        actionLower.includes('submitted') || 
                        actionLower.includes('review') ||
                        actionLower.includes('ready') ||
                        actionLower.includes('status changed') ||
                        actionLower.includes('created');
                      
                      if (isImportantAction) {
                        allActivities.push({
                          ...entry,
                          deliverableId: deliverableId || key,
                          deliverableType,
                          fileUrl: entry.fileUrl || fileUrl,
                          key: `${key}-${index}-${entry.id || entry.createdAt || Date.now()}`
                        });
                      }
                    });
                  });
                  
                  // Also add task activities (when tasks are updated/submitted)
                  if (tasks && tasks.length > 0) {
                    tasks.forEach((task: any) => {
                      // Only include tasks that have been updated recently or have fileUrl (submitted)
                      if (task.fileUrl || task.status === 'In Review') {
                        const deliverable = task.deliverableId 
                          ? project?.deliverables?.find((d: any) => d.id === task.deliverableId)
                          : null;
                        
                        if (deliverable || task.type === 'Copy' || task.type === 'Design') {
                          const deliverableType = deliverable 
                            ? (deliverable.customType || deliverable.type || 'Task')
                            : `${task.type} Task`;
                          
                          // Create activity entry for task submission
                          if (task.fileUrl && task.status === 'In Review') {
                            allActivities.push({
                              action: 'Submitted for Review',
                              status: 'In Review',
                              createdAt: task.updatedAt || task.createdAt,
                              user: task.assignedTo || { name: 'System' },
                              deliverableId: task.deliverableId,
                              deliverableType,
                              fileUrl: task.fileUrl,
                              key: `task-${task.id}-submitted`
                            });
                          }
                        }
                      }
                    });
                  }
                  
                  // Sort by date (newest first)
                  allActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                  
                  // Get only the 10 most recent
                  const recentActivities = allActivities.slice(0, 10);
                  
                  if (recentActivities.length === 0) {
                    return (
                      <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                        No recent activity
                      </div>
                    );
                  }
                  
                  const formatTime = (date: string | Date) => {
                    const d = new Date(date);
                    const now = new Date();
                    const diffMs = now.getTime() - d.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    const diffDays = Math.floor(diffMs / 86400000);
                    
                    if (diffMins < 1) return 'Just now';
                    if (diffMins < 60) return `${diffMins}m ago`;
                    if (diffHours < 24) return `${diffHours}h ago`;
                    if (diffDays < 7) return `${diffDays}d ago`;
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  };
                  
                  const getActionIcon = (action: string) => {
                    if (action?.includes('Approved')) return <FaCheckCircle style={{ color: '#10b981' }} />;
                    if (action?.includes('Revision')) return <FaExclamationTriangle style={{ color: '#f59e0b' }} />;
                    if (action?.includes('Submitted') || action?.includes('Review')) return <FaPaperPlane style={{ color: '#3b82f6' }} />;
                    return <FaCircle style={{ color: '#6b7280' }} />;
                  };
                  
                  return (
                    <div className="activity-notifications-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '500px', overflowY: 'auto' }}>
                      {recentActivities.map((activity) => {
                        const userName = activity.user?.name || 'System';
                        const actionText = activity.action || 'Status Changed';
                        const fileName = activity.fileUrl ? activity.fileUrl.split('/').pop()?.substring(0, 30) + '...' : '';
                        
                        const handleActivityClick = () => {
                          // Switch to deliverables tab
                          setActiveTab('deliverables');
                          // Set the active deliverable tab to the one related to this activity
                          if (activity.deliverableId) {
                            setActiveDeliverableTab(activity.deliverableId);
                          }
                        };

                        return (
                          <div 
                            key={activity.key}
                            className="activity-notification-item"
                            onClick={handleActivityClick}
                            style={{
                              padding: '0.875rem',
                              background: '#f9fafb',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.75rem',
                              transition: 'all 0.2s ease',
                              cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f3f4f6';
                              e.currentTarget.style.borderColor = '#d1d5db';
                              e.currentTarget.style.transform = 'translateX(2px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#f9fafb';
                              e.currentTarget.style.borderColor = '#e5e7eb';
                              e.currentTarget.style.transform = 'translateX(0)';
                            }}
                          >
                            <div style={{ 
                              flexShrink: 0, 
                              marginTop: '0.125rem',
                              fontSize: '0.875rem'
                            }}>
                              {getActionIcon(actionText)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem' }}>
                                  {userName}
                                </span>
                                <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}>
                                  {actionText}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 500, color: '#374151', fontSize: '0.8125rem' }}>
                                  {activity.deliverableType}
                                </span>
                                {fileName && (
                                  <>
                                    <span style={{ color: '#9ca3af' }}>•</span>
                                    <span style={{ color: '#6b7280', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                      {fileName}
                                    </span>
                                  </>
                                )}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                {formatTime(activity.createdAt)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div className="overview-card premium-card">
                <h3 className="card-title">Revisions</h3>
                {(() => {
                  // Collect all ACTIVE revision requests from deliverable history
                  // A revision is active if it's the latest entry for that file and hasn't been approved/resubmitted
                  const allRevisions: any[] = [];
                  
                  Object.keys(deliverableHistory).forEach((key) => {
                    const history = deliverableHistory[key];
                    if (history.length === 0) return;
                    
                    // Get the latest history entry
                    const latestEntry = history[0];
                    
                    // Only show if latest entry is a revision request (meaning it's still active)
                    if (latestEntry.action === 'Revision Requested') {
                      // Extract deliverable info from the key (format: "deliverableId:fileUrl")
                      const [deliverableId] = key.split(':');
                      const deliverable = project?.deliverables?.find((d: any) => d.id === deliverableId);
                      
                      // Determine department based on deliverable type
                      let department = 'General';
                      const deliverableType = deliverable?.type || deliverable?.customType || '';
                      
                      if (['Logo', 'Social Banners', 'Speaker Kit', 'Landing Page'].includes(deliverableType)) {
                        department = 'Design';
                      } else if (['Brand Book', 'Copy of Landing Page', 'Other'].includes(deliverableType)) {
                        department = 'Copy Writing';
                      }
                      
                      // Check if there's a related task to see if it's been resubmitted
                      const fileUrl = latestEntry.fileUrl;
                      const relatedTask = tasks.find((t: any) => t.fileUrl === fileUrl);
                      const isResubmitted = relatedTask && relatedTask.status === 'In Review';
                      
                      // Only add if not resubmitted (still needs revision)
                      if (!isResubmitted) {
                        allRevisions.push({
                          ...latestEntry,
                          deliverableType,
                          deliverableId,
                          department,
                          fileUrl: latestEntry.fileUrl,
                        });
                      }
                    }
                  });
                  
                  // Sort by date (newest first)
                  allRevisions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                  
                  if (allRevisions.length === 0) {
                    return (
                      <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                        No active revisions
                      </div>
                    );
                  }
                  
                  return (
                    <div className="revision-list-premium" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {allRevisions.map((revision, idx) => {
                        const notes = revision.notes || '';
                        const attachmentMatch = notes.match(/Attachment:\s*(https?:\/\/[^\s]+)/i);
                        const hasAttachment = !!attachmentMatch;
                        const notesText = attachmentMatch 
                          ? notes.replace(/Attachment:\s*https?:\/\/[^\s]+/i, '').trim()
                          : notes.trim();
                        const attachmentUrl = attachmentMatch ? attachmentMatch[1] : null;
                        const departmentColor = revision.department === 'Design' ? '#8b5cf6' : '#3b82f6';
                        
                        return (
                          <div 
                            key={idx}
                            className="revision-item-premium"
                            style={{
                              padding: '1rem',
                              background: '#fef3c7',
                              border: '1px solid #fde68a',
                              borderRadius: '8px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                  <span 
                                    style={{
                                      padding: '0.25rem 0.5rem',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      background: `${departmentColor}20`,
                                      color: departmentColor
                                    }}
                                  >
                                    {revision.department}
                                  </span>
                                  <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.875rem' }}>
                                    {revision.deliverableType}
                                  </span>
                                </div>
                                {notesText && (
                                  <div style={{ fontSize: '0.875rem', color: '#92400e', marginTop: '0.5rem', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                                    {notesText}
                                  </div>
                                )}
                                {hasAttachment && attachmentUrl && (
                                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <FaLink style={{ color: '#667eea', fontSize: '0.75rem' }} />
                                    <a 
                                      href={attachmentUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      style={{ 
                                        color: '#667eea', 
                                        textDecoration: 'underline', 
                                        wordBreak: 'break-all',
                                        fontSize: '0.75rem'
                                      }}
                                    >
                                      View Attachment
                                    </a>
                                  </div>
                                )}
                              </div>
                              <span style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                                {new Date(revision.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {project.stage === 'Ready to Close' && (
                <div className="overview-card premium-card closure-card-premium">
                  <h3 className="card-title">Ready to Close</h3>
                  <p className="closure-text">All deliverables are complete. Click below to close the project.</p>
                  <button onClick={handleCloseProject} className="btn-primary-premium">
                    Close Project
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="tab-content fade-in">
            {tasks.length === 0 ? (
              <div className="no-tasks-message" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <FaCheckCircle style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }} />
                <h3 style={{ marginBottom: '0.5rem' }}>No tasks found</h3>
                <p>Tasks will appear here once they are created for this project.</p>
                {project?.stage === 'Onboarding' && (
                  <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#94a3b8' }}>
                    Onboarding tasks are created automatically. If they don't appear, refresh the page.
                  </p>
                )}
              </div>
            ) : (
              <div className="tasks-list premium-tasks">
                {tasks
                  .filter((task) => task.type === 'Onboarding')
                  .map((task) => (
                    <div key={task.id} className={`task-item-premium onboarding-task ${task.isCompleted ? 'completed' : ''}`}>
                      <button
                        className="task-checkbox-premium"
                        onClick={() => handleTaskComplete(task.id, !task.isCompleted)}
                      >
                        {task.isCompleted ? <FaCheckCircle className="checked" /> : <FaCircle className="unchecked" />}
                      </button>
                      <div className="task-content">
                        <h4 className="task-title">{task.title}</h4>
                        {task.description && <p className="task-description">{task.description}</p>}
                        
                        {task.isCompleted && task.submissionData && (
                          <div className="submission-display" style={{ marginTop: '1rem', padding: '1rem', background: '#f1f5f9', borderRadius: '8px' }}>
                            <strong>Submitted:</strong>
                            {task.submissionType === 'url' ? (
                              <a href={task.submissionData} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '0.5rem', color: '#667eea', wordBreak: 'break-all' }}>
                                {task.submissionData}
                              </a>
                            ) : (
                              <p style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{task.submissionData}</p>
                            )}
                          </div>
                        )}

                        {!task.isCompleted && (
                          <div className="submission-form" style={{ marginTop: '1rem' }}>
                            {submissionForm?.taskId === task.id ? (
                              <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ marginBottom: '1rem' }}>
                                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Submission Type:</label>
                                  <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button
                                      onClick={() => submissionForm && setSubmissionForm({ ...submissionForm, type: 'url' })}
                                      style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: submissionForm?.type === 'url' ? '#667eea' : 'white', color: submissionForm?.type === 'url' ? 'white' : '#1a1a1a', cursor: 'pointer' }}
                                    >
                                      URL
                                    </button>
                                    <button
                                      onClick={() => submissionForm && setSubmissionForm({ ...submissionForm, type: 'text' })}
                                      style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: submissionForm?.type === 'text' ? '#667eea' : 'white', color: submissionForm?.type === 'text' ? 'white' : '#1a1a1a', cursor: 'pointer' }}
                                    >
                                      Text
                                    </button>
                                  </div>
                                </div>
                                {submissionForm?.type === 'url' ? (
                                  <input
                                    type="url"
                                    placeholder="Enter URL (e.g., https://example.com)"
                                    value={submissionForm?.data || ''}
                                    onChange={(e) => submissionForm && setSubmissionForm({ ...submissionForm, data: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}
                                  />
                                ) : (
                                  <textarea
                                    placeholder="Enter text information"
                                    value={submissionForm?.data || ''}
                                    onChange={(e) => submissionForm && setSubmissionForm({ ...submissionForm, data: e.target.value })}
                                    rows={4}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1rem', fontFamily: 'inherit' }}
                                  />
                                )}
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button
                                    className="btn-primary"
                                    onClick={() => submissionForm && handleSubmitOnboarding(task.id, submissionForm.data, submissionForm.type)}
                                    disabled={!submissionForm?.data.trim() || submittingTask === task.id}
                                    style={{ flex: 1 }}
                                  >
                                    {submittingTask === task.id ? 'Submitting...' : 'Submit'}
                                  </button>
                                  <button
                                    className="btn-secondary"
                                    onClick={() => setSubmissionForm(null)}
                                    disabled={submittingTask === task.id}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                className="btn-primary"
                                onClick={() => setSubmissionForm({ taskId: task.id, data: '', type: 'url' })}
                                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                              >
                                Submit {task.title}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'onboarding' && (
          <div className="tab-content fade-in">
            <div className="onboarding-info-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Onboarding Information</h3>
                {project?.stage !== 'Onboarding' && (
                  <span style={{ 
                    padding: '0.5rem 1rem', 
                    background: '#f1f5f9', 
                    borderRadius: '8px', 
                    fontSize: '0.875rem', 
                    color: '#64748b',
                    fontWeight: 500
                  }}>
                    Historical Data
                  </span>
                )}
              </div>
              {tasks.filter((t) => t.type === 'Onboarding' && t.isCompleted && t.submissionData).length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  <FaFileAlt style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }} />
                  <p>No onboarding information submitted yet.</p>
                  {project?.stage === 'Onboarding' ? (
                    <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>
                      Submit information in the Tasks tab to see it here.
                    </p>
                  ) : (
                    <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>
                      This project has moved past the onboarding stage.
                    </p>
                  )}
                </div>
              ) : (
                <div className="onboarding-items">
                  {tasks
                    .filter((t) => t.type === 'Onboarding' && t.isCompleted && t.submissionData)
                    .map((task) => (
                      <div key={task.id} className="onboarding-item-card" style={{ padding: '1.5rem', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '1rem' }}>
                        <h4 style={{ marginBottom: '0.5rem', fontSize: '1.1rem', fontWeight: 600 }}>{task.title}</h4>
                        <div style={{ marginTop: '1rem' }}>
                          {task.submissionType === 'url' ? (
                            <div>
                              <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.9rem' }}>URL:</strong>
                              <a
                                href={task.submissionData}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#667eea', wordBreak: 'break-all', textDecoration: 'underline' }}
                              >
                                {task.submissionData}
                              </a>
                            </div>
                          ) : (
                            <div>
                              <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.9rem' }}>Text:</strong>
                              <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{task.submissionData}</p>
                            </div>
                          )}
                          <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                            Submitted: {new Date(task.updatedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'deliverables' && (
          <div className="tab-content fade-in">
            {/* Team Members Section - Only for PM */}
            {/* COMMENTED OUT - Temporarily disabled
            {authService.getUser()?.role === 'Project Manager' && (
              <div className="team-members-section" style={{ marginBottom: '2rem', background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h3 className="section-title" style={{ marginBottom: '0.5rem' }}>Team Members</h3>
                    <p className="section-description" style={{ margin: 0 }}>
                      Assign multiple team members to work on this project
                    </p>
                  </div>
                  <button
                    className="btn-primary-premium"
                    onClick={() => setShowAddTeamMemberModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <FaPlus /> Add Team Member
                  </button>
                </div>
                <div className="team-members-list">
                  {teamMembers.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      No team members assigned yet. Click "Add Team Member" to assign someone.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                      {teamMembers.map((member) => (
                        <div
                          key={member.id}
                          className="team-member-card"
                          style={{
                            background: '#f9fafb',
                            padding: '1rem',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, color: '#111827' }}>{member.user?.name}</div>
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{member.user?.role}</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                              Added {new Date(member.assignedAt).toLocaleDateString()}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveTeamMember(member.userId)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#dc2626',
                              cursor: 'pointer',
                              padding: '0.5rem',
                              borderRadius: '4px',
                              transition: 'background 0.2s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#fee2e2')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                            title="Remove team member"
                          >
                            <FaTimes />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            */}

            {/* Deliverables Header with Info */}
            <div className="deliverables-header-info">
              <h3 className="section-title">Project Deliverables</h3>
              <p className="section-description">
                Track deliverables as they move through Copy Writing → Design → Client Review → Approval
              </p>
            </div>

            {/* Deliverable Sub-Tabs */}
            <div className="deliverable-sub-tabs-container">
              {project.deliverables && project.deliverables.length > 0 && (
                <div className="deliverable-sub-tabs">
                  {project.deliverables.map((deliverable: any) => (
                    <button
                      key={deliverable.id}
                      className={`deliverable-sub-tab ${activeDeliverableTab === deliverable.id ? 'active' : ''}`}
                      onClick={() => {
                        setActiveDeliverableTab(deliverable.id);
                        if (!activeDeliverableTab) {
                          setActiveDeliverableTab(deliverable.id);
                        }
                      }}
                    >
                      {getDeliverableDisplayName(deliverable)}
                    </button>
                  ))}
                </div>
              )}
              <button
                className="add-deliverable-btn"
                onClick={() => setShowAddDeliverableModal(true)}
                title="Add Custom Deliverable"
              >
                <FaPlus /> Add Custom
              </button>
            </div>

            {/* Kanban Board for Selected Deliverable */}
            {activeDeliverableTab && project.deliverables && (() => {
              const selectedDeliverable = project.deliverables.find((d: any) => d.id === activeDeliverableTab);
              if (!selectedDeliverable) return null;

              // Get all files/tasks for this deliverable
              const getRelatedLinks = (deliverableType: string) => {
                const links: Array<{ department: string; type: string; url: string; taskTitle: string; taskId?: string; assignedToId?: string; assignedToName?: string; createdAt?: Date; updatedAt?: Date }> = [];
                
                // Map task types to departments
                const taskTypeToDepartment: any = {
                  'Copy': 'Copy Writing',
                  'Design': 'Design',
                  'Dev': 'Development',
                  'AI': 'AI Development',
                  'Social Media': 'Social Media',
                  'CRM': 'CRM',
                  'SEO/GEO': 'SEO/GEO',
                };
                
                tasks.forEach((task: any) => {
                  // First, check if task is directly linked to this deliverable via deliverableId
                  const isLinkedToDeliverable = task.deliverableId === selectedDeliverable.id;
                  
                  // For custom deliverables (type: 'Other' or has customType), only show tasks that are explicitly linked
                  const isCustomDeliverable = deliverableType === 'Other' || selectedDeliverable.customType;
                  
                  // Debug logging for all tasks linked to deliverables
                  if (isLinkedToDeliverable) {
                    console.log('[ProjectDetail] Task linked to deliverable:', {
                      taskId: task.id,
                      taskTitle: task.title,
                      taskType: task.type,
                      taskDeliverableId: task.deliverableId,
                      selectedDeliverableId: selectedDeliverable.id,
                      selectedDeliverableType: deliverableType,
                      isCustomDeliverable,
                      assignedToId: task.assignedToId,
                      assignedToName: task.assignedTo?.name
                    });
                  }
                  
                  if (isCustomDeliverable && isLinkedToDeliverable) {
                    // Show all tasks linked to this custom deliverable
                    const department = taskTypeToDepartment[task.type] || task.type;
                    if (task.fileUrl) {
                      const fileType = task.fileUrl.includes('figma.com') ? 'Figma' : 
                                      task.fileUrl.includes('drive.google.com') || task.fileUrl.includes('docs.google.com') ? 'Google Drive' :
                                      task.fileUrl.startsWith('http') ? 'Live URL' : 'File';
                      links.push({
                        department,
                        type: fileType,
                        url: task.fileUrl,
                        taskTitle: task.title,
                        taskId: task.id,
                        assignedToId: task.assignedToId,
                        assignedToName: task.assignedTo?.name || null,
                        createdAt: task.createdAt,
                        updatedAt: task.updatedAt
                      });
                    } else {
                      // For custom deliverables, show ALL linked tasks (assigned or not)
                      // This ensures tasks show up even if not yet assigned
                      links.push({
                        department,
                        type: task.assignedToId ? 'In Progress' : 'Not Started',
                        url: `task-${task.id}`,
                        taskTitle: task.title,
                        taskId: task.id,
                        assignedToId: task.assignedToId,
                        assignedToName: task.assignedTo?.name || null,
                        createdAt: task.createdAt,
                        updatedAt: task.updatedAt
                      });
                    }
                  } else if (!isCustomDeliverable) {
                    // For standard deliverables, check if task is explicitly linked via deliverableId first
                    if (isLinkedToDeliverable) {
                      // Task is explicitly linked to this deliverable
                      const department = taskTypeToDepartment[task.type] || task.type;
                      if (task.fileUrl) {
                        const fileType = task.fileUrl.includes('figma.com') ? 'Figma' : 
                                        task.fileUrl.includes('drive.google.com') || task.fileUrl.includes('docs.google.com') ? 'Google Drive' :
                                        task.fileUrl.startsWith('http') ? 'Live URL' : 'File';
                        links.push({
                          department,
                          type: fileType,
                          url: task.fileUrl,
                          taskTitle: task.title,
                          taskId: task.id,
                          assignedToId: task.assignedToId,
                          assignedToName: task.assignedTo?.name || null,
                          createdAt: task.createdAt,
                          updatedAt: task.updatedAt
                        });
                      } else {
                        // Show linked tasks even without fileUrl (including AI tasks)
                        links.push({
                          department,
                          type: task.assignedToId ? 'In Progress' : 'Not Started',
                          url: `task-${task.id}`,
                          taskTitle: task.title,
                          taskId: task.id,
                          assignedToId: task.assignedToId,
                          assignedToName: task.assignedTo?.name || null,
                          createdAt: task.createdAt,
                          updatedAt: task.updatedAt
                        });
                      }
                    } else {
                      // Original logic for standard deliverables (fallback for tasks not explicitly linked)
                      // IMPORTANT: Only apply fallback logic if task has NO deliverableId set
                      // If a task has a deliverableId, it should ONLY appear in that deliverable
                      if (!task.deliverableId) {
                        // Copy tasks
                        if (task.type === 'Copy' && ['Brand Book', 'Copy of Landing Page', 'Speaker Kit', 'Other', 'Landing Page'].includes(deliverableType)) {
                          if (task.fileUrl) {
                            links.push({
                              department: 'Copy Writing',
                              type: task.fileUrl.includes('figma.com') ? 'Figma' : 'Google Drive',
                              url: task.fileUrl,
                              taskTitle: task.title,
                              taskId: task.id,
                              assignedToId: task.assignedToId,
                              assignedToName: task.assignedTo?.name || null,
                              createdAt: task.createdAt,
                              updatedAt: task.updatedAt
                            });
                          } else if (task.assignedToId) {
                            // Include assigned tasks even without fileUrl
                            links.push({
                              department: 'Copy Writing',
                              type: 'In Progress',
                              url: `task-${task.id}`, // Placeholder URL for tasks without files
                              taskTitle: task.title,
                              taskId: task.id,
                              assignedToId: task.assignedToId,
                              assignedToName: task.assignedTo?.name || null,
                              createdAt: task.createdAt,
                              updatedAt: task.updatedAt
                            });
                          }
                        }
                        // Design tasks
                        if (task.type === 'Design' && ['Logo', 'Social Banners', 'Landing Page', 'Brand Book'].includes(deliverableType)) {
                          if (task.fileUrl) {
                            links.push({
                              department: 'Design',
                              type: task.fileUrl.includes('figma.com') ? 'Figma' : 'Google Drive',
                              url: task.fileUrl,
                              taskTitle: task.title,
                              taskId: task.id,
                              assignedToId: task.assignedToId,
                              assignedToName: task.assignedTo?.name || null,
                              createdAt: task.createdAt,
                              updatedAt: task.updatedAt
                            });
                          } else if (task.assignedToId) {
                            // Include assigned tasks even without fileUrl
                            links.push({
                              department: 'Design',
                              type: 'In Progress',
                              url: `task-${task.id}`, // Placeholder URL for tasks without files
                              taskTitle: task.title,
                              taskId: task.id,
                              assignedToId: task.assignedToId,
                              assignedToName: task.assignedTo?.name || null,
                              createdAt: task.createdAt,
                              updatedAt: task.updatedAt
                            });
                          }
                        }
                        // Dev tasks
                        if (task.type === 'Dev' && deliverableType === 'Landing Page') {
                          if (task.fileUrl) {
                            links.push({
                              department: 'Development',
                              type: 'Live URL',
                              url: task.fileUrl,
                              taskTitle: task.title,
                              taskId: task.id,
                              assignedToId: task.assignedToId,
                              assignedToName: task.assignedTo?.name || null,
                              createdAt: task.createdAt,
                              updatedAt: task.updatedAt
                            });
                          } else if (task.assignedToId) {
                            links.push({
                              department: 'Development',
                              type: 'In Progress',
                              url: `task-${task.id}`,
                              taskTitle: task.title,
                              taskId: task.id,
                              assignedToId: task.assignedToId,
                              assignedToName: task.assignedTo?.name || null,
                              createdAt: task.createdAt,
                              updatedAt: task.updatedAt
                            });
                          }
                        }
                        // AI tasks - ONLY show if explicitly linked to this deliverable via deliverableId
                        // AI tasks should NOT appear in standard deliverables like Brand Book unless explicitly linked
                        // The explicit linking is already handled above in the isLinkedToDeliverable check
                        // So we don't need fallback logic here - AI tasks must be explicitly linked
                      }
                    }
                  }
                });
                
                if (selectedDeliverable.fileUrl && !links.some(l => l.url === selectedDeliverable.fileUrl)) {
                  const isFigma = selectedDeliverable.fileUrl.includes('figma.com');
                  const isDrive = selectedDeliverable.fileUrl.includes('drive.google.com') || selectedDeliverable.fileUrl.includes('docs.google.com');
                  const isLiveUrl = selectedDeliverable.fileUrl.startsWith('http') && !isFigma && !isDrive;
                  
                  let dept = 'Deliverable';
                  if (['Brand Book', 'Copy of Landing Page', 'Speaker Kit', 'Other'].includes(deliverableType)) {
                    dept = 'Copy Writing';
                  } else if (['Logo', 'Social Banners'].includes(deliverableType)) {
                    dept = 'Design';
                  } else if (deliverableType === 'Landing Page') {
                    dept = isLiveUrl ? 'Development' : 'Design';
                  }
                  
                  links.push({
                    department: dept,
                    type: isFigma ? 'Figma' : isDrive ? 'Google Drive' : isLiveUrl ? 'Live URL' : 'Link',
                    url: selectedDeliverable.fileUrl,
                    taskTitle: 'Latest Submission'
                  });
                }
                
                return links.filter((link, index, self) => 
                  index === self.findIndex(l => l.url === link.url && l.department === link.department)
                );
              };

              const relatedLinks = getRelatedLinks(selectedDeliverable.type);
              
              // Organize files into Kanban columns
              const getFileStatus = (link: any): string => {
                // Check if this is a placeholder task (no fileUrl yet)
                const isPlaceholder = link.url.startsWith('task-');
                
                // Get related task to check current status
                const relatedTask = link.taskId ? tasks.find((t: any) => t.id === link.taskId) : null;
                
                // Debug logging for status determination
                if (!isPlaceholder && selectedDeliverable.status === 'Revision') {
                  console.log('[ProjectDetail] File status check for Revision:', {
                    fileUrl: link.url,
                    deliverableStatus: selectedDeliverable.status,
                    taskStatus: relatedTask?.status,
                    taskId: relatedTask?.id,
                    isResubmitted: relatedTask && relatedTask.status === 'In Review'
                  });
                }
                
                // Debug logging for AI tasks
                if (relatedTask && relatedTask.type === 'AI') {
                  console.log('[ProjectDetail] AI Task status check:', {
                    taskId: relatedTask.id,
                    taskTitle: relatedTask.title,
                    status: relatedTask.status,
                    fileUrl: relatedTask.fileUrl,
                    linkUrl: link.url,
                    isPlaceholder,
                    deliverableId: relatedTask.deliverableId,
                    selectedDeliverableId: selectedDeliverable.id
                  });
                }
                
                // AUTOMATIC STATUS ASSIGNMENTS (based on task/deliverable status):
                // These take priority over manual status columns
                
                // 1. Revision: Check if file has "Revision Requested" in history OR deliverable status is 'Revision'
                // This takes HIGHEST PRIORITY - if in revision, it stays in revision (unless resubmitted)
                if (!isPlaceholder) {
                  const fileHistoryKey = `${selectedDeliverable.id}:${link.url}`;
                  const fileHistory = deliverableHistory[fileHistoryKey] || [];
                  const latestHistory = fileHistory[0];
                  
                  // Check if this file has been requested for revision
                  const hasRevisionRequest = latestHistory?.action === 'Revision Requested';
                  const isDeliverableInRevision = selectedDeliverable.status === 'Revision';
                  
                  // If file has revision request OR deliverable is in revision status
                  if (hasRevisionRequest || isDeliverableInRevision) {
                    // Check if task was resubmitted (status is 'In Review')
                    if (relatedTask && relatedTask.status === 'In Review') {
                      // Resubmitted - goes back to "For Approval"
                      return 'for_approval';
                    }
                    // Still needs revision - this takes priority over everything else
                    return 'revision';
                  }
                  
                  // Check if file is in "Elliot Review" (manual column)
                  // Check if the latest history entry indicates it was moved to Elliot Review
                  // Only if it's not in revision (revision takes priority)
                  // This check must come BEFORE checking deliverable status for QA (which also uses 'Ready for Review')
                  if (latestHistory?.notes && latestHistory.notes.includes('Moved to Elliot Review')) {
                    // If the latest entry is Elliot Review, return elliot_review
                    return 'elliot_review';
                  }
                }
                
                // MANUAL STATUS COLUMNS (set via drag and drop - check deliverable status):
                // These are only shown if deliverable status matches (set manually via drag and drop)
                // BUT only if NOT in revision (revision takes priority)
                
                // Approved/Completed: When deliverable status is 'Approved' (set manually)
                if (selectedDeliverable.status === 'Approved' && !isPlaceholder) {
                  return 'approved_completed';
                }
                
                // Client Validation: When deliverable is in Client Review status (set manually)
                if (selectedDeliverable.status === 'Client Review' && !isPlaceholder) {
                  return 'client_validation';
                }
                
                // QA Before Sending to Client: When deliverable is Ready for Review (set manually)
                // Only show if task is NOT in review (if in review, it goes to "For Approval")
                // AND only if NOT in revision (revision takes priority)
                // AND only if NOT in Elliot Review (Elliot Review takes priority over QA)
                if (selectedDeliverable.status === 'Ready for Review' && !isPlaceholder) {
                  // Double-check it's not in Elliot Review (in case history wasn't loaded yet)
                  const fileHistoryKey = `${selectedDeliverable.id}:${link.url}`;
                  const fileHistory = deliverableHistory[fileHistoryKey] || [];
                  const isInElliotReview = fileHistory[0]?.notes?.includes('Moved to Elliot Review');
                  if (isInElliotReview) {
                    return 'elliot_review';
                  }
                  
                  if (relatedTask && relatedTask.status === 'In Review') {
                    // Task is in review, so it goes to "For Approval" instead
                    return 'for_approval';
                  }
                  return 'qa_before_client';
                }
                
                // Elliot Review: Check history for revision requests (set manually)
                // Only show if deliverable is NOT in 'Revision' status and file doesn't have revision request
                // Elliot Review is a manual staging area before actual revision
                // Note: Elliot Review is manually draggable - this section is kept for future use
                // Since revision takes priority, this won't be reached if revision is active
                
                // 2. For Approval: When task is submitted for review (status = 'In Review')
                // This takes priority - if task is in review, it's automatically in "For Approval"
                if (relatedTask && relatedTask.status === 'In Review') {
                  return 'for_approval';
                }
                
                // 3. Owned/In Progress: When a task has an owner (assigned)
                if (link.assignedToId || link.taskId) {
                  const isAssigned = relatedTask?.assignedToId || link.assignedToId;
                  
                  if (isAssigned) {
                    // If task is assigned (with or without file), it's "owned_in_progress"
                    return 'owned_in_progress';
                  }
                }
                
                // 4. Not Yet Started: Default for unassigned tasks
                return 'not_started';
              };

              const kanbanColumns = [
                { id: 'not_started', title: 'Not yet started', files: relatedLinks.filter(l => getFileStatus(l) === 'not_started') },
                { id: 'owned_in_progress', title: 'Owned/In Progress', files: relatedLinks.filter(l => getFileStatus(l) === 'owned_in_progress') },
                { id: 'for_approval', title: 'For Approval', files: relatedLinks.filter(l => getFileStatus(l) === 'for_approval') },
                { id: 'revision', title: 'Revision', files: relatedLinks.filter(l => getFileStatus(l) === 'revision') },
                { id: 'elliot_review', title: 'Elliot Review', files: relatedLinks.filter(l => getFileStatus(l) === 'elliot_review') },
                
                { id: 'approved_completed', title: 'Approved/Completed', files: relatedLinks.filter(l => getFileStatus(l) === 'approved_completed') },
                { id: 'qa_before_client', title: 'QA Before Sending to Client', files: relatedLinks.filter(l => getFileStatus(l) === 'qa_before_client') },
                { id: 'client_validation', title: 'Client Validation', files: relatedLinks.filter(l => getFileStatus(l) === 'client_validation') },
              ];

              // Drag and drop handlers for deliverables Kanban
              const handleFileDragStart = (e: React.DragEvent, link: any) => {
                if (link.url.startsWith('task-')) {
                  e.preventDefault();
                  return; // Don't allow dragging placeholder tasks
                }
                setDraggedFile({
                  deliverableId: selectedDeliverable.id,
                  fileUrl: link.url,
                  department: link.department
                });
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', link.url);
                const target = e.target as HTMLElement;
                if (target.closest('.kanban-card')) {
                  (target.closest('.kanban-card') as HTMLElement).style.opacity = '0.5';
                }
              };

              const handleFileDragEnd = (e: React.DragEvent) => {
                const target = e.target as HTMLElement;
                if (target.closest('.kanban-card')) {
                  (target.closest('.kanban-card') as HTMLElement).style.opacity = '1';
                }
                setDraggedFile(null);
                setDragOverColumn(null);
              };

              const handleColumnDragOver = (e: React.DragEvent, columnId: string) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverColumn(columnId);
              };

              const handleColumnDragLeave = () => {
                setDragOverColumn(null);
              };

              const handleColumnDrop = async (e: React.DragEvent, targetColumnId: string) => {
                e.preventDefault();
                if (!draggedFile) return;

                const fileUrl = draggedFile.fileUrl;
                if (fileUrl.startsWith('task-')) return; // Can't move placeholder tasks

                // Only allow dropping on manual action columns
                // Automatic columns (not_started, owned_in_progress, for_approval) cannot be dragged to
                // Manual columns: elliot_review, revision, approved_completed, qa_before_client, client_validation
                const manualColumns = ['elliot_review', 'revision', 'approved_completed', 'qa_before_client', 'client_validation'];
                if (!manualColumns.includes(targetColumnId)) {
                  // For automatic columns, don't update status (they're informational/automatic)
                  setDragOverColumn(null);
                  setDraggedFile(null);
                  return;
                }

                try {
                  if (targetColumnId === 'revision') {
                    // Open revision modal for revision column
                    setRevisionDeliverable({ 
                      id: draggedFile.deliverableId, 
                      type: selectedDeliverable.type, 
                      fileUrl: fileUrl 
                    });
                    setRevisionNotes('');
                    setRevisionAttachment('');
                    setShowRevisionConfirm(true);
                    // Don't update yet - wait for modal confirmation
                    setDragOverColumn(null);
                    setDraggedFile(null);
                    return;
                  } else if (targetColumnId === 'elliot_review') {
                    // Elliot Review is a manual staging area - add history entry to track it
                    // Since there's no "Elliot Review" status in the backend, we'll add a history entry with notes
                    await deliverableService.updateStatus(
                      draggedFile.deliverableId,
                      'Ready for Review', // Use existing status, but track in history
                      `Moved to Elliot Review via Kanban`,
                      fileUrl
                    );
                    
                    // Explicitly reload file history to ensure it's up to date
                    try {
                      const fileHist = await deliverableService.getHistory(draggedFile.deliverableId, fileUrl);
                      const historyKey = `${draggedFile.deliverableId}:${fileUrl}`;
                      setDeliverableHistory(prev => ({
                        ...prev,
                        [historyKey]: fileHist
                      }));
                    } catch (error) {
                      console.error('Failed to reload file history:', error);
                    }
                    
                    showToast('Moved to Elliot Review ✓');
                  } else if (targetColumnId === 'approved_completed') {
                    // Approve this file - sets status to 'Approved'
                    await deliverableService.updateStatus(
                      draggedFile.deliverableId,
                      'Approved',
                      `Approved via Kanban`,
                      fileUrl
                    );
                    showToast('File approved ✓');
                  } else if (targetColumnId === 'qa_before_client') {
                    // Move to QA - sets status to 'Ready for Review'
                    await deliverableService.updateStatus(
                      draggedFile.deliverableId,
                      'Ready for Review',
                      `Moved to QA before sending to client via Kanban`,
                      fileUrl
                    );
                    showToast('Moved to QA before sending to client ✓');
                  } else if (targetColumnId === 'client_validation') {
                    // Move to client review - sets status to 'Client Review'
                    await deliverableService.updateStatus(
                      draggedFile.deliverableId,
                      'Client Review',
                      `Moved to client validation via Kanban`,
                      fileUrl
                    );
                    showToast('Moved to client validation ✓');
                  }
                  
                  // Refresh to get the actual data from server
                  await loadProject();
                } catch (error: any) {
                  console.error('Failed to update file status:', error);
                  const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
                  showToast(`Failed to move file: ${errorMessage}`);
                } finally {
                  setDragOverColumn(null);
                  setDraggedFile(null);
                }
              };

              return (
                <div className="deliverable-kanban-board">
                  <div className="kanban-header">
                    <h4 className="kanban-deliverable-title">{getDeliverableDisplayName(selectedDeliverable)}</h4>
                    <div className="kanban-status-badge" style={{
                      backgroundColor: selectedDeliverable.status === 'Approved' ? '#d1fae5' : 
                                      selectedDeliverable.status === 'Ready for Review' ? '#fef3c7' :
                                      selectedDeliverable.status === 'Revision' ? '#fee2e2' : '#f3f4f6',
                      color: selectedDeliverable.status === 'Approved' ? '#065f46' :
                             selectedDeliverable.status === 'Ready for Review' ? '#92400e' :
                             selectedDeliverable.status === 'Revision' ? '#991b1b' : '#6b7280'
                    }}>
                      {selectedDeliverable.status}
                    </div>
                  </div>
                  
                  {/* Drag and Drop Instruction */}
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
                    <span><strong>Tip:</strong> Drag cards across columns to update their status. Cards can be moved between any columns.</span>
                  </div>
                  
                  <div className="kanban-columns">
                    {kanbanColumns.map((column) => (
                      <div 
                        key={column.id} 
                        className={`kanban-column ${dragOverColumn === column.id ? 'drag-over' : ''}`}
                        onDragOver={(e) => handleColumnDragOver(e, column.id)}
                        onDragLeave={handleColumnDragLeave}
                        onDrop={(e) => handleColumnDrop(e, column.id)}
                      >
                        <div className="kanban-column-header">
                          <h5 className="kanban-column-title">{column.title}</h5>
                          <span className="kanban-column-count">{column.files.length}</span>
                        </div>
                        <div className="kanban-column-content">
                          {/* Add Task button for PMs in NOT YET STARTED column */}
                          {column.id === 'not_started' && authService.getUser()?.role === 'Project Manager' && (
                            <button
                              onClick={() => {
                                setSelectedDeliverableForTask(selectedDeliverable.id);
                                setNewTaskData({ department: '', notes: '', assignedToId: '' });
                                setShowAddTaskFromDeliverableModal(true);
                              }}
                              style={{
                                width: '100%',
                                padding: '0.75rem',
                                marginBottom: '0.75rem',
                                background: 'white',
                                border: '2px dashed #cbd5e1',
                                borderRadius: '8px',
                                color: '#64748b',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#667eea';
                                e.currentTarget.style.color = '#667eea';
                                e.currentTarget.style.background = '#f0f4ff';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#cbd5e1';
                                e.currentTarget.style.color = '#64748b';
                                e.currentTarget.style.background = 'white';
                              }}
                            >
                              <FaPlus /> Add Task
                            </button>
                          )}
                          {column.files.map((link, idx) => {
                            const deptColors: any = {
                              'Copy Writing': '#667eea',
                              'Design': '#8b5cf6',
                              'Development': '#10b981',
                              'Deliverable': '#6b7280'
                            };
                            const linkColor = deptColors[link.department] || '#6b7280';
                            const fileHistoryKey = `${selectedDeliverable.id}:${link.url}`;
                            const fileHistory = deliverableHistory[fileHistoryKey] || [];
                            
                            // Get task info for owner and date
                            const relatedTask = link.taskId ? tasks.find((t: any) => t.id === link.taskId) : null;
                            const ownerName = link.assignedToName || relatedTask?.assignedTo?.name || 'Unassigned';
                            const displayDate = link.updatedAt || link.createdAt || relatedTask?.updatedAt || relatedTask?.createdAt;
                            const formattedDate = displayDate ? new Date(displayDate).toLocaleString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : '';
                            
                            // Get deliverable team members for this deliverable
                            const deliverableMembers = deliverableTeamMembers[selectedDeliverable.id] || [];
                            const isPM = authService.getUser()?.role === 'Project Manager';
                            
                            // Check if this file/task is in revision
                            // Only show revision indicator if the file is actually in the "revision" column
                            const currentFileStatus = getFileStatus(link);
                            const isInRevision = currentFileStatus === 'revision';
                            
                            return (
                              <div 
                                key={idx} 
                                className={`kanban-card ${isInRevision ? 'revision-card' : ''}`}
                                draggable={!link.url.startsWith('task-')}
                                onDragStart={(e) => handleFileDragStart(e, link)}
                                onDragEnd={handleFileDragEnd}
                                style={isInRevision ? {
                                  border: '2px solid #dc2626',
                                  borderLeft: '4px solid #dc2626',
                                  position: 'relative'
                                } : {}}
                              >
                                {/* Revision Ribbon */}
                                {isInRevision && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '0',
                                    right: '0',
                                    background: '#dc2626',
                                    color: 'white',
                                    padding: '0.25rem 0.75rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    borderBottomLeftRadius: '8px',
                                    borderTopRightRadius: '8px',
                                    zIndex: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)'
                                  }}>
                                    <FaExclamationTriangle style={{ fontSize: '0.625rem' }} />
                                    REVISION
                                  </div>
                                )}
                                <div className="kanban-card-header">
                                  <div className="kanban-card-dept" style={{ backgroundColor: `${linkColor}20`, color: linkColor }}>
                                    {link.department.charAt(0)}
                                  </div>
                                  <span className="kanban-card-type">{link.type}</span>
                                  {/* Notification badge for notes/links */}
                                  {fileHistory.length > 0 && fileHistory[0].notes && (() => {
                                    const notes = fileHistory[0].notes;
                                    const hasNotes = notes.trim().length > 0;
                                    const hasAttachment = /Attachment:\s*https?:\/\/[^\s]+/i.test(notes);
                                    if (!hasNotes && !hasAttachment) return null;
                                    return (
                                      <div 
                                        style={{
                                          marginLeft: 'auto',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.25rem',
                                          padding: '0.25rem 0.5rem',
                                          background: '#fef3c7',
                                          borderRadius: '12px',
                                          cursor: 'pointer'
                                        }}
                                        title="Has notes or attachments"
                                      >
                                        <FaStickyNote style={{ color: '#f59e0b', fontSize: '0.75rem' }} />
                                        {hasAttachment && <FaLink style={{ color: '#f59e0b', fontSize: '0.625rem' }} />}
                                      </div>
                                    );
                                  })()}
                                </div>
                                <div className="kanban-card-body">
                                  {link.url.startsWith('task-') ? (
                                    <div className="kanban-card-link">
                                      {link.department}
                                      <span className="kanban-card-assigned">Assigned</span>
                                    </div>
                                  ) : (
                                    <a
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="kanban-card-link"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {link.department}
                                      <FaChevronRight className="kanban-link-icon" />
                                    </a>
                                  )}
                                </div>
                                <div className="kanban-card-meta">
                                  <div className="kanban-card-owner">
                                    <span className="kanban-meta-label">Owner:</span>
                                    <span className="kanban-meta-value">{ownerName}</span>
                                  </div>
                                  {deliverableMembers.length > 0 && (
                                    <div className="kanban-card-team" style={{ marginTop: '0.5rem' }}>
                                      <span className="kanban-meta-label" style={{ fontSize: '0.75rem', color: '#6b7280' }}>Team:</span>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                                        {deliverableMembers.map((member: any) => (
                                          <span 
                                            key={member.id}
                                            style={{ 
                                              fontSize: '0.75rem', 
                                              color: '#667eea',
                                              background: '#f0f4ff',
                                              padding: '0.125rem 0.5rem',
                                              borderRadius: '4px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '0.25rem'
                                            }}
                                          >
                                            {member.user?.name}
                                            {isPM && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleRemoveDeliverableTeamMember(selectedDeliverable.id, member.userId);
                                                }}
                                                style={{
                                                  background: 'none',
                                                  border: 'none',
                                                  color: '#dc2626',
                                                  cursor: 'pointer',
                                                  padding: 0,
                                                  fontSize: '0.75rem',
                                                  marginLeft: '0.25rem'
                                                }}
                                                title="Remove team member"
                                              >
                                                <FaTimes />
                                              </button>
                                            )}
                                          </span>
                                        ))}
                                        {isPM && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedDeliverableForTeam(selectedDeliverable.id);
                                              setShowAddDeliverableTeamMemberModal(true);
                                            }}
                                            style={{
                                              fontSize: '0.75rem',
                                              color: '#667eea',
                                              background: 'none',
                                              border: '1px dashed #667eea',
                                              padding: '0.125rem 0.5rem',
                                              borderRadius: '4px',
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '0.25rem'
                                            }}
                                            title="Add team member"
                                          >
                                            <FaPlus style={{ fontSize: '0.625rem' }} /> Add
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {deliverableMembers.length === 0 && isPM && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedDeliverableForTeam(selectedDeliverable.id);
                                          setShowAddDeliverableTeamMemberModal(true);
                                        }}
                                        style={{
                                          fontSize: '0.75rem',
                                          color: '#667eea',
                                          background: 'none',
                                          border: '1px dashed #667eea',
                                          padding: '0.25rem 0.5rem',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.25rem'
                                        }}
                                        title="Add team member"
                                      >
                                        <FaPlus style={{ fontSize: '0.625rem' }} /> Add Team Member
                                      </button>
                                    </div>
                                  )}
                                  {formattedDate && (
                                    <div className="kanban-card-date" style={{ marginTop: '0.5rem' }}>
                                      <span className="kanban-meta-label">Date:</span>
                                      <span className="kanban-meta-value">{formattedDate}</span>
                                    </div>
                                  )}
                                  
                                  {/* Notes and Links Notification */}
                                  {fileHistory.length > 0 && fileHistory[0].notes && (() => {
                                    const notes = fileHistory[0].notes;
                                    const attachmentMatch = notes.match(/Attachment:\s*(https?:\/\/[^\s]+)/i);
                                    const hasAttachment = !!attachmentMatch;
                                    const notesText = attachmentMatch 
                                      ? notes.replace(/Attachment:\s*https?:\/\/[^\s]+/i, '').trim()
                                      : notes.trim();
                                    const attachmentUrl = attachmentMatch ? attachmentMatch[1] : null;
                                    
                                    if (!notesText && !hasAttachment) return null;
                                    
                                    return (
                                      <div style={{ 
                                        marginTop: '0.75rem', 
                                        padding: '0.75rem', 
                                        background: '#fef3c7', 
                                        border: '1px solid #fde68a',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem'
                                      }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: notesText && hasAttachment ? '0.5rem' : 0 }}>
                                          <FaStickyNote style={{ color: '#f59e0b', fontSize: '0.875rem', marginTop: '0.125rem', flexShrink: 0 }} />
                                          <div style={{ flex: 1 }}>
                                            {notesText && (
                                              <div style={{ color: '#92400e', marginBottom: hasAttachment ? '0.5rem' : 0, whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                                                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Notes:</strong>
                                                {notesText}
                                              </div>
                                            )}
                                            {hasAttachment && attachmentUrl && (
                                              <div style={{ color: '#92400e' }}>
                                                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Attachment:</strong>
                                                <a 
                                                  href={attachmentUrl} 
                                                  target="_blank" 
                                                  rel="noopener noreferrer"
                                                  style={{ 
                                                    color: '#667eea', 
                                                    textDecoration: 'underline', 
                                                    wordBreak: 'break-all',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem'
                                                  }}
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <FaLink style={{ fontSize: '0.625rem' }} />
                                                  {attachmentUrl}
                                                </a>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                                {fileHistory.length > 0 && (
                                  <div className="kanban-card-footer">
                                    <span className="kanban-card-status">
                                      {fileHistory[0].action === 'Approved' ? '✓ Approved' :
                                       fileHistory[0].action === 'Revision Requested' ? '↻ Revision' : 'Updated'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Old deliverables list - keeping for reference but will be replaced */}
            <div className="deliverables-list-premium" style={{ display: 'none' }}>
              {project.deliverables?.map((deliverable: any) => {
                const statusClass = deliverable.status.toLowerCase().replace(/\s+/g, '-');
                
                // Get all related task links for this deliverable, grouped by department
                const getRelatedLinks = (deliverableType: string) => {
                  const links: Array<{ department: string; type: string; url: string; taskTitle: string }> = [];
                  
                  // Find tasks that reference this deliverable type
                  tasks.forEach((task: any) => {
                    if (task.fileUrl) {
                      // Copy tasks can link to: Brand Book, Copy of Landing Page, Speaker Kit, Other, Landing Page
                      if (task.type === 'Copy' && ['Brand Book', 'Copy of Landing Page', 'Speaker Kit', 'Other', 'Landing Page'].includes(deliverableType)) {
                        links.push({
                          department: 'Copy Writing',
                          type: task.fileUrl.includes('figma.com') ? 'Figma' : 'Google Drive',
                          url: task.fileUrl,
                          taskTitle: task.title
                        });
                      }
                      // Design tasks can link to: Logo, Social Banners, Landing Page, Brand Book
                      if (task.type === 'Design' && ['Logo', 'Social Banners', 'Landing Page', 'Brand Book'].includes(deliverableType)) {
                        links.push({
                          department: 'Design',
                          type: task.fileUrl.includes('figma.com') ? 'Figma' : 'Google Drive',
                          url: task.fileUrl,
                          taskTitle: task.title
                        });
                      }
                      // Dev tasks for Landing Page (live URL)
                      if (task.type === 'Dev' && deliverableType === 'Landing Page') {
                        links.push({
                          department: 'Development',
                          type: 'Live URL',
                          url: task.fileUrl,
                          taskTitle: task.title
                        });
                      }
                    }
                  });
                  
                  // Also include the deliverable's own fileUrl if it exists and hasn't been added yet
                  if (deliverable.fileUrl && !links.some(l => l.url === deliverable.fileUrl)) {
                    const isFigma = deliverable.fileUrl.includes('figma.com');
                    const isDrive = deliverable.fileUrl.includes('drive.google.com') || deliverable.fileUrl.includes('docs.google.com');
                    const isLiveUrl = deliverable.fileUrl.startsWith('http') && !isFigma && !isDrive;
                    
                    // Determine department based on deliverable type
                    let dept = 'Deliverable';
                    if (['Brand Book', 'Copy of Landing Page', 'Speaker Kit', 'Other'].includes(deliverableType)) {
                      dept = 'Copy Writing';
                    } else if (['Logo', 'Social Banners'].includes(deliverableType)) {
                      dept = 'Design';
                    } else if (deliverableType === 'Landing Page') {
                      dept = isLiveUrl ? 'Development' : 'Design';
                    }
                    
                    links.push({
                      department: dept,
                      type: isFigma ? 'Figma' : isDrive ? 'Google Drive' : isLiveUrl ? 'Live URL' : 'Link',
                      url: deliverable.fileUrl,
                      taskTitle: 'Latest Submission'
                    });
                  }
                  
                  // Remove duplicates based on URL
                  const uniqueLinks = links.filter((link, index, self) => 
                    index === self.findIndex(l => l.url === link.url && l.department === link.department)
                  );
                  
                  return uniqueLinks;
                };

                const relatedLinks = getRelatedLinks(deliverable.type);
                
                // Determine which departments are involved with this deliverable
                const getDeliverableDepartments = (type: string) => {
                  if (type === 'Landing Page') {
                    return [
                      { name: 'Copy Writing', color: '#667eea', icon: '📝' },
                      { name: 'Design', color: '#8b5cf6', icon: '🎨' },
                      { name: 'Development', color: '#10b981', icon: '💻' }
                    ];
                  } else if (['Brand Book', 'Copy of Landing Page', 'Speaker Kit', 'Other'].includes(type)) {
                    return [{ name: 'Copy Writing', color: '#667eea', icon: '📝' }];
                  } else if (['Logo', 'Social Banners'].includes(type)) {
                    return [{ name: 'Design', color: '#8b5cf6', icon: '🎨' }];
                  }
                  return [{ name: 'General', color: '#6b7280', icon: '📦' }];
                };

                const departments = getDeliverableDepartments(deliverable.type);
                
                // Get workflow stage context
                const getWorkflowContext = (status: string, type: string, depts: any[]) => {
                  if (type === 'Landing Page') {
                    switch (status) {
                      case 'Not Started':
                        return `Waiting for Copy → Design → Dev workflow to begin`;
                      case 'In Progress':
                        return `In progress across ${depts.length} department${depts.length > 1 ? 's' : ''}`;
                      case 'Ready for Review':
                        return `All departments submitted, awaiting PM review`;
                      case 'Client Review':
                        return `Sent to client for feedback`;
                      case 'Approved':
                        return `Approved and finalized`;
                      case 'Revision':
                        return `Revision requested - teams to update`;
                      default:
                        return '';
                    }
                  } else {
                    const dept = depts[0];
                    switch (status) {
                      case 'Not Started':
                        return `Waiting for ${dept.name} team`;
                      case 'In Progress':
                        return `${dept.name} team working on this`;
                      case 'Ready for Review':
                        return `Submitted by ${dept.name}, awaiting PM review`;
                      case 'Client Review':
                        return `Sent to client for feedback`;
                      case 'Approved':
                        return `Approved and finalized`;
                      case 'Revision':
                        return `Revision requested - ${dept.name} team to update`;
                      default:
                        return '';
                    }
                  }
                };

                const workflowContext = getWorkflowContext(deliverable.status, deliverable.type, departments);
                
                const getStatusColor = () => {
                  switch (deliverable.status) {
                    case 'Not Started': return { bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' };
                    case 'In Progress': return { bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6' };
                    case 'Ready for Review': return { bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' };
                    case 'Client Review': return { bg: '#e0e7ff', color: '#3730a3', dot: '#6366f1' };
                    case 'Approved': return { bg: '#d1fae5', color: '#065f46', dot: '#10b981' };
                    case 'Revision': return { bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' };
                    default: return { bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' };
                  }
                };
                const statusStyle = getStatusColor();
                
                return (
                  <div key={deliverable.id} className="deliverable-item-premium enhanced-deliverable">
                    <div className="deliverable-icon-wrapper">
                      <div 
                        className={`deliverable-status-indicator ${statusClass}`}
                        style={{ backgroundColor: statusStyle.dot }}
                      >
                        {deliverable.status === 'Approved' && <FaCheckCircle className="status-icon-check" />}
                      </div>
                    </div>
                    <div className="deliverable-content-wrapper">
                      <div className="deliverable-header-premium">
                        <div className="deliverable-title-section">
                          <h4 className="deliverable-title-premium">{deliverable.type}</h4>
                          <div className="department-badges-group">
                            {departments.map((dept, idx) => (
                              <span 
                                key={idx}
                                className="department-badge"
                                style={{ 
                                  backgroundColor: `${dept.color}15`,
                                  color: dept.color,
                                  borderColor: `${dept.color}40`
                                }}
                              >
                                {dept.icon} {dept.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Workflow Context */}
                      <div className="workflow-context">
                        <FaClock className="workflow-icon" />
                        <span className="workflow-text">{workflowContext}</span>
                      </div>

                      <div 
                        className="deliverable-status-badge-premium"
                        style={{ 
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.color
                        }}
                      >
                        {deliverable.status}
                      </div>

                      {/* Related Links from Different Departments */}
                      {relatedLinks.length > 0 && (
                        <div className="deliverable-links-section">
                          <div className="links-header">
                            <FaLink className="links-icon" />
                            <span className="links-title">Files & Links</span>
                          </div>
                          <div className="links-list">
                            {relatedLinks.map((link, idx) => {
                              const deptColors: any = {
                                'Copy Writing': '#667eea',
                                'Design': '#8b5cf6',
                                'Development': '#10b981',
                                'Deliverable': '#6b7280'
                              };
                              const linkColor = deptColors[link.department] || '#6b7280';
                              const fileHistoryKey = `${deliverable.id}:${link.url}`;
                              const fileHistory = deliverableHistory[fileHistoryKey] || [];
                              
                              return (
                                <div key={idx} className="file-link-wrapper">
                                  <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="deliverable-link-item"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="link-item-left">
                                      <div 
                                        className="link-dept-indicator"
                                        style={{ backgroundColor: `${linkColor}20`, borderColor: `${linkColor}40` }}
                                      >
                                        <span style={{ color: linkColor }}>{link.department.charAt(0)}</span>
                                      </div>
                                      <div className="link-item-info">
                                        <span className="link-dept-name">{link.department}</span>
                                        <span className="link-type">{link.type}</span>
                                      </div>
                                    </div>
                                    <FaChevronRight className="link-chevron" />
                                  </a>
                                  
                                  {/* File-specific history */}
                                  {fileHistory.length > 0 && (
                                    <div className="file-history-mini">
                                      {fileHistory.slice(0, 2).map((activity: any, actIdx: number) => {
                                        const date = new Date(activity.createdAt);
                                        const formattedDate = date.toLocaleDateString('en-US', { 
                                          month: 'short', 
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        });
                                        const userName = activity.user?.name || 'System';
                                        const isApproved = activity.action === 'Approved';
                                        const isRevision = activity.action === 'Revision Requested';
                                        
                                        return (
                                          <div key={activity.id || actIdx} className="file-history-item">
                                            <div className="file-history-indicator" style={{
                                              backgroundColor: isApproved ? '#10b981' : isRevision ? '#f59e0b' : '#6b7280'
                                            }}>
                                              {isApproved ? <FaCheckCircle /> : isRevision ? <FaExclamationTriangle /> : <FaCircle />}
                                            </div>
                                            <div className="file-history-content">
                                              <span className="file-history-action">
                                                {isApproved ? 'Approved' : isRevision ? 'Revision' : 'Updated'}
                                              </span>
                                              <span className="file-history-meta">
                                                {userName} • {formattedDate}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  
                                  {/* Approve/Revision buttons per file for PM */}
                                  {authService.getUser()?.role === 'Project Manager' && (
                                    <div className="file-actions-mini">
                                      {/* Check if this file is already approved */}
                                      {(() => {
                                        const fileApproved = fileHistory.some((h: any) => h.action === 'Approved' && h.fileUrl === link.url);
                                        const fileInRevision = fileHistory.some((h: any) => h.action === 'Revision Requested' && h.fileUrl === link.url);
                                        
                                        // Show approve button if file is not approved yet
                                        if (!fileApproved && (deliverable.status === 'Ready for Review' || deliverable.status === 'Client Review' || fileInRevision)) {
                                          return (
                                            <button
                                              className="btn-approve-mini"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleApproveFile(deliverable.id, deliverable.type, link.url, link.department);
                                              }}
                                              disabled={updatingDeliverable === deliverable.id}
                                            >
                                              Approve File
                                            </button>
                                          );
                                        }
                                        
                                        // Show revision button if file is approved or in review
                                        if ((fileApproved || deliverable.status === 'Ready for Review' || deliverable.status === 'Client Review') && !fileInRevision) {
                                          return (
                                            <button
                                              className="btn-revision-mini"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleRequestRevisionClick(deliverable.id, deliverable.type, link.url);
                                              }}
                                              disabled={updatingDeliverable === deliverable.id}
                                            >
                                              Request Revision
                                            </button>
                                          );
                                        }
                                        
                                        return null;
                                      })()}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {deliverable.notes && (
                        <p className="deliverable-notes">{deliverable.notes}</p>
                      )}

                      {/* Activity History */}
                      {deliverableHistory[deliverable.id] && deliverableHistory[deliverable.id].length > 0 && (
                        <div className="deliverable-activity-history">
                          <div className="activity-history-header">
                            <FaHistory className="activity-icon" />
                            <span className="activity-title">Activity History</span>
                          </div>
                          <div className="activity-timeline">
                            {deliverableHistory[deliverable.id].map((activity: any, idx: number) => {
                              const date = new Date(activity.createdAt);
                              const formattedDate = date.toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              });
                              const userName = activity.user?.name || 'System';
                              const isApproved = activity.action === 'Approved';
                              const isRevision = activity.action === 'Revision Requested';
                              
                              return (
                                <div key={activity.id || idx} className="activity-item">
                                  <div className="activity-indicator" style={{
                                    backgroundColor: isApproved ? '#10b981' : isRevision ? '#f59e0b' : '#6b7280'
                                  }}>
                                    {isApproved ? <FaCheckCircle /> : isRevision ? <FaExclamationTriangle /> : <FaCircle />}
                                  </div>
                                  <div className="activity-content">
                                    <div className="activity-action">
                                      <span className="activity-action-text">
                                        {isApproved && 'Approved'}
                                        {isRevision && 'Revision Requested'}
                                        {!isApproved && !isRevision && 'Status Changed'}
                                      </span>
                                      <span className="activity-status-change">
                                        {activity.previousStatus} → {activity.newStatus}
                                      </span>
                                    </div>
                                    <div className="activity-meta">
                                      <span className="activity-user">{userName}</span>
                                      <span className="activity-date">{formattedDate}</span>
                                    </div>
                                    {activity.notes && (
                                      <div className="activity-notes">{activity.notes}</div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Show overall approve button only if all files are approved */}
                      {authService.getUser()?.role === 'Project Manager' && 
                       relatedLinks.length > 0 && (() => {
                         // Check if all files are approved
                         const allFilesApproved = relatedLinks.every((link) => {
                           const fileHistoryKey = `${deliverable.id}:${link.url}`;
                           const fileHistory = deliverableHistory[fileHistoryKey] || [];
                           return fileHistory.some((h: any) => h.action === 'Approved' && h.fileUrl === link.url);
                         });
                         
                         // Only show overall approve if all files are approved and deliverable is ready
                         if (allFilesApproved && (deliverable.status === 'Ready for Review' || deliverable.status === 'Client Review')) {
                           return (
                             <div className="deliverable-actions-premium">
                               <button
                                 className="btn-approve-premium"
                                 onClick={() => handleApproveDeliverable(deliverable.id, deliverable.type)}
                                 disabled={updatingDeliverable === deliverable.id}
                               >
                                 {updatingDeliverable === deliverable.id ? 'Processing...' : 'Approve All'}
                               </button>
                             </div>
                           );
                         }
                         
                         // Show message if not all files are approved
                         if (deliverable.status === 'Ready for Review' || deliverable.status === 'Client Review') {
                           const approvedCount = relatedLinks.filter((link) => {
                             const fileHistoryKey = `${deliverable.id}:${link.url}`;
                             const fileHistory = deliverableHistory[fileHistoryKey] || [];
                             return fileHistory.some((h: any) => h.action === 'Approved' && h.fileUrl === link.url);
                           }).length;
                           
                           return (
                             <div className="deliverable-actions-premium">
                               <div className="approval-status-info">
                                 <FaClock className="info-icon" />
                                 <span>Approve all {relatedLinks.length} files before approving deliverable ({approvedCount}/{relatedLinks.length} approved)</span>
                               </div>
                             </div>
                           );
                         }
                         
                         return null;
                       })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'emails' && (
          <div className="tab-content fade-in">
            <div className="emails-header-premium">
              <h3>Email History</h3>
              <button onClick={() => setShowEmailModal(true)} className="btn-primary-premium">
                <FaPaperPlane /> Send Email
              </button>
            </div>
            <div className="emails-list-premium">
              {emails.map((email) => (
                <div key={email.id} className="email-item-premium">
                  <div className="email-header-premium">
                    <div>
                      <h4 className="email-subject">{email.subject}</h4>
                      <span className="email-meta-premium">
                        Sent by {email.sentBy?.name} on {new Date(email.sentAt).toLocaleDateString()}
                      </span>
                    </div>
                    <span className={`email-status-premium ${email.isOpened ? 'opened' : 'unopened'}`}>
                      {email.isOpened ? 'Opened' : 'Unopened'}
                    </span>
                  </div>
                  <div className="email-body-premium">{email.body}</div>
                  <div className="email-footer-premium">
                    <span>To: {email.recipientEmail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="tab-content fade-in">
            {loadingActivity ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <FaHistory style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.3 }} />
                <p>Loading activity log...</p>
              </div>
            ) : (
              <ActivityLogKanban activities={activityLog} />
            )}
          </div>
        )}

        {activeTab === 'branding' && (
          <div className="tab-content fade-in">
            <div style={{ padding: '2rem' }}>
              <h2 style={{ marginBottom: '1.5rem', color: '#1e293b', fontSize: '1.5rem', fontWeight: 600 }}>
                Branding Management
              </h2>
              <div style={{
                display: 'flex',
                gap: '1rem',
                overflowX: 'auto',
                paddingBottom: '1rem',
                alignItems: 'stretch',
                minHeight: '600px'
              }}>
                {[
                  { id: 'call1', title: 'Call 1', subtitle: 'Brand Q&A Session #1', maxTime: '(Max 45min)' },
                  { id: 'call2', title: 'Call 2 (optional)', subtitle: 'Brand Q&A Session #2', maxTime: '(Max 30min)' },
                  { id: 'preC3', title: 'Pre C3', subtitle: '', maxTime: '' },
                  { id: 'call3', title: 'Call 3', subtitle: 'Brand Messaging Framework Review Session', maxTime: '(Max 20min)' },
                  { id: 'preC4', title: 'Pre C4', subtitle: '', maxTime: '' },
                  { id: 'call4', title: 'Call 4', subtitle: 'Design Creative Review Session', maxTime: '(Max 15min)' },
                  { id: 'call5', title: 'Call 5', subtitle: 'Design Validation Session', maxTime: '(Max 15min)' },
                  { id: 'preC6', title: 'Pre C6', subtitle: '', maxTime: '' },
                  { id: 'call6', title: 'Call 6', subtitle: 'Project Wrapup Call', maxTime: '(5 - 60min)' },
                  { id: 'call7', title: 'Call 7 (optional)', subtitle: 'Client Lifetime Value Call', maxTime: '' },
                ].map((call) => {
                  const callData = brandingCalls[call.id];
                  return (
                    <div key={call.id} style={{
                      background: '#f9fafb',
                      borderRadius: '12px',
                      padding: '1rem',
                      minWidth: '280px',
                      width: '280px',
                      minHeight: '500px',
                      display: 'flex',
                      flexDirection: 'column',
                      border: '2px solid #e5e7eb',
                      flexShrink: 0
                    }}>
                      <div style={{ marginBottom: '1rem', minHeight: '80px' }}>
                        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.25rem' }}>
                          {call.title}
                        </h3>
                        {call.subtitle ? (
                          <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '0.25rem', lineHeight: '1.4' }}>
                            {call.subtitle}
                          </p>
                        ) : (
                          <div style={{ height: '1.125rem' }}></div>
                        )}
                        {call.maxTime ? (
                          <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {call.maxTime}
                          </p>
                        ) : (
                          <div style={{ height: '0.9375rem' }}></div>
                        )}
                      </div>
                      
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.5rem' }}>
                          Zoom Link
                        </label>
                        <input
                          type="text"
                          value={callData.zoomLink}
                          onChange={(e) => {
                            setBrandingCalls(prev => ({
                              ...prev,
                              [call.id]: { ...prev[call.id], zoomLink: e.target.value }
                            }));
                          }}
                          placeholder="Enter Zoom link"
                          style={{
                            width: '100%',
                            padding: '0.625rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '0.8125rem',
                            fontFamily: 'inherit',
                            background: 'white'
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <input
                          type="checkbox"
                          checked={callData.isDone}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCallId(call.id);
                              setBrandingNotes(callData.notes);
                              setBrandingAttachment(callData.attachmentLink);
                              setShowBrandingNotesModal(true);
                            } else {
                              setBrandingCalls(prev => ({
                                ...prev,
                                [call.id]: { ...prev[call.id], isDone: false }
                              }));
                            }
                          }}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <label style={{ fontSize: '0.8125rem', color: '#475569', cursor: 'pointer', flex: 1 }}>
                          Done
                        </label>
                      </div>

                      {callData.isDone && (callData.notes || callData.attachmentLink) && (
                        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                          {callData.notes && (
                            <div style={{ marginBottom: '0.75rem' }}>
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>Notes: </span>
                              {callData.notes.length > 100 ? (
                                <div style={{ marginTop: '0.25rem' }}>
                                  <p style={{ fontSize: '0.8125rem', color: '#64748b', wordBreak: 'break-word', marginBottom: '0.5rem' }}>
                                    {callData.notes.substring(0, 100)}...
                                  </p>
                                  <button
                                    onClick={() => {
                                      setSelectedCallId(call.id);
                                      setBrandingNotes(callData.notes);
                                      setBrandingAttachment(callData.attachmentLink);
                                      setShowBrandingNotesModal(true);
                                    }}
                                    style={{
                                      fontSize: '0.75rem',
                                      color: '#667eea',
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      padding: 0,
                                      textDecoration: 'underline',
                                      fontWeight: 500
                                    }}
                                  >
                                    See more
                                  </button>
                                </div>
                              ) : (
                                <p style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.25rem', wordBreak: 'break-word' }}>{callData.notes}</p>
                              )}
                            </div>
                          )}
                          {callData.attachmentLink && (
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>Attachment: </span>
                              <a 
                                href={callData.attachmentLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ fontSize: '0.8125rem', color: '#667eea', textDecoration: 'none', wordBreak: 'break-all', display: 'block', marginTop: '0.25rem' }}
                              >
                                View Link
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'revisions' && (
          <div className="tab-content fade-in">
            <div style={{ padding: '2rem' }}>
              <h2 style={{ marginBottom: '1.5rem', color: '#1e293b', fontSize: '1.5rem', fontWeight: 600 }}>
                Revision Tracking
              </h2>
              <p style={{ marginBottom: '2rem', color: '#64748b', fontSize: '0.875rem' }}>
                Track the number of revisions for each deliverable type in this project.
              </p>
              
              <div style={{ 
                background: 'white', 
                borderRadius: '0.5rem', 
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ 
                        padding: '1rem', 
                        textAlign: 'left', 
                        fontWeight: 600, 
                        color: '#475569',
                        fontSize: '0.875rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        Revision Type
                      </th>
                      <th style={{ 
                        padding: '1rem', 
                        textAlign: 'right', 
                        fontWeight: 600, 
                        color: '#475569',
                        fontSize: '0.875rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        Count
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '1rem', color: '#1e293b', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <FaExclamationTriangle style={{ color: '#3b82f6', fontSize: '1rem' }} />
                          <span>Copy Revisions</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: '#1e293b', fontWeight: 600, fontSize: '1.125rem' }}>
                        {project?.copyRevisionCount || 0}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '1rem', color: '#1e293b', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <FaExclamationTriangle style={{ color: '#8b5cf6', fontSize: '1rem' }} />
                          <span>Design Revisions</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: '#1e293b', fontWeight: 600, fontSize: '1.125rem' }}>
                        {project?.designRevisionCount || 0}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '1rem', color: '#1e293b', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <FaExclamationTriangle style={{ color: '#10b981', fontSize: '1rem' }} />
                          <span>Landing Page Revisions</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: '#1e293b', fontWeight: 600, fontSize: '1.125rem' }}>
                        {project?.landingPageRevisionCount || 0}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ 
                marginTop: '2rem', 
                padding: '1rem', 
                background: '#f0f9ff', 
                borderRadius: '0.5rem',
                border: '1px solid #bae6fd'
              }}>
                <p style={{ margin: 0, color: '#0369a1', fontSize: '0.875rem' }}>
                  <strong>Note:</strong> Revision counts are automatically tracked when deliverables are marked for revision. 
                  Each time a deliverable is sent back for revision, the corresponding counter is incremented.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {showEmailModal && (
        <EmailModal
          projectId={id!}
          projectName={project.clientName}
          onClose={() => setShowEmailModal(false)}
          onSuccess={() => {
            setShowEmailModal(false);
            loadProject();
          }}
        />
      )}

      {/* Add Team Member Modal */}
      {/* Add Deliverable Team Member Modal */}
      {showAddDeliverableTeamMemberModal && selectedDeliverableForTeam && (
        <div className="modal-overlay" onClick={() => { setShowAddDeliverableTeamMemberModal(false); setSelectedDeliverableForTeam(null); setSelectedDeliverableUserId(''); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Team Member to Deliverable</h2>
              <button className="modal-close" onClick={() => { setShowAddDeliverableTeamMemberModal(false); setSelectedDeliverableForTeam(null); setSelectedDeliverableUserId(''); }}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Select Team Member</label>
                <select
                  value={selectedDeliverableUserId}
                  onChange={(e) => setSelectedDeliverableUserId(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', padding: '0.75rem' }}
                >
                  <option value="">-- Select a user --</option>
                  {allUsers
                    .filter((user) => {
                      const currentMembers = deliverableTeamMembers[selectedDeliverableForTeam] || [];
                      return !currentMembers.some((tm: any) => tm.userId === user.id);
                    })
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.role})
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => { setShowAddDeliverableTeamMemberModal(false); setSelectedDeliverableForTeam(null); setSelectedDeliverableUserId(''); }}
                disabled={addingDeliverableTeamMember}
              >
                Cancel
              </button>
              <button
                className="btn-primary-premium"
                onClick={handleAddDeliverableTeamMember}
                disabled={!selectedDeliverableUserId || addingDeliverableTeamMember}
              >
                {addingDeliverableTeamMember ? 'Adding...' : 'Add Team Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddTeamMemberModal && (
        <div className="modal-overlay" onClick={() => { setShowAddTeamMemberModal(false); setSelectedUserId(''); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Team Member</h2>
              <button className="modal-close" onClick={() => { setShowAddTeamMemberModal(false); setSelectedUserId(''); }}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Select Team Member</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', padding: '0.75rem' }}
                >
                  <option value="">-- Select a user --</option>
                  {allUsers
                    .filter((user) => !teamMembers.some((tm) => tm.userId === user.id))
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.role})
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => { setShowAddTeamMemberModal(false); setSelectedUserId(''); }}
                disabled={addingTeamMember}
              >
                Cancel
              </button>
              <button
                className="btn-primary-premium"
                onClick={handleAddTeamMember}
                disabled={!selectedUserId || addingTeamMember}
              >
                {addingTeamMember ? 'Adding...' : 'Add Team Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRevisionConfirm && revisionDeliverable && (
        <div className="modal-overlay" onClick={() => {
          setShowRevisionConfirm(false);
          setRevisionDeliverable(null);
          setRevisionNotes('');
          setRevisionAttachment('');
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Request Revision</h2>
              <button className="close-button" onClick={() => {
                setShowRevisionConfirm(false);
                setRevisionDeliverable(null);
                setRevisionNotes('');
                setRevisionAttachment('');
              }}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '1.5rem', color: '#6b7280' }}>
                Send "{revisionDeliverable.type}" back for revision? This will notify the team.
              </p>
              
              <div className="form-group">
                <label htmlFor="revision-notes">Notes (Optional)</label>
                <textarea
                  id="revision-notes"
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', padding: '0.75rem', minHeight: '100px', fontFamily: 'inherit' }}
                  placeholder="Add notes about what needs to be revised..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="revision-attachment">Attachment/Link (Optional)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FaLink style={{ color: '#6b7280', fontSize: '0.875rem' }} />
                  <input
                    id="revision-attachment"
                    type="url"
                    value={revisionAttachment}
                    onChange={(e) => setRevisionAttachment(e.target.value)}
                    className="form-input"
                    style={{ flex: 1, padding: '0.75rem' }}
                    placeholder="https://example.com or Google Drive/Figma link..."
                  />
                </div>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem', marginBottom: 0 }}>
                  Add a link to reference materials, examples, or feedback documents
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowRevisionConfirm(false);
                  setRevisionDeliverable(null);
                  setRevisionNotes('');
                  setRevisionAttachment('');
                }}
                disabled={updatingDeliverable === revisionDeliverable.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmRevision}
                disabled={updatingDeliverable === revisionDeliverable.id}
                style={{ background: '#dc2626', borderColor: '#dc2626' }}
              >
                {updatingDeliverable === revisionDeliverable.id ? 'Requesting...' : 'Request Revision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branding Notes Modal */}
      {showBrandingNotesModal && selectedCallId && (() => {
        const callInfo = [
          { id: 'call1', title: 'Call 1 - Brand Q&A Session #1' },
          { id: 'call2', title: 'Call 2 (optional) - Brand Q&A Session #2' },
          { id: 'preC3', title: 'Pre C3' },
          { id: 'call3', title: 'Call 3 - Brand Messaging Framework Review Session' },
          { id: 'preC4', title: 'Pre C4' },
          { id: 'call4', title: 'Call 4 - Design Creative Review Session' },
          { id: 'call5', title: 'Call 5 - Design Validation Session' },
          { id: 'preC6', title: 'Pre C6' },
          { id: 'call6', title: 'Call 6 - Project Wrapup Call' },
          { id: 'call7', title: 'Call 7 (optional) - Client Lifetime Value Call' },
        ].find(c => c.id === selectedCallId);
        
        return (
          <div className="modal-overlay" onClick={() => {
            setShowBrandingNotesModal(false);
            setSelectedCallId(null);
            setBrandingNotes('');
            setBrandingAttachment('');
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
              <div className="modal-header">
                <h2>{callInfo && brandingCalls[callInfo.id]?.isDone ? 'Edit Notes' : 'Mark'} {callInfo?.title || 'Call'}{callInfo && brandingCalls[callInfo.id]?.isDone ? '' : ' as Done'}</h2>
                <button className="close-button" onClick={() => {
                  setShowBrandingNotesModal(false);
                  setSelectedCallId(null);
                  setBrandingNotes('');
                  setBrandingAttachment('');
                }}>
                  <FaTimes />
                </button>
              </div>
              <div className="modal-body" style={{ padding: '1.5rem' }}>
                <p style={{ 
                  marginBottom: '1.5rem', 
                  color: '#6b7280',
                  fontSize: '0.875rem',
                  lineHeight: '1.5'
                }}>
                  Add notes and/or attachment link for this call (optional).
                </p>
                
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label 
                    htmlFor="branding-notes" 
                    style={{ 
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: '#374151'
                    }}
                  >
                    Notes (Optional)
                  </label>
                  <textarea
                    id="branding-notes"
                    value={brandingNotes}
                    onChange={(e) => setBrandingNotes(e.target.value)}
                    className="form-input"
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem', 
                      minHeight: '120px', 
                      fontFamily: 'inherit',
                      fontSize: '0.875rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      resize: 'vertical'
                    }}
                    placeholder="Add notes about this call..."
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label 
                    htmlFor="branding-attachment"
                    style={{ 
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: '#374151'
                    }}
                  >
                    Attachment/Link (Optional)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <FaLink style={{ color: '#6b7280', fontSize: '0.875rem', flexShrink: 0 }} />
                    <input
                      id="branding-attachment"
                      type="url"
                      value={brandingAttachment}
                      onChange={(e) => setBrandingAttachment(e.target.value)}
                      className="form-input"
                      style={{ 
                        flex: 1, 
                        padding: '0.75rem',
                        fontSize: '0.875rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px'
                      }}
                      placeholder="https://example.com or Google Drive/Figma link..."
                    />
                  </div>
                  <p style={{ 
                    fontSize: '0.75rem', 
                    color: '#9ca3af', 
                    marginTop: '0.25rem', 
                    marginBottom: 0,
                    lineHeight: '1.4'
                  }}>
                    Add a link to reference materials, recordings, or documents
                  </p>
                </div>
              </div>
              <div className="modal-footer" style={{ 
                padding: '1rem 1.5rem',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.75rem',
                background: '#f9fafb'
              }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowBrandingNotesModal(false);
                    setSelectedCallId(null);
                    setBrandingNotes('');
                    setBrandingAttachment('');
                  }}
                  style={{
                    padding: '0.625rem 1.25rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    background: 'white',
                    color: '#374151',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    if (selectedCallId) {
                      setBrandingCalls(prev => ({
                        ...prev,
                        [selectedCallId]: {
                          ...prev[selectedCallId],
                          isDone: true,
                          notes: brandingNotes,
                          attachmentLink: brandingAttachment
                        }
                      }));
                    }
                    setShowBrandingNotesModal(false);
                    setSelectedCallId(null);
                    setBrandingNotes('');
                    setBrandingAttachment('');
                  }}
                  style={{ 
                    background: '#667eea', 
                    borderColor: '#667eea',
                    color: 'white',
                    padding: '0.625rem 1.25rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: '1px solid #667eea',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#5568d3';
                    e.currentTarget.style.borderColor = '#5568d3';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#667eea';
                    e.currentTarget.style.borderColor = '#667eea';
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add Custom Deliverable Modal */}
      {showAddTaskFromDeliverableModal && selectedDeliverableForTask && (
        <div className="modal-overlay" onClick={() => setShowAddTaskFromDeliverableModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Add Task to Deliverable</h2>
              <button className="close-button" onClick={() => setShowAddTaskFromDeliverableModal(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Department *</label>
                <select
                  value={newTaskData.department}
                  onChange={(e) => setNewTaskData({ ...newTaskData, department: e.target.value })}
                  className="form-input"
                  required
                >
                  <option value="">-- Select Department --</option>
                  <option value="Design">Design</option>
                  <option value="Copy Writing">Copy Writing</option>
                  <option value="Development">Development</option>
                  <option value="AI Team">AI Team</option>
                  <option value="Social Media Team">Social Media Team</option>
                  <option value="CRM">CRM</option>
                  <option value="SEO/GEO Team">SEO/GEO Team</option>
                  <option value="Onboarding">Onboarding</option>
                </select>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={newTaskData.notes}
                  onChange={(e) => setNewTaskData({ ...newTaskData, notes: e.target.value })}
                  className="form-input"
                  style={{ minHeight: '120px', resize: 'vertical' }}
                  placeholder="Add task notes or description..."
                />
              </div>
              <div className="form-group">
                <label>Assign To (Optional)</label>
                <select
                  value={newTaskData.assignedToId}
                  onChange={(e) => setNewTaskData({ ...newTaskData, assignedToId: e.target.value })}
                  className="form-input"
                >
                  <option value="">-- Unassigned --</option>
                  {allUsers
                    .filter((user) => 
                      (newTaskData.department === 'Design' && user.role === 'Designer') ||
                      (newTaskData.department === 'Copy Writing' && user.role === 'Copy Writing') ||
                      (newTaskData.department === 'Development' && user.role === 'Developer') ||
                      (newTaskData.department === 'AI Team' && user.role === 'AI Developer') ||
                      (newTaskData.department === 'Social Media Team' && user.role === 'Social Media') ||
                      (newTaskData.department === 'CRM' && user.role === 'CRM') ||
                      (newTaskData.department === 'SEO/GEO Team' && user.role === 'SEO/GEO') ||
                      (newTaskData.department === 'Onboarding' && (user.role === 'Project Manager' || user.role === 'FOUNDER/CEO'))
                    )
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.role})
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowAddTaskFromDeliverableModal(false);
                  setSelectedDeliverableForTask(null);
                  setNewTaskData({ department: '', notes: '', assignedToId: '' });
                }}
                disabled={creatingTask}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCreateTaskFromDeliverable}
                disabled={creatingTask || !newTaskData.department}
              >
                {creatingTask ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddDeliverableModal && (
        <div className="modal-overlay" onClick={() => setShowAddDeliverableModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Custom Deliverable</h2>
              <button className="close-button" onClick={() => setShowAddDeliverableModal(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Deliverable Name</label>
                <input
                  type="text"
                  value={newDeliverableName}
                  onChange={(e) => setNewDeliverableName(e.target.value)}
                  placeholder="e.g., Email Templates, Social Media Posts, etc."
                  className="form-input"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newDeliverableName.trim()) {
                      handleCreateCustomDeliverable();
                    }
                  }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowAddDeliverableModal(false);
                  setNewDeliverableName('');
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateCustomDeliverable}
                disabled={!newDeliverableName.trim() || creatingDeliverable}
              >
                {creatingDeliverable ? 'Creating...' : 'Create Deliverable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const EmailModal: React.FC<{ projectId: string; projectName: string; onClose: () => void; onSuccess: () => void }> = ({
  projectId,
  projectName,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    subject: '',
    body: '',
    recipientEmail: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await emailService.send({
        ...formData,
        projectId,
      });
      onSuccess();
    } catch (error) {
      console.error('Failed to send email:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content email-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Send Email - {projectName}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>To</label>
            <input
              type="email"
              value={formData.recipientEmail}
              onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
              required
              placeholder="client@example.com"
            />
          </div>
          <div className="form-group">
            <label>Subject</label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
              placeholder="Email subject"
            />
          </div>
          <div className="form-group">
            <label>Message</label>
            <textarea
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              required
              rows={8}
              placeholder="Email message..."
            />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Sending...' : 'Send Email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectDetail;
