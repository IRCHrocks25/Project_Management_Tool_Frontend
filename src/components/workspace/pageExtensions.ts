/** The TipTap setup for a page. Build it once per editor: a new list would make TipTap reconfigure the editor. */
import type { Extensions } from '@tiptap/react';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import StarterKit from '@tiptap/starter-kit';
import { createSlashExtension, SlashActions, SlashStore } from './pageSlash';
import { isAllowedPageHref, isAutolinkable } from './pageUtils';

export function buildPageExtensions(opts: { canEdit: boolean; slash: SlashStore; actions: SlashActions }): Extensions {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Image.configure({ allowBase64: false }),
    Link.configure({
      // While editing, a click places the cursor; Cmd or Ctrl-click and the link dialog open the link.
      openOnClick: !opts.canEdit,
      isAllowedUri: (url) => isAllowedPageHref(url),
      validate: isAutolinkable,
      shouldAutoLink: isAutolinkable,
      HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow', class: null },
    }),
    Placeholder.configure({ placeholder: 'Type / for commands' }),
    createSlashExtension(opts.slash, opts.actions),
  ];
}
