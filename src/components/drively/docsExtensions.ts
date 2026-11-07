/** The TipTap setup for Drively documents. Build it once per editor. */
import { Extension, mergeAttributes, Node } from '@tiptap/core';
import type { Extensions } from '@tiptap/react';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view';
import { findTextAnchor, TextAnchor } from './commentAnchors';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import type * as Y from 'yjs';
import { resolveSrc } from './driveAssets';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: { setFontSize: (size: string | null) => ReturnType };
    pageBreak: { setPageBreak: () => ReturnType };
  }
}

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => el.style.fontSize || null,
            renderHTML: (attrs) => (attrs.fontSize ? { style: `font-size:${attrs.fontSize}` } : {}),
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: size }).removeEmptyTextStyle().run(),
    };
  },
});

const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  parseHTML: () => [{ tag: 'div[data-page-break]' }],
  renderHTML: () => ['div', { 'data-page-break': 'true', class: 'drv-pagebreak' }],
  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: 'pageBreak' }),
    };
  },
});

/** Pictures remember their private Iceberg asset and draw from a fresh link, because a stored one expires. */
const DriveImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), assetId: { default: null, parseHTML: (el) => el.getAttribute('data-asset-id'), renderHTML: (a) => (a.assetId ? { 'data-asset-id': a.assetId } : {}) } };
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { src: resolveSrc(HTMLAttributes['data-asset-id'], HTMLAttributes.src) })];
  },
});

export const isSafeHref = (url: string) => /^(https?:|mailto:|tel:|\/|#)/i.test(url.trim());

export interface DocCollab {
  fragment: Y.XmlFragment;
  awareness: unknown;
  user: { name: string; color: string };
}

/** The document as plain text, with each character's position in the editor. Blocks are separated by a line break. */
export function docText(doc: ProseMirrorNode): { text: string; positions: number[] } {
  let text = '';
  const positions: number[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i += 1) positions.push(pos + i);
      text += node.text;
    } else if (node.isTextblock && text && !text.endsWith('\n')) {
      positions.push(pos);
      text += '\n';
    }
    return true;
  });
  return { text, positions };
}

/** The stretch of `docText` output that falls between two editor positions. */
export function textRangeForPositions(flat: { positions: number[] }, from: number, to: number): [number, number] {
  let start = flat.positions.findIndex((p) => p >= from);
  if (start < 0) start = flat.positions.length;
  let end = start;
  while (end < flat.positions.length && flat.positions[end] < to) end += 1;
  return [start, end];
}

interface HighlightState {
  threads: { id: string; anchor: TextAnchor }[];
  activeId: string | null;
  decorations: DecorationSet;
}

const commentHighlightKey = new PluginKey<HighlightState>('driveCommentHighlights');

function highlightDecorations(doc: ProseMirrorNode, threads: HighlightState['threads'], activeId: string | null): DecorationSet {
  if (threads.length === 0) return DecorationSet.empty;
  const flat = docText(doc);
  const found: Decoration[] = [];
  for (const { id, anchor } of threads) {
    const range = findTextAnchor(flat.text, anchor);
    if (range) {
      found.push(Decoration.inline(flat.positions[range[0]], flat.positions[range[1] - 1] + 1, { class: `drv-cmt-hl${id === activeId ? ' drv-cmt-hl-on' : ''}`, 'data-comment-id': id }));
    }
  }
  return DecorationSet.create(doc, found);
}

/** Draws comment highlights as decorations: on screen only, never part of the shared document. */
const CommentHighlights = Extension.create({
  name: 'driveCommentHighlights',
  addProseMirrorPlugins() {
    return [
      new Plugin<HighlightState>({
        key: commentHighlightKey,
        state: {
          init: () => ({ threads: [], activeId: null, decorations: DecorationSet.empty }),
          apply(tr, value, _old, state) {
            const next = tr.getMeta(commentHighlightKey) as Pick<HighlightState, 'threads' | 'activeId'> | undefined;
            if (next) return { ...next, decorations: highlightDecorations(state.doc, next.threads, next.activeId) };
            return tr.docChanged ? { ...value, decorations: highlightDecorations(state.doc, value.threads, value.activeId) } : value;
          },
        },
        props: {
          decorations: (state) => commentHighlightKey.getState(state)?.decorations,
        },
      }),
    ];
  },
});

export function setCommentHighlights(view: EditorView, threads: HighlightState['threads'], activeId: string | null) {
  view.dispatch(view.state.tr.setMeta(commentHighlightKey, { threads, activeId }).setMeta('addToHistory', false));
}

export function buildDocExtensions(opts: { canEdit: boolean; collab?: DocCollab }): Extensions {
  return [
    CommentHighlights,
    // Undo comes from the collaboration extension, so it only takes back this person's own edits.
    StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, history: opts.collab ? false : undefined }),
    ...(opts.collab
      ? [
          Collaboration.configure({ fragment: opts.collab.fragment }),
          CollaborationCursor.configure({ provider: { awareness: opts.collab.awareness }, user: opts.collab.user }),
        ]
      : []),
    Underline,
    TextStyle,
    FontFamily,
    FontSize,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: opts.canEdit }),
    TableRow,
    TableHeader,
    TableCell,
    DriveImage.configure({ allowBase64: true }),
    PageBreak,
    Link.configure({
      openOnClick: !opts.canEdit,
      isAllowedUri: (url) => isSafeHref(url),
      HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow', class: null },
    }),
    Placeholder.configure({ placeholder: opts.canEdit ? 'Start typing…' : '' }),
  ];
}
