import React from 'react';
import { FaClock, FaEdit, FaLink, FaSpinner, FaUser } from 'react-icons/fa';
import { CARD_ACTION_TONE, CARD_STAGE_TONE, cardDescription, ColumnId, getTaskAssigneeIds } from './taskColumns';
import './taskBoard.css';

export interface TaskBoardCardAction {
  key: string;
  label: string;
  run: () => void;
}

interface TaskBoardCardProps {
  task: any;
  columnId: ColumnId;
  clientName: string;
  pmName?: string;
  department?: string;
  currentUserId?: string;
  getUserName: (userId: string) => string;
  dueClassName?: string;
  actions: TaskBoardCardAction[];
  busy: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onCopyLink: () => void;
  onUpdateMembers: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  children?: React.ReactNode;
}

/** The one task card every board uses, so a task looks and behaves the same everywhere. */
const TaskBoardCard: React.FC<TaskBoardCardProps> = ({
  task,
  columnId,
  clientName,
  pmName,
  department,
  currentUserId,
  getUserName,
  dueClassName,
  actions,
  busy,
  onOpen,
  onEdit,
  onCopyLink,
  onUpdateMembers,
  onDragStart,
  onDragEnd,
  children,
}) => {
  const canUpdateMembers = actions.some((action) => action.key === 'members');
  const brief = cardDescription(task.description);
  const assigneeIds = getTaskAssigneeIds(task);
  const assignedToMe = assigneeIds.includes(currentUserId || '');
  const assignedText =
    assigneeIds.length === 1
      ? assignedToMe
        ? 'Assigned to you'
        : `Assigned to ${getUserName(assigneeIds[0])}`
      : assignedToMe
        ? `Assigned to you + ${assigneeIds.length - 1} other${assigneeIds.length > 2 ? 's' : ''}`
        : `Assigned to ${assigneeIds.length} team members`;
  const stageTone = CARD_STAGE_TONE[columnId] || '';
  const metaLine = [department, pmName && `PM: ${pmName}`].filter(Boolean).join(' · ');

  return (
    <div
      className={`rd-card ${stageTone}`}
      role="button"
      tabIndex={0}
      draggable
      data-task-id={task.id}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) onOpen();
      }}
    >
      <div className="rd-card-top">
        <div className="rd-card-client">
          <span>{clientName}</span>
          {metaLine && <small>{metaLine}</small>}
        </div>
        <button
          type="button"
          className="rd-card-icon"
          title="Edit task"
          aria-label={`Edit ${task.title}`}
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
        >
          <FaEdit />
        </button>
        <button
          type="button"
          className="rd-card-icon"
          title="Copy task link"
          aria-label={`Copy link to ${task.title}`}
          onClick={(e) => { e.stopPropagation(); onCopyLink(); }}
        >
          <FaLink />
        </button>
      </div>
      <div className="rd-card-heading">
        <h4>{task.title}</h4>
        <span className={`rd-card-status ${stageTone}`}>
          {task.isCompleted ? 'Completed' : columnId === 'revision' ? 'Revision' : task.status}
        </span>
      </div>
      {brief && <p className="rd-card-brief">{brief}</p>}
      <div className="rd-card-meta">
        <span>
          <FaUser />{' '}
          {assigneeIds.length === 0
            ? 'Unassigned'
            : assigneeIds.slice(0, 2).map((id) => getUserName(id)).join(', ')}
          {assigneeIds.length > 2 ? ` +${assigneeIds.length - 2} more` : ''}
        </span>
        {task.dueDate && (
          <span className={dueClassName}><FaClock /> {new Date(task.dueDate).toLocaleDateString()}</span>
        )}
      </div>
      {children}
      {assigneeIds.length > 0 && (
        <div className={`rd-card-assigned${assignedToMe ? ' mine' : ''}`}>
          <span>{assignedText}</span>
          {canUpdateMembers && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onUpdateMembers(); }}>
              Update Members
            </button>
          )}
        </div>
      )}
      {actions.filter((action) => action.key !== 'members').map((action) => (
        <button
          key={action.key}
          type="button"
          className={`rd-card-action ${CARD_ACTION_TONE[action.key] || 'go'}`}
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            action.run();
          }}
        >
          {busy ? <FaSpinner className="rd-spin" /> : action.label}
        </button>
      ))}
    </div>
  );
};

export default TaskBoardCard;
