import React from 'react';
import { TuesdayRow } from '../rowTypes';
import { KANBAN_COLUMNS } from '../../../utils/taskKanbanColumn';
import { EMPTY_FILL, STAGE_COLOR } from '../../boards/boardConfig';
import LabelMenu from './LabelMenu';

const DELIV_COLOR: Record<string, string> = {
  'Not Started':       '#6b7280',
  'In Progress':       '#0f766e',
  'Ready for Review':  '#b45309',
  'Client Review':     '#a16207',
  'Approved':          '#15803d',
  'Revision':          '#b91c1c',
};

const DELIV_STATUSES = ['Not Started', 'In Progress', 'Ready for Review', 'Client Review', 'Approved', 'Revision'];

interface Props {
  row: TuesdayRow;
  onChangeDeliverableStatus?: (newStatus: string) => void;  // Real deliverables only
  onChangeTaskStatus?: (newColumnLabel: string) => void;
  // When true, rollup labels render as "X of Y visible / Z total".
  // When false (no filter active), they render as "X of Z" — backend totals.
  // "Y visible" reflects rows on the current page that match the active
  // filters; the server returns a pre-filtered tree, so visible counts
  // are derived directly from `row.data`. Z (total) is the unfiltered
  // backend rollup, preserved on every project/deliverable.
  anyFilterActive?: boolean;
}

type TaskCounts = { kanbanColumnId: string; isCompleted: boolean };

const tasksIn = (node: { tasks?: TaskCounts[]; deliverables?: { tasks: TaskCounts[] }[] }): TaskCounts[] =>
  node.tasks ?? (node.deliverables ?? []).flatMap((d) => d.tasks);

// One colour per stage, so a glance shows where the work is, not just how much is done.
const StageBar: React.FC<{ tasks: TaskCounts[] }> = ({ tasks }) => {
  const parts = KANBAN_COLUMNS
    .map((c) => ({ id: c.id, label: c.label, count: tasks.filter((t) => t.kanbanColumnId === c.id).length }))
    .filter((p) => p.count > 0);
  return (
    <span
      className="tuesday-stagebar"
      role="img"
      aria-label={parts.map((p) => `${p.label}: ${p.count}`).join(', ') || 'No tasks'}
    >
      {parts.length === 0 && <span style={{ flex: 1, background: EMPTY_FILL }} />}
      {parts.map((p) => (
        <span key={p.id} title={`${p.label}: ${p.count}`} style={{ flex: p.count, background: STAGE_COLOR[p.id] }} />
      ))}
    </span>
  );
};

function countVisible(node: { tasks?: TaskCounts[]; deliverables?: { tasks: TaskCounts[] }[] }): { total: number; done: number } {
  const tasks = tasksIn(node);
  return {
    total: tasks.length,
    done: tasks.filter((t) => t.kanbanColumnId === 'approved_completed' || t.isCompleted).length,
  };
}

const StatusCell: React.FC<Props> = ({ row, onChangeDeliverableStatus, onChangeTaskStatus, anyFilterActive }) => {
  if (row.kind === 'project' || row.kind === 'deliverable') {
    const { total, done } = row.data.rollup;
    const noun = row.kind === 'project' ? 'done' : 'tasks done';
    let label = `${done} of ${total} ${noun}`;
    if (anyFilterActive) {
      const visible = countVisible(row.data);
      label = `${visible.done} of ${visible.total} visible / ${total} total`;
    }
    const rollup = (
      <span className="tuesday-rollup">
        <StageBar tasks={tasksIn(row.data)} />
        <span>{label}</span>
      </span>
    );
    if (row.kind === 'project') return rollup;

    const status = row.data.status;
    if (!onChangeDeliverableStatus || !status) return rollup;
    return (
      <span className="tuesday-deliv-status">
        <LabelMenu
          className="tuesday-deliv-pill"
          style={{ background: DELIV_COLOR[status] || '#6b7280' }}
          ariaLabel={`Deliverable status: ${status}`}
          title="Click to change status"
          options={DELIV_STATUSES.map((s) => ({ value: s, label: s, color: DELIV_COLOR[s] }))}
          onSelect={onChangeDeliverableStatus}
        >
          {status}
        </LabelMenu>
        {rollup}
      </span>
    );
  }

  // task
  const task = row.data;
  const color = STAGE_COLOR[task.kanbanColumnId] || '#6b7280';
  if (!onChangeTaskStatus) {
    return <span className="tuesday-fill" style={{ background: color }}>{task.kanbanColumnLabel}</span>;
  }
  return (
    <LabelMenu
      className="tuesday-fill"
      style={{ background: color }}
      ariaLabel={`Status of ${task.title}: ${task.kanbanColumnLabel}`}
      width={250}
      options={KANBAN_COLUMNS.map((c) => {
        // The shared stage rules send a task with an owner straight back to in progress.
        const locked = c.id === 'not_started' && task.assignees.length > 0 && task.kanbanColumnId !== c.id;
        return {
          value: c.label,
          label: c.label,
          color: STAGE_COLOR[c.id],
          disabled: locked,
          hint: locked ? 'Remove the owner to move this back' : undefined,
        };
      })}
      onSelect={onChangeTaskStatus}
    >
      {task.kanbanColumnLabel}
    </LabelMenu>
  );
};

export default StatusCell;
