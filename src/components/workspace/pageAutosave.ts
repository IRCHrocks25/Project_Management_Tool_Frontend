/**
 * Autosave for a page. Edits wait 800 ms, then go out as one PATCH carrying the latest `revision`.
 *
 * Only one PATCH runs at a time: anything edited during a save goes out afterwards with the
 * revision that save returned. Responses never touch the editor, so the cursor stays put.
 * A 409 stops saving until `reset()` (the page offers Reload latest and Copy my text). Other
 * failures keep the edits and wait for Retry or the next edit.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hubErrorMessage, hubErrorStatus } from '../../services/hub.service';
import { workspaceService } from '../../services/workspace.service';

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';

export const AUTOSAVE_DELAY_MS = 800;

interface Options {
  pageId: string;
  initialRevision: number;
  getTitle: () => string;
  getContent: () => unknown;
}

export interface PageAutosave {
  markTitleDirty: () => void;
  markContentDirty: () => void;
  /** Send anything unsaved now; resolves when nothing is in flight. Never rejects. */
  flush: () => Promise<void>;
  /** True when edits haven't reached the server. */
  hasUnsaved: () => boolean;
  /** Pause saving, e.g. while a delete runs; `hold(false)` resumes. */
  hold: (on: boolean) => void;
  /** After the page was reloaded from the server: forget local edits and carry on from this revision. */
  reset: (revision: number) => void;
}

export function usePageAutosave({ pageId, initialRevision, getTitle, getContent }: Options) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);

  const read = useRef({ getTitle, getContent });
  read.current = { getTitle, getContent };

  const revision = useRef(initialRevision);
  const titleDirty = useRef(false);
  const contentDirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const conflict = useRef(false);
  const held = useRef(false);
  // The editor goes away on unmount, while a save may still be waiting its turn.
  const finalContent = useRef<unknown>(undefined);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const flush = useCallback((): Promise<void> => {
    clearTimer();
    if (inflight.current) return inflight.current.then(() => flush());
    if (conflict.current || held.current || (!titleDirty.current && !contentDirty.current)) return Promise.resolve();

    const sentTitle = titleDirty.current;
    const sentContent = contentDirty.current;
    const body: { revision: number; title?: string; content?: unknown } = { revision: revision.current };
    if (sentTitle) body.title = read.current.getTitle();
    if (sentContent) body.content = finalContent.current !== undefined ? finalContent.current : read.current.getContent();
    titleDirty.current = false;
    contentDirty.current = false;
    setStatus('saving');

    const run = workspaceService
      .updatePage(pageId, body)
      .then((saved) => {
        revision.current = saved.revision;
        setError(null);
        setStatus(titleDirty.current || contentDirty.current ? 'pending' : 'saved');
      })
      .catch((err) => {
        // Put the failed fields back, so Retry or the next edit sends them again.
        titleDirty.current = titleDirty.current || sentTitle;
        contentDirty.current = contentDirty.current || sentContent;
        setError(hubErrorMessage(err, "Couldn't save your changes."));
        if (hubErrorStatus(err) === 409) {
          conflict.current = true;
          clearTimer();
          setStatus('conflict');
        } else {
          setStatus('error');
        }
      })
      .then(() => {
        inflight.current = null;
      });
    inflight.current = run;
    return run;
  }, [pageId, clearTimer]);

  const schedule = useCallback(() => {
    if (conflict.current) return;
    setStatus('pending');
    clearTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      flush();
    }, AUTOSAVE_DELAY_MS);
  }, [clearTimer, flush]);

  const api = useMemo<PageAutosave>(
    () => ({
      markTitleDirty: () => {
        titleDirty.current = true;
        schedule();
      },
      markContentDirty: () => {
        contentDirty.current = true;
        schedule();
      },
      flush,
      hasUnsaved: () => titleDirty.current || contentDirty.current || !!inflight.current,
      hold: (on) => {
        held.current = on;
        if (on) clearTimer();
        else if (titleDirty.current || contentDirty.current) schedule();
      },
      reset: (rev) => {
        clearTimer();
        revision.current = rev;
        titleDirty.current = false;
        contentDirty.current = false;
        conflict.current = false;
        setError(null);
        setStatus('saved');
      },
    }),
    [flush, schedule, clearTimer],
  );

  // Warn before the tab closes with unsaved edits, and send what's pending when leaving the page.
  useEffect(() => {
    finalContent.current = undefined;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (titleDirty.current || contentDirty.current || inflight.current) {
        flush();
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      if (contentDirty.current) finalContent.current = read.current.getContent();
      flush();
    };
  }, [flush]);

  return { status, error, autosave: api };
}
