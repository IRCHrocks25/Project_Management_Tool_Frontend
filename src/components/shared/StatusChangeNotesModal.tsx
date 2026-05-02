import React, { useEffect, useState } from 'react';
import { FaLink, FaPlus, FaTimes } from 'react-icons/fa';

/*
 * Shared Status Change Notes modal.
 *
 * Visual style intentionally mirrors the inline modals it replaces in
 * DepartmentView.tsx (~L6221-6470) and RoleDashboard.tsx (~L5088-5340).
 * The single-attachment input matches DepartmentView; the multi-link
 * array UI matches RoleDashboard's "Add Another Link" pattern.
 *
 * onSave always receives an attachments array — `single` mode returns
 * `[]` or `[url]`; `multi` mode returns the full array with empty
 * strings filtered out. Callers translate this into whatever embedded-
 * description format their save path expects.
 *
 * notesRequired is configurable per call site: Tuesday opts in to
 * required notes; the existing 3 surfaces stay optional.
 */

interface Props {
  isOpen: boolean;
  targetColumnLabel: string;
  onClose: () => void;
  onSave: (notes: string, attachments: string[]) => Promise<void>;
  notesRequired?: boolean;                        // default false
  attachmentMode?: 'single' | 'multi';            // default 'single'
  saving?: boolean;                               // controlled by caller
}

// Exported helpers — pure functions tested by StatusChangeNotesModal.test.ts.
// (Frontend has no @testing-library, so we cover logic at the function level
// and rely on manual QA + the migration gates for interactive paths.)
export function isNotesValid(notes: string, notesRequired: boolean): boolean {
  return !notesRequired || notes.trim().length > 0;
}

export function collectAttachments(
  mode: 'single' | 'multi',
  single: string,
  multi: string[],
): string[] {
  if (mode === 'single') {
    const trimmed = single.trim();
    return trimmed ? [trimmed] : [];
  }
  return multi.map((l) => l.trim()).filter((l) => l.length > 0);
}

const StatusChangeNotesModal: React.FC<Props> = ({
  isOpen,
  targetColumnLabel,
  onClose,
  onSave,
  notesRequired = false,
  attachmentMode = 'single',
  saving = false,
}) => {
  const [notes, setNotes] = useState('');
  const [singleAttachment, setSingleAttachment] = useState('');
  const [multiLinks, setMultiLinks] = useState<string[]>(['']);
  const [internalSaving, setInternalSaving] = useState(false);

  const busy = saving || internalSaving;

  // Reset on open. Reusing one mounted instance across multiple opens
  // would otherwise leak prior values into the next status change.
  useEffect(() => {
    if (isOpen) {
      setNotes('');
      setSingleAttachment('');
      setMultiLinks(['']);
      setInternalSaving(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const notesValid = isNotesValid(notes, notesRequired);
  const canSave = !busy && notesValid;

  const handleSave = async () => {
    if (!canSave) return;
    setInternalSaving(true);
    try {
      await onSave(notes, collectAttachments(attachmentMode, singleAttachment, multiLinks));
    } finally {
      setInternalSaving(false);
    }
  };

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          margin: '1rem',
        }}
      >
        <div
          style={{
            padding: '1.5rem 2rem',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>
            Update Status – {targetColumnLabel}
          </h2>
          <button
            onClick={handleClose}
            disabled={busy}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: busy ? 'not-allowed' : 'pointer',
              fontSize: '1.25rem',
              padding: '0.5rem',
              borderRadius: '999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FaTimes />
          </button>
        </div>

        <div style={{ padding: '1.5rem 2rem', flex: 1, overflowY: 'auto' }}>
          <p style={{ marginBottom: '1.5rem', color: '#6b7280', fontSize: '0.9rem' }}>
            Add notes and links so PMs and team leads can see why this task moved into "{targetColumnLabel}".
          </p>

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="status-change-notes"
              style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}
            >
              Notes ({notesRequired ? 'Required' : 'Optional'})
            </label>
            <textarea
              id="status-change-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                minHeight: '100px',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
              }}
              placeholder="Add context about this status change..."
              disabled={busy}
            />
            {notesRequired && !notesValid && (
              <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '0.4rem', marginBottom: 0 }}>
                Notes are required for this status change.
              </p>
            )}
          </div>

          {attachmentMode === 'single' ? (
            <div>
              <label
                htmlFor="status-change-attachment"
                style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}
              >
                Attachment/Link (Optional)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FaLink style={{ color: '#6b7280', fontSize: '0.875rem' }} />
                <input
                  id="status-change-attachment"
                  type="url"
                  value={singleAttachment}
                  onChange={(e) => setSingleAttachment(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.9rem',
                  }}
                  placeholder="https://example.com or Google Drive/Figma link..."
                  disabled={busy}
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem', marginBottom: 0 }}>
                Use this to attach references, client feedback, or handoff links.
              </p>
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#374151' }}>
                Links / Attachments (Optional)
              </label>
              {multiLinks.map((link, index) => (
                <div
                  key={index}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}
                >
                  <FaLink style={{ color: '#6b7280', fontSize: '0.875rem', flexShrink: 0 }} />
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => {
                      const next = [...multiLinks];
                      next[index] = e.target.value;
                      setMultiLinks(next);
                    }}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.9rem',
                    }}
                    placeholder="https://example.com or Google Drive/Figma link..."
                    disabled={busy}
                  />
                  {multiLinks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setMultiLinks(multiLinks.filter((_, i) => i !== index))}
                      disabled={busy}
                      style={{
                        padding: '0.5rem',
                        border: 'none',
                        background: 'transparent',
                        color: '#ef4444',
                        cursor: busy ? 'not-allowed' : 'pointer',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FaTimes />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setMultiLinks([...multiLinks, ''])}
                disabled={busy}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem 1rem',
                  border: '1px solid #d1d5db',
                  background: 'white',
                  color: '#374151',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <FaPlus style={{ fontSize: '0.75rem' }} />
                Add Another Link
              </button>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem', marginBottom: 0 }}>
                Use this to attach references, client feedback, or handoff links.
              </p>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '1.25rem 2rem',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              color: '#374151',
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            style={{
              background: !canSave ? '#9ca3af' : '#667eea',
              border: 'none',
              color: 'white',
              padding: '0.6rem 1.4rem',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: !canSave ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Updating...' : 'Update Status'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusChangeNotesModal;
