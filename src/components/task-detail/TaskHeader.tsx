import React, { useEffect, useRef, useState } from 'react';
import { FaEllipsisV, FaTimes, FaUser } from 'react-icons/fa';
import ConfirmModal from '../ConfirmModal';
import { taskService } from '../../services/task.service';

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

interface TaskHeaderProps {
  loadingTask: boolean;
  title: string;
  taskId?: string;
  projectId: string;
  getProjectPmName?: (projectId: string) => string;
  onClose: () => void;
  onTitleSaved?: (newTitle: string) => void;
  onDeleteTask?: () => void;
}

const TaskHeader: React.FC<TaskHeaderProps> = ({
  loadingTask,
  title,
  taskId,
  projectId,
  getProjectPmName,
  onClose,
  onTitleSaved,
  onDeleteTask,
}) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const [showKebab, setShowKebab] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const kebabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showKebab) return;
    const handler = (e: MouseEvent) => {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) {
        setShowKebab(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showKebab]);

  useEffect(() => {
    if (!showKebab) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setShowKebab(false);
      }
    };
    // Capture phase: fires before the modal's bubbling Esc→close handler
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [showKebab]);

  const canEdit = !loadingTask && !!taskId;

  const startEditTitle = () => {
    if (!canEdit) return;
    setTitleInput(title);
    setEditingTitle(true);
  };

  const saveTitle = async () => {
    const trimmed = titleInput.trim();
    if (!trimmed || !taskId) {
      setEditingTitle(false);
      return;
    }
    if (trimmed === title) {
      setEditingTitle(false);
      return;
    }
    setSavingTitle(true);
    try {
      await taskService.update(taskId, { title: trimmed });
      onTitleSaved?.(trimmed);
    } catch {
      showToast('Failed to save title — please try again');
    } finally {
      setSavingTitle(false);
      setEditingTitle(false);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); saveTitle(); }
    if (e.key === 'Escape') { setEditingTitle(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!taskId) return;
    setDeleting(true);
    try {
      await taskService.delete(taskId);
      setShowDeleteConfirm(false);
      onDeleteTask?.();
    } catch {
      showToast('Failed to delete task — please try again');
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="tdsm-header">
      <div className="tdsm-header-top">
        {editingTitle ? (
          <input
            className="tdsm-title-input"
            value={titleInput}
            onChange={e => setTitleInput(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={handleTitleKeyDown}
            disabled={savingTitle}
            autoFocus
          />
        ) : (
          <h2
            className={`tdsm-task-title${canEdit ? ' tdsm-title-editable' : ''}`}
            onClick={canEdit ? startEditTitle : undefined}
            title={canEdit ? 'Click to edit title' : undefined}
          >
            {loadingTask ? 'Loading…' : title}
          </h2>
        )}

        <div className="tdsm-header-actions">
          {canEdit && onDeleteTask && (
            <div className="tdsm-kebab-wrap" ref={kebabRef}>
              <button
                className="tdsm-kebab-btn"
                onClick={() => setShowKebab(s => !s)}
                aria-label="Task actions"
                aria-haspopup="true"
                aria-expanded={showKebab}
              >
                <FaEllipsisV />
              </button>
              {showKebab && (
                <div className="tdsm-kebab-menu" role="menu">
                  <button
                    className="tdsm-kebab-option tdsm-kebab-danger"
                    role="menuitem"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { setShowKebab(false); setShowDeleteConfirm(true); }}
                  >
                    Delete task
                  </button>
                </div>
              )}
            </div>
          )}
          <button className="tdsm-close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
      </div>

      {getProjectPmName?.(projectId) && (
        <div className="tdsm-pm-row">
          <FaUser />
          PM: {getProjectPmName(projectId)}
        </div>
      )}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete task"
        message={`Are you sure you want to delete "${title}"? This cannot be undone.`}
        confirmText="Delete task"
        type="danger"
        loading={deleting}
      />
    </div>
  );
};

export default TaskHeader;
