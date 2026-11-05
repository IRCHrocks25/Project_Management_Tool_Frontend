/* eslint-disable no-script-url -- these tests check that such links are refused */
import { Editor } from '@tiptap/react';
import { buildPageExtensions } from './pageExtensions';
import { createSlashStore, filterSlashItems, SLASH_ITEMS, SlashStore } from './pageSlash';
import { PAGE_TEMPLATES } from './pageTemplates';

// jsdom has no layout, which ProseMirror only needs for scrolling and carets.
const rect = () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) });
(Range.prototype as any).getClientRects = () => [];
(Range.prototype as any).getBoundingClientRect = rect;
(Element.prototype as any).scrollIntoView = () => undefined;
(document as any).elementFromPoint = () => null;

let editor: Editor;
let slash: SlashStore;
let host: HTMLElement;
const actions = { pickImage: jest.fn(), linkTask: jest.fn() };

const make = (content: any, canEdit = true) => {
  slash = createSlashStore();
  host = document.body.appendChild(document.createElement('div'));
  editor = new Editor({
    element: host,
    extensions: buildPageExtensions({ canEdit, slash, actions }),
    content,
    editable: canEdit,
  });
  return editor;
};

const doc = (...content: any[]) => ({ type: 'doc', content });
const para = (text?: string) => ({ type: 'paragraph', ...(text ? { content: [{ type: 'text', text }] } : {}) });
const linked = (href: string) => doc({ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href } }] }] });

