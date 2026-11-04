/**
 * ConfirmDialog — small modal that asks before a destructive or important action.
 *
 *   {confirm && (
 *     <ConfirmDialog
 *       title="Delete this update?"
 *       body={<>The update and its 2 replies will be removed. You can undo this for a few seconds afterwards.</>}
 *       confirmLabel="Delete update"
 *       tone="danger"                 // "danger" (default) | "primary"
 *       onConfirm={() => { … }}       // may return a promise: the button shows busyLabel and stays disabled
 *       busyLabel="Deleting…"
 *       onClose={() => setConfirm(null)}
 *     />
 *   )}
 *
 * Cancel gets initial focus. If onConfirm throws, the dialog stays open and shows the server message.
 */
import React, { useRef, useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';
import { hubErrorMessage } from '../../../services/hub.service';

export interface ConfirmDialogProps {
  title: React.ReactNode;
  body: React.ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void | Promise<unknown>;
  onClose: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  body,
  confirmLabel,
  busyLabel = 'Working…',
  tone = 'danger',
  onConfirm,
  onClose,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (busy) return;
    const result = onConfirm();
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      setBusy(true);
      setError(null);
      try {
        await result;
        onClose();
      } catch (err) {
        setBusy(false);
        setError(hubErrorMessage(err));
      }
    } else {
      onClose();
    }
  };

  return (
    <Modal
      title={title}
      size="sm"
      onClose={onClose}
      busy={busy}
      initialFocusRef={cancelRef}
      footer={({ requestClose }) => (
        <div className="hub-acts">
          <button type="button" className="hub-btn" ref={cancelRef} onClick={requestClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`hub-btn ${tone === 'danger' ? 'hub-btn-danger' : 'hub-btn-primary'}`}
            onClick={confirm}
            disabled={busy}
          >
            {busy && <span className="hub-spin" aria-hidden="true" />}
            {busy ? busyLabel : error ? 'Try again' : confirmLabel}
          </button>
        </div>
      )}
    >
      {error && (
        <div className="hub-banner hub-banner-err" role="alert">
          <Icon name="alert" />
          <div>{error}</div>
        </div>
      )}
      <div className="hub-mtext">{body}</div>
    </Modal>
  );
};

export default ConfirmDialog;
