/**
 * Slides: thumbnails on the left, the slide on a canvas, speaker notes below. Elements move, resize and
 * edit in place; Present goes full screen. People edit together live, and each element merges on its own. All coordinates are in slide pixels (960 x 540) and the view scales.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { canEditLevel, DriveDetail, drivelyService, saveBlob } from '../../services/drively.service';
import { hubErrorMessage } from '../../services/hub.service';
import Icon from '../hub/ui/Icon';
import OverflowMenu from '../hub/ui/OverflowMenu';
import { useToast } from '../hub/ui/Toast';
import {
  exportName,
  makeSlide,
  newId,
  ShapeKind,
  Slide,
  SlideElement,
  SlideLayout,
  SLIDE_H,
  SLIDE_LAYOUTS,
  SLIDE_THEMES,
  SLIDE_W,
  SlidesContent,
  themeById,
} from './driveContent';
import EmptyState from '../hub/ui/EmptyState';
import { Skeleton } from '../hub/ui/Skeleton';
import { setAssetLink, setAssetLinks } from './driveAssets';
import { useDriveComments } from './DriveComments';
import { LiveDoc, useLiveDoc, useLivePreview } from './driveLive';
import EditorShell from './EditorShell';
import { readDeck, slideScopes, writeDeck } from './liveSlides';

const LOCAL = 'slides-local';

const FONTS = ['Arial', 'Georgia', 'Verdana', 'Times New Roman', 'Courier New', 'Trebuchet MS', 'DM Sans'];
const SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 44, 54, 66, 80];
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type Handle = (typeof HANDLES)[number];
const MIN_SIZE = 12;

const normalizeDeck = (content: any): SlidesContent => {
  if (content?.slides?.length) return { themeId: content.themeId || 'plain', slides: content.slides };
  return { themeId: 'plain', slides: [makeSlide('title', SLIDE_THEMES[0])] };
};

const ShapeSvg: React.FC<{ e: SlideElement }> = ({ e }) => {
  const stroke = e.stroke || e.fill || '#111111';
  const sw = e.strokeWidth ?? 1;
  const fill = e.fill || 'none';
  const common = { stroke, strokeWidth: sw, fill, vectorEffect: 'non-scaling-stroke' as const };
  const w = Math.max(e.w, 1);
  const h = Math.max(e.h, 1);
  return (
    <svg className="drv-shape" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {e.shape === 'ellipse' && <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - sw / 2} ry={h / 2 - sw / 2} {...common} />}
      {e.shape === 'rect' && <rect x={sw / 2} y={sw / 2} width={w - sw} height={h - sw} {...common} />}
      {e.shape === 'round' && <rect x={sw / 2} y={sw / 2} width={w - sw} height={h - sw} rx={Math.min(w, h) * 0.12} {...common} />}
      {e.shape === 'triangle' && <polygon points={`${w / 2},${sw} ${w - sw},${h - sw} ${sw},${h - sw}`} {...common} />}
      {e.shape === 'line' && <line x1={0} y1={h / 2} x2={w} y2={h / 2} {...common} fill="none" />}
      {e.shape === 'arrow' && (
        <>
          <line x1={0} y1={h / 2} x2={w - 12} y2={h / 2} {...common} fill="none" />
          <polygon points={`${w},${h / 2} ${w - 14},${h / 2 - 7} ${w - 14},${h / 2 + 7}`} fill={stroke} />
        </>
      )}
    </svg>
  );
};

const textStyle = (e: SlideElement): React.CSSProperties => ({
  fontFamily: e.fontFamily,
  fontSize: e.fontSize,
  fontWeight: e.bold ? 700 : 400,
  fontStyle: e.italic ? 'italic' : 'normal',
  textDecoration: e.underline ? 'underline' : 'none',
  color: e.color,
  textAlign: e.align || 'left',
  justifyContent: e.valign === 'middle' ? 'center' : e.valign === 'bottom' ? 'flex-end' : 'flex-start',
});

const TextBody: React.FC<{ e: SlideElement; showPlaceholder?: boolean }> = ({ e, showPlaceholder }) => {
  const text = e.text || '';
  if (!text) return showPlaceholder && e.placeholder ? <span className="drv-sl-ph">{e.placeholder}</span> : null;
  if (e.bullets) return <ul className="drv-sl-ul">{text.split('\n').map((l, i) => <li key={i}>{l || ' '}</li>)}</ul>;
  return <>{text}</>;
};

/** Draws a slide with no editing: thumbnails, presenting, PDF export. */
const SlideView: React.FC<{ slide: Slide; themeId: string; scale?: number; innerRef?: React.Ref<HTMLDivElement> }> = React.memo(({ slide, themeId, scale = 1, innerRef }) => {
  const theme = themeById(themeId);
  return (
    <div className="drv-sl" ref={innerRef} style={{ background: slide.background || theme.background, transform: `scale(${scale})` }}>
      {slide.elements.map((e) => (
        <div key={e.id} className="drv-el" style={{ left: e.x, top: e.y, width: e.w, height: e.h }}>
          {e.type === 'shape' && <ShapeSvg e={e} />}
          {e.type === 'image' && (e.src ? <img src={e.src} alt="" crossOrigin="anonymous" className="drv-el-img" /> : <div className="drv-el-missing">Picture</div>)}
          {(e.type === 'text' || e.text) && <div className="drv-el-text" style={textStyle(e)}><div><TextBody e={e} /></div></div>}
        </div>
      ))}
    </div>
  );
});

