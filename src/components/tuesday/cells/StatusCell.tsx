import React from 'react';
import InlineEditDropdown from '../../task-detail/InlineEditDropdown';
import { TuesdayRow } from '../rowTypes';
import { KANBAN_COLUMNS } from '../../../utils/taskKanbanColumn';

const COLOR_BY_LABEL: Record<string, string> = KANBAN_COLUMNS.reduce(
  (acc, c) => { acc[c.label] = c.color; return acc; },
  {} as Record<string, string>,
);

const DELIV_DOT_COLOR: Record<string, string> = {
  'Not Started':       '#9199a8',
  'In Progress':       '#1971c2',
  'Ready for Review':  '#e67700',
  'Client Review':     '#f97316',
  'Approved':          '#2f9e44',
  'Revision':          '#c92a2a',
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

function rollupBar(visibleDone: number, visibleTotal: number, label: string) {
  // Bar fill tracks the visible numerator so the user can see filter
  // progress visually. When no filter is active visibleDone/visibleTotal
  // equal the backend totals, so the bar shape is unchanged from before.
  const pct = visibleTotal === 0 ? 0 : Math.round((visibleDone / visibleTotal) * 100);
  return (
    <span className="tuesday-rollup">
      <span>{label}</span>
      <span className="tuesday-rollup-bar"><span className="tuesday-rollup-bar-fill" style={{ width: `${pct}%` }} /></span>
    </span>
  );
}

// Walks the (already-filtered) project / deliverable subtree and counts
// (visibleTotal, visibleDone). Cheap — typical project has a couple
// dozen tasks at most after filtering.
function countVisible(node: { tasks?: { kanbanColumnId: string; isCompleted: boolean }[]; deliverables?: { tasks: { kanbanColumnId: string; isCompleted: boolean }[] }[] }): { total: number; done: number } {
  let total = 0;
  let done = 0;
  const tasks = node.tasks ?? (node.deliverables ?? []).flatMap((d) => d.tasks);
  for (const t of tasks) {
    total += 1;
    if (t.kanbanColumnId === 'approved_completed' || t.isCompleted) done += 1;
  }
  return { total, done };
}

const StatusCell: React.FC<Props> = ({ row, onChangeDeliverableStatus, onChangeTaskStatus, anyFilterActive }) => {
  if (row.kind === 'project') {
    // L1 status is a rollup, not editable.
    // Backend total = unfiltered count (Z); visible counts derive from
    // the loaded subtree (server-side filtered before reaching us).
    const total = row.data.rollup.total;
    const done = row.data.rollup.done;
    if (anyFilterActive) {
      const { total: visTotal, done: visDone } = countVisible(row.data);
      return rollupBar(visDone, visTotal, `${visDone} of ${visTotal} visible / ${total} total`);
    }
    return rollupBar(done, total, `${done} of ${total} done`);
  }

  if (row.kind === 'deliverable') {
    const total = row.data.rollup.total;
    const done = row.data.rollup.done;
    const isUnassigned = row.data.id === '__unassigned__';
    const dotColor = row.data.status ? DELIV_DOT_COLOR[row.data.status] || '#9199a8' : null;
    const labelText = (() => {
      if (anyFilterActive) {
        const { total: visTotal, done: visDone } = countVisible(row.data);
        return `${visDone} of ${visTotal} visible / ${total} total`;
      }
      return `${done} of ${total} tasks done`;
    })();
    const rollup = <span className="tuesday-rollup"><span>{labelText}</span></span>;

    if (isUnassigned || !onChangeDeliverableStatus || !row.data.status) {
      return (
        <span>
          {dotColor && <span className="tuesday-deliv-status-dot" style={{ background: dotColor }} title={row.data.status || ''} />}
          {rollup}
        </span>
      );
    }
    return (
      <span>
        <InlineEditDropdown
          trigger={
            <span className="tuesday-deliv-status-trigger" title="Click to change status">
              <span className="tuesday-deliv-status-dot" style={{ background: dotColor || '#9199a8' }} />
              <span className="tuesday-deliv-status-label">{row.data.status}</span>
            </span>
          }
          options={DELIV_STATUSES.map((s) => ({
            value: s,
            label: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span className="tuesday-deliv-status-dot" style={{ background: DELIV_DOT_COLOR[s] || '#9199a8' }} />
                {s}
              </span>
            ),
          }))}
          onSelect={onChangeDeliverableStatus}
        />
        <span style={{ marginLeft: '10px' }}>{rollup}</span>
      </span>
    );
  }

  // task
  const color = COLOR_BY_LABEL[row.data.kanbanColumnLabel] || '#9199a8';
  const pill = (
    <span className="tuesday-status-pill" style={{ background: color }}>
      {row.data.kanbanColumnLabel}
    </span>
  );
  if (!onChangeTaskStatus) return pill;
  return (
    <InlineEditDropdown
      trigger={pill}
      options={KANBAN_COLUMNS.map((c) => ({
        value: c.label,
        label: (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
            {c.label}
          </span>
        ),
      }))}
      onSelect={onChangeTaskStatus}
    />
  );
};

export default StatusCell;
