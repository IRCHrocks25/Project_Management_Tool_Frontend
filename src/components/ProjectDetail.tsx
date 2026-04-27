import ProjectDeliverablesTab from './project-detail/ProjectDeliverablesTab';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  FaCopy,
  FaSearch,
  FaTrash,
} from 'react-icons/fa';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import { deliverableService } from '../services/deliverable.service';
import { authService } from '../services/auth.service';
import { clientUpdatesService, ClientUpdate, ClientUpdateForm, FormBlock } from '../services/client-updates.service';
import { MonthlyReminder, monthlyRemindersService } from '../services/monthlyReminders.service';
import { ProjectRegistryMeta, projectRegistryMetaService } from '../services/projectRegistryMeta.service';
import TaskDetailSideModal from './TaskDetailSideModal';
import AppSidebar from './AppSidebar';
import ProjectOverviewTab from './project-detail/ProjectOverviewTab';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = authService.getUser();
  const isPM = currentUser?.role === 'Project Manager';
  const canViewMonthlyReminders = isPM || !!currentUser?.isHeadPM;
  const isTeamLead = !!currentUser?.isTeamLead;
  const canAssignOwners = isPM || isTeamLead;
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const tasksRef = useRef<any[]>([]);
  const previousTasksKeyRef = useRef<string>('');
  const [activeTab, setActiveTab] = useState('overview');
  const [activeDeliverableTab, setActiveDeliverableTab] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progressAnimation, setProgressAnimation] = useState(false);
  const [hideOnboardingPhase, setHideOnboardingPhase] = useState(true);
  const [updatingDeliverable, setUpdatingDeliverable] = useState<string | null>(null);
  const [showRevisionConfirm, setShowRevisionConfirm] = useState(false);
  const [revisionDeliverable, setRevisionDeliverable] = useState<{ id: string; type: string; fileUrl?: string } | null>(null);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [revisionAttachment, setRevisionAttachment] = useState('');
  const [deliverableHistory, setDeliverableHistory] = useState<Record<string, any[]>>({});
  const [draggedFile, setDraggedFile] = useState<{ deliverableId: string; fileUrl: string; department: string; taskId?: string } | null>(null);
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

  // Status change modal state for task kanban/status dropdown
  const [showStatusChangeModal, setShowStatusChangeModal] = useState(false);
  const [statusChangeContext, setStatusChangeContext] = useState<{
    taskId: string;
    columnId: string;
    label: string;
  } | null>(null);
  const [statusChangeNotes, setStatusChangeNotes] = useState('');
  const [statusChangeAttachment, setStatusChangeAttachment] = useState('');
  const [statusChangeLoading, setStatusChangeLoading] = useState(false);
  const [submittingTask, setSubmittingTask] = useState<string | null>(null);
  const [submissionForm, setSubmissionForm] = useState<{ taskId: string; data: string; type: 'url' | 'text' } | null>(null);
  const [showAddDeliverableModal, setShowAddDeliverableModal] = useState(false);
  const [newDeliverableName, setNewDeliverableName] = useState('');
  const [creatingDeliverable, setCreatingDeliverable] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showAddTeamMemberModal, setShowAddTeamMemberModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [addingTeamMember, setAddingTeamMember] = useState(false);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<any | null>(null);
  const [taskDetailInitialTab, setTaskDetailInitialTab] = useState<'details' | 'conversation'>('details');
  const [deliverableTeamMembers, setDeliverableTeamMembers] = useState<Record<string, any[]>>({});
  const [showAddDeliverableTeamMemberModal, setShowAddDeliverableTeamMemberModal] = useState(false);
  const [selectedDeliverableForTeam, setSelectedDeliverableForTeam] = useState<string | null>(null);
  const [selectedDeliverableUserId, setSelectedDeliverableUserId] = useState('');
  const [addingDeliverableTeamMember, setAddingDeliverableTeamMember] = useState(false);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [showAddTaskFromDeliverableModal, setShowAddTaskFromDeliverableModal] = useState(false);
  const [selectedDeliverableForTask, setSelectedDeliverableForTask] = useState<string | null>(null);
  const [editingTaskTitleId, setEditingTaskTitleId] = useState<string | null>(null);
  const [editingTaskTitleValue, setEditingTaskTitleValue] = useState<string>('');
  const [editingDeliverableId, setEditingDeliverableId] = useState<string | null>(null);
  const [editingDeliverableName, setEditingDeliverableName] = useState<string>('');
  const [showDeleteDeliverableConfirm, setShowDeleteDeliverableConfirm] = useState<string | null>(null);
  const [newTaskData, setNewTaskData] = useState({ department: '', notes: '', assignedToId: '', dueDate: '' });
  // Attachment state for "Add Task to Deliverable" modal - support multiple links and files
  const [newTaskLinks, setNewTaskLinks] = useState<string[]>(['']);
  const [newTaskFileUrls, setNewTaskFileUrls] = useState<string[]>([]);
  const [newTaskAttachmentUploading, setNewTaskAttachmentUploading] = useState(false);
  const [markTaskCompleteOnCreate, setMarkTaskCompleteOnCreate] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [clientUpdates, setClientUpdates] = useState<ClientUpdate[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [showCreateUpdateModal, setShowCreateUpdateModal] = useState(false);
  const [emailNotes, setEmailNotes] = useState('');
  const [emailLinks, setEmailLinks] = useState<string[]>(['']);
  const [selectedUpdate, setSelectedUpdate] = useState<ClientUpdate | null>(null);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [currentForm, setCurrentForm] = useState<ClientUpdateForm | null>(null);
  const [formBlocks, setFormBlocks] = useState<FormBlock[]>([]);
  const [creatingForm, setCreatingForm] = useState(false);
  const [publishingForm, setPublishingForm] = useState(false);
  const [formSubmissions, setFormSubmissions] = useState<Record<string, any[]>>({});
  const [loadingSubmissions, setLoadingSubmissions] = useState<Record<string, boolean>>({});
  const [hasNewDeliverableUpdates, setHasNewDeliverableUpdates] = useState(false);
  const [showAssignDeliverableModal, setShowAssignDeliverableModal] = useState(false);
  const [taskToAssign, setTaskToAssign] = useState<any>(null);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState('');
  const [newCustomDeliverableName, setNewCustomDeliverableName] = useState('');
  const [assigningDeliverable, setAssigningDeliverable] = useState(false);
  const [useCustomDeliverable, setUseCustomDeliverable] = useState(false);
  const [showFilesLinksModal, setShowFilesLinksModal] = useState(false);
  const [filesLinksSearchQuery, setFilesLinksSearchQuery] = useState('');
  const [filesLinksFilter, setFilesLinksFilter] = useState<'all' | 'task' | 'email'>('all');
  const [projectMonthlyReminders, setProjectMonthlyReminders] = useState<MonthlyReminder[]>([]);
  const [loadingProjectMonthlyReminders, setLoadingProjectMonthlyReminders] = useState(false);
  const [savingProjectMonthlyReminder, setSavingProjectMonthlyReminder] = useState(false);
  const [showProjectReminderForm, setShowProjectReminderForm] = useState(false);
  const [projectRegistryMeta, setProjectRegistryMeta] = useState<ProjectRegistryMeta | null>(null);
  const [projectReminderForm, setProjectReminderForm] = useState({
    reminderDay: String(Math.min(31, Math.max(1, new Date().getDate()))),
    note: '',
  });

  useEffect(() => {
    if (id) {
      loadProject();
      loadTeamMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    let mounted = true;
    const loadProjectMonthlyReminders = async () => {
      if (!id || !canViewMonthlyReminders) return;
      try {
        setLoadingProjectMonthlyReminders(true);
        const reminders = await monthlyRemindersService.getByProject(id);
        if (mounted) {
          setProjectMonthlyReminders(Array.isArray(reminders) ? reminders : []);
        }
      } catch (error) {
        console.error('Failed to load project monthly reminders:', error);
      } finally {
        if (mounted) setLoadingProjectMonthlyReminders(false);
      }
    };
    loadProjectMonthlyReminders();
    return () => {
      mounted = false;
    };
  }, [id, canViewMonthlyReminders]);

  useEffect(() => {
    if (!id) return;
    setProjectRegistryMeta(projectRegistryMetaService.get(id));
  }, [id]);

  const handleCreateProjectMonthlyReminder = async () => {
    if (!id) return;
    const parsedDay = Number(projectReminderForm.reminderDay);
    const note = projectReminderForm.note.trim();

    if (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 31) {
      showToast('Reminder day must be between 1 and 31');
      return;
    }
    if (!note) {
      showToast('Please add a note before saving');
      return;
    }

    setSavingProjectMonthlyReminder(true);
    try {
      await monthlyRemindersService.create({
        projectId: id,
        clientName: project?.clientName,
        reminderDay: parsedDay,
        note,
      });
      const reminders = await monthlyRemindersService.getByProject(id);
      setProjectMonthlyReminders(Array.isArray(reminders) ? reminders : []);
      setProjectReminderForm((prev) => ({ ...prev, note: '' }));
      showToast('Monthly reminder added ✓');
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      const message = Array.isArray(apiMessage)
        ? apiMessage.join(', ')
        : apiMessage || 'Failed to add monthly reminder';
      showToast(message);
    } finally {
      setSavingProjectMonthlyReminder(false);
    }
  };

  // Open task side modal when navigating with task query params
  useEffect(() => {
    const taskId = searchParams.get('task');
    const tab = searchParams.get('tab');
    if (!taskId || !project || !tasks.length) return;

    const task = tasks.find((t: any) => t.id === taskId);
    if (task) {
      setSelectedTaskDetail(task);
      setTaskDetailInitialTab(tab === 'conversation' ? 'conversation' : 'details');
      setShowTaskDetailModal(true);
      setSearchParams({}, { replace: true }); // Clear URL params
    }
  }, [project, tasks, searchParams, setSearchParams]);

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

  // Task/content count per deliverable – highlights tabs that have work
  const deliverableTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!project?.deliverables) return counts;
    const deliverableTasks = tasks.filter((t: any) => t.type !== 'Onboarding' && t.type !== 'Intake');
    for (const d of project.deliverables) {
      const deliverableType = d.customType || d.type;
      const isCustom = d.type === 'Other' || !!d.customType;
      let count = 0;
      for (const t of deliverableTasks) {
        const linked = t.deliverableId === d.id;
        if (isCustom) {
          if (linked) count++;
        } else {
          if (linked) {
            count++;
          } else if (!t.deliverableId) {
            if (t.type === 'Copy' && ['Brand Book', 'Copy of Home Page', 'Speaker Kit', 'Other', 'Home Page'].includes(deliverableType)) count++;
            else if (t.type === 'Design' && ['Logo', 'Social Banners', 'Home Page', 'Brand Book'].includes(deliverableType)) count++;
            else if (t.type === 'Dev' && deliverableType === 'Home Page') count++;
          }
        }
      }
      // Deliverable has direct file submission (shows in Kanban even without tasks)
      if (d.fileUrl) count++;
      if (count > 0) counts[d.id] = count;
    }
    return counts;
  }, [project?.deliverables, tasks]);

  // Check for updates whenever tasks or deliverable history changes
  // Use a stable key to prevent unnecessary re-runs
  const tasksKey = useMemo(() => {
    return JSON.stringify(tasks.map((t: any) => ({ id: t.id, status: t.status, fileUrl: t.fileUrl })));
  }, [tasks]);
  
  useEffect(() => {
    // Only run if tasks actually changed (not just reference)
    if (tasksKey === previousTasksKeyRef.current) {
      return;
    }
    previousTasksKeyRef.current = tasksKey;
    
    if (id && project && deliverableHistory && Object.keys(deliverableHistory).length > 0) {
      checkForNewDeliverableUpdates(deliverableHistory, project, tasks, id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksKey, deliverableHistory, project?.deliverables]);

  // Check for updates when page becomes visible (user switches back to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && id && project && deliverableHistory && Object.keys(deliverableHistory).length > 0) {
        // Reload project data to get fresh timestamps
        const refreshCheck = async () => {
          try {
            const [freshProject, freshTasks] = await Promise.all([
              projectService.getOne(id),
              taskService.getByProject(id),
            ]);
            
            // Reload deliverable history
            const historyMap: Record<string, any[]> = {};
            if (freshProject?.deliverables) {
              for (const deliverable of freshProject.deliverables) {
                const deliverableHist = await deliverableService.getHistory(deliverable.id).catch(() => []);
                historyMap[deliverable.id] = deliverableHist || [];
              }
            }
            
            setDeliverableHistory(historyMap);
            checkForNewDeliverableUpdates(historyMap, freshProject, freshTasks, id);
          } catch (error) {
            console.error('Failed to refresh deliverable updates check:', error);
          }
        };
        refreshCheck();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, project, deliverableHistory]);

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
    // Load client updates when client-updates tab or overview tab is active (needed for Files/Links card)
    if ((activeTab === 'client-updates' || activeTab === 'overview') && id) {
      loadClientUpdates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id]);

  // Periodically check for new deliverable updates
  // Use tasksRef to avoid re-running when tasks array reference changes
  useEffect(() => {
    if (!id || !project?.deliverables) return;

    const checkForUpdates = async () => {
      try {
        const currentTasks = tasksRef.current;
        const allFileUrls = new Set<string>();
        currentTasks.forEach((task: any) => {
          if (task.fileUrl) allFileUrls.add(task.fileUrl);
        });
        const fileUrlsArray = Array.from(allFileUrls);

        const promises: Array<{ key: string; promise: Promise<any[]> }> = [];
        for (const deliverable of project.deliverables) {
          promises.push({
            key: deliverable.id,
            promise: deliverableService.getHistory(deliverable.id).catch(() => []),
          });
          for (const fileUrl of fileUrlsArray) {
            promises.push({
              key: `${deliverable.id}:${fileUrl}`,
              promise: deliverableService.getHistory(deliverable.id, fileUrl).catch(() => []),
            });
          }
        }

        const results = await Promise.all(promises.map((p) => p.promise));
        const historyMap: Record<string, any[]> = {};
        promises.forEach((p, i) => {
          historyMap[p.key] = results[i] || [];
        });

        setDeliverableHistory(historyMap);
        if (project) {
          checkForNewDeliverableUpdates(historyMap, project, currentTasks, id);
        }
      } catch (error) {
        console.error('Failed to check for deliverable updates:', error);
      }
    };

    // Check every 30 seconds (initial load handled by loadDeliverableHistoryInBackground)
    const interval = setInterval(checkForUpdates, 30000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, project?.deliverables?.length]); // Only depend on deliverables count, not tasks

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

  const loadClientUpdates = async () => {
    if (!id) return;
    try {
      setLoadingUpdates(true);
      const updates = await clientUpdatesService.getAllByProject(id);
      setClientUpdates(updates);
    } catch (error: any) {
      console.error('Failed to load client updates:', error);
      setClientUpdates([]);
    } finally {
      setLoadingUpdates(false);
    }
  };

  const handleCreateUpdate = async () => {
    if (!id) return;
    try {
      // Filter out empty links
      const validLinks = emailLinks.filter(link => link.trim() !== '');
      const update = await clientUpdatesService.create(id, emailNotes || undefined, validLinks.length > 0 ? validLinks : undefined);
      setClientUpdates([update, ...clientUpdates]);
      setShowCreateUpdateModal(false);
      // Reset form fields
      setEmailNotes('');
      setEmailLinks(['']);
    } catch (error: any) {
      console.error('Failed to create client update:', error);
      alert('Failed to create client update entry');
    }
  };

  const addEmailLink = () => {
    setEmailLinks([...emailLinks, '']);
  };

  const removeEmailLink = (index: number) => {
    const newLinks = emailLinks.filter((_, i) => i !== index);
    // Ensure at least one empty link field exists
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

  const handleCreateForm = async () => {
    if (!selectedUpdate) return;
    try {
      setCreatingForm(true);
      const form = await clientUpdatesService.createForm(selectedUpdate.id, formBlocks);
      setCurrentForm(form);
      setShowFormBuilder(true);
      // Reload updates to get the new form
      await loadClientUpdates();
    } catch (error: any) {
      console.error('Failed to create form:', error);
      alert('Failed to create form');
    } finally {
      setCreatingForm(false);
    }
  };

  const handlePublishForm = async () => {
    if (!currentForm) return;
    try {
      setPublishingForm(true);
      await clientUpdatesService.publishForm(currentForm.id);
      await loadClientUpdates();
      setShowFormBuilder(false);
      setCurrentForm(null);
      setFormBlocks([]);
      alert('Form published successfully! You can now share the URL with the client.');
    } catch (error: any) {
      console.error('Failed to publish form:', error);
      alert('Failed to publish form');
    } finally {
      setPublishingForm(false);
    }
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    try {
      // Pass projectId to organize files by client name in Cloudinary
      const url = await clientUpdatesService.uploadImage(file, id || undefined);
      return url;
    } catch (error: any) {
      console.error('Failed to upload image:', error);
      throw error;
    }
  };

  const addFormBlock = (type: FormBlock['type']) => {
    const newBlock: FormBlock = {
      id: `block-${Date.now()}-${Math.random()}`,
      type,
      ...(type === 'paragraph' && { content: '', bold: false }),
      ...(type === 'heading' && { content: '' }),
      ...(type === 'image' && { imageUrl: '', imageAlt: '' }),
      ...(type === 'text_with_image' && { text: '', imageUrl: '', imageAlt: '' }),
      ...(type === 'layout' && { layout: { columns: 2, blocks: [] } }),
    };
    setFormBlocks([...formBlocks, newBlock]);
  };

  const updateFormBlock = (blockId: string, updates: Partial<FormBlock>) => {
    setFormBlocks(formBlocks.map(block => 
      block.id === blockId ? { ...block, ...updates } : block
    ));
  };

  const removeFormBlock = (blockId: string) => {
    setFormBlocks(formBlocks.filter(block => block.id !== blockId));
  };

  const getFormUrl = (form: ClientUpdateForm) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/client-updates/forms/${form.publicToken}`;
  };

  const loadFormSubmissions = async (formId: string) => {
    if (formSubmissions[formId]) return; // Already loaded
    try {
      setLoadingSubmissions(prev => ({ ...prev, [formId]: true }));
      const submissions = await clientUpdatesService.getFormSubmissions(formId);
      setFormSubmissions(prev => ({ ...prev, [formId]: submissions }));
    } catch (error: any) {
      console.error('Failed to load form submissions:', error);
    } finally {
      setLoadingSubmissions(prev => ({ ...prev, [formId]: false }));
    }
  };

  const loadProject = async () => {
    try {
      const [projectData, tasksData] = await Promise.all([
        projectService.getOne(id!),
        taskService.getByProject(id!),
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
      tasksRef.current = tasksToUse; // Keep ref in sync
      
      // Store initial task statuses for change detection
      if (id && tasksToUse.length > 0) {
        const taskStatusKey = `tasks_last_seen_${id}`;
        const lastSeenTasks: Record<string, string> = {};
        tasksToUse.forEach((task: any) => {
          lastSeenTasks[`task_${task.id}_status`] = task.status;
        });
        localStorage.setItem(taskStatusKey, JSON.stringify(lastSeenTasks));
      }
      
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
      
      // Defer deliverable history loading – show UI immediately, load history in background
      if (projectData?.deliverables) {
        loadDeliverableHistoryInBackground(projectData, tasksToUse);
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

  // Load deliverable history in background (parallelized) – does not block initial render
  const loadDeliverableHistoryInBackground = async (projectData: any, tasksData: any[]) => {
    if (!projectData?.deliverables?.length || !id) return;
    try {
      const allFileUrls = new Set<string>();
      (tasksData || []).forEach((task: any) => {
        if (task?.fileUrl) allFileUrls.add(task.fileUrl);
      });
      const fileUrlsArray = Array.from(allFileUrls);

      // Build all promises in parallel (deliverable history + per-file history)
      const promises: Array<{ key: string; promise: Promise<any[]> }> = [];
      for (const deliverable of projectData.deliverables) {
        promises.push({
          key: deliverable.id,
          promise: deliverableService.getHistory(deliverable.id).catch(() => []),
        });
        for (const fileUrl of fileUrlsArray) {
          promises.push({
            key: `${deliverable.id}:${fileUrl}`,
            promise: deliverableService.getHistory(deliverable.id, fileUrl).catch(() => []),
          });
        }
      }

      const results = await Promise.all(promises.map((p) => p.promise));
      const historyMap: Record<string, any[]> = {};
      promises.forEach((p, i) => {
        historyMap[p.key] = results[i] || [];
      });

      setDeliverableHistory(historyMap);
      checkForNewDeliverableUpdates(historyMap, projectData, tasksData, id);
    } catch (err) {
      console.error('Failed to load deliverable history:', err);
    }
  };

  // Build activity list (same logic as Recent Activity panel)
  const buildActivityList = (historyMap: Record<string, any[]>, projectData: any, tasksData: any[]): any[] => {
    const allActivities: any[] = [];
    
    // Collect all deliverable activities from history
    Object.keys(historyMap).forEach((key) => {
      const history = historyMap[key];
      if (!history || !Array.isArray(history) || history.length === 0) return;
      
      // Extract deliverable info from the key
      const parts = key.split(':');
      const deliverableId = parts[0];
      const fileUrl = parts[1]; // May be undefined for general deliverable history
      
      // Try to find deliverable
      let deliverable = projectData?.deliverables?.find((d: any) => d.id === deliverableId);
      if (!deliverable) {
        deliverable = projectData?.deliverables?.find((d: any) => d.id === key);
      }
      
      if (!deliverable) return;
      
      // Get deliverable type
      const deliverableType = deliverable.customType || deliverable.type || 'Deliverable';
      
      // Process each history entry
      history.forEach((entry: any) => {
        const action = entry.action || entry.status || '';
        const actionLower = action.toLowerCase();
        
        // Check for important actions
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
            key: `${key}-${entry.id || entry.createdAt || Date.now()}`
          });
        }
      });
    });
    
    // Also add task activities (when tasks are updated/submitted)
    if (tasksData && tasksData.length > 0) {
      tasksData.forEach((task: any) => {
        // Only include tasks that have been updated recently or have fileUrl (submitted)
        if (task.fileUrl || task.status === 'In Review') {
          const deliverable = task.deliverableId 
            ? projectData?.deliverables?.find((d: any) => d.id === task.deliverableId)
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
    
    return allActivities;
  };

  // Check for new deliverable updates based on Recent Activity
  const checkForNewDeliverableUpdates = (historyMap: Record<string, any[]>, projectData: any, tasksData: any[], projectId: string) => {
    const storageKey = `deliverable_last_seen_${projectId}`;
    const lastSeenTimestamp = localStorage.getItem(storageKey);
    
    // Build the activity list (same as Recent Activity panel)
    const allActivities = buildActivityList(historyMap, projectData, tasksData);
    
    // Also check deliverable updatedAt timestamps directly (catches updates without history entries)
    const deliverableTimestamps: Date[] = [];
    if (projectData?.deliverables) {
      projectData.deliverables.forEach((deliverable: any) => {
        if (deliverable.updatedAt) {
          deliverableTimestamps.push(new Date(deliverable.updatedAt));
        }
      });
    }
    
    // Also check task updatedAt timestamps for tasks in review
    const taskTimestamps: Date[] = [];
    if (tasksData) {
      tasksData.forEach((task: any) => {
        if ((task.status === 'In Review' || task.fileUrl) && task.updatedAt) {
          taskTimestamps.push(new Date(task.updatedAt));
        }
      });
    }
    
    // Combine all timestamps and find the most recent
    const allTimestamps: Date[] = [];
    allActivities.forEach(activity => {
      if (activity.createdAt) {
        allTimestamps.push(new Date(activity.createdAt));
      }
    });
    allTimestamps.push(...deliverableTimestamps);
    allTimestamps.push(...taskTimestamps);
    
    // Get the most recent timestamp
    const mostRecentTimestamp = allTimestamps.length > 0 
      ? new Date(Math.max(...allTimestamps.map(d => d.getTime())))
      : null;
    
    console.log('[Deliverable Notification] Checking for updates:', {
      totalActivities: allActivities.length,
      deliverableTimestamps: deliverableTimestamps.length,
      taskTimestamps: taskTimestamps.length,
      lastSeenTimestamp,
      mostRecentTimestamp: mostRecentTimestamp?.toISOString(),
      mostRecentActivity: allActivities[0]?.createdAt
    });
    
    if (!mostRecentTimestamp) {
      setHasNewDeliverableUpdates(false);
      return;
    }
    
    if (!lastSeenTimestamp) {
      // First time viewing this project - don't set last seen yet
      // Only set it when user actually clicks on Deliverables tab
      // This way, if there's existing activity, it will show as new
      console.log('[Deliverable Notification] First visit - will set timestamp when user views Deliverables tab');
      
      // If there's any activity at all, show notification (user hasn't seen it yet)
      if (allActivities.length > 0 || deliverableTimestamps.length > 0 || taskTimestamps.length > 0) {
        setHasNewDeliverableUpdates(true);
        console.log('[Deliverable Notification] ✅ First visit with existing activity - showing notification');
      } else {
        setHasNewDeliverableUpdates(false);
      }
      return;
    }
    
    const lastSeen = new Date(lastSeenTimestamp);
    
    // Add a small buffer (5 seconds) to account for timing differences
    const bufferMs = 5000;
    const hasNewUpdates = mostRecentTimestamp.getTime() > (lastSeen.getTime() + bufferMs);
    
    console.log('[Deliverable Notification] Comparison:', {
      mostRecentTimestamp: mostRecentTimestamp.toISOString(),
      lastSeen: lastSeen.toISOString(),
      hasNewUpdates,
      timeDiff: mostRecentTimestamp.getTime() - lastSeen.getTime(),
      timeDiffSeconds: (mostRecentTimestamp.getTime() - lastSeen.getTime()) / 1000,
      bufferApplied: bufferMs
    });
    
    // Force update state
    setHasNewDeliverableUpdates(hasNewUpdates);
    
    // Also log the state change
    if (hasNewUpdates) {
      console.log('[Deliverable Notification] ✅ NEW UPDATES DETECTED - Badge should show!');
    } else {
      console.log('[Deliverable Notification] ❌ No new updates');
    }
  };

  // Clear notification when Deliverables tab is clicked
  const handleDeliverablesTabClick = () => {
    setActiveTab('deliverables');
    if (id) {
      // Update last seen timestamp to now (user has viewed the deliverables)
      const storageKey = `deliverable_last_seen_${id}`;
      localStorage.setItem(storageKey, new Date().toISOString());
      setHasNewDeliverableUpdates(false);
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
    const isPrivateClient = project.clientType === 'Private';
    
    const daysSinceEmail = getDaysSinceEmail();
    const intakeProgress = getIntakeProgress();
    
    // Private clients may not have onboarding requirements immediately.
    if (isPrivateClient) {
      return null;
    }

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
    if (deliverable.customType) {
      return deliverable.customType;
    }
    // Map backend enum values to display names
    const displayNameMap: Record<string, string> = {
      'Home Page': 'Home Page',
      'Copy of Home Page': 'Copy of Home Page',
      'Logo': 'Logo',
      'Brand Book': 'Brand Book',
      'Speaker Kit': 'Speaker Kit',
      'Social Banners': 'Social Banners',
      'Other': 'Other',
    };
    return displayNameMap[deliverable.type] || deliverable.type;
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

  const handleUpdateCustomDeliverable = async (deliverableId: string, newName: string) => {
    if (!newName.trim() || !project) return;

    try {
      await deliverableService.update(deliverableId, { customType: newName.trim() });
      
      // Reload project to get updated deliverables
      const updatedProject = await projectService.getOne(id!);
      setProject(updatedProject);
      
      setEditingDeliverableId(null);
      setEditingDeliverableName('');
      showToast('Deliverable updated ✓');
    } catch (error: any) {
      console.error('Failed to update custom deliverable:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update deliverable';
      console.error('Full error:', error);
      console.error('Error response:', error.response?.data);
      showToast(`Error: ${errorMessage}. The backend may not support updating deliverables.`);
    }
  };

  const handleDeleteCustomDeliverable = async (deliverableId: string) => {
    if (!project) return;

    try {
      await deliverableService.delete(deliverableId);
      
      // Reload project to get updated deliverables
      const updatedProject = await projectService.getOne(id!);
      setProject(updatedProject);
      
      // If the deleted deliverable was active, switch to first available deliverable
      if (activeDeliverableTab === deliverableId) {
        const remainingDeliverables = updatedProject.deliverables || [];
        if (remainingDeliverables.length > 0) {
          setActiveDeliverableTab(remainingDeliverables[0].id);
        } else {
          setActiveDeliverableTab(null);
        }
      }
      
      setShowDeleteDeliverableConfirm(null);
      showToast('Deliverable deleted ✓');
    } catch (error: any) {
      console.error('Failed to delete custom deliverable:', error);
      showToast(error.response?.data?.message || 'Failed to delete deliverable');
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

  const handleTaskStatusChange = async (taskId: string, newStatus: string, extraNotes?: string, extraAttachment?: string) => {
    try {
      // Map UI/kanban status to backend enum + optional column marker
      let backendStatus = newStatus;
      let columnLabel: string | null = null;

      switch (newStatus) {
        case 'not_started':
        case 'Todo':
          backendStatus = 'Todo';
          columnLabel = null;
          break;
        case 'owned_in_progress':
        case 'In Progress':
          backendStatus = 'In Progress';
          columnLabel = null;
          break;
        case 'for_approval':
          backendStatus = 'In Review';
          columnLabel = 'For Approval';
          break;
        case 'revision':
          backendStatus = 'In Review';
          columnLabel = 'Revision';
          break;
        case 'elliot_review':
          backendStatus = 'In Review';
          columnLabel = 'Elliot Review';
          break;
        case 'qa_before_client':
          backendStatus = 'In Review';
          columnLabel = 'QA Review';
          break;
        case 'approved_completed':
        case 'Completed':
          backendStatus = 'Completed';
          columnLabel = null;
          break;
        case 'client_validation':
          backendStatus = 'In Review';
          columnLabel = 'Client Validation';
          break;
        default:
          backendStatus = newStatus;
      }

      // Prepare deliverable context (for activity history)
      let deliverableId: string | undefined;
      let deliverableType: string | undefined;
      let fileUrl: string | undefined;

      // Update column marker in description to keep Kanban in sync
      // Use tasks state as fallback when project.tasks is not populated by the API
      if (project) {
        const task = (project.tasks && project.tasks.length > 0 ? project.tasks : tasks).find((t: any) => t.id === taskId);
        if (task) {
          fileUrl = task.fileUrl || undefined;
          deliverableId = task.deliverableId || undefined;
          if (deliverableId) {
            const deliverable = project.deliverables?.find((d: any) => d.id === deliverableId);
            if (deliverable) {
              deliverableType = deliverable.customType || deliverable.type;
            }
          }

          const currentDesc: string = task.description || '';
          const cleanedDesc = currentDesc.replace(/\n\n--- Column: [^-]+ ---/g, '');
          let updatedDesc = cleanedDesc;

          if (columnLabel) {
            const columnMarker = `\n\n--- Column: ${columnLabel} ---`;
            if (!cleanedDesc.includes(columnMarker)) {
              updatedDesc = cleanedDesc + columnMarker;
            }
          }

          // Append structured status-change log with notes/attachment (optional)
          if ((extraNotes && extraNotes.trim()) || (extraAttachment && extraAttachment.trim())) {
            const timestamp = new Date().toLocaleString();
            const statusLabelMap: Record<string, string> = {
              not_started: 'Not Yet Started',
              owned_in_progress: 'Owned/In Progress',
              for_approval: 'For Approval',
              revision: 'Revision',
              elliot_review: 'Elliot Review',
              approved_completed: 'Approved/Completed',
              qa_before_client: 'QA Before Sending to Client',
              client_validation: 'Client Validation',
            };
            const targetLabel = statusLabelMap[newStatus] || newStatus;
            let logBlock = `\n\n--- Status Change ---\nNew Column: ${targetLabel}\nBy: ${currentUser?.name || 'Unknown'}\nAt: ${timestamp}`;
            if (extraNotes && extraNotes.trim()) {
              logBlock += `\nNotes: ${extraNotes.trim()}`;
            }
            if (extraAttachment && extraAttachment.trim()) {
              logBlock += `\nAttachment: ${extraAttachment.trim()}`;
            }
            updatedDesc += logBlock;
          }

          if (updatedDesc !== currentDesc) {
            try {
              await taskService.update(taskId, { description: updatedDesc });
            } catch (descError) {
              console.warn('Failed to update task description with column marker:', descError);
            }
          }
        }
      }

      // For deliverable-linked tasks, also log into deliverable history so Activity History is populated
      if (project && deliverableId && fileUrl) {
        try {
          // Build notes for history entry
          const statusLabelMap: Record<string, string> = {
            not_started: 'Not Yet Started',
            owned_in_progress: 'Owned/In Progress',
            for_approval: 'For Approval',
            revision: 'Revision',
            elliot_review: 'Elliot Review',
            approved_completed: 'Approved/Completed',
            qa_before_client: 'QA Before Sending to Client',
            client_validation: 'Client Validation',
          };
          const targetLabel = statusLabelMap[newStatus] || newStatus;

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

          // Map column → deliverable status (align with Kanban drag/drop behavior)
          let deliverableStatus = (project.deliverables?.find((d: any) => d.id === deliverableId)?.status) || 'Not Started';
          switch (newStatus) {
            case 'revision':
              deliverableStatus = 'Revision';
              break;
            case 'elliot_review':
              // Elliot Review is a staging area while deliverable is ready for review
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
              // For approval generally means deliverable is ready for PM review
              deliverableStatus = 'Ready for Review';
              break;
            default:
              // leave as-is for not_started / owned_in_progress, etc.
              break;
          }

          await deliverableService.updateStatus(
            deliverableId,
            deliverableStatus,
            baseNote,
            fileUrl
          );
        } catch (historyError) {
          console.warn('Failed to record deliverable history for status change:', historyError);
          // Non-blocking – status update should still succeed
        }
      }

      const isCompleted = backendStatus === 'Completed';
      await taskService.updateStatus(taskId, backendStatus, isCompleted, fileUrl, deliverableType, deliverableId);
      await loadProject();
      showToast(`Task status updated ✓`);
    } catch (error) {
      console.error('Failed to update task status:', error);
      showToast('Failed to update task status');
    }
  };

  const handleSaveTaskTitle = async (taskId: string, newTitle: string) => {
    try {
      const task = tasks.find((t: any) => t.id === taskId);
      if (!task) return;

      const currentDesc = task.description || '';
      // Remove column markers and status change logs to get the base description
      let cleanedDesc = currentDesc
        .replace(/\n\n--- Column: [^-]+ ---/g, '')
        .replace(/\n\n--- Status Change ---[\s\S]*/g, '')
        .trim();

      // Split by newlines to preserve the rest of the description
      const lines = cleanedDesc.split('\n');
      const restOfDescription = lines.length > 1 ? '\n' + lines.slice(1).join('\n') : '';

      // Update the first line with the new title
      const updatedDescription = newTitle.trim() + restOfDescription;

      // Re-add column markers and status logs if they existed
      let finalDescription = updatedDescription;
      const columnMatch = currentDesc.match(/\n\n--- Column: [^-]+ ---/);
      if (columnMatch) {
        finalDescription += columnMatch[0];
      }
      const statusChangeMatch = currentDesc.match(/\n\n--- Status Change ---[\s\S]*/);
      if (statusChangeMatch) {
        finalDescription += statusChangeMatch[0];
      }

      await taskService.update(taskId, { description: finalDescription });
      await loadProject();
      setEditingTaskTitleId(null);
      setEditingTaskTitleValue('');
      showToast('Task title updated ✓');
    } catch (error) {
      console.error('Failed to update task title:', error);
      showToast('Failed to update task title');
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
        status: markTaskCompleteOnCreate ? 'Completed' : 'Todo',
        isCompleted: markTaskCompleteOnCreate,
        deliverableId: selectedDeliverableForTask,
      };

      if (newTaskData.assignedToId) {
        taskData.assignedToId = newTaskData.assignedToId;
      }

      if (newTaskData.dueDate) {
        taskData.dueDate = new Date(newTaskData.dueDate);
      }

      // If the user attached links or uploaded files, include them on the task
      const links = newTaskLinks.filter((link) => link.trim() !== '');
      const allAttachmentUrls = [...links, ...newTaskFileUrls];
      if (allAttachmentUrls.length > 0) {
        // Append attachments block to description so all URLs are visible & clickable
        const attachmentsBlock =
          '\n\n--- Attachments ---\n' + allAttachmentUrls.join('\n');
        taskData.description = (taskData.description || '') + attachmentsBlock;

        // Keep first URL as primary fileUrl for backward compatibility
        taskData.fileUrl = allAttachmentUrls[0];
      }

      await taskService.create(taskData);
      showToast('Task created successfully ✓');
      await loadProject();
      setShowAddTaskFromDeliverableModal(false);
      setSelectedDeliverableForTask(null);
      setNewTaskData({ department: '', notes: '', assignedToId: '', dueDate: '' });
      setNewTaskLinks(['']);
      setNewTaskFileUrls([]);
      setMarkTaskCompleteOnCreate(false);
    } catch (error: any) {
      console.error('Failed to create task:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      showToast(`Failed to create task: ${errorMessage}`);
    } finally {
      setCreatingTask(false);
    }
  };

  // Assign deliverable to task
  const handleAssignDeliverableToTask = async () => {
    if (!taskToAssign || !id || !project) return;

    try {
      setAssigningDeliverable(true);
      let deliverableId = selectedDeliverableId;

      // If creating custom deliverable
      if (useCustomDeliverable && newCustomDeliverableName.trim()) {
        const newDeliverable = await deliverableService.create(
          project.id,
          'Other',
          newCustomDeliverableName.trim()
        );
        deliverableId = newDeliverable.id;
        
        // Reload project to get updated deliverables
        const updatedProject = await projectService.getOne(id);
        setProject(updatedProject);
      }

      // Update task with deliverableId
      if (deliverableId) {
        await taskService.update(taskToAssign.id, {
          deliverableId: deliverableId,
        });
        
        // Reload project to refresh tasks
        await loadProject();
        showToast('Task assigned to deliverable ✓');
        
        // Close modal and reset state
        setShowAssignDeliverableModal(false);
        setTaskToAssign(null);
        setSelectedDeliverableId('');
        setNewCustomDeliverableName('');
        setUseCustomDeliverable(false);
      }
    } catch (error: any) {
      console.error('Failed to assign deliverable:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      showToast(`Failed to assign deliverable: ${errorMessage}`);
    } finally {
      setAssigningDeliverable(false);
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
      
      // Check if this was a Home Page design approval - if so, show special message
      const isDesignFile = fileUrl.includes('figma.com') || fileUrl.includes('figma');
      if (deliverableType === 'Home Page' && isDesignFile) {
        showToast('Home Page design approved ✓ - Project moved to Development');
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

  const copyTaskLink = async (task: any) => {
    if (!task?.id || !task?.projectId) {
      showToast('Unable to copy task link');
      return;
    }
    const taskUrl = `${window.location.origin}/project/${task.projectId}?task=${task.id}&tab=details`;
    try {
      await navigator.clipboard.writeText(taskUrl);
      showToast('Task link copied ✓');
    } catch (error) {
      console.error('Failed to copy task link:', error);
      showToast('Failed to copy task link');
    }
  };

  // Collect all files/links with detailed information
  const getAllFilesAndLinks = useMemo(() => {
    // Helper to normalize URLs (ensure they have https:// protocol)
    const normalizeUrl = (url: string): string => {
      if (!url) return url;
      // If URL already has protocol, return as-is
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      // If it's a Cloudinary URL (starts with res.cloudinary.com), add https://
      if (url.startsWith('res.cloudinary.com') || url.includes('cloudinary.com')) {
        return `https://${url}`;
      }
      // For other URLs, try to add https://
      return `https://${url}`;
    };

    const allLinks: Array<{
      id: string;
      url: string;
      source: string;
      sourceType: 'Task' | 'Email Log';
      date?: Date;
      taskTitle?: string;
      taskId?: string;
      taskType?: string;
      assignedTo?: { name: string; id: string };
      pmName?: string;
      updateId?: string;
      notes?: string;
    }> = [];
    
    // Get links from tasks (fileUrl)
    tasks.forEach((task: any) => {
      if (task.fileUrl) {
        allLinks.push({
          id: `task-${task.id}`,
          url: normalizeUrl(task.fileUrl),
          source: task.title || 'Task',
          sourceType: 'Task',
          date: task.updatedAt ? new Date(task.updatedAt) : task.createdAt ? new Date(task.createdAt) : undefined,
          taskTitle: task.title,
          taskId: task.id,
          taskType: task.type,
          assignedTo: task.assignedTo ? { name: task.assignedTo.name, id: task.assignedTo.id } : undefined
        });
      }
    });
    
    // Get links from client updates (email logs)
    clientUpdates.forEach((update: any) => {
      if (update.links && Array.isArray(update.links) && update.links.length > 0) {
        update.links.forEach((link: string, linkIndex: number) => {
          if (link && link.trim()) {
            allLinks.push({
              id: `update-${update.id}-${linkIndex}`,
              url: normalizeUrl(link.trim()),
              source: `Email Log - ${update.pm?.name || 'PM'}`,
              sourceType: 'Email Log',
              date: update.emailSentAt ? new Date(update.emailSentAt) : update.createdAt ? new Date(update.createdAt) : undefined,
              pmName: update.pm?.name,
              updateId: update.id,
              notes: update.notes
            });
          }
        });
      }
    });
    
    // Sort by date (newest first)
    allLinks.sort((a, b) => {
      const dateA = a.date?.getTime() || 0;
      const dateB = b.date?.getTime() || 0;
      return dateB - dateA;
    });
    
    return allLinks;
  }, [tasks, clientUpdates]);

  const getClientTypeColor = (clientType: string) => {
    switch (clientType) {
      case 'ICON': return { bg: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', color: 'white' };
      case 'STAR': return { bg: '#a855f7', color: 'white' };
      case 'Katalyst': return { bg: '#667eea', color: 'white' };
      case 'Private': return { bg: '#64748b', color: 'white' };
      case 'Premium': return { bg: '#8b5cf6', color: 'white' };
      case 'Powered-Up': return { bg: '#a855f7', color: 'white' };
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
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <AppSidebar />
        <div className="project-detail premium-project-detail" style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        <div className="project-detail-skeleton">
          <div className="skeleton-summary-bar">
            <div className="skeleton-back"></div>
            <div className="skeleton-title"></div>
            <div className="skeleton-badges">
              <span className="skeleton-badge"></span>
              <span className="skeleton-badge"></span>
              <span className="skeleton-badge"></span>
            </div>
            <div className="skeleton-stats">
              <div className="skeleton-stat"></div>
              <div className="skeleton-stat"></div>
              <div className="skeleton-stat"></div>
            </div>
          </div>
          <div className="skeleton-tabs">
            <span className="skeleton-tab"></span>
            <span className="skeleton-tab"></span>
            <span className="skeleton-tab"></span>
            <span className="skeleton-tab"></span>
            <span className="skeleton-tab"></span>
          </div>
          <div className="skeleton-content-grid">
            <div className="skeleton-card"></div>
            <div className="skeleton-card"></div>
            <div className="skeleton-card skeleton-card-wide"></div>
          </div>
          <div className="skeleton-loading-text">
            <span className="skeleton-pulse-dot"></span>
            Loading project...
          </div>
        </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <AppSidebar />
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
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
        </div>
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
  const shouldShowProjectReminderForm = projectMonthlyReminders.length > 0 || showProjectReminderForm;
  const isPrivateClient = project.clientType === 'Private';
  const associatedLinkRaw = (project.associatedLink || '').trim();
  const associatedLinkHref = associatedLinkRaw
    ? (/^https?:\/\//i.test(associatedLinkRaw) ? associatedLinkRaw : `https://${associatedLinkRaw}`)
    : '';
  const deliverablesForDisplay = isPrivateClient
    ? (project.deliverables || []).filter((deliverable: any) => {
        const isCustomDeliverable = deliverable.type === 'Other' || !!deliverable.customType;
        if (isCustomDeliverable) return true;
        return tasks.some((task: any) => task.deliverableId === deliverable.id);
      })
    : (project.deliverables || []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AppSidebar />
      <div className="project-detail premium-project-detail" style={{ flex: 1, minWidth: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Premium Header Bar */}
      <div className="project-summary-bar">
        <div className="summary-bar-content">
          <button onClick={() => navigate('/dashboard')} className="back-button-premium">
            <FaArrowLeft /> Back to Dashboard
          </button>
          
          <div className="summary-main">
            <div className="summary-left">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h1 className="project-title-premium" style={{ margin: 0 }}>{project.clientName}</h1>
                  <button
                    onClick={() => setShowEditProjectModal(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      color: '#64748b',
                      transition: 'all 0.2s'
                    }}
                    title="Edit project details"
                  >
                    <FaEdit style={{ fontSize: '0.875rem' }} />
                  </button>
                </div>
                <div style={{ marginTop: '0.25rem', width: '100%' }}>
                  {associatedLinkRaw ? (
                    <a
                      href={associatedLinkHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.84rem',
                        color: '#4f46e5',
                        textDecoration: 'none',
                        fontWeight: 500,
                        maxWidth: '100%',
                      }}
                      title={associatedLinkRaw}
                    >
                      <FaLink style={{ fontSize: '0.75rem' }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '50ch' }}>
                        {associatedLinkRaw}
                      </span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowEditProjectModal(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        margin: 0,
                        color: '#64748b',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      + Add project link
                    </button>
                  )}
                </div>
                <div className="project-meta-badges">
                  <span 
                    className="client-badge-premium"
                    style={{ background: clientTypeStyle.bg, color: clientTypeStyle.color }}
                  >
                    {project.clientType}
                  </span>
                  {project.secondaryClientTypes && (
                    <>
                      {(() => {
                        // Handle both array and comma-separated string formats
                        const secondaryTypes = Array.isArray(project.secondaryClientTypes)
                          ? project.secondaryClientTypes
                          : typeof project.secondaryClientTypes === 'string'
                          ? project.secondaryClientTypes.split(',').map((t: string) => t.trim()).filter((t: string) => !!t)
                          : [];
                        
                        return secondaryTypes.map((secondaryType: string, idx: number) => {
                          const secondaryStyle = getClientTypeColor(secondaryType);
                          return (
                            <span 
                              key={idx}
                              className="client-badge-premium"
                              style={{ 
                                background: secondaryStyle.bg, 
                                color: secondaryStyle.color,
                                opacity: 0.9
                              }}
                              title="Secondary Client Type"
                            >
                              {secondaryType}
                            </span>
                          );
                        });
                      })()}
                    </>
                  )}
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
                {nextAction && (
                  <div
                    style={{
                      marginTop: '0.55rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.38rem 0.68rem',
                      borderRadius: '999px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      color: '#334155',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      maxWidth: 'min(100%, 720px)',
                    }}
                  >
                    <FaExclamationTriangle style={{ color: '#f59e0b', fontSize: '0.74rem', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nextAction}
                    </span>
                  </div>
                )}
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
              {/* <button className="btn-primary-action">
                <FaPaperPlane /> Send Update
              </button> */}
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

      {(projectRegistryMeta?.comments || projectRegistryMeta?.pmPriority) && (
        <div style={{
          maxWidth: '1600px',
          margin: '0.6rem auto 0',
          padding: '0 2rem',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '0.85rem 1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem' }}>
              <FaStickyNote style={{ color: '#1d4ed8' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e3a8a' }}>PM List Notes</span>
              {projectRegistryMeta?.pmPriority && (
                <span style={{
                  marginLeft: 6,
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  borderRadius: 999,
                  padding: '0.12rem 0.45rem',
                  background: projectRegistryMeta.pmPriority === 'Hot Potato' ? '#fee2e2' : '#e2e8f0',
                  color: projectRegistryMeta.pmPriority === 'Hot Potato' ? '#b91c1c' : '#334155',
                }}>
                  {projectRegistryMeta.pmPriority}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {projectRegistryMeta?.comments || '—'}
            </div>
          </div>
        </div>
      )}

      {canViewMonthlyReminders && (
        <div style={{
          maxWidth: '1600px',
          margin: '0.85rem auto 0',
          padding: '0 2rem',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 42%, #ffffff 100%)',
            border: '1px solid #bfdbfe',
            borderRadius: 16,
            padding: '1rem',
            boxShadow: '0 8px 20px rgba(37, 99, 235, 0.09)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.85rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: '#1e3a8a', fontWeight: 800 }}>
                <span style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: '#dbeafe',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #93c5fd',
                }}>
                  <FaStickyNote />
                </span>
                <span>
                  Monthly Reminder
                </span>
              </div>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#1d4ed8',
                background: '#dbeafe',
                borderRadius: 999,
                border: '1px solid #93c5fd',
                padding: '0.18rem 0.52rem',
              }}>
                {projectMonthlyReminders.length} linked note{projectMonthlyReminders.length !== 1 ? 's' : ''}
              </span>
            </div>

            {!loadingProjectMonthlyReminders && !shouldShowProjectReminderForm && (
              <div style={{ marginTop: '0.72rem' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setShowProjectReminderForm(true)}
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '0.48rem 0.74rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Add note
                </button>
              </div>
            )}

            {shouldShowProjectReminderForm && (
              <div style={{
                marginTop: '0.75rem',
                background: '#ffffff',
                border: '1px solid #dbeafe',
                borderRadius: 12,
                padding: '0.75rem',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: '0.55rem', alignItems: 'start' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', marginBottom: 4 }}>
                      Reminder Day
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={projectReminderForm.reminderDay}
                      onChange={(e) => setProjectReminderForm((prev) => ({ ...prev, reminderDay: e.target.value }))}
                      className="form-input"
                      style={{ width: '100%', padding: '0.5rem 0.55rem', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: '0.82rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', marginBottom: 4 }}>
                      Note
                    </label>
                    <textarea
                      value={projectReminderForm.note}
                      onChange={(e) => setProjectReminderForm((prev) => ({ ...prev, note: e.target.value }))}
                      rows={2}
                      placeholder="Ex: Monthly report on day 24 - 10 articles + GA report"
                      className="form-input"
                      style={{ width: '100%', minHeight: 66, padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: '0.82rem', resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ alignSelf: 'end', display: 'flex', gap: 8 }}>
                    {projectMonthlyReminders.length === 0 && (
                      <button
                        type="button"
                        onClick={() => setShowProjectReminderForm(false)}
                        className="btn-primary"
                        style={{
                          background: '#e2e8f0',
                          color: '#334155',
                          border: 'none',
                          borderRadius: 8,
                          padding: '0.5rem 0.72rem',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCreateProjectMonthlyReminder}
                      disabled={savingProjectMonthlyReminder}
                      className="btn-primary"
                      style={{
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '0.5rem 0.72rem',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: savingProjectMonthlyReminder ? 'not-allowed' : 'pointer',
                        opacity: savingProjectMonthlyReminder ? 0.65 : 1,
                        minWidth: 108,
                      }}
                    >
                      {savingProjectMonthlyReminder ? 'Saving...' : 'Add note'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loadingProjectMonthlyReminders && (
              <div style={{ marginTop: '0.62rem', fontSize: '0.82rem', color: '#1d4ed8' }}>
                Loading monthly reminders...
              </div>
            )}
            {!loadingProjectMonthlyReminders && projectMonthlyReminders.length === 0 && (
              <div style={{ marginTop: '0.62rem', fontSize: '0.82rem', color: '#475569' }}>
                No monthly reminders linked to this client yet.
              </div>
            )}
            {!loadingProjectMonthlyReminders && projectMonthlyReminders.length > 0 && (
              <div style={{ marginTop: '0.7rem', display: 'grid', gap: '0.45rem' }}>
                {projectMonthlyReminders.map((item) => (
                  <div key={item.id} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    background: '#ffffff',
                    border: '1px solid #bfdbfe',
                    borderRadius: 10,
                    padding: '0.52rem 0.62rem',
                  }}>
                    <span style={{
                      fontSize: '0.72rem',
                      borderRadius: 999,
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      color: '#fff',
                      fontWeight: 700,
                      padding: '0.14rem 0.42rem',
                      flexShrink: 0,
                    }}>
                      Day {item.reminderDay}
                    </span>
                    <div style={{ display: 'grid', gap: '0.2rem' }}>
                      <span style={{ fontSize: '0.82rem', color: '#334155', whiteSpace: 'pre-wrap' }}>
                        {item.note}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        Updated {new Date(item.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
          onClick={handleDeliverablesTabClick}
          style={{ position: 'relative' }}
        >
          <FaBox className="tab-icon" />
          Deliverables
          {hasNewDeliverableUpdates && (
            <span
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                minWidth: '18px',
                height: '18px',
                borderRadius: '9px',
                backgroundColor: '#ef4444',
                border: '2px solid white',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
                fontSize: '10px',
                fontWeight: 'bold',
                color: 'white',
                zIndex: 1000,
                animation: 'pulse 2s infinite',
                pointerEvents: 'none',
              }}
              title="New activity available"
            >
              !
            </span>
          )}
          {/* Debug: Show badge state */}
          {process.env.NODE_ENV === 'development' && (
            <span style={{ fontSize: '10px', color: '#999', marginLeft: '4px' }}>
              [{hasNewDeliverableUpdates ? 'NEW' : 'OK'}]
            </span>
          )}
        </button>
        <button
          className={`tab-item ${activeTab === 'unassigned-tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('unassigned-tasks')}
        >
          <FaClipboard className="tab-icon" />
          Unassigned Tasks
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
          Branding Documents
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
        <button
          className={`tab-item ${activeTab === 'client-updates' ? 'active' : ''}`}
          onClick={() => setActiveTab('client-updates')}
        >
          <FaEnvelopeOpen className="tab-icon" />
          Client Updates
        </button>
        
      </div>

      {/* Tab Content with Fade Animation */}
      <div className={`project-content tab-content-wrapper ${activeTab}`}>
        {activeTab === 'overview' && (
          <ProjectOverviewTab
            project={project}
            daysInStage={daysInStage}
            deliverableHistory={deliverableHistory}
            tasks={tasks}
            setActiveTab={setActiveTab}
            setActiveDeliverableTab={setActiveDeliverableTab}
            setShowFilesLinksModal={setShowFilesLinksModal}
            getAllFilesAndLinks={getAllFilesAndLinks}
            handleTaskComplete={handleTaskComplete}
            handleCloseProject={handleCloseProject}
          />
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
                  .filter((task) => task.type === 'Onboarding' || task.type === 'Intake')
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
                <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Branding Documents</h3>
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
              {tasks.filter((t) => (t.type === 'Onboarding' || t.type === 'Intake') && t.isCompleted && t.submissionData).length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  <FaFileAlt style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }} />
                  <p>No Branding Documents submitted yet.</p>
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
                    .filter((t) => (t.type === 'Onboarding' || t.type === 'Intake') && t.isCompleted && t.submissionData)
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
          <ProjectDeliverablesTab
            {...{
              authService,
              deliverablesForDisplay,
              editingDeliverableId,
              editingDeliverableName,
              setEditingDeliverableName,
              handleUpdateCustomDeliverable,
              setEditingDeliverableId,
              activeDeliverableTab,
              setActiveDeliverableTab,
              deliverableTaskCounts,
              getDeliverableDisplayName,
              canAssignOwners,
              setShowDeleteDeliverableConfirm,
              isPrivateClient,
              setShowAddDeliverableModal,
              tasks,
              deliverableHistory,
              setDeliverableHistory,
              setDraggedFile,
              dragOverColumn,
              setDragOverColumn,
              draggedFile,
              deliverableService,
              showToast,
              loadProject,
              setRevisionDeliverable,
              setRevisionNotes,
              setRevisionAttachment,
              setShowRevisionConfirm,
              setStatusChangeContext,
              setStatusChangeNotes,
              setStatusChangeAttachment,
              setShowStatusChangeModal,
              handleTaskStatusChange,
              setSelectedDeliverableForTask,
              setNewTaskData,
              setNewTaskLinks,
              setNewTaskFileUrls,
              setShowAddTaskFromDeliverableModal,
              allUsers,
              deliverableTeamMembers,
              currentUser,
              setSelectedTaskDetail,
              setShowTaskDetailModal,
              editingTaskTitleId,
              editingTaskTitleValue,
              setEditingTaskTitleValue,
              handleSaveTaskTitle,
              setEditingTaskTitleId,
              project,
              handleRemoveDeliverableTeamMember,
              setSelectedDeliverableForTeam,
              setShowAddDeliverableTeamMemberModal,
              copyTaskLink,
              handleApproveFile,
              updatingDeliverable,
              handleRequestRevisionClick,
              handleApproveDeliverable,
            }}
          />
        )}

        {activeTab === 'unassigned-tasks' && (
          <div className="tab-content fade-in">
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <h2 style={{ color: '#1e293b', fontSize: '1.25rem', fontWeight: 600, margin: 0, marginBottom: '0.25rem' }}>
                  Tasks Without Deliverables
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.8125rem', margin: 0 }}>
                  Assign tasks to deliverables or create custom ones
                </p>
              </div>

              {(() => {
                // Filter tasks that don't have a deliverableId
                const unassignedTasks = tasks.filter((task: any) => !task.deliverableId && task.type !== 'Onboarding');
                
                if (unassignedTasks.length === 0) {
                  return (
                    <div style={{
                      background: '#f9fafb',
                      borderRadius: '8px',
                      padding: '2rem',
                      border: '1px solid #e5e7eb',
                      textAlign: 'center'
                    }}>
                      <FaClipboard style={{ fontSize: '2.5rem', color: '#94a3b8', marginBottom: '0.75rem' }} />
                      <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: '1.5', margin: 0 }}>
                        All tasks are connected to deliverables.
                      </p>
                    </div>
                  );
                }

                // Group tasks by type/department
                const tasksByType: Record<string, any[]> = {};
                unassignedTasks.forEach((task: any) => {
                  const type = task.type || 'General';
                  if (!tasksByType[type]) {
                    tasksByType[type] = [];
                  }
                  tasksByType[type].push(task);
                });

                const getTypeColor = (type: string) => {
                  const colors: Record<string, string> = {
                    'Copy': '#3b82f6',
                    'Design': '#8b5cf6',
                    'Dev': '#10b981',
                    'AI': '#10b981',
                    'CRM': '#6366f1',
                    'Social Media': '#ec4899',
                    'SEO/GEO': '#06b6d4',
                    'General': '#6b7280',
                  };
                  return colors[type] || '#6b7280';
                };

                const getStatusColor = (status: string, isCompleted: boolean) => {
                  if (isCompleted) return { bg: '#d1fae5', color: '#065f46' };
                  switch (status) {
                    case 'In Progress': return { bg: '#dbeafe', color: '#1e40af' };
                    case 'In Review': return { bg: '#fef3c7', color: '#92400e' };
                    case 'Blocked': return { bg: '#fee2e2', color: '#991b1b' };
                    case 'Completed': return { bg: '#d1fae5', color: '#065f46' };
                    default: return { bg: '#f3f4f6', color: '#6b7280' };
                  }
                };

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {Object.entries(tasksByType).map(([type, typeTasks]) => (
                      <div
                        key={type}
                        style={{
                          background: 'white',
                          borderRadius: '8px',
                          padding: '1rem',
                          border: '1px solid #e5e7eb',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <div
                            style={{
                              width: '3px',
                              height: '18px',
                              borderRadius: '2px',
                              backgroundColor: getTypeColor(type),
                            }}
                          />
                          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>
                            {type} ({typeTasks.length})
                          </h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {typeTasks.map((task: any) => {
                            const statusStyle = getStatusColor(task.status, task.isCompleted);
                            return (
                              <div
                                key={task.id}
                                style={{
                                  padding: '0.75rem',
                                  background: '#fafbfc',
                                  borderRadius: '6px',
                                  border: '1px solid #e5e7eb',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: '0.75rem',
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#f8f9fa';
                                  e.currentTarget.style.borderColor = '#d1d5db';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = '#fafbfc';
                                  e.currentTarget.style.borderColor = '#e5e7eb';
                                }}
                              >
                                <div 
                                  style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                                  onClick={() => {
                                    setSelectedTaskDetail(task);
                                    setShowTaskDetailModal(true);
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                                    <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {task.title}
                                    </h4>
                                    <span
                                      style={{
                                        padding: '0.125rem 0.5rem',
                                        borderRadius: '10px',
                                        fontSize: '0.6875rem',
                                        fontWeight: 500,
                                        background: statusStyle.bg,
                                        color: statusStyle.color,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {task.isCompleted ? 'Done' : task.status || 'Todo'}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.375rem' }}>
                                    {project.pm?.name && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: '#64748b' }}>
                                        <FaUser style={{ fontSize: '0.625rem' }} />
                                        <span>PM: {project.pm.name}</span>
                                      </div>
                                    )}
                                    {(() => {
                                      const assignees = task.assignees || [];
                                      const assigneeIds = assignees.length > 0
                                        ? assignees.map((a: any) => a.userId || a.user?.id)
                                        : (task.assignedToId ? [task.assignedToId] : []);
                                      if (assigneeIds.length === 0) return null;
                                      const primaryId = assigneeIds[0];
                                      const primaryName = (allUsers.find((u: any) => u.id === primaryId)?.name) || task.assignedTo?.name || 'Unassigned';
                                      return (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: '#64748b' }}>
                                          <FaUser style={{ fontSize: '0.625rem' }} />
                                          <span>{primaryName}</span>
                                        </div>
                                      );
                                    })()}
                                    {task.dueDate && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: '#64748b' }}>
                                        <FaClock style={{ fontSize: '0.625rem' }} />
                                        <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                                      </div>
                                    )}
                                    {task.fileUrl && (
                                      <a
                                        href={task.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.375rem',
                                          fontSize: '0.75rem',
                                          color: '#667eea',
                                          textDecoration: 'none',
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                        onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                      >
                                        <FaLink style={{ fontSize: '0.625rem' }} />
                                        <span>File</span>
                                      </a>
                                    )}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                                  <button
                                    onClick={() => copyTaskLink(task)}
                                    style={{
                                      background: 'transparent',
                                      border: '1px solid #e5e7eb',
                                      borderRadius: '6px',
                                      padding: '0.375rem 0.625rem',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#6b7280',
                                      fontSize: '0.75rem',
                                      fontWeight: 500,
                                      transition: 'all 0.2s',
                                      gap: '0.25rem',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#f3f4f6';
                                      e.currentTarget.style.borderColor = '#d1d5db';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'transparent';
                                      e.currentTarget.style.borderColor = '#e5e7eb';
                                    }}
                                    title="Copy task link"
                                  >
                                    <FaCopy style={{ fontSize: '0.625rem' }} />
                                    Link
                                  </button>
                                  <button
                                    onClick={() => {
                                      setTaskToAssign(task);
                                      setSelectedDeliverableId('');
                                      setNewCustomDeliverableName('');
                                      setUseCustomDeliverable(false);
                                      setShowAssignDeliverableModal(true);
                                    }}
                                    style={{
                                      background: '#667eea',
                                      border: 'none',
                                      borderRadius: '6px',
                                      padding: '0.375rem 0.625rem',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: 'white',
                                      fontSize: '0.75rem',
                                      fontWeight: 500,
                                      transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#5568d3';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = '#667eea';
                                    }}
                                    title="Assign to deliverable"
                                  >
                                    <FaEdit style={{ fontSize: '0.625rem', marginRight: '0.25rem' }} />
                                    Assign
                                  </button>
                                  <button
                                    onClick={() => handleTaskComplete(task.id, !task.isCompleted)}
                                    style={{
                                      background: 'transparent',
                                      border: '1px solid #e5e7eb',
                                      borderRadius: '6px',
                                      padding: '0.375rem',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: task.isCompleted ? '#10b981' : '#6b7280',
                                      transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#f3f4f6';
                                      e.currentTarget.style.borderColor = '#d1d5db';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'transparent';
                                      e.currentTarget.style.borderColor = '#e5e7eb';
                                    }}
                                    title={task.isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
                                  >
                                    {task.isCompleted ? <FaCheckCircle style={{ fontSize: '0.75rem' }} /> : <FaCircle style={{ fontSize: '0.75rem' }} />}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
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
                          <span>Home Page Revisions</span>
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

        {activeTab === 'client-updates' && (
          <div className="tab-content fade-in">
            <div style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ color: '#1e293b', fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>
                  Client Updates
                </h2>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => setShowCreateUpdateModal(true)}
                    style={{
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      padding: '0.625rem 1.25rem',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#5568d3';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#667eea';
                    }}
                  >
                    <FaPlus /> Log Email Sent
                  </button>
                  <button
                    onClick={async () => {
                      if (!id) return;
                      try {
                        let updateToUse: ClientUpdate | null = null;
                        
                        // Check if there's an existing update we can use
                        if (clientUpdates.length > 0) {
                          // Use the most recent update
                          updateToUse = clientUpdates[0];
                        } else {
                          // Create a new update entry silently in the background
                          updateToUse = await clientUpdatesService.create(id);
                          setClientUpdates([updateToUse]);
                        }
                        
                        // Navigate to form builder page
                        navigate(`/project/${id}/form-builder/${updateToUse.id}`);
                      } catch (error: any) {
                        console.error('Failed to generate form:', error);
                        alert('Failed to generate form. Please try again.');
                      }
                    }}
                    style={{
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      padding: '0.625rem 1.25rem',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#059669';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#10b981';
                    }}
                  >
                    <FaFileAlt /> Generate Form
                  </button>
                </div>
              </div>

              {loadingUpdates ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  Loading client updates...
                </div>
              ) : clientUpdates.length === 0 ? (
                <div style={{
                  background: '#f9fafb',
                  borderRadius: '12px',
                  padding: '3rem',
                  border: '1px solid #e5e7eb',
                  textAlign: 'center'
                }}>
                  <FaEnvelopeOpen style={{ fontSize: '3rem', color: '#94a3b8', marginBottom: '1rem' }} />
                  <p style={{ color: '#64748b', fontSize: '0.9375rem', lineHeight: '1.6' }}>
                    No client updates yet. Click "Log Email Sent" to create your first entry.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {clientUpdates.map((update) => (
                    <div
                      key={update.id}
                      style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <FaEnvelope style={{ color: '#667eea' }} />
                            <span style={{ fontWeight: 600, color: '#1e293b' }}>
                              Email sent by {update.pm?.name || 'PM'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                            {new Date(update.emailSentAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div style={{ marginTop: '0.5rem' }}>
                            <span
                              style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                background: update.status === 'responded' ? '#d1fae5' : update.status === 'published' ? '#dbeafe' : '#f3f4f6',
                                color: update.status === 'responded' ? '#065f46' : update.status === 'published' ? '#1e40af' : '#374151',
                              }}
                            >
                              {update.status.charAt(0).toUpperCase() + update.status.slice(1)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {(update.notes || (update.links && update.links.length > 0)) && (
                        <div style={{ 
                          marginTop: '1rem', 
                          paddingTop: '1rem', 
                          borderTop: '1px solid #e5e7eb' 
                        }}>
                          {update.notes && (
                            <div style={{ marginBottom: (update.links && update.links.length > 0) ? '0.75rem' : '0' }}>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'flex-start', 
                                gap: '0.5rem',
                                marginBottom: '0.5rem'
                              }}>
                                <FaStickyNote style={{ 
                                  color: '#f59e0b', 
                                  fontSize: '0.875rem', 
                                  marginTop: '0.125rem',
                                  flexShrink: 0
                                }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ 
                                    fontSize: '0.75rem', 
                                    fontWeight: 500, 
                                    color: '#64748b',
                                    marginBottom: '0.25rem'
                                  }}>
                                    Notes:
                                  </div>
                                  <div style={{ 
                                    color: '#374151', 
                                    fontSize: '0.875rem',
                                    lineHeight: '1.5',
                                    whiteSpace: 'pre-wrap'
                                  }}>
                                    {update.notes}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          {update.links && update.links.length > 0 && (
                            <div>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.5rem',
                                marginBottom: '0.5rem'
                              }}>
                                <FaLink style={{ 
                                  color: '#667eea', 
                                  fontSize: '0.875rem',
                                  flexShrink: 0
                                }} />
                                <div style={{ 
                                  fontSize: '0.75rem', 
                                  fontWeight: 500, 
                                  color: '#64748b'
                                }}>
                                  Links:
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {update.links.map((link, linkIndex) => (
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
                                      display: 'inline-block',
                                      maxWidth: '100%',
                                      padding: '0.5rem',
                                      background: '#f9fafb',
                                      borderRadius: '6px',
                                      border: '1px solid #e5e7eb',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.textDecoration = 'underline';
                                      e.currentTarget.style.background = '#f3f4f6';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.textDecoration = 'none';
                                      e.currentTarget.style.background = '#f9fafb';
                                    }}
                                  >
                                    {link}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {update.forms && update.forms.length > 0 ? (
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                          <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#1e293b' }}>Forms:</div>
                          {update.forms.map((form) => (
                            <div
                              key={form.id}
                              style={{
                                background: '#f9fafb',
                                borderRadius: '8px',
                                padding: '1rem',
                                marginBottom: '0.75rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 500, marginBottom: '0.25rem', color: '#1e293b' }}>
                                  Form {form.isPublished ? '(Published)' : '(Draft)'}
                                </div>
                                {form.isPublished && (
                                  <>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                                      <FaLink style={{ marginRight: '0.25rem' }} />
                                      <span
                                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={() => {
                                          navigator.clipboard.writeText(getFormUrl(form));
                                          alert('Form URL copied to clipboard!');
                                        }}
                                      >
                                        {getFormUrl(form)}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => loadFormSubmissions(form.id)}
                                      style={{
                                        background: '#f3f4f6',
                                        border: '1px solid #d1d5db',
                                        padding: '0.375rem 0.75rem',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        marginTop: '0.25rem',
                                      }}
                                    >
                                      {loadingSubmissions[form.id] ? 'Loading...' : `View Submissions (${formSubmissions[form.id]?.length || 0})`}
                                    </button>
                                    {formSubmissions[form.id] && formSubmissions[form.id].length > 0 && (
                                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                                        {formSubmissions[form.id].map((submission, idx) => (
                                          <div key={submission.id} style={{ 
                                            background: '#ffffff',
                                            border: '1px solid #e5e7eb',
                                            padding: '1rem',
                                            borderRadius: '8px',
                                            marginBottom: '1rem',
                                            fontSize: '0.875rem'
                                          }}>
                                            <div style={{ 
                                              display: 'flex', 
                                              justifyContent: 'space-between', 
                                              alignItems: 'center',
                                              marginBottom: '0.75rem',
                                              paddingBottom: '0.75rem',
                                              borderBottom: '1px solid #e5e7eb'
                                            }}>
                                              <div>
                                                <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: '#1e293b' }}>
                                                  Submission #{idx + 1}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                  {new Date(submission.submittedAt).toLocaleString()}
                                                </div>
                                              </div>
                                              {submission.clientName && (
                                                <div style={{ 
                                                  padding: '0.25rem 0.75rem',
                                                  background: '#f1f5f9',
                                                  borderRadius: '12px',
                                                  fontSize: '0.75rem',
                                                  color: '#475569'
                                                }}>
                                                  <FaUser style={{ marginRight: '0.25rem' }} />
                                                  {submission.clientName}
                                                  {submission.clientEmail && ` (${submission.clientEmail})`}
                                                </div>
                                              )}
                                            </div>
                                            {submission.responses && submission.responses.length > 0 && (
                                              <div style={{ marginTop: '0.5rem' }}>
                                                {submission.responses.map((resp: any, respIdx: number) => {
                                                  // Find the corresponding form block to show context
                                                  const block = form.blocks?.find((b: any) => b.id === resp.blockId);
                                                  return (
                                                    <div 
                                                      key={respIdx} 
                                                      style={{ 
                                                        marginBottom: '1rem',
                                                        padding: '0.75rem',
                                                        background: '#f9fafb',
                                                        borderRadius: '6px',
                                                        border: '1px solid #e5e7eb'
                                                      }}
                                                    >
                                                      {block && (
                                                        <div style={{ 
                                                          fontSize: '0.75rem', 
                                                          color: '#64748b', 
                                                          marginBottom: '0.5rem',
                                                          fontWeight: 500
                                                        }}>
                                                          {block.type === 'paragraph' && '📝 Paragraph Response'}
                                                          {block.type === 'heading' && '📌 Heading Response'}
                                                          {block.type === 'image' && '🖼️ Image Response'}
                                                          {block.type === 'text_with_image' && '📄 Text with Image Response'}
                                                          {!['paragraph', 'heading', 'image', 'text_with_image'].includes(block.type) && 'Response'}
                                                        </div>
                                                      )}
                                                      {resp.text && (
                                                        <div style={{ 
                                                          color: '#374151', 
                                                          whiteSpace: 'pre-wrap',
                                                          lineHeight: '1.6',
                                                          marginBottom: resp.imageUrls?.length > 0 ? '0.75rem' : '0'
                                                        }}>
                                                          {resp.text}
                                                        </div>
                                                      )}
                                                      {resp.imageUrls && resp.imageUrls.length > 0 && (
                                                        <div style={{ 
                                                          display: 'flex', 
                                                          gap: '0.75rem', 
                                                          marginTop: '0.5rem', 
                                                          flexWrap: 'wrap' 
                                                        }}>
                                                          {resp.imageUrls.map((url: string, imgIdx: number) => (
                                                            <a
                                                              key={imgIdx}
                                                              href={url}
                                                              target="_blank"
                                                              rel="noopener noreferrer"
                                                              style={{ 
                                                                display: 'block',
                                                                cursor: 'pointer',
                                                                transition: 'transform 0.2s'
                                                              }}
                                                              onMouseEnter={(e) => {
                                                                e.currentTarget.style.transform = 'scale(1.05)';
                                                              }}
                                                              onMouseLeave={(e) => {
                                                                e.currentTarget.style.transform = 'scale(1)';
                                                              }}
                                                            >
                                                              <img 
                                                                src={url} 
                                                                alt={`Submission ${imgIdx + 1}`} 
                                                                style={{ 
                                                                  width: '120px', 
                                                                  height: '120px', 
                                                                  objectFit: 'cover', 
                                                                  borderRadius: '6px',
                                                                  border: '1px solid #e5e7eb',
                                                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                                                }} 
                                                              />
                                                            </a>
                                                          ))}
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                onClick={() => {
                                  navigate(`/project/${id}/form-builder/${update.id}/${form.id}`);
                                }}
                                style={{
                                  background: 'white',
                                  border: '1px solid #d1d5db',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '6px',
                                  fontSize: '0.875rem',
                                  cursor: 'pointer',
                                }}
                              >
                                <FaEdit /> {form.isPublished ? 'View' : 'Edit'}
                              </button>
                                {!form.isPublished && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        await clientUpdatesService.publishForm(form.id);
                                        await loadClientUpdates();
                                        alert('Form published!');
                                      } catch (error) {
                                        alert('Failed to publish form');
                                      }
                                    }}
                                    style={{
                                      background: '#667eea',
                                      color: 'white',
                                      border: 'none',
                                      padding: '0.5rem 1rem',
                                      borderRadius: '6px',
                                      fontSize: '0.875rem',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <FaPaperPlane /> Publish
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                          <button
                            onClick={() => {
                              navigate(`/project/${id}/form-builder/${update.id}`);
                            }}
                            style={{
                              background: '#f3f4f6',
                              border: '1px solid #d1d5db',
                              padding: '0.5rem 1rem',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                            }}
                          >
                            <FaPlus /> Create Form
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Task Detail Side Modal for project tasks */}
      <TaskDetailSideModal
        isOpen={showTaskDetailModal}
        task={selectedTaskDetail}
        initialTab={taskDetailInitialTab}
        onClose={() => {
          setShowTaskDetailModal(false);
          setSelectedTaskDetail(null);
          setTaskDetailInitialTab('details');
        }}
        allUsers={allUsers}
        getProjectName={(projectId: string) => {
          if (!project) return 'Unknown Project';
          if (project.id === projectId) return project.clientName || 'Unknown Project';
          // Fallback: look in relatedProjects if present
          const related = (project.relatedProjects || []).find((p: any) => p.id === projectId);
          return related?.clientName || project.clientName || 'Unknown Project';
        }}
        getProjectPmName={(projectId: string) => {
          if (!project) return '';
          if (project.id === projectId) return project.pm?.name || '';
          const related = (project.relatedProjects || []).find((p: any) => p.id === projectId);
          return related?.pm?.name || '';
        }}
        onTaskUpdate={(updatedTask: any) => {
          setSelectedTaskDetail(updatedTask);
          setTasks((prev) => {
            const next = prev.map((t: any) => (t.id === updatedTask.id ? updatedTask : t));
            tasksRef.current = next;
            return next;
          });
        }}
        onTaskDeleted={(taskId: string) => {
          setShowTaskDetailModal(false);
          setSelectedTaskDetail(null);
          setTasks((prev) => {
            const next = prev.filter((t: any) => t.id !== taskId);
            tasksRef.current = next;
            return next;
          });
        }}
      />

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

      {/* Status Change Notes Modal for task status updates */}
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
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '600px' }}
          >
            <div className="modal-header">
              <h2>Update Status – {statusChangeContext.label}</h2>
              <button
                className="close-button"
                onClick={() => {
                  if (statusChangeLoading) return;
                  setShowStatusChangeModal(false);
                  setStatusChangeContext(null);
                  setStatusChangeNotes('');
                  setStatusChangeAttachment('');
                }}
              >
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '1.5rem', color: '#6b7280' }}>
                Add notes and links so PMs and team leads can see why this task moved into "{statusChangeContext.label}".
              </p>

              <div className="form-group">
                <label htmlFor="status-change-notes">Notes (Optional)</label>
                <textarea
                  id="status-change-notes"
                  value={statusChangeNotes}
                  onChange={(e) => setStatusChangeNotes(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', padding: '0.75rem', minHeight: '100px', fontFamily: 'inherit' }}
                  placeholder="Add context about this status change..."
                  disabled={statusChangeLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="status-change-attachment">Attachment/Link (Optional)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FaLink style={{ color: '#6b7280', fontSize: '0.875rem' }} />
                  <input
                    id="status-change-attachment"
                    type="url"
                    value={statusChangeAttachment}
                    onChange={(e) => setStatusChangeAttachment(e.target.value)}
                    className="form-input"
                    style={{ flex: 1, padding: '0.75rem' }}
                    placeholder="https://example.com or Google Drive/Figma link..."
                    disabled={statusChangeLoading}
                  />
                </div>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem', marginBottom: 0 }}>
                  Use this to attach references, client feedback, or handoff links.
                </p>
              </div>
            </div>
            <div className="modal-footer">
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
                      statusChangeContext.columnId,
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
              >
                {statusChangeLoading ? 'Updating...' : 'Update Status'}
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

      {/* Delete Deliverable Confirmation Modal */}
      {showDeleteDeliverableConfirm && project && (() => {
        const deliverableToDelete = project.deliverables?.find((d: any) => d.id === showDeleteDeliverableConfirm);
        if (!deliverableToDelete) return null;
        
        return (
          <div className="modal-overlay" onClick={() => setShowDeleteDeliverableConfirm(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h2>Delete Custom Deliverable</h2>
                <button className="modal-close" onClick={() => setShowDeleteDeliverableConfirm(null)}>
                  <FaTimes />
                </button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: '1rem', color: '#64748b' }}>
                  Are you sure you want to delete <strong>"{getDeliverableDisplayName(deliverableToDelete)}"</strong>?
                </p>
                <p style={{ marginBottom: '1rem', color: '#dc2626', fontSize: '0.875rem' }}>
                  ⚠️ This action cannot be undone. All tasks associated with this deliverable will remain but will no longer be linked to a deliverable.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn-secondary"
                  onClick={() => setShowDeleteDeliverableConfirm(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn-danger"
                  onClick={() => handleDeleteCustomDeliverable(showDeleteDeliverableConfirm)}
                  style={{
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <FaTrash /> Delete Deliverable
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add Custom Deliverable Modal */}
      {showAddTaskFromDeliverableModal && selectedDeliverableForTask && (
        <div className="modal-overlay" onClick={() => setShowAddTaskFromDeliverableModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h2>Add Task to Deliverable</h2>
              <button className="close-button" onClick={() => setShowAddTaskFromDeliverableModal(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '1.5rem' }}>
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
                <label>Due Date (Optional)</label>
                <input
                  type="date"
                  value={newTaskData.dueDate}
                  onChange={(e) => setNewTaskData({ ...newTaskData, dueDate: e.target.value })}
                  className="form-input"
                  style={{ padding: '0.625rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                />
              </div>
              <div className="form-group">
                <label>Attach Links (Optional)</label>
                {newTaskLinks.map((link, index) => (
                  <div
                    key={index}
                    style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}
                  >
                    <input
                      type="url"
                      className="form-input"
                      value={link}
                      onChange={(e) => {
                        const updated = [...newTaskLinks];
                        updated[index] = e.target.value;
                        setNewTaskLinks(updated);
                      }}
                      placeholder="Paste a URL (Google Drive, Loom, Figma, etc.)"
                    />
                    {newTaskLinks.length > 1 && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          const updated = newTaskLinks.filter((_, i) => i !== index);
                          setNewTaskLinks(updated.length ? updated : ['']);
                        }}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setNewTaskLinks([...newTaskLinks, ''])}
                  style={{ marginTop: '0.25rem' }}
                >
                  + Add Another Link
                </button>
              </div>

              <div className="form-group">
                <label>Attach Files (Optional)</label>
                <input
                  type="file"
                  className="form-input"
                  multiple
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    try {
                      setNewTaskAttachmentUploading(true);
                      const uploadedUrls: string[] = [];
                      for (const file of files) {
                        const url = await handleImageUpload(file as File);
                        uploadedUrls.push(url);
                      }
                      setNewTaskFileUrls((prev) => [...prev, ...uploadedUrls]);
                    } catch (error) {
                      console.error('Failed to upload attachments:', error);
                      alert('Failed to upload file(s). Please try again.');
                    } finally {
                      setNewTaskAttachmentUploading(false);
                    }
                  }}
                />
                {newTaskAttachmentUploading && (
                  <small style={{ color: '#64748b' }}>Uploading to Cloudinary...</small>
                )}
                {newTaskFileUrls.length > 0 && !newTaskAttachmentUploading && (
                  <small style={{ color: '#16a34a', display: 'block', marginTop: '0.25rem' }}>
                    {newTaskFileUrls.length} file(s) uploaded ✓
                  </small>
                )}
              </div>
              {canAssignOwners && (
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
              )}
              
              {/* Quick Complete Option for PMs */}
              {authService.getUser()?.role === 'Project Manager' && (
                <div className="form-group" style={{ marginTop: '1rem', padding: '0.75rem', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={markTaskCompleteOnCreate}
                      onChange={(e) => setMarkTaskCompleteOnCreate(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.875rem', color: '#0369a1', fontWeight: 500 }}>
                      ✓ Mark as completed (for work already done)
                    </span>
                  </label>
                  <small style={{ display: 'block', marginTop: '0.25rem', color: '#0284c7', fontSize: '0.75rem' }}>
                    Use this when adding tasks for work that's already finished
                  </small>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowAddTaskFromDeliverableModal(false);
                  setSelectedDeliverableForTask(null);
                  setNewTaskData({ department: '', notes: '', assignedToId: '', dueDate: '' });
                  setNewTaskLinks(['']);
                  setNewTaskFileUrls([]);
                  setMarkTaskCompleteOnCreate(false);
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

      {/* Create Client Update Modal */}
      {showCreateUpdateModal && (
        <div className="modal-overlay" onClick={() => {
          setShowCreateUpdateModal(false);
          setEmailNotes('');
          setEmailLinks(['']);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Log Email Sent</h2>
              <button className="close-button" onClick={() => {
                setShowCreateUpdateModal(false);
                setEmailNotes('');
                setEmailLinks(['']);
              }}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                Record that an email was sent to the client. Add notes and attach links if necessary.
              </p>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 500, 
                  color: '#1e293b',
                  fontSize: '0.875rem'
                }}>
                  <FaStickyNote style={{ marginRight: '0.5rem', color: '#f59e0b' }} />
                  Notes (Optional)
                </label>
                <textarea
                  value={emailNotes}
                  onChange={(e) => setEmailNotes(e.target.value)}
                  placeholder="Add any notes about this email..."
                  style={{
                    width: '100%',
                    minHeight: '120px',
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
                    <FaLink style={{ marginRight: '0.5rem', color: '#667eea' }} />
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
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowCreateUpdateModal(false);
                  setEmailNotes('');
                  setEmailLinks(['']);
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateUpdate}
              >
                Log Email Sent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Builder Modal */}
      {showFormBuilder && (
        <div className="modal-overlay" onClick={() => {
          if (!creatingForm && !publishingForm) {
            setShowFormBuilder(false);
            setCurrentForm(null);
            setFormBlocks([]);
            setSelectedUpdate(null);
          }
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>{currentForm ? 'Edit Form' : 'Create Form'}</h2>
              <button className="close-button" onClick={() => {
                if (!creatingForm && !publishingForm) {
                  setShowFormBuilder(false);
                  setCurrentForm(null);
                  setFormBlocks([]);
                  setSelectedUpdate(null);
                }
              }}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => addFormBlock('paragraph')}
                  style={{
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  + Paragraph
                </button>
                <button
                  onClick={() => addFormBlock('heading')}
                  style={{
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  + Heading
                </button>
                <button
                  onClick={() => addFormBlock('image')}
                  style={{
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  + Image
                </button>
                <button
                  onClick={() => addFormBlock('text_with_image')}
                  style={{
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  + Text + Image
                </button>
                <button
                  onClick={() => addFormBlock('layout')}
                  style={{
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  + Layout
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {formBlocks.map((block, index) => (
                  <div
                    key={block.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '1rem',
                      background: 'white',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                        {block.type.replace('_', ' ').toUpperCase()}
                      </span>
                      <button
                        onClick={() => removeFormBlock(block.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '0.25rem',
                        }}
                      >
                        <FaTimes />
                      </button>
                    </div>

                    {block.type === 'paragraph' && (
                      <div>
                        <textarea
                          value={block.content || ''}
                          onChange={(e) => updateFormBlock(block.id, { content: e.target.value })}
                          placeholder="Enter paragraph text..."
                          style={{
                            width: '100%',
                            minHeight: '100px',
                            padding: '0.75rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            fontFamily: 'inherit',
                          }}
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <input
                            type="checkbox"
                            checked={block.bold || false}
                            onChange={(e) => updateFormBlock(block.id, { bold: e.target.checked })}
                          />
                          <span style={{ fontSize: '0.875rem' }}>Bold</span>
                        </label>
                      </div>
                    )}

                    {block.type === 'heading' && (
                      <input
                        type="text"
                        value={block.content || ''}
                        onChange={(e) => updateFormBlock(block.id, { content: e.target.value })}
                        placeholder="Enter heading text..."
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '1.125rem',
                          fontWeight: 600,
                          fontFamily: 'inherit',
                        }}
                      />
                    )}

                    {block.type === 'image' && (
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const url = await handleImageUpload(file);
                                updateFormBlock(block.id, { imageUrl: url });
                              } catch (error) {
                                alert('Failed to upload image');
                              }
                            }
                          }}
                          style={{ marginBottom: '0.5rem' }}
                        />
                        {block.imageUrl && (
                          <img
                            src={block.imageUrl}
                            alt={block.imageAlt || ''}
                            style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '6px', marginTop: '0.5rem' }}
                          />
                        )}
                        <input
                          type="text"
                          value={block.imageAlt || ''}
                          onChange={(e) => updateFormBlock(block.id, { imageAlt: e.target.value })}
                          placeholder="Image alt text..."
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            marginTop: '0.5rem',
                            fontFamily: 'inherit',
                          }}
                        />
                      </div>
                    )}

                    {block.type === 'text_with_image' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <textarea
                          value={block.text || ''}
                          onChange={(e) => updateFormBlock(block.id, { text: e.target.value })}
                          placeholder="Enter text..."
                          style={{
                            width: '100%',
                            minHeight: '80px',
                            padding: '0.75rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            fontFamily: 'inherit',
                          }}
                        />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const url = await handleImageUpload(file);
                                updateFormBlock(block.id, { imageUrl: url });
                              } catch (error) {
                                alert('Failed to upload image');
                              }
                            }
                          }}
                        />
                        {block.imageUrl && (
                          <img
                            src={block.imageUrl}
                            alt={block.imageAlt || ''}
                            style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '6px' }}
                          />
                        )}
                      </div>
                    )}

                    {block.type === 'layout' && (
                      <div>
                        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                          Layout blocks are complex. For now, use individual blocks.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {formBlocks.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  <p>No blocks yet. Add blocks using the buttons above.</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => {
                  if (!creatingForm && !publishingForm) {
                    setShowFormBuilder(false);
                    setCurrentForm(null);
                    setFormBlocks([]);
                    setSelectedUpdate(null);
                  }
                }}
                disabled={creatingForm || publishingForm}
              >
                Cancel
              </button>
              {!currentForm ? (
                <button
                  className="btn-primary"
                  onClick={handleCreateForm}
                  disabled={formBlocks.length === 0 || creatingForm}
                >
                  {creatingForm ? 'Creating...' : 'Create Form'}
                </button>
              ) : (
                <>
                  <button
                    className="btn-secondary"
                    onClick={async () => {
                      try {
                        await clientUpdatesService.updateForm(currentForm.id, formBlocks);
                        await loadClientUpdates();
                        alert('Form updated!');
                      } catch (error) {
                        alert('Failed to update form');
                      }
                    }}
                    disabled={creatingForm || publishingForm}
                  >
                    Save Changes
                  </button>
                  {!currentForm.isPublished && (
                    <button
                      className="btn-primary"
                      onClick={handlePublishForm}
                      disabled={formBlocks.length === 0 || publishingForm}
                    >
                      {publishingForm ? 'Publishing...' : 'Publish Form'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Deliverable to Task Modal */}
      {showAssignDeliverableModal && taskToAssign && project && (
        <div className="modal-overlay" onClick={() => {
          setShowAssignDeliverableModal(false);
          setTaskToAssign(null);
          setSelectedDeliverableId('');
          setNewCustomDeliverableName('');
          setUseCustomDeliverable(false);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Assign Task to Deliverable</h2>
              <button className="close-button" onClick={() => {
                setShowAssignDeliverableModal(false);
                setTaskToAssign(null);
                setSelectedDeliverableId('');
                setNewCustomDeliverableName('');
                setUseCustomDeliverable(false);
              }}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              {/* Task Info Card */}
              <div style={{ 
                marginBottom: '1.5rem', 
                padding: '0.875rem 1rem', 
                background: 'linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%)', 
                borderRadius: '8px', 
                border: '1px solid #c7d2fe',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: '#667eea',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <FaClipboard style={{ color: 'white', fontSize: '0.875rem' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 500, marginBottom: '0.125rem' }}>Task</div>
                  <div style={{ fontSize: '0.9375rem', color: '#1e293b', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {taskToAssign.title}
                  </div>
                </div>
              </div>

              {/* Option Toggle */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.8125rem', 
                  fontWeight: 500, 
                  color: '#475569', 
                  marginBottom: '0.75rem' 
                }}>
                  Choose an option
                </label>
                <div style={{ 
                  display: 'flex', 
                  gap: '0.5rem',
                  background: '#f8fafc',
                  padding: '0.25rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      setUseCustomDeliverable(false);
                      setNewCustomDeliverableName('');
                    }}
                    style={{
                      flex: 1,
                      padding: '0.625rem 1rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: !useCustomDeliverable ? 'white' : 'transparent',
                      color: !useCustomDeliverable ? '#1e293b' : '#64748b',
                      fontSize: '0.875rem',
                      fontWeight: !useCustomDeliverable ? 600 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: !useCustomDeliverable ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    Existing
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUseCustomDeliverable(true);
                      setSelectedDeliverableId('');
                    }}
                    style={{
                      flex: 1,
                      padding: '0.625rem 1rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: useCustomDeliverable ? 'white' : 'transparent',
                      color: useCustomDeliverable ? '#1e293b' : '#64748b',
                      fontSize: '0.875rem',
                      fontWeight: useCustomDeliverable ? 600 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: useCustomDeliverable ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    Create New
                  </button>
                </div>
              </div>

              {/* Existing Deliverable Selection */}
              {!useCustomDeliverable && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '0.8125rem', 
                    fontWeight: 500, 
                    color: '#475569', 
                    marginBottom: '0.5rem' 
                  }}>
                    Select Deliverable
                  </label>
                  <select
                    value={selectedDeliverableId}
                    onChange={(e) => setSelectedDeliverableId(e.target.value)}
                    className="form-input"
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem', 
                      fontSize: '0.875rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      background: 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#667eea';
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <option value="">-- Choose a deliverable --</option>
                    {project.deliverables?.map((deliverable: any) => (
                      <option key={deliverable.id} value={deliverable.id}>
                        {getDeliverableDisplayName(deliverable)}
                      </option>
                    ))}
                  </select>
                  {project.deliverables?.length === 0 && (
                    <p style={{ 
                      fontSize: '0.75rem', 
                      color: '#94a3b8', 
                      marginTop: '0.5rem', 
                      marginBottom: 0,
                      fontStyle: 'italic'
                    }}>
                      {project.clientType === 'Private'
                        ? 'No deliverables set yet for this Private client. You can add them when ready.'
                        : 'No deliverables available. Create a new one instead.'}
                    </p>
                  )}
                </div>
              )}

              {/* Custom Deliverable Creation */}
              {useCustomDeliverable && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '0.8125rem', 
                    fontWeight: 500, 
                    color: '#475569', 
                    marginBottom: '0.5rem' 
                  }}>
                    Deliverable Name
                  </label>
                  <input
                    type="text"
                    value={newCustomDeliverableName}
                    onChange={(e) => setNewCustomDeliverableName(e.target.value)}
                    placeholder="e.g., Email Templates, Social Posts, Home Page Copy"
                    className="form-input"
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem', 
                      fontSize: '0.875rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      transition: 'all 0.2s'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#667eea';
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                    autoFocus
                  />
                  <p style={{ 
                    fontSize: '0.75rem', 
                    color: '#94a3b8', 
                    marginTop: '0.5rem', 
                    marginBottom: 0 
                  }}>
                    This will create a new custom deliverable for this project
                  </p>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ 
              padding: '1rem 1.5rem',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              background: '#fafbfc'
            }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowAssignDeliverableModal(false);
                  setTaskToAssign(null);
                  setSelectedDeliverableId('');
                  setNewCustomDeliverableName('');
                  setUseCustomDeliverable(false);
                }}
                disabled={assigningDeliverable}
                style={{
                  padding: '0.625rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleAssignDeliverableToTask}
                disabled={assigningDeliverable || (!useCustomDeliverable && !selectedDeliverableId) || (useCustomDeliverable && !newCustomDeliverableName.trim())}
                style={{
                  padding: '0.625rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  background: (!useCustomDeliverable && !selectedDeliverableId) || (useCustomDeliverable && !newCustomDeliverableName.trim()) ? '#cbd5e1' : '#667eea',
                  cursor: ((!useCustomDeliverable && !selectedDeliverableId) || (useCustomDeliverable && !newCustomDeliverableName.trim())) ? 'not-allowed' : 'pointer'
                }}
              >
                {assigningDeliverable ? 'Assigning...' : 'Assign Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Files/Links Modal */}
      {showFilesLinksModal && project && (
        <div className="modal-overlay" onClick={() => {
          setShowFilesLinksModal(false);
          setFilesLinksSearchQuery('');
          setFilesLinksFilter('all');
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #e5e7eb', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FaLink style={{ color: 'white', fontSize: '1rem' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0, color: '#1e293b' }}>Files & Links</h2>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                    All shared files and links for this project
                  </p>
                </div>
              </div>
              <button className="close-button" onClick={() => {
                setShowFilesLinksModal(false);
                setFilesLinksSearchQuery('');
                setFilesLinksFilter('all');
              }}>
                <FaTimes />
              </button>
            </div>
            
            <div style={{ padding: '1.5rem', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Search and Filter Bar */}
              <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
                  <FaSearch style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                    fontSize: '0.875rem'
                  }} />
                  <input
                    type="text"
                    placeholder="Search links, tasks, or users..."
                    value={filesLinksSearchQuery}
                    onChange={(e) => setFilesLinksSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#667eea';
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setFilesLinksFilter('all')}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: filesLinksFilter === 'all' ? '#667eea' : '#f3f4f6',
                      color: filesLinksFilter === 'all' ? 'white' : '#64748b',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    All ({getAllFilesAndLinks.length})
                  </button>
                  <button
                    onClick={() => setFilesLinksFilter('task')}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: filesLinksFilter === 'task' ? '#3b82f6' : '#f3f4f6',
                      color: filesLinksFilter === 'task' ? 'white' : '#64748b',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <FaClipboard style={{ fontSize: '0.75rem' }} />
                    Tasks ({getAllFilesAndLinks.filter(l => l.sourceType === 'Task').length})
                  </button>
                  <button
                    onClick={() => setFilesLinksFilter('email')}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: filesLinksFilter === 'email' ? '#f59e0b' : '#f3f4f6',
                      color: filesLinksFilter === 'email' ? 'white' : '#64748b',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <FaEnvelope style={{ fontSize: '0.75rem' }} />
                    Email Logs ({getAllFilesAndLinks.filter(l => l.sourceType === 'Email Log').length})
                  </button>
                </div>
              </div>

              {/* Links List */}
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                {(() => {
                  // Filter links based on search and filter
                  let filteredLinks = getAllFilesAndLinks;
                  
                  // Apply type filter
                  if (filesLinksFilter === 'task') {
                    filteredLinks = filteredLinks.filter(l => l.sourceType === 'Task');
                  } else if (filesLinksFilter === 'email') {
                    filteredLinks = filteredLinks.filter(l => l.sourceType === 'Email Log');
                  }
                  
                  // Apply search filter
                  if (filesLinksSearchQuery.trim()) {
                    const query = filesLinksSearchQuery.toLowerCase();
                    filteredLinks = filteredLinks.filter(link => {
                      return (
                        link.url.toLowerCase().includes(query) ||
                        link.taskTitle?.toLowerCase().includes(query) ||
                        link.assignedTo?.name.toLowerCase().includes(query) ||
                        link.pmName?.toLowerCase().includes(query) ||
                        link.source.toLowerCase().includes(query)
                      );
                    });
                  }
                  
                  if (filteredLinks.length === 0) {
                    return (
                      <div style={{
                        padding: '3rem',
                        textAlign: 'center',
                        background: '#f9fafb',
                        borderRadius: '12px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <FaLink style={{ fontSize: '3rem', color: '#94a3b8', marginBottom: '1rem', opacity: 0.5 }} />
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>
                          No links found
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                          {filesLinksSearchQuery.trim() || filesLinksFilter !== 'all'
                            ? 'Try adjusting your search or filters'
                            : 'No files or links have been shared yet'}
                        </p>
                      </div>
                    );
                  }
                  
                  const formatLinkDisplay = (url: string) => {
                    // URL is already normalized in getAllFilesAndLinks, but ensure it's still valid
                    try {
                      const urlObj = new URL(url);
                      return {
                        domain: urlObj.hostname,
                        path: urlObj.pathname + urlObj.search,
                        full: url
                      };
                    } catch {
                      // If URL parsing fails, try adding https://
                      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
                      return {
                        domain: 'Link',
                        path: normalizedUrl.length > 60 ? normalizedUrl.substring(0, 60) + '...' : normalizedUrl,
                        full: normalizedUrl
                      };
                    }
                  };
                  
                  const formatDateTime = (date?: Date) => {
                    if (!date) return 'Unknown date';
                    return date.toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                  };
                  
                  const getLinkTypeIcon = (url: string) => {
                    const lowerUrl = url.toLowerCase();
                    
                    // Detect file extensions from Cloudinary URLs or regular URLs
                    const getFileExtension = (url: string): string | null => {
                      // First, try to extract extension from URL path (standard format)
                      const urlMatch = url.match(/\.([a-z0-9]+)(?:\?|$|#)/i);
                      if (urlMatch) {
                        return urlMatch[1].toLowerCase();
                      }
                      
                      // For Cloudinary URLs, check multiple patterns
                      // Pattern 1: /upload/v123456/folder/filename.ext
                      const cloudinaryPattern1 = url.match(/\/upload\/[^/]+\/[^/]+\/([^/?]+)/);
                      if (cloudinaryPattern1) {
                        const filename = cloudinaryPattern1[1];
                        const extMatch = filename.match(/\.([a-z0-9]+)$/i);
                        if (extMatch) {
                          return extMatch[1].toLowerCase();
                        }
                      }
                      
                      // Pattern 2: /raw/upload/v123456/folder/filename.ext
                      const cloudinaryPattern2 = url.match(/\/raw\/upload\/[^/]+\/[^/]+\/([^/?]+)/);
                      if (cloudinaryPattern2) {
                        const filename = cloudinaryPattern2[1];
                        const extMatch = filename.match(/\.([a-z0-9]+)$/i);
                        if (extMatch) {
                          return extMatch[1].toLowerCase();
                        }
                      }
                      
                      // Pattern 3: Check for format parameter in Cloudinary URL
                      const formatMatch = url.match(/[?&]format=([a-z0-9]+)/i);
                      if (formatMatch) {
                        return formatMatch[1].toLowerCase();
                      }
                      
                      return null;
                    };

                    const extension = getFileExtension(url);
                    
                    // Map file extensions to types
                    if (extension) {
                      const fileTypeMap: Record<string, { icon: string; label: string }> = {
                        // Documents
                        'pdf': { icon: '📄', label: 'PDF' },
                        'doc': { icon: '📝', label: 'DOC' },
                        'docx': { icon: '📝', label: 'DOCX' },
                        'txt': { icon: '📄', label: 'TXT' },
                        'rtf': { icon: '📄', label: 'RTF' },
                        'odt': { icon: '📝', label: 'ODT' },
                        // Spreadsheets
                        'xls': { icon: '📊', label: 'XLS' },
                        'xlsx': { icon: '📊', label: 'XLSX' },
                        'csv': { icon: '📊', label: 'CSV' },
                        'ods': { icon: '📊', label: 'ODS' },
                        // Presentations
                        'ppt': { icon: '📽️', label: 'PPT' },
                        'pptx': { icon: '📽️', label: 'PPTX' },
                        'odp': { icon: '📽️', label: 'ODP' },
                        // Images
                        'jpg': { icon: '🖼️', label: 'JPG' },
                        'jpeg': { icon: '🖼️', label: 'JPEG' },
                        'png': { icon: '🖼️', label: 'PNG' },
                        'gif': { icon: '🖼️', label: 'GIF' },
                        'svg': { icon: '🖼️', label: 'SVG' },
                        'webp': { icon: '🖼️', label: 'WEBP' },
                        'bmp': { icon: '🖼️', label: 'BMP' },
                        // Videos
                        'mp4': { icon: '🎥', label: 'MP4' },
                        'mov': { icon: '🎥', label: 'MOV' },
                        'avi': { icon: '🎥', label: 'AVI' },
                        'mkv': { icon: '🎥', label: 'MKV' },
                        'webm': { icon: '🎥', label: 'WEBM' },
                        // Audio
                        'mp3': { icon: '🎵', label: 'MP3' },
                        'wav': { icon: '🎵', label: 'WAV' },
                        'ogg': { icon: '🎵', label: 'OGG' },
                        // Archives
                        'zip': { icon: '📦', label: 'ZIP' },
                        'rar': { icon: '📦', label: 'RAR' },
                        '7z': { icon: '📦', label: '7Z' },
                        'tar': { icon: '📦', label: 'TAR' },
                        'gz': { icon: '📦', label: 'GZ' },
                        // Code
                        'js': { icon: '💻', label: 'JS' },
                        'ts': { icon: '💻', label: 'TS' },
                        'html': { icon: '💻', label: 'HTML' },
                        'css': { icon: '💻', label: 'CSS' },
                        'json': { icon: '💻', label: 'JSON' },
                        'xml': { icon: '💻', label: 'XML' },
                      };
                      
                      if (fileTypeMap[extension]) {
                        return fileTypeMap[extension];
                      }
                      // Unknown extension, show it
                      return { icon: '📎', label: extension.toUpperCase() };
                    }
                    
                    // Check for known service domains
                    if (lowerUrl.includes('figma.com')) return { icon: '🎨', label: 'Figma' };
                    if (lowerUrl.includes('drive.google.com') || lowerUrl.includes('docs.google.com')) return { icon: '📁', label: 'Google Drive' };
                    if (lowerUrl.includes('dropbox.com')) return { icon: '📦', label: 'Dropbox' };
                    if (lowerUrl.includes('notion.so')) return { icon: '📝', label: 'Notion' };
                    if (lowerUrl.includes('miro.com') || lowerUrl.includes('mural.co')) return { icon: '🖼️', label: 'Whiteboard' };
                    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('vimeo.com')) return { icon: '🎥', label: 'Video' };
                    if (lowerUrl.includes('zoom.us') || lowerUrl.includes('meet.google.com')) return { icon: '💬', label: 'Meeting' };
                    if (lowerUrl.includes('loom.com')) return { icon: '🎥', label: 'Loom' };
                    if (lowerUrl.includes('cloudinary.com') && lowerUrl.includes('/raw/upload/')) {
                      // Cloudinary raw upload without detected extension
                      return { icon: '📎', label: 'File' };
                    }
                    
                    return { icon: '🔗', label: 'Link' };
                  };
                  
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {filteredLinks.map((link) => {
                        const linkInfo = formatLinkDisplay(link.url);
                        const linkType = getLinkTypeIcon(link.url);
                        
                        return (
                          <div
                            key={link.id}
                            style={{
                              background: 'white',
                              borderRadius: '12px',
                              border: '1px solid #e5e7eb',
                              padding: '1.25rem',
                              transition: 'all 0.2s',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                              e.currentTarget.style.borderColor = '#c7d2fe';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                              e.currentTarget.style.borderColor = '#e5e7eb';
                            }}
                          >
                            <div style={{ display: 'flex', gap: '1rem' }}>
                              {/* Left: Icon and Type */}
                              <div style={{ flexShrink: 0 }}>
                                <div style={{
                                  width: '56px',
                                  height: '56px',
                                  borderRadius: '12px',
                                  background: link.sourceType === 'Task' 
                                    ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                                    : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '1.5rem',
                                  border: `2px solid ${link.sourceType === 'Task' ? '#3b82f6' : '#f59e0b'}`,
                                  boxShadow: `0 2px 8px ${link.sourceType === 'Task' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`
                                }}>
                                  {link.sourceType === 'Task' ? (
                                    <FaClipboard style={{ color: '#3b82f6', fontSize: '1.25rem' }} />
                                  ) : (
                                    <FaEnvelope style={{ color: '#f59e0b', fontSize: '1.25rem' }} />
                                  )}
                                </div>
                                <div style={{
                                  marginTop: '0.5rem',
                                  textAlign: 'center',
                                  fontSize: '0.625rem',
                                  color: '#94a3b8',
                                  fontWeight: 500
                                }}>
                                  {linkType.label}
                                </div>
                              </div>
                              
                              {/* Middle: Link Info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ marginBottom: '0.75rem' }}>
                                  <a
                                    href={linkInfo.full}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      display: 'block',
                                      fontSize: '1rem',
                                      fontWeight: 600,
                                      color: '#667eea',
                                      textDecoration: 'none',
                                      marginBottom: '0.25rem',
                                      wordBreak: 'break-all',
                                      lineHeight: '1.4'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.textDecoration = 'underline';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.textDecoration = 'none';
                                    }}
                                  >
                                    {linkInfo.domain}
                                  </a>
                                  <div style={{
                                    fontSize: '0.8125rem',
                                    color: '#64748b',
                                    wordBreak: 'break-all',
                                    fontFamily: 'monospace',
                                    marginTop: '0.25rem'
                                  }}>
                                    {linkInfo.path}
                                  </div>
                                </div>
                                
                                {/* Metadata Grid */}
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                  gap: '0.75rem',
                                  marginTop: '0.75rem',
                                  padding: '0.75rem',
                                  background: '#f9fafb',
                                  borderRadius: '8px'
                                }}>
                                  <div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, marginBottom: '0.25rem' }}>Source</div>
                                    <div style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 500 }}>
                                      {link.sourceType}
                                    </div>
                                  </div>
                                  
                                  {link.taskTitle && (
                                    <div>
                                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, marginBottom: '0.25rem' }}>Task</div>
                                      <div style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 500 }}>
                                        {link.taskTitle}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {link.assignedTo && (
                                    <div>
                                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, marginBottom: '0.25rem' }}>Assigned To</div>
                                      <div style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                        <FaUser style={{ fontSize: '0.75rem', color: '#64748b' }} />
                                        {link.assignedTo.name}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {link.pmName && (
                                    <div>
                                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, marginBottom: '0.25rem' }}>Shared By</div>
                                      <div style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                        <FaUser style={{ fontSize: '0.75rem', color: '#64748b' }} />
                                        {link.pmName}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {link.taskType && (
                                    <div>
                                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, marginBottom: '0.25rem' }}>Type</div>
                                      <div style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 500 }}>
                                        {link.taskType}
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, marginBottom: '0.25rem' }}>Date</div>
                                    <div style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                      <FaClock style={{ fontSize: '0.75rem', color: '#64748b' }} />
                                      {formatDateTime(link.date)}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Notes (for email logs) */}
                                {link.notes && (
                                  <div style={{
                                    marginTop: '0.75rem',
                                    padding: '0.75rem',
                                    background: '#fef3c7',
                                    borderRadius: '8px',
                                    border: '1px solid #fde68a'
                                  }}>
                                    <div style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 500, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                      <FaStickyNote style={{ fontSize: '0.75rem' }} />
                                      Notes
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: '#78350f', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                                      {link.notes}
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              {/* Right: Action Button */}
                              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <a
                                  href={linkInfo.full}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // For PDFs, ensure they open in a new tab with proper headers
                                    if (linkInfo.full.toLowerCase().includes('.pdf') || linkInfo.full.includes('/raw/upload/')) {
                                      window.open(linkInfo.full, '_blank', 'noopener,noreferrer');
                                      e.preventDefault();
                                    }
                                  }}
                                  style={{
                                    padding: '0.75rem 1.25rem',
                                    borderRadius: '8px',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    textDecoration: 'none',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
                                  }}
                                >
                                  <FaLink style={{ fontSize: '0.75rem' }} />
                                  Open Link
                                </a>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(linkInfo.full);
                                    showToast('Link copied to clipboard!');
                                  }}
                                  style={{
                                    padding: '0.625rem 1rem',
                                    borderRadius: '8px',
                                    background: 'white',
                                    border: '1px solid #e5e7eb',
                                    color: '#64748b',
                                    fontSize: '0.8125rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.375rem',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f3f4f6';
                                    e.currentTarget.style.borderColor = '#d1d5db';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'white';
                                    e.currentTarget.style.borderColor = '#e5e7eb';
                                  }}
                                >
                                  <FaCopy style={{ fontSize: '0.75rem' }} />
                                  Copy
                                </button>
                              </div>
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
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditProjectModal && project && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEditProjectModal(false)}
          onSuccess={async () => {
            // Reload project data
            try {
              const updatedProject = await projectService.getOne(id!);
              setProject(updatedProject);
              setShowEditProjectModal(false);
            } catch (error) {
              console.error('Failed to reload project:', error);
            }
          }}
        />
      )}
      </div>
    </div>
  );
};

// Edit Project Modal Component
interface EditProjectModalProps {
  project: any;
  onClose: () => void;
  onSuccess: () => void;
}

const EditProjectModal: React.FC<EditProjectModalProps> = ({ project, onClose, onSuccess }) => {
  const [clientName, setClientName] = useState(project.clientName || '');
  const [associatedLink, setAssociatedLink] = useState(project.associatedLink || '');
  const [selectedClientTypes, setSelectedClientTypes] = useState<string[]>(() => {
    const primary = project.clientType ? [project.clientType] : [];
    const secondary = project.secondaryClientTypes 
      ? (Array.isArray(project.secondaryClientTypes) 
          ? project.secondaryClientTypes 
          : project.secondaryClientTypes.split(',').map((t: string) => t.trim()).filter((t: string) => !!t))
      : [];
    return [...primary, ...secondary];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const clientTypes = [
    { value: 'ICON', label: 'ICON', color: '#fbbf24' },
    { value: 'STAR', label: 'STAR', color: '#94a3b8' },
    { value: 'Katalyst', label: 'Katalyst', color: '#667eea' },
    { value: 'Private', label: 'Private', color: '#64748b' },
    { value: 'Premium', label: 'Premium', color: '#8b5cf6' },
    { value: 'Powered-Up', label: 'Powered-Up', color: '#a855f7' },
  ];

  const toggleClientType = (clientType: string) => {
    setSelectedClientTypes((currentSelection) => {
      if (currentSelection.includes(clientType)) {
        return currentSelection.filter(t => t !== clientType);
      } else if (currentSelection.length < 2) {
        return [...currentSelection, clientType];
      }
      return currentSelection;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedClientTypes.length === 0) {
      setError('Please select at least one client type');
      return;
    }

    if (!clientName.trim()) {
      setError('Please enter a client name');
      return;
    }

    setLoading(true);

    try {
      const secondaryClientTypes = selectedClientTypes.length > 1 
        ? selectedClientTypes.slice(1) 
        : undefined;

      await projectService.update(project.id, {
        clientName: clientName.trim(),
        clientType: selectedClientTypes[0],
        secondaryClientTypes: secondaryClientTypes,
        associatedLink: associatedLink.trim(),
      });

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h2>Edit Project</h2>
          <button className="close-button" onClick={onClose} aria-label="Close edit project modal">×</button>
        </div>

        <form onSubmit={handleSubmit} className="create-project-form">
          <div className="modal-body" style={{ paddingTop: '1.5rem' }}>
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="editClientName">Client Name</label>
              <input
                id="editClientName"
                type="text"
                className="form-input"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                placeholder="Enter client name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="editAssociatedLink">Project Associated Link</label>
              <div style={{ position: 'relative' }}>
                <FaLink
                  style={{
                    position: 'absolute',
                    left: '0.95rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                    fontSize: '0.85rem',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  id="editAssociatedLink"
                  type="text"
                  className="form-input"
                  value={associatedLink}
                  onChange={(e) => setAssociatedLink(e.target.value)}
                  placeholder="https://example.com (or paste a domain)"
                  style={{ paddingLeft: '2.4rem' }}
                />
              </div>
              <p style={{ margin: '0.45rem 0 0', color: '#94a3b8', fontSize: '0.78rem' }}>
                This shows under the project name as a quick link.
              </p>
            </div>

            <div className="form-group" style={{ padding: '0' }}>
              <label id="editClientTypeLabel" style={{ color: '#475569', fontWeight: 600 }}>
                Client Type {selectedClientTypes.length > 0 && <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'normal' }}>(Select up to 2)</span>}
              </label>
              <div className="client-type-grid" role="group" aria-labelledby="editClientTypeLabel" style={{ marginTop: '0.5rem' }}>
                {clientTypes.map((type) => {
                  const isSelected = selectedClientTypes.includes(type.value);
                  const canSelect = selectedClientTypes.length < 2 || isSelected;

                  return (
                    <button
                      key={type.value}
                      type="button"
                      className={`client-type-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleClientType(type.value)}
                      style={{
                        borderColor: isSelected ? type.color : '#e2e8f0',
                        borderWidth: isSelected ? '2px' : '1.5px',
                        opacity: canSelect ? 1 : 0.4,
                        cursor: canSelect ? 'pointer' : 'not-allowed',
                        backgroundColor: isSelected ? '#f8fafc' : 'white',
                        boxShadow: isSelected ? `0 0 0 3px ${type.color}15` : 'none'
                      }}
                      title={isSelected ? `Selected: ${type.label}` : canSelect ? `Click to select ${type.label}` : 'You can only select up to 2 client types'}
                      aria-pressed={isSelected}
                    >
                      <div className="client-type-badge" style={{ backgroundColor: type.color }}>
                        {type.label}
                      </div>
                      {isSelected && (
                        <div
                          className="checkmark-overlay"
                          style={{ background: type.color }}
                        >
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedClientTypes.length > 0 && (
                <div style={{
                  marginTop: '0.75rem',
                  fontSize: '0.8125rem',
                  color: '#64748b',
                  fontWeight: 400,
                  padding: '0.625rem 0.875rem',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #f1f5f9'
                }}>
                  Selected ({selectedClientTypes.length}/2): <span style={{ fontWeight: 500, color: '#475569' }}>{selectedClientTypes.join(', ')}</span>
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Updating...' : 'Update Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectDetail;
