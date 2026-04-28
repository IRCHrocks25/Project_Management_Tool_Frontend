import React, { useEffect, useState } from 'react';
import {
  FaCheckCircle,
  FaCircle,
  FaPaperPlane,
  FaExclamationTriangle,
  FaLink,
  FaClipboard,
  FaEnvelope,
  FaTrash,
  FaEdit,
} from 'react-icons/fa';
import { projectService } from '../../services/project.service';
import { authService } from '../../services/auth.service';

interface ProjectOverviewTabProps {
  project: any;
  daysInStage: number;
  deliverableHistory: Record<string, any[]>;
  tasks: any[];
  onProjectUpdated?: (project: any) => void;
  setActiveTab: (tab: string) => void;
  setActiveDeliverableTab: (deliverableId: string) => void;
  setShowFilesLinksModal: (show: boolean) => void;
  getAllFilesAndLinks: any[];
  handleTaskComplete: (taskId: string, isCompleted: boolean) => void;
  handleCloseProject: () => void;
}

type ProjectNoteItem = {
  id: string;
  content: string;
  createdAt: string;
  createdById?: string;
  createdByName?: string;
  updatedAt?: string;
  updatedById?: string;
  updatedByName?: string;
};

const parseProjectNotes = (rawNotes: unknown): ProjectNoteItem[] => {
  if (typeof rawNotes !== 'string' || rawNotes.trim().length === 0) return [];

  const trimmed = rawNotes.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && typeof item.content === 'string' && item.content.trim().length > 0)
          .map((item) => ({
            id: item.id || `note-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            content: String(item.content).trim(),
            createdAt: item.createdAt || new Date().toISOString(),
            createdById: item.createdById,
            createdByName: item.createdByName,
            updatedAt: item.updatedAt,
            updatedById: item.updatedById,
            updatedByName: item.updatedByName,
          }));
      }
    } catch (error) {
      console.warn('Failed to parse project notes JSON. Falling back to legacy notes.', error);
    }
  }

  return [
    {
      id: `legacy-${Date.now()}`,
      content: trimmed,
      createdAt: new Date().toISOString(),
      createdByName: 'Unknown',
    },
  ];
};

const serializeProjectNotes = (notes: ProjectNoteItem[]): string =>
  JSON.stringify(
    notes.map((note) => ({
      id: note.id,
      content: note.content,
      createdAt: note.createdAt,
      createdById: note.createdById,
      createdByName: note.createdByName,
      updatedAt: note.updatedAt,
      updatedById: note.updatedById,
      updatedByName: note.updatedByName,
    })),
  );

const ProjectOverviewTab: React.FC<ProjectOverviewTabProps> = ({
  project,
  daysInStage,
  deliverableHistory,
  tasks,
  onProjectUpdated,
  setActiveTab,
  setActiveDeliverableTab,
  setShowFilesLinksModal,
  getAllFilesAndLinks,
  handleTaskComplete,
  handleCloseProject,
}) => {
  const currentUser = authService.getUser();
  const [projectNotes, setProjectNotes] = useState<ProjectNoteItem[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesStatus, setNotesStatus] = useState<string | null>(null);

  useEffect(() => {
    setProjectNotes(parseProjectNotes(project?.notes));
    setNewNoteText('');
    setEditingNoteId(null);
    setEditingNoteText('');
  }, [project?.id, project?.notes]);

  const persistProjectNotes = async (nextNotes: ProjectNoteItem[], successMessage: string) => {
    if (!project?.id || isSavingNotes) return;

    try {
      setIsSavingNotes(true);
      setNotesStatus(null);
      const normalizedNotes = nextNotes.length > 0 ? serializeProjectNotes(nextNotes) : '';
      const updatedProject = await projectService.update(project.id, {
        notes: normalizedNotes,
      });
      const mergedProject = updatedProject || { ...project, notes: normalizedNotes };
      onProjectUpdated?.(mergedProject);
      setProjectNotes(nextNotes);
      setNotesStatus(successMessage);
    } catch (error: any) {
      console.error('Failed to save project notes:', error);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to save notes';
      setNotesStatus(Array.isArray(message) ? message.join(', ') : String(message));
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleAddNote = async () => {
    const content = newNoteText.trim();
    if (!content || isSavingNotes) return;
    const nextNotes: ProjectNoteItem[] = [
      {
        id: `note-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        content,
        createdAt: new Date().toISOString(),
        createdById: currentUser?.id,
        createdByName: currentUser?.name || currentUser?.email || 'Unknown',
      },
      ...projectNotes,
    ];
    await persistProjectNotes(nextNotes, 'Note added');
    setNewNoteText('');
  };

  const handleDeleteNote = async (noteId: string) => {
    if (isSavingNotes) return;
    const shouldDelete = window.confirm('Delete this note? This action cannot be undone.');
    if (!shouldDelete) return;
    const nextNotes = projectNotes.filter((note) => note.id !== noteId);
    await persistProjectNotes(nextNotes, 'Note deleted');
    if (editingNoteId === noteId) {
      setEditingNoteId(null);
      setEditingNoteText('');
    }
  };

  const startEditingNote = (note: ProjectNoteItem) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.content);
    setNotesStatus(null);
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditingNoteText('');
    setNotesStatus(null);
  };

  const saveEditedNote = async () => {
    if (!editingNoteId || isSavingNotes) return;
    const updatedContent = editingNoteText.trim();
    if (!updatedContent) return;
    const nextNotes = projectNotes.map((note) =>
      note.id === editingNoteId
        ? {
            ...note,
            content: updatedContent,
            updatedAt: new Date().toISOString(),
            updatedById: currentUser?.id,
            updatedByName: currentUser?.name || currentUser?.email || 'Unknown',
          }
        : note,
    );
    await persistProjectNotes(nextNotes, 'Note updated');
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  return (
    <div className="tab-content fade-in">
      <div className="overview-grid premium-grid overview-grid-pro">
        <div className="overview-card premium-card overview-card--details">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.95rem',
            }}
          >
            <h3 className="card-title" style={{ margin: 0 }}>Project Details</h3>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#475569',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '999px',
                padding: '0.2rem 0.55rem',
              }}
            >
              {project?.stage || 'Active'}
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '0.7rem',
            }}
          >
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
              <div style={{ fontSize: '0.69rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>PM</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginTop: '0.15rem' }}>{project.pm?.name || 'Unassigned'}</div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
              <div style={{ fontSize: '0.69rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Package</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginTop: '0.15rem' }}>{project.package || '-'}</div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
              <div style={{ fontSize: '0.69rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Target Close</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginTop: '0.15rem' }}>
                {new Date(project.targetCloseMonth + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
              <div style={{ fontSize: '0.69rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Days in Stage</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginTop: '0.15rem' }}>{daysInStage} {daysInStage === 1 ? 'day' : 'days'}</div>
            </div>
          </div>
        </div>

        <div className="overview-card premium-card overview-card--details">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.8rem',
            }}
          >
            <h3 className="card-title" style={{ margin: 0 }}>Project Notes</h3>
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
              Internal notes ({projectNotes.length})
            </span>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.7rem', background: '#f8fafc' }}>
            <textarea
              value={newNoteText}
              onChange={(e) => {
                setNewNoteText(e.target.value);
                if (notesStatus) setNotesStatus(null);
              }}
              rows={3}
              placeholder="Write a new project note..."
              style={{
                width: '100%',
                resize: 'vertical',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                padding: '0.65rem 0.75rem',
                fontSize: '0.82rem',
                color: '#0f172a',
                lineHeight: 1.45,
                fontFamily: 'inherit',
                background: '#fff',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.55rem' }}>
              <button
                type="button"
                onClick={handleAddNote}
                disabled={isSavingNotes || newNoteText.trim().length === 0}
                style={{
                  border: 'none',
                  background: isSavingNotes || newNoteText.trim().length === 0 ? '#94a3b8' : '#2563eb',
                  color: '#fff',
                  borderRadius: '6px',
                  padding: '0.34rem 0.72rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: isSavingNotes || newNoteText.trim().length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {isSavingNotes ? 'Saving...' : 'Add Note'}
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: '0.7rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
              maxHeight: '320px',
              overflowY: 'auto',
              paddingRight: '0.1rem',
            }}
          >
            {projectNotes.length === 0 ? (
              <div
                style={{
                  border: '1px dashed #cbd5e1',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '0.78rem',
                  background: '#fff',
                }}
              >
                No notes yet. Add the first note above.
              </div>
            ) : (
              projectNotes.map((note) => {
                const isEditing = editingNoteId === note.id;
                return (
                  <div
                    key={note.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: '#fff',
                      padding: '0.62rem 0.68rem',
                    }}
                  >
                    {isEditing ? (
                      <>
                        <textarea
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          rows={3}
                          style={{
                            width: '100%',
                            resize: 'vertical',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            padding: '0.55rem 0.65rem',
                            fontSize: '0.8rem',
                            lineHeight: 1.45,
                            fontFamily: 'inherit',
                            color: '#0f172a',
                          }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.45rem' }}>
                          <button
                            type="button"
                            onClick={cancelEditingNote}
                            disabled={isSavingNotes}
                            style={{
                              border: '1px solid #cbd5e1',
                              background: '#fff',
                              color: '#334155',
                              borderRadius: '6px',
                              padding: '0.28rem 0.58rem',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: isSavingNotes ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={saveEditedNote}
                            disabled={isSavingNotes || editingNoteText.trim().length === 0}
                            style={{
                              border: 'none',
                              background:
                                isSavingNotes || editingNoteText.trim().length === 0
                                  ? '#94a3b8'
                                  : '#2563eb',
                              color: '#fff',
                              borderRadius: '6px',
                              padding: '0.28rem 0.58rem',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor:
                                isSavingNotes || editingNoteText.trim().length === 0
                                  ? 'not-allowed'
                                  : 'pointer',
                            }}
                          >
                            Save
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div
                          style={{
                            whiteSpace: 'pre-wrap',
                            fontSize: '0.81rem',
                            color: '#0f172a',
                            lineHeight: 1.45,
                          }}
                        >
                          {note.content}
                        </div>
                        <div
                          style={{
                            marginTop: '0.45rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '0.5rem',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            By {note.createdByName || 'Unknown'} •{' '}
                            {new Date(note.updatedAt || note.createdAt).toLocaleString()}
                            {note.updatedByName ? ` • Edited by ${note.updatedByName}` : ''}
                          </span>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button
                              type="button"
                              onClick={() => startEditingNote(note)}
                              disabled={isSavingNotes}
                              style={{
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                color: '#334155',
                                borderRadius: '6px',
                                padding: '0.24rem 0.5rem',
                                fontSize: '0.71rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                cursor: isSavingNotes ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <FaEdit style={{ fontSize: '0.65rem' }} />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteNote(note.id)}
                              disabled={isSavingNotes}
                              style={{
                                border: '1px solid #fecaca',
                                background: '#fff1f2',
                                color: '#b91c1c',
                                borderRadius: '6px',
                                padding: '0.24rem 0.5rem',
                                fontSize: '0.71rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                cursor: isSavingNotes ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <FaTrash style={{ fontSize: '0.65rem' }} />
                              Delete
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '0.65rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <span
              style={{
                fontSize: '0.72rem',
                color: notesStatus && notesStatus.toLowerCase().includes('fail') ? '#dc2626' : '#64748b',
              }}
            >
              {notesStatus || 'Add, edit, and delete notes. New notes are added to the top.'}
            </span>
            <div />
          </div>
        </div>

        <div className="overview-card premium-card overview-card--activity">
          <h3 className="card-title">Recent Activity</h3>
          {(() => {
            const allActivities: any[] = [];

            Object.keys(deliverableHistory).forEach((key) => {
              const history = deliverableHistory[key];
              if (!history || !Array.isArray(history) || history.length === 0) return;

              const parts = key.split(':');
              const deliverableId = parts[0];
              const fileUrl = parts[1];

              let deliverable = project?.deliverables?.find((d: any) => d.id === deliverableId);
              if (!deliverable) deliverable = project?.deliverables?.find((d: any) => d.id === key);
              if (!deliverable) return;

              const deliverableType = deliverable.customType || deliverable.type || 'Deliverable';

              history.forEach((entry: any, index: number) => {
                const action = entry.action || entry.status || '';
                const actionLower = action.toLowerCase();
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
                    key: `${key}-${index}-${entry.id || entry.createdAt || Date.now()}`,
                  });
                }
              });
            });

            if (tasks && tasks.length > 0) {
              tasks.forEach((task: any) => {
                if (task.fileUrl || task.status === 'In Review') {
                  const deliverable = task.deliverableId
                    ? project?.deliverables?.find((d: any) => d.id === task.deliverableId)
                    : null;

                  if (deliverable || task.type === 'Copy' || task.type === 'Design') {
                    const deliverableType = deliverable
                      ? (deliverable.customType || deliverable.type || 'Task')
                      : `${task.type} Task`;

                    if (task.fileUrl && task.status === 'In Review') {
                      allActivities.push({
                        action: 'Submitted for Review',
                        status: 'In Review',
                        createdAt: task.updatedAt || task.createdAt,
                        user: task.assignedTo || { name: 'System' },
                        deliverableId: task.deliverableId,
                        deliverableType,
                        fileUrl: task.fileUrl,
                        key: `task-${task.id}-submitted`,
                      });
                    }
                  }
                }
              });
            }

            allActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
                    setActiveTab('deliverables');
                    if (activity.deliverableId) setActiveDeliverableTab(activity.deliverableId);
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
                        cursor: 'pointer',
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
                      <div style={{ flexShrink: 0, marginTop: '0.125rem', fontSize: '0.875rem' }}>
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

        <div className="overview-card premium-card overview-card--revisions">
          <h3 className="card-title">Revisions</h3>
          {(() => {
            const allRevisions: any[] = [];

            Object.keys(deliverableHistory).forEach((key) => {
              const history = deliverableHistory[key];
              if (history.length === 0) return;

              const latestEntry = history[0];
              if (latestEntry.action === 'Revision Requested') {
                const [deliverableId] = key.split(':');
                const deliverable = project?.deliverables?.find((d: any) => d.id === deliverableId);

                const fileUrl = latestEntry.fileUrl;
                let relatedTask = tasks.find((t: any) => t.fileUrl === fileUrl);
                if (!relatedTask && deliverableId) relatedTask = tasks.find((t: any) => t.deliverableId === deliverableId);
                const isResubmitted = relatedTask && relatedTask.status === 'In Review';

                let department = 'Copy Writing';
                const deliverableType = deliverable?.type || deliverable?.customType || '';

                if (relatedTask) {
                  if (relatedTask.type === 'Design') department = 'Design';
                  else if (relatedTask.type === 'Copy') department = 'Copy Writing';
                  else if (relatedTask.type === 'AI') department = 'AI Developer';
                  else if (relatedTask.type === 'Dev') department = 'Development';
                  else if (relatedTask.type === 'Social Media') department = 'Social Media';
                  else if (relatedTask.type === 'SEO/GEO') department = 'SEO/GEO';
                  else if (relatedTask.type === 'CRM') department = 'CRM';
                } else {
                  if (['Logo', 'Social Banners', 'Speaker Kit'].includes(deliverableType)) department = 'Design';
                  else if (deliverableType === 'Home Page') department = 'Design';
                  else if (['Brand Book', 'Copy of Home Page', 'Other'].includes(deliverableType)) department = 'Copy Writing';
                }

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

                  let departmentColor = '#3b82f6';
                  if (revision.department === 'Design') departmentColor = '#8b5cf6';
                  else if (revision.department === 'AI Developer') departmentColor = '#10b981';
                  else if (revision.department === 'Copy Writing') departmentColor = '#3b82f6';
                  else if (revision.department === 'Development') departmentColor = '#f59e0b';
                  else if (revision.department === 'Social Media') departmentColor = '#ec4899';
                  else if (revision.department === 'SEO/GEO') departmentColor = '#06b6d4';
                  else if (revision.department === 'CRM') departmentColor = '#6366f1';

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
                        gap: '0.5rem',
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
                                color: departmentColor,
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
                                  fontSize: '0.75rem',
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

        <div
          className="overview-card premium-card overview-card--files"
          style={{ cursor: 'pointer' }}
          onClick={() => setShowFilesLinksModal(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Files/Links</h3>
            <div style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '12px',
              background: '#f0f4ff',
              color: '#667eea',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}>
              {getAllFilesAndLinks.length}
            </div>
          </div>
          {(() => {
            const previewLinks = getAllFilesAndLinks.slice(0, 3);

            if (previewLinks.length === 0) {
              return (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                  No files or links shared yet
                </div>
              );
            }

            const formatLinkDisplay = (url: string) => {
              try {
                const urlObj = new URL(url);
                const display = urlObj.hostname + (urlObj.pathname.length > 20 ? urlObj.pathname.substring(0, 20) + '...' : urlObj.pathname);
                return display.length > 40 ? display.substring(0, 40) + '...' : display;
              } catch {
                return url.length > 40 ? url.substring(0, 40) + '...' : url;
              }
            };

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {previewLinks.map((link: any) => (
                  <div
                    key={link.id}
                    style={{
                      padding: '0.625rem',
                      background: '#fafbfc',
                      borderRadius: '6px',
                      border: '1px solid #e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      background: link.sourceType === 'Task' ? '#dbeafe' : '#fef3c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {link.sourceType === 'Task' ? (
                        <FaClipboard style={{ color: '#3b82f6', fontSize: '0.75rem' }} />
                      ) : (
                        <FaEnvelope style={{ color: '#f59e0b', fontSize: '0.75rem' }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        color: '#1e293b',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {formatLinkDisplay(link.url)}
                      </div>
                    </div>
                  </div>
                ))}
                {getAllFilesAndLinks.length > 3 && (
                  <div style={{
                    padding: '0.625rem',
                    textAlign: 'center',
                    fontSize: '0.8125rem',
                    color: '#667eea',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}>
                    View all {getAllFilesAndLinks.length} files/links →
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {(() => {
          const completedTasks = tasks.filter((t: any) => t.isCompleted && t.fileUrl);
          if (completedTasks.length === 0) return null;

          return (
            <div className="overview-card premium-card overview-card--completed">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FaCheckCircle style={{ color: '#10b981', fontSize: '1.25rem' }} />
                  <h3 className="card-title" style={{ margin: 0 }}>Completed Deliverables</h3>
                </div>
                <div style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '12px',
                  background: '#d1fae5',
                  color: '#065f46',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}>
                  {completedTasks.length}
                </div>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '1rem' }}>
                Completed tasks with files stored for client access
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {completedTasks.slice(0, 5).map((task: any) => {
                  const formatLinkDisplay = (url: string) => {
                    try {
                      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
                      return urlObj.hostname + urlObj.pathname.substring(0, 30) + (urlObj.pathname.length > 30 ? '...' : '');
                    } catch {
                      return url.length > 40 ? url.substring(0, 40) + '...' : url;
                    }
                  };

                  return (
                    <div
                      key={task.id}
                      style={{
                        padding: '0.875rem',
                        background: '#f0fdf4',
                        borderRadius: '8px',
                        border: '1px solid #bbf7d0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#dcfce7';
                        e.currentTarget.style.borderColor = '#86efac';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f0fdf4';
                        e.currentTarget.style.borderColor = '#bbf7d0';
                      }}
                    >
                      <FaCheckCircle style={{ color: '#10b981', fontSize: '1rem', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: '#1e293b',
                          marginBottom: '0.25rem',
                        }}>
                          {task.title}
                        </div>
                        <a
                          href={task.fileUrl.startsWith('http') ? task.fileUrl : `https://${task.fileUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            fontSize: '0.75rem',
                            color: '#667eea',
                            textDecoration: 'none',
                            wordBreak: 'break-all',
                            display: 'block',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.textDecoration = 'underline';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.textDecoration = 'none';
                          }}
                        >
                          {formatLinkDisplay(task.fileUrl)}
                        </a>
                      </div>
                      <button
                        onClick={() => handleTaskComplete(task.id, false)}
                        style={{
                          background: 'transparent',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          padding: '0.375rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#6b7280',
                          transition: 'all 0.2s',
                          flexShrink: 0,
                        }}
                        title="Mark as incomplete"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f3f4f6';
                          e.currentTarget.style.borderColor = '#9ca3af';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = '#d1d5db';
                        }}
                      >
                        <FaCircle style={{ fontSize: '0.75rem' }} />
                      </button>
                    </div>
                  );
                })}
                {completedTasks.length > 5 && (
                  <div style={{
                    padding: '0.625rem',
                    textAlign: 'center',
                    fontSize: '0.8125rem',
                    color: '#667eea',
                    fontWeight: 500,
                  }}>
                    +{completedTasks.length - 5} more completed tasks
                  </div>
                )}
              </div>
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                <button
                  onClick={() => setShowFilesLinksModal(true)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <FaLink style={{ marginRight: '0.5rem' }} />
                  View All Files & Links
                </button>
              </div>
            </div>
          );
        })()}

        {project.stage === 'Ready to Close' && (
          <div className="overview-card premium-card overview-card--closure closure-card-premium">
            <h3 className="card-title">Ready to Close</h3>
            <p className="closure-text">All deliverables are complete. Click below to close the project.</p>
            <button onClick={handleCloseProject} className="btn-primary-premium">
              Close Project
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectOverviewTab;
