/** Pure helpers for Drively file content: blank files, card previews, names and sizes. */
import { DriveItem, DriveKind, DrivePreview } from '../../services/drively.service';

export const SLIDE_W = 960;
export const SLIDE_H = 540;

export type SlideElementType = 'text' | 'image' | 'shape';
export type ShapeKind = 'rect' | 'round' | 'ellipse' | 'triangle' | 'line' | 'arrow';

export interface SlideElement {
  id: string;
  type: SlideElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Text boxes and shapes. Plain text; line breaks with \n. */
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  bullets?: boolean;
  placeholder?: string;
  shape?: ShapeKind;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Images: `src` is filled by the server on load from `assetId`. */
  assetId?: string;
  src?: string | null;
}

export interface Slide {
  id: string;
  background?: string;
  notes?: string;
  elements: SlideElement[];
}

export interface SlidesContent {
  themeId: string;
  slides: Slide[];
}

export interface SlideTheme {
  id: string;
  name: string;
  background: string;
  title: string;
  body: string;
  accent: string;
  font: string;
}

export const SLIDE_THEMES: SlideTheme[] = [
  { id: 'plain', name: 'Plain', background: '#ffffff', title: '#111111', body: '#374151', accent: '#0f766e', font: 'Arial' },
  { id: 'teal', name: 'Teal', background: '#0f766e', title: '#ffffff', body: '#e6fffb', accent: '#fbbf24', font: 'Arial' },
  { id: 'night', name: 'Night', background: '#111827', title: '#f9fafb', body: '#d1d5db', accent: '#2dd4bf', font: 'Arial' },
  { id: 'paper', name: 'Paper', background: '#ffffff', title: '#7c2d12', body: '#44403c', accent: '#b45309', font: 'Georgia' },
  { id: 'forest', name: 'Forest', background: '#14532d', title: '#f0fdf4', body: '#dcfce7', accent: '#fde047', font: 'Verdana' },
];

export const themeById = (id: string) => SLIDE_THEMES.find((t) => t.id === id) || SLIDE_THEMES[0];

let counter = 0;
export const newId = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export type SlideLayout = 'title' | 'content' | 'section' | 'two' | 'blank';
export const SLIDE_LAYOUTS: { id: SlideLayout; label: string }[] = [
  { id: 'title', label: 'Title slide' },
  { id: 'content', label: 'Title and text' },
  { id: 'section', label: 'Section header' },
  { id: 'two', label: 'Two columns' },
  { id: 'blank', label: 'Blank' },
];

export function makeSlide(layout: SlideLayout, theme: SlideTheme): Slide {
  const box = (over: Partial<SlideElement>): SlideElement => ({
    id: newId(),
    type: 'text',
    x: 60,
    y: 40,
    w: 840,
    h: 100,
    text: '',
    fontFamily: theme.font,
    fontSize: 24,
    color: theme.body,
    align: 'left',
    valign: 'top',
    ...over,
  });
  const title = (over: Partial<SlideElement>) =>
    box({ fontSize: 36, bold: true, color: theme.title, placeholder: 'Click to add title', valign: 'middle', ...over });
  const body = (over: Partial<SlideElement>) => box({ placeholder: 'Click to add text', bullets: true, ...over });
  const elements: Record<SlideLayout, SlideElement[]> = {
    title: [
      title({ y: 170, h: 120, fontSize: 48, align: 'center' }),
      box({ y: 300, h: 70, align: 'center', fontSize: 24, placeholder: 'Click to add subtitle', valign: 'middle' }),
    ],
    content: [title({ h: 90 }), body({ y: 140, h: 350 })],
    section: [title({ y: 200, h: 140, fontSize: 44, align: 'center' })],
    two: [title({ h: 90 }), body({ y: 140, w: 400, h: 350 }), body({ x: 500, y: 140, w: 400, h: 350 })],
    blank: [],
  };
  return { id: newId(), elements: elements[layout] };
}

