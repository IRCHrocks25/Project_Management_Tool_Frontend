/** The TipTap setup for Drively documents. Build it once per editor. */
import { Extension, mergeAttributes, Node } from '@tiptap/core';
import type { Extensions } from '@tiptap/react';
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

export function buildDocExtensions(opts: { canEdit: boolean; collab?: DocCollab }): Extensions {
  return [
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
