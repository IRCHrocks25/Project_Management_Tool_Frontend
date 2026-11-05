import React, { createContext, useContext, useMemo, useRef, useState } from 'react';
import {
  FaCheck,
  FaCheckCircle,
  FaExclamationCircle,
  FaFileAlt,
  FaLink,
  FaPlus,
  FaRegClock,
  FaRegUser,
  FaSearch,
  FaTimes,
} from 'react-icons/fa';
import UserAvatar from '../UserAvatar';
import { BoardColumn, BoardPerson, BoardTaskRow } from '../../services/board.service';
import type { BoardActions } from './useBoard';
import Popover from './Popover';
import {
  EMPTY_FILL,
  formatDay,
  formatRange,
  isOverdue,
  PRIORITIES,
  PRIORITY_COLOR,
  STAGE_COLOR,
  stageLabel,
  stagesForBoard,
  timeAgo,
  timelineProgress,
} from './boardConfig';

export interface BoardContextValue {
  actions: BoardActions;
  people: BoardPerson[];
  openTask: (task: BoardTaskRow, tab?: 'updates' | 'files' | 'activity') => void;
  transferTask: (task: BoardTaskRow) => void;
}

export const BoardContext = createContext<BoardContextValue | null>(null);

export const useBoardContext = (): BoardContextValue => {
  const value = useContext(BoardContext);
  if (!value) throw new Error('Board cells must sit inside a board');
  return value;
};

export const OwnerStack: React.FC<{ owners: BoardPerson[]; size?: number; max?: number }> = ({ owners, size = 26, max = 3 }) => (
  <span className="bv-owner-stack">
    {owners.slice(0, max).map((o) => (
      <span key={o.id} title={o.name} className="bv-owner-stack-item">
        <UserAvatar name={o.name} avatarUrl={o.avatarUrl} size={size} />
      </span>
    ))}
    {owners.length > max && <span className="bv-owner-more" style={{ width: size, height: size }}>+{owners.length - max}</span>}
  </span>
);

// ── People picker, used by the Owner column and People columns ────────────

export const PeoplePicker: React.FC<{
  selected: BoardPerson[];
  onChange: (next: BoardPerson[]) => void;
  label: string;
}> = ({ selected, onChange, label }) => {
  const { people } = useBoardContext();
  const [query, setQuery] = useState('');
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people
      .filter((p) => !selected.some((s) => s.id === p.id))
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [people, query, selected]);

  return (
    <div className="bv-people">
      <div className="bv-people-box">
        {selected.map((person) => (
          <span key={person.id} className="bv-people-chip">
            <UserAvatar name={person.name} avatarUrl={person.avatarUrl} size={20} />
            <span>{person.name}</span>
            <button type="button" aria-label={`Remove ${person.name}`} onClick={() => onChange(selected.filter((s) => s.id !== person.id))}>
              <FaTimes />
            </button>
          </span>
        ))}
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={selected.length ? '' : 'Search people'}
          aria-label={label}
        />
      </div>
      <div className="bv-menu-title">Suggested people</div>
      {options.length === 0 && <div className="bv-menu-empty">No one found</div>}
      {options.map((person) => (
        <button
          key={person.id}
          type="button"
          className="bv-menu-item"
          onClick={() => {
            onChange([...selected, person]);
            setQuery('');
          }}
        >
          <UserAvatar name={person.name} avatarUrl={person.avatarUrl} size={24} />
          <span>{person.name}</span>
        </button>
      ))}
    </div>
  );
};

export const OwnerCell: React.FC<{ task: BoardTaskRow }> = ({ task }) => {
  const { actions } = useBoardContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={ref} type="button" className="bv-cell-btn bv-cell-center" aria-label={`Owners of ${task.title}`} onClick={() => setOpen(!open)}>
        {task.owners.length > 0 ? <OwnerStack owners={task.owners} /> : <span className="bv-owner-empty"><FaRegUser /></span>}
      </button>
      {open && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)} width={320} align="center">
          <PeoplePicker selected={task.owners} label="Search people to add as owners" onChange={(next) => actions.setOwners(task, next)} />
        </Popover>
      )}
    </>
  );
};

// ── Full-colour label cells ───────────────────────────────────────────────

const LabelOption: React.FC<{ color: string; label: string; disabled?: boolean; hint?: string; onClick: () => void }> = ({ color, label, disabled, hint, onClick }) => (
  <button type="button" className="bv-label-option" style={{ background: color }} disabled={disabled} title={hint} onClick={onClick}>
    {label}
  </button>
);

