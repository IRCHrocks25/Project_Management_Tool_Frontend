import React, { useMemo, useRef, useState } from 'react';
import Popover from '../../boards/Popover';
import { PeoplePicker } from '../../boards/cells';
import { TuesdayRow } from '../rowTypes';
import { BoardAssignee, BoardTask } from '../../../services/boardView.service';

interface Props {
  row: TuesdayRow;
  projectPm: { id: string; name: string; avatarUrl: string | null } | null;
  allUsers?: any[];
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

// Task-level cell: compact avatars open the Boards people picker on the page
// body, so the table can't clip it and row height never changes.
const TaskAssigneeCell: React.FC<{
  task: BoardTask;
  allUsers: any[];
  onChange: (newUserIds: string[]) => void;
}> = ({ task, allUsers, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const people = useMemo(
    () => allUsers
      .map((u) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [allUsers],
  );

  return (
    <>
      <button
        ref={ref}
        type="button"
        className="tuesday-assignee-trigger"
        title={task.assignees.length === 0 ? 'Click to assign' : 'Click to edit assignees'}
        onClick={() => setOpen((o) => !o)}
      >
        <CompactStack assignees={task.assignees} emptyLabel="+ Assign" />
      </button>
      {open && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)} width={320} align="right">
          <PeoplePicker
            selected={task.assignees}
            people={people}
            label="Search people to assign"
            onChange={(next) => onChange(next.map((p) => p.id))}
          />
        </Popover>
      )}
    </>
  );
};

const AssigneeCell: React.FC<Props> = ({
  row, projectPm, allUsers, onChangeTaskAssignees,
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
  if (allUsers && onChangeTaskAssignees) {
    return (
      <TaskAssigneeCell
        task={row.data}
        allUsers={allUsers}
        onChange={onChangeTaskAssignees}
      />
    );
  }

  // Fallback — read-only compact stack
  return <CompactStack assignees={row.data.assignees} emptyLabel="Unassigned" />;
};

export default AssigneeCell;
