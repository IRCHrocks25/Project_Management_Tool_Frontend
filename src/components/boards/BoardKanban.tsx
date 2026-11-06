import React, { useState } from 'react';
import { FaLink, FaPlus, FaRegCalendarAlt, FaRegComment } from 'react-icons/fa';
import { BoardTaskRow } from '../../services/board.service';
import { useDragEdgeScroll } from '../dashboards/useDragEdgeScroll';
import { OwnerStack, useBoardContext } from './cells';
import {
  formatDay,
  isOverdue,
  mostCommonType,
  PRIORITY_COLOR,
  STAGE_COLOR,
  stageLabel,
  stagesForBoard,
} from './boardConfig';

const Chip: React.FC<{ color?: string; className?: string; children: React.ReactNode }> = ({ color, className = '', children }) => (
  <span className={`bv-chip ${className}`} style={color ? { borderLeftColor: color } : undefined}>{children}</span>
);

const Card: React.FC<{ task: BoardTaskRow; hidden: string[]; onDrag: (dragging: boolean) => void }> = ({ task, hidden, onDrag }) => {
  const { openTask } = useBoardContext();
  const show = (id: string) => !hidden.includes(id);
  return (
    <article
      className="bv-card"
      draggable
      tabIndex={0}
      role="button"
      aria-label={`Open ${task.title}`}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-board-task', task.id);
        onDrag(true);
      }}
      onDragEnd={() => onDrag(false)}
      onClick={() => openTask(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) openTask(task);
      }}
    >
      <h4>{task.title}</h4>
      <div className="bv-card-chips">
        {show('status') && <Chip color={STAGE_COLOR[task.stageId]}>{stageLabel(task.stageId)}</Chip>}
        {show('due') && task.dueDate && (
          <Chip className={isOverdue(task) ? 'late' : ''}><FaRegCalendarAlt /> {formatDay(task.dueDate)}</Chip>
        )}
      </div>
      {show('notes') && task.notes && <p className="bv-card-notes">{task.notes}</p>}
      {show('priority') && task.priority && (
        <div className="bv-card-chips"><Chip color={PRIORITY_COLOR[task.priority]}>{task.priority}</Chip></div>
      )}
      <footer>
        {show('owner') && task.owners.length > 0 ? <OwnerStack owners={task.owners} size={24} /> : <span />}
        <span className="bv-card-tools">
          {show('files') && task.files.length > 0 && (
            <button type="button" aria-label={`Files on ${task.title}: ${task.files.length}`} onClick={(e) => { e.stopPropagation(); openTask(task, 'files'); }}>
              <FaLink /> {task.files.length}
            </button>
          )}
          <button type="button" aria-label={`Updates on ${task.title}: ${task.updateCount}`} onClick={(e) => { e.stopPropagation(); openTask(task, 'updates'); }}>
            <FaRegComment /> {task.updateCount > 0 ? task.updateCount : ''}
          </button>
        </span>
      </footer>
    </article>
  );
};

const AddCard: React.FC<{ tasks: BoardTaskRow[] }> = ({ tasks }) => {
  const { actions } = useBoardContext();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const submit = () => {
    const value = title.trim();
    setOpen(false);
    setTitle('');
    if (value) actions.addTask(value, { type: mostCommonType(tasks.length ? tasks : actions.board?.tasks || []) });
  };
  if (!open) {
    return <button type="button" className="bv-card-add" onClick={() => setOpen(true)}><FaPlus /> Add task</button>;
  }
  return (
    <input
      autoFocus
      className="bv-card-add-input"
      value={title}
      placeholder="Task name"
      aria-label="New task name"
      onChange={(e) => setTitle(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setTitle('');
          setOpen(false);
        }
      }}
    />
  );
};

const BoardKanban: React.FC<{ tasks: BoardTaskRow[]; hidden: string[] }> = ({ tasks, hidden }) => {
  const { actions, requestMove } = useBoardContext();
  const [over, setOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  useDragEdgeScroll(dragging);
  const stages = stagesForBoard(actions.board?.tasks || []);

  return (
    <div className="bv-kanban">
      {stages.map((stageId) => {
        const stageTasks = tasks.filter((t) => t.stageId === stageId);
        return (
          <section
            key={stageId}
            className={`bv-lane${over === stageId ? ' over' : ''}`}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('application/x-board-task')) {
                e.preventDefault();
                setOver(stageId);
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              setDragging(false);
              const task = tasks.find((t) => t.id === e.dataTransfer.getData('application/x-board-task'));
              if (task) requestMove(task, stageId);
            }}
          >
            <header style={{ background: STAGE_COLOR[stageId] }}>
              <span>{stageLabel(stageId)}</span>
              <b>{stageTasks.length}</b>
            </header>
            <div className="bv-lane-body">
              {stageTasks.map((task) => <Card key={task.id} task={task} hidden={hidden} onDrag={setDragging} />)}
              {/* New tasks start at the beginning. Any later stage is a status change, which needs notes. */}
              {stageId === 'not_started' && <AddCard tasks={stageTasks} />}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default BoardKanban;
