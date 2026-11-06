import React from 'react';
import { TuesdayRow } from '../rowTypes';
import { PRIORITIES, PRIORITY_COLOR } from '../../boards/boardConfig';
import LabelMenu from './LabelMenu';

interface Props {
  row: TuesdayRow;
  projectPriority: string;
  onChangeProjectPriority?: (newPriority: string) => void;
}

const PriorityCell: React.FC<Props> = ({ row, projectPriority, onChangeProjectPriority }) => {
  if (row.kind === 'project') {
    const value = row.data.priority;
    const color = PRIORITY_COLOR[value] || '#6b7280';
    if (!onChangeProjectPriority) {
      return <span className="tuesday-fill" style={{ background: color }}>{value}</span>;
    }
    return (
      <LabelMenu
        className="tuesday-fill"
        style={{ background: color }}
        ariaLabel={`Priority of ${row.data.name}: ${value}`}
        width={180}
        options={PRIORITIES.map((p) => ({ value: p, label: p, color: PRIORITY_COLOR[p] }))}
        onSelect={onChangeProjectPriority}
      >
        {value}
      </LabelMenu>
    );
  }
  // L2/L3 inherit from project, rendered muted-italic, read-only
  return <span className="tuesday-priority tuesday-priority--inherited">{projectPriority}</span>;
};

export default PriorityCell;
