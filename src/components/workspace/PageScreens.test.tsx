/* eslint-disable testing-library/no-unnecessary-act, testing-library/no-render-in-setup -- plain react-dom here, not Testing Library */
/**
 * The screens end to end against a fake API, inside StrictMode as in the app.
 * jsdom has no layout, so this covers behaviour, not how anything looks.
 */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { workspaceService } from '../../services/workspace.service';
import { ToastProvider } from '../hub/ui/Toast';
import PageEditor from './PageEditor';
import PagesHome from './PagesHome';

jest.mock('../../services/workspace.service', () => ({
  DEPARTMENTS: ['Designer', 'CRM'],
  workspaceService: {
    listPages: jest.fn(),
    createPage: jest.fn(),
    getPage: jest.fn(),
    updatePage: jest.fn(),
    deletePage: jest.fn(),
    duplicatePage: jest.fn(),
    getPageShares: jest.fn(),
    setPageShares: jest.fn(),
    uploadPageImage: jest.fn(),
    searchTasks: jest.fn(),
  },
}));
jest.mock('../../services/hub.service', () => ({
  hubErrorMessage: (err: any, fallback = 'Something went wrong.') => err?.response?.data?.message || fallback,
  hubErrorStatus: (err: any) => err?.response?.status,
  hubService: { listUsers: () => Promise.resolve([{ id: 'owner', name: 'Olivia' }, { id: 'u2', name: 'Sam' }]) },
}));
jest.mock('../../services/auth.service', () => ({ authService: { getUser: () => ({ id: 'owner', name: 'Olivia' }) } }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(Range.prototype as any).getClientRects = () => [];
(Range.prototype as any).getBoundingClientRect = () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 });
(Element.prototype as any).scrollIntoView = () => undefined;
(document as any).elementFromPoint = () => null;

const api = workspaceService as jest.Mocked<typeof workspaceService>;

const owner = { id: 'owner', name: 'Olivia' };
const page = (over: object = {}): any => ({
  id: 'p1',
  title: 'Launch plan',
  owner,
  myAccess: 'owner',
  sharedWith: { everyone: false, departments: [], userCount: 0 },
  checklist: { done: 0, total: 0 },
  excerpt: '',
  updatedAt: new Date().toISOString(),
  updatedBy: owner,
  revision: 5,
  createdAt: new Date().toISOString(),
  content: {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }] }] },
    ],
  },
  ...over,
});

let root: Root;
let host: HTMLElement;
let path = '';

const Where: React.FC = () => {
  path = useLocation().pathname;
  return null;
};

const wait = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
const until = async (check: () => unknown, label = 'condition') => {
  for (let i = 0; i < 200; i++) {
    await wait(10);
    if (check()) return;
  }
  throw new Error(`Timed out waiting for ${label}. Page says: ${document.body.textContent}`);
};
const text = () => document.body.textContent || '';
const button = (label: string) =>
  Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === label || b.getAttribute('aria-label') === label) as HTMLButtonElement;
const click = (el: Element) => act(async () => (el as HTMLElement).click());
const setValue = (el: HTMLInputElement | HTMLSelectElement, value: string) =>
  act(async () => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
const getEditor = () => (document.querySelector('.ws-prose') as any).editor;

const open = async (at: string) => {
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => {
    root.render(
      <React.StrictMode>
        <div className="hub">
          <ToastProvider>
            <MemoryRouter initialEntries={[at]}>
              <Where />
              <Routes>
                <Route path="/pages" element={<PagesHome />} />
                <Route path="/pages/:id" element={<PageEditor />} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </div>
      </React.StrictMode>,
    );
  });
};

beforeEach(() => {
  Object.values(api).forEach((fn: any) => fn.mockReset && fn.mockReset());
  try {
    localStorage.clear();
  } catch {
    /* fine */
  }
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.body.innerHTML = '';
});

