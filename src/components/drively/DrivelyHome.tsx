/**
 * The Drively home: New menu and navigation on the left, search on top, then folders and files.
 * One screen serves Home, My Drive, a folder, Shared with me, Recent, Starred, Trash and search results.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DriveItem, DriveKind, DriveView, drivelyService, saveBlob } from '../../services/drively.service';
import { formsErrorMessage, formsService } from '../../services/forms.service';
import { hubErrorMessage } from '../../services/hub.service';
import ConfirmDialog from '../hub/ui/ConfirmDialog';
import EmptyState from '../hub/ui/EmptyState';
import Icon, { IconName } from '../hub/ui/Icon';
import OverflowMenu from '../hub/ui/OverflowMenu';
import { Skeleton } from '../hub/ui/Skeleton';
import { useToast } from '../hub/ui/Toast';
import { blankContent, blankTab, formatBytes, itemHref, KIND_LABELS, previewFor, sendTab } from './driveContent';
import { MoveModal, NameModal, ShareModal } from './DriveModals';
import FileIcon from './FileIcon';

type Section = 'home' | DriveView;

const NAV: { key: Section; label: string; icon: IconName; to: string }[] = [
  { key: 'home', label: 'Home', icon: 'grid', to: '/drively' },
  { key: 'mine', label: 'My Drive', icon: 'folder', to: '/drively/my-drive' },
  { key: 'shared', label: 'Shared with me', icon: 'users', to: '/drively/shared' },
  { key: 'recent', label: 'Recent', icon: 'refresh', to: '/drively/recent' },
  { key: 'starred', label: 'Starred', icon: 'star', to: '/drively/starred' },
  { key: 'trash', label: 'Trash', icon: 'trash', to: '/drively/trash' },
];

const TITLES: Record<Section, string> = {
  home: 'Welcome to Drively',
  mine: 'My Drive',
  shared: 'Shared with me',
  recent: 'Recent',
  starred: 'Starred',
  trash: 'Trash',
};

const EMPTY: Record<Section, { title: string; body: string }> = {
  home: { title: 'Nothing here yet', body: 'Create a document or upload a file to get started.' },
  mine: { title: 'Your Drive is empty', body: 'Use New to create a file or upload one. You can also drop files here.' },
  shared: { title: 'Nothing shared with you yet', body: 'Files and folders people share with you appear here.' },
  recent: { title: 'Nothing recent', body: 'Files you open or change appear here.' },
  starred: { title: 'No starred files', body: 'Star a file from its menu to find it quickly.' },
  trash: { title: 'Trash is empty', body: 'Things you delete wait here until you delete them forever.' },
};

const whenText = (iso: string) => {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
};

/** A small sample of the file, in the spirit of Drive's thumbnails. */
const CardPreview: React.FC<{ item: DriveItem }> = ({ item }) => {
  const p = item.preview;
  if (item.kind === 'doc' && p?.lines?.length) {
    return (
      <div className="drv-pv-doc" aria-hidden="true">
        {p.lines.map((l, i) => <div key={i} className={l.h ? 'drv-pv-h' : undefined}>{l.t}</div>)}
      </div>
    );
  }
  if (item.kind === 'grid' && p?.rows) {
    return (
      <table className="drv-pv-grid" aria-hidden="true">
        <tbody>
          {Array.from({ length: 9 }, (_, r) => (
            <tr key={r}>{Array.from({ length: 5 }, (_u, c) => <td key={c}>{p.rows![r]?.[c] || ''}</td>)}</tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (item.kind === 'slides' && p?.slide) {
    return (
      <div className="drv-pv-slide" aria-hidden="true" style={{ background: p.slide.bg || '#fff' }}>
        {p.slide.els.map((e, i) => (
          <div
            key={i}
            style={{
              left: `${(e.x / 960) * 100}%`,
              top: `${(e.y / 540) * 100}%`,
              width: `${(e.w / 960) * 100}%`,
              height: `${(e.h / 540) * 100}%`,
              color: e.c,
              background: e.f,
              fontSize: `${((e.s || 18) / 960) * 260}px`,
              borderRadius: e.shape === 'ellipse' ? '50%' : undefined,
            }}
          >
            {e.t}
          </div>
        ))}
      </div>
    );
  }
  return <div className="drv-pv-icon"><FileIcon kind={item.kind} size={52} /></div>;
};

interface Upload {
  id: string;
  name: string;
  progress: number;
  error?: string;
  done?: boolean;
}

const DrivelyHome: React.FC<{ section?: Section }> = ({ section: sectionProp }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const { folderId } = useParams();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const section: Section = sectionProp || (folderId ? 'mine' : 'home');

  const [items, setItems] = useState<DriveItem[] | null>(null);
  const [folder, setFolder] = useState<{ name: string; path: { id: string; name: string }[]; myAccess: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usedBytes, setUsedBytes] = useState<number | null>(null);
  const [layout, setLayout] = useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem('drively-layout') === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const [newOpen, setNewOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [dialog, setDialog] = useState<
    | { type: 'share' | 'move' | 'rename' | 'delete' | 'empty'; item?: DriveItem }
    | { type: 'folder'; item?: undefined }
    | null
  >(null);
  const [search, setSearch] = useState(q);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLDivElement>(null);

  const parentId = folderId || null;
  const canAddHere = section === 'home' || (section === 'mine' && (!folderId || folder?.myAccess !== 'view'));

  const load = useCallback(async () => {
    setError(null);
    try {
      if (q) return setItems(await drivelyService.list({ q }));
      if (section === 'home') {
        return setItems(await drivelyService.list({ view: 'recent' }));
      }
      if (folderId) {
        const [detail, children] = await Promise.all([drivelyService.get(folderId), drivelyService.list({ view: 'mine', parentId: folderId })]);
        setFolder({ name: detail.name, path: detail.path, myAccess: detail.myAccess });
        return setItems(children);
      }
      setFolder(null);
      setItems(await drivelyService.list({ view: section as DriveView }));
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't load your files."));
      setItems([]);
    }
  }, [section, folderId, q]);

  useEffect(() => {
    setItems(null);
    load();
    setNavOpen(false);
  }, [load]);

  // Files open in their own tab, so names and previews may have changed by the time someone comes back.
  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [load]);

  const refreshStorage = useCallback(() => {
    drivelyService.storage().then((s) => setUsedBytes(s.usedBytes)).catch(() => undefined);
  }, []);
  useEffect(refreshStorage, [refreshStorage]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() === q) return;
      setParams(search.trim() ? { q: search.trim() } : {}, { replace: true });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    if (!newOpen) return;
    const close = (e: MouseEvent) => {
      if (newRef.current && !newRef.current.contains(e.target as Node)) setNewOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setNewOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [newOpen]);

  const setLayoutSaved = (l: 'grid' | 'list') => {
    setLayout(l);
    try {
      localStorage.setItem('drively-layout', l);
    } catch {
      /* ignore */
    }
  };

  /* ---------------- creating ---------------- */

  const create = async (kind: 'doc' | 'grid' | 'slides') => {
    setNewOpen(false);
    const tab = blankTab();
    try {
      const content = blankContent(kind);
      const item = await drivelyService.create({ kind, parentId, content, preview: previewFor(kind, content) });
      sendTab(tab, itemHref(item), navigate);
      load();
    } catch (err) {
      tab?.close();
      toast.error(hubErrorMessage(err, "Couldn't create the file."));
    }
  };

  const createPdf = async () => {
    setNewOpen(false);
    const tab = blankTab();
    try {
      const { PDFDocument } = await import('pdf-lib');
      const pdf = await PDFDocument.create();
      pdf.addPage([595.28, 841.89]);
      const bytes = await pdf.save();
      const file = new File([bytes], 'Untitled PDF.pdf', { type: 'application/pdf' });
      const item = await drivelyService.upload(file, parentId);
      sendTab(tab, itemHref(item), navigate);
      load();
      refreshStorage();
    } catch (err) {
      tab?.close();
      toast.error(hubErrorMessage(err, "Couldn't create the PDF."));
    }
  };

  const createForm = async () => {
    setNewOpen(false);
    const tab = blankTab();
    try {
      const form = await formsService.create({});
      sendTab(tab, `/forms/${form.id}`, navigate);
    } catch (err) {
      tab?.close();
      toast.error(formsErrorMessage(err, "Couldn't create the form."));
    }
  };

  /* ---------------- uploading ---------------- */

  const uploadOne = useCallback(async (file: File, destination: string | null) => {
    const id = `${file.name}-${Date.now()}-${Math.random()}`;
    setUploads((u) => [...u, { id, name: file.name, progress: 0 }]);
    const patch = (over: Partial<Upload>) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, ...over } : x)));
    try {
      await drivelyService.upload(file, destination, (progress) => patch({ progress }));
      patch({ done: true, progress: 1 });
    } catch (err) {
      const tooBig = (err as any)?.response?.status === 413;
      patch({ error: tooBig ? 'Over the 100 MB limit.' : hubErrorMessage(err, "Couldn't upload this file.") });
    }
  }, []);

  const finishUploads = useCallback(() => {
    load();
    refreshStorage();
  }, [load, refreshStorage]);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) await uploadOne(file, parentId);
      finishUploads();
    },
    [finishUploads, parentId, uploadOne],
  );

  const uploadFolder = async (files: File[]) => {
    const folders = new Map<string, string | null>([['', parentId]]);
    const ensure = async (path: string): Promise<string | null> => {
      if (folders.has(path)) return folders.get(path)!;
      const cut = path.lastIndexOf('/');
      const parent = await ensure(cut < 0 ? '' : path.slice(0, cut));
      const made = await drivelyService.create({ kind: 'folder', name: path.slice(cut + 1), parentId: parent });
      folders.set(path, made.id);
      return made.id;
    };
    try {
      for (const file of files) {
        const relative = (file as any).webkitRelativePath || file.name;
        const cut = relative.lastIndexOf('/');
        await uploadOne(file, await ensure(cut < 0 ? '' : relative.slice(0, cut)));
      }
    } catch (err) {
      toast.error(hubErrorMessage(err, "Couldn't create the folder."));
    }
    finishUploads();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length && canAddHere) uploadFiles(files);
  };

  /* ---------------- item actions ---------------- */

  const act = async (work: () => Promise<unknown>, done: string, fail: string) => {
    try {
      await work();
      if (done) toast.show(done);
      load();
      refreshStorage();
    } catch (err) {
      toast.error(hubErrorMessage(err, fail));
    }
  };

  const download = async (item: DriveItem) => {
    if (item.kind === 'pdf' || item.kind === 'file') {
      try {
        const { url } = await drivelyService.link(item.id);
        const blob = await (await fetch(url)).blob();
        saveBlob(blob, item.name);
      } catch (err) {
        toast.error(hubErrorMessage(err, "Couldn't download the file."));
      }
    } else navigate(itemHref(item));
  };

  const moveInto = (id: string, target: DriveItem) => {
    if (id === target.id || target.kind !== 'folder') return;
    act(() => drivelyService.update(id, { parentId: target.id }), `Moved to ${target.name}`, "Couldn't move it.");
  };

  const menuFor = (item: DriveItem) => {
    if (section === 'trash') {
      return [
        { label: 'Restore', icon: 'restore' as IconName, onSelect: () => act(() => drivelyService.restore(item.id), 'Restored', "Couldn't restore it.") },
        { label: 'Delete forever', icon: 'trash' as IconName, danger: true, onSelect: () => setDialog({ type: 'delete', item }) },
      ];
    }
    return [
      { label: 'Open', icon: 'ext' as IconName, onSelect: () => openItem(item) },
      { label: 'Share', icon: 'share' as IconName, hidden: !item.isOwner, onSelect: () => setDialog({ type: 'share', item }) },
      { label: 'Download', icon: 'download' as IconName, hidden: item.kind !== 'pdf' && item.kind !== 'file', onSelect: () => download(item) },
      { label: 'Rename', icon: 'edit' as IconName, onSelect: () => setDialog({ type: 'rename', item }) },
      { label: 'Move', icon: 'folder' as IconName, hidden: !item.isOwner, onSelect: () => setDialog({ type: 'move', item }) },
      { label: 'Make a copy', icon: 'copy' as IconName, hidden: item.kind === 'folder', onSelect: () => act(() => drivelyService.duplicate(item.id), 'Copy created', "Couldn't copy it.") },
      {
        label: item.starred ? 'Remove star' : 'Add star',
        icon: 'star' as IconName,
        onSelect: () => act(() => drivelyService.star(item.id, !item.starred), '', "Couldn't change the star."),
      },
      { label: 'Move to trash', icon: 'trash' as IconName, danger: true, hidden: !item.isOwner, onSelect: () => act(() => drivelyService.trash(item.id), 'Moved to trash', "Couldn't move it to the trash.") },
    ];
  };

  const openItem = (item: DriveItem) => {
    if (section === 'trash') return;
    // Folders stay in this tab, like browsing; files get a tab of their own.
    if (item.kind === 'folder') navigate(itemHref(item));
    else sendTab(blankTab(), itemHref(item), navigate);
  };

  /* ---------------- pieces ---------------- */

  const dragProps = (item: DriveItem) => ({
    draggable: section !== 'trash' && item.isOwner,
    onDragStart: (e: React.DragEvent) => e.dataTransfer.setData('application/x-drively-item', item.id),
    ...(item.kind === 'folder' && section !== 'trash'
      ? {
          onDragOver: (e: React.DragEvent) => {
            if (e.dataTransfer.types.includes('application/x-drively-item')) e.preventDefault();
          },
          onDrop: (e: React.DragEvent) => {
            const id = e.dataTransfer.getData('application/x-drively-item');
            if (id) {
              e.preventDefault();
              e.stopPropagation();
              moveInto(id, item);
            }
          },
        }
      : {}),
  });

  const rightClick = (e: React.MouseEvent<HTMLElement>) => {
    const trigger = e.currentTarget.querySelector<HTMLButtonElement>('.drv-more button');
    if (trigger) {
      e.preventDefault();
      trigger.click();
    }
  };

  const renderFolder = (item: DriveItem) => (
    <div key={item.id} className="drv-folder" onContextMenu={rightClick} {...dragProps(item)}>
      <button type="button" className="drv-open" onClick={() => openItem(item)} title={item.name}>
        <FileIcon kind="folder" size={22} />
        <span className="drv-name">{item.name}</span>
      </button>
      <span className="drv-more"><OverflowMenu label={`More actions for ${item.name}`} items={menuFor(item)} /></span>
    </div>
  );

  const renderFile = (item: DriveItem) => (
    <article key={item.id} className="drv-card" onContextMenu={rightClick} {...dragProps(item)}>
      <div className="drv-card-h">
        <FileIcon kind={item.kind} size={20} />
        <button type="button" className="drv-open drv-name" onClick={() => openItem(item)} title={item.name}>{item.name}</button>
        {item.starred && <span className="drv-star" title="Starred">★</span>}
        <span className="drv-more"><OverflowMenu label={`More actions for ${item.name}`} items={menuFor(item)} /></span>
      </div>
      <button type="button" className="drv-card-pv" onClick={() => openItem(item)} tabIndex={-1} aria-hidden="true">
        <CardPreview item={item} />
      </button>
      <div className="drv-card-f">
        {item.isOwner ? 'You' : item.owner?.name || 'Someone'} · {section === 'trash' && item.trashedAt ? `Trashed ${whenText(item.trashedAt)}` : whenText(item.updatedAt)}
      </div>
    </article>
  );

  const list = useMemo(() => items || [], [items]);
  const folders = useMemo(() => list.filter((i) => i.kind === 'folder'), [list]);
  const files = useMemo(() => list.filter((i) => i.kind !== 'folder'), [list]);
  const title = q ? `Results for “${q}”` : folderId ? folder?.name || '' : TITLES[section];

  return (
    <div className="drv-shell" onDragOver={(e) => { if (e.dataTransfer.types.includes('Files') && canAddHere) { e.preventDefault(); setDragging(true); } }} onDragLeave={(e) => { if (!e.relatedTarget) setDragging(false); }} onDrop={onDrop}>
      <aside className={`drv-side${navOpen ? ' drv-side-open' : ''}`}>
        <Link to="/drively" className="drv-logo"><FileIcon kind="folder" size={26} /><span>Drively</span></Link>
        <div className="drv-new" ref={newRef}>
          <button type="button" className="hub-btn hub-btn-primary drv-new-btn" aria-expanded={newOpen} aria-haspopup="menu" disabled={!canAddHere} title={canAddHere ? undefined : 'You can only view this folder'} onClick={() => setNewOpen((o) => !o)}>
            <Icon name="plus" size={18} /> New
          </button>
          {newOpen && (
            <div className="drv-new-menu" role="menu">
              <button role="menuitem" type="button" onClick={() => { setNewOpen(false); setDialog({ type: 'folder' }); }}><FileIcon kind="folder" size={18} /> New folder</button>
              <hr />
              <button role="menuitem" type="button" onClick={() => { setNewOpen(false); fileInput.current?.click(); }}><Icon name="upload" size={18} /> File upload</button>
              <button role="menuitem" type="button" onClick={() => { setNewOpen(false); folderInput.current?.click(); }}><Icon name="upload" size={18} /> Folder upload</button>
              <hr />
              <button role="menuitem" type="button" onClick={() => create('doc')}><FileIcon kind="doc" size={18} /> Docs</button>
              <button role="menuitem" type="button" onClick={() => create('grid')}><FileIcon kind="grid" size={18} /> Grid</button>
              <button role="menuitem" type="button" onClick={() => create('slides')}><FileIcon kind="slides" size={18} /> Slides</button>
              <button role="menuitem" type="button" onClick={createPdf}><FileIcon kind="pdf" size={18} /> PDF</button>
              <button role="menuitem" type="button" onClick={createForm}><FileIcon kind="form" size={18} /> Forms</button>
            </div>
          )}
        </div>
        <nav aria-label="Drively">
          {NAV.map((n) => (
            <Link key={n.key} to={n.to} className={`drv-nav${section === n.key && !q ? ' drv-nav-on' : ''}`} aria-current={section === n.key && !q ? 'page' : undefined}>
              <Icon name={n.icon} size={18} /> {n.label}
            </Link>
          ))}
          <Link to="/forms" className="drv-nav"><FileIcon kind="form" size={18} /> Forms</Link>
        </nav>
        <div className="drv-storage">
          <Icon name="archive" size={16} />
          <span>{usedBytes === null ? 'Checking storage…' : `${usedBytes ? formatBytes(usedBytes) : '0 B'} used`}</span>
        </div>
        <Link to="/dashboard" className="drv-nav drv-back"><Icon name="chev" size={14} /> Back to the app</Link>
      </aside>
      {navOpen && <button type="button" aria-label="Close menu" className="drv-scrim" onClick={() => setNavOpen(false)} />}

      <div className="drv-main">
        <header className="drv-top">
          <button type="button" className="hub-btn hub-btn-ghost drv-menu-btn" aria-label="Open menu" onClick={() => setNavOpen(true)}><Icon name="menu" size={20} /></button>
          <div className="drv-search">
            <Icon name="search" size={18} />
            <input type="search" placeholder="Search in Drively" aria-label="Search in Drively" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </header>

        <main className="drv-body" id="drively-main">
          <div className="drv-head">
            {folderId && !q ? (
              <nav className="drv-trail drv-trail-lg" aria-label="Folder path">
                <Link to="/drively/my-drive">My Drive</Link>
                {folder?.path.map((p) => (
                  <React.Fragment key={p.id}>
                    <Icon name="chev" size={15} />
                    <Link to={`/drively/folders/${p.id}`}>{p.name}</Link>
                  </React.Fragment>
                ))}
                <Icon name="chev" size={15} />
                <h1>{title}</h1>
              </nav>
            ) : (
              <h1>{title}</h1>
            )}
            <div className="drv-seg" role="group" aria-label="Layout">
              <button type="button" aria-pressed={layout === 'list'} aria-label="List" onClick={() => setLayoutSaved('list')}><Icon name="menu" size={16} /></button>
              <button type="button" aria-pressed={layout === 'grid'} aria-label="Grid" onClick={() => setLayoutSaved('grid')}><Icon name="grid" size={16} /></button>
            </div>
          </div>

          {section === 'trash' && !q && list.length > 0 && <p className="drv-note">Deleted files stay here until you delete them forever. Only their owner can do that.</p>}
          {error && (
            <div className="drv-note drv-note-err" role="alert">
              {error} <button type="button" className="hub-btn hub-btn-sm" onClick={load}>Try again</button>
            </div>
          )}
          {!items && (
            <div className="drv-files"><Skeleton height={230} /><Skeleton height={230} /><Skeleton height={230} /><Skeleton height={230} /></div>
          )}
          {items && !error && list.length === 0 && (
            <EmptyState icon="folder" title={q ? 'No files match that search' : EMPTY[section].title} text={q ? 'Try another name.' : EMPTY[section].body} />
          )}

          {layout === 'grid' && list.length > 0 && (
            <>
              {folders.length > 0 && (
                <section aria-label="Folders">
                  <h2>{section === 'home' && !q ? 'Suggested folders' : 'Folders'}</h2>
                  <div className="drv-folders">{folders.map(renderFolder)}</div>
                </section>
              )}
              {files.length > 0 && (
                <section aria-label="Files">
                  <h2>{section === 'home' && !q ? 'Suggested files' : 'Files'}</h2>
                  <div className="drv-files">{files.map(renderFile)}</div>
                </section>
              )}
            </>
          )}

          {layout === 'list' && list.length > 0 && (
            <div className="drv-table-wrap">
              <table className="drv-table">
                <thead>
                  <tr><th>Name</th><th className="drv-hide-sm">Owner</th><th className="drv-hide-sm">Modified</th><th className="drv-hide-sm">Size</th><th aria-label="Actions" /></tr>
                </thead>
                <tbody>
                  {list.map((item) => (
                    <tr key={item.id} onContextMenu={rightClick} {...dragProps(item)}>
                      <td>
                        <button type="button" className="drv-open" onClick={() => openItem(item)}>
                          <FileIcon kind={item.kind} size={20} />
                          <span className="drv-name">{item.name}</span>
                          {item.starred && <span className="drv-star" title="Starred">★</span>}
                        </button>
                      </td>
                      <td className="drv-hide-sm">{item.isOwner ? 'You' : item.owner?.name || '—'}</td>
                      <td className="drv-hide-sm">{whenText(item.updatedAt)}</td>
                      <td className="drv-hide-sm" title={KIND_LABELS[item.kind as DriveKind]}>{formatBytes(item.sizeBytes)}</td>
                      <td className="drv-more"><OverflowMenu label={`More actions for ${item.name}`} items={menuFor(item)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {dragging && <div className="drv-drop" aria-hidden="true"><Icon name="upload" size={28} /> Drop files to upload to {folder?.name || 'My Drive'}</div>}

      {uploads.length > 0 && (
        <aside className="drv-uploads" aria-label="Uploads">
          <header>
            <b>{uploads.some((u) => !u.done && !u.error) ? 'Uploading…' : 'Uploads finished'}</b>
            <button type="button" className="hub-btn hub-btn-ghost hub-btn-sm" aria-label="Close" onClick={() => setUploads([])}><Icon name="x" size={15} /></button>
          </header>
          <ul>
            {uploads.map((u) => (
              <li key={u.id}>
                <span className="drv-name" title={u.name}>{u.name}</span>
                {u.error ? <span className="drv-err" role="alert">{u.error}</span> : u.done ? <Icon name="check" size={15} /> : <span className="drv-muted">{Math.round(u.progress * 100)}%</span>}
              </li>
            ))}
          </ul>
        </aside>
      )}

      <input ref={fileInput} type="file" multiple hidden onChange={(e) => { const files = Array.from(e.target.files || []); e.target.value = ''; if (files.length) uploadFiles(files); }} />
      <input ref={folderInput} type="file" multiple hidden {...({ webkitdirectory: '' } as any)} onChange={(e) => { const files = Array.from(e.target.files || []); e.target.value = ''; if (files.length) uploadFolder(files); }} />

      {dialog?.type === 'share' && dialog.item && <ShareModal item={dialog.item} onClose={() => setDialog(null)} />}
      {dialog?.type === 'move' && dialog.item && <MoveModal item={dialog.item} onClose={() => setDialog(null)} onMoved={load} />}
      {dialog?.type === 'rename' && dialog.item && (
        <NameModal title="Rename" label="Name" action="Save" initial={dialog.item.name} onClose={() => setDialog(null)} onSubmit={async (name) => { await drivelyService.update(dialog.item!.id, { name }); load(); }} />
      )}
      {dialog?.type === 'folder' && (
        <NameModal title="New folder" label="Folder name" action="Create" initial="Untitled folder" onClose={() => setDialog(null)} onSubmit={async (name) => { await drivelyService.create({ kind: 'folder', name, parentId }); load(); }} />
      )}
      {dialog?.type === 'delete' && dialog.item && (
        <ConfirmDialog
          title="Delete forever?"
          body={<>“{dialog.item.name}”{dialog.item.kind === 'folder' ? ' and everything inside it' : ''} will be gone for you and anyone it was shared with. You can't undo this.</>}
          confirmLabel="Delete forever"
          busyLabel="Deleting…"
          onConfirm={async () => { await drivelyService.remove(dialog.item!.id); toast.show('Deleted forever'); load(); refreshStorage(); }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
};

export default DrivelyHome;
