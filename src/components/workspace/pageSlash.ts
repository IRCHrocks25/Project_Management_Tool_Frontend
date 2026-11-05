/**
 * The "/" command menu: the commands, a small store that drives the menu, and the TipTap extension
 * that connects the two. The menu itself is PageSlashMenu.tsx.
 *
 * The store lives outside React so ProseMirror's key handler can read the current list and
 * selection synchronously, without waiting for a render.
 */
import { Editor, Extension, Range } from '@tiptap/react';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { SuggestionProps } from '@tiptap/suggestion';
import type { IconName } from '../hub/ui/Icon';

export interface SlashActions {
  /** Open the file picker for an image. */
  pickImage: () => void;
  /** Open the "Link to a task" dialog. */
  linkTask: () => void;
}

export interface SlashItem {
  id: string;
  title: string;
  hint: string;
  keywords: string;
  /** A short text mark, or a Hub icon. */
  glyph?: string;
  icon?: IconName;
  run: (ctx: { editor: Editor; range: Range; actions: SlashActions }) => void;
}

const start = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

export const SLASH_ITEMS: SlashItem[] = [
  { id: 'text', title: 'Text', hint: 'Plain paragraph', keywords: 'paragraph plain', glyph: 'T', run: ({ editor, range }) => start(editor, range).setParagraph().run() },
  { id: 'h1', title: 'Heading 1', hint: 'Large heading', keywords: 'title h1', glyph: 'H1', run: ({ editor, range }) => start(editor, range).setHeading({ level: 1 }).run() },
  { id: 'h2', title: 'Heading 2', hint: 'Medium heading', keywords: 'subtitle h2', glyph: 'H2', run: ({ editor, range }) => start(editor, range).setHeading({ level: 2 }).run() },
  { id: 'h3', title: 'Heading 3', hint: 'Small heading', keywords: 'h3', glyph: 'H3', run: ({ editor, range }) => start(editor, range).setHeading({ level: 3 }).run() },
  { id: 'checklist', title: 'Checklist', hint: 'Items to tick off', keywords: 'todo to-do task checkbox', icon: 'check', run: ({ editor, range }) => start(editor, range).toggleTaskList().run() },
  { id: 'bullet', title: 'Bulleted list', hint: 'Simple list', keywords: 'unordered ul', icon: 'menu', run: ({ editor, range }) => start(editor, range).toggleBulletList().run() },
  { id: 'number', title: 'Numbered list', hint: 'List in order', keywords: 'ordered ol', glyph: '1.', run: ({ editor, range }) => start(editor, range).toggleOrderedList().run() },
  { id: 'quote', title: 'Quote', hint: 'Set a passage apart', keywords: 'blockquote', glyph: '“', run: ({ editor, range }) => start(editor, range).toggleBlockquote().run() },
  { id: 'divider', title: 'Divider', hint: 'Line between sections', keywords: 'horizontal rule hr separator', icon: 'minus', run: ({ editor, range }) => start(editor, range).setHorizontalRule().run() },
  { id: 'table', title: 'Table', hint: '3 by 3, with a header', keywords: 'grid rows columns', icon: 'grid', run: ({ editor, range }) => start(editor, range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  {
    id: 'image',
    title: 'Image',
    hint: 'Upload, up to 10 MB',
    keywords: 'picture photo upload',
    icon: 'upload',
    run: ({ editor, range, actions }) => {
      start(editor, range).run();
      actions.pickImage();
    },
  },
  {
    id: 'task',
    title: 'Link to a task',
    hint: 'Search your projects',
    keywords: 'project reference',
    icon: 'link',
    run: ({ editor, range, actions }) => {
      start(editor, range).run();
      actions.linkTask();
    },
  },
];

export function filterSlashItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter((item) => item.title.toLowerCase().indexOf(q) >= 0 || item.keywords.indexOf(q) >= 0);
}

export interface SlashView {
  items: SlashItem[];
  index: number;
  clientRect: (() => DOMRect | null) | null;
}

type Props = SuggestionProps<SlashItem, SlashItem>;

export interface SlashStore {
  subscribe: (listener: () => void) => () => void;
  /** What the menu shows; null when it's closed. A new object only when something changed. */
  getView: () => SlashView | null;
  open: (props: Props) => void;
  update: (props: Props) => void;
  close: () => void;
  /** Returns true when the key was used by the menu. */
  key: (event: KeyboardEvent) => boolean;
  setIndex: (index: number) => void;
  select: (index: number) => void;
  /** Hide until the "/" text ends: Esc, or a click elsewhere. */
  dismiss: () => void;
}

export function createSlashStore(): SlashStore {
  const listeners = new Set<() => void>();
  let props: Props | null = null;
  let query = '';
  let index = 0;
  let dismissed = false;
  let view: SlashView | null = null;

  const emit = () => {
    view = props && !dismissed && props.items.length ? { items: props.items, index, clientRect: props.clientRect || null } : null;
    listeners.forEach((l) => l());
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getView: () => view,
    open: (next) => {
      props = next;
      query = next.query;
      index = 0;
      dismissed = false;
      emit();
    },
    update: (next) => {
      if (next.query !== query) index = 0;
      props = next;
      query = next.query;
      emit();
    },
    close: () => {
      props = null;
      dismissed = false;
      emit();
    },
    key: (event) => {
      if (!view || !props) return false;
      const n = view.items.length;
      if (event.key === 'ArrowDown') {
        index = (index + 1) % n;
        emit();
        return true;
      }
      if (event.key === 'ArrowUp') {
        index = (index - 1 + n) % n;
        emit();
        return true;
      }
      if (event.key === 'Enter') {
        props.command(view.items[index]);
        return true;
      }
      if (event.key === 'Escape') {
        dismissed = true;
        emit();
        return true;
      }
      return false;
    },
    setIndex: (next) => {
      if (next !== index) {
        index = next;
        emit();
      }
    },
    select: (next) => {
      if (props && props.items[next]) props.command(props.items[next]);
    },
    dismiss: () => {
      if (!dismissed) {
        dismissed = true;
        emit();
      }
    },
  };
}

const slashKey = new PluginKey('wsPageSlash');

export function createSlashExtension(store: SlashStore, actions: SlashActions) {
  return Extension.create({
    name: 'wsPageSlash',
    // Ahead of the list and paragraph keymaps, so Enter picks a command rather than splitting the line.
    priority: 1000,
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashItem, SlashItem>({
          pluginKey: slashKey,
          editor: this.editor,
          char: '/',
          startOfLine: false,
          decorationClass: 'ws-slash-q',
          allow: ({ editor }) => editor.isEditable && !editor.isActive('codeBlock'),
          items: ({ query }) => filterSlashItems(query),
          command: ({ editor, range, props }) => props.run({ editor, range, actions }),
          render: () => ({
            onStart: store.open,
            onUpdate: store.update,
            onExit: store.close,
            onKeyDown: ({ event }) => store.key(event),
          }),
        }),
      ];
    },
  });
}
