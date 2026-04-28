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

const getStageBadgeClass = (stage: string) => {
  const s = (stage || '').toLowerCase();
  if (s.includes('close') || s.includes('complet')) return 'stage-badge stage-badge--close';
  if (s.includes('review') || s.includes('ready')) return 'stage-badge stage-badge--review';
  if (s.includes('active') || s.includes('progress') || s.includes('onboard')) return 'stage-badge stage-badge--active';
  return 'stage-badge stage-badge--default';
};

const getDeptColor = (dept: string): string => {
  const map: Record<string, string> = {
    Design: '#8b5cf6',
    'AI Developer': '#10b981',
    'Copy Writing': '#3b82f6',
    Development: '#f59e0b',
    'Social Media': '#ec4899',
    'SEO/GEO': '#06b6d4',
    CRM: '#6366f1',
  };
  return map[dept] || '#3b82f6';
};

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

const formatLinkDisplay = (url: string, max = 40) => {
  try {
    const u = new URL(url);
    const s = u.hostname + (u.pathname.length > 20 ? u.pathname.substring(0, 20) + '…' : u.pathname);
    return s.length > max ? s.substring(0, max) + '…' : s;
  } catch {
    return url.length > max ? url.substring(0, max) + '…' : url;
  }
};

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
      const updatedProject = await projectService.update(project.id, { notes: normalizedNotes });
      const mergedProject = updatedProject || { ...project, notes: normalizedNotes };
      onProjectUpdated?.(mergedProject);
      setProjectNotes(nextNotes);
      setNotesStatus(successMessage);
    } catch (error: any) {
      console.error('Failed to save project notes:', error);
      const message = error?.response?.data?.message || error?.message || 'Failed to save notes';
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
    if (!window.confirm('Delete this note? This action cannot be undone.')) return;
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

  // ── Derived data for activity feed ──────────────────────────────────
  const buildActivities = () => {
    const all: any[] = [];
    Object.keys(deliverableHistory).forEach((key) => {
      const history = deliverableHistory[key];
      if (!history || !Array.isArray(history) || history.length === 0) return;
      const [deliverableId, fileUrl] = key.split(':');
      let deliverable = project?.deliverables?.find((d: any) => d.id === deliverableId);
      if (!deliverable) deliverable = project?.deliverables?.find((d: any) => d.id === key);
      if (!deliverable) return;
      const deliverableType = deliverable.customType || deliverable.type || 'Deliverable';
      history.forEach((entry: any, index: number) => {
        const actionLower = (entry.action || entry.status || '').toLowerCase();
        const important =
          actionLower.includes('approved') || actionLower.includes('revision') ||
          actionLower.includes('submitted') || actionLower.includes('review') ||
          actionLower.includes('ready') || actionLower.includes('status changed') ||
          actionLower.includes('created');
        if (important) {
          all.push({
            ...entry,
            deliverableId: deliverableId || key,
            deliverableType,
            fileUrl: entry.fileUrl || fileUrl,
            key: `${key}-${index}-${entry.id || entry.createdAt || Date.now()}`,
          });
        }
      });
    });
    if (tasks?.length > 0) {
      tasks.forEach((task: any) => {
        if (task.fileUrl || task.status === 'In Review') {
          const deliverable = task.deliverableId
            ? project?.deliverables?.find((d: any) => d.id === task.deliverableId)
            : null;
          if (deliverable || task.type === 'Copy' || task.type === 'Design') {
            const deliverableType = deliverable
              ? deliverable.customType || deliverable.type || 'Task'
              : `${task.type} Task`;
            if (task.fileUrl && task.status === 'In Review') {
              all.push({
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
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return all.slice(0, 10);
  };

  const getActivityIconClass = (action: string) => {
    if (action?.includes('Approved')) return 'act-icon act-icon--approved';
    if (action?.includes('Revision')) return 'act-icon act-icon--revision';
    if (action?.includes('Submitted') || action?.includes('Review')) return 'act-icon act-icon--submitted';
    return 'act-icon act-icon--default';
  };

  const getActivityIcon = (action: string) => {
    if (action?.includes('Approved')) return <FaCheckCircle />;
    if (action?.includes('Revision')) return <FaExclamationTriangle />;
    if (action?.includes('Submitted') || action?.includes('Review')) return <FaPaperPlane />;
    return <FaCircle />;
  };

  // ── Derived data for revisions ───────────────────────────────────────
  const buildRevisions = () => {
    const all: any[] = [];
    Object.keys(deliverableHistory).forEach((key) => {
      const history = deliverableHistory[key];
      if (history.length === 0) return;
      const latestEntry = history[0];
      if (latestEntry.action !== 'Revision Requested') return;
      const [deliverableId] = key.split(':');
      const deliverable = project?.deliverables?.find((d: any) => d.id === deliverableId);
      const fileUrl = latestEntry.fileUrl;
      let relatedTask = tasks.find((t: any) => t.fileUrl === fileUrl);
      if (!relatedTask && deliverableId) relatedTask = tasks.find((t: any) => t.deliverableId === deliverableId);
      const isResubmitted = relatedTask && relatedTask.status === 'In Review';
      if (isResubmitted) return;

      const deliverableType = deliverable?.type || deliverable?.customType || '';
      let department = 'Copy Writing';
      if (relatedTask) {
        const map: Record<string, string> = {
          Design: 'Design', Copy: 'Copy Writing', AI: 'AI Developer',
          Dev: 'Development', 'Social Media': 'Social Media', 'SEO/GEO': 'SEO/GEO', CRM: 'CRM',
        };
        department = map[relatedTask.type] || 'Copy Writing';
      } else {
        if (['Logo', 'Social Banners', 'Speaker Kit', 'Home Page'].includes(deliverableType)) department = 'Design';
        else if (['Brand Book', 'Copy of Home Page', 'Other'].includes(deliverableType)) department = 'Copy Writing';
      }
      all.push({ ...latestEntry, deliverableType, deliverableId, department, fileUrl: latestEntry.fileUrl });
    });
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return all;
  };

  const recentActivities = buildActivities();
  const allRevisions = buildRevisions();
  const completedTasks = tasks.filter((t: any) => t.isCompleted && t.fileUrl);

  return (
    <div className="tab-content fade-in">
      <div className="overview-grid premium-grid overview-grid-pro">

        {/* ── Project Details ── */}
        <div className="overview-card premium-card overview-card--details">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Project Details</h3>
            <span className={getStageBadgeClass(project?.stage)}>{project?.stage || 'Active'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
            <div className="stat-tile">
              <div className="stat-tile-label">PM</div>
              <div className="stat-tile-value">{project.pm?.name || 'Unassigned'}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-label">Package</div>
              <div className="stat-tile-value">{project.package || '—'}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-label">Target Close</div>
              <div className="stat-tile-value">
                {new Date(project.targetCloseMonth + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-label">Days in Stage</div>
              <div className="stat-tile-value">{daysInStage} {daysInStage === 1 ? 'day' : 'days'}</div>
            </div>
          </div>
        </div>

        {/* ── Project Notes ── */}
        <div className="overview-card premium-card overview-card--notes">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Project Notes</h3>
            <span style={{ fontSize: '0.71rem', color: '#64748b', fontWeight: 600 }}>
              {projectNotes.length} {projectNotes.length === 1 ? 'note' : 'notes'}
            </span>
          </div>

          <div className="notes-input-area">
            <textarea
              className="notes-textarea"
              value={newNoteText}
              onChange={(e) => { setNewNoteText(e.target.value); if (notesStatus) setNotesStatus(null); }}
              rows={3}
              placeholder="Write a new project note…"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn-add-note"
                onClick={handleAddNote}
                disabled={isSavingNotes || newNoteText.trim().length === 0}
              >
                {isSavingNotes ? 'Saving…' : 'Add Note'}
              </button>
            </div>
          </div>

          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto', paddingRight: '0.1rem', minHeight: 0 }}>
            {projectNotes.length === 0 ? (
              <div style={{ border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '0.875rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem' }}>
                No notes yet. Add the first note above.
              </div>
            ) : (
              projectNotes.map((note) => {
                const isEditing = editingNoteId === note.id;
                return (
                  <div key={note.id} className="note-item">
                    {isEditing ? (
                      <>
                        <textarea
                          className="notes-textarea"
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          rows={3}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.45rem' }}>
                          <button type="button" className="btn-note btn-note--cancel" onClick={cancelEditingNote} disabled={isSavingNotes}>Cancel</button>
                          <button type="button" className="btn-note btn-note--save" onClick={saveEditedNote} disabled={isSavingNotes || editingNoteText.trim().length === 0}>
                            {isSavingNotes ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="note-content">{note.content}</div>
                        <div style={{ marginTop: '0.45rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span className="note-meta">
                            By {note.createdByName || 'Unknown'} · {new Date(note.updatedAt || note.createdAt).toLocaleString()}
                            {note.updatedByName ? ` · Edited by ${note.updatedByName}` : ''}
                          </span>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button type="button" className="btn-note btn-note--edit" onClick={() => startEditingNote(note)} disabled={isSavingNotes}>
                              <FaEdit style={{ fontSize: '0.63rem' }} /> Edit
                            </button>
                            <button type="button" className="btn-note btn-note--delete" onClick={() => handleDeleteNote(note.id)} disabled={isSavingNotes}>
                              <FaTrash style={{ fontSize: '0.63rem' }} /> Delete
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

          <div style={{ marginTop: '0.6rem' }}>
            <span className={`notes-status${notesStatus?.toLowerCase().includes('fail') ? ' notes-status--error' : ''}`}>
              {notesStatus || 'New notes are prepended to the top.'}
            </span>
          </div>
        </div>

        {/* ── Recent Activity ── */}
        <div className="overview-card premium-card overview-card--activity">
          <h3 className="card-title">Recent Activity</h3>
          {recentActivities.length === 0 ? (
            <div style={{ padding: '1.25rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
              No recent activity
            </div>
          ) : (
            <div className="activity-notifications-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {recentActivities.map((activity) => {
                const userName = activity.user?.name || 'System';
                const actionText = activity.action || 'Status Changed';
                const fileName = activity.fileUrl ? activity.fileUrl.split('/').pop()?.substring(0, 28) + '…' : '';
                return (
                  <div
                    key={activity.key}
                    className="activity-notification-item"
                    onClick={() => { setActiveTab('deliverables'); if (activity.deliverableId) setActiveDeliverableTab(activity.deliverableId); }}
                    style={{ padding: '0.75rem 0.875rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}
                  >
                    <div className={getActivityIconClass(actionText)}>
                      {getActivityIcon(actionText)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.18rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#111827', fontSize: '0.84rem' }}>{userName}</span>
                        <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{actionText}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: '#374151', fontSize: '0.8rem' }}>{activity.deliverableType}</span>
                        {fileName && (
                          <>
                            <span style={{ color: '#cbd5e1' }}>·</span>
                            <span style={{ color: '#94a3b8', fontSize: '0.73rem', fontFamily: 'monospace' }}>{fileName}</span>
                          </>
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>{formatTime(activity.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Revisions ── */}
        <div className="overview-card premium-card overview-card--revisions">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Revisions</h3>
            {allRevisions.length > 0 && (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#d97706', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '999px', padding: '0.18rem 0.6rem' }}>
                {allRevisions.length} pending
              </span>
            )}
          </div>
          {allRevisions.length === 0 ? (
            <div style={{ padding: '1.25rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
              No active revisions
            </div>
          ) : (
            <div className="revision-list-premium" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', flex: 1, minHeight: 0 }}>
              {allRevisions.map((revision, idx) => {
                const notes = revision.notes || '';
                const attachmentMatch = notes.match(/Attachment:\s*(https?:\/\/[^\s]+)/i);
                const notesText = attachmentMatch ? notes.replace(/Attachment:\s*https?:\/\/[^\s]+/i, '').trim() : notes.trim();
                const attachmentUrl = attachmentMatch ? attachmentMatch[1] : null;
                const deptColor = getDeptColor(revision.department);

                return (
                  <div key={idx} className="revision-card-new">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ padding: '0.22rem 0.55rem', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 700, background: `${deptColor}18`, color: deptColor, border: `1px solid ${deptColor}30` }}>
                          {revision.department}
                        </span>
                        <span style={{ fontWeight: 700, color: '#111827', fontSize: '0.85rem' }}>{revision.deliverableType}</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {new Date(revision.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {notesText && (
                      <p className="revision-notes-text">{notesText}</p>
                    )}
                    {attachmentUrl && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem' }}>
                        <FaLink style={{ color: '#667eea', fontSize: '0.7rem' }} />
                        <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#667eea', fontSize: '0.75rem', textDecoration: 'underline', wordBreak: 'break-all' }}>
                          View Attachment
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Files / Links ── */}
        <div
          className="overview-card premium-card overview-card--files"
          style={{ cursor: 'pointer' }}
          onClick={() => setShowFilesLinksModal(true)}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Files & Links</h3>
            <span className="count-pill count-pill--blue">{getAllFilesAndLinks.length}</span>
          </div>
          {getAllFilesAndLinks.length === 0 ? (
            <div style={{ padding: '1.25rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
              No files or links shared yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {getAllFilesAndLinks.slice(0, 3).map((link: any) => (
                <div key={link.id} className="file-link-preview-item" onClick={(e) => e.stopPropagation()}>
                  <div className="file-link-icon" style={{ background: link.sourceType === 'Task' ? '#dbeafe' : '#fef3c7' }}>
                    {link.sourceType === 'Task'
                      ? <FaClipboard style={{ color: '#3b82f6' }} />
                      : <FaEnvelope style={{ color: '#f59e0b' }} />
                    }
                  </div>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {formatLinkDisplay(link.url)}
                  </span>
                </div>
              ))}
              {getAllFilesAndLinks.length > 3 && (
                <div style={{ paddingTop: '0.25rem', textAlign: 'center', fontSize: '0.8rem', color: '#667eea', fontWeight: 600 }}>
                  View all {getAllFilesAndLinks.length} files & links →
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Completed Deliverables (conditional) ── */}
        {completedTasks.length > 0 && (
          <div className="overview-card premium-card overview-card--completed">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FaCheckCircle style={{ color: '#10b981', fontSize: '1.1rem' }} />
                <h3 className="card-title" style={{ margin: 0 }}>Completed Deliverables</h3>
              </div>
              <span className="count-pill count-pill--green">{completedTasks.length}</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem 0' }}>
              Completed tasks with files stored for client access
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {completedTasks.slice(0, 5).map((task: any) => (
                <div
                  key={task.id}
                  style={{ padding: '0.75rem 0.875rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '0.75rem', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#dcfce7'; e.currentTarget.style.borderColor = '#86efac'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#bbf7d0'; }}
                >
                  <FaCheckCircle style={{ color: '#10b981', fontSize: '0.95rem', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.2rem' }}>{task.title}</div>
                    <a
                      href={task.fileUrl.startsWith('http') ? task.fileUrl : `https://${task.fileUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ fontSize: '0.75rem', color: '#667eea', textDecoration: 'none', wordBreak: 'break-all', display: 'block' }}
                      onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                    >
                      {formatLinkDisplay(task.fileUrl.startsWith('http') ? task.fileUrl : `https://${task.fileUrl}`, 50)}
                    </a>
                  </div>
                  <button
                    onClick={() => handleTaskComplete(task.id, false)}
                    title="Mark as incomplete"
                    style={{ background: 'transparent', border: '1px solid #d1d5db', borderRadius: '6px', padding: '0.35rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', transition: 'all 0.2s', flexShrink: 0 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; e.currentTarget.style.color = '#6b7280'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#9ca3af'; }}
                  >
                    <FaCircle style={{ fontSize: '0.7rem' }} />
                  </button>
                </div>
              ))}
              {completedTasks.length > 5 && (
                <div style={{ paddingTop: '0.25rem', textAlign: 'center', fontSize: '0.8rem', color: '#667eea', fontWeight: 600 }}>
                  +{completedTasks.length - 5} more completed tasks
                </div>
              )}
            </div>
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
              <button
                onClick={() => setShowFilesLinksModal(true)}
                style={{ width: '100%', padding: '0.7rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontFamily: 'inherit' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(102,126,234,0.4)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <FaLink /> View All Files & Links
              </button>
            </div>
          </div>
        )}

        {/* ── Ready to Close ── */}
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