const Present: React.FC<{ deck: SlidesContent; start: number; onClose: () => void }> = ({ deck, start, onClose }) => {
  const [i, setI] = useState(start);
  const [scale, setScale] = useState(1);
  const host = useRef<HTMLDivElement>(null);
  const last = deck.slides.length - 1;

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / SLIDE_W, window.innerHeight / SLIDE_H));
    fit();
    window.addEventListener('resize', fit);
    host.current?.requestFullscreen?.().catch(() => undefined);
    const onFs = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('resize', fit);
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    };
  }, [onClose]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(e.key)) setI((n) => Math.min(n + 1, last));
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) setI((n) => Math.max(n - 1, 0));
      else if (e.key === 'Home') setI(0);
      else if (e.key === 'End') setI(last);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [last, onClose]);

  return (
    <div className="drv-present" ref={host} onClick={() => setI((n) => Math.min(n + 1, last))}>
      <div className="drv-present-stage" style={{ width: SLIDE_W * scale, height: SLIDE_H * scale }}>
        <SlideView key={deck.slides[i].id} slide={deck.slides[i]} themeId={deck.themeId} scale={scale} />
      </div>
      <div className="drv-present-bar" onClick={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Previous slide" disabled={i === 0} onClick={() => setI(i - 1)}>‹</button>
        <span>{i + 1} / {deck.slides.length}</span>
        <button type="button" aria-label="Next slide" disabled={i === last} onClick={() => setI(i + 1)}>›</button>
        <button type="button" onClick={onClose}>Exit</button>
      </div>
    </div>
  );
};

const SlidesEditor: React.FC<{ item: DriveDetail }> = ({ item }) => {
  useMemo(() => setAssetLinks(item.assetLinks), [item.assetLinks]);
  const live = useLiveDoc(item, (doc) => writeDeck(doc, normalizeDeck(item.content), LOCAL));
  if (live.removed) return <div className="drv-loading"><EmptyState icon="alert" title="You no longer have access to this file" text="It may have been moved to the trash, or its owner changed who can open it." /></div>;
  if (live.failed) return <div className="drv-loading"><EmptyState icon="alert" title="Couldn't open this file" text="The file storage didn't answer. Try again in a moment." /></div>;
  if (!live.synced || readDeck(live.doc).slides.length === 0) return <div className="drv-loading"><Skeleton height={44} /><Skeleton height={420} /></div>;
  return <SlidesWorkspace item={item} live={live} />;
};