export const StatusCell: React.FC<{ task: BoardTaskRow }> = ({ task }) => {
  const { actions } = useBoardContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const stages = stagesForBoard(actions.board?.tasks || []);
  return (
    <>
      <button ref={ref} type="button" className="bv-label-cell" style={{ background: STAGE_COLOR[task.stageId] }} onClick={() => setOpen(!open)}>
        {stageLabel(task.stageId)}
      </button>
      {open && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)} width={236} align="center">
          <div className="bv-label-list">
            {stages.map((id) => {
              const lockedByOwner = id === 'not_started' && task.owners.length > 0 && task.stageId !== id;
              return (
                <LabelOption
                  key={id}
                  color={STAGE_COLOR[id]}
                  label={stageLabel(id)}
                  disabled={lockedByOwner}
                  hint={lockedByOwner ? 'Remove the owner to move this back' : undefined}
                  onClick={() => {
                    setOpen(false);
                    actions.moveStage(task, id);
                  }}
                />
              );
            })}
          </div>
        </Popover>
      )}
    </>
  );
};

export const PriorityCell: React.FC<{ task: BoardTaskRow }> = ({ task }) => {
  const { actions } = useBoardContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const choose = (priority: string | null) => {
    setOpen(false);
    actions.setFields(task, { priority });
  };
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`bv-label-cell${task.priority ? '' : ' empty'}`}
        style={{ background: task.priority ? PRIORITY_COLOR[task.priority] : EMPTY_FILL }}
        aria-label={`Priority of ${task.title}: ${task.priority || 'none'}`}
        onClick={() => setOpen(!open)}
      >
        {task.priority || ''}
      </button>
      {open && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)} width={180} align="center">
          <div className="bv-label-list">
            {PRIORITIES.map((p) => <LabelOption key={p} color={PRIORITY_COLOR[p]} label={p} onClick={() => choose(p)} />)}
            <button type="button" className="bv-label-clear" onClick={() => choose(null)}>Clear</button>
          </div>
        </Popover>
      )}
    </>
  );
};

// ── Dates ─────────────────────────────────────────────────────────────────

export const DateInput: React.FC<{ value: string | null; label: string; min?: string | null; max?: string | null; onChange: (value: string | null) => void }> = ({ value, label, min, max, onChange }) => (
  <label className="bv-date-field">
    <span>{label}</span>
    <input
      type="date"
      value={value || ''}
      min={min || undefined}
      max={max || undefined}
      onChange={(e) => onChange(e.target.value || null)}
    />
  </label>
);

export const DueCell: React.FC<{ task: BoardTaskRow }> = ({ task }) => {
  const { actions } = useBoardContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const overdue = isOverdue(task);
  return (
    <>
      <button ref={ref} type="button" className="bv-cell-btn bv-cell-center bv-due" aria-label={`Due date of ${task.title}`} onClick={() => setOpen(!open)}>
        {task.isCompleted && task.dueDate && <FaCheckCircle className="bv-due-done" aria-label="Done" />}
        {overdue && <FaExclamationCircle className="bv-due-late" aria-label="Overdue" />}
        {!task.isCompleted && !overdue && task.dueDate && <FaRegClock className="bv-due-soon" aria-hidden />}
        <span className={task.isCompleted ? 'bv-struck' : overdue ? 'bv-late-text' : ''}>{formatDay(task.dueDate)}</span>
        {!task.dueDate && <FaPlus className="bv-hover-plus" aria-hidden />}
      </button>
      {open && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)} width={220} align="center">
          <DateInput value={task.dueDate} label="Due date" min={task.startDate} onChange={(dueDate) => actions.setFields(task, { dueDate })} />
        </Popover>
      )}
    </>
  );
};

