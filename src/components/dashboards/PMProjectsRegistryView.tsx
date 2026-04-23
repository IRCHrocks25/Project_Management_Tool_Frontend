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

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid #eef2f7', display: 'flex', gap: 10, alignItems: 'center' }}>
        <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>PM List</strong>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
          Double-click any field to edit.
        </span>
        <input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search inside PM list..."
          style={{ marginLeft: 'auto', minWidth: 260, border: '1px solid #cbd5e1', borderRadius: 8, padding: '0.4rem 0.55rem', fontSize: '0.82rem' }}
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              {[
                'Name',
                'Where',
                'Package',
                'Comments / Notes / Reminder',
                'PM',
                'Start Date',
                'Finish Date',
                'Priority',
                'Logo',
                'SMB',
                'BB',
                'SK',
              ].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '0.55rem', borderBottom: '1px solid #e2e8f0', color: '#334155' }}>
                  {h}
                </th>
              ))}
            </tr>
            <tr>
              <th style={{ padding: '0.4rem', borderBottom: '1px solid #e2e8f0' }}>
                <input value={filters.name} onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))} placeholder="Filter" style={{ width: '100%' }} />
              </th>
              <th style={{ padding: '0.4rem', borderBottom: '1px solid #e2e8f0' }}>
                <select value={filters.where} onChange={(e) => setFilters((f) => ({ ...f, where: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">All</option>
                  {WHERE_OPTIONS.filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </th>
              <th style={{ padding: '0.4rem', borderBottom: '1px solid #e2e8f0' }}>
                <select value={filters.packageLabel} onChange={(e) => setFilters((f) => ({ ...f, packageLabel: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">All</option>
                  {CLIENT_TYPE_OPTIONS.filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </th>
              <th style={{ padding: '0.4rem', borderBottom: '1px solid #e2e8f0' }}>
                <input value={filters.comments} onChange={(e) => setFilters((f) => ({ ...f, comments: e.target.value }))} placeholder="Filter comments/notes" style={{ width: '100%' }} />
              </th>
              <th style={{ padding: '0.4rem', borderBottom: '1px solid #e2e8f0' }}>
                <input value={filters.pm} onChange={(e) => setFilters((f) => ({ ...f, pm: e.target.value }))} placeholder="Filter" style={{ width: '100%' }} />
              </th>
              <th style={{ padding: '0.4rem', borderBottom: '1px solid #e2e8f0' }}>
                <input type="date" value={filters.startDate} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} style={{ width: '100%' }} />
              </th>
              <th style={{ padding: '0.4rem', borderBottom: '1px solid #e2e8f0' }}>
                <input type="date" value={filters.finishDate} onChange={(e) => setFilters((f) => ({ ...f, finishDate: e.target.value }))} style={{ width: '100%' }} />
              </th>
              <th style={{ padding: '0.4rem', borderBottom: '1px solid #e2e8f0' }}>
                <select value={filters.pmPriority} onChange={(e) => setFilters((f) => ({ ...f, pmPriority: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">All</option>
                  <option value="Urgent">Urgent</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </th>
              {(['logo', 'smb', 'bb', 'sk'] as const).map((k) => (
                <th key={k} style={{ padding: '0.4rem', borderBottom: '1px solid #e2e8f0' }}>
                  <select value={filters[k]} onChange={(e) => setFilters((f) => ({ ...f, [k]: e.target.value }))} style={{ width: '100%' }}>
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
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.5rem', fontWeight: 700, color: '#1e3a8a', cursor: 'pointer' }} onClick={() => navigate(`/project/${p.id}`)}>{p.clientName}</td>

                  <td style={{ padding: '0.5rem' }} onDoubleClick={() => startEdit(p.id, 'where', m.where || '')}>
                    {isEditing('where') ? (
                      <select
                        autoFocus
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        onBlur={() => saveEdit(p)}
                        style={{ width: '100%' }}
                      >
                        {WHERE_OPTIONS.map((o) => <option key={o || '_'} value={o}>{o || '—'}</option>)}
                      </select>
                    ) : (m.where || '—')}
                  </td>

                  <td style={{ padding: '0.5rem' }} onDoubleClick={() => startEdit(p.id, 'clientType', p.clientType || '')}>
                    {isEditing('clientType') ? (
                      <select autoFocus value={draftValue} onChange={(e) => setDraftValue(e.target.value)} onBlur={() => saveEdit(p)} style={{ width: '100%' }}>
                        {CLIENT_TYPE_OPTIONS.map((o) => <option key={o || '_'} value={o}>{o || '—'}</option>)}
                      </select>
                    ) : (p.clientType || '—')}
                  </td>

                  <td style={{ padding: '0.5rem', maxWidth: 300 }} onDoubleClick={() => startEdit(p.id, 'comments', m.comments || '')}>
                    {isEditing('comments') ? (
                      <textarea
                        autoFocus
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        onBlur={() => saveEdit(p)}
                        rows={3}
                        placeholder="Add comment, note, or reminder..."
                        style={{ width: '100%', resize: 'vertical' }}
                      />
                    ) : (
                      m.comments ? (
                        <span
                          title={m.comments || ''}
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.35,
                            color: '#334155',
                          }}
                        >
                          {m.comments}
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.15rem 0.5rem',
                            borderRadius: 999,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: '#2563eb',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                          }}
                        >
                          + Add comment
                        </span>
                      )
                    )}
                  </td>

                  <td style={{ padding: '0.5rem' }}>
                    <select
                      value={pmId}
                      disabled={savingPmFor === p.id}
                      onChange={async (e) => {
                        const newPmId = e.target.value;
                        if (!newPmId || newPmId === pmId) return;
                        setSavingPmFor(p.id);
                        try {
                          await projectService.update(p.id, { pmId: newPmId });
                          const newPM = users.find((u: any) => u.id === newPmId);
                          setProjects((prev) => prev.map((row) => row.id === p.id ? { ...row, pmId: newPmId, pm: newPM || row.pm } : row));
                        } finally {
                          setSavingPmFor(null);
                        }
                      }}
                      style={{ width: '100%' }}
                    >
                      <option value="">Unassigned</option>
                      {users.filter((u: any) => u.role === 'Project Manager').map((pm: any) => (
                        <option key={pm.id} value={pm.id}>{pm.name}</option>
                      ))}
                    </select>
                  </td>

                  <td style={{ padding: '0.5rem' }}>
                    {getProjectStartDate(p) || '—'}
                  </td>

                  <td style={{ padding: '0.5rem' }} onDoubleClick={() => startEdit(p.id, 'finishDate', m.finishDate || '')}>
                    {isEditing('finishDate') ? (
                      <input type="date" autoFocus value={draftValue} onChange={(e) => setDraftValue(e.target.value)} onBlur={() => saveEdit(p)} style={{ width: '100%' }} />
                    ) : (m.finishDate || '—')}
                  </td>

                  <td style={{ padding: '0.5rem' }} onDoubleClick={() => startEdit(p.id, 'projectPriority', p.priority || '')}>
                    {isEditing('projectPriority') ? (
                      <select autoFocus value={draftValue} onChange={(e) => setDraftValue(e.target.value)} onBlur={() => saveEdit(p)} style={{ width: '100%' }}>
                        {PROJECT_PRIORITY_OPTIONS.map((o) => <option key={o || '_'} value={o}>{o || '—'}</option>)}
                      </select>
                    ) : (
                      p.priority ? (
                        <span style={{
                          padding: '0.16rem 0.45rem',
                          borderRadius: 999,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: p.priority === 'Urgent' ? '#fee2e2' : p.priority === 'High' ? '#ffedd5' : '#e2e8f0',
                          color: p.priority === 'Urgent' ? '#b91c1c' : p.priority === 'High' ? '#c2410c' : '#334155',
                        }}>
                          {p.priority}
                        </span>
                      ) : '—'
                    )}
                  </td>

                  {(['logo', 'smb', 'bb', 'sk'] as const).map((k) => (
                    <td key={k} style={{ padding: '0.5rem', textAlign: 'center' }} onDoubleClick={() => onDeliverableToggle(p.id, k)} title="Double-click to toggle">
                      <span
                        style={{
                          padding: '0.14rem 0.45rem',
                          borderRadius: 999,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: d[k] ? '#dcfce7' : '#f1f5f9',
                          color: d[k] ? '#166534' : '#475569',
                        }}
                      >
                        {d[k] ? 'Done' : 'No'}
                      </span>
                    </td>
                  ))}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '1.2rem', color: '#64748b' }}>
                  No projects match current search/filters.
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

