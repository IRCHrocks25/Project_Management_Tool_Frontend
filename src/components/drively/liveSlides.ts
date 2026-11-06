/** Slides in the live document. Each element merges on its own, so two people can work on one slide. */
import * as Y from 'yjs';
import { resolveSrc } from './driveAssets';
import { Slide, SlideElement, SlidesContent } from './driveContent';

const metaOf = (doc: Y.Doc) => doc.getMap<string>('deckMeta');
const orderOf = (doc: Y.Doc) => doc.getArray<string>('deckOrder');
const slidesOf = (doc: Y.Doc) => doc.getMap<Y.Map<any>>('deckSlides');

export const slideScopes = (doc: Y.Doc) => [metaOf(doc), orderOf(doc), slidesOf(doc)];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Writes only what differs, so concurrent changes to other elements survive. */
export function writeDeck(doc: Y.Doc, deck: SlidesContent, origin: unknown) {
  doc.transact(() => {
    const meta = metaOf(doc);
    if (meta.get('themeId') !== deck.themeId) meta.set('themeId', deck.themeId);
    const ids = deck.slides.map((s) => s.id);
    const order = orderOf(doc);
    if (!same(order.toArray(), ids)) {
      order.delete(0, order.length);
      order.insert(0, ids);
    }
    const slides = slidesOf(doc);
    Array.from(slides.keys()).forEach((id) => {
      if (!ids.includes(id)) slides.delete(id);
    });
    deck.slides.forEach((slide) => {
      let y = slides.get(slide.id);
      if (!y) {
        y = new Y.Map();
        y.set('elements', new Y.Map());
        slides.set(slide.id, y);
      }
      if ((y.get('background') ?? null) !== (slide.background ?? null)) y.set('background', slide.background ?? null);
      if ((y.get('notes') ?? '') !== (slide.notes ?? '')) y.set('notes', slide.notes ?? '');
      const els = y.get('elements') as Y.Map<SlideElement>;
      const elIds = slide.elements.map((e) => e.id);
      if (!same(y.get('elOrder'), elIds)) y.set('elOrder', elIds);
      Array.from(els.keys()).forEach((id) => {
        if (!elIds.includes(id)) els.delete(id);
      });
      slide.elements.forEach((e) => {
        const existing = els.get(e.id);
        // What's on screen uses a fresh link; the stored one stays, so a link refresh isn't an edit.
        const next = plain(e.assetId && existing ? { ...e, src: existing.src } : e);
        if (!same(existing, next)) els.set(e.id, next);
      });
    });
  }, origin);
}

export function readDeck(doc: Y.Doc): SlidesContent {
  const slides = slidesOf(doc);
  const seen = new Set<string>();
  const out: Slide[] = [];
  orderOf(doc)
    .toArray()
    .forEach((id) => {
      const y = slides.get(id);
      if (!y || seen.has(id)) return;
      seen.add(id);
      const els = y.get('elements') as Y.Map<SlideElement>;
      const elOrder: string[] = y.get('elOrder') || [];
      const ordered = [...elOrder.filter((e) => els.has(e)), ...Array.from(els.keys()).filter((e) => !elOrder.includes(e))];
      const slide: Slide = {
        id,
        notes: y.get('notes') || undefined,
        elements: ordered.map((e) => {
          const el = els.get(e) as SlideElement;
          return el.assetId ? { ...el, src: resolveSrc(el.assetId, el.src) } : { ...el };
        }),
      };
      if (y.get('background')) slide.background = y.get('background');
      out.push(slide);
    });
  return { themeId: metaOf(doc).get('themeId') || 'plain', slides: out };
}
