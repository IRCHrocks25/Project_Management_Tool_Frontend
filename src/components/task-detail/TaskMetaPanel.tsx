import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FaUser, FaClock, FaStickyNote, FaLink, FaCheck, FaTimes } from 'react-icons/fa';
import { taskService } from '../../services/task.service';
import { deliverableService } from '../../services/deliverable.service';
import { authService } from '../../services/auth.service';
import InlineEditDropdown from './InlineEditDropdown';
import AssigneePicker from './AssigneePicker';

const STATUS_OPTIONS = [
  { value: 'Todo',        cls: 'default' },
  { value: 'In Progress', cls: 'in-progress' },
  { value: 'In Review',   cls: 'in-review' },
  { value: 'Completed',   cls: 'completed' },
  { value: 'Blocked',     cls: 'blocked' },
];

function deriveStatus(task: any): string {
  if (!task) return 'Todo';
  if (task.isCompleted || task.status === 'Completed') return 'Completed';
  return task.status || 'Todo';
}

function getStatusCls(status: string): string {
  if (status === 'Completed') return 'completed';
  if (status === 'In Review') return 'in-review';
  if (status === 'In Progress') return 'in-progress';
  if (status === 'Blocked') return 'blocked';
  return 'default';
}

function initAssignees(task: any): string[] {
  if (!task) return [];
  const assignees = task.assignees || [];
  if (assignees.length > 0) return assignees.map((a: any) => a.userId || a.user?.id).filter(Boolean);
  return task.assignedToId ? [task.assignedToId] : [];
}

// ── Description marker helpers ────────────────────────────────────────────────
// The description string embeds activity markers of the form:
//   \n\n--- Status Change ---\nNew Column: ...\nBy: ...\nAt: ...
// These are parsed by TaskDetailSideModal's parsedStatusChanges memo.
// The editor must never show or corrupt these blocks.
// We also store due-date move history blocks in description:
//   \n\n--- Due Date Move ---\nDate moved by PM: ...\nComment: ...\nBy: ...\nAt: ...

const ACTIVITY_MARKER_REGEX = /\n\n--- (?:Status Change|Due Date Move) ---[\s\S]*?(?=\n\n--- (?:Status Change|Due Date Move) ---|$)/g;

function splitDescMarkers(desc: string): { prose: string; markerBlocks: string[] } {
  if (!desc.includes('--- Status Change ---') && !desc.includes('--- Due Date Move ---')) {
    return { prose: desc, markerBlocks: [] };
  }
  const markerBlocks = desc.match(ACTIVITY_MARKER_REGEX) ?? [];
  ACTIVITY_MARKER_REGEX.lastIndex = 0;
  return {
    prose: desc.replace(ACTIVITY_MARKER_REGEX, '').trimEnd(),
    markerBlocks,
  };
}

function rejoinDescMarkers(prose: string, markerBlocks: string[]): string {
  if (!markerBlocks.length) return prose;
  return prose + markerBlocks.join('');
}

function countActivityMarkers(desc: string): number {
  if (!desc.includes('--- Status Change ---') && !desc.includes('--- Due Date Move ---')) return 0;
  const markers = desc.match(ACTIVITY_MARKER_REGEX) ?? [];
  ACTIVITY_MARKER_REGEX.lastIndex = 0;
  return markers.length;
}

interface DueDateMoveEntry {
  id?: string;
  date: string;
  comment?: string;
  by: string;
  at: string;
  index: number;
}

