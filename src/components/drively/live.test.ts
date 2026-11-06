/** @jest-environment node */
import * as Y from 'yjs';
import { makeSlide, SLIDE_THEMES, SlidesContent } from './driveContent';
import { emptyKnown, readChanges, readSheets, writeSheets } from './liveGrid';
import { readDeck, writeDeck } from './liveSlides';

const sync = (a: Y.Doc, b: Y.Doc) => {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
};

describe('live slides', () => {
  const deck = (): SlidesContent => ({ themeId: 'plain', slides: [makeSlide('two', SLIDE_THEMES[0]), makeSlide('blank', SLIDE_THEMES[0])] });

  it('reads back what was written, in order', () => {
    const doc = new Y.Doc();
    const d = deck();
    writeDeck(doc, d, 'x');
    const out = readDeck(doc);
    expect(out.slides.map((s) => s.id)).toEqual(d.slides.map((s) => s.id));
    expect(out.slides[0].elements.map((e) => e.id)).toEqual(d.slides[0].elements.map((e) => e.id));
  });

  it('merges two people changing different elements of one slide', () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    writeDeck(a, deck(), 'x');
    sync(a, b);
    const da = readDeck(a);
    const db = readDeck(b);
    da.slides[0].elements[0].text = 'from A';
    db.slides[0].elements[1].text = 'from B';
    writeDeck(a, da, 'x');
    writeDeck(b, db, 'x');
    sync(a, b);
    [a, b].forEach((doc) => {
      const els = readDeck(doc).slides[0].elements;
      expect(els[0].text).toBe('from A');
      expect(els[1].text).toBe('from B');
    });
  });

  it('removes deleted slides and writes nothing when nothing changed', () => {
    const doc = new Y.Doc();
    const d = deck();
    writeDeck(doc, d, 'x');
    let updates = 0;
    doc.on('update', () => updates++);
    writeDeck(doc, readDeck(doc), 'x');
    expect(updates).toBe(0);
    writeDeck(doc, { ...d, slides: d.slides.slice(1) }, 'x');
    expect(readDeck(doc).slides).toHaveLength(1);
  });

  it('does not count a refreshed picture link as an edit', () => {
    const doc = new Y.Doc();
    const d = deck();
    d.slides[0].elements.push({ id: 'p', type: 'image', x: 0, y: 0, w: 1, h: 1, assetId: 'a', src: 'old' });
    writeDeck(doc, d, 'x');
    let updates = 0;
    doc.on('update', () => updates++);
    const again = readDeck(doc);
    again.slides[0].elements[3].src = 'fresh';
    writeDeck(doc, again, 'x');
    expect(updates).toBe(0);
  });
});

describe('live grid', () => {
  const sheet = (celldata: any[]) => [{ id: 's1', name: 'Sheet1', order: 0, row: 100, column: 26, celldata }];

  it('sends one person’s cell to the other and keeps both', () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const ka = emptyKnown();
    const kb = emptyKnown();
    writeSheets(a, sheet([{ r: 0, c: 0, v: { v: 1 } }]), ka, 'x');
    sync(a, b);
    expect(readSheets(b, kb)[0].celldata).toEqual([{ r: 0, c: 0, v: { v: 1 } }]);

    writeSheets(a, sheet([{ r: 0, c: 0, v: { v: 1 } }, { r: 1, c: 1, v: { v: 'A' } }]), ka, 'x');
    writeSheets(b, sheet([{ r: 0, c: 0, v: { v: 1 } }, { r: 2, c: 2, v: { v: 'B' } }]), kb, 'x');
    sync(a, b);
    expect(readChanges(a, ka)).toEqual({ structure: false, cells: [{ sheetId: 's1', r: 2, c: 2, value: { v: 'B' } }] });
    expect(readChanges(b, kb)).toEqual({ structure: false, cells: [{ sheetId: 's1', r: 1, c: 1, value: { v: 'A' } }] });
  });

  it('reports a cleared cell and a new sheet', () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const ka = emptyKnown();
    const kb = emptyKnown();
    writeSheets(a, sheet([{ r: 0, c: 0, v: { v: 1 } }]), ka, 'x');
    sync(a, b);
    readSheets(b, kb);
    writeSheets(a, [...sheet([]), { id: 's2', name: 'Two', order: 1, celldata: [] }], ka, 'x');
    sync(a, b);
    expect(readChanges(b, kb)).toEqual({ structure: true, cells: [{ sheetId: 's1', r: 0, c: 0, value: null }] });
  });

  it('ignores selection and scroll, which belong to each person', () => {
    const doc = new Y.Doc();
    const known = emptyKnown();
    writeSheets(doc, sheet([]), known, 'x');
    let updates = 0;
    doc.on('update', () => updates++);
    writeSheets(doc, [{ ...sheet([])[0], status: 1, scrollTop: 40 } as any], known, 'x');
    expect(updates).toBe(0);
  });
});
