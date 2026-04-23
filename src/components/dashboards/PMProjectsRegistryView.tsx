import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../../services/project.service';
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

  .pmreg-deliverable {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-width: 52px;
    padding: 3px 9px;
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    border: 1px solid;
    cursor: pointer;
    user-select: none;
    transition: transform 80ms ease, box-shadow 120ms ease;
  }
  .pmreg-deliverable:hover { transform: translateY(-1px); box-shadow: ${tokens.shadowSm}; }
  .pmreg-deliverable:active { transform: translateY(0); }

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

const CheckIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
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
    logo: '',
    smb: '',
    bb: '',
    sk: '',
  });
  const [editingCell, setEditingCell] = useState<{
    projectId: string;
    field: EditableField;
  } | null>(null);
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

  const onDeliverableToggle = (projectId: string, key: 'logo' | 'smb' | 'bb' | 'sk') => {
    const current = getMeta(projectId).deliverables || { logo: false, smb: false, bb: false, sk: false };
    projectRegistryMetaService.upsert(projectId, {
      deliverables: {
        ...current,
        [key]: !current[key],
      },
    });
    refreshMeta();
  };

  const rows = useMemo(() => {
    const allSearch = `${globalSearchTerm} ${localSearch}`.trim().toLowerCase();
    return projects.filter((p) => {
      const m = getMeta(p.id);
      const pmName =
        users.find((u: any) => u.id === (p.pmId || p.pm?.id))?.name || p.pm?.name || '';
      const d = m.deliverables || { logo: false, smb: false, bb: false, sk: false };
      const startDateValue = getProjectStartDate(p);

      const haystack = [
        p.clientName,
        m.where,
        m.packageLabel,
        m.comments,
        pmName,
        startDateValue,
        m.finishDate,
        p.priority,
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
      if (filters.logo && String(d.logo ? 'Done' : 'No') !== filters.logo) return false;
      if (filters.smb && String(d.smb ? 'Done' : 'No') !== filters.smb) return false;
      if (filters.bb && String(d.bb ? 'Done' : 'No') !== filters.bb) return false;
      if (filters.sk && String(d.sk ? 'Done' : 'No') !== filters.sk) return false;
      return true;
    });
  }, [projects, users, filters, globalSearchTerm, localSearch, getMeta]);

  const totalCount = projects.length;
  const shownCount = rows.length;

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

      {/* ---------- Table ---------- */}
      <div className="pmreg-scroll" style={{ overflowX: 'auto', maxHeight: '72vh', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead className="pmreg-thead">
            <tr>
              {[
                'Name',
                'Where',
                'Package',
                'Comments / Notes',
                'PM',
                'Start',
                'Finish',
                'Priority',
                'Logo',
                'SMB',
                'BB',
                'SK',
              ].map((h) => (
                <th key={h} style={thStyle}>
                  {h}
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
              {(['logo', 'smb', 'bb', 'sk'] as const).map((k) => (
                <th key={k} style={thFilterStyle}>
                  <select
                    className="pmreg-filter-select"
                    value={filters[k]}
                    onChange={(e) => setFilters((f) => ({ ...f, [k]: e.target.value }))}
                  >
                    <option value="">All</option>
                    <option value="Done">Done</option>
                    <option value="No">No</option>
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const m = getMeta(p.id);
              const d = m.deliverables || { logo: false, smb: false, bb: false, sk: false };
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
                    onClick={() => navigate(`/project/${p.id}`)}
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

                  {/* Deliverables */}
                  {(['logo', 'smb', 'bb', 'sk'] as const).map((k) => (
                    <td
                      key={k}
                      style={{ ...tdStyle, textAlign: 'center' }}
                      title="Double-click to toggle"
                    >
                      <span
                        className="pmreg-deliverable"
                        onDoubleClick={() => onDeliverableToggle(p.id, k)}
                        style={{
                          background: d[k] ? tokens.successBg : tokens.neutralBg,
                          color: d[k] ? tokens.successFg : tokens.inkMuted,
                          borderColor: d[k] ? tokens.successBorder : tokens.border,
                        }}
                      >
                        {d[k] ? (
                          <>
                            <CheckIcon />
                            Done
                          </>
                        ) : (
                          '—'
                        )}
                      </span>
                    </td>
                  ))}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={12}
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
    </div>
  );
};

export default PMProjectsRegistryView;