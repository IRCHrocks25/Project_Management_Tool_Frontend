/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-render-in-setup -- plain react-dom here, not Testing Library */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AUTOSAVE_DELAY_MS, PageAutosave, usePageAutosave } from './pageAutosave';
import { workspaceService } from '../../services/workspace.service';

jest.mock('../../services/workspace.service', () => ({ workspaceService: { updatePage: jest.fn() } }));
jest.mock('../../services/hub.service', () => ({
  hubErrorMessage: (err: any, fallback: string) => err?.response?.data?.message || fallback,
  hubErrorStatus: (err: any) => err?.response?.status,
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const updatePage = workspaceService.updatePage as jest.Mock;
const STALE = { response: { status: 409, data: { message: 'Someone else changed this page. Reload to see the latest version.' } } };

/** A PATCH the test finishes by hand. */
const deferred = () => {
  let resolve!: (v: any) => void;
  let reject!: (e: any) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

let current: { status: string; error: string | null; autosave: PageAutosave };
let root: Root;
let content: any;
let title: string;

const Harness: React.FC = () => {
  current = usePageAutosave({ pageId: 'p1', initialRevision: 5, getTitle: () => title, getContent: () => content });
  return null;
};

const tick = async (ms = AUTOSAVE_DELAY_MS) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
};
const settle = (fn: () => void) =>
  act(async () => {
    fn();
    await new Promise(jest.requireActual('timers').setImmediate);
  });

beforeEach(() => {
  jest.useFakeTimers();
  updatePage.mockReset();
  content = { type: 'doc', n: 1 };
  title = 'One';
  root = createRoot(document.createElement('div'));
  act(() => root.render(React.createElement(React.StrictMode, null, React.createElement(Harness))));
});

afterEach(() => {
  act(() => root.unmount());
  jest.useRealTimers();
});

describe('usePageAutosave', () => {
  it('waits 800 ms after the last change and sends one PATCH with the revision', async () => {
    updatePage.mockResolvedValue({ revision: 6 });
    act(() => current.autosave.markContentDirty());
    expect(current.status).toBe('pending');
    await tick(AUTOSAVE_DELAY_MS - 1);
    act(() => current.autosave.markContentDirty());
    await tick(AUTOSAVE_DELAY_MS - 1);
    expect(updatePage).not.toHaveBeenCalled();
    await tick(1);
    await settle(() => undefined);
    expect(updatePage).toHaveBeenCalledTimes(1);
    expect(updatePage).toHaveBeenCalledWith('p1', { revision: 5, content: { type: 'doc', n: 1 } });
    expect(current.status).toBe('saved');
  });

  it('sends only what changed', async () => {
    updatePage.mockResolvedValue({ revision: 6 });
    act(() => current.autosave.markTitleDirty());
    await tick();
    await settle(() => undefined);
    expect(updatePage).toHaveBeenCalledWith('p1', { revision: 5, title: 'One' });
  });

  it('never runs two PATCHes at once and uses the revision from the first for the second', async () => {
    const first = deferred();
    updatePage.mockReturnValueOnce(first.promise).mockResolvedValueOnce({ revision: 7 });
    act(() => current.autosave.markContentDirty());
    await tick();
    expect(updatePage).toHaveBeenCalledTimes(1);

    content = { type: 'doc', n: 2 };
    act(() => current.autosave.markContentDirty());
    await tick();
    await tick();
    expect(updatePage).toHaveBeenCalledTimes(1);

    await settle(() => first.resolve({ revision: 6 }));
    expect(updatePage).toHaveBeenCalledTimes(2);
    expect(updatePage).toHaveBeenLastCalledWith('p1', { revision: 6, content: { type: 'doc', n: 2 } });
    await settle(() => undefined);
    expect(current.status).toBe('saved');
  });

  it('keeps the edits after a failure, and Retry sends them', async () => {
    updatePage.mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValueOnce({ revision: 6 });
    act(() => current.autosave.markContentDirty());
    await tick();
    await settle(() => undefined);
    expect(current.status).toBe('error');
    expect(current.autosave.hasUnsaved()).toBe(true);
    await tick(10000);
    expect(updatePage).toHaveBeenCalledTimes(1);

    await settle(() => {
      current.autosave.flush();
    });
    expect(updatePage).toHaveBeenCalledTimes(2);
    expect(updatePage).toHaveBeenLastCalledWith('p1', { revision: 5, content: { type: 'doc', n: 1 } });
    expect(current.status).toBe('saved');
    expect(current.autosave.hasUnsaved()).toBe(false);
  });

  it('stops saving on 409 until reset, and shows the server message', async () => {
    updatePage.mockRejectedValueOnce(STALE).mockResolvedValue({ revision: 21 });
    act(() => current.autosave.markContentDirty());
    await tick();
    await settle(() => undefined);
    expect(current.status).toBe('conflict');
    expect(current.error).toBe(STALE.response.data.message);

    act(() => current.autosave.markContentDirty());
    await tick();
    await settle(() => {
      current.autosave.flush();
    });
    expect(updatePage).toHaveBeenCalledTimes(1);
    expect(current.status).toBe('conflict');
    expect(current.autosave.hasUnsaved()).toBe(true);

    act(() => current.autosave.reset(20));
    expect(current.status).toBe('saved');
    expect(current.autosave.hasUnsaved()).toBe(false);
    act(() => current.autosave.markTitleDirty());
    await tick();
    await settle(() => undefined);
    expect(updatePage).toHaveBeenLastCalledWith('p1', { revision: 20, title: 'One' });
  });

  it('sends pending edits on unmount, with the content as it was at that moment', async () => {
    updatePage.mockResolvedValue({ revision: 6 });
    act(() => current.autosave.markContentDirty());
    act(() => root.unmount());
    expect(updatePage).toHaveBeenCalledTimes(1);
    expect(updatePage).toHaveBeenCalledWith('p1', { revision: 5, content: { type: 'doc', n: 1 } });
    root = createRoot(document.createElement('div'));
  });

  it('after unmount, a queued save uses the content captured before the editor went away', async () => {
    const first = deferred();
    updatePage.mockReturnValueOnce(first.promise).mockResolvedValueOnce({ revision: 7 });
    act(() => current.autosave.markContentDirty());
    await tick();
    content = { type: 'doc', n: 2 };
    act(() => current.autosave.markContentDirty());
    act(() => root.unmount());
    content = undefined; // the editor is gone
    await settle(() => first.resolve({ revision: 6 }));
    expect(updatePage).toHaveBeenLastCalledWith('p1', { revision: 6, content: { type: 'doc', n: 2 } });
    root = createRoot(document.createElement('div'));
  });

  it('does not save while held, and picks up again afterwards', async () => {
    updatePage.mockResolvedValue({ revision: 6 });
    act(() => current.autosave.markContentDirty());
    act(() => current.autosave.hold(true));
    await tick(5000);
    expect(updatePage).not.toHaveBeenCalled();
    act(() => current.autosave.hold(false));
    await tick();
    await settle(() => undefined);
    expect(updatePage).toHaveBeenCalledTimes(1);
  });

  it('warns before the tab closes only while something is unsaved', async () => {
    const fire = () => {
      const e = new Event('beforeunload', { cancelable: true });
      act(() => {
        window.dispatchEvent(e);
      });
      return e.defaultPrevented;
    };
    updatePage.mockResolvedValue({ revision: 6 });
    expect(fire()).toBe(false);
    act(() => current.autosave.markContentDirty());
    expect(fire()).toBe(true);
    await settle(() => undefined);
    expect(fire()).toBe(false);
  });
});
