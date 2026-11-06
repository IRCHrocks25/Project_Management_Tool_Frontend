/**
 * Docs: a page on screen, a toolbar on top, document tabs and an outline on the side. People edit together live.
 * Each tab is its own part of the shared document. Exports to Word and PDF.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Editor, EditorContent, JSONContent, useEditor } from '@tiptap/react';
import { getSchema } from '@tiptap/core';
import { useSearchParams } from 'react-router-dom';
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProsemirrorJSON } from 'y-prosemirror';
import * as Y from 'yjs';
import { DriveDetail, drivelyService, saveBlob } from '../../services/drively.service';
import { hubErrorMessage } from '../../services/hub.service';
import Icon from '../hub/ui/Icon';
import OverflowMenu from '../hub/ui/OverflowMenu';
import { useToast } from '../hub/ui/Toast';
import ConfirmDialog from '../hub/ui/ConfirmDialog';
import EmptyState from '../hub/ui/EmptyState';
import { Skeleton } from '../hub/ui/Skeleton';
import { buildDocExtensions, isSafeHref } from './docsExtensions';
import { setAssetLink, setAssetLinks, withResolvedPictures } from './driveAssets';
import { exportName, newId } from './driveContent';
import { LiveDoc, useLiveDoc, useLivePreview } from './driveLive';
import { NameModal } from './DriveModals';
import EditorShell from './EditorShell';

interface DocTab {
  id: string;
  title: string;
}

const BLANK: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };
const tabOrder = (doc: Y.Doc) => doc.getArray<string>('tabOrder');
const tabTitles = (doc: Y.Doc) => doc.getMap<string>('tabTitles');
const tabFragment = (doc: Y.Doc, id: string) => doc.getXmlFragment(`tab:${id}`);
const docSchema = () => getSchema(buildDocExtensions({ canEdit: true }));

const readTabs = (doc: Y.Doc): DocTab[] =>
  tabOrder(doc)
    .toArray()
    .filter((id) => tabTitles(doc).has(id))
    .map((id) => ({ id, title: tabTitles(doc).get(id) as string }));

function addTab(doc: Y.Doc, title: string, content: JSONContent = BLANK, index?: number): string {
  const id = newId();
  doc.transact(() => {
    prosemirrorJSONToYXmlFragment(docSchema(), content, tabFragment(doc, id));
    tabTitles(doc).set(id, title);
    const order = tabOrder(doc);
    order.insert(index ?? order.length, [id]);
  });
  return id;
}

const tabJson = (doc: Y.Doc, id: string): JSONContent => yXmlFragmentToProsemirrorJSON(tabFragment(doc, id)) as JSONContent;

/** The next free "Tab n", counting up from how many there are. */
const nextTabTitle = (tabs: DocTab[]) => {
  const taken = new Set(tabs.map((t) => t.title));
  let n = tabs.length + 1;
  while (taken.has(`Tab ${n}`)) n += 1;
  return `Tab ${n}`;
};

const FONTS = ['Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Courier New', 'Trebuchet MS', 'DM Sans'];
const SIZES = ['10', '11', '12', '14', '16', '18', '20', '24', '30', '36', '48'];
const SWATCHES = ['#111111', '#6b7280', '#b91c1c', '#b45309', '#15803d', '#0f766e', '#7c2d12', '#ffffff'];
const MARKS = ['#fef08a', '#bbf7d0', '#99f6e4', '#fed7aa', '#fecaca', '#e5e7eb'];

const Btn: React.FC<{ label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }> = ({ label, active, disabled, onClick, children }) => (
  <button type="button" className={`drv-tb${active ? ' drv-tb-on' : ''}`} aria-label={label} title={label} aria-pressed={active} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
    {children}
  </button>
);

const blockValue = (e: Editor) => {
  for (const l of [1, 2, 3, 4]) if (e.isActive('heading', { level: l })) return `h${l}`;
  return 'p';
};