function normalizeDateOnly(value?: string | Date | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function parseDueDateMoveHistory(desc: string): DueDateMoveEntry[] {
  if (!desc.includes('--- Due Date Move ---')) return [];
  const blocks = desc.split(/\n\n--- Due Date Move ---/);
  const out: DueDateMoveEntry[] = [];
  blocks.forEach((block, i) => {
    if (i === 0) return;
    const movedDate = block.match(/\nDate moved by PM:\s*(.+?)(?:\n|$)/)?.[1]?.trim();
    if (!movedDate) return;
    const by = block.match(/\nBy:\s*(.+?)(?:\n|$)/)?.[1]?.trim() || 'Unknown';
    const at = block.match(/\nAt:\s*(.+?)(?:\n|$)/)?.[1]?.trim() || '';
    const commentRaw = block.match(/\nComment:\s*([\s\S]*?)(?=\nBy:|\nAt:|$)/)?.[1]?.trim();
    out.push({
      date: movedDate,
      comment: commentRaw && commentRaw !== 'No comment' ? commentRaw : undefined,
      by,
      at,
      index: i,
    });
  });
  return out.reverse();
}

function parseDueDateMoveHistoryFromTask(t: any): DueDateMoveEntry[] {
  const apiMoves = Array.isArray(t?.dueDateMoves) ? t.dueDateMoves : [];
  if (apiMoves.length > 0) {
    return apiMoves.map((move: any, idx: number) => {
      const normalizedDate = normalizeDateOnly(move?.movedDate);
      return {
        id: move?.id,
        date: normalizedDate || String(move?.movedDate || ''),
        comment: move?.comment || undefined,
        by: move?.movedBy?.name || move?.movedBy?.email || 'Unknown',
        at: move?.movedAt
          ? new Date(move.movedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '',
        index: idx,
      };
    }).filter((move: DueDateMoveEntry) => Boolean(move.date));
  }

  const desc = t?.description ?? '';
  return parseDueDateMoveHistory(desc);
}

function showToast(message: string) {
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

interface TaskMetaPanelProps {
  displayTask: any;
  task: any;
  allUsers: any[];
  getUserName: (id: string) => string;
  getProjectName: (projectId: string) => string;
  renderTextWithLinks: (text: string) => React.ReactNode;
  parsedStatusChanges?: Array<{ at?: string }>;
  taskTransfers?: Array<{ transferredAt?: string }>;
  onTaskUpdate?: (updated: any) => void;
}

type MovedDateSource = 'manual' | 'dueDateHistory' | 'activity' | 'transfer' | null;

const TaskMetaPanel: React.FC<TaskMetaPanelProps> = ({
  displayTask, task, allUsers, getUserName, getProjectName, renderTextWithLinks, parsedStatusChanges = [], taskTransfers = [], onTaskUpdate,
}) => {
  const taskId = displayTask?.id ?? task?.id;
  const projectId = displayTask?.projectId ?? task?.projectId;
  const currentUser = authService.getUser();
  const canEditMovedDate = currentUser?.role === 'Project Manager' || !!currentUser?.isTeamLead;
  const dueDateMoveHistory = useMemo(() => parseDueDateMoveHistoryFromTask(displayTask ?? task), [displayTask, task]);
  const latestDueDateMove = dueDateMoveHistory[0];
  const movedDateFallback = useMemo<{ date: string | null; source: MovedDateSource }>(() => {
    let latestStatusMs: number | null = null;
    parsedStatusChanges.forEach((sc) => {
      if (!sc?.at) return;
      const dt = new Date(sc.at);
      if (!Number.isNaN(dt.getTime()) && (latestStatusMs === null || dt.getTime() > latestStatusMs)) {
        latestStatusMs = dt.getTime();
      }
    });

    let latestTransferMs: number | null = null;
    taskTransfers.forEach((transfer) => {
      if (!transfer?.transferredAt) return;
      const dt = new Date(transfer.transferredAt);
      if (!Number.isNaN(dt.getTime()) && (latestTransferMs === null || dt.getTime() > latestTransferMs)) {
        latestTransferMs = dt.getTime();
      }
    });

    if (latestStatusMs === null && latestTransferMs === null) {
      return { date: null as string | null, source: null as MovedDateSource };
    }

    if (latestStatusMs !== null && latestTransferMs !== null) {
      const useStatus = latestStatusMs >= latestTransferMs;
      const pickedMs = useStatus ? latestStatusMs : latestTransferMs;
      return {
        date: new Date(pickedMs).toISOString().split('T')[0],
        source: useStatus ? 'activity' : 'transfer',
      };
    }

    if (latestStatusMs !== null) {
      return { date: new Date(latestStatusMs).toISOString().split('T')[0], source: 'activity' };
    }

    return { date: new Date(latestTransferMs!).toISOString().split('T')[0], source: 'transfer' };
  }, [parsedStatusChanges, taskTransfers]);

  const movedDateSource = useMemo<MovedDateSource>(() => {
    const t = displayTask ?? task;
    if (normalizeDateOnly(t?.movedDueDate)) return 'manual';
    if (latestDueDateMove?.date) return 'dueDateHistory';
    return movedDateFallback.source;
  }, [displayTask, task, latestDueDateMove?.date, movedDateFallback.source]);

  // ── Local editable state (initialised from task on mount; key prop in parent forces remount on task change) ──
  const [localStatus, setLocalStatus]           = useState(() => deriveStatus(displayTask ?? task));
  const [localAssigneeIds, setLocalAssigneeIds] = useState<string[]>(() => initAssignees(displayTask ?? task));
  const [localDueDate, setLocalDueDate]         = useState<string | null>(() => {
    const t = displayTask ?? task;
    return t?.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : null;
  });
  const [localMovedDueDate, setLocalMovedDueDate] = useState<string | null>(() => {
    const t = displayTask ?? task;
    return normalizeDateOnly(t?.movedDueDate) || latestDueDateMove?.date || movedDateFallback.date || null;
  });
  const [localMovedDueDateComment, setLocalMovedDueDateComment] = useState<string>(
    () => (displayTask ?? task)?.movedDueDateComment || latestDueDateMove?.comment || ''
  );
  const [localDeliverableId, setLocalDeliverableId] = useState<string | null>(
    () => displayTask?.deliverableId ?? task?.deliverableId ?? null
  );

  // One-time sync when displayTask resolves (it may have fuller data than the initial task prop)
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!displayTask || syncedRef.current) return;
    syncedRef.current = true;
    setLocalStatus(deriveStatus(displayTask));
    setLocalAssigneeIds(initAssignees(displayTask));
    setLocalDueDate(displayTask.dueDate ? new Date(displayTask.dueDate).toISOString().split('T')[0] : null);
    setLocalMovedDueDate(
      normalizeDateOnly(displayTask?.movedDueDate) || latestDueDateMove?.date || movedDateFallback.date || null
    );
    setLocalMovedDueDateComment(displayTask?.movedDueDateComment || latestDueDateMove?.comment || '');
    setLocalDeliverableId(displayTask.deliverableId ?? null);
  }, [displayTask, latestDueDateMove?.date, latestDueDateMove?.comment, movedDateFallback.date]);

  // ── Error / spinner state ──
  const [statusError,      setStatusError]      = useState<string | null>(null);
  const [assigneeError,    setAssigneeError]     = useState<string | null>(null);
  const [dueDateError,     setDueDateError]      = useState<string | null>(null);
  const [deliverableError, setDeliverableError]  = useState<string | null>(null);
  const [movedDateError,   setMovedDateError]    = useState<string | null>(null);
  const [updatingStatus,   setUpdatingStatus]    = useState(false);
  const [updatingAssignees,setUpdatingAssignees] = useState(false);
  const [updatingDueDate,  setUpdatingDueDate]   = useState(false);
  const [updatingDeliv,    setUpdatingDeliv]     = useState(false);
  const [updatingMovedDate, setUpdatingMovedDate] = useState(false);

  // ── Due date edit mode ──
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [dueDateInput,   setDueDateInput]   = useState('');
  const [editingMovedDate, setEditingMovedDate] = useState(false);
  const [movedDateInput, setMovedDateInput] = useState('');
  const [movedDateCommentInput, setMovedDateCommentInput] = useState('');

  // ── Deliverable edit mode ──
  const [deliverables,          setDeliverables]          = useState<any[]>([]);
  const [loadingDeliverables,   setLoadingDeliverables]   = useState(false);
  const [editingDeliverable,    setEditingDeliverable]    = useState(false);
  const [showCustomInput,       setShowCustomInput]       = useState(false);
  const [customDeliverableName, setCustomDeliverableName] = useState('');

  // ── Description edit mode ──
  const [editingDescription,  setEditingDescription]  = useState(false);
  const [descInput,           setDescInput]           = useState('');
  const [savedMarkerBlocks,   setSavedMarkerBlocks]   = useState<string[]>([]);
  const [descError,           setDescError]           = useState<string | null>(null);
  const [updatingDesc,        setUpdatingDesc]        = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setLoadingDeliverables(true);
    deliverableService.getAll(projectId)
      .then(setDeliverables)
      .catch(() => setDeliverables([]))
      .finally(() => setLoadingDeliverables(false));
  }, [projectId]);

  // ── Status ──
  const handleStatusSelect = async (newStatus: string) => {
    if (newStatus === localStatus || !taskId) return;
    const prev = localStatus;
    setLocalStatus(newStatus);
    setStatusError(null);
    setUpdatingStatus(true);
    try {
      const updated = await taskService.updateStatus(taskId, newStatus, newStatus === 'Completed');
      onTaskUpdate?.({ ...(displayTask ?? task), status: updated.status, isCompleted: updated.isCompleted });
    } catch {
      setLocalStatus(prev);
      setStatusError('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ── Assignees ──
  const handleAssigneesChange = useCallback(async (newIds: string[]) => {
    if (!taskId) return;
    const prev = localAssigneeIds;
    setLocalAssigneeIds(newIds);
    setAssigneeError(null);
    setUpdatingAssignees(true);
    try {
      await taskService.assignMultiple(taskId, newIds);
      onTaskUpdate?.({ ...(displayTask ?? task), assignees: newIds.map(id => ({ userId: id })) });
    } catch {
      setLocalAssigneeIds(prev);
      setAssigneeError('Failed to update assignees');
    } finally {
      setUpdatingAssignees(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, localAssigneeIds]);

  // ── Due date ──
  const handleDueDateSave = async () => {
    if (!dueDateInput || !taskId) return;
    const prev = localDueDate;
    setLocalDueDate(dueDateInput);
    setEditingDueDate(false);
    setDueDateError(null);
    setUpdatingDueDate(true);
    try {
      const updated = await taskService.update(taskId, { dueDate: new Date(dueDateInput) });
      onTaskUpdate?.({ ...(displayTask ?? task), dueDate: updated.dueDate ?? dueDateInput });
    } catch {
      setLocalDueDate(prev);
      setDueDateError('Failed to save due date');
    } finally {
      setUpdatingDueDate(false);
    }
  };

  const handleDueDateClear = async () => {
    if (!taskId) return;
    const prev = localDueDate;
    setLocalDueDate(null);
    setEditingDueDate(false);
    setDueDateError(null);
    setUpdatingDueDate(true);
    try {
      await taskService.update(taskId, { dueDate: null });
      onTaskUpdate?.({ ...(displayTask ?? task), dueDate: null });
    } catch {
      setLocalDueDate(prev);
      setDueDateError('Failed to clear due date');
    } finally {
      setUpdatingDueDate(false);
    }
  };

  const handleMovedDateSave = async () => {
    if (!taskId || !movedDateInput) return;
    if (!canEditMovedDate) {
      setMovedDateError('Only PM or Team Lead can update this field');
      return;
    }
    const prevDate = localMovedDueDate;
    const prevComment = localMovedDueDateComment;
    const trimmedComment = movedDateCommentInput.trim();
    setLocalMovedDueDate(movedDateInput);
    setLocalMovedDueDateComment(trimmedComment);
    setEditingMovedDate(false);
    setMovedDateError(null);
    setUpdatingMovedDate(true);
    try {
      const updated = await taskService.updateMovedDueDate(taskId, {
        movedDate: movedDateInput,
        comment: trimmedComment,
      });
      onTaskUpdate?.(updated);
    } catch {
      setLocalMovedDueDate(prevDate);
      setLocalMovedDueDateComment(prevComment);
      setMovedDateError('Failed to save moved date');
    } finally {
      setUpdatingMovedDate(false);
    }
  };

  // ── Deliverable ──
  const handleDeliverableSelect = async (deliverableId: string) => {
    if (!taskId) return;
    const prev = localDeliverableId;
    setLocalDeliverableId(deliverableId || null);
    setEditingDeliverable(false);
    setDeliverableError(null);
    setUpdatingDeliv(true);
    try {
      await taskService.update(taskId, { deliverableId: deliverableId || undefined });
      onTaskUpdate?.({ ...(displayTask ?? task), deliverableId: deliverableId || null });
    } catch {
      setLocalDeliverableId(prev);
      setDeliverableError('Failed to update deliverable');
    } finally {
      setUpdatingDeliv(false);
    }
  };

  const handleCreateDeliverable = async () => {
    if (!customDeliverableName.trim() || !projectId || !taskId) return;
    const prev = localDeliverableId;
    setDeliverableError(null);
    setUpdatingDeliv(true);
    try {
      const newDel = await deliverableService.create(projectId, 'Other', customDeliverableName.trim());
      setDeliverables(d => [...d, newDel]);
      setLocalDeliverableId(newDel.id);
      setEditingDeliverable(false);
      setShowCustomInput(false);
      setCustomDeliverableName('');
      await taskService.update(taskId, { deliverableId: newDel.id });
      onTaskUpdate?.({ ...(displayTask ?? task), deliverableId: newDel.id });
    } catch {
      setLocalDeliverableId(prev);
      setDeliverableError('Failed to create deliverable');
    } finally {
      setUpdatingDeliv(false);
    }
  };

  // ── Description ──
  const startEditDescription = () => {
    const desc = displayTask?.description ?? task?.description ?? '';
    const { prose, markerBlocks } = splitDescMarkers(desc);
    setDescInput(prose);
    setSavedMarkerBlocks(markerBlocks);
    setDescError(null);
    setEditingDescription(true);
  };

  const handleDescriptionSave = async () => {
    if (!taskId || updatingDesc) return;
    const recomposed = rejoinDescMarkers(descInput, savedMarkerBlocks);
    // Sanity check: marker count must be preserved
    if (savedMarkerBlocks.length > 0 && countActivityMarkers(recomposed) !== savedMarkerBlocks.length) {
      showToast("Couldn't save description — please refresh and try again");
      return;
    }
    setDescError(null);
    setUpdatingDesc(true);
    try {
      const updated = await taskService.update(taskId, { description: recomposed });
      onTaskUpdate?.({ ...(displayTask ?? task), description: updated.description ?? recomposed });
      setEditingDescription(false);
    } catch {
      setDescError('Failed to save description');
    } finally {
      setUpdatingDesc(false);
    }
  };

  const handleDescKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleDescriptionSave(); }
    if (e.key === 'Escape') { setEditingDescription(false); }
  };

  const currentDeliverable = deliverables.find(d => d.id === localDeliverableId);
  const isOverdue = localDueDate && new Date(localDueDate) < new Date() && localStatus !== 'Completed';
  const statusCls = getStatusCls(localStatus);

  // Strip status markers from the read-only description display
  const descForDisplay = (() => {
    const desc = displayTask?.description ?? task?.description ?? '';
    return splitDescMarkers(desc).prose;
  })();

  return (
    <>
      {/* Status */}
      <div style={{ marginBottom: statusError ? 6 : 20 }}>
        <InlineEditDropdown
          disabled={updatingStatus}
          trigger={
            <span className={`tdsm-status ${statusCls}`} style={{ marginBottom: 0 }}>
              <span className="tdsm-status-dot" />
              {localStatus}
            </span>
          }
          options={STATUS_OPTIONS.map(s => ({
            value: s.value,
            label: (
              <>
                <span className={`tdsm-status-dot-sm ${s.cls}`} />
                {s.value}
              </>
            ),
          }))}
          onSelect={handleStatusSelect}
        />
      </div>
      {statusError && <div className="tdsm-field-error" style={{ marginBottom: 14 }}>{statusError}</div>}

      {/* Project */}
      <div className="tdsm-card">
        <div className="tdsm-card-label">Project</div>
        <div className="tdsm-card-value">{getProjectName(projectId)}</div>
      </div>

      {/* Assignees */}
      <div className="tdsm-card">
        <div className="tdsm-card-label"><FaUser /> Assigned To</div>
        <AssigneePicker
          allUsers={allUsers}
          assigneeIds={localAssigneeIds}
          getUserName={getUserName}
          onAssigneesChange={handleAssigneesChange}
          disabled={updatingAssignees}
        />
        {assigneeError && <div className="tdsm-field-error">{assigneeError}</div>}
      </div>

      {/* Due Date */}
      <div className="tdsm-card">
        <div className="tdsm-card-label"><FaClock /> Due Date</div>
        {editingDueDate ? (
          <div className="tdsm-due-edit">
            <input
              type="date"
              className="tdsm-date-input"
              defaultValue={localDueDate || ''}
              onChange={e => setDueDateInput(e.target.value)}
              autoFocus
            />
            <div className="tdsm-due-actions">
              <button
                className="tdsm-post-btn"
                onClick={handleDueDateSave}
                disabled={!dueDateInput || updatingDueDate}
              >
                <FaCheck style={{ fontSize: '10px' }} /> Save
              </button>
              {localDueDate && (
                <button
                  className="tdsm-btn-outline"
                  onClick={handleDueDateClear}
                  disabled={updatingDueDate}
                >
                  Clear
                </button>
              )}
              <button
                className="tdsm-btn-outline"
                onClick={() => setEditingDueDate(false)}
                style={{ padding: '5px 10px' }}
              >
                <FaTimes style={{ fontSize: '10px' }} />
              </button>
            </div>
          </div>
        ) : localDueDate ? (
          <div
            className="tdsm-inline-trigger"
            tabIndex={0}
            role="button"
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '13.5px',
              color: isOverdue ? 'var(--td-accent-blocked)' : 'var(--td-text-primary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={() => { setDueDateInput(localDueDate); setEditingDueDate(true); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setDueDateInput(localDueDate);
                setEditingDueDate(true);
              }
            }}
          >
            {new Date(localDueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            <span className="tdsm-inline-edit-icon">✎</span>
          </div>
        ) : (
          <button
            className="tdsm-add-assignee-btn"
            onClick={() => { setDueDateInput(''); setEditingDueDate(true); }}
            disabled={updatingDueDate}
          >
            + Set due date
          </button>
        )}
        {dueDateError && <div className="tdsm-field-error">{dueDateError}</div>}

        <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed var(--td-border-soft)' }}>
          <div className="tdsm-card-label" style={{ marginBottom: '8px' }}>Date moved by PM</div>
          {editingMovedDate ? (
            <div className="tdsm-due-edit">
              <input
                type="date"
                className="tdsm-date-input"
                value={movedDateInput}
                onChange={e => setMovedDateInput(e.target.value)}
                autoFocus
              />
              <textarea
                className="tdsm-desc-textarea"
                rows={3}
                value={movedDateCommentInput}
                onChange={e => setMovedDateCommentInput(e.target.value)}
                placeholder="Why was this date moved?"
                style={{ marginTop: '8px' }}
              />
              <div className="tdsm-due-actions">
                <button
                  className="tdsm-post-btn"
                  onClick={handleMovedDateSave}
                  disabled={!movedDateInput || updatingMovedDate}
                >
                  <FaCheck style={{ fontSize: '10px' }} /> Save
                </button>
                <button
                  className="tdsm-btn-outline"
                  onClick={() => setEditingMovedDate(false)}
                  style={{ padding: '5px 10px' }}
                >
                  <FaTimes style={{ fontSize: '10px' }} />
                </button>
              </div>
            </div>
          ) : localMovedDueDate ? (
            <>
              <div
                className="tdsm-inline-trigger"
                tabIndex={canEditMovedDate ? 0 : -1}
                role={canEditMovedDate ? 'button' : undefined}
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '13.5px',
                  color: 'var(--td-text-primary)',
                  cursor: canEditMovedDate ? 'pointer' : 'default',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={() => {
                  if (!canEditMovedDate) return;
                  setMovedDateInput(localMovedDueDate);
                  setMovedDateCommentInput(localMovedDueDateComment);
                  setEditingMovedDate(true);
                }}
                onKeyDown={(e) => {
                  if (!canEditMovedDate) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setMovedDateInput(localMovedDueDate);
                    setMovedDateCommentInput(localMovedDueDateComment);
                    setEditingMovedDate(true);
                  }
                }}
              >
                {new Date(localMovedDueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                {canEditMovedDate && <span className="tdsm-inline-edit-icon">✎</span>}
              </div>
              {localMovedDueDateComment && (
                <div className="tdsm-history-notes" style={{ marginTop: '8px' }}>
                  {localMovedDueDateComment}
                </div>
              )}
              <div style={{ marginTop: '6px', color: 'var(--td-text-tertiary)', fontSize: '11.5px' }}>
                Source:{' '}
                {movedDateSource === 'manual'
                  ? 'Manual'
                  : movedDateSource === 'dueDateHistory'
                    ? 'Date move history'
                    : movedDateSource === 'activity'
                      ? 'Activity history'
                      : movedDateSource === 'transfer'
                        ? 'Transfer history'
                        : 'Unknown'}
              </div>
            </>
          ) : canEditMovedDate ? (
            <button
              className="tdsm-add-assignee-btn"
              onClick={() => {
                setMovedDateInput('');
                setMovedDateCommentInput('');
                setEditingMovedDate(true);
              }}
              disabled={updatingMovedDate}
            >
              + Add moved date
            </button>
          ) : (
            <span style={{ color: 'var(--td-text-tertiary)', fontSize: '13px' }}>Not set</span>
          )}
          {!canEditMovedDate && (
            <div style={{ marginTop: '6px', color: 'var(--td-text-tertiary)', fontSize: '11.5px' }}>
              Only PM or Team Lead can update this field.
            </div>
          )}
          {movedDateError && <div className="tdsm-field-error">{movedDateError}</div>}

          {dueDateMoveHistory.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <div className="tdsm-card-label" style={{ marginBottom: '8px' }}>Date move history</div>
              {dueDateMoveHistory.map((entry) => (
                <div key={entry.id || `${entry.index}-${entry.at}`} className="tdsm-history-item" style={{ marginBottom: '8px' }}>
                  <div className="tdsm-history-header">
                    <div className="tdsm-history-action">
                      <span style={{ color: 'var(--td-text-primary)' }}>
                        {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span style={{ color: 'var(--td-text-tertiary)' }}> by {entry.by}</span>
                    </div>
                    {entry.at && <span className="tdsm-history-time">{entry.at}</span>}
                  </div>
                  {entry.comment && <div className="tdsm-history-notes">{entry.comment}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deliverable */}
      <div className="tdsm-card">
        <div className="tdsm-card-label"><FaLink /> Deliverable</div>
        {editingDeliverable ? (
          <div className="tdsm-deliverable-edit">
            {showCustomInput ? (
              <>
                <input
                  type="text"
                  className="tdsm-date-input"
                  placeholder="Deliverable name (e.g. Email Templates)…"
                  value={customDeliverableName}
                  onChange={e => setCustomDeliverableName(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateDeliverable(); }}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="tdsm-post-btn"
                    onClick={handleCreateDeliverable}
                    disabled={!customDeliverableName.trim() || updatingDeliv}
                  >
                    <FaCheck style={{ fontSize: '10px' }} /> Create
                  </button>
                  <button
                    className="tdsm-btn-outline"
                    onClick={() => { setShowCustomInput(false); setCustomDeliverableName(''); }}
                    style={{ padding: '5px 10px' }}
                  >
                    <FaTimes style={{ fontSize: '10px' }} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <select
                  className="tdsm-select"
                  value={localDeliverableId || ''}
                  onChange={e => {
                    if (e.target.value === '__custom__') {
                      setShowCustomInput(true);
                    } else {
                      handleDeliverableSelect(e.target.value);
                    }
                  }}
                  disabled={loadingDeliverables || updatingDeliv}
                >
                  <option value="">None</option>
                  {deliverables.map(d => (
                    <option key={d.id} value={d.id}>{d.customType || d.type}</option>
                  ))}
                  <option value="__custom__">+ Create new…</option>
                </select>
                <button
                  className="tdsm-btn-outline"
                  onClick={() => { setEditingDeliverable(false); setShowCustomInput(false); }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        ) : localDeliverableId ? (
          <div
            className="tdsm-inline-trigger"
            tabIndex={0}
            role="button"
            style={{ cursor: 'pointer', fontSize: '13.5px', color: 'var(--td-text-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setEditingDeliverable(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setEditingDeliverable(true);
              }
            }}
          >
            {currentDeliverable
              ? (currentDeliverable.customType || currentDeliverable.type)
              : 'Linked deliverable'}
            <span className="tdsm-inline-edit-icon">✎</span>
          </div>
        ) : (
          <button
            className="tdsm-add-assignee-btn"
            onClick={() => setEditingDeliverable(true)}
            disabled={updatingDeliv || loadingDeliverables}
          >
            + Link deliverable
          </button>
        )}
        {deliverableError && <div className="tdsm-field-error">{deliverableError}</div>}
      </div>

      {/* Description */}
      <div className="tdsm-card">
        <div className="tdsm-card-label"><FaStickyNote /> Description</div>
        {editingDescription ? (
          <div className="tdsm-desc-edit">
            <textarea
              className="tdsm-desc-textarea"
              value={descInput}
              onChange={e => setDescInput(e.target.value)}
              onKeyDown={handleDescKeyDown}
              disabled={updatingDesc}
              rows={5}
              placeholder="Add a description…"
              autoFocus
            />
            <div className="tdsm-desc-hint">Ctrl+Enter to save · Esc to cancel</div>
            <div className="tdsm-desc-actions">
              <button
                className="tdsm-post-btn"
                onClick={handleDescriptionSave}
                disabled={updatingDesc}
              >
                <FaCheck style={{ fontSize: '10px' }} /> Save
              </button>
              <button
                className="tdsm-btn-outline"
                onClick={() => setEditingDescription(false)}
                disabled={updatingDesc}
              >
                Cancel
              </button>
            </div>
            {descError && <div className="tdsm-field-error">{descError}</div>}
          </div>
        ) : (
          <div
            className={`tdsm-desc-read${taskId ? ' tdsm-desc-clickable' : ''}`}
            onClick={taskId ? startEditDescription : undefined}
            title={taskId ? 'Click to edit description' : undefined}
            role={taskId ? 'button' : undefined}
            tabIndex={taskId ? 0 : undefined}
            onKeyDown={taskId ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEditDescription(); } } : undefined}
          >
            {descForDisplay
              ? <>
                  {renderTextWithLinks(descForDisplay)}
                  <span className="tdsm-inline-edit-icon" style={{ marginLeft: '6px', verticalAlign: 'middle' }}>✎</span>
                </>
              : <span style={{ color: 'var(--td-text-tertiary)' }}>
                  {taskId ? 'No description — click to add' : 'No description'}
                </span>
            }
          </div>
        )}
      </div>

    </>
  );
};

export default TaskMetaPanel;
