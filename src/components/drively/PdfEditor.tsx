/**
 * PDF: read, search and mark up a PDF, and rearrange, rotate, delete or merge pages.
 * Edits are kept as a list of pages and marks until Save, when they're written into a new PDF that replaces
 * the file in Iceberg. Iceberg keeps the previous bytes as an archived version.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { canEditLevel, DriveDetail, drivelyService, fetchDriveBytes, saveBlob } from '../../services/drively.service';
import { hubErrorMessage, hubErrorStatus } from '../../services/hub.service';
import EmptyState from '../hub/ui/EmptyState';
import Icon from '../hub/ui/Icon';
import OverflowMenu from '../hub/ui/OverflowMenu';
import { Skeleton } from '../hub/ui/Skeleton';
import { useToast } from '../hub/ui/Toast';
import { exportName, newId } from './driveContent';
import { PdfAnchor, PdfRect, rectsOnPage } from './commentAnchors';
import { SelectionCommentButton, useDriveComments } from './DriveComments';
import EditorShell from './EditorShell';
import type { PdfMark, PdfPageRef } from './pdfBake';

pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ''}/vendor/pdf.worker.min.js`;

// isEvalSupported off: fonts in an untrusted PDF must never become executable code.
const openPdf = (data: Uint8Array) => pdfjs.getDocument({ data: data.slice(0), isEvalSupported: false }).promise;

type Tool = 'select' | 'text' | 'highlight' | 'whiteout' | 'draw';
const TOOLS: { id: Tool; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'text', label: 'Add text' },
  { id: 'highlight', label: 'Highlight' },
  { id: 'draw', label: 'Draw' },
  { id: 'whiteout', label: 'White out' },
];
const COLORS = ['#111111', '#b91c1c', '#b45309', '#15803d', '#0f766e'];
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const HIGHLIGHT = '#fde047';

const Canvas: React.FC<{ doc: PDFDocumentProxy; index: number; rotation: number; scale: number; className?: string; onSize?: (w: number, h: number) => void; textLayer?: boolean; query?: string }> = ({ doc, index, rotation, scale, className, onSize, textLayer, query }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const sizeRef = useRef(onSize);
  sizeRef.current = onSize;

  useEffect(() => {
    let stop = false;
    doc.getPage(index + 1).then((page) => {
      if (stop) return;
      const v = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
      sizeRef.current?.(v.width, v.height);
    });
    return () => {
      stop = true;
    };
  }, [doc, index, rotation, scale]);

  // Long PDFs would stall the browser if every page drew at once.
  useEffect(() => {
    const el = host.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !canvas.current) return undefined;
    let task: any;
    let textTask: any;
    let cancelled = false;
    doc.getPage(index + 1).then(async (page) => {
      if (cancelled || !canvas.current) return;
      const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const c = canvas.current;
      c.width = Math.floor(viewport.width * ratio);
      c.height = Math.floor(viewport.height * ratio);
      c.style.width = `${viewport.width}px`;
      c.style.height = `${viewport.height}px`;
      task = page.render({ canvasContext: c.getContext('2d') as CanvasRenderingContext2D, viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined });
      await task.promise.catch(() => undefined);
      if (textLayer && text.current && !cancelled) {
        const layer = text.current;
        layer.innerHTML = '';
        layer.style.setProperty('--scale-factor', String(scale));
        textTask = pdfjs.renderTextLayer({ textContentSource: page.streamTextContent(), container: layer, viewport });
        await textTask.promise.catch(() => undefined);
        markMatches(layer, query);
      }
    });
    return () => {
      cancelled = true;
      task?.cancel?.();
      textTask?.cancel?.();
    };
    // `query` has its own effect below, so a search doesn't redraw the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, index, rotation, scale, visible, textLayer]);

  useEffect(() => {
    if (text.current) markMatches(text.current, query);
  }, [query]);

  return (
    <div className={className} ref={host}>
      <canvas ref={canvas} />
      {textLayer && <div className="textLayer" ref={text} />}
    </div>
  );
};

function markMatches(layer: HTMLElement, query?: string) {
  const q = (query || '').trim().toLowerCase();
  layer.querySelectorAll('span').forEach((s) => s.classList.toggle('drv-pdf-hit', !!q && !!s.textContent?.toLowerCase().includes(q)));
}

const PdfEditor: React.FC<{ item: DriveDetail }> = ({ item }) => {
  const toast = useToast();
  const canEdit = canEditLevel(item.myAccess);
  const comments = useDriveComments(item);
  const [areaMode, setAreaMode] = useState(false);
  const [areaDraft, setAreaDraft] = useState<{ pageId: string; rect: PdfRect } | null>(null);
  const [sources, setSources] = useState<{ bytes: Uint8Array; doc: PDFDocumentProxy }[] | null>(null);
  const [pages, setPages] = useState<PdfPageRef[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState(COLORS[0]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(item.revision);
  const [selectedMark, setSelectedMark] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [draft, setDraft] = useState<{ pageId: string; mark: PdfMark } | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<number[] | null>(null);
  const [conflict, setConflict] = useState(false);
  const mergeInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const dragPage = useRef<number | null>(null);

  const pagesFor = useCallback((source: number, doc: PDFDocumentProxy): PdfPageRef[] =>
    Array.from({ length: doc.numPages }, (_, index) => ({ id: newId(), source, index, rotation: 0, marks: [] })), []);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const bytes = new Uint8Array(await fetchDriveBytes(item.id));
        const doc = await openPdf(bytes);
        if (!live) return;
        setSources([{ bytes, doc }]);
        setPages(pagesFor(0, doc));
      } catch (err: any) {
        if (!live) return;
        setLoadError(err?.name === 'PasswordException' ? 'This PDF is protected with a password, so it can only be downloaded.' : "This PDF couldn't be opened. It may be damaged.");
      }
    })();
    return () => {
      live = false;
    };
  }, [item.id, pagesFor]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const change = (next: PdfPageRef[]) => {
    setPages(next);
    setDirty(true);
  };
  const updatePage = (id: string, patch: (p: PdfPageRef) => PdfPageRef) => change(pages.map((p) => (p.id === id ? patch(p) : p)));
  const addMark = (pageId: string, mark: PdfMark) => updatePage(pageId, (p) => ({ ...p, marks: [...p.marks, mark] }));
  const patchMark = (pageId: string, id: string, patch: Partial<PdfMark>) =>
    updatePage(pageId, (p) => ({ ...p, marks: p.marks.map((m) => (m.id === id ? ({ ...m, ...patch } as PdfMark) : m)) }));
  const removeMark = (pageId: string, id: string) => updatePage(pageId, (p) => ({ ...p, marks: p.marks.filter((m) => m.id !== id) }));

  const removePage = (id: string) => {
    if (pages.length === 1) return toast.error('A PDF needs at least one page.');
    change(pages.filter((p) => p.id !== id));
    return undefined;
  };
  const movePage = (from: number, to: number) => {
    if (from === to || to < 0 || to >= pages.length) return;
    const next = [...pages];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    change(next);
  };
  const scrollToPage = (id: string) => pagesRef.current?.querySelector(`[data-page="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  /* ---------------- files ---------------- */

  const bake = async () => {
    const { bakePdf } = await import('./pdfBake');
    return bakePdf(sources!.map((s) => s.bytes), pages);
  };

  const save = async () => {
    if (!sources) return;
    setSaving(true);
    try {
      const bytes = await bake();
      const saved = await drivelyService.replace(item.id, new File([bytes], item.name, { type: 'application/pdf' }), revision);
      const doc = await openPdf(bytes);
      setSources([{ bytes, doc }]);
      setPages(pagesFor(0, doc));
      setRevision(saved.revision);
      setDirty(false);
      setSelectedMark(null);
      toast.show('PDF saved');
    } catch (err: any) {
      if (hubErrorStatus(err) === 409) setConflict(true);
      else if (/encrypted/i.test(err?.message || '')) toast.error('This PDF is protected, so it can be read but not changed.');
      else toast.error(hubErrorMessage(err, "Couldn't save the PDF."));
    } finally {
      setSaving(false);
    }
  };

  const download = async () => {
    try {
      const bytes = dirty ? await bake() : sources ? sources[0].bytes : new Uint8Array(await fetchDriveBytes(item.id));
      saveBlob(new Blob([bytes], { type: 'application/pdf' }), exportName(item.name, 'pdf'));
    } catch {
      toast.error("Couldn't create the file.");
    }
  };

  const extract = async () => {
    const page = pages[activePage];
    if (!page || !sources) return;
    try {
      const { bakePdf } = await import('./pdfBake');
      const bytes = await bakePdf(sources.map((s) => s.bytes), [page]);
      const made = await drivelyService.upload(new File([bytes], `${exportName(item.name, '').slice(0, -1)} page ${activePage + 1}.pdf`, { type: 'application/pdf' }), item.parentId);
      toast.show(`Saved as “${made.name}”`);
    } catch (err) {
      toast.error(hubErrorMessage(err, "Couldn't split out that page."));
    }
  };

  const merge = async (file: File) => {
    if (!sources) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = await openPdf(bytes);
      const source = sources.length;
      setSources([...sources, { bytes, doc }]);
      change([...pages, ...pagesFor(source, doc)]);
      toast.show(`Added ${doc.numPages} ${doc.numPages === 1 ? 'page' : 'pages'}. Save to keep them.`);
    } catch {
      toast.error("That PDF couldn't be read.");
    }
  };

  const addBlankPage = async () => {
    if (!sources) return;
    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.create();
    pdf.addPage([595.28, 841.89]);
    const bytes = await pdf.save();
    const doc = await openPdf(bytes);
    const source = sources.length;
    setSources([...sources, { bytes, doc }]);
    const next = [...pages];
    next.splice(activePage + 1, 0, ...pagesFor(source, doc));
    change(next);
  };

  const placeImage = async (file: File) => {
    const page = pages[activePage];
    if (!page) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) return void toast.error('Use a PNG or JPG picture.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const url = URL.createObjectURL(file);
    const size = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = url;
    });
    const shown = sizes[page.id] || { w: 600, h: 800 };
    const w = 0.35;
    const h = (w * shown.w * (size.h / size.w)) / shown.h;
    addMark(page.id, { id: newId(), type: 'image', x: 0.1, y: 0.1, w, h, bytes, mime: file.type, url });
    setTool('select');
  };

  const search = async (q: string) => {
    setQuery(q);
    if (!q.trim() || !sources) return setHits(null);
    const needle = q.trim().toLowerCase();
    const found: number[] = [];
    for (let i = 0; i < pages.length; i++) {
      const page = await sources[pages[i].source].doc.getPage(pages[i].index + 1);
      const text = await page.getTextContent();
      if (text.items.map((t: any) => t.str || '').join(' ').toLowerCase().includes(needle)) found.push(i);
    }
    setHits(found);
    if (found.length) scrollToPage(pages[found[0]].id);
    return undefined;
  };

  /* ---------------- drawing on a page ---------------- */

  /** For scanned pages and pictures, which have no text to select: drag a box and comment on it. */
  const startArea = (e: React.PointerEvent<HTMLDivElement>, page: PdfPageRef) => {
    e.preventDefault();
    const box = e.currentTarget.getBoundingClientRect();
    const spot = (ev: { clientX: number; clientY: number }): [number, number] => [
      Math.min(1, Math.max(0, (ev.clientX - box.left) / box.width)),
      Math.min(1, Math.max(0, (ev.clientY - box.top) / box.height)),
    ];
    const [sx, sy] = spot(e);
    const rectTo = (ev: { clientX: number; clientY: number }): PdfRect => {
      const [x, y] = spot(ev);
      return { x: Math.min(sx, x), y: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy) };
    };
    const move = (ev: PointerEvent) => setAreaDraft({ pageId: page.id, rect: rectTo(ev) });
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const rect = rectTo(ev);
      setAreaDraft(null);
      setAreaMode(false);
      if (rect.w > 0.01 && rect.h > 0.01) comments.startDraft({ type: 'pdf', page: pages.findIndex((p) => p.id === page.id), quote: '', rects: [rect] });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const buildAnchor = (range: Range): PdfAnchor | null => {
    const start = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
    const el = start?.closest<HTMLElement>('[data-page]');
    if (!el) return null;
    const page = pages.findIndex((p) => p.id === el.dataset.page);
    const rects = rectsOnPage(Array.from(range.getClientRects()), el.getBoundingClientRect());
    return page >= 0 && rects.length ? { type: 'pdf', page, quote: range.toString().replace(/\s+/g, ' ').trim().slice(0, 2000), rects } : null;
  };

  const { data: commentData, activeId: activeComment, setActiveId: setActiveComment, setMissing } = comments;
  const pdfThreads = (commentData?.threads || []).filter((t) => t.anchor?.type === 'pdf');
  const pageCount = pages.length;
  useEffect(() => {
    if (!pageCount) return;
    setMissing(new Set((commentData?.threads || []).filter((t) => t.anchor?.type === 'pdf' && t.anchor.page >= pageCount).map((t) => t.id)));
  }, [commentData, pageCount, setMissing]);
  useEffect(() => {
    if (activeComment) pagesRef.current?.querySelector(`[data-comment-id="${activeComment}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeComment]);

  const startOnPage = (e: React.PointerEvent<HTMLDivElement>, page: PdfPageRef) => {
    setActivePage(pages.findIndex((p) => p.id === page.id));
    if (areaMode) return startArea(e, page);
    if (!canEdit || tool === 'select') {
      if (e.target === e.currentTarget) setSelectedMark(null);
      return;
    }
    const box = e.currentTarget.getBoundingClientRect();
    const pos = (ev: { clientX: number; clientY: number }): [number, number] => [
      Math.min(1, Math.max(0, (ev.clientX - box.left) / box.width)),
      Math.min(1, Math.max(0, (ev.clientY - box.top) / box.height)),
    ];
    const [sx, sy] = pos(e);
    if (tool === 'text') {
      e.preventDefault();
      const id = newId();
      addMark(page.id, { id, type: 'text', x: sx, y: sy, text: '', size: 14, color });
      setSelectedMark(id);
      setTool('select');
      return;
    }
    e.preventDefault();
    const id = newId();
    const points: [number, number][] = [[sx, sy]];
    let current: PdfMark =
      tool === 'draw'
        ? { id, type: 'draw', points, color, width: 2 }
        : { id, type: tool, x: sx, y: sy, w: 0, h: 0, color: tool === 'highlight' ? HIGHLIGHT : undefined };
    setDraft({ pageId: page.id, mark: current });
    const move = (ev: PointerEvent) => {
      const [x, y] = pos(ev);
      if (current.type === 'draw') {
        points.push([x, y]);
        current = { ...current, points: [...points] };
      } else if (current.type === 'highlight' || current.type === 'whiteout') {
        current = { ...current, x: Math.min(sx, x), y: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy) };
      }
      setDraft({ pageId: page.id, mark: current });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDraft(null);
      const tiny = current.type !== 'draw' && 'w' in current && current.w < 0.005 && current.h < 0.003;
      if (!tiny && !(current.type === 'draw' && points.length < 2)) addMark(page.id, current);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const dragMark = (e: React.PointerEvent, page: PdfPageRef, mark: PdfMark, box: HTMLElement) => {
    if (!canEdit || tool !== 'select' || mark.type === 'draw') return;
    e.stopPropagation();
    setSelectedMark(mark.id);
    const rect = box.getBoundingClientRect();
    const start = { px: e.clientX, py: e.clientY, x: mark.x, y: mark.y };
    const move = (ev: PointerEvent) => {
      patchMark(page.id, mark.id, { x: start.x + (ev.clientX - start.px) / rect.width, y: start.y + (ev.clientY - start.py) / rect.height });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const MarkView = (page: PdfPageRef, mark: PdfMark, draftMark = false) => {
    const pct = (n: number) => `${n * 100}%`;
    if (mark.type === 'draw') {
      return (
        <svg key={mark.id} className="drv-pdf-ink" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={mark.points.map(([x, y]) => `${x * 1000},${y * 1000}`).join(' ')} fill="none" stroke={mark.color} strokeWidth={mark.width * zoom} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    const on = selectedMark === mark.id;
    const common = {
      className: `drv-pdf-mark${on ? ' drv-pdf-mark-on' : ''}`,
      onPointerDown: draftMark ? undefined : (e: React.PointerEvent<HTMLDivElement>) => dragMark(e, page, mark, e.currentTarget.parentElement as HTMLElement),
    };
    const remove = on && canEdit && (
      <button type="button" className="drv-pdf-x" aria-label="Remove" onPointerDown={(e) => e.stopPropagation()} onClick={() => removeMark(page.id, mark.id)}><Icon name="x" size={12} /></button>
    );
    if (mark.type === 'text') {
      return (
        <div key={mark.id} {...common} style={{ left: pct(mark.x), top: pct(mark.y) }}>
          <textarea
            autoFocus={!mark.text}
            aria-label="Text on the page"
            rows={Math.max(1, mark.text.split('\n').length)}
            cols={Math.max(8, ...mark.text.split('\n').map((l) => l.length + 1))}
            readOnly={!canEdit}
            style={{ color: mark.color, fontSize: mark.size * zoom }}
            value={mark.text}
            onFocus={() => setSelectedMark(mark.id)}
            onChange={(e) => patchMark(page.id, mark.id, { text: e.target.value })}
            onBlur={() => !mark.text.trim() && removeMark(page.id, mark.id)}
            placeholder="Type here"
          />
          {remove}
        </div>
      );
    }
    const style = { left: pct(mark.x), top: pct(mark.y), width: pct(mark.w), height: pct(mark.h) };
    if (mark.type === 'image') {
      return (
        <div key={mark.id} {...common} style={style}>
          <img src={mark.url} alt="" draggable={false} />
          {remove}
          {on && canEdit && (
            <span
              className="drv-pdf-resize"
              onPointerDown={(e) => {
                e.stopPropagation();
                const rect = (e.currentTarget.parentElement?.parentElement as HTMLElement).getBoundingClientRect();
                const ratio = (mark.h * rect.height) / (mark.w * rect.width);
                const start = { px: e.clientX, w: mark.w };
                const move = (ev: PointerEvent) => {
                  const w = Math.max(0.03, start.w + (ev.clientX - start.px) / rect.width);
                  patchMark(page.id, mark.id, { w, h: (w * rect.width * ratio) / rect.height });
                };
                const up = () => {
                  window.removeEventListener('pointermove', move);
                  window.removeEventListener('pointerup', up);
                };
                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', up);
              }}
            />
          )}
        </div>
      );
    }
    return (
      <div key={mark.id} {...common} style={{ ...style, background: mark.type === 'whiteout' ? '#ffffff' : mark.color, opacity: mark.type === 'whiteout' ? 1 : 0.4 }}>
        {remove}
      </div>
    );
  };

  const actions = (
    <>
      {canEdit && sources && (
        <button type="button" className="hub-btn hub-btn-primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
      )}
      <OverflowMenu
        label="File actions"
        triggerLabel="File"
        size="md"
        items={[
          { label: 'Download', icon: 'download', onSelect: download },
          { label: 'Print', icon: 'file', hidden: !sources, onSelect: () => window.print() },
          { label: 'Add pages from another PDF', icon: 'plus', hidden: !canEdit, onSelect: () => mergeInput.current?.click() },
          { label: 'Add a blank page', icon: 'plus', hidden: !canEdit, onSelect: addBlankPage },
          { label: 'Save current page as a new PDF', icon: 'copy', hidden: !canEdit, onSelect: extract },
        ]}
      />
    </>
  );

  if (loadError) {
    return (
      <EditorShell item={item} actions={<button type="button" className="hub-btn" onClick={download}><Icon name="download" size={15} /> Download</button>}>
        <EmptyState icon="alert" title="Can't show this PDF" text={loadError} />
      </EditorShell>
    );
  }

  return (
    <EditorShell item={item} actions={actions} comments={comments}>
      {conflict && (
        <div className="drv-note drv-note-warn drv-conflict" role="alert">
          Someone else saved this PDF, so yours wasn't saved. Download your copy first if you need it, then reload.
          <button type="button" className="hub-btn hub-btn-sm" onClick={() => window.location.reload()}>Reload latest</button>
        </div>
      )}
      <div className="drv-toolbar" role="toolbar" aria-label="PDF tools">
        {canEdit && TOOLS.map((t) => (
          <button key={t.id} type="button" className={`hub-btn hub-btn-sm ${tool === t.id ? 'drv-tool-on' : 'hub-btn-ghost'}`} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>{t.label}</button>
        ))}
        {canEdit && <button type="button" className="hub-btn hub-btn-ghost hub-btn-sm" onClick={() => imageInput.current?.click()}>Picture or signature</button>}
        {canEdit && (
          <div className="drv-tb-colors" role="group" aria-label="Pen and text colour">
            {COLORS.map((c) => <button key={c} type="button" aria-label={c} aria-pressed={color === c} className={color === c ? 'drv-color-on' : ''} style={{ background: c }} onClick={() => setColor(c)} />)}
          </div>
        )}
        <span className="drv-tb-sep" />
        <select className="drv-tb-sel drv-tb-num" aria-label="Zoom" value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
          {ZOOMS.map((z) => <option key={z} value={z}>{Math.round(z * 100)}%</option>)}
        </select>
        <div className="drv-pdf-find">
          <Icon name="search" size={14} />
          <input type="search" aria-label="Find in PDF" placeholder="Find in PDF" value={query} onChange={(e) => search(e.target.value)} />
          {hits && <span className="drv-muted">{hits.length ? `${hits.length} ${hits.length === 1 ? 'page' : 'pages'}` : 'No matches'}</span>}
        </div>
        {commentData?.canComment && (
          <button type="button" className={`hub-btn hub-btn-sm ${areaMode ? 'drv-tool-on' : 'hub-btn-ghost'}`} aria-pressed={areaMode} title="For scanned pages and pictures. To comment on text, select it." onClick={() => setAreaMode((on) => !on)}>
            {areaMode ? 'Drag over the page…' : 'Comment on an area'}
          </button>
        )}
        {dirty && <span className="drv-save">Unsaved changes</span>}
      </div>
      {!sources ? (
        <div className="drv-loading"><Skeleton height={500} /></div>
      ) : (
        <div className="drv-pdf">
          <nav className="drv-thumbs" aria-label="Pages">
            {pages.map((p, i) => (
              <div
                key={p.id}
                className={`drv-thumb${i === activePage ? ' drv-thumb-on' : ''}${hits?.includes(i) ? ' drv-thumb-hit' : ''}`}
                draggable={canEdit}
                onDragStart={() => { dragPage.current = i; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragPage.current !== null) movePage(dragPage.current, i);
                  dragPage.current = null;
                }}
              >
                <span className="drv-thumb-n">{i + 1}</span>
                <button type="button" className="drv-thumb-btn drv-thumb-pdf" aria-label={`Page ${i + 1}`} aria-current={i === activePage} onClick={() => { setActivePage(i); scrollToPage(p.id); }}>
                  <Canvas doc={sources[p.source].doc} index={p.index} rotation={p.rotation} scale={0.22} />
                </button>
                {canEdit && (
                  <span className="drv-thumb-more">
                    <OverflowMenu
                      label={`Actions for page ${i + 1}`}
                      items={[
                        { label: 'Rotate right', icon: 'refresh', onSelect: () => updatePage(p.id, (x) => ({ ...x, rotation: (x.rotation + 90) % 360 })) },
                        { label: 'Rotate left', icon: 'restore', onSelect: () => updatePage(p.id, (x) => ({ ...x, rotation: (x.rotation + 270) % 360 })) },
                        { label: 'Move up', icon: 'up', disabled: i === 0, onSelect: () => movePage(i, i - 1) },
                        { label: 'Move down', icon: 'down', disabled: i === pages.length - 1, onSelect: () => movePage(i, i + 1) },
                        { label: 'Delete page', icon: 'trash', danger: true, onSelect: () => removePage(p.id) },
                      ]}
                    />
                  </span>
                )}
              </div>
            ))}
          </nav>
          <div className="drv-pdf-pages" ref={pagesRef}>
            {pages.map((p, pageIndex) => {
              const size = sizes[`${p.id}:${zoom}:${p.rotation}`];
              return (
                <div
                  key={p.id}
                  data-page={p.id}
                  className={`drv-pdf-page drv-cursor-${areaMode ? 'area' : canEdit ? tool : 'select'}`}
                  style={size ? { width: size.w, height: size.h } : undefined}
                  onPointerDown={(e) => startOnPage(e, p)}
                >
                  <Canvas
                    doc={sources[p.source].doc}
                    index={p.index}
                    rotation={p.rotation}
                    scale={zoom * 1.33}
                    textLayer
                    query={query}
                    className="drv-pdf-canvas"
                    onSize={(w, h) => {
                      setSizes((s) => (s[`${p.id}:${zoom}:${p.rotation}`]?.w === w && s[p.id]?.w === w ? s : { ...s, [`${p.id}:${zoom}:${p.rotation}`]: { w, h }, [p.id]: { w, h } }));
                    }}
                  />
                  <div className={`drv-pdf-overlay${tool === 'select' ? ' drv-pdf-overlay-pass' : ''}`}>
                    {p.marks.map((m) => MarkView(p, m))}
                    {draft?.pageId === p.id && MarkView(p, draft.mark, true)}
                  </div>
                  {pdfThreads.filter((t) => !t.resolvedAt && (t.anchor as PdfAnchor).page === pageIndex).flatMap((t) =>
                    (t.anchor as PdfAnchor).rects.map((r, n) => (
                      <div
                        key={`${t.id}:${n}`}
                        role="button"
                        aria-label="Open this comment"
                        data-comment-id={n === 0 ? t.id : undefined}
                        className={`drv-pdf-cmt${t.id === activeComment ? ' drv-pdf-cmt-on' : ''}`}
                        style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => {
                          setActiveComment(t.id);
                          comments.setOpen(true);
                        }}
                      />
                    )),
                  )}
                  {areaDraft?.pageId === p.id && (
                    <div className="drv-pdf-area" style={{ left: `${areaDraft.rect.x * 100}%`, top: `${areaDraft.rect.y * 100}%`, width: `${areaDraft.rect.w * 100}%`, height: `${areaDraft.rect.h * 100}%` }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {commentData?.canComment && !areaMode && <SelectionCommentButton container={pagesRef} build={buildAnchor} onComment={comments.startDraft} />}
      <input ref={mergeInput} type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) merge(f); }} />
      <input ref={imageInput} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) placeImage(f); }} />
    </EditorShell>
  );
};

export default PdfEditor;
