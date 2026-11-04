/**
 * Modal and Drawer.
 *
 * Mount conditionally (`{open && <Modal … />}`); `onClose` should unmount it.
 *
 *   <Modal
 *     title="Edit product" description="Optional sub line" size="sm" | "md" (default) | "lg"
 *     onClose={() => setOpen(false)}
 *     dirty={formChanged}      // close attempts (Esc, X, scrim, Cancel) ask "Discard your changes?"
 *     busy={saving}            // blocks closing while a request runs
 *     footer={({ requestClose }) => <><button onClick={requestClose}>Cancel</button>…</>}
 *   >body</Modal>
 *
 *   <Drawer title subtitle onClose footer>…</Drawer>   side panel for detail views (same API, no size).
 *
 * Focus is trapped inside, moved in on open and returned to the opener on close. Esc closes the
 * topmost layer only. Clicking the scrim closes (only if the press started on the scrim).
 */
import React, { useCallback, useRef, useState } from 'react';
import Icon from './Icon';
import { HubPortal, useLayer, useScrollLock } from './layers';

export interface ModalApi {
  /** Close, honouring the busy and discard-changes guards. */
  requestClose: () => void;
}

export interface ModalProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  onClose: () => void;
  dirty?: boolean;
  busy?: boolean;
  footer?: React.ReactNode | ((api: ModalApi) => React.ReactNode);
  children?: React.ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Label for the dialog when `title` isn't plain text. */
  ariaLabel?: string;
}

let titleSeq = 0;

const LayerShell: React.FC<ModalProps & { variant: 'modal' | 'drawer' }> = ({
  title,
  description,
  size = 'md',
  onClose,
  dirty,
  busy,
  footer,
  children,
  initialFocusRef,
  ariaLabel,
  variant,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const downOnScrim = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [titleId] = useState(() => `hub-lt-${++titleSeq}`);

  const requestClose = useCallback(() => {
    if (busy) return;
    if (dirty) {
      setConfirming(true);
      window.setTimeout(() => keepRef.current?.focus(), 0);
      return;
    }
    onClose();
  }, [busy, dirty, onClose]);

  useLayer(panelRef, {
    trapFocus: true,
    initialFocus: initialFocusRef,
    onEscape: () => {
      if (confirming) setConfirming(false);
      else requestClose();
    },
  });
  useScrollLock();

  const api: ModalApi = { requestClose };
  const footerNode = typeof footer === 'function' ? footer(api) : footer;

  return (
    <HubPortal>
      <div
        className={`hub-ov${variant === 'drawer' ? ' hub-ov-drawer' : ''}`}
        onMouseDown={(e) => {
          downOnScrim.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && downOnScrim.current) requestClose();
        }}
      >
        <div
          ref={panelRef}
          className={variant === 'drawer' ? 'hub-drawer' : `hub-modal${size === 'md' ? '' : ` hub-${size}`}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabel ? undefined : titleId}
          aria-label={ariaLabel}
          tabIndex={-1}
        >
          <header className="hub-mh">
            <div>
              <h2 id={titleId}>{title}</h2>
              {description ? <p>{description}</p> : null}
            </div>
            <button type="button" className="hub-icon-btn" onClick={requestClose} aria-label="Close" disabled={busy}>
              <Icon name="x" size={18} />
            </button>
          </header>
          <div className="hub-mb">{children}</div>
          {(footerNode || confirming) && (
            <footer className="hub-mf">
              {confirming ? (
                <div className="hub-acts hub-discard" role="alertdialog" aria-label="Discard your changes?">
                  <span>Discard your changes?</span>
                  <button type="button" className="hub-btn" ref={keepRef} onClick={() => setConfirming(false)}>
                    Keep editing
                  </button>
                  <button type="button" className="hub-btn hub-btn-danger" onClick={onClose}>
                    Discard
                  </button>
                </div>
              ) : (
                footerNode
              )}
            </footer>
          )}
        </div>
      </div>
    </HubPortal>
  );
};

export const Modal: React.FC<ModalProps> = (props) => <LayerShell {...props} variant="modal" />;

export interface DrawerProps extends Omit<ModalProps, 'size'> {
  /** Small line above the title, e.g. a ticket key. */
  eyebrow?: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({ eyebrow, title, ...rest }) => (
  <LayerShell
    {...rest}
    variant="drawer"
    title={
      eyebrow ? (
        <>
          <span className="hub-mono hub-muted" style={{ fontSize: 13, fontWeight: 500, display: 'block' }}>
            {eyebrow}
          </span>
          {title}
        </>
      ) : (
        title
      )
    }
  />
);

export default Modal;
