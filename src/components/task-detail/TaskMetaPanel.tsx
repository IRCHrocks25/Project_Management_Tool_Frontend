import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaUser, FaClock, FaStickyNote, FaLink, FaCheck, FaTimes, FaExchangeAlt } from 'react-icons/fa';
import { taskService } from '../../services/task.service';
import { deliverableService } from '../../services/deliverable.service';
import InlineEditDropdown from './InlineEditDropdown';
import AssigneePicker from './AssigneePicker';
import TransferTaskModal from './TransferTaskModal';

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

interface TaskMetaPanelProps {
  displayTask: any;
  task: any;
  allUsers: any[];
  getUserName: (id: string) => string;
  getProjectName: (projectId: string) => string;
  renderTextWithLinks: (text: string) => React.ReactNode;
  onTaskUpdate?: (updated: any) => void;
}

const TaskMetaPanel: React.FC<TaskMetaPanelProps> = ({
  displayTask, task, allUsers, getUserName, getProjectName, renderTextWithLinks, onTaskUpdate,
}) => {
  const taskId = displayTask?.id ?? task?.id;
  const projectId = displayTask?.projectId ?? task?.projectId;

  // ── Local editable state (initialised from task on mount; key prop in parent forces remount on task change) ──
  const [localStatus, setLocalStatus]           = useState(() => deriveStatus(displayTask ?? task));
  const [localAssigneeIds, setLocalAssigneeIds] = useState<string[]>(() => initAssignees(displayTask ?? task));
  const [localDueDate, setLocalDueDate]         = useState<string | null>(() => {
    const t = displayTask ?? task;
    return t?.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : null;
  });
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
    setLocalDeliverableId(displayTask.deliverableId ?? null);
  }, [displayTask]);

  // ── Error / spinner state ──
  const [statusError,      setStatusError]      = useState<string | null>(null);
  const [assigneeError,    setAssigneeError]     = useState<string | null>(null);
  const [dueDateError,     setDueDateError]      = useState<string | null>(null);
  const [deliverableError, setDeliverableError]  = useState<string | null>(null);
  const [updatingStatus,   setUpdatingStatus]    = useState(false);
  const [updatingAssignees,setUpdatingAssignees] = useState(false);
  const [updatingDueDate,  setUpdatingDueDate]   = useState(false);
  const [updatingDeliv,    setUpdatingDeliv]     = useState(false);

  // ── Transfer modal ──
  const [showTransfer, setShowTransfer] = useState(false);

  const handleTransferred = useCallback(async (updatedTask: any) => {
    onTaskUpdate?.(updatedTask);
  }, [onTaskUpdate]);

  // ── Due date edit mode ──
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [dueDateInput,   setDueDateInput]   = useState('');

  // ── Deliverable edit mode ──
  const [deliverables,          setDeliverables]          = useState<any[]>([]);
  const [loadingDeliverables,   setLoadingDeliverables]   = useState(false);
  const [editingDeliverable,    setEditingDeliverable]    = useState(false);
  const [showCustomInput,       setShowCustomInput]       = useState(false);
  const [customDeliverableName, setCustomDeliverableName] = useState('');

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

  const currentDeliverable = deliverables.find(d => d.id === localDeliverableId);
  const isOverdue = localDueDate && new Date(localDueDate) < new Date() && localStatus !== 'Completed';
  const statusCls = getStatusCls(localStatus);

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

      {/* Transfer to another department */}
      <button
        className="tdsm-transfer-btn"
        onClick={() => setShowTransfer(true)}
      >
        <FaExchangeAlt style={{ fontSize: '11px' }} />
        Transfer to another department
      </button>

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
        <div style={{ fontSize: '13.5px', color: 'var(--td-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.65', wordBreak: 'break-word' }}>
          {displayTask?.description
            ? renderTextWithLinks(displayTask.description)
            : <span style={{ color: 'var(--td-text-tertiary)' }}>No description</span>}
        </div>
      </div>

      {showTransfer && (
        <TransferTaskModal
          task={displayTask ?? task}
          allUsers={allUsers}
          onClose={() => setShowTransfer(false)}
          onTransferred={handleTransferred}
        />
      )}
    </>
  );
};

export default TaskMetaPanel;
