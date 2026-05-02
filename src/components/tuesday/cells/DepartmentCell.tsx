import React from 'react';
import { TuesdayRow } from '../rowTypes';

interface Props {
  row: TuesdayRow;
  onOpenTransfer?: () => void;  // L3 only — opens TransferTaskModal
}

// Department column is narrow (~7% of width). Beyond 3 depts the comma-list
// wraps and inflates row height. Show first 2 + "+N more"; tooltip carries
// the full list.
function renderDepts(types: Set<string>): JSX.Element {
  if (types.size === 0) return <span className="tuesday-muted">—</span>;
  const names = Array.from(types).sort();
  const full = names.join(', ');
  const display = names.length <= 3
    ? full
    : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
  return <span className="tuesday-muted tuesday-dept-cell" title={full}>{display}</span>;
}

const DepartmentCell: React.FC<Props> = ({ row, onOpenTransfer }) => {
  if (row.kind === 'task') {
    if (!onOpenTransfer) return <span>{row.data.type}</span>;
    return (
      <span
        className="tuesday-dept-task"
        title="Click to transfer to another department"
        onClick={(e) => { e.stopPropagation(); onOpenTransfer(); }}
      >
        {row.data.type} <span className="tuesday-inline-edit-icon">✎</span>
      </span>
    );
  }
  if (row.kind === 'deliverable') {
    return renderDepts(new Set(row.data.tasks.map((t) => t.type)));
  }
  // project: aggregate across all child tasks (including the orphan bucket
  // the backend appends as a synthetic deliverable)
  const types = new Set<string>();
  for (const d of row.data.deliverables) for (const t of d.tasks) types.add(t.type);
  return renderDepts(types);
};

export default DepartmentCell;
