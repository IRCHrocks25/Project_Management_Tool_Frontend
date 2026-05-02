import React from 'react';
import { FaRegGem, FaRegCommentDots } from 'react-icons/fa';
import { TuesdayRow } from '../rowTypes';

interface Props {
  row: TuesdayRow;
  onOpenTaskDetail?: () => void;        // L3 only — diamond
  onOpenTaskConversation?: () => void;  // L3 only — chat-bubble
  onOpenProjectDetail?: () => void;     // L1 only — diamond
}

// Dedicated narrow column. L2 deliverable rows render an empty cell so
// vertical alignment with L1/L3 stays consistent across the column.
const RowActionsCell: React.FC<Props> = ({
  row, onOpenTaskDetail, onOpenTaskConversation, onOpenProjectDetail,
}) => {
  if (row.kind === 'project') {
    if (!onOpenProjectDetail) return null;
    return (
      <span className="tuesday-row-actions">
        <button
          type="button"
          className="tuesday-row-icon"
          title="Open project"
          onClick={(e) => { e.stopPropagation(); onOpenProjectDetail(); }}
        >
          <FaRegGem size={14} />
        </button>
      </span>
    );
  }

  if (row.kind === 'task') {
    return (
      <span className="tuesday-row-actions">
        {onOpenTaskDetail && (
          <button
            type="button"
            className="tuesday-row-icon"
            title="Open task"
            onClick={(e) => { e.stopPropagation(); onOpenTaskDetail(); }}
          >
            <FaRegGem size={14} />
          </button>
        )}
        {onOpenTaskConversation && (
          <button
            type="button"
            className="tuesday-row-icon"
            title="Open conversation"
            onClick={(e) => { e.stopPropagation(); onOpenTaskConversation(); }}
          >
            <FaRegCommentDots size={14} />
          </button>
        )}
      </span>
    );
  }

  // L2 deliverable: empty cell. Returning null still leaves the <td> in
  // place from TuesdayView, so column alignment is preserved.
  return null;
};

export default RowActionsCell;