describe('PageEditor', () => {
  it('saves an edit once, without touching the cursor or the content', async () => {
    api.getPage.mockResolvedValue(page());
    api.updatePage.mockImplementation(async () => page({ revision: 6, title: 'FROM SERVER', content: { type: 'doc', content: [{ type: 'paragraph' }] } }));
    await open('/pages/p1');
    await until(() => document.querySelector('.ws-prose'), 'editor');
    const editor = getEditor();
    expect(button('Share')).toBeTruthy();
    expect(text()).toContain('Saved');

    await act(async () => {
      editor.commands.insertContentAt(6, ' world');
    });
    const cursor = editor.state.selection.from;
    expect(text()).toContain('Saving…');
    await until(() => api.updatePage.mock.calls.length === 1, 'the save');
    const body = api.updatePage.mock.calls[0][1];
    expect(body.revision).toBe(5);
    expect(body.title).toBeUndefined();
    expect(JSON.stringify(body.content)).toContain('Hello world');
    await until(() => text().indexOf('Saved') >= 0, 'Saved');

    expect(getEditor()).toBe(editor);
    expect(editor.getText()).toContain('Hello world');
    expect(editor.state.selection.from).toBe(cursor);
    expect((document.querySelector('.ws-title') as HTMLInputElement).value).toBe('Launch plan');
  });

  it('shows the slash menu in a portal under .hub, and picks with the keyboard', async () => {
    api.getPage.mockResolvedValue(page());
    api.updatePage.mockResolvedValue(page({ revision: 6 }));
    await open('/pages/p1');
    await until(() => document.querySelector('.ws-prose'), 'editor');
    const editor = getEditor();
    await act(async () => {
      editor.commands.focus('end');
      editor.commands.insertContentAt(1, '/');
      editor.commands.setTextSelection(2);
    });
    await until(() => document.querySelector('.ws-slash'), 'menu');
    expect(document.querySelector('.ws-slash')!.closest('.hub')).toBeTruthy();
    expect(document.querySelectorAll('.ws-slash [role="option"]')).toHaveLength(12);
  });

  it('on 409 stops saving, keeps the text, offers Copy and Reload', async () => {
    const message = 'Someone else changed this page. Reload to see the latest version.';
    api.getPage.mockResolvedValueOnce(page()).mockResolvedValueOnce(page()).mockResolvedValue(
      page({ title: 'Their title', revision: 9, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Theirs' }] }] } }),
    );
    api.updatePage.mockRejectedValueOnce({ response: { status: 409, data: { message } } }).mockResolvedValue(page({ revision: 10 }));
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    await open('/pages/p1');
    await until(() => document.querySelector('.ws-prose'), 'editor');
    const editor = getEditor();
    await act(async () => {
      editor.commands.insertContentAt(6, ' mine');
    });
    await until(() => text().indexOf(message) >= 0, 'the banner');
    expect(editor.getText()).toContain('Hello mine');

    await act(async () => {
      editor.commands.insertContentAt(6, '!');
    });
    await wait(1000);
    expect(api.updatePage).toHaveBeenCalledTimes(1);

    await click(button('Copy my text'));
    expect(writeText).toHaveBeenCalledWith(editor.getText());

    await click(button('Reload latest'));
    expect(text()).toContain('Your unsaved edits on this page will be discarded');
    await click(button('Discard and reload'));
    await until(() => editor.getText() === 'Theirs', 'the reload');
    await until(() => text().indexOf(message) < 0, 'the banner to go');
    expect((document.querySelector('.ws-title') as HTMLInputElement).value).toBe('Their title');

    await act(async () => {
      editor.commands.insertContentAt(1, 'x');
    });
    await until(() => api.updatePage.mock.calls.length === 2, 'saving to resume');
    expect(api.updatePage.mock.calls[1][1].revision).toBe(9);
  });

  it('shows Retry after a failed save, and Retry sends it', async () => {
    api.getPage.mockResolvedValue(page());
    api.updatePage.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Server broke.' } } }).mockResolvedValue(page({ revision: 6 }));
    await open('/pages/p1');
    await until(() => document.querySelector('.ws-prose'), 'editor');
    await act(async () => {
      getEditor().commands.insertContentAt(6, '!');
    });
    await until(() => text().indexOf("Couldn't save") >= 0, 'the error');
    expect(text()).toContain('Server broke.');
    await click(button('Retry'));
    await until(() => api.updatePage.mock.calls.length === 2 && text().indexOf('Saved') >= 0, 'the retry');
  });

  it('is read-only for view access', async () => {
    api.getPage.mockImplementation(async (id) => (id === 'p1' ? page({ myAccess: 'view' }) : page({ id, myAccess: 'owner' })));
    api.duplicatePage.mockResolvedValue(page({ id: 'p2', myAccess: 'owner' }));
    await open('/pages/p1');
    await until(() => document.querySelector('.ws-prose'), 'editor');
    expect(text()).toContain('You can view this page. Ask Olivia for edit access.');
    expect(getEditor().isEditable).toBe(false);
    expect((document.querySelector('.ws-title') as HTMLInputElement).disabled).toBe(true);
    expect((document.querySelector('.ws-prose input[type="checkbox"]') as HTMLInputElement).disabled).toBe(true);
    expect(document.querySelector('.ws-toolbar')).toBeNull();
    expect(button('Share')).toBeUndefined();
    await wait(900);
    expect(api.updatePage).not.toHaveBeenCalled();

    await click(button('Duplicate to My Space'));
    await until(() => path === '/pages/p2', 'the copy to open');
    await until(() => (document.querySelector('.ws-title') as HTMLInputElement)?.disabled === false, 'the copy to be editable');
  });

  it('explains a 404 and links back', async () => {
    api.getPage.mockRejectedValue({ response: { status: 404 } });
    await open('/pages/nope');
    await until(() => text().indexOf("This page doesn't exist or isn't shared with you.") >= 0, 'the message');
    expect(document.querySelector('a[href="/pages"]')).toBeTruthy();
  });

  it('flushes the edit when leaving the page', async () => {
    api.getPage.mockResolvedValue(page());
    api.updatePage.mockResolvedValue(page({ revision: 6 }));
    await open('/pages/p1');
    await until(() => document.querySelector('.ws-prose'), 'editor');
    await act(async () => {
      getEditor().commands.insertContentAt(6, ' bye');
    });
    expect(api.updatePage).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    expect(api.updatePage).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(api.updatePage.mock.calls[0][1].content)).toContain('Hello bye');
    root = createRoot(host);
  });

  it('shares the whole list and refuses to save when the list failed to load', async () => {
    api.getPage.mockResolvedValue(page());
    api.getPageShares.mockRejectedValueOnce({ response: { status: 500 } });
    await open('/pages/p1');
    await until(() => button('Share'), 'Share');
    await click(button('Share'));
    await until(() => text().indexOf("Couldn't load sharing") >= 0, 'the load error');
    expect(button('Save').disabled).toBe(true);

    api.getPageShares.mockResolvedValue([{ kind: 'department', target: 'CRM', permission: 'view' }]);
    await click(button('Try again'));
    await until(() => document.querySelector('.ws-share-list'), 'the list');
    const picker = document.getElementById('ws-share-add') as HTMLSelectElement;
    const options = Array.from(picker.querySelectorAll('option')).map((o) => o.value);
    expect(options).toContain('user:u2');
    expect(options).toContain('department:Designer');
    expect(options).not.toContain('user:owner');
    expect(options).not.toContain('department:CRM');

    await setValue(picker, 'user:u2');
    await click(button('Add'));
    await click(document.getElementById('ws-share-everyone') as HTMLInputElement);
    api.setPageShares.mockImplementation(async (_id, shares) => shares as any);
    await click(button('Save'));
    await until(() => api.setPageShares.mock.calls.length === 1, 'the save');
    expect(api.setPageShares.mock.calls[0][1]).toEqual([
      { kind: 'everyone', target: null, permission: 'view' },
      { kind: 'department', target: 'CRM', permission: 'view' },
      { kind: 'user', target: 'u2', permission: 'view' },
    ]);
    await until(() => document.querySelector('.ws-share-list') === null, 'the dialog to close');
    expect(document.querySelector('.ws-meta')!.textContent).toContain('Everyone');
  });
});

describe('PagesHome', () => {
  it('lists pages with their progress and sharing, and remembers the view', async () => {
    api.listPages.mockImplementation(async (view) =>
      view === 'mine'
        ? [
            page({ title: 'Mine', excerpt: 'Some words', checklist: { done: 3, total: 8 }, sharedWith: { everyone: false, departments: [], userCount: 2 } }),
            page({ id: 'p2', title: 'Quiet', sharedWith: { everyone: false, departments: [], userCount: 0 } }),
          ]
        : [page({ id: 'p3', title: 'Theirs', myAccess: 'edit', owner: { id: 'x', name: 'Xavier' } }), page({ id: 'p4', title: 'Look', myAccess: 'view', owner: { id: 'x', name: 'Xavier' } })],
    );
    await open('/pages');
    await until(() => text().indexOf('Mine') >= 0, 'the list');
    expect(text()).toContain('My Space');
    expect(text()).toContain('Notes, checklists and to-do lists. Private until you share them.');
    expect(text()).toContain('3 of 8 done');
    expect(text()).toContain('2 people');
    expect(text()).toContain('Private');
    expect(text()).toContain('Some words');

    await click(button('Shared with me'));
    await until(() => text().indexOf('Theirs') >= 0, 'the shared list');
    expect(text()).toContain('Xavier');
    expect(text()).toContain('Can edit');
    expect(text()).toContain('Can view');
    expect(localStorage.getItem('ws-pages-view')).toBe('shared');
  });

  it('searches on the server after a pause', async () => {
    api.listPages.mockResolvedValue([]);
    await open('/pages');
    await until(() => text().indexOf("You don't have any pages yet") >= 0, 'the empty state');
    api.listPages.mockClear();
    const input = document.querySelector('input[type="search"]') as HTMLInputElement;
    await setValue(input, 'a');
    await setValue(input, 'ab');
    await until(() => api.listPages.mock.calls.length > 0, 'the search');
    expect(api.listPages).toHaveBeenCalledTimes(1);
    expect(api.listPages).toHaveBeenCalledWith('mine', 'ab');
    await until(() => text().indexOf('No pages match') >= 0, 'no matches');
  });

  it('creates from a template and opens it', async () => {
    api.listPages.mockResolvedValue([]);
    api.createPage.mockResolvedValue(page({ id: 'new' }));
    api.getPage.mockResolvedValue(page({ id: 'new' }));
    await open('/pages');
    await until(() => text().indexOf('Weekly to-do') >= 0, 'the templates');
    await click(Array.from(document.querySelectorAll('.ws-tpl')).find((el) => (el.textContent || '').indexOf('Weekly to-do') >= 0)!);
    await until(() => path === '/pages/new', 'the new page');
    const body: any = api.createPage.mock.calls[0][0];
    expect(body.title).toBe('Weekly to-do');
    expect(body.content.type).toBe('doc');
  });

  it('asks before deleting, hides the row at once, and undo brings it back without a request', async () => {
    api.listPages.mockResolvedValue([page({ title: 'Gone soon' })]);
    await open('/pages');
    await until(() => text().indexOf('Gone soon') >= 0, 'the list');
    await click(button('More actions for Gone soon'));
    await click(button('Delete'));
    expect(text()).toContain('Delete "Gone soon"?');
    await click(button('Delete page'));
    await until(() => !document.querySelector('.hub-tbl'), 'the row to hide');
    expect(api.deletePage).not.toHaveBeenCalled();
    await click(button('Undo'));
    await until(() => document.querySelector('.hub-tbl'), 'the row to return');
    expect(api.deletePage).not.toHaveBeenCalled();
  });

  it('offers a retry when loading fails, and hides Delete on shared pages', async () => {
    api.listPages.mockRejectedValueOnce({ response: { status: 500 } });
    localStorage.setItem('ws-pages-view', 'shared');
    await open('/pages');
    await until(() => text().indexOf("Couldn't load your pages") >= 0 && button('Try again'), 'the error');
    api.listPages.mockResolvedValue([page({ title: 'Theirs', myAccess: 'view' })]);
    await click(button('Try again'));
    await until(() => text().indexOf('Theirs') >= 0, 'the list');
    await click(button('More actions for Theirs'));
    expect(button('Duplicate')).toBeTruthy();
    expect(button('Delete')).toBeUndefined();
  });
});
