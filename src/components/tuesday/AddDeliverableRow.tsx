import React, { useEffect, useRef, useState } from 'react';
import { BoardDeliverable } from '../../services/boardView.service';
import { DeliverableType } from './deliverableTypes';

interface Props {
  projectId: string;
  taskColumnCount: number;        // number of <td>s after Name
  onCreate: (type: string, customType: string | null) => Promise<BoardDeliverable | null>;
}

const DELIVERABLE_DEPTH = 1;
const INDENT = 18;

const TYPE_OPTIONS = Object.values(DeliverableType);

const AddDeliverableRow: React.FC<Props> = ({ projectId, taskColumnCount, onCreate }) => {
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const typeRef = useRef<HTMLSelectElement>(null);
  const customRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) typeRef.current?.focus();
  }, [editing]);

  // When user picks Other, jump focus to the custom-name input.
  useEffect(() => {
    if (editing && type === 'Other') customRef.current?.focus();
  }, [type, editing]);

  const startEditing = () => {
    setType('');
    setCustomName('');
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setType('');
    setCustomName('');
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    if (!type) { setError('Pick a type'); return; }
    if (type === 'Other' && !customName.trim()) {
      setError('Custom deliverables need a name');
      return;
    }
    setSaving(true);
    const created = await onCreate(type, type === 'Other' ? customName : null);
    setSaving(false);
    if (created) {
      // Stay in edit mode for serial adding — reset inputs and refocus type.
      setType('');
      setCustomName('');
      setError(null);
      requestAnimationFrame(() => typeRef.current?.focus());
    }
    // Failure path: toast surfaces from the mutation; keep inputs so user can retry.
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  };

  const emptyCells = Array.from({ length: taskColumnCount }, (_, i) => (
    <td key={i} className="tuesday-td" />
  ));

  return (
    <tr className="tuesday-tr-add-deliverable" data-project-id={projectId}>
      <td className="tuesday-td">
        <div className="tuesday-name">
          <span className="tuesday-name-indent" style={{ width: DELIVERABLE_DEPTH * INDENT }} />
          <span className="tuesday-expand-leaf" />
          {editing ? (
            <>
              <select
                ref={typeRef}
                className="tuesday-add-deliv-type"
                value={type}
                disabled={saving}
                onChange={(e) => { setType(e.target.value); setError(null); }}
                onKeyDown={handleKey}
              >
                <option value="">Type…</option>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {type === 'Other' && (
                <input
                  ref={customRef}
                  className="tuesday-name-input tuesday-add-deliv-name"
                  placeholder="Deliverable name…"
                  value={customName}
                  disabled={saving}
                  onChange={(e) => { setCustomName(e.target.value); setError(null); }}
                  onKeyDown={handleKey}
                />
              )}
              <button
                type="button"
                className="tuesday-add-save"
                disabled={saving || !type || (type === 'Other' && !customName.trim())}
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
              + Add deliverable
            </span>
          )}
        </div>
      </td>
      {emptyCells}
    </tr>
  );
};

export default AddDeliverableRow;
