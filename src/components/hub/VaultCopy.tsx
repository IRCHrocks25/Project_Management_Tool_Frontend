/**
 * useVaultCopy — copy text to the clipboard with a "select and copy" fallback.
 *
 *   const { copy, fallback } = useVaultCopy();
 *   await copy(secret, 'Password');     // success toast, or opens a small modal with the text selected
 *   return <>{…}{fallback}</>;          // render the fallback modal somewhere in the tree
 *
 * Browsers can refuse clipboard writes (permissions, no user gesture after an async request,
 * insecure origin). Then the text is shown in a read-only field, already selected.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Modal from './ui/Modal';
import { useToast } from './ui/Toast';
import './hub-vault.css';

export async function writeClipboard(text: string): Promise<void> {
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('Clipboard unavailable');
  await navigator.clipboard.writeText(text);
}

export const CopyFallbackModal: React.FC<{ text: string; label: string; onClose: () => void }> = ({ text, label, onClose }) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => ref.current?.select(), 30);
    return () => window.clearTimeout(t);
  }, []);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  return (
    <Modal
      title={`Copy the ${label.toLowerCase()}`}
      description={`Your browser didn't allow automatic copying. The text below is selected: press ${isMac ? '⌘C' : 'Ctrl+C'} to copy it.`}
      size="sm"
      onClose={onClose}
      initialFocusRef={ref as React.RefObject<HTMLElement>}
      footer={
        <div className="hub-acts">
          <button type="button" className="hub-btn hub-btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      }
    >
      <div className="hub-fld">
        <label htmlFor="hub-copy-fallback">{label}</label>
        <input
          id="hub-copy-fallback"
          ref={ref}
          className="hub-inp hub-w-full hub-mono"
          readOnly
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          onClick={(e) => e.currentTarget.select()}
        />
      </div>
    </Modal>
  );
};

export function useVaultCopy() {
  const toast = useToast();
  const [pending, setPending] = useState<{ text: string; label: string } | null>(null);

  const copy = useCallback(
    async (text: string, label: string): Promise<boolean> => {
      try {
        await writeClipboard(text);
        toast.show(`${label} copied`, { duration: 2200 });
        return true;
      } catch {
        setPending({ text, label });
        return false;
      }
    },
    [toast],
  );

  const fallback = pending ? <CopyFallbackModal text={pending.text} label={pending.label} onClose={() => setPending(null)} /> : null;
  return { copy, fallback };
}

export default useVaultCopy;
