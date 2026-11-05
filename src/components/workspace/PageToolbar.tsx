/**
 * Formatting toolbar above the page, plus table controls while the cursor is in a table.
 * A fixed bar rather than a bubble, so it works the same with a phone keyboard open.
 */
import React from 'react';
import { Editor, useEditorState } from '@tiptap/react';
import Icon from '../hub/ui/Icon';

const ListGlyph: React.FC = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
  </svg>
);

const ChecklistGlyph: React.FC = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="7" height="7" rx="1.5" />
    <path d="M3 18l2 2 4-4M14 7.5h7M14 18h7" />
  </svg>
);

const Tool: React.FC<{ label: string; active?: boolean; onRun: () => void; children: React.ReactNode }> = ({ label, active, onRun, children }) => (
  <button
    type="button"
    className="ws-tool"
    aria-label={label}
    title={label}
    aria-pressed={active}
    // Keep the selection in the editor.
    onMouseDown={(e) => e.preventDefault()}
    onClick={onRun}
  >
    {children}
  </button>
);

const TableTool: React.FC<{ danger?: boolean; onRun: () => void; children: React.ReactNode }> = ({ danger, onRun, children }) => (
  <button type="button" className={`ws-tool ws-tool-text${danger ? ' ws-tool-danger' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={onRun}>
    {children}
  </button>
);

const PageToolbar: React.FC<{ editor: Editor; onLink: () => void }> = ({ editor, onLink }) => {
  const on = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      link: e.isActive('link'),
      bullet: e.isActive('bulletList'),
      tasks: e.isActive('taskList'),
      table: e.isActive('table'),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div className="ws-toolbar" role="toolbar" aria-label="Formatting">
      <Tool label="Bold" active={on.bold} onRun={() => chain().toggleBold().run()}>
        <b>B</b>
      </Tool>
      <Tool label="Italic" active={on.italic} onRun={() => chain().toggleItalic().run()}>
        <i>I</i>
      </Tool>
      <Tool label="Strikethrough" active={on.strike} onRun={() => chain().toggleStrike().run()}>
        <s>S</s>
      </Tool>
      <Tool label="Link" active={on.link} onRun={onLink}>
        <Icon name="link" size={15} />
      </Tool>
      <span className="ws-tool-sep" aria-hidden="true" />
      <Tool label="Bulleted list" active={on.bullet} onRun={() => chain().toggleBulletList().run()}>
        <ListGlyph />
      </Tool>
      <Tool label="Checklist" active={on.tasks} onRun={() => chain().toggleTaskList().run()}>
        <ChecklistGlyph />
      </Tool>
      {on.table && (
        <div className="ws-toolbar-table" role="group" aria-label="Table">
          <TableTool onRun={() => chain().addRowAfter().run()}>Add row</TableTool>
          <TableTool onRun={() => chain().addColumnAfter().run()}>Add column</TableTool>
          <TableTool onRun={() => chain().deleteRow().run()}>Delete row</TableTool>
          <TableTool onRun={() => chain().deleteColumn().run()}>Delete column</TableTool>
          <TableTool danger onRun={() => chain().deleteTable().run()}>
            Delete table
          </TableTool>
        </div>
      )}
    </div>
  );
};

export default PageToolbar;
