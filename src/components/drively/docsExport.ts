/** Word and PDF output for Docs, and turning a .docx upload into a Doc. Loaded only when used. */
import { generateJSON } from '@tiptap/core';
import type { JSONContent } from '@tiptap/react';
import { buildDocExtensions } from './docsExtensions';

const HEADINGS = ['HEADING_1', 'HEADING_2', 'HEADING_3', 'HEADING_4'] as const;
const hex = (c?: string) => (c ? c.replace('#', '').slice(0, 6) : undefined);
const halfPoints = (size?: string) => {
  const m = size && /([\d.]+)(pt|px)?/.exec(size);
  if (!m) return undefined;
  const pt = m[2] === 'px' ? Number(m[1]) * 0.75 : Number(m[1]);
  return Math.round(pt * 2);
};

export async function docToDocx(doc: JSONContent): Promise<Blob> {
  const d = await import('docx');

  const runsOf = (node: JSONContent): any[] =>
    (node.content || []).flatMap((child): any[] => {
      if (child.type === 'hardBreak') return [new d.TextRun({ break: 1 })];
      if (child.type !== 'text') return [];
      const marks: Record<string, any> = {};
      (child.marks || []).forEach((m) => (marks[m.type] = m.attrs || true));
      const style = marks.textStyle || {};
      const run = new d.TextRun({
        text: child.text || '',
        bold: !!marks.bold,
        italics: !!marks.italic,
        underline: marks.underline ? {} : undefined,
        strike: !!marks.strike,
        color: hex(style.color),
        font: style.fontFamily || undefined,
        size: halfPoints(style.fontSize),
        shading: marks.highlight?.color ? { type: d.ShadingType.CLEAR, fill: hex(marks.highlight.color) } : undefined,
      });
      return marks.link?.href ? [new d.ExternalHyperlink({ link: marks.link.href, children: [run] })] : [run];
    });

  const alignment = (node: JSONContent) => {
    const a = node.attrs?.textAlign;
    return a === 'center' ? d.AlignmentType.CENTER : a === 'right' ? d.AlignmentType.RIGHT : a === 'justify' ? d.AlignmentType.JUSTIFIED : undefined;
  };

  const imageOf = async (node: JSONContent) => {
    try {
      const response = await fetch(node.attrs?.src);
      const blob = await response.blob();
      const data = await blob.arrayBuffer();
      const bitmap = await createImageBitmap(blob);
      const width = Math.min(bitmap.width, 620);
      const type = blob.type.includes('png') ? 'png' : blob.type.includes('gif') ? 'gif' : 'jpg';
      return new d.Paragraph({ children: [new d.ImageRun({ type, data, transformation: { width, height: Math.round((bitmap.height / bitmap.width) * width) } } as any)] });
    } catch {
      return new d.Paragraph({ text: `[Picture: ${node.attrs?.alt || 'not available'}]` });
    }
  };

  const blocks = async (nodes: JSONContent[] = [], list?: { ref?: string; level: number }): Promise<any[]> => {
    const out: any[] = [];
    for (const node of nodes) {
      const text = { children: runsOf(node), alignment: alignment(node) };
      switch (node.type) {
        case 'paragraph':
          out.push(new d.Paragraph({ ...text, ...(list ? (list.ref ? { numbering: { reference: list.ref, level: list.level } } : { bullet: { level: list.level } }) : {}) }));
          break;
        case 'heading':
          out.push(new d.Paragraph({ ...text, heading: d.HeadingLevel[HEADINGS[(node.attrs?.level || 1) - 1]] }));
          break;
        case 'blockquote':
          for (const q of node.content || []) out.push(new d.Paragraph({ children: runsOf(q), indent: { left: 480 }, border: { left: { style: d.BorderStyle.SINGLE, size: 12, color: 'AAAAAA', space: 8 } } }));
          break;
        case 'codeBlock':
          out.push(new d.Paragraph({ children: [new d.TextRun({ text: (node.content || []).map((c) => c.text).join(''), font: 'Courier New' })] }));
          break;
        case 'horizontalRule':
          out.push(new d.Paragraph({ border: { bottom: { style: d.BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 } } }));
          break;
        case 'pageBreak':
          out.push(new d.Paragraph({ children: [new d.PageBreak()] }));
          break;
        case 'image':
          out.push(await imageOf(node));
          break;
        case 'bulletList':
          for (const li of node.content || []) out.push(...(await blocks(li.content, { level: (list?.level ?? -1) + 1 })));
          break;
        case 'orderedList':
          for (const li of node.content || []) out.push(...(await blocks(li.content, { ref: 'numbers', level: (list?.level ?? -1) + 1 })));
          break;
        case 'taskList':
          for (const li of node.content || []) {
            const [first, ...rest] = li.content || [];
            out.push(new d.Paragraph({ children: [new d.TextRun(li.attrs?.checked ? '☑ ' : '☐ '), ...runsOf(first || {})] }));
            out.push(...(await blocks(rest)));
          }
          break;
        case 'table': {
          const rows = [];
          for (const row of node.content || []) {
            const cells = [];
            for (const cell of row.content || []) {
              const children = await blocks(cell.content);
              cells.push(new d.TableCell({ children: children.length ? children : [new d.Paragraph('')], columnSpan: cell.attrs?.colspan, rowSpan: cell.attrs?.rowspan }));
            }
            rows.push(new d.TableRow({ children: cells, tableHeader: row.content?.[0]?.type === 'tableHeader' }));
          }
          out.push(new d.Table({ rows, width: { size: 100, type: d.WidthType.PERCENTAGE } }));
          break;
        }
        default:
          break;
      }
    }
    return out;
  };

  const file = new d.Document({
    numbering: {
      config: [
        {
          reference: 'numbers',
          levels: [0, 1, 2, 3].map((level) => ({ level, format: d.LevelFormat.DECIMAL, text: `%${level + 1}.`, alignment: d.AlignmentType.START, style: { paragraph: { indent: { left: 480 * (level + 1), hanging: 280 } } } })),
        },
      ],
    },
    sections: [{ children: await blocks(doc.content) }],
  });
  return d.Packer.toBlob(file);
}

/** A4 pages cut from a picture of the document. */
export async function elementToPdf(el: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;
  const sliceH = Math.floor((contentH / contentW) * canvas.width);
  const part = document.createElement('canvas');
  part.width = canvas.width;
  for (let y = 0, page = 0; y < canvas.height; y += sliceH, page++) {
    const h = Math.min(sliceH, canvas.height - y);
    part.height = h;
    const ctx = part.getContext('2d') as CanvasRenderingContext2D;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, part.width, h);
    ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    if (page) pdf.addPage();
    pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, contentW, (h / canvas.width) * contentW);
  }
  return pdf.output('blob');
}

/** Word to Doc. Pictures come back as data URLs; the caller stores them as assets once the file exists. */
export async function docxToDoc(bytes: ArrayBuffer): Promise<JSONContent> {
  const mammoth: any = await import('mammoth');
  const { value } = await (mammoth.default || mammoth).convertToHtml({ arrayBuffer: bytes });
  return generateJSON(value, buildDocExtensions({ canEdit: true }));
}
