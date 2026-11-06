/** Moves Grid sheets between the editor's shape, compact storage, Excel and CSV. */
import { newId } from './driveContent';

const emptySheet = () => ({ name: 'Sheet1', id: newId(), status: 1, order: 0, celldata: [], row: 100, column: 26 });

/** The workbook wants `celldata` on load and reports a `data` matrix afterwards. */
export function sheetsForEditor(stored: any[] | undefined): any[] {
  const sheets = Array.isArray(stored) && stored.length ? stored : [emptySheet()];
  return sheets.map((s, i) => ({ ...s, id: s.id || newId(), order: s.order ?? i, status: s.status ?? (i === 0 ? 1 : 0) }));
}

function matrixToCelldata(matrix: any[][]): any[] {
  const cells: any[] = [];
  matrix.forEach((row, r) =>
    row?.forEach((v, c) => {
      if (v !== null && v !== undefined) cells.push({ r, c, v });
    }),
  );
  return cells;
}

/** Keeps only non-empty cells, and drops the view state (selection, scroll) so it doesn't count as an edit. */
export function sheetsForStorage(sheets: any[]): any[] {
  return sheets.map((s) => {
    const { data, luckysheet_select_save: _sel, scrollLeft: _l, scrollTop: _t, calcChain: _chain, images: _img, ...rest } = s;
    return { ...rest, celldata: Array.isArray(data) ? matrixToCelldata(data) : rest.celldata || [] };
  });
}

const cellText = (v: any): string => {
  if (v === null || v === undefined) return '';
  if (typeof v !== 'object') return String(v);
  if (v.ct?.s) return v.ct.s.map((p: any) => p.v).join('');
  return v.m !== undefined && v.m !== null ? String(v.m) : v.v !== undefined && v.v !== null ? String(v.v) : '';
};

const csvCell = (text: string) => {
  // A leading =, +, - or @ would run as a formula when the CSV opens in Excel.
  const safe = /^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text)) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function sheetsToCsv(sheets: any[]): string {
  const cells = sheetsForStorage(sheets.slice(0, 1))[0]?.celldata || [];
  const rows: string[][] = [];
  let width = 0;
  for (const { r, c, v } of cells) {
    (rows[r] = rows[r] || [])[c] = cellText(v);
    width = Math.max(width, c + 1);
  }
  return Array.from(rows, (row) => Array.from({ length: width }, (_, c) => csvCell(row?.[c] ?? '')).join(',')).join('\r\n');
}

const toArgb = (hex?: string) => {
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex)) return undefined;
  return { argb: `FF${hex.replace('#', '').toUpperCase()}` };
};
const fromArgb = (c?: { argb?: string }) => (c?.argb && c.argb.length === 8 ? `#${c.argb.slice(2).toLowerCase()}` : undefined);

const H_ALIGN: Record<string, string> = { '0': 'center', '1': 'left', '2': 'right' };
const V_ALIGN: Record<string, string> = { '0': 'middle', '1': 'top', '2': 'bottom' };
const invert = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, Number(k)]));

