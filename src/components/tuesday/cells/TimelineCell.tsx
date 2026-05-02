import React, { useEffect, useRef, useState } from 'react';
import { TuesdayRow } from '../rowTypes';

interface Props {
  row: TuesdayRow;
  onChangeTaskDueDate?: (newDate: string | null) => void; // YYYY-MM-DD or null
}

function fmt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isoToInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

const TimelineCell: React.FC<Props> = ({ row, onChangeTaskDueDate }) => {
  if (row.kind === 'project') {
    // Per locked decision #5: render "No timeline set" whenever clientStartDate
    // is null. We never parse targetCloseMonth and never substitute task dueDates.
    const start = fmt(row.data.clientStartDate);
    if (!start) return <span className="tuesday-muted">No timeline set</span>;
    return <span className="tuesday-mono">{start} →</span>;
  }
  if (row.kind === 'deliverable') {
    const min = fmt(row.data.minDueDate);
    const max = fmt(row.data.maxDueDate);
    if (!min && !max) return <span className="tuesday-muted">—</span>;
    if (min === max) return <span className="tuesday-mono">{min}</span>;
    return <span className="tuesday-mono">{min} → {max}</span>;
  }
  // task — click-to-edit date input
  return <TaskDueDateEditor task={row.data} onChange={onChangeTaskDueDate} />;
};

interface EditorProps {
  task: { dueDate: string | null };
  onChange?: (newDate: string | null) => void;
}

const TaskDueDateEditor: React.FC<EditorProps> = ({ task, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(isoToInputValue(task.dueDate));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { if (!editing) setValue(isoToInputValue(task.dueDate)); }, [task.dueDate, editing]);

  if (!onChange) {
    const due = fmt(task.dueDate);
    return due ? <span className="tuesday-mono">{due}</span> : <span className="tuesday-muted">—</span>;
  }

  if (editing) {
    return (
      <span className="tuesday-due-edit">
        <input
          ref={ref}
          type="date"
          className="tuesday-due-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            setEditing(false);
            onChange(value || null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); setEditing(false); onChange(value || null); }
            else if (e.key === 'Escape') { e.preventDefault(); setEditing(false); setValue(isoToInputValue(task.dueDate)); }
          }}
          onClick={(e) => e.stopPropagation()}
        />
        {task.dueDate && (
          <button
            type="button"
            className="tuesday-due-clear"
            onMouseDown={(e) => {
              // mousedown so it fires before the input's blur kills our click
              e.preventDefault();
              setEditing(false);
              onChange(null);
            }}
            title="Clear due date"
          >
            ×
          </button>
        )}
      </span>
    );
  }

  const due = fmt(task.dueDate);
  return (
    <span
      className="tuesday-mono tuesday-due-display"
      title="Click to change due date"
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
    >
      {due || <span className="tuesday-muted">+ Set date</span>}
    </span>
  );
};

export default TimelineCell;
