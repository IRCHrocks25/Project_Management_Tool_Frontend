/** Turns uploaded Word, Excel and PowerPoint files into editable Drively files. Loaded only when used. */
import { drivelyService, DriveItem } from '../../services/drively.service';
import { previewFor, stripExtension } from './driveContent';

const dataUrlToBlob = async (url: string) => (await fetch(url)).blob();

export async function createGridFromBytes(bytes: ArrayBuffer, name: string, parentId: string | null): Promise<DriveItem> {
  const { xlsxToSheets } = await import('./gridConvert');
  const content = { sheets: await xlsxToSheets(bytes) };
  return drivelyService.create({ kind: 'grid', name: stripExtension(name), parentId, content, preview: previewFor('grid', content) });
}

export async function createDocFromBytes(bytes: ArrayBuffer, name: string, parentId: string | null): Promise<DriveItem> {
  const { docxToDoc } = await import('./docsExport');
  const content: any = await docxToDoc(bytes);
  // Pictures arrive inline; store them as assets so the document stays small and private.
  const images: any[] = [];
  const walk = (node: any) => {
    if (node.type === 'image' && String(node.attrs?.src || '').startsWith('data:')) images.push(node);
    (node.content || []).forEach(walk);
  };
  walk(content);
  const inline = images.map((node) => node.attrs.src as string);
  images.forEach((node) => (node.attrs.src = null));
  const item = await drivelyService.create({ kind: 'doc', name: stripExtension(name), parentId, content, preview: previewFor('doc', content) });
  if (images.length) {
    for (let i = 0; i < images.length; i++) {
      const blob = await dataUrlToBlob(inline[i]);
      const stored = await drivelyService.addImage(item.id, blob, `image-${i + 1}.${blob.type.split('/')[1] || 'png'}`);
      images[i].attrs.assetId = stored.assetId;
    }
    return drivelyService.update(item.id, { content, revision: item.revision });
  }
  return item;
}

export async function createSlidesFromBytes(bytes: ArrayBuffer, name: string, parentId: string | null): Promise<DriveItem> {
  const { pptxToSlides } = await import('./slidesConvert');
  const { deck, pictures } = await pptxToSlides(bytes);
  const item = await drivelyService.create({ kind: 'slides', name: stripExtension(name), parentId, content: deck, preview: previewFor('slides', deck) });
  if (pictures.length) {
    for (const { element, blob, name: picture } of pictures) {
      element.assetId = (await drivelyService.addImage(item.id, blob, picture)).assetId;
    }
    return drivelyService.update(item.id, { content: deck, revision: item.revision });
  }
  return item;
}
