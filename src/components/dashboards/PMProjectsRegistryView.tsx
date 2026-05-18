import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../../services/project.service';
import { boardViewService } from '../../services/boardView.service';
import {
  ProjectRegistryMeta,
  projectRegistryMetaService,
} from '../../services/projectRegistryMeta.service';

type Props = {
  projects: any[];
  users: any[];
  setProjects: React.Dispatch<React.SetStateAction<any[]>>;
  globalSearchTerm: string;
};

type EditableField =
  | 'where'
  | 'clientType'
  | 'comments'
  | 'pmId'
  | 'finishDate'
  | 'projectPriority';

const WHERE_OPTIONS = ['', 'Katalyst', 'AI', 'WP'];
const CLIENT_TYPE_OPTIONS = ['', 'ICON', 'STAR', 'Katalyst', 'Private', 'Premium', 'Powered-Up', 'Rapid Prospect'];
const PROJECT_PRIORITY_OPTIONS = ['', 'Urgent', 'High', 'Medium', 'Low'];
const CORE_DELIVERABLE_ORDER = ['Logo', 'Social Media Banners', 'Brand Book', 'Speaker Kit', 'Home Page'];

const normalizeDeliverableName = (name: string) => {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (normalized === 'homepage' || normalized === 'home page') return 'home page';
  return normalized;
};

const getDeliverableName = (deliverable: any): string => {
  if (!deliverable) return '';
  const custom = typeof deliverable.customType === 'string' ? deliverable.customType.trim() : '';
  const type = typeof deliverable.type === 'string' ? deliverable.type.trim() : '';
  const raw = type.toLowerCase() === 'other' && custom ? custom : custom || type;
  const key = normalizeDeliverableName(raw);
  if (key === 'home page') return 'Home Page';
  return raw;
};

