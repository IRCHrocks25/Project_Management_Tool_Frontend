import { PDFDocument, StandardFonts } from 'pdf-lib';
import { bakePdf, displayToPdf, encodable, PdfPageRef } from './pdfBake';

const makePdf = async (count: number, size: [number, number] = [200, 400]) => {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < count; i++) pdf.addPage(size);
  return pdf.save();
};
const ref = (over: Partial<PdfPageRef>): PdfPageRef => ({ id: 'p', source: 0, index: 0, rotation: 0, marks: [], ...over });

describe('displayToPdf', () => {
  // Corners of the unrotated page, seen on screen after clockwise rotation.
  it.each([
    [0, 0, 0, [0, 400]],
    [0, 1, 1, [200, 0]],
    [90, 0, 0, [0, 0]],
    [90, 1, 0, [0, 400]],
    [180, 0, 0, [200, 0]],
    [270, 0, 0, [200, 400]],
    [270, 0, 1, [0, 400]],
    [-90, 0, 0, [200, 400]],
  ])('rotation %i maps (%d, %d)', (rotation, x, y, expected) => {
    expect(displayToPdf(x, y, rotation, 200, 400)).toEqual(expected);
  });
});

describe('bakePdf', () => {
  it('reorders, deletes and merges pages from several files', async () => {
    const a = await makePdf(3, [100, 100]);
    const b = await makePdf(1, [300, 300]);
    const out = await PDFDocument.load(await bakePdf([a, b], [ref({ source: 1, index: 0 }), ref({ index: 2 }), ref({ index: 0 })]));
    expect(out.getPages().map((p) => p.getSize().width)).toEqual([300, 100, 100]);
  });

  it('adds rotation to what the page already has', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([100, 100]).setRotation({ type: 'degrees', angle: 90 } as any);
    const out = await PDFDocument.load(await bakePdf([await pdf.save()], [ref({ rotation: 90 })]));
    expect(out.getPage(0).getRotation().angle).toBe(180);
  });

  it('bakes every kind of mark on a rotated page without failing', async () => {
    const marks: PdfPageRef['marks'] = [
      { id: '1', type: 'text', x: 0.1, y: 0.1, text: 'Hello\nWorld 你好', size: 12, color: '#111111' },
      { id: '2', type: 'highlight', x: 0.1, y: 0.2, w: 0.5, h: 0.1, color: '#fde047' },
      { id: '3', type: 'whiteout', x: 0.2, y: 0.5, w: 0.2, h: 0.1 },
      { id: '4', type: 'draw', points: [[0, 0], [0.5, 0.5], [1, 0.2]], color: '#b91c1c', width: 2 },
    ];
    const bytes = await bakePdf([await makePdf(1)], [ref({ rotation: 90, marks })]);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});

it('replaces characters the standard font cannot draw', async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  expect(encodable(font, 'Ab é 你')).toBe('Ab é ?');
});
