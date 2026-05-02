import React, { useEffect, useRef, useState } from 'react';
import { FaChevronDown, FaChevronRight, FaExclamationTriangle } from 'react-icons/fa';
import { TuesdayRow } from '../rowTypes';
import { DeliverableType } from '../deliverableTypes';

interface Props {
  row: TuesdayRow;
  depth: number;       // 0 = project, 1 = deliverable, 2 = task
  canExpand: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  unassignedCount?: number;          // Project rows only
  onRenameProject?: (newName: string) => void;
  onRenameDeliverable?: (newName: string) => void;
  // Task names are NOT inline-editable. Clicking the task name opens
  // TaskDetailSideModal (same flow as PMTasksTableView), where the title
  // is edited via the existing TaskHeader. This matches the spec: title
  // is editable at L3 but through the side modal, not the table cell.
  // Row-action icons (diamond / chat-bubble) live in their own column,
  // not here — see RowActionsCell.
  onOpenTaskDetail?: () => void;
}

const INDENT = 18;
const UNASSIGNED_TOOLTIP =
  'These tasks have no deliverable assigned. Open a task and link it to a deliverable to organize them.';

// Real deliverables get inline rename only when their stored name differs
// from the enum types (i.e. they're customType-bearing). For canonical
// types like "Logo"/"Brand Book" we don't expose rename — the backend
// only honors customType when type==='Other'. See useTuesdayMutations
// editDeliverableName for the data-model rationale.
function isDeliverableRenameable(name: string): boolean {
  return !ENUM_TYPES.has(name);
}
const ENUM_TYPES: Set<string> = new Set(Object.values(DeliverableType) as string[]);

const NameCell: React.FC<Props> = ({
  row, depth, canExpand, isExpanded, onToggleExpand, unassignedCount,
  onRenameProject, onRenameDeliverable, onOpenTaskDetail,
}) => {
  const isUnassignedDeliv = row.kind === 'deliverable' && row.data.id === '__unassigned__';
  const isProject = row.kind === 'project';
  const isDeliverable = row.kind === 'deliverable';
  const isTask = row.kind === 'task';

  const currentName =
    row.kind === 'project' ? row.data.name
    : row.kind === 'deliverable' ? row.data.name
    : row.data.title;

  // Inline rename only for project + non-canonical deliverables.
  // Task title edits go through TaskDetailSideModal (the side modal opens
  // when the task name is clicked).
  const renameable =
    (isProject && !!onRenameProject)
    || (isDeliverable && !isUnassignedDeliv && !!onRenameDeliverable && isDeliverableRenameable(currentName));

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);
  useEffect(() => { if (!editing) setDraft(currentName); }, [currentName, editing]);

  const commit = () => {
    setEditing(false);
    if (isProject) onRenameProject?.(draft);
    else if (isDeliverable) onRenameDeliverable?.(draft);
  };
  const cancel = () => { setDraft(currentName); setEditing(false); };

  const handleNameClick = (e: React.MouseEvent) => {
    if (renameable) {
      e.stopPropagation();
      setDraft(currentName);
      setEditing(true);
    } else if (isTask && onOpenTaskDetail) {
      e.stopPropagation();
      onOpenTaskDetail();
    }
  };

  const nameClass =
    depth === 0 ? 'tuesday-name-text--project'
    : depth === 1 ? 'tuesday-name-text--deliverable'
    : 'tuesday-name-text--task';

  const taskClickable = isTask && !!onOpenTaskDetail;

  return (
    <div className="tuesday-name">
      <span className="tuesday-name-indent" style={{ width: depth * INDENT }} />
      {canExpand ? (
        <button
          type="button"
          className="tuesday-expand-btn"
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}
        </button>
      ) : (
        <span className="tuesday-expand-leaf" />
      )}
      {isUnassignedDeliv && (
        <span className="tuesday-unassigned-icon" title={UNASSIGNED_TOOLTIP} aria-hidden="true">
          <FaExclamationTriangle size={11} />
        </span>
      )}

      {editing ? (
        <input
          ref={inputRef}
          className="tuesday-name-input"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className={`tuesday-name-text ${nameClass} ${isUnassignedDeliv ? 'tuesday-name-unassigned' : ''} ${renameable || taskClickable ? 'tuesday-name-text--editable' : ''}`}
          title={
            isUnassignedDeliv ? UNASSIGNED_TOOLTIP
            : renameable ? 'Click to rename'
            : taskClickable ? 'Click to open task details'
            : undefined
          }
          onClick={handleNameClick}
        >
          {currentName}
        </span>
      )}

      {isProject && (
        <span className="tuesday-project-meta">
          • <strong>{row.data.rollup.total}</strong> tasks
          {typeof unassignedCount === 'number' && unassignedCount > 0 && (
            <> · <strong>{unassignedCount}</strong> unassigned</>
          )}
        </span>
      )}
      {isUnassignedDeliv && (
        <span className="tuesday-unassigned-hint" title={UNASSIGNED_TOOLTIP}>
          (no deliverable assigned)
        </span>
      )}
    </div>
  );
};

export default NameCell;