const SlidesWorkspace: React.FC<{ item: DriveDetail; live: LiveDoc }> = ({ item, live }) => {
  const toast = useToast();
  const canEdit = canEditLevel(live.level);
  const comments = useDriveComments(item);
  const shownItem = useMemo(() => ({ ...item, myAccess: live.level }), [item, live.level]);
  const [deck, setDeckState] = useState<SlidesContent>(() => readDeck(live.doc));
  const deckRef = useRef(deck);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [scale, setScale] = useState(1);
  const [exporting, setExporting] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const exportHost = useRef<HTMLDivElement>(null);
  // Only takes back this person's own changes, whatever others did since.
  const undoManager = useMemo(() => new Y.UndoManager(slideScopes(live.doc), { trackedOrigins: new Set([LOCAL]), captureTimeout: 400 }), [live.doc]);
  const clipboard = useRef<SlideElement | null>(null);
  const dragSlide = useRef<number | null>(null);

  useLivePreview(live, item.id, 'slides', () => deckRef.current);

  useEffect(() => {
    const onUpdate = (_u: Uint8Array, origin: unknown) => {
      if (origin === LOCAL) return;
      const next = readDeck(live.doc);
      if (!next.slides.length) return;
      deckRef.current = next;
      setDeckState(next);
    };
    live.doc.on('update', onUpdate);
    return () => {
      live.doc.off('update', onUpdate);
      undoManager.destroy();
    };
  }, [live.doc, undoManager]);

  const slide = deck.slides[Math.min(current, deck.slides.length - 1)];
  const element = slide.elements.find((e) => e.id === selected) || null;
  const theme = themeById(deck.themeId);

  /** Every change goes through here. Quick repeats, like the frames of a drag, undo as one step. */
  const setDeck = useCallback(
    (next: SlidesContent, _record = true) => {
      if (!canEdit) return;
      writeDeck(live.doc, next, LOCAL);
      deckRef.current = next;
      setDeckState(next);
    },
    [canEdit, live.doc],
  );

  const patchSlide = useCallback(
    (patch: Partial<Slide>, record = true) => {
      const d = deckRef.current;
      setDeck({ ...d, slides: d.slides.map((s, i) => (i === Math.min(current, d.slides.length - 1) ? { ...s, ...patch } : s)) }, record);
    },
    [current, setDeck],
  );

  const patchElement = useCallback(
    (id: string, patch: Partial<SlideElement>, record = true) => {
      const d = deckRef.current;
      const at = Math.min(current, d.slides.length - 1);
      patchSlide({ elements: d.slides[at].elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }, record);
    },
    [current, patchSlide],
  );

  const addElement = (e: Omit<SlideElement, 'id'>) => {
    const made = { ...e, id: newId() } as SlideElement;
    patchSlide({ elements: [...slide.elements, made] });
    setSelected(made.id);
    return made;
  };

  const removeElement = useCallback(
    (id: string) => {
      const d = deckRef.current;
      patchSlide({ elements: d.slides[Math.min(current, d.slides.length - 1)].elements.filter((e) => e.id !== id) });
      setSelected(null);
      setEditing(null);
    },
    [current, patchSlide],
  );

  const undo = useCallback(() => {
    undoManager.undo();
    setSelected(null);
  }, [undoManager]);

  const redo = useCallback(() => {
    undoManager.redo();
    setSelected(null);
  }, [undoManager]);

  /* ---------------- slides ---------------- */

  const addSlide = (layout: SlideLayout) => {
    const made = makeSlide(layout, theme);
    const slides = [...deck.slides];
    slides.splice(current + 1, 0, made);
    setDeck({ ...deck, slides });
    setCurrent(current + 1);
    setSelected(null);
  };

  const duplicateSlide = (i: number) => {
    const source = deck.slides[i];
    const copy: Slide = { ...source, id: newId(), elements: source.elements.map((e) => ({ ...e, id: newId() })) };
    const slides = [...deck.slides];
    slides.splice(i + 1, 0, copy);
    setDeck({ ...deck, slides });
    setCurrent(i + 1);
  };

  const deleteSlide = (i: number) => {
    if (deck.slides.length === 1) return toast.error('A presentation needs at least one slide.');
    setDeck({ ...deck, slides: deck.slides.filter((_, n) => n !== i) });
    setCurrent(Math.max(0, i >= deck.slides.length - 1 ? i - 1 : i));
    setSelected(null);
    return undefined;
  };

  const moveSlide = (from: number, to: number) => {
    if (from === to || to < 0 || to >= deck.slides.length) return;
    const slides = [...deck.slides];
    const [moved] = slides.splice(from, 1);
    slides.splice(to, 0, moved);
    setDeck({ ...deck, slides });
    setCurrent(to);
  };

  const applyTheme = (id: string) => {
    const next = themeById(id);
    const old = theme;
    const recolor = (c?: string) => (c === old.title ? next.title : c === old.body ? next.body : c);
    setDeck({
      themeId: id,
      slides: deck.slides.map((s) => ({
        ...s,
        background: s.background === old.background ? undefined : s.background,
        elements: s.elements.map((e) => (e.type === 'text' ? { ...e, color: recolor(e.color), fontFamily: e.fontFamily === old.font ? next.font : e.fontFamily } : e)),
      })),
    });
  };

  /* ---------------- pictures ---------------- */

  const addPicture = async (file: File) => {
    try {
      const { assetId, src } = await drivelyService.addImage(item.id, file, file.name);
      setAssetLink(assetId, src);
      const size = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ w: 400, h: 300 });
        img.src = src;
      });
      const ratio = Math.min(1, 600 / size.w, 400 / size.h);
      const w = size.w * ratio;
      const h = size.h * ratio;
      addElement({ type: 'image', x: (SLIDE_W - w) / 2, y: (SLIDE_H - h) / 2, w, h, assetId, src });
    } catch (err) {
      toast.error(hubErrorMessage(err, "Couldn't add the picture."));
    }
  };

  /* ---------------- pointer ---------------- */

  const startMove = (e: React.PointerEvent, target: SlideElement) => {
    if (!canEdit || editing === target.id) return;
    e.stopPropagation();
    // A click on an empty box or on one already selected starts typing, as "Click to add title" promises.
    const typeOnClick = target.type !== 'image' && (selected === target.id || (target.type === 'text' && !target.text));
    setSelected(target.id);
    setEditing(null);
    const start = { px: e.clientX, py: e.clientY, x: target.x, y: target.y };
    let recorded = false;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.px) / scale;
      const dy = (ev.clientY - start.py) / scale;
      if (!recorded && Math.abs(dx) + Math.abs(dy) < 3) return;
      patchElement(target.id, { x: Math.round(start.x + dx), y: Math.round(start.y + dy) }, !recorded);
      recorded = true;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!recorded && typeOnClick) setEditing(target.id);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startResize = (e: React.PointerEvent, target: SlideElement, h: Handle) => {
    e.stopPropagation();
    const start = { px: e.clientX, py: e.clientY, x: target.x, y: target.y, w: target.w, h: target.h };
    const ratio = target.w / Math.max(target.h, 1);
    let recorded = false;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.px) / scale;
      const dy = (ev.clientY - start.py) / scale;
      let { x, y, w, h: height } = start;
      if (h.includes('e')) w = Math.max(MIN_SIZE, start.w + dx);
      if (h.includes('s')) height = Math.max(MIN_SIZE, start.h + dy);
      if (h.includes('w')) {
        w = Math.max(MIN_SIZE, start.w - dx);
        x = start.x + start.w - w;
      }
      if (h.includes('n')) {
        height = Math.max(MIN_SIZE, start.h - dy);
        y = start.y + start.h - height;
      }
      // Corners of a picture keep its shape.
      if (target.type === 'image' && h.length === 2) {
        height = w / ratio;
        if (h.includes('n')) y = start.y + start.h - height;
      }
      patchElement(target.id, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(height) }, !recorded);
      recorded = true;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /* ---------------- keyboard and layout ---------------- */

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = editing || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName);
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (typing || !canEdit) return;
      if (!element) {
        if (e.key === 'PageDown') setCurrent((c) => Math.min(c + 1, deck.slides.length - 1));
        if (e.key === 'PageUp') setCurrent((c) => Math.max(c - 1, 0));
        if (mod && e.key.toLowerCase() === 'v' && clipboard.current) {
          e.preventDefault();
          addElement({ ...clipboard.current, x: clipboard.current.x + 20, y: clipboard.current.y + 20 });
        }
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeElement(element.id);
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        patchElement(element.id, {
          x: element.x + (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0),
          y: element.y + (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0),
        });
      } else if (e.key === 'Enter' && element.type !== 'image') {
        e.preventDefault();
        setEditing(element.id);
      } else if (e.key === 'Escape') {
        setSelected(null);
      } else if (mod && e.key.toLowerCase() === 'c') {
        clipboard.current = element;
      } else if (mod && e.key.toLowerCase() === 'v' && clipboard.current) {
        e.preventDefault();
        addElement({ ...clipboard.current, x: clipboard.current.x + 20, y: clipboard.current.y + 20 });
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        addElement({ ...element, x: element.x + 20, y: element.y + 20 });
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
    // addElement only reads state already listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, deck.slides.length, editing, element, patchElement, redo, removeElement, undo]);

  useLayoutEffect(() => {
    const host = stage.current;
    if (!host) return undefined;
    const fit = () => setScale(Math.min((host.clientWidth - 48) / SLIDE_W, (host.clientHeight - 48) / SLIDE_H, 1.6));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  /* ---------------- export ---------------- */

  const download = async (type: 'pptx' | 'pdf') => {
    setExporting(true);
    try {
      const convert = await import('./slidesConvert');
      if (type === 'pptx') saveBlob(await convert.slidesToPptx(deckRef.current), exportName(item.name, 'pptx'));
      else {
        await new Promise((r) => setTimeout(r, 200)); // Let the off-screen slides draw.
        const nodes = Array.from(exportHost.current?.querySelectorAll<HTMLElement>('.drv-sl') || []);
        saveBlob(await convert.slideElementsToPdf(nodes), exportName(item.name, 'pdf'));
      }
    } catch {
      toast.error("Couldn't create the file.");
    } finally {
      setExporting(false);
    }
  };

  const actions = (
    <>
      <OverflowMenu
        label="File actions"
        triggerLabel="File"
        size="md"
        items={[
          { label: 'Download as PowerPoint', icon: 'download', onSelect: () => download('pptx') },
          { label: 'Download as PDF', icon: 'download', onSelect: () => download('pdf') },
        ]}
      />
      <button type="button" className="hub-btn" onClick={() => { setSelected(null); setPresenting(true); }}>Present</button>
    </>
  );

  const textControls = element && element.type !== 'image';
  const shapeControls = element && element.type === 'shape';
  const addShape = (shape: ShapeKind) =>
    addElement({
      type: 'shape',
      shape,
      x: 340,
      y: 190,
      w: 280,
      h: shape === 'line' || shape === 'arrow' ? 30 : 160,
      fill: shape === 'line' || shape === 'arrow' ? undefined : theme.accent,
      stroke: shape === 'line' || shape === 'arrow' ? theme.title : theme.accent,
      strokeWidth: 2,
      text: '',
      color: '#ffffff',
      fontFamily: theme.font,
      fontSize: 20,
      align: 'center',
      valign: 'middle',
    });

  const shapeItems = useMemo(
    () =>
      ([['rect', 'Rectangle'], ['round', 'Rounded rectangle'], ['ellipse', 'Circle'], ['triangle', 'Triangle'], ['line', 'Line'], ['arrow', 'Arrow']] as [ShapeKind, string][]).map(([s, label]) => ({ label, onSelect: () => addShape(s) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slide, theme],
  );

  return (
    <EditorShell item={shownItem} status={canEdit ? live.status : undefined} peers={live.peers} actions={actions} comments={comments}>
      {canEdit && (
        <div className="drv-toolbar" role="toolbar" aria-label="Slide tools">
          <OverflowMenu label="New slide" triggerLabel="New slide" triggerIcon="plus" items={SLIDE_LAYOUTS.map((l) => ({ label: l.label, onSelect: () => addSlide(l.id) }))} />
          <button type="button" className="drv-tb" aria-label="Undo" title="Undo" onClick={undo}>↶</button>
          <button type="button" className="drv-tb" aria-label="Redo" title="Redo" onClick={redo}>↷</button>
          <span className="drv-tb-sep" />
          <button
            type="button"
            className="hub-btn hub-btn-ghost hub-btn-sm"
            onClick={() => {
              const made = addElement({ type: 'text', x: 280, y: 220, w: 400, h: 100, text: '', placeholder: 'Type here', fontFamily: theme.font, fontSize: 24, color: theme.body, align: 'left', valign: 'top' });
              setEditing(made.id);
            }}
          >
            Text box
          </button>
          <button type="button" className="hub-btn hub-btn-ghost hub-btn-sm" onClick={() => fileInput.current?.click()}>Picture</button>
          <OverflowMenu label="Add a shape" triggerLabel="Shape" items={shapeItems} />
          <OverflowMenu label="Theme" triggerLabel="Theme" items={SLIDE_THEMES.map((t) => ({ label: `${t.name}${t.id === deck.themeId ? ' (current)' : ''}`, onSelect: () => applyTheme(t.id) }))} />
          <label className="drv-tb-color" title="Slide background">
            Background
            <input type="color" aria-label="Slide background" value={slide.background || theme.background} onChange={(e) => patchSlide({ background: e.target.value })} />
          </label>
          {textControls && (
            <>
              <span className="drv-tb-sep" />
              <select className="drv-tb-sel" aria-label="Font" value={element!.fontFamily || theme.font} onChange={(e) => patchElement(element!.id, { fontFamily: e.target.value })}>
                {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <select className="drv-tb-sel drv-tb-num" aria-label="Font size" value={Math.round(element!.fontSize || 18)} onChange={(e) => patchElement(element!.id, { fontSize: Number(e.target.value) })}>
                {(SIZES.includes(Math.round(element!.fontSize || 18)) ? SIZES : [Math.round(element!.fontSize || 18), ...SIZES]).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button type="button" className={`drv-tb${element!.bold ? ' drv-tb-on' : ''}`} aria-label="Bold" aria-pressed={!!element!.bold} onClick={() => patchElement(element!.id, { bold: !element!.bold })}><b>B</b></button>
              <button type="button" className={`drv-tb${element!.italic ? ' drv-tb-on' : ''}`} aria-label="Italic" aria-pressed={!!element!.italic} onClick={() => patchElement(element!.id, { italic: !element!.italic })}><i>I</i></button>
              <button type="button" className={`drv-tb${element!.underline ? ' drv-tb-on' : ''}`} aria-label="Underline" aria-pressed={!!element!.underline} onClick={() => patchElement(element!.id, { underline: !element!.underline })}><u>U</u></button>
              <label className="drv-tb-color" title="Text colour">A<input type="color" aria-label="Text colour" value={element!.color || '#111111'} onChange={(e) => patchElement(element!.id, { color: e.target.value })} /></label>
              <select className="drv-tb-sel" aria-label="Alignment" value={element!.align || 'left'} onChange={(e) => patchElement(element!.id, { align: e.target.value as SlideElement['align'] })}>
                <option value="left">Left</option>
                <option value="center">Centre</option>
                <option value="right">Right</option>
              </select>
              <button type="button" className={`drv-tb${element!.bullets ? ' drv-tb-on' : ''}`} aria-label="Bullets" aria-pressed={!!element!.bullets} onClick={() => patchElement(element!.id, { bullets: !element!.bullets })}>•≡</button>
            </>
          )}
          {shapeControls && (
            <>
              <label className="drv-tb-color" title="Fill">Fill<input type="color" aria-label="Fill colour" value={element!.fill || '#ffffff'} onChange={(e) => patchElement(element!.id, { fill: e.target.value })} /></label>
              <label className="drv-tb-color" title="Line">Line<input type="color" aria-label="Line colour" value={element!.stroke || '#111111'} onChange={(e) => patchElement(element!.id, { stroke: e.target.value })} /></label>
            </>
          )}
          {element && (
            <>
              <span className="drv-tb-sep" />
              <OverflowMenu
                label="Arrange"
                triggerLabel="Arrange"
                items={[
                  { label: 'Bring to front', onSelect: () => patchSlide({ elements: [...slide.elements.filter((e) => e.id !== element.id), element] }) },
                  { label: 'Send to back', onSelect: () => patchSlide({ elements: [element, ...slide.elements.filter((e) => e.id !== element.id)] }) },
                  { label: 'Duplicate', onSelect: () => addElement({ ...element, x: element.x + 20, y: element.y + 20 }) },
                ]}
              />
              <button type="button" className="drv-tb" aria-label="Delete" title="Delete" onClick={() => removeElement(element.id)}><Icon name="trash" size={15} /></button>
            </>
          )}
        </div>
      )}
      <div className="drv-slides">
        <nav className="drv-thumbs" aria-label="Slides">
          {deck.slides.map((s, i) => (
            <div
              key={s.id}
              className={`drv-thumb${i === current ? ' drv-thumb-on' : ''}`}
              draggable={canEdit}
              onDragStart={() => { dragSlide.current = i; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragSlide.current !== null) moveSlide(dragSlide.current, i);
                dragSlide.current = null;
              }}
            >
              <span className="drv-thumb-n">{i + 1}</span>
              <button type="button" className="drv-thumb-btn" aria-label={`Slide ${i + 1}`} aria-current={i === current} onClick={() => { setCurrent(i); setSelected(null); setEditing(null); }}>
                <SlideView slide={s} themeId={deck.themeId} scale={160 / SLIDE_W} />
              </button>
              {canEdit && (
                <span className="drv-thumb-more">
                  <OverflowMenu
                    label={`Actions for slide ${i + 1}`}
                    items={[
                      { label: 'Duplicate slide', icon: 'copy', onSelect: () => duplicateSlide(i) },
                      { label: 'Move up', icon: 'up', disabled: i === 0, onSelect: () => moveSlide(i, i - 1) },
                      { label: 'Move down', icon: 'down', disabled: i === deck.slides.length - 1, onSelect: () => moveSlide(i, i + 1) },
                      { label: 'Delete slide', icon: 'trash', danger: true, onSelect: () => deleteSlide(i) },
                    ]}
                  />
                </span>
              )}
            </div>
          ))}
        </nav>
        <div className="drv-slide-col">
          <div className="drv-stage" ref={stage} onPointerDown={() => { setSelected(null); setEditing(null); }}>
            <div className="drv-stage-box" style={{ width: SLIDE_W * scale, height: SLIDE_H * scale }}>
              <div className="drv-sl" style={{ background: slide.background || theme.background, transform: `scale(${scale})` }}>
                {slide.elements.map((e) => (
                  <div
                    key={e.id}
                    className={`drv-el${selected === e.id ? ' drv-el-on' : ''}`}
                    style={{ left: e.x, top: e.y, width: e.w, height: e.h }}
                    onPointerDown={(ev) => startMove(ev, e)}
                    onDoubleClick={() => canEdit && e.type !== 'image' && setEditing(e.id)}
                  >
                    {e.type === 'shape' && <ShapeSvg e={e} />}
                    {e.type === 'image' && (e.src ? <img src={e.src} alt="" draggable={false} className="drv-el-img" /> : <div className="drv-el-missing">Picture</div>)}
                    {e.type !== 'image' && editing === e.id ? (
                      <textarea
                        className="drv-el-edit"
                        autoFocus
                        aria-label="Text"
                        style={textStyle(e)}
                        value={e.text || ''}
                        placeholder={e.placeholder}
                        onPointerDown={(ev) => ev.stopPropagation()}
                        onChange={(ev) => patchElement(e.id, { text: ev.target.value })}
                        onBlur={() => setEditing(null)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Escape') {
                            ev.stopPropagation();
                            setEditing(null);
                          }
                        }}
                      />
                    ) : (
                      (e.type === 'text' || e.text) && <div className="drv-el-text" style={textStyle(e)}><div><TextBody e={e} showPlaceholder={canEdit} /></div></div>
                    )}
                    {canEdit && selected === e.id && editing !== e.id && HANDLES.map((h) => (
                      <span key={h} className={`drv-handle drv-h-${h}`} style={{ transform: `scale(${1 / scale})` }} onPointerDown={(ev) => startResize(ev, e, h)} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <label className="drv-notes">
            <span className="drv-visually-hidden">Speaker notes</span>
            <textarea placeholder={canEdit ? 'Click to add speaker notes' : 'No speaker notes'} readOnly={!canEdit} value={slide.notes || ''} onChange={(e) => patchSlide({ notes: e.target.value }, false)} />
          </label>
        </div>
      </div>
      {exporting && (
        <div className="drv-offscreen" ref={exportHost} aria-hidden="true">
          {deck.slides.map((s) => <SlideView key={s.id} slide={s} themeId={deck.themeId} />)}
        </div>
      )}
      {presenting && <Present deck={deck} start={current} onClose={() => setPresenting(false)} />}
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addPicture(f); }} />
    </EditorShell>
  );
};

export default SlidesEditor;
