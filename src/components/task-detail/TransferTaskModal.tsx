import React, { useState, useEffect, useRef } from 'react';
import { FaCheck, FaExchangeAlt, FaTimes } from 'react-icons/fa';
import { taskService } from '../../services/task.service';
import { DEPARTMENTS, taskTypeToDepartment, filterUsersByDepartment } from '../../utils/roleMapping';

interface TransferTaskModalProps {
  task: any;
  allUsers: any[];
  onClose: () => void;
  onTransferred: (updatedTask: any) => void;
}

const TransferTaskModal: React.FC<TransferTaskModalProps> = ({
  task,
  allUsers,
  onClose,
  onTransferred,
}) => {
  const currentDept = taskTypeToDepartment(task?.type ?? '');

  const [selectedDept, setSelectedDept] = useState('');
  const [kind, setKind] = useState<'forward' | 'return'>('forward');
  const [note, setNote] = useState('');
  const [toAssigneeIds, setToAssigneeIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<{ toDept: string; updatedTask: any } | null>(null);

  const backdropRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether the success view is showing; used to block accidental closes
  // (backdrop click, Escape) before the 1500 ms timer fires.
  const successRef = useRef(false);

  // Clear success timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      successRef.current = false;
    };
  }, []);

  // Intercept Escape before TDSM's capture listener can close the parent.
  // When the success view is showing, swallow Escape entirely so the timer
  // is the only thing that can close the modal.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        if (!successRef.current) onClose();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onClose]);

  // Close when clicking the backdrop, but not while the success view is visible.
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (successRef.current) return;
    if (e.target === backdropRef.current) onClose();
  };

  const usersInDept = selectedDept ? filterUsersByDepartment(allUsers, selectedDept) : [];

  const toggleAssignee = (userId: string) => {
    setToAssigneeIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  // Clear assignee selection whenever the target department changes
  useEffect(() => {
    setToAssigneeIds([]);
  }, [selectedDept]);

  const canConfirm =
    selectedDept &&
    selectedDept !== currentDept &&
    (kind === 'forward' || note.trim().length >= 3);

  const handleSubmit = async () => {
    if (!canConfirm || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await taskService.transferTask(task.id, {
        toDepartment: selectedDept,
        kind,
        note: note.trim() || undefined,
        toAssigneeIds,
      });
      const updated = await taskService.getOne(task.id);
      successRef.current = true; // lock out backdrop/Escape before the re-render
      setSuccessState({ toDept: selectedDept, updatedTask: updated });
      timerRef.current = setTimeout(() => {
        onTransferred(updated);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Transfer failed. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={backdropRef}
      className="ttm-backdrop"
      onClick={handleBackdropClick}
    >
      <div className="ttm-panel tdsm-light-theme" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="ttm-header">
          <div className="ttm-header-title">
            <FaExchangeAlt className="ttm-header-icon" />
            Transfer Task
          </div>
          <button className="tdsm-close-btn" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        {successState ? (
          <div className="ttm-success-view">
            <FaCheck className="ttm-success-icon" />
            <div className="ttm-success-text">Transferred to {successState.toDept}</div>
          </div>
        ) : (
          <>
            {/* Task name + current dept */}
            <div className="ttm-task-info">
              <div className="ttm-task-name">{task?.title ?? 'Task'}</div>
              <div className="ttm-current-dept">
                Currently in <span className="ttm-dept-pill ttm-dept-pill--current">{currentDept}</span>
              </div>
            </div>

            <div className="ttm-body">
              {/* Transfer kind */}
              <div className="ttm-section">
                <div className="ttm-label">Transfer type</div>
                <div className="ttm-kind-row">
                  {(['forward', 'return'] as const).map(k => (
                    <button
                      key={k}
                      className={`ttm-kind-btn${kind === k ? ' active' : ''}`}
                      onClick={() => setKind(k)}
                    >
                      {k === 'forward' ? 'Forward to department' : 'Return for revision'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target department */}
              <div className="ttm-section">
                <div className="ttm-label">To department</div>
                <div className="ttm-dept-grid">
                  {DEPARTMENTS.map(dept => {
                    const isCurrent = dept === currentDept;
                    const deptUsers = filterUsersByDepartment(allUsers, dept);
                    const isEmpty = deptUsers.length === 0;
                    const disabled = isCurrent || isEmpty;
                    const tooltip = isCurrent
                      ? "You're already in this department"
                      : isEmpty
                      ? 'No users in this department'
                      : undefined;
                    return (
                      <button
                        key={dept}
                        className={`ttm-dept-btn${selectedDept === dept ? ' active' : ''}${disabled ? ' disabled' : ''}`}
                        onClick={() => !disabled && setSelectedDept(dept)}
                        disabled={disabled}
                        title={tooltip}
                      >
                        {dept}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assignee picker (optional) — only shown when dept selected */}
              {selectedDept && usersInDept.length > 0 && (
                <div className="ttm-section">
                  <div className="ttm-label">
                    Assign to <span className="ttm-label-optional">(optional)</span>
                  </div>
                  <div className="ttm-assignee-list">
                    {usersInDept.map(user => {
                      const uid = user.id;
                      const checked = toAssigneeIds.includes(uid);
                      return (
                        <button
                          key={uid}
                          className={`ttm-assignee-row${checked ? ' selected' : ''}`}
                          onClick={() => toggleAssignee(uid)}
                        >
                          <span className="ttm-avatar">{(user.name ?? 'U')[0].toUpperCase()}</span>
                          <span className="ttm-assignee-name">{user.name}</span>
                          <span className="ttm-assignee-role">{user.role}</span>
                          {checked && <span className="ttm-check">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Note */}
              <div className="ttm-section">
                <div className="ttm-label">
                  Note
                  {kind === 'return' && <span className="ttm-label-required"> *</span>}
                  {kind === 'forward' && <span className="ttm-label-optional"> (optional)</span>}
                </div>
                <textarea
                  className="tdsm-textarea"
                  placeholder={
                    kind === 'return'
                      ? 'Describe what needs to be revised…'
                      : 'Add context for the receiving department…'
                  }
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                />
                {kind === 'return' && note.trim().length > 0 && note.trim().length < 3 && (
                  <div className="tdsm-field-error">Note must be at least 3 characters</div>
                )}
              </div>

              {error && <div className="ttm-error">{error}</div>}
            </div>

            {/* Footer */}
            <div className="ttm-footer">
              <button className="tdsm-btn-outline" style={{ width: 'auto' }} onClick={onClose}>
                Cancel
              </button>
              <button
                className="ttm-confirm-btn"
                disabled={!canConfirm || submitting}
                onClick={handleSubmit}
              >
                {submitting ? 'Transferring…' : `Transfer → ${selectedDept || '…'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TransferTaskModal;