export const TimelineCell: React.FC<{ task: BoardTaskRow; color: string }> = ({ task, color }) => {
  const { actions } = useBoardContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const hasDates = !!task.startDate && !!task.dueDate;
  const progress = task.isCompleted ? 1 : timelineProgress(task.startDate, task.dueDate);
  const label = formatRange(task.startDate, task.dueDate);
  return (
    <>
      <button ref={ref} type="button" className="bv-cell-btn bv-cell-center" aria-label={`Timeline of ${task.title}`} onClick={() => setOpen(!open)}>
        <span
          className={`bv-timeline${label ? '' : ' empty'}`}
          style={hasDates ? { background: `linear-gradient(to right, ${color} ${progress * 100}%, #52525b ${progress * 100}%)` } : label ? { background: '#52525b' } : undefined}
        >
          {label || '-'}
        </span>
      </button>
      {open && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)} width={240} align="center">
          <div className="bv-date-pair">
            <DateInput value={task.startDate} label="Start" max={task.dueDate} onChange={(startDate) => actions.setFields(task, { startDate })} />
            <DateInput value={task.dueDate} label="Due" min={task.startDate} onChange={(dueDate) => actions.setFields(task, { dueDate })} />
          </div>
        </Popover>
      )}
    </>
  );
};

// ── Text and everything else ──────────────────────────────────────────────

export const InlineText: React.FC<{
  value: string;
  placeholder?: string;
  ariaLabel: string;
  inputType?: 'text' | 'number' | 'url';
  onSave: (value: string) => void;
}> = ({ value, placeholder, ariaLabel, inputType = 'text', onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <button
        type="button"
        className="bv-cell-btn bv-cell-center bv-text"
        aria-label={ariaLabel}
        title={value || undefined}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value ? <span className="bv-ellipsis">{value}</span> : <span className="bv-placeholder">{placeholder}</span>}
      </button>
    );
  }
  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value) onSave(draft.trim());
  };
  return (
    <input
      autoFocus
      className="bv-inline-input"
      type={inputType}
      value={draft}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
};

export const NotesCell: React.FC<{ task: BoardTaskRow }> = ({ task }) => {
  const { actions } = useBoardContext();
  return (
    <InlineText
      value={task.notes || ''}
      ariaLabel={`Notes on ${task.title}`}
      onSave={(notes) => actions.setFields(task, { notes: notes || null })}
    />
  );
};

export const UpdatedCell: React.FC<{ task: BoardTaskRow }> = ({ task }) => {
  const { openTask } = useBoardContext();
  return (
    <button type="button" className="bv-cell-btn bv-updated" title="See what changed" onClick={() => openTask(task, 'activity')}>
      {task.updatedBy && <UserAvatar name={task.updatedBy.name} avatarUrl={task.updatedBy.avatarUrl} size={24} />}
      <span className="bv-ellipsis">{timeAgo(task.updatedAt)}</span>
    </button>
  );
};

export const FilesCell: React.FC<{ task: BoardTaskRow }> = ({ task }) => {
  const { openTask } = useBoardContext();
  const shown = task.files.slice(0, 3);
  return (
    <button type="button" className="bv-cell-btn bv-cell-center bv-files" aria-label={`Files on ${task.title}: ${task.files.length}`} onClick={() => openTask(task, 'files')}>
      {shown.map((file) => (
        <span key={file.id} className="bv-file-icon" title={file.filename || file.url}>
          {file.kind === 'link' ? <FaLink /> : <FaFileAlt />}
        </span>
      ))}
      {task.files.length > 3 && <span className="bv-file-more">+{task.files.length - 3}</span>}
      {task.files.length === 0 && <FaPlus className="bv-hover-plus" aria-hidden />}
    </button>
  );
};

export const DepartmentCell: React.FC<{ task: BoardTaskRow }> = ({ task }) => {
  const { transferTask } = useBoardContext();
  return (
    <button type="button" className="bv-cell-btn bv-cell-center bv-text" title="Send to another department" onClick={() => transferTask(task)}>
      <span className="bv-ellipsis">{task.type}</span>
    </button>
  );
};

