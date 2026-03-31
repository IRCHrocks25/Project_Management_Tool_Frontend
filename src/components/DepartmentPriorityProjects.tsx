import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaFlag, FaSpinner, FaEdit, FaChevronRight,
  FaPlus, FaTimes, FaLink, FaExternalLinkAlt, FaRedoAlt,
} from 'react-icons/fa';
import {
  departmentProjectFocusService,
  DepartmentProjectFocusRow,
} from '../services/departmentProjectFocus.service';
import { dailyFocusService } from '../services/dailyFocus.service';
import { taskService } from '../services/task.service';

/* ─── helpers ─── */

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const COLUMN_OPTIONS = [
  { id: 'not_started',        label: 'Not yet started' },
  { id: 'owned_in_progress',  label: 'In progress' },
  { id: 'for_approval',       label: 'For approval' },
  { id: 'revision',           label: 'Revision' },
  { id: 'elliot_review',      label: 'Elliot Review' },
  { id: 'approved_completed', label: 'Completed' },
  { id: 'qa_before_client',   label: 'QA Review' },
  { id: 'client_validation',  label: 'Client Validation' },
];

const COLUMN_LABEL_BY_ID: Record<string,string> = Object.fromEntries(COLUMN_OPTIONS.map(c => [c.id, c.label]));

const STATUS_STYLE: Record<string,{ bg:string; text:string; dot:string }> = {
  not_started:        { bg:'#f1f5f9', text:'#64748b', dot:'#94a3b8' },
  owned_in_progress:  { bg:'#dbeafe', text:'#1e40af', dot:'#3b82f6' },
  for_approval:       { bg:'#fef3c7', text:'#92400e', dot:'#f59e0b' },
  revision:           { bg:'#fee2e2', text:'#991b1b', dot:'#ef4444' },
  elliot_review:      { bg:'#d1fae5', text:'#065f46', dot:'#10b981' },
  approved_completed: { bg:'#dcfce7', text:'#166534', dot:'#22c55e' },
  qa_before_client:   { bg:'#e0f2fe', text:'#0c4a6e', dot:'#0ea5e9' },
  client_validation:  { bg:'#f3e8ff', text:'#6b21a8', dot:'#a855f7' },
};

function getTaskColumnId(task: any): string {
  if (!task) return 'not_started';
  if (task.status === 'Completed' || task.isCompleted) return 'approved_completed';
  const desc: string = task.description || '';
  if (desc.includes('--- Column: Revision ---'))      return 'revision';
  if (desc.includes('--- Column: Elliot Review ---')) return 'elliot_review';
  if (desc.includes('--- Column: QA Review ---'))     return 'qa_before_client';
  if (desc.includes('--- Column: Client Review ---')) return 'client_validation';
  if (desc.includes('--- Column: For Approval ---'))  return 'for_approval';
  if (task.assignedToId || (task.assignees?.length > 0)) {
    if (task.status === 'In Progress')   return 'owned_in_progress';
    if (task.status === 'In Review')     return 'for_approval';
    if (['Revision','Needs Revision'].includes(task.status)) return 'revision';
    if (task.status === 'Elliot Review') return 'elliot_review';
    if (['QA Review','QA'].includes(task.status)) return 'qa_before_client';
    if (['Client Review','Client Validation'].includes(task.status)) return 'client_validation';
    return 'owned_in_progress';
  }
  return 'not_started';
}

/** For approval = work submitted (done); revision / not yet started = not ready for Completed. */
function canSetCompletedFromColumn(currentColumnId: string): boolean {
  return currentColumnId !== 'revision' && currentColumnId !== 'not_started';
}

function statusChipLabel(columnId: string): string {
  if (columnId === 'for_approval') {
    return 'For approval · work done';
  }
  return COLUMN_LABEL_BY_ID[columnId] || 'Not yet started';
}

/* ─── props ─── */

interface DepartmentPriorityProjectsProps {
  taskType: string;
  departmentName: string;
  color: string;
  tasks: any[];
  projects: any[];
  canEditTeamOverride: boolean;
  onOpenTaskDetail: (task: any, tab?: 'details'|'conversation') => void;
  onEditTask: (task: any) => void;
  onUpdateTaskColumn: (taskId: string, columnId: string) => Promise<void>|void;
}

/* ─── PriorityTaskActions ─── */

const PriorityTaskActions: React.FC<{
  deptTasks: any[];
  preferredTaskId?: string;
  color: string;
  onOpenDetail: (task: any) => void;
  onEdit: (task: any) => void;
}> = ({ deptTasks, preferredTaskId, color, onOpenDetail, onEdit }) => {
  const sorted = useMemo(() => [...deptTasks].sort((a,b) => {
    if (!!a?.isCompleted !== !!b?.isCompleted) return a?.isCompleted ? 1 : -1;
    return String(a?.title||'').localeCompare(String(b?.title||''));
  }), [deptTasks]);

  const [selectedId, setSelectedId] = useState('');
  useEffect(() => {
    if (!sorted.length) return;
    setSelectedId(prev => {
      if (preferredTaskId && sorted.some(t => t.id === preferredTaskId)) return preferredTaskId;
      return sorted.some(t => t.id === prev) ? prev : sorted[0].id;
    });
  }, [sorted, preferredTaskId]);

  if (!sorted.length) return <span style={{ fontSize:'0.72rem', color:'#9ca3af' }}>No tasks yet</span>;

  const selected = sorted.find(t => t.id === selectedId) || sorted[0];

  return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
      {sorted.length > 1 && (
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="dpp-select dpp-select-xs">
          {sorted.map(t => {
            const label = t.title||'Untitled';
            return <option key={t.id} value={t.id}>{label.length > 36 ? label.slice(0,36)+'…' : label}</option>;
          })}
        </select>
      )}
      <button className="dpp-action-btn" onClick={() => onOpenDetail(sorted.length === 1 ? sorted[0] : selected)} title="Open task">
        <FaChevronRight style={{ fontSize:'0.55rem' }} /> Task
      </button>
      <button className="dpp-icon-btn" data-edit-task="true" onClick={() => onEdit(sorted.length === 1 ? sorted[0] : selected)} title="Edit task">
        <FaEdit />
      </button>
    </div>
  );
};

