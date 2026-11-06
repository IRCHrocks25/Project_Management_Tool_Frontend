/** Turns the PDF editor's pages and marks into a new PDF. Kept apart from the UI so it can be tested. */
import { degrees, PDFDocument, PDFFont, PDFImage, rgb, StandardFonts } from 'pdf-lib';

/** Marks are stored 0..1 across the page as it appears on screen, so they survive zoom and rotation. */
export type PdfMark =
  | { id: string; type: 'text'; x: number; y: number; text: string; size: number; color: string }
  | { id: string; type: 'highlight' | 'whiteout'; x: number; y: number; w: number; h: number; color?: string }
  | { id: string; type: 'draw'; points: [number, number][]; color: string; width: number }
  | { id: string; type: 'image'; x: number; y: number; w: number; h: number; bytes: Uint8Array; mime: string; url: string };

export interface PdfPageRef {
  id: string;
  source: number;
  index: number;
  /** Extra clockwise rotation added in the editor, on top of the page's own. */
  rotation: number;
  marks: PdfMark[];
}

const toRgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

/** From the page as displayed (0..1, y down) to PDF points on the unrotated page (y up). */
export function displayToPdf(x: number, y: number, rotation: number, width: number, height: number): [number, number] {
  switch (((rotation % 360) + 360) % 360) {
    case 90:
      return [y * width, x * height];
    case 180:
      return [(1 - x) * width, y * height];
    case 270:
      return [(1 - y) * width, (1 - x) * height];
    default:
      return [x * width, (1 - y) * height];
  }
}

/** Standard PDF fonts only know Latin characters; anything else becomes "?" rather than failing the save. */
export function encodable(font: PDFFont, text: string): string {
  return Array.from(text)
    .map((ch) => {
      try {
        font.encodeText(ch);
        return ch;
      } catch {
        return '?';
      }
    })
    .join('');
}

export async function bakePdf(sources: Uint8Array[], pages: PdfPageRef[]): Promise<Uint8Array> {
  const output = await PDFDocument.create();
  const loaded = await Promise.all(sources.map((bytes) => PDFDocument.load(bytes)));
  const font = await output.embedFont(StandardFonts.Helvetica);
  const images = new Map<string, PDFImage>();

  for (const ref of pages) {
    const [page] = await output.copyPages(loaded[ref.source], [ref.index]);
    output.addPage(page);
    const total = (page.getRotation().angle + ref.rotation) % 360;
    page.setRotation(degrees(total));
    const { width, height } = page.getSize();
    // Displayed page size, for scaling marks whose size is in screen fractions.
    const shownW = total % 180 === 0 ? width : height;
    const shownH = total % 180 === 0 ? height : width;
    const at = (x: number, y: number) => displayToPdf(x, y, total, width, height);

    for (const mark of ref.marks) {
      if (mark.type === 'highlight' || mark.type === 'whiteout') {
        const [x1, y1] = at(mark.x, mark.y);
        const [x2, y2] = at(mark.x + mark.w, mark.y + mark.h);
        page.drawRectangle({
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1),
          color: mark.type === 'whiteout' ? rgb(1, 1, 1) : toRgb(mark.color || '#fde047'),
          opacity: mark.type === 'whiteout' ? 1 : 0.4,
        });
      } else if (mark.type === 'draw') {
        for (let i = 1; i < mark.points.length; i++) {
          const [sx, sy] = at(...mark.points[i - 1]);
          const [ex, ey] = at(...mark.points[i]);
          page.drawLine({ start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness: mark.width, color: toRgb(mark.color), opacity: 1 });
        }
      } else if (mark.type === 'text') {
        const lines = mark.text.split('\n');
        lines.forEach((line, i) => {
          const [x, y] = at(mark.x, mark.y + ((i + 0.8) * mark.size * 1.2) / shownH);
          page.drawText(encodable(font, line), { x, y, size: mark.size, font, color: toRgb(mark.color), rotate: degrees(total) });
        });
      } else if (mark.type === 'image') {
        let image = images.get(mark.id);
        if (!image) {
          image = mark.mime === 'image/png' ? await output.embedPng(mark.bytes) : await output.embedJpg(mark.bytes);
          images.set(mark.id, image);
        }
        const [x, y] = at(mark.x, mark.y + mark.h);
        page.drawImage(image, { x, y, width: mark.w * shownW, height: mark.h * shownH, rotate: degrees(total) });
      }
    }
  }
  return output.save();
}