export const CustomCell: React.FC<{ task: BoardTaskRow; column: BoardColumn }> = ({ task, column }) => {
  const { actions, people } = useBoardContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const value = task.customFields?.[column.id];
  const save = (next: unknown) => actions.setFields(task, { customFields: { [column.id]: next } });
  const ariaLabel = `${column.name} of ${task.title}`;

  switch (column.type) {
    case 'text':
      return <InlineText value={value || ''} ariaLabel={ariaLabel} onSave={(text) => save(text || null)} />;
    case 'number':
      return <InlineText value={value === undefined || value === null ? '' : String(value)} inputType="number" ariaLabel={ariaLabel} onSave={(text) => save(text === '' ? null : Number(text))} />;
    case 'checkbox':
      return (
        <button type="button" role="checkbox" aria-checked={!!value} aria-label={ariaLabel} className="bv-cell-btn bv-cell-center" onClick={() => save(!value)}>
          <span className={`bv-check${value ? ' on' : ''}`}>{value && <FaCheck />}</span>
        </button>
      );
    case 'link': {
      if (value) {
        return (
          <span className="bv-link-cell">
            <a href={value} target="_blank" rel="noopener noreferrer" className="bv-ellipsis" title={value}>{value.replace(/^https?:\/\//, '')}</a>
            <button type="button" aria-label={`Remove ${ariaLabel}`} onClick={() => save(null)}><FaTimes /></button>
          </span>
        );
      }
      return <InlineText value="" inputType="url" ariaLabel={ariaLabel} onSave={(text) => save(text || null)} />;
    }
    case 'date':
      return (
        <>
          <button ref={ref} type="button" className="bv-cell-btn bv-cell-center" aria-label={ariaLabel} onClick={() => setOpen(!open)}>
            {value ? formatDay(value) : <FaPlus className="bv-hover-plus" aria-hidden />}
          </button>
          {open && (
            <Popover anchor={ref.current} onClose={() => setOpen(false)} width={220} align="center">
              <DateInput value={value || null} label={column.name} onChange={save} />
            </Popover>
          )}
        </>
      );
    case 'status': {
      const current = column.labels.find((l) => l.label === value);
      return (
        <>
          <button ref={ref} type="button" aria-label={ariaLabel} className={`bv-label-cell${current ? '' : ' empty'}`} style={{ background: current?.color || EMPTY_FILL }} onClick={() => setOpen(!open)}>
            {current?.label || ''}
          </button>
          {open && (
            <Popover anchor={ref.current} onClose={() => setOpen(false)} width={200} align="center">
              <div className="bv-label-list">
                {column.labels.map((l) => <LabelOption key={l.label} color={l.color} label={l.label} onClick={() => { setOpen(false); save(l.label); }} />)}
                <button type="button" className="bv-label-clear" onClick={() => { setOpen(false); save(null); }}>Clear</button>
              </div>
            </Popover>
          )}
        </>
      );
    }
    case 'people': {
      const ids: string[] = Array.isArray(value) ? value : [];
      const chosen = ids.map((id) => people.find((p) => p.id === id)).filter(Boolean) as BoardPerson[];
      return (
        <>
          <button ref={ref} type="button" aria-label={ariaLabel} className="bv-cell-btn bv-cell-center" onClick={() => setOpen(!open)}>
            {chosen.length > 0 ? <OwnerStack owners={chosen} /> : <span className="bv-owner-empty"><FaRegUser /></span>}
          </button>
          {open && (
            <Popover anchor={ref.current} onClose={() => setOpen(false)} width={320} align="center">
              <PeoplePicker selected={chosen} label={`Search people for ${column.name}`} onChange={(next) => save(next.map((p) => p.id))} />
            </Popover>
          )}
        </>
      );
    }
    default:
      return null;
  }
};

export const ColumnCell: React.FC<{ columnId: string; custom?: BoardColumn; task: BoardTaskRow; color: string }> = ({ columnId, custom, task, color }) => {
  if (custom) return <CustomCell task={task} column={custom} />;
  switch (columnId) {
    case 'owner': return <OwnerCell task={task} />;
    case 'status': return <StatusCell task={task} />;
    case 'due': return <DueCell task={task} />;
    case 'priority': return <PriorityCell task={task} />;
    case 'notes': return <NotesCell task={task} />;
    case 'updated': return <UpdatedCell task={task} />;
    case 'timeline': return <TimelineCell task={task} color={color} />;
    case 'files': return <FilesCell task={task} />;
    case 'department': return <DepartmentCell task={task} />;
    default: return null;
  }
};

export const FilterCheck: React.FC<{ checked: boolean; label: React.ReactNode; onToggle: () => void }> = ({ checked, label, onToggle }) => (
  <button type="button" role="checkbox" aria-checked={checked} className={`bv-menu-item${checked ? ' selected' : ''}`} onClick={onToggle}>
    <span className={`bv-check small${checked ? ' on' : ''}`}>{checked && <FaCheck />}</span>
    <span className="bv-ellipsis">{label}</span>
  </button>
);

export const SearchField: React.FC<{ value: string; onChange: (value: string) => void; placeholder: string; autoFocus?: boolean }> = ({ value, onChange, placeholder, autoFocus }) => (
  <label className="bv-search-field">
    <FaSearch aria-hidden />
    <input autoFocus={autoFocus} value={value} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(e.target.value)} />
  </label>
);
