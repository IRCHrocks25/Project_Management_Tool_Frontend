/**
 * Toasts + deferred delete.
 *
 *   <ToastProvider> wraps the Hub (HubRoot does this).
 *
 *   const toast = useToast();
 *   toast.show('Update posted');                                       // success, 3.2 s
 *   toast.error("Couldn't save.", { action: { label: 'Retry', onClick: retry } });
 *   toast.show('Copied', { duration: 2000 });
 *
 *   const hidden = useHiddenIds();         // ids removed from view while a delete is pending
 *   const deferredDelete = useDeferredDelete();
 *   deferredDelete({
 *     message: 'File deleted',
 *     hide: () => hidden.add(file.id),      // remove from the UI right away
 *     restore: () => hidden.remove(file.id),// put it back (Undo, or the request failed)
 *     commit: () => hubService.deleteFile(productId, file.id), // runs after ~6 s unless undone
 *     onCommitted: reload,                  // optional
 *     errorMessage: "Couldn't delete the file.",
 *   });
 *   list.filter((f) => !hidden.has(f.id))
 *
 * The DELETE is delayed 6 s; Undo cancels it. If the request fails the item comes back and an
 * error toast offers Retry. Pending deletes are flushed when the page is closed.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import { HubPortal } from './layers';
import { hubErrorMessage } from '../../../services/hub.service';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  kind?: 'success' | 'error' | 'info';
  action?: ToastAction;
  /** ms; defaults to 3200, or 7000 when there is an action. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
}

export interface ToastApi {
  show: (message: string, opts?: ToastOptions) => number;
  error: (message: string, opts?: Omit<ToastOptions, 'kind'>) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let toastSeq = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Record<number, number>>({});

  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current[id]);
    delete timers.current[id];
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, opts: ToastOptions = {}) => {
      const id = ++toastSeq;
      setItems((list) => [...list.slice(-3), { id, message, ...opts }]);
      const ms = opts.duration ?? (opts.action ? 7000 : opts.kind === 'error' ? 6000 : 3200);
      timers.current[id] = window.setTimeout(() => dismiss(id), ms);
      return id;
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({ show, dismiss, error: (m, o) => show(m, { ...o, kind: 'error' }) }),
    [show, dismiss],
  );

  useEffect(
    () => () => {
      Object.values(timers.current).forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <HubPortal>
        <div className="hub-toasts" role="status" aria-live="polite">
          {items.map((t) => (
            <div key={t.id} className={`hub-toast${t.kind === 'error' ? ' hub-toast-err' : ''}`}>
              <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'info' ? 'info' : 'check'} />
              <span>{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    dismiss(t.id);
                    t.action!.onClick();
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button type="button" className="hub-toast-x" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>
      </HubPortal>
    </ToastContext.Provider>
  );
};

const noopToast: ToastApi = {
  show: () => 0,
  error: () => 0,
  dismiss: () => undefined,
};

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('useToast() used outside <ToastProvider>; toasts are dropped.');
  }
  return ctx || noopToast;
}

/* ------------------------------------------------------------------ */

export interface HiddenIds {
  has: (id: string) => boolean;
  add: (id: string) => void;
  remove: (id: string) => void;
}

/** A set of ids to hide from a list while their delete is pending. */
export function useHiddenIds(): HiddenIds {
  const [ids, setIds] = useState<Record<string, true>>({});
  const add = useCallback((id: string) => setIds((s) => ({ ...s, [id]: true })), []);
  const remove = useCallback(
    (id: string) =>
      setIds((s) => {
        if (!s[id]) return s;
        const next = { ...s };
        delete next[id];
        return next;
      }),
    [],
  );
  return useMemo(() => ({ has: (id: string) => !!ids[id], add, remove }), [ids, add, remove]);
}

export interface DeferredDeleteOptions {
  message: string;
  hide: () => void;
  restore: () => void;
  commit: () => Promise<unknown>;
  onCommitted?: () => void;
  errorMessage?: string;
  /** Defaults to 6000 ms. */
  delayMs?: number;
}

const pending = new Map<number, () => void>();
let pendingSeq = 0;
let unloadHooked = false;
function hookUnload() {
  if (unloadHooked) return;
  unloadHooked = true;
  window.addEventListener('pagehide', () => {
    Array.from(pending.values()).forEach((fire) => fire());
  });
}

export function useDeferredDelete() {
  const toast = useToast();

  const run = useCallback(
    (opts: DeferredDeleteOptions) => {
      hookUnload();
      const key = ++pendingSeq;
      opts.hide();

      const fire = async () => {
        if (!pending.has(key)) return;
        pending.delete(key);
        window.clearTimeout(timer);
        try {
          await opts.commit();
          opts.onCommitted?.();
        } catch (err) {
          opts.restore();
          const base = opts.errorMessage || "Couldn't delete it.";
          toast.error(`${base} ${hubErrorMessage(err, 'It has been put back.')}`, {
            action: { label: 'Retry', onClick: () => run(opts) },
          });
        }
      };

      const timer = window.setTimeout(fire, opts.delayMs ?? 6000);
      pending.set(key, fire);

      toast.show(opts.message, {
        duration: (opts.delayMs ?? 6000) + 500,
        action: {
          label: 'Undo',
          onClick: () => {
            if (!pending.has(key)) return;
            pending.delete(key);
            window.clearTimeout(timer);
            opts.restore();
            toast.show('Restored');
          },
        },
      });
    },
    [toast],
  );

  return run;
}
