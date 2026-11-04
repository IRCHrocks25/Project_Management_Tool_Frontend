/**
 * Layer plumbing shared by Modal, Drawer, ConfirmDialog and OverflowMenu.
 *
 *   <HubPortal>…</HubPortal>   renders into document.body inside a `.hub` wrapper so layers get the Hub tokens.
 *   useLayer(ref, { onEscape, trapFocus, initialFocus })
 *     - keeps a stack so Esc only closes the topmost layer
 *     - traps Tab focus inside `ref` (trapFocus)
 *     - moves focus in on open and back to the opener on close
 *   useScrollLock()             locks body scroll while mounted (ref-counted).
 *
 * Children that handle Esc themselves (e.g. the mention popup) call `e.preventDefault()`,
 * and the layer then ignores that key press.
 */
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const stack: number[] = [];
let nextId = 1;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el.getClientRects().length > 0,
  );
}

export const HubPortal: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  createPortal(<div className="hub hub-layer-root">{children}</div>, document.body);

export interface UseLayerOptions {
  onEscape?: () => void;
  trapFocus?: boolean;
  /** Element to focus on open. Defaults to [data-autofocus], then the first field, then the first button. */
  initialFocus?: React.RefObject<HTMLElement>;
  /** Return focus to whatever had it before the layer opened (default true). */
  restoreFocus?: boolean;
}

export function useLayer(ref: React.RefObject<HTMLElement>, opts: UseLayerOptions = {}) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const id = nextId++;
    stack.push(id);
    const opener = document.activeElement as HTMLElement | null;

    const focusTimer = window.setTimeout(() => {
      const root = ref.current;
      if (!root) return;
      const target =
        optsRef.current.initialFocus?.current ||
        root.querySelector<HTMLElement>('[data-autofocus]') ||
        root.querySelector<HTMLElement>(
          'input:not([type="file"]):not([type="checkbox"]):not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
        ) ||
        focusableIn(root)[0] ||
        root;
      target.focus();
    }, 20);

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;
        e.preventDefault();
        optsRef.current.onEscape?.();
        return;
      }
      if (e.key === 'Tab' && optsRef.current.trapFocus && ref.current) {
        const items = focusableIn(ref.current);
        if (!items.length) {
          e.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (!ref.current.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      const i = stack.indexOf(id);
      if (i >= 0) stack.splice(i, 1);
      if (optsRef.current.restoreFocus !== false && opener && document.contains(opener)) {
        // Defer so the opener isn't re-focused while the closing click is still being handled.
        window.setTimeout(() => opener.focus(), 0);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

let scrollLocks = 0;
let savedOverflow = '';
export function useScrollLock() {
  useEffect(() => {
    if (scrollLocks === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    scrollLocks++;
    return () => {
      scrollLocks--;
      if (scrollLocks === 0) document.body.style.overflow = savedOverflow;
    };
  }, []);
}