export async function sheetsToXlsx(sheets: any[]): Promise<Blob> {
  const ExcelJS: any = await import('exceljs');
  const wb = new (ExcelJS.default || ExcelJS).Workbook();
  for (const sheet of sheetsForStorage(sheets)) {
    const ws = wb.addWorksheet(String(sheet.name || 'Sheet').slice(0, 31));
    for (const { r, c, v } of sheet.celldata) {
      if (v?.mc && !('rs' in v.mc)) continue;
      const cell = ws.getCell(r + 1, c + 1);
      const raw = typeof v === 'object' && v ? v : { v };
      if (raw.f) cell.value = { formula: String(raw.f).replace(/^=/, ''), result: raw.v ?? undefined };
      else if (raw.ct?.s) cell.value = raw.ct.s.map((p: any) => p.v).join('');
      else cell.value = raw.v ?? null;
      if (raw.ct?.fa && raw.ct.fa !== 'General') cell.numFmt = raw.ct.fa;
      cell.font = { bold: raw.bl === 1, italic: raw.it === 1, strike: raw.cl === 1, underline: raw.un === 1, size: raw.fs || undefined, color: toArgb(raw.fc) };
      if (raw.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: toArgb(raw.bg) };
      cell.alignment = { horizontal: H_ALIGN[String(raw.ht)], vertical: V_ALIGN[String(raw.vt)], wrapText: raw.tb === '2' || undefined };
    }
    Object.entries(sheet.config?.merge || {}).forEach(([, m]: [string, any]) => ws.mergeCells(m.r + 1, m.c + 1, m.r + m.rs, m.c + m.cs));
    Object.entries(sheet.config?.columnlen || {}).forEach(([c, px]: [string, any]) => (ws.getColumn(Number(c) + 1).width = Number(px) / 7));
    Object.entries(sheet.config?.rowlen || {}).forEach(([r, px]: [string, any]) => (ws.getRow(Number(r) + 1).height = Number(px) * 0.75));
  }
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function xlsxToSheets(bytes: ArrayBuffer): Promise<any[]> {
  const ExcelJS: any = await import('exceljs');
  const wb = new (ExcelJS.default || ExcelJS).Workbook();
  await wb.xlsx.load(bytes);
  const hAlign = invert(H_ALIGN);
  const vAlign = invert(V_ALIGN);
  const sheets: any[] = [];
  wb.eachSheet((ws: any) => {
    const celldata: any[] = [];
    const merge: Record<string, any> = {};
    const columnlen: Record<string, number> = {};
    const rowlen: Record<string, number> = {};
    ws.columns?.forEach((col: any, i: number) => {
      if (col?.width) columnlen[i] = Math.round(col.width * 7);
    });
    ws.eachRow({ includeEmpty: false }, (row: any, rowNumber: number) => {
      if (row.height) rowlen[rowNumber - 1] = Math.round(row.height / 0.75);
      row.eachCell({ includeEmpty: false }, (cell: any, colNumber: number) => {
        const r = rowNumber - 1;
        const c = colNumber - 1;
        const v: any = {};
        const value = cell.value;
        if (value && typeof value === 'object' && !(value instanceof Date)) {
          if ('formula' in value || 'sharedFormula' in value) {
            if (value.formula) v.f = `=${value.formula}`;
            v.v = value.result ?? '';
          } else if ('richText' in value) v.v = value.richText.map((p: any) => p.text).join('');
          else if ('text' in value) v.v = value.text;
          else if ('error' in value) v.v = value.error;
        } else if (value instanceof Date) {
          v.v = cell.text;
        } else v.v = value;
        v.m = cell.text ?? (v.v === undefined || v.v === null ? '' : String(v.v));
        const fa = cell.numFmt && cell.numFmt !== 'General' ? cell.numFmt : 'General';
        v.ct = { fa, t: typeof v.v === 'number' ? 'n' : 's' };
        const f = cell.font || {};
        if (f.bold) v.bl = 1;
        if (f.italic) v.it = 1;
        if (f.strike) v.cl = 1;
        if (f.underline) v.un = 1;
        if (f.size) v.fs = f.size;
        const fc = fromArgb(f.color);
        if (fc) v.fc = fc;
        const bg = fromArgb(cell.fill?.fgColor);
        if (bg) v.bg = bg;
        const a = cell.alignment || {};
        if (a.horizontal in hAlign) v.ht = hAlign[a.horizontal];
        if (a.vertical in vAlign) v.vt = vAlign[a.vertical];
        if (a.wrapText) v.tb = '2';
        celldata.push({ r, c, v });
      });
    });
    (ws.model?.merges || []).forEach((range: string) => {
      const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range);
      if (!m) return;
      const col = (s: string) => s.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const r = Number(m[2]) - 1;
      const c = col(m[1]);
      const rs = Number(m[4]) - r;
      const cs = col(m[3]) - c + 1;
      merge[`${r}_${c}`] = { r, c, rs, cs };
      const head = celldata.find((x) => x.r === r && x.c === c);
      if (head) head.v.mc = { r, c, rs, cs };
    });
    sheets.push({
      name: ws.name,
      id: newId(),
      order: sheets.length,
      status: sheets.length === 0 ? 1 : 0,
      celldata,
      row: Math.max(100, ws.rowCount + 20),
      column: Math.max(26, ws.columnCount + 5),
      config: { merge, columnlen, rowlen },
    });
  });
  return sheets.length ? sheets : [emptySheet()];
}