const Swatches: React.FC<{ label: string; colors: string[]; glyph: React.ReactNode; onPick: (c: string | null) => void }> = ({ label, colors, glyph, onPick }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as globalThis.Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="drv-swatch-wrap" ref={ref}>
      <button type="button" className="drv-tb" aria-label={label} title={label} aria-expanded={open} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)}>{glyph}</button>
      {open && (
        <div className="drv-swatches" role="menu">
          {colors.map((c) => (
            <button key={c} type="button" role="menuitem" aria-label={c} style={{ background: c }} onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(c); setOpen(false); }} />
          ))}
          <button type="button" role="menuitem" className="drv-swatch-none" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(null); setOpen(false); }}>Clear</button>
        </div>
      )}
    </div>
  );
};

const Toolbar: React.FC<{ editor: Editor; onImage: () => void; onLink: () => void }> = ({ editor: e, onImage, onLink }) => {
  const c = () => e.chain().focus();
  const inTable = e.isActive('table');
  const font = (e.getAttributes('textStyle').fontFamily as string) || 'Arial';
  const size = ((e.getAttributes('textStyle').fontSize as string) || '').replace('px', '').replace('pt', '') || '11';
  return (
    <div className="drv-toolbar" role="toolbar" aria-label="Formatting">
      <Btn label="Undo" disabled={!e.can().undo()} onClick={() => c().undo().run()}>↶</Btn>
      <Btn label="Redo" disabled={!e.can().redo()} onClick={() => c().redo().run()}>↷</Btn>
      <span className="drv-tb-sep" />
      <select
        className="drv-tb-sel"
        aria-label="Text style"
        value={blockValue(e)}
        onChange={(ev) => {
          const v = ev.target.value;
          if (v === 'p') c().setParagraph().run();
          else c().setHeading({ level: Number(v[1]) as 1 | 2 | 3 | 4 }).run();
        }}
      >
        <option value="p">Normal text</option>
        <option value="h1">Title</option>
        <option value="h2">Heading 1</option>
        <option value="h3">Heading 2</option>
        <option value="h4">Heading 3</option>
      </select>
      <select className="drv-tb-sel" aria-label="Font" value={font} onChange={(ev) => c().setFontFamily(ev.target.value).run()}>
        {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
      <select className="drv-tb-sel drv-tb-num" aria-label="Font size" value={size} onChange={(ev) => c().setFontSize(`${ev.target.value}pt`).run()}>
        {(SIZES.includes(size) ? SIZES : [size, ...SIZES]).map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <span className="drv-tb-sep" />
      <Btn label="Bold" active={e.isActive('bold')} onClick={() => c().toggleBold().run()}><b>B</b></Btn>
      <Btn label="Italic" active={e.isActive('italic')} onClick={() => c().toggleItalic().run()}><i>I</i></Btn>
      <Btn label="Underline" active={e.isActive('underline')} onClick={() => c().toggleUnderline().run()}><u>U</u></Btn>
      <Btn label="Strikethrough" active={e.isActive('strike')} onClick={() => c().toggleStrike().run()}><s>S</s></Btn>
      <Swatches label="Text colour" colors={SWATCHES} glyph={<span className="drv-a">A</span>} onPick={(v) => (v ? c().setColor(v).run() : c().unsetColor().run())} />
      <Swatches label="Highlight" colors={MARKS} glyph={<span className="drv-a drv-a-mark">A</span>} onPick={(v) => (v ? c().setHighlight({ color: v }).run() : c().unsetHighlight().run())} />
      <span className="drv-tb-sep" />
      <Btn label="Link" active={e.isActive('link')} onClick={onLink}><Icon name="link" size={15} /></Btn>
      <Btn label="Insert picture" onClick={onImage}><Icon name="file" size={15} /></Btn>
      <Btn label="Insert table" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Icon name="grid" size={15} /></Btn>
      <span className="drv-tb-sep" />
      {(['left', 'center', 'right', 'justify'] as const).map((a) => (
        <Btn key={a} label={`Align ${a}`} active={e.isActive({ textAlign: a })} onClick={() => c().setTextAlign(a).run()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d={{ left: 'M4 6h16M4 12h10M4 18h14', center: 'M4 6h16M7 12h10M5 18h14', right: 'M4 6h16M10 12h10M6 18h14', justify: 'M4 6h16M4 12h16M4 18h16' }[a]} />
          </svg>
        </Btn>
      ))}
      <span className="drv-tb-sep" />
      <Btn label="Bulleted list" active={e.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}>•≡</Btn>
      <Btn label="Numbered list" active={e.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}>1≡</Btn>
      <Btn label="Checklist" active={e.isActive('taskList')} onClick={() => c().toggleTaskList().run()}><Icon name="check" size={15} /></Btn>
      <Btn label="Quote" active={e.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()}>“</Btn>
      <Btn label="Divider" onClick={() => c().setHorizontalRule().run()}>—</Btn>
      <Btn label="Page break" onClick={() => c().setPageBreak().run()}>⤓</Btn>
      <Btn label="Clear formatting" onClick={() => c().unsetAllMarks().clearNodes().run()}>T̸</Btn>
      {inTable && (
        <>
          <span className="drv-tb-sep" />
          <Btn label="Add row" onClick={() => c().addRowAfter().run()}>+R</Btn>
          <Btn label="Add column" onClick={() => c().addColumnAfter().run()}>+C</Btn>
          <Btn label="Delete row" onClick={() => c().deleteRow().run()}>−R</Btn>
          <Btn label="Delete column" onClick={() => c().deleteColumn().run()}>−C</Btn>
          <Btn label="Delete table" onClick={() => c().deleteTable().run()}><Icon name="trash" size={15} /></Btn>
        </>
      )}
    </div>
  );
};

const DocsEditor: React.FC<{ item: DriveDetail }> = ({ item }) => {
  useMemo(() => setAssetLinks(item.assetLinks), [item.assetLinks]);
  const live = useLiveDoc(item, (doc) => {
    addTab(doc, 'Tab 1', item.content?.type === 'doc' ? item.content : BLANK);
  });
  const [tabs, setTabs] = useState<DocTab[]>([]);
  useEffect(() => {
    const read = () => setTabs(readTabs(live.doc));
    live.doc.on('update', read);
    read();
    return () => live.doc.off('update', read);
  }, [live.doc]);

  if (live.removed) return <div className="drv-loading"><EmptyState icon="alert" title="You no longer have access to this file" text="It may have been moved to the trash, or its owner changed who can open it." /></div>;
  if (live.failed) return <div className="drv-loading"><EmptyState icon="alert" title="Couldn't open this file" text="The file storage didn't answer. Try again in a moment." /></div>;
  if (!live.synced || tabs.length === 0) return <div className="drv-loading"><Skeleton height={44} /><Skeleton height={420} /></div>;
  return <DocsWorkspace item={item} live={live} tabs={tabs} />;
};

const DocsWorkspace: React.FC<{ item: DriveDetail; live: LiveDoc; tabs: DocTab[] }> = ({ item, live, tabs }) => {
  const toast = useToast();
  const canEdit = live.level !== 'view';
  const shownItem = useMemo(() => ({ ...item, myAccess: live.level }), [item, live.level]);
  const [params, setParams] = useSearchParams();
  const wanted = params.get('tab');
  const activeTab = tabs.find((t) => t.id === wanted) || tabs[0];
  const tabId = activeTab.id;
  const openTab = useCallback((id: string) => setParams({ tab: id }, { replace: true }), [setParams]);
  const editorRef = useRef<Editor | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [, force] = useState(0);
  const [outline, setOutline] = useState<{ pos: number; level: number; text: string }[]>([]);
  const [showOutline, setShowOutline] = useState(true);
  const [words, setWords] = useState(0);
  const [renaming, setRenaming] = useState<DocTab | null>(null);
  const [deleting, setDeleting] = useState<DocTab | null>(null);

  useLivePreview(live, item.id, 'doc', () => {
    const [first] = readTabs(live.doc);
    return first ? tabJson(live.doc, first.id) : BLANK;
  });

  const refreshOutline = useCallback((e: Editor) => {
    const next: { pos: number; level: number; text: string }[] = [];
    e.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading' && node.textContent.trim()) next.push({ pos, level: node.attrs.level, text: node.textContent });
    });
    setOutline(next);
    setWords((e.state.doc.textBetween(0, e.state.doc.content.size, ' ', ' ').match(/\S+/g) || []).length);
  }, []);

  const uploadImage = useCallback(
    async (file: File) => {
      try {
        const { assetId, src } = await drivelyService.addImage(item.id, file, file.name);
        setAssetLink(assetId, src);
        editorRef.current?.chain().focus().insertContent({ type: 'image', attrs: { src, assetId, alt: file.name } }).run();
      } catch (err) {
        toast.error(hubErrorMessage(err, "Couldn't add the picture."));
      }
    },
    [item.id, toast],
  );

  const editor = useEditor({
    extensions: buildDocExtensions({
      canEdit,
      collab: { fragment: tabFragment(live.doc, tabId), awareness: live.awareness, user: { name: live.me.name, color: live.me.color } },
    }),
    editable: canEdit,
    onUpdate: ({ editor: e }) => refreshOutline(e as Editor),
    onSelectionUpdate: () => force((n) => n + 1),
    onTransaction: () => force((n) => n + 1),
    editorProps: {
      attributes: { class: 'drv-prose', 'aria-label': 'Document text' },
      handlePaste: (_view, event) => {
        const file = Array.from(event.clipboardData?.files || []).find((f) => f.type.startsWith('image/'));
        if (!file) return false;
        uploadImage(file);
        return true;
      },
      handleDrop: (_view, event) => {
        const file = Array.from((event as DragEvent).dataTransfer?.files || []).find((f) => f.type.startsWith('image/'));
        if (!file) return false;
        event.preventDefault();
        uploadImage(file);
        return true;
      },
    },
  }, [tabId]);
  editorRef.current = editor;

  useEffect(() => {
    editor?.setEditable(canEdit);
  }, [canEdit, editor]);

  const newTab = () => openTab(addTab(live.doc, nextTabTitle(tabs)));

  const duplicateTab = (tab: DocTab) => {
    const index = tabs.findIndex((t) => t.id === tab.id);
    openTab(addTab(live.doc, `Copy of ${tab.title}`, tabJson(live.doc, tab.id), index + 1));
  };

  const removeTab = (tab: DocTab) => {
    live.doc.transact(() => {
      const order = tabOrder(live.doc);
      const at = order.toArray().indexOf(tab.id);
      if (at >= 0) order.delete(at, 1);
      tabTitles(live.doc).delete(tab.id);
      const fragment = tabFragment(live.doc, tab.id);
      fragment.delete(0, fragment.length);
    });
    if (tab.id === tabId) {
      const next = tabs.find((t) => t.id !== tab.id);
      if (next) openTab(next.id);
    }
  };

  const moveTab = (tab: DocTab, by: number) => {
    live.doc.transact(() => {
      const order = tabOrder(live.doc);
      const at = order.toArray().indexOf(tab.id);
      const to = at + by;
      if (at < 0 || to < 0 || to >= order.length) return;
      order.delete(at, 1);
      order.insert(to, [tab.id]);
    });
  };

  /** Every tab in one document, with a page break between tabs. */
  const wholeDocument = (): JSONContent => ({
    type: 'doc',
    content: tabs.flatMap((t, i) => [...(i ? [{ type: 'pageBreak' }] : []), ...(tabJson(live.doc, t.id).content || [])]),
  });

  useEffect(() => {
    if (editor) refreshOutline(editor);
  }, [editor, refreshOutline]);

  const onLink = () => {
    if (!editor) return;
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt('Link address');
    if (!url) return;
    const href = /^[a-z]+:|^\/|^#/i.test(url) ? url : `https://${url}`;
    if (!isSafeHref(href)) {
      toast.error('That link type is not allowed.');
      return;
    }
    if (editor.state.selection.empty) editor.chain().focus().insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href } }] }).run();
    else editor.chain().focus().setLink({ href }).run();
  };

  const download = async (type: 'docx' | 'pdf') => {
    if (!editor) return;
    try {
      if (type === 'docx') {
        const { docToDocx } = await import('./docsExport');
        saveBlob(await docToDocx(withResolvedPictures(wholeDocument())), exportName(item.name, 'docx'));
      } else if (pageRef.current) {
        const { elementToPdf } = await import('./docsExport');
        saveBlob(await elementToPdf(pageRef.current.querySelector('.drv-prose') as HTMLElement), exportName(item.name, 'pdf'));
      }
    } catch {
      toast.error("Couldn't create the file.");
    }
  };

  const actions = (
    <OverflowMenu
      label="File actions"
      triggerLabel="File"
      size="md"
      items={[
        { label: 'Download as Word', icon: 'download', onSelect: () => download('docx') },
        { label: tabs.length > 1 ? 'Download this tab as PDF' : 'Download as PDF', icon: 'download', onSelect: () => download('pdf') },
        { label: tabs.length > 1 ? 'Print this tab' : 'Print', icon: 'file', onSelect: () => window.print() },
        { label: showOutline ? 'Hide tabs and outline' : 'Show tabs and outline', icon: 'menu', onSelect: () => setShowOutline((s) => !s) },
      ]}
    />
  );

  return (
    <EditorShell item={shownItem} status={canEdit ? live.status : undefined} peers={live.peers} actions={actions}>
      {editor && canEdit && <Toolbar editor={editor} onImage={() => fileInput.current?.click()} onLink={onLink} />}
      <div className="drv-doc-body">
        {showOutline && (
          <nav className="drv-outline" aria-label="Document tabs">
            <div className="drv-tabs-h">
              <h2>Document tabs</h2>
              {canEdit && <button type="button" className="drv-tb" aria-label="Add tab" title="Add tab" onClick={newTab}><Icon name="plus" size={16} /></button>}
            </div>
            <ul className="drv-tabs">
              {tabs.map((t, i) => (
                <li key={t.id} className={t.id === tabId ? 'drv-tab-on' : undefined}>
                  <button type="button" className="drv-tab" aria-current={t.id === tabId ? 'page' : undefined} onClick={() => openTab(t.id)} title={t.title}>
                    <Icon name="file" size={15} /> <span>{t.title}</span>
                  </button>
                  {canEdit && (
                    <OverflowMenu
                      label={`Actions for ${t.title}`}
                      items={[
                        { label: 'Rename', icon: 'edit', onSelect: () => setRenaming(t) },
                        { label: 'Duplicate', icon: 'copy', onSelect: () => duplicateTab(t) },
                        { label: 'Move up', icon: 'up', disabled: i === 0, onSelect: () => moveTab(t, -1) },
                        { label: 'Move down', icon: 'down', disabled: i === tabs.length - 1, onSelect: () => moveTab(t, 1) },
                        { label: 'Delete', icon: 'trash', danger: true, disabled: tabs.length === 1, onSelect: () => setDeleting(t) },
                      ]}
                    />
                  )}
                </li>
              ))}
            </ul>
            <div className="drv-tab-outline">
              {outline.length === 0 && <p className="drv-muted">Headings you add to this tab appear here.</p>}
              {outline.map((h) => (
                <button
                  key={h.pos}
                  type="button"
                  style={{ paddingLeft: (h.level - 1) * 12 + 8 }}
                  onClick={() => {
                    if (!editor) return;
                    editor.chain().focus().setTextSelection(h.pos + 1).run();
                    (editor.view.nodeDOM(h.pos) as HTMLElement | null)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  {h.text}
                </button>
              ))}
            </div>
          </nav>
        )}
        <div className="drv-doc-scroll">
          <div
            className="drv-page"
            ref={pageRef}
            onMouseDown={(e) => {
              // A click in the page margin puts the cursor in the text, not nowhere.
              if (e.target === e.currentTarget && editor) {
                e.preventDefault();
                editor.commands.focus('end');
              }
            }}
          >
            <EditorContent editor={editor} />
          </div>
          <div className="drv-wordcount">{words} {words === 1 ? 'word' : 'words'}</div>
        </div>
      </div>
      {renaming && (
        <NameModal
          title="Rename tab"
          label="Tab name"
          action="Save"
          initial={renaming.title}
          onClose={() => setRenaming(null)}
          onSubmit={async (name) => {
            if (tabTitles(live.doc).has(renaming.id)) tabTitles(live.doc).set(renaming.id, name.slice(0, 100));
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this tab?"
          body={<>“{deleting.title}” and everything in it will be deleted for everyone in this file.</>}
          confirmLabel="Delete tab"
          onConfirm={() => removeTab(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadImage(f); }} />
    </EditorShell>
  );
};

export default DocsEditor;