/** Type at the cursor the way the Suggestion plugin sees it. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0)); // the plugin asks for its items asynchronously
const type = async (text: string) => {
  editor.commands.insertContent(text);
  await settle();
};
const press = async (key: string) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  const used = !!editor.view.someProp('handleKeyDown', (f) => f(editor.view, event));
  await settle();
  return used;
};
const nodeTypes = () => (editor.getJSON().content || []).map((n: any) => n.type);

afterEach(() => {
  if (editor) editor.destroy();
  if (host) host.remove();
  jest.clearAllMocks();
});

describe('templates', () => {
  it.each(PAGE_TEMPLATES.map((t) => [t.title, t] as const))('%s is valid for the page schema and has checklists', (_title, template) => {
    make(doc(para()));
    expect(() => editor.schema.nodeFromJSON(template.content).check()).not.toThrow();
    let tasks = 0;
    editor.schema.nodeFromJSON(template.content).descendants((n) => {
      if (n.type.name === 'taskItem') tasks++;
    });
    expect(tasks).toBeGreaterThan(0);
  });
});

describe('links', () => {
  it.each(['javascript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x', 'vbscript:x', '//evil.example'])('never renders %j from stored content', (href) => {
    make(linked(href));
    const a = editor.view.dom.querySelector('a');
    expect(a && a.getAttribute('href')).toBe('');
  });

  it.each(['https://example.com', 'mailto:a@example.com', '/project/1?task=2&tab=details'])('renders %s', (href) => {
    make(linked(href));
    const a = editor.view.dom.querySelector('a');
    expect(a && a.getAttribute('href')).toBe(href);
    expect(a && a.getAttribute('rel')).toContain('noopener');
  });

  it('refuses to set a bad link, allows a good one', () => {
    make(doc(para('hello')));
    editor.commands.setTextSelection({ from: 1, to: 6 });
    expect(editor.commands.setLink({ href: 'javascript:alert(1)' })).toBe(false);
    expect(editor.isActive('link')).toBe(false);
    expect(editor.commands.setLink({ href: '/pages' })).toBe(true);
    expect(editor.isActive('link')).toBe(true);
  });

  it('autolinks typed web addresses but no other scheme', async () => {
    make(doc(para()));
    editor.commands.insertContent('see https://example.com/a ');
    editor.commands.insertContent('www.example.org ');
    editor.commands.insertContent('ftp://example.net ');
    await settle();
    const hrefs = Array.from(editor.view.dom.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).not.toContain('ftp://example.net');
    hrefs.forEach((href) => expect(href).toMatch(/^https?:\/\//));
  });

  it('drops a javascript: link from pasted HTML', () => {
    make(doc(para()));
    editor.commands.setContent('<p><a href="javascript:alert(1)">bad</a> <a href="https://ok.example">good</a></p>');
    expect(editor.view.dom.querySelectorAll('a')).toHaveLength(1);
    expect(editor.getHTML()).not.toContain('javascript:');
  });
});

describe('slash menu', () => {
  it('filters by title and keyword', async () => {
    expect(filterSlashItems('')).toHaveLength(SLASH_ITEMS.length);
    expect(filterSlashItems('head').map((i) => i.id)).toEqual(['h1', 'h2', 'h3']);
    expect(filterSlashItems('todo').map((i) => i.id)).toEqual(['checklist']);
    expect(filterSlashItems('zzz')).toEqual([]);
  });

  it('opens on / at the start of a line and after a space, not inside a word', async () => {
    make(doc(para()));
    await type('/');
    expect(slash.getView()).not.toBeNull();
    editor.commands.setContent(doc(para('and')), false);
    editor.commands.focus('end');
    await type('/');
    expect(slash.getView()).toBeNull();
    editor.commands.setContent(doc(para('and ')), false);
    editor.commands.focus('end');
    await type('/');
    expect(slash.getView()).not.toBeNull();
  });

  it('arrows move, Enter runs the command and removes the typed text', async () => {
    make(doc(para()));
    await type('/');
    await type('head');
    expect(slash.getView()!.items).toHaveLength(3);
    expect(await press('ArrowDown')).toBe(true);
    expect(slash.getView()!.index).toBe(1);
    expect(await press('ArrowUp')).toBe(true);
    expect(await press('ArrowUp')).toBe(true);
    expect(slash.getView()!.index).toBe(2);
    expect(await press('Enter')).toBe(true);
    expect(slash.getView()).toBeNull();
    expect(editor.getJSON()).toEqual(doc({ type: 'heading', attrs: { level: 3 } }));
  });

  it('Enter picks the command inside a list too', async () => {
    make(doc({ type: 'bulletList', content: [{ type: 'listItem', content: [para()] }] }));
    editor.commands.focus('start');
    await type('/');
    await type('head');
    expect(await press('Enter')).toBe(true);
    expect(editor.getText()).toBe('');
    expect(slash.getView()).toBeNull();
  });

  it('Esc hides the menu and hands keys back, without removing the text', async () => {
    make(doc(para()));
    await type('/h');
    expect(await press('Escape')).toBe(true);
    expect(slash.getView()).toBeNull();
    expect(await press('ArrowDown')).toBe(false);
    await type('e');
    expect(slash.getView()).toBeNull();
    expect(editor.getText()).toBe('/he');
  });

  it('closes when nothing matches, and Enter then behaves normally', async () => {
    make(doc(para()));
    await type('/zzz');
    expect(slash.getView()).toBeNull();
    await press('Enter');
    expect(editor.getJSON().content).toHaveLength(2);
  });

  it.each([
    ['text', 'paragraph'],
    ['h1', 'heading'],
    ['checklist', 'taskList'],
    ['bullet', 'bulletList'],
    ['number', 'orderedList'],
    ['quote', 'blockquote'],
    ['divider', 'horizontalRule'],
    ['table', 'table'],
  ])('%s inserts a %s', async (id, nodeType) => {
    make(doc(para()));
    await type('/');
    const i = slash.getView()!.items.findIndex((x) => x.id === id);
    slash.select(i);
    await settle();
    expect(nodeTypes()).toContain(nodeType);
    expect(editor.getText()).not.toContain('/');
  });

  it('table is 3 by 3 with a header row', async () => {
    make(doc(para()));
    await type('/table');
    await press('Enter');
    const table: any = (editor.getJSON().content || []).find((n: any) => n.type === 'table');
    expect(table.content).toHaveLength(3);
    expect(table.content[0].content.map((c: any) => c.type)).toEqual(['tableHeader', 'tableHeader', 'tableHeader']);
    expect(table.content[1].content.map((c: any) => c.type)).toEqual(['tableCell', 'tableCell', 'tableCell']);
  });

  it('image and task link call out to the screen', async () => {
    make(doc(para()));
    await type('/image');
    await press('Enter');
    expect(actions.pickImage).toHaveBeenCalledTimes(1);
    expect(editor.getText()).toBe('');
    await type('/link');
    await press('Enter');
    expect(actions.linkTask).toHaveBeenCalledTimes(1);
    expect(editor.getText()).toBe('');
  });

  it('does not open in a code block', async () => {
    make(doc({ type: 'codeBlock' }));
    editor.commands.focus('start');
    await type('/');
    expect(slash.getView()).toBeNull();
  });
});

describe('table commands and read-only', () => {
  it('adds and removes rows and columns', () => {
    make(doc(para()));
    editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
    expect(editor.isActive('table')).toBe(true);
    const rows = () => (editor.getJSON().content || []).find((n: any) => n.type === 'table')?.content || [];
    expect(editor.chain().focus().addRowAfter().run()).toBe(true);
    expect(rows()).toHaveLength(4);
    expect(editor.chain().focus().addColumnAfter().run()).toBe(true);
    expect(rows()[0].content).toHaveLength(4);
    expect(editor.chain().focus().deleteColumn().run()).toBe(true);
    expect(rows()[0].content).toHaveLength(3);
    expect(editor.chain().focus().deleteTable().run()).toBe(true);
    expect(nodeTypes()).not.toContain('table');
  });

  it('a checkbox click changes nothing when read-only', () => {
    const tasks = doc({ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [para('a')] }] });
    make(tasks, false);
    const box = editor.view.dom.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    box.click();
    expect(box.checked).toBe(false);
    expect((editor.getJSON() as any).content[0].content[0].attrs.checked).toBe(false);
    expect(editor.isEditable).toBe(false);
  });

  it('setEditable without emitting does not look like an edit', () => {
    const onUpdate = jest.fn();
    make(doc(para()));
    editor.on('update', onUpdate);
    editor.setEditable(false, false);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('reloading content without emitting does not look like an edit', () => {
    const onUpdate = jest.fn();
    make(doc(para()));
    editor.on('update', onUpdate);
    editor.commands.setContent(doc(para('fresh')), false);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(editor.getText()).toBe('fresh');
  });
});