export function blankContent(kind: DriveKind): any {
  if (kind === 'doc') return { type: 'doc', content: [{ type: 'paragraph' }] };
  if (kind === 'grid') return { sheets: [{ name: 'Sheet1', id: newId(), status: 1, order: 0, celldata: [], row: 100, column: 26 }] };
  if (kind === 'slides') return { themeId: 'plain', slides: [makeSlide('title', SLIDE_THEMES[0])] } as SlidesContent;
  return {};
}

const textOf = (node: any): string => {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  return Array.isArray(node.content) ? node.content.map(textOf).join(node.type === 'doc' ? '\n' : '') : '';
};

/** A small sample drawn on the file's card, so people recognise it without opening it. */
export function previewFor(kind: DriveKind, content: any): DrivePreview | null {
  if (kind === 'doc') {
    const lines: { t: string; h?: boolean }[] = [];
    for (const block of content?.content || []) {
      const t = textOf(block).trim();
      if (t) lines.push({ t: t.slice(0, 140), h: block.type === 'heading' || undefined });
      if (lines.length >= 12) break;
    }
    return { lines };
  }
  if (kind === 'grid') {
    const cells: any[] = content?.sheets?.[0]?.celldata || [];
    const rows: string[][] = [];
    for (const c of cells) {
      if (c.r >= 12 || c.c >= 7) continue;
      const v = c.v?.m ?? c.v?.v ?? (typeof c.v === 'string' || typeof c.v === 'number' ? c.v : '');
      if (v === '' || v === null || v === undefined) continue;
      (rows[c.r] = rows[c.r] || [])[c.c] = String(v).slice(0, 24);
    }
    return { rows: Array.from({ length: Math.max(rows.length, 1) }, (_, i) => Array.from({ length: 7 }, (_u, j) => rows[i]?.[j] || '')) };
  }
  if (kind === 'slides') {
    const deck = content as SlidesContent;
    const first = deck?.slides?.[0];
    if (!first) return null;
    const theme = themeById(deck.themeId);
    return {
      slide: {
        bg: first.background || theme.background,
        els: first.elements.slice(0, 12).map((e) => ({
          x: e.x,
          y: e.y,
          w: e.w,
          h: e.h,
          t: (e.text || '').slice(0, 80) || undefined,
          c: e.color,
          s: e.fontSize,
          f: e.type === 'image' ? '#d4d4d4' : e.fill,
          shape: e.type === 'shape' ? e.shape : undefined,
        })),
      },
    };
  }
  return null;
}

export const KIND_LABELS: Record<DriveKind, string> = {
  folder: 'Folder',
  doc: 'Document',
  grid: 'Grid',
  slides: 'Presentation',
  pdf: 'PDF',
  file: 'File',
};

export function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const n = bytes / 1024 ** i;
  return `${n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
}

export type OfficeTarget = 'doc' | 'grid' | 'slides';

/** Word, Excel and PowerPoint uploads can become an editable file. */
export function officeTarget(item: Pick<DriveItem, 'name'>): OfficeTarget | null {
  const name = item.name.toLowerCase();
  if (name.endsWith('.docx')) return 'doc';
  if (name.endsWith('.xlsx')) return 'grid';
  if (name.endsWith('.pptx')) return 'slides';
  return null;
}

export const stripExtension = (name: string) => name.replace(/\.[a-zA-Z0-9]{1,8}$/, '') || name;

/** Turns a file name into something safe to download, with the given extension. */
export const exportName = (name: string, ext: string) => `${stripExtension(name).replace(/[\\/:*?"<>|]+/g, '-')}.${ext}`;

/**
 * Browsers only allow a new tab during the click itself, so a file that still has to be created opens a blank tab
 * first, then sends it to the file with sendTab. It's null when the browser blocked the tab.
 */
export const blankTab = (): Window | null => {
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  return tab;
};

export const sendTab = (tab: Window | null, href: string, fallback: (href: string) => void) => {
  if (tab) tab.location.href = href;
  else fallback(href);
};

/** Where a person goes to open an item. */
export const itemHref = (item: Pick<DriveItem, 'id' | 'kind'>) =>
  item.kind === 'folder' ? `/drively/folders/${item.id}` : `/drively/d/${item.id}`;
