import React from 'react';
import InlineEditDropdown from '../../task-detail/InlineEditDropdown';
import { TuesdayRow } from '../rowTypes';

interface Props {
  row: TuesdayRow;
  projectPriority: string;
  onChangeProjectPriority?: (newPriority: string) => void;
}

const CLASS_BY_PRIORITY: Record<string, string> = {
  Low:    'tuesday-priority--low',
  Medium: 'tuesday-priority--medium',
  High:   'tuesday-priority--high',
  Urgent: 'tuesday-priority--urgent',
};

const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];

const PriorityCell: React.FC<Props> = ({ row, projectPriority, onChangeProjectPriority }) => {
  if (row.kind === 'project') {
    const value = row.data.priority;
    if (!onChangeProjectPriority) {
      return <span className={`tuesday-priority ${CLASS_BY_PRIORITY[value] || ''}`}>{value}</span>;
    }
    return (
      <InlineEditDropdown
        trigger={
          <span className={`tuesday-priority tuesday-priority--editable ${CLASS_BY_PRIORITY[value] || ''}`}>
            {value}
          </span>
        }
        options={PRIORITY_OPTIONS.map((p) => ({
          value: p,
          label: <span className={`tuesday-priority ${CLASS_BY_PRIORITY[p] || ''}`}>{p}</span>,
        }))}
        onSelect={onChangeProjectPriority}
      />
    );
  }
  // L2/L3 inherit from project, rendered muted-italic, read-only
  return <span className="tuesday-priority tuesday-priority--inherited">{projectPriority}</span>;
};

export default PriorityCell;
