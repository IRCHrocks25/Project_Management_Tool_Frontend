/**
 * Grid: a spreadsheet with formulas, formatting and several sheets, which people edit together live. Other people's
 * cell changes are applied to the open grid; changes to the sheets themselves redraw it. Imports and exports Excel.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Workbook, WorkbookInstance } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { canEditLevel, DriveDetail, saveBlob } from '../../services/drively.service';
import EmptyState from '../hub/ui/EmptyState';
import OverflowMenu from '../hub/ui/OverflowMenu';
import { Skeleton } from '../hub/ui/Skeleton';
import { attachGridScroll } from './gridScroll';
import { useToast } from '../hub/ui/Toast';
import { exportName } from './driveContent';
import { useDriveComments } from './DriveComments';
import { useLiveDoc, useLivePreview } from './driveLive';
import EditorShell from './EditorShell';
import { sheetsForEditor, sheetsForStorage, sheetsToCsv, sheetsToXlsx } from './gridConvert';
import { emptyKnown, readChanges, readSheets, writeSheets } from './liveGrid';

const LOCAL = 'grid-local';

const GridEditor: React.FC<{ item: DriveDetail }> = ({ item }) => {
  const toast = useToast();
  const known = useRef(emptyKnown());
  const live = useLiveDoc(item, (doc) => {
    writeSheets(doc, sheetsForStorage(sheetsForEditor(item.content?.sheets)), known.current, LOCAL);
  });
  const canEdit = canEditLevel(live.level);
  const comments = useDriveComments(item);
  const shownItem = useMemo(() => ({ ...item, myAccess: live.level }), [item, live.level]);
  const [workbook, setWorkbook] = useState<{ key: number; sheets: any[] } | null>(null);
  const latest = useRef<any[]>([]);
  const grid = useRef<WorkbookInstance>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const hasWorkbook = !!workbook;

  useEffect(() => (hasWorkbook && host.current ? attachGridScroll(host.current) : undefined), [hasWorkbook]);

  useLivePreview(live, item.id, 'grid', () => ({ sheets: sheetsForStorage(latest.current) }));

  const redraw = useCallback(() => {
    const sheets = sheetsForEditor(readSheets(live.doc, known.current));
    latest.current = sheets;
    setWorkbook((w) => ({ key: (w?.key || 0) + 1, sheets }));
  }, [live.doc]);

  // First draw, once this person has the shared state.
  const drawn = useRef(false);
  useEffect(() => {
    if (live.synced && !drawn.current) {
      drawn.current = true;
      redraw();
    }
  }, [live.synced, redraw]);

  // Formulas are stored without what depends on them, and a new file's have no value yet. Working them out on
  // load shows the results and makes them update when the cells they read change.
  useEffect(() => {
    if (!workbook?.sheets.some((s) => s.celldata?.some((c: any) => c.v?.f))) return undefined;
    const t = setTimeout(() => grid.current?.calculateFormula());
    return () => clearTimeout(t);
  }, [workbook]);

  useEffect(() => {
    const onUpdate = (_u: Uint8Array, origin: unknown) => {
      if (origin === LOCAL || !drawn.current) return;
      const { structure, cells } = readChanges(live.doc, known.current);
      if (structure) return redraw();
      if (!cells.length) return undefined;
      const ops = cells.map((c) => ({ op: 'replace' as const, id: c.sheetId, path: ['data', c.r, c.c], value: c.value }));
      grid.current?.applyOp(ops as any);
      return undefined;
    };
    live.doc.on('update', onUpdate);
    return () => live.doc.off('update', onUpdate);
  }, [live.doc, redraw]);

  // The workbook also reports selection changes; writeSheets only records real changes.
  const onChange = useCallback(
    (sheets: any[]) => {
      latest.current = sheets;
      if (canEdit && drawn.current) writeSheets(live.doc, sheetsForStorage(sheets), known.current, LOCAL);
    },
    [canEdit, live.doc],
  );

  const download = async (type: 'xlsx' | 'csv') => {
    try {
      if (type === 'xlsx') saveBlob(await sheetsToXlsx(latest.current), exportName(item.name, 'xlsx'));
      else saveBlob(new Blob([sheetsToCsv(latest.current)], { type: 'text/csv;charset=utf-8' }), exportName(item.name, 'csv'));
    } catch {
      toast.error("Couldn't create the file.");
    }
  };

  const importFile = async (file: File) => {
    try {
      const { createGridFromBytes } = await import('./driveImport');
      const made = await createGridFromBytes(await file.arrayBuffer(), file.name, item.parentId);
      window.open(`/drively/d/${made.id}`, '_blank', 'noopener');
    } catch {
      toast.error("Couldn't read that Excel file.");
    }
  };

  const actions = (
    <OverflowMenu
      label="File actions"
      triggerLabel="File"
      size="md"
      items={[
        { label: 'Download as Excel', icon: 'download', onSelect: () => download('xlsx') },
        { label: 'Download first sheet as CSV', icon: 'download', onSelect: () => download('csv') },
        { label: 'Import Excel into a new file', icon: 'upload', hidden: !canEdit, onSelect: () => fileInput.current?.click() },
      ]}
    />
  );

  if (live.removed) return <div className="drv-loading"><EmptyState icon="alert" title="You no longer have access to this file" text="It may have been moved to the trash, or its owner changed who can open it." /></div>;
  if (live.failed) return <div className="drv-loading"><EmptyState icon="alert" title="Couldn't open this file" text="The file storage didn't answer. Try again in a moment." /></div>;

  return (
    <EditorShell item={shownItem} status={canEdit ? live.status : undefined} peers={live.peers} actions={actions} comments={comments}>
      {workbook ? (
        <div className="drv-grid-host" ref={host}>
          <Workbook key={workbook.key} ref={grid} data={workbook.sheets} lang="en" allowEdit={canEdit} showToolbar={canEdit} showFormulaBar showSheetTabs row={100} column={26} onChange={onChange} />
        </div>
      ) : (
        <div className="drv-loading"><Skeleton height={420} /></div>
      )}
      <input ref={fileInput} type="file" accept=".xlsx" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importFile(f); }} />
    </EditorShell>
  );
};

export default GridEditor;
