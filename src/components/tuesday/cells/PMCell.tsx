import React from 'react';
import { TuesdayRow } from '../rowTypes';

interface Props { row: TuesdayRow; projectPm: { id: string; name: string; avatarUrl: string | null } | null }

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');
}

const PMCell: React.FC<Props> = ({ row, projectPm }) => {
  // PM is the same up and down the tree; only render avatar at L1, muted
  // text on L2/L3 to keep the cell from being noisy.
  if (!projectPm) return <span className="tuesday-muted">—</span>;
  if (row.kind === 'project') {
    return (
      <span className="tuesday-pm">
        <span className="tuesday-avatar" title={projectPm.name}>
          {projectPm.avatarUrl ? <img src={projectPm.avatarUrl} alt="" /> : initials(projectPm.name)}
        </span>
        <span>{projectPm.name}</span>
      </span>
    );
  }
  return <span className="tuesday-muted">{projectPm.name}</span>;
};

export default PMCell;
