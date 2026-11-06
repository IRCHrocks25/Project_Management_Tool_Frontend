import { blankContent, exportName, formatBytes, itemHref, makeSlide, officeTarget, previewFor, SLIDE_THEMES, stripExtension } from './driveContent';

describe('previewFor', () => {
  it('takes the first text blocks of a document and marks headings', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', content: [{ type: 'text', text: 'Plan' }] },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'First ' }, { type: 'text', text: 'line' }] },
      ],
    };
    expect(previewFor('doc', doc)).toEqual({ lines: [{ t: 'Plan', h: true }, { t: 'First line' }] });
  });

  it('draws grid cells at their positions, ignoring those off the card', () => {
    const grid = { sheets: [{ celldata: [{ r: 1, c: 1, v: { v: 5, m: '$5.00' } }, { r: 50, c: 0, v: { v: 'x' } }] }] };
    const { rows } = previewFor('grid', grid)!;
    expect(rows).toHaveLength(2);
    expect(rows![1][1]).toBe('$5.00');
  });

  it('copes with blank content', () => {
    expect(previewFor('doc', {})).toEqual({ lines: [] });
    expect(previewFor('slides', {})).toBeNull();
    expect(previewFor('folder', {})).toBeNull();
  });

  it('summarises the first slide', () => {
    const preview = previewFor('slides', blankContent('slides'))!;
    expect(preview.slide!.els.length).toBeGreaterThan(0);
  });
});

it('builds each slide layout with fresh ids and the theme colours', () => {
  const theme = SLIDE_THEMES[1];
  const a = makeSlide('two', theme);
  const b = makeSlide('two', theme);
  expect(a.elements).toHaveLength(3);
  expect(a.id).not.toBe(b.id);
  expect(a.elements[0].color).toBe(theme.title);
  expect(makeSlide('blank', theme).elements).toEqual([]);
});

it('formats sizes', () => {
  expect(formatBytes(0)).toBe('—');
  expect(formatBytes(512)).toBe('512 B');
  expect(formatBytes(1536)).toBe('1.5 KB');
  expect(formatBytes(150 * 1024 * 1024)).toBe('150 MB');
});

it('recognises Office files that can become editable', () => {
  expect(officeTarget({ name: 'A.DOCX' })).toBe('doc');
  expect(officeTarget({ name: 'b.xlsx' })).toBe('grid');
  expect(officeTarget({ name: 'c.pptx' })).toBe('slides');
  expect(officeTarget({ name: 'd.pdf' })).toBeNull();
});

it('makes safe export names', () => {
  expect(stripExtension('report.final.pdf')).toBe('report.final');
  expect(exportName('Q4: a/b?.docx', 'pdf')).toBe('Q4- a-b-.pdf');
});

it('links folders and files to the right screen', () => {
  expect(itemHref({ id: '1', kind: 'folder' })).toBe('/drively/folders/1');
  expect(itemHref({ id: '1', kind: 'doc' })).toBe('/drively/d/1');
});