/* ─── Main ─── */

const DepartmentPriorityProjects: React.FC<DepartmentPriorityProjectsProps> = ({
  taskType, departmentName, color, tasks, projects,
  canEditTeamOverride, onOpenTaskDetail, onEditTask, onUpdateTaskColumn,
}) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<DepartmentProjectFocusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [focusDateStr, setFocusDateStr] = useState(() => ymdLocal(new Date()));
  const [fetchError, setFetchError] = useState<string|null>(null);
  const [preferredTaskByProject, setPreferredTaskByProject] = useState<Record<string,{taskId:string;taskTitle:string;rank:number}>>({});

  const [showTeamOverrideModal, setShowTeamOverrideModal] = useState(false);
  const [savingTeamOverride, setSavingTeamOverride] = useState(false);
  const [selectedTeamOverrideIds, setSelectedTeamOverrideIds] = useState<string[]>([]);
  const [updatingPriorityStatusTaskId, setUpdatingPriorityStatusTaskId] = useState<string|null>(null);

  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressTask, setProgressTask] = useState<any|null>(null);
  const [progressNote, setProgressNote] = useState('');
  const [progressLinks, setProgressLinks] = useState<string[]>(['']);
  const [savingProgressNoteTaskId, setSavingProgressNoteTaskId] = useState<string|null>(null);
  const [loadingProgressTaskId, setLoadingProgressTaskId] = useState<string|null>(null);
  const [editingProgressQuestionId, setEditingProgressQuestionId] = useState<string|null>(null);
  const [existingProgressNoteByTaskId, setExistingProgressNoteByTaskId] = useState<Record<string,{questionId:string;note:string;links:string[]}|undefined>>({});

  const pmFocusRows      = useMemo(() => rows.filter(r => r.source !== 'override'), [rows]);
  const overrideFocusRows = useMemo(() => rows.filter(r => r.source === 'override'), [rows]);
  const pmPinnedTaskIds   = useMemo(() => new Set(pmFocusRows.map(r => r.taskId).filter(Boolean)), [pmFocusRows]);

  const loadDepartmentFocus = useCallback(async () => {
    try {
      setLoading(true); setFetchError(null);
      const [data, dailyRows] = await Promise.all([
        departmentProjectFocusService.getByDateAndDepartment(focusDateStr, taskType),
        dailyFocusService.getByDate(focusDateStr).catch(() => []),
      ]);
      const taskProjectById = new Map<string,string>(tasks.map((t:any) => [t.id, t.projectId]));
      const deptDailyRows = [...dailyRows].filter((r:any) => r.departmentKey === taskType).sort((a:any,b:any) => a.rank - b.rank);
      const preferred: Record<string,{taskId:string;taskTitle:string;rank:number}> = {};
      const seen = new Set<string>();
      for (const row of deptDailyRows) {
        const pid = row.projectId || taskProjectById.get(row.taskId);
        if (!pid || seen.has(pid)) continue;
        seen.add(pid);
        preferred[pid] = { taskId: row.taskId, taskTitle: row.taskTitle||'Task', rank: row.rank };
      }
      setPreferredTaskByProject(preferred);
      setRows(data);
    } catch(e:any) {
      setFetchError(e?.response?.data?.message || e?.message || 'Failed to load priorities');
      setRows([]); setPreferredTaskByProject({});
    } finally { setLoading(false); }
  }, [focusDateStr, taskType, tasks]);

  useEffect(() => { loadDepartmentFocus(); }, [loadDepartmentFocus]);

  const tasksForTeamOverrideModal = useMemo(() => {
    const open = tasks.filter((t:any) => !t.isArchived && !t.isCompleted);
    const base = open.filter((t:any) => !pmPinnedTaskIds.has(t.id));
    const extra = overrideFocusRows
      .filter(r => r.taskId && !pmPinnedTaskIds.has(r.taskId) && !base.some((t:any) => t.id === r.taskId))
      .map(r => ({ id: r.taskId!, title: r.taskTitle||'Task', projectId: r.projectId, projectName: r.clientName||'Project' }));
    return [...base, ...extra];
  }, [tasks, overrideFocusRows, pmPinnedTaskIds]);

  const handleSaveTeamOverride = async () => {
    try {
      setSavingTeamOverride(true);
      const data = await departmentProjectFocusService.saveTeamOverride(focusDateStr, taskType, selectedTeamOverrideIds);
      setRows(data); setShowTeamOverrideModal(false);
    } catch(e:any) { alert(e?.response?.data?.message || 'Failed to save team add-ons.'); }
    finally { setSavingTeamOverride(false); }
  };

  const parseProgressQuestion = (text:string): { note:string; links:string[] }|null => {
    if (!text?.startsWith('[PROGRESS_UPDATE]')) return null;
    const body = text.replace('[PROGRESS_UPDATE]','').trim();
    const links:string[] = [], noteLines:string[] = [];
    let inLinks = false;
    for (const raw of body.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      if (/^links:?$/i.test(line)) { inLinks = true; continue; }
      if (inLinks) { const c = line.replace(/^-+\s*/,'').trim(); if (c) links.push(c); }
      else noteLines.push(raw);
    }
    return { note: noteLines.join('\n').trim(), links };
  };

  const loadExistingProgressNote = useCallback(async (taskId:string) => {
    try {
      const convo = await taskService.getConversations(taskId);
      const hit = (convo||[]).find((q:any) => typeof q?.text === 'string' && q.text.startsWith('[PROGRESS_UPDATE]'));
      if (!hit) { setExistingProgressNoteByTaskId(p => ({...p,[taskId]:undefined})); return undefined; }
      const parsed = parseProgressQuestion(hit.text) || { note:'', links:[] };
      const payload = { questionId: hit.id, note: parsed.note, links: parsed.links };
      setExistingProgressNoteByTaskId(p => ({...p,[taskId]:payload}));
      return payload;
    } catch { return undefined; }
  }, []);

  useEffect(() => {
    const ids = Array.from(new Set(rows.map(r => r.taskId).filter(Boolean) as string[]));
    if (!ids.length) return;
    Promise.all(ids.map(id => loadExistingProgressNote(id)));
  }, [rows, loadExistingProgressNote]);

  const resetProgressModal = () => {
    setShowProgressModal(false); setProgressTask(null);
    setProgressNote(''); setProgressLinks(['']); setEditingProgressQuestionId(null);
  };

  const handleSaveProgressNote = async () => {
    if (!progressTask) return;
    const note = progressNote.trim();
    if (!note) { alert('Please enter a progress note.'); return; }
    const cleanLinks = progressLinks.map(x => x.trim()).filter(Boolean);
    const lines = ['[PROGRESS_UPDATE]', note];
    if (cleanLinks.length) { lines.push('','Links:'); cleanLinks.forEach(u => lines.push(`- ${u}`)); }
    try {
      setSavingProgressNoteTaskId(progressTask.id);
      await taskService.createQuestion(progressTask.id, lines.join('\n'));
      if (editingProgressQuestionId) { try { await taskService.deleteQuestion(editingProgressQuestionId); } catch {} }
      await loadExistingProgressNote(progressTask.id);
      resetProgressModal();
      alert(editingProgressQuestionId ? 'Progress update edited.' : 'Progress update added.');
    } catch(err:any) { alert(err?.response?.data?.message || 'Failed to add progress note.'); }
    finally { setSavingProgressNoteTaskId(null); }
  };

  /* ─── Row renderer ─── */
  const renderRow = (row: DepartmentProjectFocusRow, idx: number, source: 'pm'|'override') => {
    const isPm = source === 'pm';
    const preferredTask = row.projectId ? preferredTaskByProject[row.projectId] : undefined;
    const rowTask = (row.taskId && tasks.find((t:any) => t.id === row.taskId)) || null;
    const rowProjectId = rowTask?.projectId || row.projectId || null;
    const actionTasks = rowTask ? [rowTask] : rowProjectId ? tasks.filter((t:any) => t.projectId === rowProjectId) : [];
    const statusTask = rowTask
      || (preferredTask?.taskId ? tasks.find((t:any) => t.id === preferredTask.taskId) : null)
      || actionTasks[0] || null;
    const colId = statusTask ? getTaskColumnId(statusTask) : 'not_started';
    const colLabel = statusChipLabel(colId);
    const ss = STATUS_STYLE[colId] || STATUS_STYLE.not_started;
    const hasNote = !!existingProgressNoteByTaskId[statusTask?.id];

    return (
      <li key={row.id} className={`dpp-row ${isPm ? '' : 'dpp-row--team'}`}>
        <span className="dpp-row-stripe" style={{ background: isPm ? color : '#8b5cf6' }} />

        <span className="dpp-rank" style={{ color: isPm ? color : '#7c3aed', background: isPm ? `${color}14` : '#ede9fe' }}>
          {idx + 1}
        </span>

        <div className="dpp-row-info">
          <div className="dpp-row-name">
            {row.clientName}
            <span className={`dpp-badge ${isPm ? 'dpp-badge--pm' : 'dpp-badge--team'}`}>{isPm ? 'PM' : 'Team'}</span>
          </div>
          <div className="dpp-row-meta">
            {row.taskTitle && <span className="dpp-meta-item">{row.taskTitle}</span>}
            {row.stage    && <><span className="dpp-meta-sep">·</span><span className="dpp-meta-item">Stage: <b>{row.stage}</b></span></>}
            {row.pmName   && <><span className="dpp-meta-sep">·</span><span className="dpp-meta-item">PM: <b>{row.pmName}</b></span></>}
          </div>
          <div className="dpp-row-chips">
            <span className="dpp-status-chip" style={{ background: ss.bg, color: ss.text }}>
              <span className="dpp-status-dot" style={{ background: ss.dot }} />
              {colLabel}
            </span>
            {isPm && preferredTask && (
              <span className="dpp-focus-chip">
                #{preferredTask.rank} {preferredTask.taskTitle.length > 32 ? preferredTask.taskTitle.slice(0,32)+'…' : preferredTask.taskTitle}
              </span>
            )}
          </div>
        </div>

        <div className="dpp-row-actions">
          {statusTask && (
            <select
              className="dpp-select"
              value={colId}
              disabled={updatingPriorityStatusTaskId === statusTask.id}
              onChange={async e => {
                const next = e.target.value;
                if (next === 'approved_completed' && !canSetCompletedFromColumn(colId)) {
                  alert(
                    colId === 'revision'
                      ? 'This task is in revision — finish the revision before marking Completed.'
                      : 'This task has not started yet — complete the work and move it to For approval before marking Completed.'
                  );
                  return;
                }
                try {
                  setUpdatingPriorityStatusTaskId(statusTask.id);
                  await onUpdateTaskColumn(statusTask.id, next);
                  await loadDepartmentFocus();
                } catch(err:any) { alert(err?.response?.data?.message || 'Failed to update task column.'); }
                finally { setUpdatingPriorityStatusTaskId(null); }
              }}
            >
              {COLUMN_OPTIONS.map(opt => (
                <option
                  key={opt.id}
                  value={opt.id}
                  disabled={
                    opt.id === 'approved_completed' && !canSetCompletedFromColumn(colId)
                  }
                >
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {statusTask && !statusTask.isCompleted && (
            <button
              className={`dpp-pill-btn ${hasNote ? 'dpp-pill-btn--noted' : ''}`}
              disabled={savingProgressNoteTaskId === statusTask.id || loadingProgressTaskId === statusTask.id}
              onClick={async () => {
                setLoadingProgressTaskId(statusTask.id);
                const existing = await loadExistingProgressNote(statusTask.id);
                setProgressTask(statusTask);
                setEditingProgressQuestionId(existing?.questionId||null);
                setProgressNote(existing?.note||'');
                setProgressLinks(existing?.links?.length ? existing.links : ['']);
                setShowProgressModal(true);
                setLoadingProgressTaskId(null);
              }}
            >
              {loadingProgressTaskId === statusTask.id ? '…' : hasNote ? 'Edit note' : 'Progress note'}
            </button>
          )}

          <PriorityTaskActions
            deptTasks={actionTasks}
            preferredTaskId={isPm ? preferredTask?.taskId : undefined}
            color={color}
            onOpenDetail={onOpenTaskDetail}
            onEdit={onEditTask}
          />

          {rowProjectId && (
            <button
              className="dpp-project-btn"
              style={{ '--c': color } as React.CSSProperties}
              onClick={() => navigate(`/project/${rowProjectId}`)}
            >
              <FaExternalLinkAlt style={{ fontSize:'0.6rem' }} /> Project
            </button>
          )}
        </div>
      </li>
    );
  };

  const renderSection = (title: string, sectionRows: DepartmentProjectFocusRow[], source: 'pm'|'override', empty: React.ReactNode) => (
    <div className="dpp-section">
      <div className="dpp-section-head">
        <span className={`dpp-section-label ${source === 'pm' ? 'dpp-section-label--pm' : 'dpp-section-label--team'}`}>{title}</span>
        <span className="dpp-section-count">{sectionRows.length}</span>
        <span className="dpp-section-line" />
      </div>
      {sectionRows.length === 0
        ? <p className="dpp-empty">{empty}</p>
        : <ul className="dpp-list">{sectionRows.map((row,i) => renderRow(row,i,source))}</ul>
      }
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');

        .dpp-root {
          font-family: 'DM Sans', system-ui, sans-serif;
          margin-bottom: 2rem;
          border-radius: 16px;
          background: #f5f6f8;
          border: 1px solid #e3e6eb;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 6px 24px rgba(0,0,0,0.05);
          overflow: hidden;
        }

        /* ── Top bar ── */
        .dpp-topbar {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 0.75rem;
          padding: 1rem 1.4rem;
          background: #ffffff;
          border-bottom: 1px solid #eaecf0;
        }
        .dpp-topbar-left { display: flex; align-items: center; gap: 0.6rem; }
        .dpp-flag-dot {
          width: 2rem; height: 2rem; border-radius: 9px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .dpp-flag-dot svg { font-size: 0.78rem; color: #fff; }
        .dpp-title {
          margin: 0; font-size: 0.95rem; font-weight: 700; color: #111827; letter-spacing: -0.01em;
          display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;
        }
        .dpp-dept-tag {
          font-size: 0.69rem; font-weight: 600; color: #6b7280;
          background: #f3f4f6; padding: 0.15rem 0.5rem; border-radius: 20px;
        }
        .dpp-topbar-right { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; }
        .dpp-date-wrap {
          display: flex; align-items: center; gap: 0.3rem;
          font-size: 0.74rem; color: #9ca3af;
        }
        .dpp-date-input {
          padding: 0.32rem 0.5rem; border-radius: 8px;
          border: 1px solid #e5e7eb; background: #fafafa;
          color: #374151; font-size: 0.77rem; font-family: inherit; outline: none;
          transition: border-color 0.15s;
        }
        .dpp-date-input:focus { border-color: #6366f1; background: #fff; }
        .dpp-refresh-btn {
          display: flex; align-items: center; gap: 0.3rem;
          padding: 0.35rem 0.72rem; border-radius: 8px;
          border: 1px solid #e5e7eb; background: #fff; color: #374151;
          font-size: 0.74rem; font-weight: 600; cursor: pointer; font-family: inherit;
          transition: background 0.15s, border-color 0.15s;
        }
        .dpp-refresh-btn:hover:not(:disabled) { background: #f9fafb; border-color: #d1d5db; }
        .dpp-refresh-btn:disabled { opacity: 0.5; cursor: wait; }
        .dpp-spin { animation: dpp-spin 0.9s linear infinite; }
        @keyframes dpp-spin { to { transform: rotate(360deg); } }
        .dpp-addon-btn {
          display: flex; align-items: center; gap: 0.3rem;
          padding: 0.38rem 0.88rem; border-radius: 8px; border: none;
          font-size: 0.74rem; font-weight: 700; color: #fff; cursor: pointer; font-family: inherit;
          transition: opacity 0.15s, transform 0.1s;
        }
        .dpp-addon-btn:hover { opacity: 0.88; transform: translateY(-1px); }

        /* ── Desc ── */
        .dpp-desc {
          padding: 0.6rem 1.4rem; font-size: 0.77rem; color: #6b7280; line-height: 1.7;
          background: #fafbfc; border-bottom: 1px solid #eaecf0;
        }
        .dpp-desc strong { color: #374151; }

        /* ── Error ── */
        .dpp-error {
          margin: 0.75rem 1.4rem; padding: 0.5rem 0.85rem; border-radius: 10px;
          background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; font-size: 0.78rem;
        }

        /* ── Body ── */
        .dpp-body { padding: 1.15rem 1.4rem; display: flex; flex-direction: column; gap: 1.4rem; }

        /* ── Section ── */
        .dpp-section { display: flex; flex-direction: column; gap: 0.65rem; }
        .dpp-section-head { display: flex; align-items: center; gap: 0.45rem; }
        .dpp-section-label {
          font-size: 0.66rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
          padding: 0.18rem 0.58rem; border-radius: 20px; flex-shrink: 0;
        }
        .dpp-section-label--pm   { background: #eff6ff; color: #1d4ed8; }
        .dpp-section-label--team { background: #f5f3ff; color: #6d28d9; }
        .dpp-section-count {
          font-size: 0.69rem; font-weight: 700; color: #9ca3af;
          background: #f3f4f6; border-radius: 20px; padding: 0.08rem 0.45rem; flex-shrink: 0;
        }
        .dpp-section-line { flex: 1; height: 1px; background: #e9ebee; }
        .dpp-empty { margin: 0; padding: 0.3rem 0; font-size: 0.79rem; color: #9ca3af; font-style: italic; }

        /* ── List ── */
        .dpp-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.45rem; }

        /* ── Row ── */
        .dpp-row {
          display: flex; align-items: center; gap: 0.8rem;
          padding: 0.85rem 1rem 0.85rem 0;
          border-radius: 12px;
          background: #fff;
          border: 1px solid #eaecf0;
          position: relative; overflow: hidden; flex-wrap: wrap;
          transition: box-shadow 0.18s, border-color 0.18s, transform 0.12s;
        }
        .dpp-row:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.07); border-color: #d1d5db; transform: translateY(-1px); }
        .dpp-row--team { background: #fdfcff; border-color: #ede9fe; }
        .dpp-row--team:hover { border-color: #c4b5fd; box-shadow: 0 2px 12px rgba(139,92,246,0.1); }

        .dpp-row-stripe {
          position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
          border-radius: 3px 0 0 3px;
        }
        .dpp-rank {
          flex-shrink: 0; margin-left: 0.85rem;
          width: 1.65rem; height: 1.65rem; border-radius: 8px;
          font-size: 0.7rem; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
        }
        .dpp-row-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.22rem; }
        .dpp-row-name {
          font-size: 0.9rem; font-weight: 700; color: #111827;
          display: flex; align-items: center; gap: 0.38rem; flex-wrap: wrap;
        }
        .dpp-badge {
          font-size: 0.57rem; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase;
          padding: 0.1rem 0.38rem; border-radius: 4px;
        }
        .dpp-badge--pm   { background: #dbeafe; color: #1e40af; }
        .dpp-badge--team { background: #ede9fe; color: #5b21b6; }
        .dpp-row-meta {
          display: flex; align-items: center; flex-wrap: wrap;
          font-size: 0.74rem; color: #6b7280;
        }
        .dpp-meta-item b { color: #374151; font-weight: 600; }
        .dpp-meta-sep { margin: 0 0.32rem; color: #d1d5db; }
        .dpp-row-chips { display: flex; align-items: center; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.08rem; }
        .dpp-status-chip {
          display: inline-flex; align-items: center; gap: 0.26rem;
          padding: 0.16rem 0.52rem; border-radius: 20px;
          font-size: 0.66rem; font-weight: 700;
        }
        .dpp-status-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
        .dpp-focus-chip {
          font-size: 0.66rem; font-weight: 600; padding: 0.16rem 0.52rem; border-radius: 20px;
          background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa;
        }

        /* ── Row actions ── */
        .dpp-row-actions {
          display: flex; align-items: center; gap: 0.38rem;
          flex-wrap: wrap; justify-content: flex-end; flex-shrink: 0; padding-right: 0.25rem;
        }
        .dpp-select {
          padding: 0.36rem 0.48rem; border-radius: 8px;
          border: 1px solid #e5e7eb; background: #fafafa; color: #374151;
          font-size: 0.73rem; font-family: inherit; min-width: 128px; outline: none;
          transition: border-color 0.15s, background 0.15s;
        }
        .dpp-select:focus { border-color: #6366f1; background: #fff; }
        .dpp-select-xs { min-width: 0; max-width: 148px; }
        .dpp-pill-btn {
          padding: 0.36rem 0.72rem; border-radius: 8px;
          border: 1px solid #e5e7eb; background: #fff; color: #4b5563;
          font-size: 0.73rem; font-weight: 600; font-family: inherit; cursor: pointer;
          transition: background 0.15s, border-color 0.15s; white-space: nowrap;
        }
        .dpp-pill-btn:hover:not(:disabled) { background: #f9fafb; border-color: #d1d5db; }
        .dpp-pill-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .dpp-pill-btn--noted { background: #fff7ed; color: #c2410c; border-color: #fdba74; }
        .dpp-pill-btn--noted:hover:not(:disabled) { background: #ffedd5; }
        .dpp-action-btn {
          display: inline-flex; align-items: center; gap: 0.26rem;
          padding: 0.36rem 0.7rem; border-radius: 8px;
          border: 1px solid #e5e7eb; background: #fff; color: #374151;
          font-size: 0.73rem; font-weight: 600; font-family: inherit; cursor: pointer;
          transition: background 0.15s, border-color 0.15s; white-space: nowrap;
        }
        .dpp-action-btn:hover { background: #f9fafb; border-color: #d1d5db; }
        .dpp-icon-btn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 1.9rem; height: 1.9rem; border-radius: 8px;
          border: 1px solid #e5e7eb; background: #fff; color: #6b7280; font-size: 0.78rem;
          cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .dpp-icon-btn:hover { background: #f3f4f6; color: #111827; border-color: #d1d5db; }
        .dpp-project-btn {
          display: inline-flex; align-items: center; gap: 0.26rem;
          padding: 0.36rem 0.72rem; border-radius: 8px; border: none; color: #fff;
          font-size: 0.73rem; font-weight: 700; font-family: inherit; cursor: pointer;
          transition: opacity 0.15s, transform 0.1s; white-space: nowrap;
          background: var(--c, #6366f1);
        }
        .dpp-project-btn:hover { opacity: 0.88; transform: translateY(-1px); }

        /* ── Loading ── */
        .dpp-loading-state {
          display: flex; align-items: center; gap: 0.5rem;
          color: #9ca3af; font-size: 0.82rem; padding: 0.4rem 0;
        }

        /* ── Modal ── */
        .dpp-overlay {
          position: fixed; inset: 0;
          background: rgba(2, 6, 23, 0.45);
          backdrop-filter: blur(5px);
          display: flex; align-items: center; justify-content: center;
          z-index: 2000; padding: 1.5rem;
        }
        .dpp-modal {
          background: #fff; border-radius: 18px;
          width: 100%; max-width: 500px; max-height: 88vh;
          display: flex; flex-direction: column;
          box-shadow: 0 20px 70px rgba(0,0,0,0.2);
          overflow: hidden;
          animation: dpp-modal-in 0.2s cubic-bezier(0.34,1.56,0.64,1);
        }
        .dpp-modal--lg { max-width: 610px; }
        @keyframes dpp-modal-in {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .dpp-modal-hd {
          padding: 1.25rem 1.5rem 0.95rem;
          border-bottom: 1px solid #f3f4f6;
          display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem;
        }
        .dpp-modal-title { margin: 0; font-size: 0.98rem; font-weight: 700; color: #111827; letter-spacing: -0.01em; }
        .dpp-modal-sub { margin: 0.22rem 0 0; font-size: 0.76rem; color: #6b7280; line-height: 1.6; }
        .dpp-modal-task-tag {
          display: inline-flex; align-items: center; gap: 0.28rem; margin-top: 0.45rem;
          font-size: 0.72rem; font-weight: 600; color: #374151;
          background: #f3f4f6; padding: 0.2rem 0.55rem; border-radius: 6px;
        }
        .dpp-close-btn {
          width: 1.85rem; height: 1.85rem; border-radius: 8px;
          border: 1px solid #e5e7eb; background: #fafafa; color: #6b7280;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0; font-size: 0.78rem;
          transition: background 0.15s, color 0.15s;
        }
        .dpp-close-btn:hover { background: #f3f4f6; color: #111827; }
        .dpp-close-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .dpp-modal-body {
          padding: 1rem 1.5rem; overflow-y: auto; flex: 1;
          display: flex; flex-direction: column; gap: 0.9rem;
        }
        .dpp-modal-ft {
          padding: 0.85rem 1.5rem; border-top: 1px solid #f3f4f6;
          display: flex; justify-content: flex-end; gap: 0.5rem;
        }
        .dpp-field-lbl { display: block; margin-bottom: 0.36rem; font-size: 0.76rem; font-weight: 700; color: #374151; }
        .dpp-textarea {
          width: 100%; box-sizing: border-box; border-radius: 10px;
          border: 1.5px solid #e5e7eb; padding: 0.65rem 0.8rem;
          font-size: 0.84rem; color: #1f2937; line-height: 1.65;
          resize: vertical; font-family: inherit; outline: none; background: #fafafa;
          transition: border-color 0.15s;
        }
        .dpp-textarea:focus { border-color: #6366f1; background: #fff; }
        .dpp-link-row { display: flex; align-items: center; gap: 0.4rem; }
        .dpp-link-icon { color: #d1d5db; font-size: 0.78rem; flex-shrink: 0; }
        .dpp-link-input {
          flex: 1; border-radius: 8px; border: 1.5px solid #e5e7eb;
          padding: 0.42rem 0.62rem; font-size: 0.8rem; font-family: inherit;
          outline: none; background: #fafafa; transition: border-color 0.15s;
        }
        .dpp-link-input:focus { border-color: #6366f1; background: #fff; }
        .dpp-link-remove {
          width: 1.65rem; height: 1.65rem; border-radius: 7px; border: none;
          background: transparent; color: #ef4444; cursor: pointer;
          display: flex; align-items: center; justify-content: center; transition: background 0.15s;
        }
        .dpp-link-remove:hover { background: #fef2f2; }
        .dpp-add-link {
          margin-top: 0.38rem;
          display: inline-flex; align-items: center; gap: 0.26rem;
          padding: 0.3rem 0.62rem; border-radius: 7px;
          border: 1px dashed #d1d5db; background: transparent;
          color: #6b7280; font-size: 0.72rem; font-weight: 600; font-family: inherit;
          cursor: pointer; transition: background 0.15s, border-color 0.15s;
        }
        .dpp-add-link:hover { background: #f9fafb; border-color: #9ca3af; }
        .dpp-modal-cancel {
          padding: 0.48rem 1rem; border-radius: 9px;
          border: 1px solid #e5e7eb; background: #fff; color: #374151;
          font-size: 0.8rem; font-weight: 600; font-family: inherit; cursor: pointer;
          transition: background 0.15s;
        }
        .dpp-modal-cancel:hover:not(:disabled) { background: #f9fafb; }
        .dpp-modal-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
        .dpp-modal-save {
          padding: 0.48rem 1.1rem; border-radius: 9px; border: none; color: #fff;
          font-size: 0.8rem; font-weight: 700; font-family: inherit; cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
        }
        .dpp-modal-save:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .dpp-modal-save:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
        .dpp-check-list { display: flex; flex-direction: column; gap: 0.28rem; }
        .dpp-check-item {
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.52rem 0.72rem; border-radius: 10px;
          border: 1px solid #f3f4f6; cursor: pointer; font-family: inherit;
          transition: background 0.12s, border-color 0.12s;
        }
        .dpp-check-item:hover { background: #f9fafb; border-color: #e5e7eb; }
        .dpp-check-name { font-size: 0.84rem; font-weight: 600; color: #1e293b; }
        .dpp-check-proj { font-size: 0.73rem; color: #9ca3af; margin-left: auto; }
      `}</style>

      <div className="dpp-root">

        {/* Top bar */}
        <div className="dpp-topbar">
          <div className="dpp-topbar-left">
            <span className="dpp-flag-dot" style={{ background: color }}><FaFlag /></span>
            <h2 className="dpp-title">
              Today's priority projects
              <span className="dpp-dept-tag">{departmentName}</span>
            </h2>
          </div>
          <div className="dpp-topbar-right">
            <label className="dpp-date-wrap">
              Date
              <input type="date" className="dpp-date-input" value={focusDateStr} onChange={e => setFocusDateStr(e.target.value)} />
            </label>
            <button className="dpp-refresh-btn" onClick={() => loadDepartmentFocus()} disabled={loading}>
              {loading ? <FaSpinner className="dpp-spin" /> : <FaRedoAlt style={{ fontSize:'0.63rem' }} />}
              {loading ? 'Loading' : 'Refresh'}
            </button>
            {canEditTeamOverride && (
              <button className="dpp-addon-btn" style={{ background: color }}
                onClick={() => { setSelectedTeamOverrideIds(overrideFocusRows.map(r => r.taskId).filter(Boolean) as string[]); setShowTeamOverrideModal(true); }}>
                <FaPlus style={{ fontSize:'0.62rem' }} /> Team add-ons
              </button>
            )}
          </div>
        </div>

        {/* Desc */}
        <div className="dpp-desc">
          <strong>PM priorities</strong> are set by Project Managers in the sidebar. Everyone in <strong>{departmentName}</strong> sees them here.{' '}
          <strong>Team add-ons</strong> are optional extras your team lead can flag — they cannot duplicate PM picks.
        </div>

        {/* Error */}
        {fetchError && <div className="dpp-error">{fetchError}</div>}

        {/* Body */}
        <div className="dpp-body">
          {loading
            ? <div className="dpp-loading-state"><FaSpinner className="dpp-spin" /> Loading priorities…</div>
            : <>
                {renderSection('PM priorities', pmFocusRows, 'pm',
                  <>None for this date. PMs set these from <strong>Department priorities</strong> in the sidebar.</>)}
                {renderSection('Team add-ons', overrideFocusRows, 'override',
                  canEditTeamOverride
                    ? 'None yet. Use "Team add-ons" to flag extra clients outside the PM list.'
                    : 'None. Your team lead can add clients here when needed.')}
              </>
          }
        </div>
      </div>

      {/* Team Override Modal */}
      {showTeamOverrideModal && (
        <div className="dpp-overlay" onClick={() => { if (!savingTeamOverride) setShowTeamOverrideModal(false); }}>
          <div className="dpp-modal" onClick={e => e.stopPropagation()}>
            <div className="dpp-modal-hd">
              <div>
                <h2 className="dpp-modal-title">Team add-ons — {departmentName}</h2>
                <p className="dpp-modal-sub"><strong>{focusDateStr}</strong> · Extra clients outside the PM list (cannot duplicate PM priorities).</p>
              </div>
              <button className="dpp-close-btn" disabled={savingTeamOverride} onClick={() => setShowTeamOverrideModal(false)}><FaTimes /></button>
            </div>
            <div className="dpp-modal-body">
              {tasksForTeamOverrideModal.length === 0
                ? <p className="dpp-empty">No eligible tasks — PM list may already cover all active department tasks.</p>
                : (
                  <div className="dpp-check-list">
                    {tasksForTeamOverrideModal.map((t:any) => {
                      const proj = projects.find((p:any) => p.id === t.projectId);
                      const projName = t.projectName || proj?.clientName || 'Project';
                      return (
                        <label key={t.id} className="dpp-check-item">
                          <input type="checkbox" checked={selectedTeamOverrideIds.includes(t.id)}
                            onChange={() => setSelectedTeamOverrideIds(prev => prev.includes(t.id) ? prev.filter(x => x!==t.id) : [...prev, t.id])}
                            style={{ accentColor: color }} />
                          <span className="dpp-check-name">{t.title || 'Untitled task'}</span>
                          <span className="dpp-check-proj">{projName}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
            </div>
            <div className="dpp-modal-ft">
              <button className="dpp-modal-cancel" disabled={savingTeamOverride} onClick={() => setShowTeamOverrideModal(false)}>Cancel</button>
              <button className="dpp-modal-save" style={{ background: color }} disabled={savingTeamOverride} onClick={handleSaveTeamOverride}>
                {savingTeamOverride ? 'Saving…' : 'Save add-ons'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {showProgressModal && progressTask && (
        <div className="dpp-overlay" onClick={() => { if (savingProgressNoteTaskId === progressTask.id) return; resetProgressModal(); }}>
          <div className="dpp-modal dpp-modal--lg" onClick={e => e.stopPropagation()}>
            <div className="dpp-modal-hd">
              <div>
                <h2 className="dpp-modal-title">{editingProgressQuestionId ? 'Edit progress update' : 'Add progress update'}</h2>
                <p className="dpp-modal-sub">Attached to task activity · shows in End-of-Day for unfinished planned tasks.</p>
                <span className="dpp-modal-task-tag"><FaFlag style={{ fontSize:'0.58rem', color }} />{progressTask.title || 'Untitled task'}</span>
              </div>
              <button className="dpp-close-btn" disabled={savingProgressNoteTaskId === progressTask.id} onClick={resetProgressModal}><FaTimes /></button>
            </div>
            <div className="dpp-modal-body">
              <div>
                <label className="dpp-field-lbl">Progress note</label>
                <textarea className="dpp-textarea" value={progressNote} onChange={e => setProgressNote(e.target.value)}
                  placeholder="What was completed, what is blocked, what is next?" rows={5} />
              </div>
              <div>
                <label className="dpp-field-lbl">Links <span style={{ color:'#9ca3af', fontWeight:400 }}>(optional)</span></label>
                <div style={{ display:'flex', flexDirection:'column', gap:'0.36rem' }}>
                  {progressLinks.map((link, idx) => (
                    <div key={idx} className="dpp-link-row">
                      <FaLink className="dpp-link-icon" />
                      <input type="url" className="dpp-link-input" value={link}
                        onChange={e => { const n=[...progressLinks]; n[idx]=e.target.value; setProgressLinks(n); }}
                        placeholder="https://drive.google.com/… or Loom / Figma URL" />
                      {progressLinks.length > 1 && (
                        <button className="dpp-link-remove" onClick={() => setProgressLinks(p => p.filter((_,i)=>i!==idx))}>
                          <FaTimes style={{ fontSize:'0.68rem' }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button className="dpp-add-link" onClick={() => setProgressLinks(p => [...p,''])}>
                  <FaPlus style={{ fontSize:'0.58rem' }} /> Add link
                </button>
              </div>
            </div>
            <div className="dpp-modal-ft">
              <button className="dpp-modal-cancel" disabled={savingProgressNoteTaskId === progressTask.id} onClick={resetProgressModal}>Cancel</button>
              <button className="dpp-modal-save" style={{ background: color }}
                disabled={savingProgressNoteTaskId === progressTask.id || !progressNote.trim()} onClick={handleSaveProgressNote}>
                {savingProgressNoteTaskId === progressTask.id ? 'Saving…' : editingProgressQuestionId ? 'Save changes' : 'Save update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DepartmentPriorityProjects;