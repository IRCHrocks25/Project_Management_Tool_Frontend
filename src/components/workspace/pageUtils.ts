/**
 * Small helpers for Pages: which links are allowed, the share label on a page, and an editor-safe doc.
 */
import type { PageDetail, PageShare, PageSummary } from '../../services/workspace.service';

/** Characters a real link never contains raw. Browsers strip some of them, which is how `java\tscript:` gets through naive checks. */
const hasUnsafeChars = (url: string): boolean => {
  for (let i = 0; i < url.length; i++) {
    const c = url.charCodeAt(i);
    if (c <= 0x20 || (c >= 0x7f && c <= 0xa0) || c === 0x2028 || c === 0x2029 || c === 0xfeff) return true;
  }
  return false;
};

/**
 * The only links a page may hold: http(s), mailto, and in-app paths starting with one `/`.
 * Protocol-relative `//host` and everything else (javascript:, data:, vbscript:, ...) is rejected.
 */
export function isAllowedPageHref(url: string | null | undefined): boolean {
  if (typeof url !== 'string' || !url || hasUnsafeChars(url)) return false;
  if (url.charAt(0) === '/') return url.charAt(1) !== '/' && url.charAt(1) !== '\\';
  return /^https?:\/\/[^/\\]/i.test(url) || /^mailto:[^/\\]/i.test(url);
}

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/i;

/**
 * For autolinks, where the text is a bare `example.com` and TipTap adds the protocol itself:
 * accept that, and still refuse any other scheme.
 */
export function isAutolinkable(url: string): boolean {
  return isAllowedPageHref(url) || (!HAS_SCHEME.test(url) && !hasUnsafeChars(url));
}

/** What someone typed in the link dialog, as an allowed href; null when it can't be one. */
export function normalizeLinkInput(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (isAllowedPageHref(value)) return value;
  if (HAS_SCHEME.test(value) || hasUnsafeChars(value)) return null;
  if (/^[^@/]+@[^@/]+\.[^@/]+$/.test(value)) return `mailto:${value}`;
  if (/^[^/]+\.[^/]+/.test(value) && value.charAt(0) !== '/') return `https://${value}`;
  return null;
}

/** In-app link to a task, opened on its details tab. */
export const taskHref = (projectId: string, taskId: string): string =>
  `/project/${encodeURIComponent(projectId)}?task=${encodeURIComponent(taskId)}&tab=details`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Private", "Everyone", "Designer", "2 people", "Designer + 2 people". */
export function shareLabel(shared: PageSummary['sharedWith']): string {
  if (shared.everyone) return 'Everyone';
  const parts: string[] = [];
  if (shared.departments.length === 1) parts.push(shared.departments[0]);
  else if (shared.departments.length > 1) parts.push(`${shared.departments.length} departments`);
  if (shared.userCount > 0) parts.push(plural(shared.userCount, 'person', 'people'));
  return parts.join(' + ') || 'Private';
}

export function sharedWithFrom(shares: PageShare[]): PageSummary['sharedWith'] {
  return {
    everyone: shares.some((s) => s.kind === 'everyone'),
    departments: shares.filter((s) => s.kind === 'department' && s.target).map((s) => s.target as string),
    userCount: shares.filter((s) => s.kind === 'user').length,
  };
}

/** An empty doc would leave the editor with nowhere to type, so give it one paragraph. */
export function normalizeDoc(content: PageDetail['content']): { type: 'doc'; content: any[] } {
  if (content && content.type === 'doc' && Array.isArray(content.content) && content.content.length) return content;
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

/** The API stores a blank title as "Untitled"; the title box shows that as its placeholder. */
export const UNTITLED = 'Untitled';
export const titleForInput = (title: string): string => (title === UNTITLED ? '' : title);
