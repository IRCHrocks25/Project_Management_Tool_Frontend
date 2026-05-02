import React from 'react';
import { FaCaretDown, FaCaretUp } from 'react-icons/fa';
import { SortState } from './hooks/useTuesdayFilters';

const COLUMNS = [
  { key: 'name',       label: 'Name',       width: '28%' },
  // Blank-header narrow column for row-action icons (diamond / chat).
  // Fixed width so icons align cleanly across L1/L2/L3 regardless of
  // surrounding cell content.
  { key: 'actions',    label: '',           width: '60px' },
  { key: 'status',     label: 'Status',     width: '18%' },
  { key: 'priority',   label: 'Priority',   width: '10%' },
  { key: 'timeline',   label: 'Timeline',   width: '14%' },
  { key: 'pm',         label: 'PM',         width: '12%' },
  { key: 'department', label: 'Department', width: '7%' },
  { key: 'assignee',   label: 'Assignee',   width: '7%' },
];

// Assignee, department, and actions deliberately not sortable.
// Assignee sorting is ambiguous (tasks have multiple assignees, no
// canonical pick). Department sort doesn't apply at the project level
// (a project owns multiple departments via its tasks) — sort happens
// server-side at L1 only, so the toolbar exposes only project-level
// sort columns. Actions is a non-data column.
const SORTABLE_KEYS = new Set(['name', 'status', 'priority', 'timeline', 'pm']);

interface Props {
  sort: SortState | null;
  onSort: (columnKey: string) => void;
}

const TuesdayHeader: React.FC<Props> = ({ sort, onSort }) => (
  <thead className="tuesday-thead">
    <tr>
      {COLUMNS.map((c) => {
        const sortable = SORTABLE_KEYS.has(c.key);
        const isSorted = sort?.column === c.key;
        const dir = isSorted ? sort!.direction : null;
        return (
          <th
            key={c.key}
            className={`tuesday-th ${sortable ? 'tuesday-th--sortable' : ''} ${isSorted ? 'tuesday-th--sorted' : ''}`}
            style={{ width: c.width }}
            onClick={sortable ? () => onSort(c.key) : undefined}
            aria-sort={isSorted ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
          >
            <span className="tuesday-th-label">{c.label}</span>
            {isSorted && (
              <span className="tuesday-th-sort-indicator">
                {dir === 'asc' ? <FaCaretUp size={11} /> : <FaCaretDown size={11} />}
              </span>
            )}
          </th>
        );
      })}
    </tr>
  </thead>
);

export default TuesdayHeader;
export { COLUMNS as TUESDAY_COLUMNS };
