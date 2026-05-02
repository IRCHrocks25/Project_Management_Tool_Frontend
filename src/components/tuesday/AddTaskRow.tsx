import React, { useEffect, useRef, useState } from 'react';
import { BoardTask } from '../../services/boardView.service';

interface Props {
  projectId: string;
  deliverableId: string | null;     // null = synthetic Unassigned bucket
  siblingTasks: BoardTask[];        // for type inheritance
  taskColumnCount: number;          // how many <td>s come after Name
  // Returns the created task, or null on failure / empty title.
  onCreate: (title: string, type: string) => Promise<BoardTask | null>;
  onOpenMoreFields: (title: string) => void;
}

const TASK_DEPTH = 2;
const INDENT = 18;

// Inherits the dominant type from sibling tasks. Unassigned bucket falls
// back to General. Empty deliverable also falls back to General.
function inferType(siblings: BoardTask[], deliverableId: string | null): string {
  if (!siblings.length) return 'General';
  if (deliverableId === null) return 'General';
  const counts: Record<string, number> = {};
  for (const t of siblings) counts[t.type] = (counts[t.type] || 0) + 1;
  let bestType = 'General';
  let bestCount = 0;
  for (const type of Object.keys(counts)) {
    if (counts[type] > bestCount) { bestCount = counts[type]; bestType = type; }
  }
  return bestType;
}

const AddTaskRow: React.FC<Props> = ({
  projectId, deliverableId, siblingTasks, taskColumnCount, onCreate, onOpenMoreFields,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEditing = () => {
    setDraft('');
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setDraft('');
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    const trimmed = draft.trim();
    if (!trimmed) { setError('Task title cannot be empty'); return; }
    setSaving(true);
    const type = inferType(siblingTasks, deliverableId);
    const created = await onCreate(trimmed, type);
    setSaving(false);
    if (created) {
      // Stay in edit mode for serial adding — clear input and refocus.
      setDraft('');
      setError(null);
      // Note: the placeholder stays where it is in the DOM; the new task
      // gets inserted above it via the optimistic update in the mutation.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    // On failure the toast appears via the mutation; keep the draft text
    // so the user doesn't lose what they typed.
  };

  // Empty <td>s for non-Name columns so the row aligns with siblings.
  const emptyCells = Array.from({ length: taskColumnCount }, (_, i) => (
    <td key={i} className="tuesday-td" />
  ));

  return (
    <tr className="tuesday-tr-add-task">
      <td className="tuesday-td">
        <div className="tuesday-name">
          <span className="tuesday-name-indent" style={{ width: TASK_DEPTH * INDENT }} />
          <span className="tuesday-expand-leaf" />
          {editing ? (
            <>
              <input
                ref={inputRef}
                className="tuesday-name-input tuesday-add-task-input"
                placeholder="Task title…"
                value={draft}
                disabled={saving}
                onChange={(e) => { setDraft(e.target.value); setError(null); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); save(); }
                  else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
                }}
                onBlur={(e) => {
                  // Don't cancel if the blur is going to one of the action
                  // buttons — let those handlers run with the typed draft.
                  const next = e.relatedTarget as HTMLElement | null;
                  const cls = next?.classList;
                  if (cls?.contains('tuesday-more-fields')
                    || cls?.contains('tuesday-add-save')
                    || cls?.contains('tuesday-add-cancel')) return;
                  if (!draft.trim()) cancel();
                }}
              />
              <button
                type="button"
                className="tuesday-add-save"
                disabled={saving || !draft.trim()}
                onMouseDown={(e) => { e.preventDefault(); save(); }}
                title="Save (Enter)"
              >
                Save
              </button>
              <button
                type="button"
                className="tuesday-add-cancel"
                onMouseDown={(e) => { e.preventDefault(); cancel(); }}
                title="Cancel (Esc)"
              >
                Cancel
              </button>
              <button
                type="button"
                className="tuesday-more-fields"
                onMouseDown={(e) => {
                  // mousedown so we trigger before the input blur
                  e.preventDefault();
                  onOpenMoreFields(draft);
                }}
                title="Open the full task creation form with this title"
              >
                More fields
              </button>
              {error && <span className="tuesday-add-row-error">{error}</span>}
            </>
          ) : (
            <span
              className="tuesday-add-row-label"
              onClick={(e) => { e.stopPropagation(); startEditing(); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEditing(); }
              }}
            >
              + Add task
            </span>
          )}
        </div>
      </td>
      {emptyCells}
    </tr>
  );
};

export default AddTaskRow;
