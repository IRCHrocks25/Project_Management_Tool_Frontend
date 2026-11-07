import { findTextAnchor, makeTextAnchor, rectsOnPage } from './commentAnchors';

describe('finding a highlighted passage again', () => {
  const text = 'The price is fair. The price is high. The price is low.';

  it('finds an untouched passage', () => {
    const anchor = makeTextAnchor(text, 19, 36, 't');
    expect(anchor.quote).toBe('The price is high');
    expect(findTextAnchor(text, anchor)).toEqual([19, 36]);
  });

  it('picks the right copy when the same words repeat', () => {
    const second = makeTextAnchor(text, 19, 31, 't');
    expect(second.quote).toBe('The price is');
    expect(findTextAnchor(text, second)).toEqual([19, 31]);
    const third = makeTextAnchor(text, 38, 50, 't');
    expect(findTextAnchor(text, third)).toEqual([38, 50]);
  });

  it('follows the passage when text is added before it', () => {
    const anchor = makeTextAnchor(text, 19, 31, 't');
    const edited = `A new opening paragraph.\n${text}`;
    expect(findTextAnchor(edited, anchor)).toEqual([44, 56]);
  });

  it('gives up when the words are gone', () => {
    const anchor = makeTextAnchor(text, 19, 36, 't');
    expect(findTextAnchor('Completely rewritten.', anchor)).toBeNull();
  });

  it('ignores an empty quote rather than matching everywhere', () => {
    expect(findTextAnchor(text, { quote: '', prefix: '', suffix: '', offset: 0 })).toBeNull();
  });

  it('prefers the nearest copy when the surroundings tell nothing', () => {
    expect(findTextAnchor('aa bb aa', { quote: 'aa', prefix: '', suffix: '', offset: 6 })).toEqual([6, 8]);
  });
});

describe('PDF highlight boxes', () => {
  const page = { left: 100, top: 100, width: 200, height: 400 };

  it('become fractions of the page', () => {
    expect(rectsOnPage([{ left: 100, top: 200, width: 100, height: 40 }], page)).toEqual([{ x: 0, y: 0.25, w: 0.5, h: 0.1 }]);
  });

  it('join pieces of one line and keep separate lines apart', () => {
    const rects = rectsOnPage(
      [
        { left: 100, top: 200, width: 50, height: 20 },
        { left: 150, top: 200, width: 50, height: 20 },
        { left: 100, top: 240, width: 50, height: 20 },
      ],
      page,
    );
    expect(rects).toHaveLength(2);
    expect(rects[0].w).toBeCloseTo(0.5);
  });

  it('drop boxes on another page or with no size', () => {
    expect(rectsOnPage([{ left: 100, top: 900, width: 50, height: 20 }, { left: 120, top: 200, width: 0, height: 20 }], page)).toEqual([]);
  });
});
