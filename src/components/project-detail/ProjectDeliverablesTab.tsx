import React from 'react';
import {
  FaChevronRight,
  FaCheckCircle,
  FaCircle,
  FaClock,
  FaCopy,
  FaEdit,
  FaExclamationTriangle,
  FaHistory,
  FaLink,
  FaPlus,
  FaStickyNote,
  FaTimes,
  FaTrash,
} from 'react-icons/fa';

const ProjectDeliverablesTab = (props: any) => {
  const {
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
    setEditingTask,
    setShowInlineEditTaskModal,
    copyTaskLink,
    handleApproveFile,
    updatingDeliverable,
    handleRequestRevisionClick,
    handleApproveDeliverable
  } = props;

  return (
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
              {deliverablesForDisplay.length > 0 && (
                <div className="deliverable-sub-tabs">
                  {deliverablesForDisplay.map((deliverable: any) => {
                    const isCustomDeliverable = deliverable.type === 'Other' || deliverable.customType;
                    const isEditing = editingDeliverableId === deliverable.id;
                    
                    return (
                      <div
                        key={deliverable.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          position: 'relative'
                        }}
                      >
                        {isEditing ? (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            background: 'white',
                            border: '2px solid #667eea',
                            borderRadius: '8px',
                            padding: '0.25rem 0.5rem'
                          }}>
                            <input
                              type="text"
                              value={editingDeliverableName}
                              onChange={(e) => setEditingDeliverableName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (editingDeliverableName.trim()) {
                                    handleUpdateCustomDeliverable(deliverable.id, editingDeliverableName);
                                  }
                                } else if (e.key === 'Escape') {
                                  setEditingDeliverableId(null);
                                  setEditingDeliverableName('');
                                }
                              }}
                              autoFocus
                              style={{
                                border: 'none',
                                outline: 'none',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                minWidth: '120px',
                                padding: '0.25rem'
                              }}
                            />
                            <button
                              onClick={() => {
                                if (editingDeliverableName.trim()) {
                                  handleUpdateCustomDeliverable(deliverable.id, editingDeliverableName);
                                }
                              }}
                              style={{
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '0.25rem 0.5rem',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="Save"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => {
                                setEditingDeliverableId(null);
                                setEditingDeliverableName('');
                              }}
                              style={{
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '0.25rem 0.5rem',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              className={`deliverable-sub-tab ${activeDeliverableTab === deliverable.id ? 'active' : ''} ${deliverableTaskCounts[deliverable.id] ? 'has-tasks' : ''}`}
                              onClick={() => setActiveDeliverableTab(deliverable.id)}
                              title={deliverableTaskCounts[deliverable.id] ? `${deliverableTaskCounts[deliverable.id]} task${deliverableTaskCounts[deliverable.id] === 1 ? '' : 's'}` : undefined}
                            >
                              {getDeliverableDisplayName(deliverable)}
                              {deliverableTaskCounts[deliverable.id] != null && (
                                <span className="deliverable-tab-badge">
                                  {deliverableTaskCounts[deliverable.id]}
                                </span>
                              )}
                            </button>
                            {isCustomDeliverable && canAssignOwners && (
                              <div style={{
                                display: 'flex',
                                gap: '0.125rem',
                                marginLeft: '0.25rem'
                              }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingDeliverableId(deliverable.id);
                                    setEditingDeliverableName(deliverable.customType || deliverable.type);
                                  }}
                                  style={{
                                    background: '#f3f4f6',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '0.25rem 0.375rem',
                                    cursor: 'pointer',
                                    color: '#667eea',
                                    fontSize: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'background 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                  title="Edit deliverable name"
                                >
                                  <FaEdit />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDeleteDeliverableConfirm(deliverable.id);
                                  }}
                                  style={{
                                    background: '#f3f4f6',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '0.25rem 0.375rem',
                                    cursor: 'pointer',
                                    color: '#dc2626',
                                    fontSize: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'background 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                  title="Delete deliverable"
                                >
                                  <FaTrash />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {isPrivateClient && deliverablesForDisplay.length === 0 && (
                <div
                  style={{
                    padding: '0.75rem 0.9rem',
                    borderRadius: '10px',
                    background: '#f8fafc',
                    border: '1px dashed #cbd5e1',
                    color: '#475569',
                    fontSize: '0.86rem',
                    lineHeight: 1.45,
                    marginRight: '0.75rem',
                  }}
                >
                  No deliverables set for this Private client yet. Create a custom deliverable or select an existing one when ready.
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
            {activeDeliverableTab && deliverablesForDisplay.length > 0 && (() => {
              const selectedDeliverable = deliverablesForDisplay.find((d: any) => d.id === activeDeliverableTab);
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
                        if (task.type === 'Copy' && ['Brand Book', 'Copy of Home Page', 'Speaker Kit', 'Other', 'Home Page'].includes(deliverableType)) {
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
                        if (task.type === 'Design' && ['Logo', 'Social Banners', 'Home Page', 'Brand Book'].includes(deliverableType)) {
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
                        if (task.type === 'Dev' && deliverableType === 'Home Page') {
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
                  if (['Brand Book', 'Copy of Home Page', 'Speaker Kit', 'Other'].includes(deliverableType)) {
                    dept = 'Copy Writing';
                  } else if (['Logo', 'Social Banners'].includes(deliverableType)) {
                    dept = 'Design';
                  } else if (deliverableType === 'Home Page') {
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
                
                // 0. Completed: Check if task is completed - this takes HIGH PRIORITY (after revision)
                // Completed tasks automatically go to "Approved/Completed" column
                if (relatedTask && (relatedTask.isCompleted || relatedTask.status === 'Completed')) {
                  // Check if it's in revision first (revision takes highest priority)
                  if (!isPlaceholder) {
                    const fileHistoryKey = `${selectedDeliverable.id}:${link.url}`;
                    const fileHistory = deliverableHistory[fileHistoryKey] || [];
                    const latestHistory = fileHistory[0];
                    const hasRevisionRequest = latestHistory?.action === 'Revision Requested';
                    const isDeliverableInRevision = selectedDeliverable.status === 'Revision';
                    
                    // If in revision, stay in revision (revision takes priority over completed)
                    if (hasRevisionRequest || isDeliverableInRevision) {
                      return 'revision';
                    }
                  }
                  // Not in revision, so move to approved/completed
                  return 'approved_completed';
                }
                
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
                    // Respect explicit task column marker first so UI column always matches selected status.
                    // Without this, revision/history fallback can incorrectly force cards into For Approval.
                    if (relatedTask) {
                      const desc: string = relatedTask.description || '';
                      if (desc.includes('--- Column: Revision ---')) {
                        return 'revision';
                      }
                      if (desc.includes('--- Column: QA Review ---')) {
                        return 'qa_before_client';
                      }
                      if (desc.includes('--- Column: Client Validation ---') || desc.includes('--- Column: Client Review ---')) {
                        return 'client_validation';
                      }
                      if (desc.includes('--- Column: For Approval ---')) {
                        return 'for_approval';
                      }
                    }

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
                // These only apply to standalone deliverable files (no related task).
                // Task-linked cards use the task's own status/column markers instead.
                if (!relatedTask && !isPlaceholder) {
                  if (selectedDeliverable.status === 'Approved') {
                    return 'approved_completed';
                  }
                  if (selectedDeliverable.status === 'Client Review') {
                    return 'client_validation';
                  }
                  if (selectedDeliverable.status === 'Ready for Review') {
                    const fileHistoryKey = `${selectedDeliverable.id}:${link.url}`;
                    const fileHistory = deliverableHistory[fileHistoryKey] || [];
                    const isInElliotReview = fileHistory[0]?.notes?.includes('Moved to Elliot Review');
                    if (isInElliotReview) {
                      return 'elliot_review';
                    }
                    return 'qa_before_client';
                  }
                }
                
                // Elliot Review: Check history for revision requests (set manually)
                // Only show if deliverable is NOT in 'Revision' status and file doesn't have revision request
                // Elliot Review is a manual staging area before actual revision
                // Note: Elliot Review is manually draggable - this section is kept for future use
                // Since revision takes priority, this won't be reached if revision is active
                
                // 2. For Approval / Review sub-stages:
                // When task is submitted for review (status = 'In Review'), use column markers on the task
                // to decide which review column it should live in.
                if (relatedTask && relatedTask.status === 'In Review') {
                  const desc: string = relatedTask.description || '';
                  
                  if (desc.includes('--- Column: Revision ---')) {
                    return 'revision';
                  }
                  if (desc.includes('--- Column: Elliot Review ---')) {
                    return 'elliot_review';
                  }
                  if (desc.includes('--- Column: QA Review ---')) {
                    return 'qa_before_client';
                  }
                  if (desc.includes('--- Column: Client Validation ---') || desc.includes('--- Column: Client Review ---')) {
                    return 'client_validation';
                  }
                  if (desc.includes('--- Column: For Approval ---')) {
                    return 'for_approval';
                  }
                  
                  // No marker = default to For Approval
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
                // { id: 'elliot_review', title: 'Elliot Review', files: relatedLinks.filter(l => getFileStatus(l) === 'elliot_review') },
                
                { id: 'approved_completed', title: 'Approved/Completed', files: relatedLinks.filter(l => getFileStatus(l) === 'approved_completed') },
                { id: 'qa_before_client', title: 'QA Before Sending to Client', files: relatedLinks.filter(l => getFileStatus(l) === 'qa_before_client') },
                { id: 'client_validation', title: 'Client Validation', files: relatedLinks.filter(l => getFileStatus(l) === 'client_validation') },
              ];

              // Drag and drop handlers for deliverables Kanban
              const handleFileDragStart = (e: React.DragEvent, link: any) => {
                setDraggedFile({
                  deliverableId: selectedDeliverable.id,
                  fileUrl: link.url,
                  department: link.department,
                  taskId: link.taskId
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

                // If this is a task (has taskId), allow dragging to any column
                // Placeholder tasks (url: "task-xxx") and tasks with files both support status updates
                if (draggedFile.taskId) {
                  try {
                    // For review columns, open a modal to capture notes/links
                    const modalColumns = [
                      'for_approval',
                      'revision',
                      'approved_completed',
                      'qa_before_client',
                      'client_validation',
                    ];

                    if (modalColumns.includes(targetColumnId)) {
                      const labelMap: Record<string, string> = {
                        for_approval: 'For Approval',
                        revision: 'Revision',
                        approved_completed: 'Approved/Completed',
                        qa_before_client: 'QA Before Sending to Client',
                        client_validation: 'Client Validation',
                      };

                      setStatusChangeContext({
                        taskId: draggedFile.taskId,
                        columnId: targetColumnId,
                        label: labelMap[targetColumnId] || targetColumnId,
                      });
                      setStatusChangeNotes('');
                      setStatusChangeAttachment('');
                      setShowStatusChangeModal(true);
                    } else {
                      // Simple columns can update immediately
                      await handleTaskStatusChange(draggedFile.taskId, targetColumnId);
                    }
                    
                    setDragOverColumn(null);
                    setDraggedFile(null);
                    return;
                  } catch (error: any) {
                    console.error('Failed to update task status:', error);
                    showToast(`Failed to move task: ${error?.message || 'Unknown error'}`);
                    setDragOverColumn(null);
                    setDraggedFile(null);
                    return;
                  }
                }

                const fileUrl = draggedFile.fileUrl;
                // Non-task files: only allow dropping on manual action columns
                if (fileUrl.startsWith('task-')) {
                  setDragOverColumn(null);
                  setDraggedFile(null);
                  return; // Placeholder links without taskId (shouldn't happen)
                }

                // Only allow dropping on manual action columns for deliverables (non-task files)
                // Automatic columns (not_started, owned_in_progress, for_approval) cannot be dragged to
                // Manual columns: revision, approved_completed, qa_before_client, client_validation
                const manualColumns = ['revision', 'approved_completed', 'qa_before_client', 'client_validation'];
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
                      setDeliverableHistory((prev: Record<string, any[]>) => ({
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
                                setNewTaskData({ department: '', notes: '', assignedToId: '', dueDate: '' });
                                setNewTaskLinks(['']);
                                setNewTaskFileUrls([]);
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
                            const relatedAssignees = relatedTask?.assignees || [];
                            const relatedAssigneeIds = relatedAssignees.length > 0
                              ? relatedAssignees.map((a: any) => a.userId || a.user?.id)
                              : (relatedTask?.assignedToId ? [relatedTask.assignedToId] : []);
                            const primaryAssigneeId = relatedAssigneeIds[0] || '';
                            const relatedOwnerName = primaryAssigneeId
                              ? (allUsers.find((u: any) => u.id === primaryAssigneeId)?.name || 'Unassigned')
                              : relatedTask?.assignedTo?.name;
                            const ownerName = link.assignedToName || relatedOwnerName || 'Unassigned';
                            const displayDate = link.updatedAt || link.createdAt || relatedTask?.updatedAt || relatedTask?.createdAt;
                            const formattedDate = displayDate ? new Date(displayDate).toLocaleString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : '';
                            
                            // Extract first sentence from task description for card title
                            const getTaskTitleFromDescription = (description: string | null | undefined): string => {
                              if (!description) return '';
                              // Remove column markers and status change logs
                              let cleanedDesc = description
                                .replace(/\n\n--- Column: [^-]+ ---/g, '')
                                .replace(/\n\n--- Status Change ---[\s\S]*/g, '')
                                .trim();
                              
                              // Remove leading newlines and whitespace
                              cleanedDesc = cleanedDesc.replace(/^\s*\n+\s*/, '').trim();
                              
                              if (!cleanedDesc) return '';
                              
                              // Split by newlines and take the first non-empty line
                              const firstLine = cleanedDesc.split('\n')[0]?.trim();
                              if (firstLine && firstLine.length > 0) {
                                // Extract first sentence (up to first period, exclamation, or question mark)
                                // If no punctuation, take the entire first line (up to 100 chars)
                                const firstSentenceMatch = firstLine.match(/^[^.!?\n]+[.!?]?/);
                                if (firstSentenceMatch) {
                                  let sentence = firstSentenceMatch[0].trim();
                                  // Remove trailing punctuation if it's just a single character (might be incomplete)
                                  if (sentence.length > 1 && /^[.!?]$/.test(sentence[sentence.length - 1])) {
                                    // Keep it if it's part of the sentence
                                  }
                                  // Limit to 100 characters for display
                                  return sentence.length > 100 ? sentence.substring(0, 100).trim() + '...' : sentence;
                                }
                                // If no sentence ending found, take first 100 characters of first line
                                return firstLine.length > 100 ? firstLine.substring(0, 100).trim() + '...' : firstLine;
                              }
                              
                              // Fallback: take first 100 characters of entire cleaned description
                              return cleanedDesc.length > 100 ? cleanedDesc.substring(0, 100).trim() + '...' : cleanedDesc;
                            };
                            // Prioritize description extraction over task.title - use first sentence of description as title
                            // This makes it easier to identify tasks at a glance
                            let taskTitle = '';
                            if (relatedTask?.description) {
                              taskTitle = getTaskTitleFromDescription(relatedTask.description);
                            }
                            
                            // Fallback to task.title if description extraction didn't work
                            if (!taskTitle && relatedTask?.title && relatedTask.title.trim()) {
                              taskTitle = relatedTask.title.trim();
                            }
                            
                            // Fallback to link.taskTitle if task.title also doesn't exist
                            if (!taskTitle && link.taskTitle && link.taskTitle.trim()) {
                              taskTitle = link.taskTitle.trim();
                            }
                            
                            // If we still don't have a title but have a task, use a default
                            if (!taskTitle && relatedTask) {
                              taskTitle = `${link.department} Task`;
                            }
                            
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
                                draggable
                                onDragStart={(e) => handleFileDragStart(e, link)}
                                onDragEnd={handleFileDragEnd}
                                onClick={() => {
                                  if (relatedTask) {
                                    setSelectedTaskDetail(relatedTask);
                                    setShowTaskDetailModal(true);
                                  }
                                }}
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
                                    relatedTask && editingTaskTitleId === relatedTask.id ? (
                                      <div style={{ 
                                        marginBottom: '0.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                      }}>
                                        <input
                                          type="text"
                                          value={editingTaskTitleValue}
                                          onChange={(e) => setEditingTaskTitleValue(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              if (editingTaskTitleValue.trim()) {
                                                handleSaveTaskTitle(relatedTask.id, editingTaskTitleValue);
                                              }
                                            } else if (e.key === 'Escape') {
                                              setEditingTaskTitleId(null);
                                              setEditingTaskTitleValue('');
                                            }
                                          }}
                                          autoFocus
                                          onClick={(e) => e.stopPropagation()}
                                          style={{
                                            flex: 1,
                                            padding: '0.375rem 0.5rem',
                                            fontSize: '0.9375rem',
                                            fontWeight: 600,
                                            color: '#1e293b',
                                            border: '2px solid #667eea',
                                            borderRadius: '6px',
                                            background: 'white',
                                            outline: 'none'
                                          }}
                                        />
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (editingTaskTitleValue.trim()) {
                                              handleSaveTaskTitle(relatedTask.id, editingTaskTitleValue);
                                            }
                                          }}
                                          style={{
                                            padding: '0.375rem 0.5rem',
                                            background: '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem'
                                          }}
                                          title="Save"
                                        >
                                          ✓
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingTaskTitleId(null);
                                            setEditingTaskTitleValue('');
                                          }}
                                          style={{
                                            padding: '0.375rem 0.5rem',
                                            background: '#ef4444',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem'
                                          }}
                                          title="Cancel"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ) : (
                                      <div 
                                        className="kanban-card-link" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (relatedTask && (canAssignOwners || relatedTask?.assignedToId === currentUser?.id)) {
                                            setEditingTaskTitleId(relatedTask.id);
                                            setEditingTaskTitleValue(taskTitle || link.department);
                                          }
                                        }}
                                        style={{ 
                                          fontWeight: 600, 
                                          fontSize: '0.9375rem', 
                                          color: '#1e293b',
                                          cursor: (relatedTask && (canAssignOwners || relatedTask?.assignedToId === currentUser?.id)) ? 'pointer' : 'default',
                                          padding: '0.25rem',
                                          borderRadius: '4px',
                                          transition: 'background-color 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                          if (relatedTask && (canAssignOwners || relatedTask?.assignedToId === currentUser?.id)) {
                                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = 'transparent';
                                        }}
                                        title={(relatedTask && (canAssignOwners || relatedTask?.assignedToId === currentUser?.id)) ? 'Click to edit title' : ''}
                                      >
                                        {taskTitle || link.department}
                                        <span className="kanban-card-assigned">Assigned</span>
                                      </div>
                                    )
                                  ) : (
                                    <>
                                      {taskTitle && relatedTask && (
                                        editingTaskTitleId === relatedTask.id ? (
                                          <div style={{ 
                                            marginBottom: '0.5rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                          }}>
                                            <input
                                              type="text"
                                              value={editingTaskTitleValue}
                                              onChange={(e) => setEditingTaskTitleValue(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  if (editingTaskTitleValue.trim()) {
                                                    handleSaveTaskTitle(relatedTask.id, editingTaskTitleValue);
                                                  }
                                                } else if (e.key === 'Escape') {
                                                  setEditingTaskTitleId(null);
                                                  setEditingTaskTitleValue('');
                                                }
                                              }}
                                              autoFocus
                                              onClick={(e) => e.stopPropagation()}
                                              style={{
                                                flex: 1,
                                                padding: '0.375rem 0.5rem',
                                                fontSize: '0.9375rem',
                                                fontWeight: 600,
                                                color: '#1e293b',
                                                border: '2px solid #667eea',
                                                borderRadius: '6px',
                                                background: 'white',
                                                outline: 'none'
                                              }}
                                            />
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (editingTaskTitleValue.trim()) {
                                                  handleSaveTaskTitle(relatedTask.id, editingTaskTitleValue);
                                                }
                                              }}
                                              style={{
                                                padding: '0.375rem 0.5rem',
                                                background: '#10b981',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.25rem'
                                              }}
                                              title="Save"
                                            >
                                              ✓
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingTaskTitleId(null);
                                                setEditingTaskTitleValue('');
                                              }}
                                              style={{
                                                padding: '0.375rem 0.5rem',
                                                background: '#ef4444',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.25rem'
                                              }}
                                              title="Cancel"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        ) : (
                                          <div 
                                            className="kanban-card-link"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (canAssignOwners || relatedTask?.assignedToId === currentUser?.id) {
                                                setEditingTaskTitleId(relatedTask.id);
                                                setEditingTaskTitleValue(taskTitle);
                                              }
                                            }}
                                            style={{ 
                                              fontWeight: 600, 
                                              fontSize: '0.9375rem',
                                              color: '#1e293b',
                                              marginBottom: '0.5rem',
                                              lineHeight: '1.4',
                                              cursor: (canAssignOwners || relatedTask?.assignedToId === currentUser?.id) ? 'pointer' : 'default',
                                              display: 'block',
                                              wordBreak: 'break-word',
                                              padding: '0.25rem',
                                              borderRadius: '4px',
                                              transition: 'background-color 0.2s'
                                            }}
                                            onMouseEnter={(e) => {
                                              if (canAssignOwners || relatedTask?.assignedToId === currentUser?.id) {
                                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                              }
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.backgroundColor = 'transparent';
                                            }}
                                            title={(canAssignOwners || relatedTask?.assignedToId === currentUser?.id) ? 'Click to edit title' : ''}
                                          >
                                            {taskTitle}
                                          </div>
                                        )
                                      )}
                                      <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="kanban-card-link"
                                        onClick={(e) => e.stopPropagation()}
                                        style={taskTitle ? {
                                          fontSize: '0.8125rem',
                                          color: '#64748b',
                                          fontWeight: 400,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.25rem'
                                        } : {}}
                                      >
                                        {link.department}
                                        <FaChevronRight className="kanban-link-icon" />
                                      </a>
                                    </>
                                  )}
                                </div>
                          <div className="kanban-card-meta">
                                  <div className="kanban-card-owner">
                                    <span className="kanban-meta-label">Owner:</span>
                                    <span className="kanban-meta-value">{ownerName}</span>
                                  </div>
                                  {project.pm?.name && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                      <span className="kanban-meta-label">PM:</span>
                                      <span className="kanban-meta-value" style={{ marginLeft: '0.25rem' }}>{project.pm.name}</span>
                                    </div>
                                  )}
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

                                  {canAssignOwners && link.taskId && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const relatedTaskForEdit = tasks.find((t: any) => t.id === link.taskId);
                                          if (!relatedTaskForEdit) return;
                                          setEditingTask(relatedTaskForEdit);
                                          setShowInlineEditTaskModal(true);
                                        }}
                                        style={{
                                          width: '100%',
                                          padding: '0.35rem 0.5rem',
                                          borderRadius: '6px',
                                          border: '1px solid #e5e7eb',
                                          background: '#f9fafb',
                                          color: '#374151',
                                          fontSize: '0.75rem',
                                          fontWeight: 500,
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '0.375rem',
                                          marginTop: '0.25rem'
                                        }}
                                      >
                                        <FaEdit style={{ fontSize: '0.7rem' }} />
                                        Edit Task
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const relatedTaskForLink = tasks.find((t: any) => t.id === link.taskId);
                                          if (!relatedTaskForLink) return;
                                          copyTaskLink(relatedTaskForLink);
                                        }}
                                        style={{
                                          width: '100%',
                                          padding: '0.35rem 0.5rem',
                                          borderRadius: '6px',
                                          border: '1px solid #e5e7eb',
                                          background: '#ffffff',
                                          color: '#374151',
                                          fontSize: '0.75rem',
                                          fontWeight: 500,
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '0.375rem',
                                          marginTop: '0.375rem'
                                        }}
                                      >
                                        <FaCopy style={{ fontSize: '0.7rem' }} />
                                        Copy Task Link
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
                                  
                                  {/* Status Dropdown - Show for tasks */}
                                  {relatedTask && (
                                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                                      <label style={{ 
                                        display: 'block', 
                                        fontSize: '0.75rem', 
                                        fontWeight: 500, 
                                        color: '#64748b', 
                                        marginBottom: '0.375rem' 
                                      }}>
                                        Status:
                                      </label>
                                      <select
                                        value={(() => {
                                          // Mirror DepartmentView/RoleDashboard kanban mapping so value corresponds to a kanban column id
                                          const task: any = relatedTask;
                                          
                                          // Revision takes priority even over completed
                                          if (task.description && task.description.includes('--- Column: Revision ---')) {
                                            return 'revision';
                                          }
                                          if (task.status === 'Revision' || task.status === 'Needs Revision') {
                                            return 'revision';
                                          }

                                          // Completed tasks → Approved/Completed column
                                          if (task.status === 'Completed' || task.isCompleted) {
                                            return 'approved_completed';
                                          }

                                          // Column markers for review stages
                                          if (task.status === 'In Review' && task.description) {
                                            if (task.description.includes('--- Column: Elliot Review ---')) {
                                              return 'elliot_review';
                                            }
                                            if (task.description.includes('--- Column: QA Review ---')) {
                                              return 'qa_before_client';
                                            }
                                            if (task.description.includes('--- Column: Client Validation ---') || task.description.includes('--- Column: Client Review ---')) {
                                              return 'client_validation';
                                            }
                                            if (task.description.includes('--- Column: For Approval ---')) {
                                              return 'for_approval';
                                            }
                                          }

                                          // Legacy explicit statuses used in dashboards
                                          if (task.status === 'Elliot Review') return 'elliot_review';
                                          if (task.status === 'QA Review' || task.status === 'QA') return 'qa_before_client';
                                          if (task.status === 'Client Review' || task.status === 'Client Validation') return 'client_validation';
                                          if (task.status === 'For Approval' || task.status === 'Ready for Review') return 'for_approval';

                                          // Default mapping for basics
                                          if (task.status === 'In Progress') return 'owned_in_progress';
                                          if (task.status === 'Todo' || !task.status) return 'not_started';

                                          return 'not_started';
                                        })()}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          
                                          const newColumnId = e.target.value;
                                          
                                          // Permission: PMs / team leads can move any task.
                                          // Regular users can only move tasks they are assigned to.
                                          const assignees = relatedTask.assignees || [];
                                          const assigneeIds = assignees.length > 0
                                            ? assignees.map((a: any) => a.userId || a.user?.id)
                                            : (relatedTask.assignedToId ? [relatedTask.assignedToId] : []);
                                          const isOwner = assigneeIds.includes(currentUser?.id);
                                          
                                          if (!canAssignOwners && !isOwner) {
                                            showToast('You can only update the status of tasks assigned to you.');
                                            return;
                                          }

                                          // For review columns, open a modal to capture notes/links
                                          const modalColumns = [
                                            'for_approval',
                                            'revision',
                                            'approved_completed',
                                            'qa_before_client',
                                            'client_validation',
                                          ];

                                          if (modalColumns.includes(newColumnId)) {
                                            const labelMap: Record<string, string> = {
                                              for_approval: 'For Approval',
                                              revision: 'Revision',
                                              approved_completed: 'Approved/Completed',
                                              qa_before_client: 'QA Before Sending to Client',
                                              client_validation: 'Client Validation',
                                            };

                                            setStatusChangeContext({
                                              taskId: relatedTask.id,
                                              columnId: newColumnId,
                                              label: labelMap[newColumnId] || newColumnId,
                                            });
                                            setStatusChangeNotes('');
                                            setStatusChangeAttachment('');
                                            setShowStatusChangeModal(true);
                                          } else {
                                            // Simple columns can update immediately
                                            handleTaskStatusChange(relatedTask.id, newColumnId);
                                          }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                          width: '100%',
                                          padding: '0.5rem',
                                          borderRadius: '6px',
                                          border: '1px solid #d1d5db',
                                          fontSize: '0.8125rem',
                                          background: 'white',
                                          color: '#1e293b',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.borderColor = '#667eea';
                                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.borderColor = '#d1d5db';
                                          e.currentTarget.style.boxShadow = 'none';
                                        }}
                                      >
                                        {/* Kanban-aligned values that map to specific columns; handler converts to backend enums */}
                                        <option value="not_started">Not Yet Started</option>
                                        <option value="owned_in_progress">Owned/In Progress</option>
                                        <option value="for_approval">For Approval</option>
                                        <option value="revision">Revision</option>
                                        <option value="approved_completed">Approved/Completed</option>
                                        <option value="qa_before_client">QA Before Sending to Client</option>
                                        <option value="client_validation">Client Validation</option>
                                      </select>
                                    </div>
                                  )}
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
                      // Copy tasks can link to: Brand Book, Copy of Home Page, Speaker Kit, Other, Home Page
                      if (task.type === 'Copy' && ['Brand Book', 'Copy of Home Page', 'Speaker Kit', 'Other', 'Home Page'].includes(deliverableType)) {
                        links.push({
                          department: 'Copy Writing',
                          type: task.fileUrl.includes('figma.com') ? 'Figma' : 'Google Drive',
                          url: task.fileUrl,
                          taskTitle: task.title
                        });
                      }
                      // Design tasks can link to: Logo, Social Banners, Home Page, Brand Book
                      if (task.type === 'Design' && ['Logo', 'Social Banners', 'Home Page', 'Brand Book'].includes(deliverableType)) {
                        links.push({
                          department: 'Design',
                          type: task.fileUrl.includes('figma.com') ? 'Figma' : 'Google Drive',
                          url: task.fileUrl,
                          taskTitle: task.title
                        });
                      }
                      // Dev tasks for Home Page (live URL)
                      if (task.type === 'Dev' && deliverableType === 'Home Page') {
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
                    if (['Brand Book', 'Copy of Home Page', 'Speaker Kit', 'Other'].includes(deliverableType)) {
                      dept = 'Copy Writing';
                    } else if (['Logo', 'Social Banners'].includes(deliverableType)) {
                      dept = 'Design';
                    } else if (deliverableType === 'Home Page') {
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
                  if (type === 'Home Page') {
                    return [
                      { name: 'Copy Writing', color: '#667eea', icon: '📝' },
                      { name: 'Design', color: '#8b5cf6', icon: '🎨' },
                      { name: 'Development', color: '#10b981', icon: '💻' }
                    ];
                  } else if (['Brand Book', 'Copy of Home Page', 'Speaker Kit', 'Other'].includes(type)) {
                    return [{ name: 'Copy Writing', color: '#667eea', icon: '📝' }];
                  } else if (['Logo', 'Social Banners'].includes(type)) {
                    return [{ name: 'Design', color: '#8b5cf6', icon: '🎨' }];
                  }
                  return [{ name: 'General', color: '#6b7280', icon: '📦' }];
                };

                const departments = getDeliverableDepartments(deliverable.type);
                
                // Get workflow stage context
                const getWorkflowContext = (status: string, type: string, depts: any[]) => {
                  if (type === 'Home Page') {
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

  );
};

export default ProjectDeliverablesTab;
