import React, { useEffect, useRef, useState } from 'react';
import AssigneePicker from '../../task-detail/AssigneePicker';
import { TuesdayRow } from '../rowTypes';
import { BoardAssignee, BoardTask } from '../../../services/boardView.service';

interface Props {
  row: TuesdayRow;
  projectPm: { id: string; name: string; avatarUrl: string | null } | null;
  allUsers?: any[];
  getUserName?: (id: string) => string;
  onChangeTaskAssignees?: (newUserIds: string[]) => void;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');
}

function avatarFor(a: BoardAssignee | { id: string; name: string; avatarUrl: string | null }, key?: string) {
  return (
    <span key={key || a.id} className="tuesday-avatar" title={a.name}>
      {a.avatarUrl ? <img src={a.avatarUrl} alt="" /> : initials(a.name)}
    </span>
  );
}

const MAX_VISIBLE = 3;

function CompactStack({ assignees, emptyLabel }: { assignees: BoardAssignee[]; emptyLabel: string }) {
  if (assignees.length === 0) return <span className="tuesday-muted">{emptyLabel}</span>;
  const visible = assignees.slice(0, MAX_VISIBLE);
  const overflow = assignees.length - visible.length;
  return (
    <span className="tuesday-assignees">
      <span className="tuesday-avatar-stack">{visible.map((a, i) => avatarFor(a, `${a.id}-${i}`))}</span>
      {overflow > 0 && <span className="tuesday-muted">+{overflow}</span>}
    </span>
  );
}

// Task-level cell: compact avatar trigger, AssigneePicker rendered in a
// floating popover above the cell so it doesn't inflate row height.
// Matches the InlineEditDropdown popover treatment (position: absolute,
// var(--td-shadow-panel), z-index: 200).
const TaskAssigneeCell: React.FC<{
  task: BoardTask;
  allUsers: any[];
  getUserName: (id: string) => string;
  onChange: (newUserIds: string[]) => void;
}> = ({ task, allUsers, getUserName, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const ids = task.assignees.map((a) => a.id);

  return (
    <span ref={ref} className="tuesday-assignee-host" onClick={(e) => e.stopPropagation()}>
      <span
        className="tuesday-assignee-trigger"
        title={ids.length === 0 ? 'Click to assign' : 'Click to edit assignees'}
        onClick={() => setOpen((o) => !o)}
      >
        <CompactStack assignees={task.assignees} emptyLabel="+ Assign" />
      </span>
      {open && (
        <div className="tuesday-assignee-popover">
          <AssigneePicker
            allUsers={allUsers}
            assigneeIds={ids}
            getUserName={getUserName}
            onAssigneesChange={onChange}
          />
        </div>
      )}
    </span>
  );
};

const AssigneeCell: React.FC<Props> = ({
  row, projectPm, allUsers, getUserName, onChangeTaskAssignees,
}) => {
  if (row.kind === 'project') {
    if (!projectPm) return <span className="tuesday-muted">—</span>;
    return <span className="tuesday-assignees">{avatarFor(projectPm)}</span>;
  }

  if (row.kind === 'deliverable') {
    const seen = new Set<string>();
    const assignees: BoardAssignee[] = [];
    for (const t of row.data.tasks) {
      for (const a of t.assignees) {
        if (!seen.has(a.id)) { seen.add(a.id); assignees.push(a); }
      }
    }
    return <CompactStack assignees={assignees} emptyLabel="Unassigned" />;
  }

  // task — editable via floating popover when full editing context is available
  if (allUsers && getUserName && onChangeTaskAssignees) {
    return (
      <TaskAssigneeCell
        task={row.data}
        allUsers={allUsers}
        getUserName={getUserName}
        onChange={onChangeTaskAssignees}
      />
    );
  }

  // Fallback — read-only compact stack
  return <CompactStack assignees={row.data.assignees} emptyLabel="Unassigned" />;
};

export default AssigneeCell;
