/**
 * Small shared helpers for the Hub: labels for enums, date and size formatting, mention parsing.
 */
import type { BadgeTone } from './ui/Badge';
import type {
  AttentionLevel,
  ContentStatus,
  CredentialEnvironment,
  HubTab,
  ProductStatus,
  TicketPriority,
  TicketStatus,
  TicketType,
  UpdateType,
} from '../../services/hub.service';

export const PRODUCT_STATUS: Record<ProductStatus, { label: string; tone: BadgeTone }> = {
  live: { label: 'Live', tone: 'ok' },
  beta: { label: 'Beta', tone: 'info' },
  building: { label: 'Building', tone: 'warn' },
  paused: { label: 'Paused', tone: 'neutral' },
};
export const PRODUCT_STATUS_OPTIONS = (Object.keys(PRODUCT_STATUS) as ProductStatus[]).map((k) => ({
  value: k,
  label: PRODUCT_STATUS[k].label,
}));

export const UPDATE_TYPE: Record<UpdateType, { label: string; tone: BadgeTone }> = {
  progress: { label: 'Progress', tone: 'info' },
  release: { label: 'Release', tone: 'ok' },
  heads_up: { label: 'Heads-up', tone: 'warn' },
  blocker: { label: 'Blocker', tone: 'crit' },
  question: { label: 'Question', tone: 'neutral' },
};
export const UPDATE_TYPE_OPTIONS = (Object.keys(UPDATE_TYPE) as UpdateType[]).map((k) => ({
  value: k,
  label: UPDATE_TYPE[k].label,
}));

export const TICKET_TYPE: Record<TicketType, { label: string; tone: BadgeTone }> = {
  bug: { label: 'Bug', tone: 'crit' },
  feature: { label: 'Feature', tone: 'info' },
  request: { label: 'Client request', tone: 'warn' },
  task: { label: 'Task', tone: 'neutral' },
};
export const TICKET_PRIORITY: Record<TicketPriority, { label: string; icon: 'up' | 'minus' | 'down' }> = {
  high: { label: 'High', icon: 'up' },
  medium: { label: 'Medium', icon: 'minus' },
  low: { label: 'Low', icon: 'down' },
};
export const TICKET_STATUS: Record<TicketStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  in_review: 'In review',
  done: 'Done',
};
export const CONTENT_STATUS: Record<ContentStatus, { label: string; tone: BadgeTone }> = {
  not_started: { label: 'Not started', tone: 'warn' },
  in_progress: { label: 'In progress', tone: 'info' },
  done: { label: 'Done', tone: 'ok' },
  not_needed: { label: 'Not needed', tone: 'neutral' },
};
export const CREDENTIAL_ENV: Record<CredentialEnvironment, string> = {
  production: 'Production',
  staging: 'Staging',
  demo: 'Demo',
};
export const ATTENTION_TONE: Record<AttentionLevel, 'crit' | 'warn' | 'info'> = {
  critical: 'crit',
  warning: 'warn',
  info: 'info',
};

export const HUB_TABS: { key: HubTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'updates', label: 'Updates' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'sops', label: 'SOPs' },
  { key: 'demo-accounts', label: 'Demo accounts' },
  { key: 'vault', label: 'Vault' },
  { key: 'files', label: 'Files & links' },
  { key: 'team', label: 'Team' },
];

export const productPath = (slug: string, tab?: HubTab | string, query?: string) =>
  `/products/${encodeURIComponent(slug)}${tab && tab !== 'overview' ? `/${tab}` : ''}${query ? `?${query}` : ''}`;

/* ---------- dates ---------- */

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Parses "YYYY-MM-DD" as a local date (not UTC), anything else with Date. */
export function parseDate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(value);
}

/** Whole days from today until `date` (negative when it's in the past). */
export function daysUntil(date: string): number {
  const d = parseDate(date.length > 10 ? date.slice(0, 10) : date);
  return Math.round((d.getTime() - startOfToday().getTime()) / 864e5);
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = parseDate(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "just now", "5 min ago", "3 h ago", "Yesterday", "4 Nov", "4 Nov 2025". */
export function when(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff >= 0 && diff < 60) return 'just now';
  if (diff >= 0 && diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff >= 0 && diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff >= 0 && diff < 172800) return 'Yesterday';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-GB', sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fullDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Today as YYYY-MM-DD (local). */
export function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ---------- sizes ---------- */

export function fmtSize(bytes: number | null | undefined): string {
  if (bytes == null) return '';
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

/* ---------- people ---------- */

export function initials(name: string | null | undefined): string {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  return (parts.map((w) => w[0]).join('').slice(0, 2) || '?').toUpperCase();
}

/** Stable 0–4 color slot from an id. */
export function colorSlot(id: string | null | undefined): number {
  const s = String(id || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 5;
}

/* ---------- mentions: @Name[[USER_ID:uuid]] ---------- */

export const MENTION_RE = /@([^[\]@\n]+?)\[\[USER_ID:([^\]]+)\]\]/g;

export function extractMentions(text: string | null | undefined): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  const seen: Record<string, true> = {};
  const re = new RegExp(MENTION_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(text || ''))) !== null) {
    if (!seen[m[2]]) {
      seen[m[2]] = true;
      out.push({ name: m[1], id: m[2] });
    }
  }
  return out;
}

export function stripMentions(text: string | null | undefined): string {
  return String(text || '').replace(new RegExp(MENTION_RE.source, 'g'), '@$1');
}

/** "Ana", "Ana and Marco", "Ana, Marco and Lea". */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/* ---------- validation ---------- */

export const isValidUrl = (v: string) => /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v.trim()) || /^https?:\/\/localhost(:\d+)?(\/\S*)?$/i.test(v.trim());
export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const isValidDomain = (v: string) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(v.trim());