const abbreviate = (name: string): string => {
  const cleaned = name.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

const humanizeColumnLabel = (raw: string): string => {
  if (!raw) return 'Not started';
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const getDeliverableCurrentColumn = (deliverable: any): string => {
  if (!deliverable) return 'Not started';
  const direct = deliverable.kanbanColumnLabel || deliverable.currentColumn || deliverable.status;
  if (typeof direct === 'string' && direct.trim()) return humanizeColumnLabel(direct);
  return 'Not started';
};

const getTaskCurrentColumn = (task: any): string => {
  if (!task) return 'Not started';
  const direct = task.kanbanColumnLabel || task.currentColumn || task.status;
  if (typeof direct === 'string' && direct.trim()) return humanizeColumnLabel(direct);
  return 'Not started';
};

/* ---------- Design tokens (scoped; no external deps) ---------- */
const tokens = {
  // Surfaces
  surface: '#ffffff',
  surfaceAlt: '#fafbfc',
  surfaceSunk: '#f5f7fa',
  surfaceHover: '#f8fafc',
  // Lines
  border: '#e6e8ec',
  borderStrong: '#d4d8df',
  borderSubtle: '#eef0f3',
  // Text
  ink: '#0b1220',
  inkMid: '#475569',
  inkMuted: '#94a3b8',
  // Accents
  accent: '#2563eb',
  accentSoft: '#eff6ff',
  accentBorder: '#bfdbfe',
  // Status palette
  successBg: '#ecfdf5',
  successFg: '#047857',
  successBorder: '#a7f3d0',
  neutralBg: '#f1f5f9',
  neutralFg: '#64748b',
  // Priority
  urgentBg: '#fef2f2',
  urgentFg: '#b91c1c',
  urgentBorder: '#fecaca',
  highBg: '#fff7ed',
  highFg: '#c2410c',
  highBorder: '#fed7aa',
  medBg: '#fefce8',
  medFg: '#a16207',
  medBorder: '#fde68a',
  lowBg: '#f0fdfa',
  lowFg: '#0f766e',
  lowBorder: '#99f6e4',
  // Typography
  fontUi:
    '"Inter var", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  fontNum:
    '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  // Shadow
  shadowSm: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 1px rgba(15, 23, 42, 0.03)',
  shadowMd: '0 4px 16px -4px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
};

const priorityStyle = (priority?: string) => {
  switch (priority) {
    case 'Urgent':
      return { bg: tokens.urgentBg, fg: tokens.urgentFg, border: tokens.urgentBorder, dot: '#dc2626' };
    case 'High':
      return { bg: tokens.highBg, fg: tokens.highFg, border: tokens.highBorder, dot: '#ea580c' };
    case 'Medium':
      return { bg: tokens.medBg, fg: tokens.medFg, border: tokens.medBorder, dot: '#ca8a04' };
    case 'Low':
      return { bg: tokens.lowBg, fg: tokens.lowFg, border: tokens.lowBorder, dot: '#0d9488' };
    default:
      return { bg: tokens.neutralBg, fg: tokens.neutralFg, border: tokens.border, dot: '#94a3b8' };
  }
};

/* ---------- Inline CSS for interactive states ---------- */
const scopedCss = `
  .pmreg-root {
    --col-ink: ${tokens.ink};
    --col-ink-mid: ${tokens.inkMid};
    --col-ink-muted: ${tokens.inkMuted};
    --col-border: ${tokens.border};
    --col-border-subtle: ${tokens.borderSubtle};
    --col-accent: ${tokens.accent};
    font-family: ${tokens.fontUi};
    color: var(--col-ink);
    font-feature-settings: "cv11", "ss01", "ss03";
    -webkit-font-smoothing: antialiased;
  }
  .pmreg-root *, .pmreg-root *::before, .pmreg-root *::after { box-sizing: border-box; }

  .pmreg-row { transition: background-color 120ms ease; }
  .pmreg-row:hover { background: ${tokens.surfaceHover}; }
  .pmreg-row:hover .pmreg-name { color: ${tokens.accent}; }

  .pmreg-cell { transition: box-shadow 120ms ease; }
  .pmreg-cell[data-editable="true"]:hover {
    box-shadow: inset 0 0 0 1px ${tokens.borderStrong};
    cursor: text;
  }
  .pmreg-cell[data-editable="true"]:hover .pmreg-edit-hint { opacity: 1; }
  .pmreg-edit-hint {
    opacity: 0;
    transition: opacity 120ms ease;
    font-size: 0.68rem;
    color: ${tokens.inkMuted};
    margin-left: 6px;
    letter-spacing: 0.02em;
  }

  .pmreg-input,
  .pmreg-select,
  .pmreg-textarea {
    width: 100%;
    font-family: inherit;
    font-size: 0.8rem;
    color: var(--col-ink);
    background: ${tokens.surface};
    border: 1px solid ${tokens.border};
    border-radius: 6px;
    padding: 6px 9px;
    outline: none;
    transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
  }
  .pmreg-input:hover,
  .pmreg-select:hover { border-color: ${tokens.borderStrong}; }
  .pmreg-input:focus,
  .pmreg-select:focus,
  .pmreg-textarea:focus {
    border-color: ${tokens.accent};
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
    background: ${tokens.surface};
  }
  .pmreg-textarea { resize: vertical; min-height: 64px; line-height: 1.45; }

  .pmreg-filter-input,
  .pmreg-filter-select {
    width: 100%;
    font-family: inherit;
    font-size: 0.74rem;
    color: ${tokens.inkMid};
    background: ${tokens.surface};
    border: 1px solid ${tokens.border};
    border-radius: 5px;
    padding: 4px 7px;
    outline: none;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .pmreg-filter-input::placeholder { color: ${tokens.inkMuted}; }
  .pmreg-filter-input:focus,
  .pmreg-filter-select:focus {
    border-color: ${tokens.accent};
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
  }

  .pmreg-search {
    width: 280px;
    font-family: inherit;
    font-size: 0.82rem;
    color: var(--col-ink);
    background: ${tokens.surface};
    border: 1px solid ${tokens.border};
    border-radius: 8px;
    padding: 8px 12px 8px 34px;
    outline: none;
    transition: border-color 120ms ease, box-shadow 120ms ease, width 180ms ease;
  }
  .pmreg-search::placeholder { color: ${tokens.inkMuted}; }
  .pmreg-search:focus {
    border-color: ${tokens.accent};
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
    width: 320px;
  }

  .pmreg-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    border: 1px solid transparent;
    white-space: nowrap;
  }
  .pmreg-chip-dot {
    width: 6px; height: 6px; border-radius: 50%;
  }

  .pmreg-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    transition: transform 100ms ease;
  }
  .pmreg-dot-done {
    background: ${tokens.successFg};
    box-shadow: 0 0 0 2px ${tokens.successBg};
  }
  .pmreg-dot-empty {
    background: transparent;
    border: 1.5px solid #cbd5e1;
  }
  .pmreg-row:hover .pmreg-dot-done { transform: scale(1.2); }

  .pmreg-deliv-th {
    width: 36px;
    min-width: 36px;
    max-width: 36px;
    padding: 10px 2px !important;
    text-align: center !important;
    border-left: 1px solid ${tokens.borderSubtle};
  }
  .pmreg-deliv-th-abbr {
    display: inline-block;
    font-family: ${tokens.fontNum};
    font-size: 0.68rem;
    font-weight: 700;
    color: ${tokens.inkMid};
    letter-spacing: 0.04em;
    cursor: help;
  }
  .pmreg-deliv-cell {
    width: 36px;
    min-width: 36px;
    max-width: 36px;
    padding: 12px 2px !important;
    text-align: center;
    border-left: 1px solid ${tokens.borderSubtle};
  }
  .pmreg-deliv-group-header {
    background: ${tokens.surfaceSunk};
    border-left: 2px solid ${tokens.border} !important;
  }
  .pmreg-deliv-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    background: ${tokens.surfaceAlt};
    border-bottom: 1px solid ${tokens.borderSubtle};
    font-size: 0.75rem;
    color: ${tokens.inkMid};
  }
  .pmreg-deliv-toolbar-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: ${tokens.surface};
    border: 1px solid ${tokens.border};
    border-radius: 999px;
    font-size: 0.72rem;
    cursor: pointer;
    transition: all 120ms ease;
  }
  .pmreg-deliv-toolbar-pill:hover {
    border-color: ${tokens.borderStrong};
    background: ${tokens.surfaceHover};
  }
  .pmreg-deliv-toolbar-pill[data-active="true"] {
    background: ${tokens.accentSoft};
    border-color: ${tokens.accentBorder};
    color: ${tokens.accent};
    font-weight: 600;
  }

  .pmreg-atglance-overlay {
    position: fixed;
    inset: 0;
    background: rgba(2, 6, 23, 0.45);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1200;
    padding: 20px;
  }
  .pmreg-atglance-card {
    width: min(760px, 96vw);
    max-height: calc(100vh - 40px);
    overflow: auto;
    background: ${tokens.surface};
    border: 1px solid ${tokens.border};
    border-radius: 14px;
    box-shadow: ${tokens.shadowMd};
  }
  .pmreg-atglance-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 18px;
    border-bottom: 1px solid ${tokens.borderSubtle};
    background: linear-gradient(to bottom, ${tokens.surface}, ${tokens.surfaceAlt});
  }
  .pmreg-atglance-title {
    margin: 0;
    font-size: 1.02rem;
    font-weight: 700;
    color: ${tokens.ink};
  }
  .pmreg-atglance-sub {
    margin: 4px 0 0;
    font-size: 0.76rem;
    color: ${tokens.inkMuted};
  }
  .pmreg-atglance-close {
    border: 1px solid ${tokens.border};
    background: ${tokens.surface};
    color: ${tokens.inkMid};
    border-radius: 8px;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: 600;
  }
  .pmreg-atglance-close:hover {
    border-color: ${tokens.borderStrong};
    background: ${tokens.surfaceHover};
  }
  .pmreg-atglance-body {
    padding: 14px 18px 18px;
    display: grid;
    gap: 12px;
  }
  .pmreg-atglance-metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .pmreg-atglance-metric {
    border: 1px solid ${tokens.borderSubtle};
    background: ${tokens.surfaceAlt};
    border-radius: 10px;
    padding: 8px 10px;
  }
  .pmreg-atglance-k {
    font-size: 0.68rem;
    color: ${tokens.inkMuted};
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 700;
  }
  .pmreg-atglance-v {
    margin-top: 4px;
    font-size: 0.83rem;
    color: ${tokens.ink};
    font-weight: 600;
  }
  .pmreg-atglance-notes {
    border: 1px solid ${tokens.borderSubtle};
    border-radius: 10px;
    padding: 10px 12px;
    background: ${tokens.surface};
    font-size: 0.8rem;
    color: ${tokens.inkMid};
    line-height: 1.5;
    white-space: pre-wrap;
  }
  .pmreg-atglance-deliverables {
    border: 1px solid ${tokens.borderSubtle};
    border-radius: 10px;
    background: ${tokens.surface};
    overflow: hidden;
  }
  .pmreg-atglance-deliverables-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid ${tokens.borderSubtle};
    background: ${tokens.surfaceAlt};
    font-size: 0.78rem;
    color: ${tokens.inkMid};
    font-weight: 600;
  }
  .pmreg-atglance-deliverables-list {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 10px 12px 12px;
  }
  .pmreg-atglance-deliv-block {
    border: 1px solid ${tokens.borderSubtle};
    border-radius: 8px;
    padding: 8px 10px;
    background: ${tokens.surface};
  }
  .pmreg-atglance-deliv-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.79rem;
    color: ${tokens.inkMid};
  }
  .pmreg-atglance-deliv-main {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .pmreg-atglance-deliv-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pmreg-atglance-deliv-col {
    font-size: 0.7rem;
    color: ${tokens.inkMuted};
    border: 1px solid ${tokens.borderSubtle};
    border-radius: 999px;
    padding: 2px 8px;
    background: ${tokens.surfaceAlt};
    white-space: nowrap;
  }
  .pmreg-atglance-task-list {
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 6px;
  }
  .pmreg-atglance-task-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-left: 18px;
    position: relative;
    font-size: 0.75rem;
    color: ${tokens.inkMid};
  }
  .pmreg-atglance-task-item::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${tokens.borderStrong};
    position: absolute;
    left: 4px;
    top: 50%;
    transform: translateY(-50%);
  }
  .pmreg-atglance-task-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pmreg-atglance-task-col {
    font-size: 0.68rem;
    color: ${tokens.inkMuted};
    border: 1px solid ${tokens.borderSubtle};
    border-radius: 999px;
    padding: 1px 7px;
    background: ${tokens.surfaceAlt};
    white-space: nowrap;
  }
  .pmreg-atglance-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .pmreg-atglance-btn {
    border: 1px solid ${tokens.border};
    background: ${tokens.surface};
    color: ${tokens.inkMid};
    border-radius: 8px;
    padding: 7px 12px;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: 600;
  }
  .pmreg-atglance-btn-primary {
    border-color: ${tokens.accentBorder};
    background: ${tokens.accentSoft};
    color: ${tokens.accent};
  }
  .pmreg-atglance-btn:hover { border-color: ${tokens.borderStrong}; background: ${tokens.surfaceHover}; }
  .pmreg-atglance-btn-primary:hover { background: #dbeafe; border-color: ${tokens.accent}; }

  .pmreg-add-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
    color: ${tokens.accent};
    background: ${tokens.accentSoft};
    border: 1px dashed ${tokens.accentBorder};
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .pmreg-add-btn:hover {
    background: #dbeafe;
    border-style: solid;
  }

  .pmreg-thead th {
    position: sticky; top: 0; z-index: 2;
    background: ${tokens.surfaceSunk};
  }
  .pmreg-thead-filter th {
    position: sticky; top: 38px; z-index: 1;
    background: ${tokens.surfaceAlt};
  }

  .pmreg-name-cell {
    position: relative;
  }
  .pmreg-name-cell::before {
    content: '';
    position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px;
    background: transparent; border-radius: 0 2px 2px 0;
    transition: background 120ms ease;
  }
  .pmreg-row:hover .pmreg-name-cell::before { background: ${tokens.accent}; }

  /* Scrollbar */
  .pmreg-scroll::-webkit-scrollbar { height: 10px; width: 10px; }
  .pmreg-scroll::-webkit-scrollbar-track { background: transparent; }
  .pmreg-scroll::-webkit-scrollbar-thumb {
    background: #e2e8f0; border-radius: 10px; border: 2px solid ${tokens.surface};
  }
  .pmreg-scroll::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
`;

const SearchIcon: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: tokens.inkMuted, pointerEvents: 'none' }}
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const PMProjectsRegistryView: React.FC<Props> = ({
  projects,
  users,
  setProjects,
  globalSearchTerm,
}) => {
  const navigate = useNavigate();
  const [localSearch, setLocalSearch] = useState('');
  const [filters, setFilters] = useState({
    name: '',
    where: '',
    packageLabel: '',
    comments: '',
    pm: '',
    startDate: '',
    finishDate: '',
    pmPriority: '',
  });
  const [deliverableMode, setDeliverableMode] = useState<'all' | 'incomplete' | 'complete'>('all');
  const [editingCell, setEditingCell] = useState<{
    projectId: string;
    field: EditableField;
  } | null>(null);
  const [atGlanceProject, setAtGlanceProject] = useState<any | null>(null);
  const [atGlanceLoading, setAtGlanceLoading] = useState(false);
  const [draftValue, setDraftValue] = useState('');
  const [savingPmFor, setSavingPmFor] = useState<string | null>(null);
  const [metaMap, setMetaMap] = useState<Record<string, ProjectRegistryMeta>>(() =>
    projectRegistryMetaService.getAll(),
  );

  const refreshMeta = () => setMetaMap(projectRegistryMetaService.getAll());

  const getMeta = useCallback(
    (projectId: string): ProjectRegistryMeta =>
      metaMap[projectId] || { deliverables: { logo: false, smb: false, bb: false, sk: false } },
    [metaMap],
  );

  const getText = (val: unknown) => (val == null ? '' : String(val));
  const getProjectStartDate = (project: any): string =>
    project?.createdAt ? new Date(project.createdAt).toISOString().slice(0, 10) : '';

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const commitMetaField = (projectId: string, field: EditableField, value: string) => {
    if (field === 'pmId' || field === 'clientType' || field === 'projectPriority') return;
    const normalized = value.trim();
    const patch: Partial<ProjectRegistryMeta> = {};
    if (field === 'where') patch.where = normalized;
    else if (field === 'comments') patch.comments = value;
    else if (field === 'finishDate') patch.finishDate = normalized;
    projectRegistryMetaService.upsert(projectId, patch);
    refreshMeta();
  };

  const startEdit = (projectId: string, field: EditableField, value: string) => {
    setEditingCell({ projectId, field });
    setDraftValue(value);
  };

  const handleOpenAtGlance = useCallback(async (project: any) => {
    setAtGlanceProject(project);
    setAtGlanceLoading(true);
    try {
      const [fullProject, boardData] = await Promise.all([
        projectService.getOne(project.id),
        boardViewService.fetch({ projectId: project.id, page: 1, pageSize: 1 }),
      ]);
      const boardProject = boardData?.projects?.[0];
      setAtGlanceProject((prev: any) => {
        if (!prev || prev.id !== project.id) return prev;
        return {
          ...fullProject,
          // Use Tuesday's L3-ready deliverable/task tree shape when available.
          deliverables: boardProject?.deliverables || fullProject?.deliverables || [],
          // Keep PM-list naming contract for title rendering.
          clientName: fullProject?.clientName || project?.clientName || boardProject?.name || '',
        };
      });
    } catch {
      // Keep lightweight row data if details fetch fails.
    } finally {
      setAtGlanceLoading(false);
    }
  }, []);

  const saveEdit = (project: any) => {
    if (!editingCell || editingCell.projectId !== project.id) return;
    if (editingCell.field === 'pmId') return;
    if (editingCell.field === 'clientType') {
      const nextType = draftValue.trim();
      if (nextType && nextType !== project.clientType) {
        projectService
          .update(project.id, { clientType: nextType })
          .then(() => {
            setProjects((prev) =>
              prev.map((row) => (row.id === project.id ? { ...row, clientType: nextType } : row)),
            );
          })
          .catch((err: any) => {
            alert(err?.response?.data?.message || err?.message || 'Failed to update client type');
          });
      }
      setEditingCell(null);
      setDraftValue('');
      return;
    }
    if (editingCell.field === 'projectPriority') {
      const nextPriority = draftValue.trim();
      if (!nextPriority) {
        setEditingCell(null);
        setDraftValue('');
        return;
      }
      if (nextPriority !== (project.priority || '')) {
        projectService
          .update(project.id, { priority: nextPriority })
          .then(() => {
            setProjects((prev) =>
              prev.map((row) => (row.id === project.id ? { ...row, priority: nextPriority } : row)),
            );
          })
          .catch((err: any) => {
            alert(err?.response?.data?.message || err?.message || 'Failed to update priority');
          });
      }
      setEditingCell(null);
      setDraftValue('');
      return;
    }
    commitMetaField(project.id, editingCell.field, draftValue);
    setEditingCell(null);
    setDraftValue('');
  };

  const deliverableColumns = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const p of projects) {
      for (const d of p?.deliverables || []) {
        const name = getDeliverableName(d);
        if (!name) continue;
        const key = normalizeDeliverableName(name);
        if (!byKey.has(key)) byKey.set(key, name);
      }
    }
    const values = Array.from(byKey.values());
    values.sort((a, b) => {
      const ai = CORE_DELIVERABLE_ORDER.findIndex((x) => x.toLowerCase() === a.toLowerCase());
      const bi = CORE_DELIVERABLE_ORDER.findIndex((x) => x.toLowerCase() === b.toLowerCase());
      if (ai !== -1 || bi !== -1) {
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }
      return a.localeCompare(b);
    });
    return values;
  }, [projects]);

  const projectDeliverableMap = useCallback((project: any) => {
    const out = new Map<string, any>();
    for (const d of project?.deliverables || []) {
      const name = getDeliverableName(d);
      if (!name) continue;
      out.set(normalizeDeliverableName(name), d);
    }
    return out;
  }, []);

  const rows = useMemo(() => {
    const allSearch = `${globalSearchTerm} ${localSearch}`.trim().toLowerCase();
    return projects.filter((p) => {
      const m = getMeta(p.id);
      const pmName =
        users.find((u: any) => u.id === (p.pmId || p.pm?.id))?.name || p.pm?.name || '';
      const deliverableMap = projectDeliverableMap(p);
      const startDateValue = getProjectStartDate(p);
      const deliverableNames = Array.from(deliverableMap.keys()).join(' ');

      const haystack = [
        p.clientName,
        m.where,
        m.packageLabel,
        m.comments,
        pmName,
        startDateValue,
        m.finishDate,
        p.priority,
        deliverableNames,
      ]
        .map(getText)
        .join(' ')
        .toLowerCase();
      if (allSearch && !haystack.includes(allSearch)) return false;

      if (filters.name && !getText(p.clientName).toLowerCase().includes(filters.name.toLowerCase()))
        return false;
      if (filters.where && getText(m.where) !== filters.where) return false;
      if (filters.packageLabel && getText(p.clientType) !== filters.packageLabel) return false;
      if (
        filters.comments &&
        !getText(m.comments).toLowerCase().includes(filters.comments.toLowerCase())
      )
        return false;
      if (filters.pm && !pmName.toLowerCase().includes(filters.pm.toLowerCase())) return false;
      if (filters.startDate && getText(startDateValue) !== filters.startDate) return false;
      if (filters.finishDate && getText(m.finishDate) !== filters.finishDate) return false;
      if (filters.pmPriority && getText(p.priority) !== filters.pmPriority) return false;
      if (deliverableMode !== 'all') {
        const totalDel = deliverableColumns.length;
        const doneCount = deliverableColumns.filter((c) =>
          deliverableMap.has(normalizeDeliverableName(c)),
        ).length;
        if (deliverableMode === 'complete' && doneCount !== totalDel) return false;
        if (deliverableMode === 'incomplete' && doneCount === totalDel) return false;
      }
      return true;
    });
  }, [
    projects,
    users,
    filters,
    deliverableMode,
    deliverableColumns,
    globalSearchTerm,
    localSearch,
    getMeta,
    projectDeliverableMap,
  ]);

  const totalCount = projects.length;
  const shownCount = rows.length;

  const atGlanceData = useMemo(() => {
    if (!atGlanceProject) return null;
    const meta = getMeta(atGlanceProject.id);
    const listMap = new Map<string, { name: string; currentColumn: string; done: boolean; tasks: Array<{ id: string; title: string; currentColumn: string }> }>();
    for (const d of atGlanceProject.deliverables || []) {
      const name = getDeliverableName(d);
      if (!name) continue;
      const currentColumn = getDeliverableCurrentColumn(d);
      const tasks = Array.isArray(d.tasks)
        ? d.tasks.map((t: any, idx: number) => ({
            id: t?.id || `${name}-${idx}`,
            title: t?.title || 'Untitled task',
            currentColumn: getTaskCurrentColumn(t),
          }))
        : [];
      const key = normalizeDeliverableName(name);
      const done = /(approved|complete|completed|done)/i.test(currentColumn);
      if (!listMap.has(key)) listMap.set(key, { name, currentColumn, done, tasks });
    }
    const projectDeliverables = Array.from(listMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const doneCount = projectDeliverables.filter((d) => d.done).length;
    const totalTracked = projectDeliverables.length;
    const completion = totalTracked > 0 ? Math.round((doneCount / totalTracked) * 100) : 0;
    const pmName =
      users.find((u: any) => u.id === (atGlanceProject.pmId || atGlanceProject.pm?.id))?.name
      || atGlanceProject.pm?.name
      || 'Unassigned';
    return { meta, projectDeliverables, doneCount, totalTracked, completion, pmName };
  }, [atGlanceProject, getMeta, users]);

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 14px',
    borderBottom: `1px solid ${tokens.border}`,
    color: tokens.inkMid,
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  };
  const thFilterStyle: React.CSSProperties = {
    padding: '8px 10px',
    borderBottom: `1px solid ${tokens.border}`,
  };
  const tdStyle: React.CSSProperties = {
    padding: '12px 14px',
    fontSize: '0.82rem',
    color: tokens.ink,
    verticalAlign: 'middle',
  };

  return (
    <div
      className="pmreg-root"
      style={{
        background: tokens.surface,
        border: `1px solid ${tokens.border}`,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: tokens.shadowMd,
      }}
    >
      <style>{scopedCss}</style>

      {/* ---------- Header ---------- */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${tokens.border}`,
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          background: `linear-gradient(to bottom, ${tokens.surface}, ${tokens.surfaceAlt})`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h3
            style={{
              margin: 0,
              fontSize: '0.95rem',
              fontWeight: 700,
              color: tokens.ink,
              letterSpacing: '-0.01em',
            }}
          >
            PM List
          </h3>
          <span
            style={{
              fontSize: '0.72rem',
              color: tokens.inkMuted,
              fontFamily: tokens.fontNum,
              fontWeight: 500,
            }}
          >
            {shownCount === totalCount ? totalCount : `${shownCount} / ${totalCount}`}
          </span>
        </div>

        <span
          style={{
            fontSize: '0.72rem',
            color: tokens.inkMuted,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <kbd
            style={{
              fontFamily: tokens.fontNum,
              fontSize: '0.68rem',
              padding: '1px 6px',
              border: `1px solid ${tokens.border}`,
              borderRadius: 4,
              background: tokens.surface,
              color: tokens.inkMid,
              boxShadow: `0 1px 0 ${tokens.border}`,
            }}
          >
            dbl-click
          </kbd>
          any cell to edit
        </span>

        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <SearchIcon />
          <input
            className="pmreg-search"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search inside PM list…"
          />
        </div>
      </div>

      <div className="pmreg-deliv-toolbar">
        <span style={{ fontWeight: 600, color: tokens.inkMid }}>Deliverables:</span>
        <button
          className="pmreg-deliv-toolbar-pill"
          data-active={deliverableMode === 'all'}
          onClick={() => setDeliverableMode('all')}
        >
          All projects
        </button>
        <button
          className="pmreg-deliv-toolbar-pill"
          data-active={deliverableMode === 'incomplete'}
          onClick={() => setDeliverableMode('incomplete')}
        >
          With pending
        </button>
        <button
          className="pmreg-deliv-toolbar-pill"
          data-active={deliverableMode === 'complete'}
          onClick={() => setDeliverableMode('complete')}
        >
          Fully done
        </button>
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: tokens.inkMuted }}>
          {deliverableColumns.length} deliverable{deliverableColumns.length !== 1 ? 's' : ''} tracked · hover header for full name
        </span>
      </div>

      {/* ---------- Table ---------- */}
      <div className="pmreg-scroll" style={{ overflowX: 'auto', maxHeight: '72vh', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead className="pmreg-thead">
            <tr>
              {['Name', 'Where', 'Package', 'Comments / Notes', 'PM', 'Start', 'Finish', 'Priority'].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
              {deliverableColumns.map((name, i) => (
                <th
                  key={name}
                  className={`pmreg-deliv-th${i === 0 ? ' pmreg-deliv-group-header' : ''}`}
                >
                  <span className="pmreg-deliv-th-abbr" title={name}>
                    {abbreviate(name)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <thead className="pmreg-thead-filter">
            <tr>
              <th style={thFilterStyle}>
                <input
                  className="pmreg-filter-input"
                  value={filters.name}
                  onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Filter…"
                />
              </th>
              <th style={thFilterStyle}>
                <select
                  className="pmreg-filter-select"
                  value={filters.where}
                  onChange={(e) => setFilters((f) => ({ ...f, where: e.target.value }))}
                >
                  <option value="">All</option>
                  {WHERE_OPTIONS.filter(Boolean).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </th>
              <th style={thFilterStyle}>
                <select
                  className="pmreg-filter-select"
                  value={filters.packageLabel}
                  onChange={(e) => setFilters((f) => ({ ...f, packageLabel: e.target.value }))}
                >
                  <option value="">All</option>
                  {CLIENT_TYPE_OPTIONS.filter(Boolean).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </th>
              <th style={thFilterStyle}>
                <input
                  className="pmreg-filter-input"
                  value={filters.comments}
                  onChange={(e) => setFilters((f) => ({ ...f, comments: e.target.value }))}
                  placeholder="Filter notes…"
                />
              </th>
              <th style={thFilterStyle}>
                <input
                  className="pmreg-filter-input"
                  value={filters.pm}
                  onChange={(e) => setFilters((f) => ({ ...f, pm: e.target.value }))}
                  placeholder="Filter…"
                />
              </th>
              <th style={thFilterStyle}>
                <input
                  type="date"
                  className="pmreg-filter-input"
                  value={filters.startDate}
                  onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
                />
              </th>
              <th style={thFilterStyle}>
                <input
                  type="date"
                  className="pmreg-filter-input"
                  value={filters.finishDate}
                  onChange={(e) => setFilters((f) => ({ ...f, finishDate: e.target.value }))}
                />
              </th>
              <th style={thFilterStyle}>
                <select
                  className="pmreg-filter-select"
                  value={filters.pmPriority}
                  onChange={(e) => setFilters((f) => ({ ...f, pmPriority: e.target.value }))}
                >
                  <option value="">All</option>
                  <option value="Urgent">Urgent</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </th>
              {deliverableColumns.length > 0 && (
                <th
                  colSpan={deliverableColumns.length}
                  style={{ ...thFilterStyle, padding: '6px 10px', textAlign: 'center', color: tokens.inkMuted, fontSize: '0.7rem' }}
                >
                  use buttons above to filter
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const m = getMeta(p.id);
              const deliverableMap = projectDeliverableMap(p);
              const pmId = p.pmId || p.pm?.id || '';
              const isEditing = (field: EditableField) =>
                editingCell?.projectId === p.id && editingCell?.field === field;
              const priStyle = priorityStyle(p.priority);

              return (
                <tr
                  key={p.id}
                  className="pmreg-row"
                  style={{ borderBottom: `1px solid ${tokens.borderSubtle}` }}
                >
                  {/* Name */}
                  <td
                    className="pmreg-name-cell"
                    style={{ ...tdStyle, paddingLeft: 18, cursor: 'pointer' }}
                    onClick={() => handleOpenAtGlance(p)}
                    onDoubleClick={() => navigate(`/project/${p.id}`)}
                  >
                    <span
                      className="pmreg-name"
                      style={{
                        fontWeight: 600,
                        color: tokens.ink,
                        transition: 'color 120ms ease',
                        letterSpacing: '-0.005em',
                      }}
                    >
                      {p.clientName}
                    </span>
                  </td>

                  {/* Where */}
                  <td
                    className="pmreg-cell"
                    data-editable="true"
                    style={tdStyle}
                    onDoubleClick={() => startEdit(p.id, 'where', m.where || '')}
                  >
                    {isEditing('where') ? (
                      <select
                        className="pmreg-select"
                        autoFocus
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        onBlur={() => saveEdit(p)}
                      >
                        {WHERE_OPTIONS.map((o) => (
                          <option key={o || '_'} value={o}>
                            {o || '—'}
                          </option>
                        ))}
                      </select>
                    ) : m.where ? (
                      <span
                        className="pmreg-chip"
                        style={{
                          background: tokens.neutralBg,
                          color: tokens.inkMid,
                          borderColor: tokens.border,
                        }}
                      >
                        {m.where}
                      </span>
                    ) : (
                      <span style={{ color: tokens.inkMuted }}>—</span>
                    )}
                  </td>

                  {/* Package */}
                  <td
                    className="pmreg-cell"
                    data-editable="true"
                    style={tdStyle}
                    onDoubleClick={() => startEdit(p.id, 'clientType', p.clientType || '')}
                  >
                    {isEditing('clientType') ? (
                      <select
                        className="pmreg-select"
                        autoFocus
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        onBlur={() => saveEdit(p)}
                      >
                        {CLIENT_TYPE_OPTIONS.map((o) => (
                          <option key={o || '_'} value={o}>
                            {o || '—'}
                          </option>
                        ))}
                      </select>
                    ) : p.clientType ? (
                      <span
                        className="pmreg-chip"
                        style={{
                          background: tokens.accentSoft,
                          color: tokens.accent,
                          borderColor: tokens.accentBorder,
                        }}
                      >
                        {p.clientType}
                      </span>
                    ) : (
                      <span style={{ color: tokens.inkMuted }}>—</span>
                    )}
                  </td>

                  {/* Comments */}
                  <td
                    className="pmreg-cell"
                    data-editable="true"
                    style={{ ...tdStyle, maxWidth: 320 }}
                    onDoubleClick={() => startEdit(p.id, 'comments', m.comments || '')}
                  >
                    {isEditing('comments') ? (
                      <textarea
                        className="pmreg-textarea"
                        autoFocus
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        onBlur={() => saveEdit(p)}
                        rows={3}
                        placeholder="Add comment, note, or reminder…"
                      />
                    ) : m.comments ? (
                      <span
                        title={m.comments || ''}
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.5,
                          color: tokens.inkMid,
                          fontSize: '0.8rem',
                        }}
                      >
                        {m.comments}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="pmreg-add-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(p.id, 'comments', '');
                        }}
                      >
                        <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>+</span>
                        Add note
                      </button>
                    )}
                  </td>

                  {/* PM */}
                  <td style={tdStyle}>
                    <select
                      className="pmreg-select"
                      value={pmId}
                      disabled={savingPmFor === p.id}
                      onChange={async (e) => {
                        const newPmId = e.target.value;
                        if (!newPmId || newPmId === pmId) return;
                        setSavingPmFor(p.id);
                        try {
                          await projectService.update(p.id, { pmId: newPmId });
                          const newPM = users.find((u: any) => u.id === newPmId);
                          setProjects((prev) =>
                            prev.map((row) =>
                              row.id === p.id ? { ...row, pmId: newPmId, pm: newPM || row.pm } : row,
                            ),
                          );
                        } finally {
                          setSavingPmFor(null);
                        }
                      }}
                      style={{
                        fontWeight: pmId ? 500 : 400,
                        color: pmId ? tokens.ink : tokens.inkMuted,
                      }}
                    >
                      <option value="">Unassigned</option>
                      {users
                        .filter((u: any) => u.role === 'Project Manager')
                        .map((pm: any) => (
                          <option key={pm.id} value={pm.id}>
                            {pm.name}
                          </option>
                        ))}
                    </select>
                  </td>

                  {/* Start date */}
                  <td style={{ ...tdStyle, color: tokens.inkMid, fontFamily: tokens.fontNum, fontSize: '0.78rem' }}>
                    {formatDate(getProjectStartDate(p)) || <span style={{ color: tokens.inkMuted }}>—</span>}
                  </td>

                  {/* Finish date */}
                  <td
                    className="pmreg-cell"
                    data-editable="true"
                    style={{ ...tdStyle, color: tokens.inkMid, fontFamily: tokens.fontNum, fontSize: '0.78rem' }}
                    onDoubleClick={() => startEdit(p.id, 'finishDate', m.finishDate || '')}
                  >
                    {isEditing('finishDate') ? (
                      <input
                        type="date"
                        className="pmreg-input"
                        autoFocus
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        onBlur={() => saveEdit(p)}
                      />
                    ) : m.finishDate ? (
                      formatDate(m.finishDate)
                    ) : (
                      <span style={{ color: tokens.inkMuted }}>—</span>
                    )}
                  </td>

                  {/* Priority */}
                  <td
                    className="pmreg-cell"
                    data-editable="true"
                    style={tdStyle}
                    onDoubleClick={() => startEdit(p.id, 'projectPriority', p.priority || '')}
                  >
                    {isEditing('projectPriority') ? (
                      <select
                        className="pmreg-select"
                        autoFocus
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        onBlur={() => saveEdit(p)}
                      >
                        {PROJECT_PRIORITY_OPTIONS.map((o) => (
                          <option key={o || '_'} value={o}>
                            {o || '—'}
                          </option>
                        ))}
                      </select>
                    ) : p.priority ? (
                      <span
                        className="pmreg-chip"
                        style={{
                          background: priStyle.bg,
                          color: priStyle.fg,
                          borderColor: priStyle.border,
                        }}
                      >
                        <span className="pmreg-chip-dot" style={{ background: priStyle.dot }} />
                        {p.priority}
                      </span>
                    ) : (
                      <span style={{ color: tokens.inkMuted }}>—</span>
                    )}
                  </td>

                  {/* Deliverables (actual + custom) */}
                  {deliverableColumns.map((name, i) => {
                    const item = deliverableMap.get(normalizeDeliverableName(name));
                    const hasDeliverable = !!item;
                    return (
                      <td
                        key={name}
                        className={`pmreg-deliv-cell${i === 0 ? ' pmreg-deliv-group-header' : ''}`}
                        title={`${name}: ${hasDeliverable ? 'Done' : 'Not done'}`}
                      >
                        <span
                          className={`pmreg-dot ${hasDeliverable ? 'pmreg-dot-done' : 'pmreg-dot-empty'}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={8 + Math.max(deliverableColumns.length, 1)}
                  style={{
                    textAlign: 'center',
                    padding: '48px 20px',
                    color: tokens.inkMuted,
                  }}
                >
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, color: tokens.inkMid, marginBottom: 4 }}>
                    No projects found
                  </div>
                  <div style={{ fontSize: '0.8rem' }}>
                    Try adjusting your search or filters.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {atGlanceProject && atGlanceData && (
        <div className="pmreg-atglance-overlay" onClick={() => setAtGlanceProject(null)}>
          <div className="pmreg-atglance-card" onClick={(e) => e.stopPropagation()}>
            <div className="pmreg-atglance-head">
              <div>
                <h4 className="pmreg-atglance-title">{atGlanceProject.clientName}</h4>
                <p className="pmreg-atglance-sub">
                  Client At a Glance
                  {atGlanceLoading ? ' • Loading latest tasks…' : ''}
                </p>
              </div>
              <button className="pmreg-atglance-close" onClick={() => setAtGlanceProject(null)}>
                Close
              </button>
            </div>
            <div className="pmreg-atglance-body">
              <div className="pmreg-atglance-metrics">
                <div className="pmreg-atglance-metric">
                  <div className="pmreg-atglance-k">Package</div>
                  <div className="pmreg-atglance-v">{atGlanceProject.clientType || '—'}</div>
                </div>
                <div className="pmreg-atglance-metric">
                  <div className="pmreg-atglance-k">Project Manager</div>
                  <div className="pmreg-atglance-v">{atGlanceData.pmName}</div>
                </div>
                <div className="pmreg-atglance-metric">
                  <div className="pmreg-atglance-k">Priority</div>
                  <div className="pmreg-atglance-v">{atGlanceProject.priority || '—'}</div>
                </div>
                <div className="pmreg-atglance-metric">
                  <div className="pmreg-atglance-k">Where</div>
                  <div className="pmreg-atglance-v">{atGlanceData.meta.where || '—'}</div>
                </div>
                <div className="pmreg-atglance-metric">
                  <div className="pmreg-atglance-k">Start</div>
                  <div className="pmreg-atglance-v">{formatDate(getProjectStartDate(atGlanceProject)) || '—'}</div>
                </div>
                <div className="pmreg-atglance-metric">
                  <div className="pmreg-atglance-k">Finish</div>
                  <div className="pmreg-atglance-v">{formatDate(atGlanceData.meta.finishDate || '') || '—'}</div>
                </div>
              </div>

              <div className="pmreg-atglance-deliverables">
                <div className="pmreg-atglance-deliverables-head">
                  <span>Deliverables</span>
                  <span>{atGlanceData.doneCount}/{atGlanceData.totalTracked} ({atGlanceData.completion}%)</span>
                </div>
                <div className="pmreg-atglance-deliverables-list">
                  {atGlanceData.projectDeliverables.length === 0 && (
                    <div className="pmreg-atglance-deliv-item">
                      <span className="pmreg-atglance-deliv-name">No deliverables yet.</span>
                    </div>
                  )}
                  {atGlanceData.projectDeliverables.map((item) => (
                    <div key={item.name} className="pmreg-atglance-deliv-block">
                      <div className="pmreg-atglance-deliv-item">
                        <span className="pmreg-atglance-deliv-main">
                          <span className={`pmreg-dot ${item.done ? 'pmreg-dot-done' : 'pmreg-dot-empty'}`} />
                          <span className="pmreg-atglance-deliv-name">{item.name}</span>
                        </span>
                        <span className="pmreg-atglance-deliv-col">{item.currentColumn}</span>
                      </div>
                      {item.tasks.length > 0 ? (
                        <ul className="pmreg-atglance-task-list">
                          {item.tasks.map((task) => (
                            <li key={task.id} className="pmreg-atglance-task-item">
                              <span className="pmreg-atglance-task-title">{task.title}</span>
                              <span className="pmreg-atglance-task-col">{task.currentColumn}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <ul className="pmreg-atglance-task-list">
                          <li className="pmreg-atglance-task-item">
                            <span className="pmreg-atglance-task-title">No tasks yet.</span>
                          </li>
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pmreg-atglance-notes">
                {atGlanceData.meta.comments || 'No notes yet.'}
              </div>

              <div className="pmreg-atglance-actions">
                <button className="pmreg-atglance-btn" onClick={() => setAtGlanceProject(null)}>Done</button>
                <button
                  className="pmreg-atglance-btn pmreg-atglance-btn-primary"
                  onClick={() => navigate(`/project/${atGlanceProject.id}`)}
                >
                  Open Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PMProjectsRegistryView;