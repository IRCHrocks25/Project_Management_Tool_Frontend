/**
 * Where a comment points. Doc comments remember the words and what surrounds them rather than a position, so they
 * find their place again after edits around them, and work for people who can't write to the shared document.
 */
export interface TextAnchor {
  type: 'text';
  tabId: string;
  quote: string;
  prefix: string;
  suffix: string;
  offset: number;
}

export interface PdfRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PdfAnchor {
  type: 'pdf';
  page: number;
  quote: string;
  rects: PdfRect[];
}

export type CommentAnchor = TextAnchor | PdfAnchor;

const CONTEXT = 32;

export function makeTextAnchor(text: string, start: number, end: number, tabId: string): TextAnchor {
  return {
    type: 'text',
    tabId,
    quote: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT), start),
    suffix: text.slice(end, end + CONTEXT),
    offset: start,
  };
}

/** How many characters match, walking from the end of `a` and the start of `b` respectively. */
const sameEnd = (a: string, b: string) => {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n += 1;
  return n;
};
const sameStart = (a: string, b: string) => {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n += 1;
  return n;
};

/**
 * Finds the quote again. If it appears more than once, the copy with the most matching text around it wins, then the
 * one nearest its old place. Null means the words are gone: the comment stays, but has nothing to highlight.
 */
export function findTextAnchor(text: string, anchor: Pick<TextAnchor, 'quote' | 'prefix' | 'suffix' | 'offset'>): [number, number] | null {
  if (!anchor.quote) return null;
  let best: number | null = null;
  let bestScore = -1;
  let bestDistance = Infinity;
  let at = text.indexOf(anchor.quote);
  while (at !== -1) {
    const score = sameEnd(anchor.prefix, text.slice(Math.max(0, at - anchor.prefix.length), at)) + sameStart(anchor.suffix, text.slice(at + anchor.quote.length, at + anchor.quote.length + anchor.suffix.length));
    const distance = Math.abs(at - anchor.offset);
    if (score > bestScore || (score === bestScore && distance < bestDistance)) {
      best = at;
      bestScore = score;
      bestDistance = distance;
    }
    at = text.indexOf(anchor.quote, at + 1);
  }
  return best === null ? null : [best, best + anchor.quote.length];
}

/**
 * Turns on-screen selection boxes into fractions of the page, so a highlight holds at any zoom. Boxes outside the
 * page are dropped, and pieces of the same line are joined so a highlight doesn't look striped.
 */
export function rectsOnPage(boxes: { left: number; top: number; width: number; height: number }[], page: { left: number; top: number; width: number; height: number }): PdfRect[] {
  const rects: PdfRect[] = [];
  const sorted = boxes
    .filter((b) => b.width > 0.5 && b.height > 0.5 && b.left < page.left + page.width && b.left + b.width > page.left && b.top < page.top + page.height && b.top + b.height > page.top)
    .map((b) => ({ x: (b.left - page.left) / page.width, y: (b.top - page.top) / page.height, w: b.width / page.width, h: b.height / page.height }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  for (const r of sorted) {
    const last = rects[rects.length - 1];
    if (last && Math.abs(last.y - r.y) < last.h / 2 && r.x <= last.x + last.w + 0.01) {
      last.w = Math.max(last.w, r.x + r.w - last.x);
      last.h = Math.max(last.h, r.h);
    } else rects.push({ ...r });
  }
  return rects;
}
