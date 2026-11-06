/** PowerPoint and PDF output for Slides, and reading .pptx uploads. Loaded only when used. */
import { makeSlide, newId, Slide, SlideElement, SLIDE_H, SLIDE_THEMES, SLIDE_W, SlidesContent, themeById } from './driveContent';

const IN_PER_PX = 10 / SLIDE_W; // 10in wide, 16:9
const inches = (px: number) => px * IN_PER_PX;
const plainHex = (c?: string) => (c ? c.replace('#', '').slice(0, 6).toUpperCase() : undefined);

async function imageData(src: string): Promise<string> {
  const blob = await (await fetch(src)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * The package's normal entry imports Node's fs and https, which webpack 5 under CRA can't bundle. Its browser
 * build is a plain script, so it's served from public/vendor and loaded on the first export.
 */
function loadPptxGen(): Promise<any> {
  const existing = (window as any).PptxGenJS;
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${process.env.PUBLIC_URL || ''}/vendor/pptxgen.bundle.js`;
    script.onload = () => resolve((window as any).PptxGenJS);
    script.onerror = () => reject(new Error('Could not load the PowerPoint exporter.'));
    document.head.appendChild(script);
  });
}

export async function slidesToPptx(deck: SlidesContent): Promise<Blob> {
  const PptxGen = await loadPptxGen();
  const pptx = new PptxGen();
  pptx.layout = 'LAYOUT_16x9';
  const theme = themeById(deck.themeId);
  for (const s of deck.slides) {
    const slide = pptx.addSlide();
    slide.background = { color: plainHex(s.background || theme.background) };
    if (s.notes) slide.addNotes(s.notes);
    for (const e of s.elements) {
      const box = { x: inches(e.x), y: inches(e.y), w: inches(e.w), h: inches(e.h) };
      const textOpts = {
        ...box,
        fontFace: e.fontFamily,
        fontSize: (e.fontSize || 18) * 0.75,
        bold: !!e.bold,
        italic: !!e.italic,
        underline: e.underline ? { style: 'sng' } : undefined,
        color: plainHex(e.color),
        align: e.align || 'left',
        valign: e.valign || 'top',
        margin: 4,
      };
      if (e.type === 'text') {
        if (e.text) {
          slide.addText(
            e.bullets ? e.text.split('\n').map((t) => ({ text: t, options: { bullet: true, breakLine: true } })) : e.text,
            textOpts,
          );
        }
      } else if (e.type === 'image' && e.src) {
        try {
          slide.addImage({ ...box, data: await imageData(e.src) });
        } catch {
          /* A picture that can't be fetched is left out rather than failing the whole export. */
        }
      } else if (e.type === 'shape') {
        const shape = { rect: 'rect', round: 'roundRect', ellipse: 'ellipse', triangle: 'triangle', line: 'line', arrow: 'line' }[e.shape || 'rect'];
        const line = { color: plainHex(e.stroke) || plainHex(e.fill) || '111111', width: e.strokeWidth ?? 1, endArrowType: e.shape === 'arrow' ? 'triangle' : undefined };
        const fill = e.shape === 'line' || e.shape === 'arrow' || !e.fill ? undefined : { color: plainHex(e.fill) };
        if (e.text) slide.addText(e.text, { ...textOpts, shape, fill, line });
        else slide.addShape(shape, { ...box, fill, line });
      }
    }
  }
  return (await pptx.write({ outputType: 'blob' })) as Blob;
}

export async function slideElementsToPdf(nodes: HTMLElement[]): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const pdf = new jsPDF({ unit: 'px', format: [SLIDE_W, SLIDE_H], orientation: 'landscape', hotfixes: ['px_scaling'] });
  for (let i = 0; i < nodes.length; i++) {
    const canvas = await html2canvas(nodes[i], { scale: 2, useCORS: true, width: SLIDE_W, height: SLIDE_H });
    if (i) pdf.addPage([SLIDE_W, SLIDE_H], 'landscape');
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, SLIDE_W, SLIDE_H);
  }
  return pdf.output('blob');
}

/* ---------------------------- reading .pptx ---------------------------- */

const EMU_PER_PX = 12700 * 0.75;
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const first = (el: Element | Document | null, ns: string, name: string) => (el ? (el.getElementsByTagNameNS(ns, name)[0] as Element | undefined) : undefined);
const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

const rels = async (zip: any, path: string): Promise<Map<string, string>> => {
  const cut = path.lastIndexOf('/');
  const file = zip.file(`${path.slice(0, cut)}/_rels/${path.slice(cut + 1)}.rels`);
  const map = new Map<string, string>();
  if (!file) return map;
  Array.from(parse(await file.async('string')).getElementsByTagName('Relationship')).forEach((r) => {
    const target = r.getAttribute('Target') || '';
    const resolved = new URL(target, `http://x/${path.slice(0, cut)}/`).pathname.slice(1);
    map.set(r.getAttribute('Id') || '', resolved);
  });
  return map;
};

export interface ImportedPicture {
  element: SlideElement;
  blob: Blob;
  name: string;
}

