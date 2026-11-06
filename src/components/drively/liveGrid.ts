/** Grid in the live document: one map per sheet of cell -> value, plus the sheet settings people share. */
import * as Y from 'yjs';
import { newId } from './driveContent';

const metaOf = (doc: Y.Doc) => doc.getMap<string>('gridSheets');
const cellsOf = (doc: Y.Doc, sheetId: string) => doc.getMap<string>(`gridCells:${sheetId}`);

/** Selection, scroll and the active sheet belong to each person, so only these are shared. */
const SHARED = ['name', 'order', 'color', 'hide', 'config', 'frozen', 'row', 'column', 'filter_select', 'filter'];

const shared = (sheet: any) => {
  const out: Record<string, unknown> = {};
  SHARED.forEach((k) => {
    if (sheet[k] !== undefined) out[k] = sheet[k];
  });
  return JSON.stringify(out);
};

export type CellChange = { sheetId: string; r: number; c: number; value: any };

/** What this person has last seen, used to work out what changed on either side. */
export interface GridKnown {
  meta: Map<string, string>;
  cells: Map<string, Map<string, string>>;
}

export const emptyKnown = (): GridKnown => ({ meta: new Map(), cells: new Map() });

/** Records this person's edits. `sheets` come from sheetsForStorage (non-empty cells only). */
export function writeSheets(doc: Y.Doc, sheets: any[], known: GridKnown, origin: unknown) {
  doc.transact(() => {
    const meta = metaOf(doc);
    const ids = new Set(sheets.map((s) => s.id as string));
    Array.from(known.meta.keys()).forEach((id) => {
      if (!ids.has(id)) {
        meta.delete(id);
        known.meta.delete(id);
        known.cells.delete(id);
      }
    });
    sheets.forEach((sheet) => {
      const value = shared(sheet);
      if (known.meta.get(sheet.id) !== value) {
        meta.set(sheet.id, value);
        known.meta.set(sheet.id, value);
      }
      const cells = cellsOf(doc, sheet.id);
      const seen = known.cells.get(sheet.id) || new Map<string, string>();
      known.cells.set(sheet.id, seen);
      const current = new Set<string>();
      (sheet.celldata || []).forEach(({ r, c, v }: any) => {
        const key = `${r}_${c}`;
        const json = JSON.stringify(v);
        current.add(key);
        if (seen.get(key) !== json) {
          cells.set(key, json);
          seen.set(key, json);
        }
      });
      Array.from(seen.keys()).forEach((key) => {
        if (!current.has(key)) {
          cells.delete(key);
          seen.delete(key);
        }
      });
    });
  }, origin);
}

/** Works out what other people changed. `structure` means sheets themselves changed and the grid must be redrawn. */
export function readChanges(doc: Y.Doc, known: GridKnown): { structure: boolean; cells: CellChange[] } {
  let structure = false;
  const meta = metaOf(doc);
  const changes: CellChange[] = [];
  meta.forEach((value, id) => {
    if (known.meta.get(id) !== value) structure = true;
    known.meta.set(id, value);
  });
  Array.from(known.meta.keys()).forEach((id) => {
    if (!meta.has(id)) {
      structure = true;
      known.meta.delete(id);
      known.cells.delete(id);
    }
  });
  meta.forEach((_v, id) => {
    const seen = known.cells.get(id) || new Map<string, string>();
    known.cells.set(id, seen);
    const cells = cellsOf(doc, id);
    cells.forEach((json, key) => {
      if (seen.get(key) !== json) {
        seen.set(key, json);
        const [r, c] = key.split('_').map(Number);
        changes.push({ sheetId: id, r, c, value: JSON.parse(json) });
      }
    });
    Array.from(seen.keys()).forEach((key) => {
      if (!cells.has(key)) {
        seen.delete(key);
        const [r, c] = key.split('_').map(Number);
        changes.push({ sheetId: id, r, c, value: null });
      }
    });
  });
  return { structure, cells: changes };
}

/** The whole workbook as the grid expects it on first draw. */
export function readSheets(doc: Y.Doc, known: GridKnown): any[] {
  known.meta.clear();
  known.cells.clear();
  const sheets: any[] = [];
  metaOf(doc).forEach((value, id) => {
    known.meta.set(id, value);
    const seen = new Map<string, string>();
    known.cells.set(id, seen);
    const celldata: any[] = [];
    cellsOf(doc, id).forEach((json, key) => {
      seen.set(key, json);
      const [r, c] = key.split('_').map(Number);
      celldata.push({ r, c, v: JSON.parse(json) });
    });
    sheets.push({ ...JSON.parse(value), id, celldata });
  });
  sheets.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (!sheets.length) sheets.push({ name: 'Sheet1', id: newId(), order: 0, celldata: [], row: 100, column: 26 });
  sheets.forEach((s, i) => (s.status = i === 0 ? 1 : 0));
  return sheets;
}