/** Keeps text, positions, basic text style, pictures and speaker notes. Animations and effects are left out. */
export async function pptxToSlides(bytes: ArrayBuffer): Promise<{ deck: SlidesContent; pictures: ImportedPicture[] }> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(bytes);
  const presentation = parse(await zip.file('ppt/presentation.xml')!.async('string'));
  const size = first(presentation, NS_P, 'sldSz');
  const cx = Number(size?.getAttribute('cx')) || 9144000;
  const scale = SLIDE_W / (cx / EMU_PER_PX);
  const px = (emu: string | null) => (Number(emu) / EMU_PER_PX) * scale;
  const presRels = await rels(zip, 'ppt/presentation.xml');
  const ids = Array.from(presentation.getElementsByTagNameNS(NS_P, 'sldId')).map((s) => s.getAttributeNS(NS_R, 'id') || '');
  const theme = SLIDE_THEMES[0];
  const pictures: ImportedPicture[] = [];
  const slides: Slide[] = [];

  for (const rid of ids) {
    const path = presRels.get(rid);
    const file = path && zip.file(path);
    if (!path || !file) continue;
    const doc = parse(await file.async('string'));
    const links = await rels(zip, path);
    const slide: Slide = { id: newId(), elements: [] };
    const bg = first(first(first(doc, NS_P, 'bg') ?? null, NS_P, 'bgPr') ?? null, NS_A, 'srgbClr');
    if (bg) slide.background = `#${bg.getAttribute('val')}`;

    Array.from(doc.getElementsByTagNameNS(NS_P, 'sp')).forEach((sp) => {
      const xfrm = first(sp, NS_A, 'xfrm');
      const off = first(xfrm ?? null, NS_A, 'off');
      const ext = first(xfrm ?? null, NS_A, 'ext');
      const placeholder = first(sp, NS_P, 'ph');
      const isTitle = /title/i.test(placeholder?.getAttribute('type') || '');
      const paragraphs = Array.from(sp.getElementsByTagNameNS(NS_A, 'p'));
      const text = paragraphs.map((p) => Array.from(p.getElementsByTagNameNS(NS_A, 't')).map((t) => t.textContent).join('')).join('\n');
      if (!text.trim()) return;
      const rPr = first(sp, NS_A, 'rPr');
      const pPr = first(sp, NS_A, 'pPr');
      const color = first(rPr ?? null, NS_A, 'srgbClr')?.getAttribute('val');
      const sz = Number(rPr?.getAttribute('sz'));
      const algn = pPr?.getAttribute('algn');
      slide.elements.push({
        id: newId(),
        type: 'text',
        // Placeholders with no position of their own inherit it from the layout; use sensible spots.
        x: off ? px(off.getAttribute('x')) : 60,
        y: off ? px(off.getAttribute('y')) : isTitle ? 40 : 140,
        w: ext ? px(ext.getAttribute('cx')) : 840,
        h: ext ? px(ext.getAttribute('cy')) : isTitle ? 90 : 350,
        text,
        fontFamily: first(rPr ?? null, NS_A, 'latin')?.getAttribute('typeface') || theme.font,
        fontSize: sz ? (sz / 100 / 0.75) * scale : isTitle ? 36 : 22,
        bold: rPr?.getAttribute('b') === '1' || isTitle,
        italic: rPr?.getAttribute('i') === '1',
        underline: !!rPr?.getAttribute('u') && rPr?.getAttribute('u') !== 'none',
        color: color ? `#${color}` : isTitle ? theme.title : theme.body,
        align: algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : 'left',
        valign: 'top',
      });
    });

    for (const pic of Array.from(doc.getElementsByTagNameNS(NS_P, 'pic'))) {
      const blip = first(pic, NS_A, 'blip');
      const target = links.get(blip?.getAttributeNS(NS_R, 'embed') || '');
      const media = target && zip.file(target);
      const off = first(pic, NS_A, 'off');
      const ext = first(pic, NS_A, 'ext');
      if (!media || !off || !ext || !/\.(png|jpe?g|gif|webp)$/i.test(target as string)) continue;
      const element: SlideElement = { id: newId(), type: 'image', x: px(off.getAttribute('x')), y: px(off.getAttribute('y')), w: px(ext.getAttribute('cx')), h: px(ext.getAttribute('cy')) };
      slide.elements.push(element);
      const type = /\.png$/i.test(target as string) ? 'image/png' : /\.gif$/i.test(target as string) ? 'image/gif' : /\.webp$/i.test(target as string) ? 'image/webp' : 'image/jpeg';
      pictures.push({ element, blob: new Blob([await media.async('arraybuffer')], { type }), name: (target as string).split('/').pop() || 'image.png' });
    }

    const notesPath = Array.from(links.values()).find((t) => /notesSlides\//.test(t));
    const notesFile = notesPath && zip.file(notesPath);
    if (notesFile) {
      const notes = parse(await notesFile.async('string'));
      slide.notes = Array.from(notes.getElementsByTagNameNS(NS_P, 'sp'))
        .filter((sp) => first(sp, NS_P, 'ph')?.getAttribute('type') === 'body')
        .flatMap((sp) => Array.from(sp.getElementsByTagNameNS(NS_A, 't')).map((t) => t.textContent))
        .join(' ');
    }
    slides.push(slide);
  }
  return { deck: { themeId: 'plain', slides: slides.length ? slides : [makeSlide('title', theme)] }, pictures };
}
