import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaFlag, FaSpinner, FaEdit, FaChevronRight, FaPlus, FaTimes, FaLink } from 'react-icons/fa';
import {
  departmentProjectFocusService,
  DepartmentProjectFocusRow,
} from '../services/departmentProjectFocus.service';
import { dailyFocusService } from '../services/dailyFocus.service';
import { taskService } from '../services/task.service';

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const COLUMN_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'not_started', label: 'Not yet started' },
  { id: 'owned_in_progress', label: 'Owned In progress' },
  { id: 'for_approval', label: 'For approval' },
  { id: 'revision', label: 'Revision' },
  { id: 'elliot_review', label: 'Elliot Review' },
  { id: 'approved_completed', label: 'Approved completed' },
  { id: 'qa_before_client', label: 'QA Before Sending to client' },
  { id: 'client_validation', label: 'Client Validation' },
];

const COLUMN_LABEL_BY_ID: Record<string, string> = COLUMN_OPTIONS.reduce((acc, item) => {
  acc[item.id] = item.label;
  return acc;
}, {} as Record<string, string>);

function getTaskColumnId(task: any): string {
  if (!task) return 'not_started';
  if (task.status === 'Completed' || task.isCompleted) return 'approved_completed';

  const desc: string = task.description || '';
  if (desc.includes('--- Column: Revision ---')) return 'revision';
  if (desc.includes('--- Column: Elliot Review ---')) return 'elliot_review';
  if (desc.includes('--- Column: QA Review ---')) return 'qa_before_client';
  if (desc.includes('--- Column: Client Review ---')) return 'client_validation';
  if (desc.includes('--- Column: For Approval ---')) return 'for_approval';

  if (task.assignedToId || (task.assignees && task.assignees.length > 0)) {
    if (task.status === 'In Progress') return 'owned_in_progress';
    if (task.status === 'In Review') return 'for_approval';
    if (task.status === 'Revision' || task.status === 'Needs Revision') return 'revision';
    if (task.status === 'Elliot Review') return 'elliot_review';
    if (task.status === 'QA Review' || task.status === 'QA') return 'qa_before_client';
    if (task.status === 'Client Review' || task.status === 'Client Validation') return 'client_validation';
    return 'owned_in_progress';
  }

  return 'not_started';
}

interface DepartmentPriorityProjectsProps {
  taskType: string;
  departmentName: string;
  color: string;
  /** All tasks visible on this department's board (used to show task actions per project). */
  tasks: any[];
  /** All projects visible on this department's board (used for labels / navigation). */
  projects: any[];
  /** Whether the current user can edit team overrides (team lead of this dept). */
  canEditTeamOverride: boolean;
  onOpenTaskDetail: (task: any, tab?: 'details' | 'conversation') => void;
  onEditTask: (task: any) => void;
  onUpdateTaskColumn: (taskId: string, columnId: string) => Promise<void> | void;
}

/** Task actions for a priority project row. */
const PriorityTaskActions: React.FC<{
  deptTasks: any[];
  preferredTaskId?: string;
  color: string;
  onOpenDetail: (task: any) => void;
  onEdit: (task: any) => void;
}> = ({ deptTasks, preferredTaskId, color, onOpenDetail, onEdit }) => {
  const sorted = useMemo(() => {
    const arr = [...deptTasks];
    arr.sort((a, b) => {
      if (!!a?.isCompleted !== !!b?.isCompleted) return a?.isCompleted ? 1 : -1;
      return String(a?.title || '').localeCompare(String(b?.title || ''));
    });
    return arr;
  }, [deptTasks]);

  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (!sorted.length) return;
    setSelectedId((prev) => {
      if (preferredTaskId && sorted.some((t) => t.id === preferredTaskId)) {
        return preferredTaskId;
      }
      return sorted.some((t) => t.id === prev) ? prev : sorted[0].id;
    });
  }, [sorted, preferredTaskId]);

  const btnOutline: React.CSSProperties = {
    padding: '0.35rem 0.65rem',
    borderRadius: '6px',
    border: `1px solid ${color}`,
    background: 'white',
    color,
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  };

  if (sorted.length === 0) {
    return (
      <span style={{ fontSize: '0.72rem', color: '#94a3b8', maxWidth: '160px', textAlign: 'right' }}>
        No dept tasks yet
      </span>
    );
  }

  const selected = sorted.find((t) => t.id === selectedId) || sorted[0];

  if (sorted.length === 1) {
    const t = sorted[0];
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <button type="button" onClick={() => onOpenDetail(t)} style={btnOutline} title="Open task panel">
          <FaChevronRight style={{ fontSize: '0.55rem' }} /> Task
        </button>
        <button
          type="button"
          data-edit-task="true"
          onClick={() => onEdit(t)}
          title="Edit task"
          style={{ ...btnOutline, padding: '0.35rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <FaEdit style={{ fontSize: '0.85rem' }} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        style={{
          maxWidth: '170px', fontSize: '0.72rem', padding: '0.3rem 0.4rem',
          borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white',
        }}
      >
        {sorted.map((t) => {
          const title = t.title || 'Untitled';
          const label = title.length > 48 ? `${title.slice(0, 48)}…` : title;
          return <option key={t.id} value={t.id}>{label}</option>;
        })}
      </select>
      <button type="button" onClick={() => onOpenDetail(selected)} style={btnOutline} title="Open task panel">
        <FaChevronRight style={{ fontSize: '0.55rem' }} /> Task
      </button>
      <button
        type="button"
        data-edit-task="true"
        onClick={() => onEdit(selected)}
        title="Edit task"
        style={{ ...btnOutline, padding: '0.35rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <FaEdit style={{ fontSize: '0.85rem' }} />
      </button>
    </div>
  );
};

const DepartmentPriorityProjects: React.FC<DepartmentPriorityProjectsProps> = ({
  taskType,
  departmentName,
  color,
  tasks,
  projects,
  canEditTeamOverride,
  onOpenTaskDetail,
  onEditTask,
  onUpdateTaskColumn,
}) => {
  const navigate = useNavigate();

  const [rows, setRows] = useState<DepartmentProjectFocusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [focusDateStr, setFocusDateStr] = useState(() => ymdLocal(new Date()));
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [preferredTaskByProject, setPreferredTaskByProject] = useState<
    Record<string, { taskId: string; taskTitle: string; rank: number }>
  >({});

  const [showTeamOverrideModal, setShowTeamOverrideModal] = useState(false);
  const [savingTeamOverride, setSavingTeamOverride] = useState(false);
  const [selectedTeamOverrideIds, setSelectedTeamOverrideIds] = useState<string[]>([]);
  const [updatingPriorityStatusTaskId, setUpdatingPriorityStatusTaskId] = useState<string | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressTask, setProgressTask] = useState<any | null>(null);
  const [progressNote, setProgressNote] = useState('');
  const [progressLinks, setProgressLinks] = useState<string[]>(['']);
  const [savingProgressNoteTaskId, setSavingProgressNoteTaskId] = useState<string | null>(null);
  const [loadingProgressTaskId, setLoadingProgressTaskId] = useState<string | null>(null);
  const [editingProgressQuestionId, setEditingProgressQuestionId] = useState<string | null>(null);
  const [existingProgressNoteByTaskId, setExistingProgressNoteByTaskId] = useState<
    Record<string, { questionId: string; note: string; links: string[] } | undefined>
  >({});

  const pmFocusRows = useMemo(() => rows.filter((r) => r.source !== 'override'), [rows]);
  const overrideFocusRows = useMemo(() => rows.filter((r) => r.source === 'override'), [rows]);
  const pmPinnedTaskIds = useMemo(
    () => new Set(pmFocusRows.map((r) => r.taskId).filter(Boolean)),
    [pmFocusRows],
  );

  const loadDepartmentFocus = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      console.log(`[DeptPriority] Fetching date=${focusDateStr} dept=${taskType}`);
      const [data, dailyRows] = await Promise.all([
        departmentProjectFocusService.getByDateAndDepartment(focusDateStr, taskType),
        dailyFocusService.getByDate(focusDateStr).catch(() => []),
      ]);
      console.log(`[DeptPriority] Received ${data.length} rows (pm=${data.filter((r) => r.source !== 'override').length}, override=${data.filter((r) => r.source === 'override').length})`);

      const taskProjectById = new Map<string, string>(
        tasks.map((t: any) => [t.id, t.projectId]),
      );
      const deptDailyRows = [...dailyRows]
        .filter((r: any) => r.departmentKey === taskType)
        .sort((a: any, b: any) => a.rank - b.rank);
      const preferred: Record<string, { taskId: string; taskTitle: string; rank: number }> = {};
      const seenProjectIds = new Set<string>();
      for (const row of deptDailyRows) {
        const projectId = row.projectId || taskProjectById.get(row.taskId);
        if (!projectId || seenProjectIds.has(projectId)) continue;
        seenProjectIds.add(projectId);
        preferred[projectId] = {
          taskId: row.taskId,
          taskTitle: row.taskTitle || 'Task',
          rank: row.rank,
        };
      }

      setPreferredTaskByProject(preferred);
      setRows(data);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load priorities';
      console.error('[DeptPriority] Error:', msg, e);
      setFetchError(msg);
      setRows([]);
      setPreferredTaskByProject({});
    } finally {
      setLoading(false);
    }
  }, [focusDateStr, taskType, tasks]);

  useEffect(() => {
    loadDepartmentFocus();
  }, [loadDepartmentFocus]);

  const tasksForTeamOverrideModal = useMemo(() => {
    const openDeptTasks = tasks.filter((t: any) => !t.isArchived && !t.isCompleted);
    const base = openDeptTasks.filter((t: any) => !pmPinnedTaskIds.has(t.id));
    const fromOverride = overrideFocusRows
      .filter((r) => r.taskId && !pmPinnedTaskIds.has(r.taskId) && !base.some((t: any) => t.id === r.taskId))
      .map((r) => ({
        id: r.taskId as string,
        title: r.taskTitle || 'Task',
        projectId: r.projectId,
        projectName: r.clientName || 'Project',
      }));
    return [...base, ...fromOverride];
  }, [tasks, overrideFocusRows, pmPinnedTaskIds]);

  const handleSaveTeamOverride = async () => {
    const orderedIds = selectedTeamOverrideIds;
    try {
      setSavingTeamOverride(true);
      const data = await departmentProjectFocusService.saveTeamOverride(focusDateStr, taskType, orderedIds);
      setRows(data);
      setShowTeamOverrideModal(false);
    } catch (e: any) {
      console.error(e);
      alert(e?.response?.data?.message || 'Failed to save team add-ons.');
    } finally {
      setSavingTeamOverride(false);
    }
  };

  const parseProgressQuestion = (text: string): { note: string; links: string[] } | null => {
    if (!text || !text.startsWith('[PROGRESS_UPDATE]')) return null;
    const body = text.replace('[PROGRESS_UPDATE]', '').trim();
    const lines = body.split('\n');
    const links: string[] = [];
    const noteLines: string[] = [];
    let inLinks = false;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (/^links:?$/i.test(line)) {
        inLinks = true;
        continue;
      }
      if (inLinks) {
        const cleaned = line.replace(/^-+\s*/, '').trim();
        if (cleaned) links.push(cleaned);
      } else {
        noteLines.push(raw);
      }
    }
    return { note: noteLines.join('\n').trim(), links };
  };

  const loadExistingProgressNote = useCallback(async (taskId: string) => {
    try {
      const convo = await taskService.getConversations(taskId);
      const hit = (convo || []).find(
        (q: any) => typeof q?.text === 'string' && q.text.startsWith('[PROGRESS_UPDATE]'),
      );
      if (!hit) {
        setExistingProgressNoteByTaskId((prev) => ({ ...prev, [taskId]: undefined }));
        return undefined;
      }
      const parsed = parseProgressQuestion(hit.text) || { note: '', links: [] };
      const payload = { questionId: hit.id, note: parsed.note, links: parsed.links };
      setExistingProgressNoteByTaskId((prev) => ({ ...prev, [taskId]: payload }));
      return payload;
    } catch (err) {
      console.error('Failed loading progress note:', err);
      return undefined;
    }
  }, []);

  useEffect(() => {
    const taskIds = Array.from(new Set(rows.map((r) => r.taskId).filter(Boolean) as string[]));
    if (taskIds.length === 0) return;
    (async () => {
      await Promise.all(taskIds.map((id) => loadExistingProgressNote(id)));
    })();
  }, [rows, loadExistingProgressNote]);

  const resetProgressModal = () => {
    setShowProgressModal(false);
    setProgressTask(null);
    setProgressNote('');
    setProgressLinks(['']);
    setEditingProgressQuestionId(null);
  };

  const handleSaveProgressNote = async () => {
    if (!progressTask) return;
    const note = progressNote.trim();
    const cleanLinks = progressLinks.map((x) => x.trim()).filter(Boolean);
    if (!note) {
      alert('Please enter a progress note.');
      return;
    }

    const lines: string[] = ['[PROGRESS_UPDATE]', note];
    if (cleanLinks.length > 0) {
      lines.push('', 'Links:');
      cleanLinks.forEach((url) => lines.push(`- ${url}`));
    }

    try {
      setSavingProgressNoteTaskId(progressTask.id);
      await taskService.createQuestion(progressTask.id, lines.join('\n'));
      if (editingProgressQuestionId) {
        try {
          await taskService.deleteQuestion(editingProgressQuestionId);
        } catch (cleanupErr) {
          console.warn('Could not remove previous progress note after edit:', cleanupErr);
        }
      }
      await loadExistingProgressNote(progressTask.id);
      resetProgressModal();
      alert(editingProgressQuestionId ? 'Progress update edited.' : 'Progress update added.');
    } catch (err: any) {
      console.error('Failed to add progress note:', err);
      alert(err?.response?.data?.message || 'Failed to add progress note.');
    } finally {
      setSavingProgressNoteTaskId(null);
    }
  };

  const renderRow = (row: DepartmentProjectFocusRow, idx: number, source: 'pm' | 'override') => {
    const isPm = source === 'pm';
    const preferredTask =
      row.projectId ? preferredTaskByProject[row.projectId] : undefined;
    const rowTask =
      (row.taskId && tasks.find((t: any) => t.id === row.taskId)) || null;
    const rowProjectId = rowTask?.projectId || row.projectId || null;
    const actionTasks =
      rowTask
        ? [rowTask]
        : rowProjectId
          ? tasks.filter((t: any) => t.projectId === rowProjectId)
          : [];
    const statusTask =
      rowTask
      || (preferredTask?.taskId ? tasks.find((t: any) => t.id === preferredTask.taskId) : null)
      || actionTasks[0]
      || null;
    const columnId = statusTask ? getTaskColumnId(statusTask) : 'not_started';
    const columnLabel = COLUMN_LABEL_BY_ID[columnId] || 'Not yet started';
    return (
      <li
        key={row.id}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '1rem', padding: '0.65rem 0.85rem', background: 'white',
          borderRadius: '8px', border: isPm ? '1px solid #e2e8f0' : '1px solid #c7d2fe', flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <span
            style={{
              flexShrink: 0, width: '1.5rem', height: '1.5rem', borderRadius: '6px',
              background: isPm ? `${color}22` : '#eef2ff',
              color: isPm ? color : '#4338ca',
              fontSize: '0.75rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {idx + 1}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>{row.clientName}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {row.taskTitle ? `Task: ${row.taskTitle} · ` : ''}
              Stage: {row.stage || '—'}
              {row.pmName ? ` · PM: ${row.pmName}` : ''}
              {statusTask ? ` · Column: ${columnLabel}` : ''}
              {isPm && preferredTask ? ` · Focus task: #${preferredTask.rank} ${preferredTask.taskTitle}` : ''}
            </div>
          </div>
          <span
            style={{
              fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '4px',
              color: isPm ? '#4338ca' : '#0369a1',
              background: isPm ? '#eef2ff' : '#e0f2fe',
            }}
          >
            {isPm ? 'PM' : 'Team'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {statusTask && (
            <select
              value={columnId}
              disabled={updatingPriorityStatusTaskId === statusTask.id}
              onChange={async (e) => {
                const nextColumnId = e.target.value;
                try {
                  setUpdatingPriorityStatusTaskId(statusTask.id);
                  await onUpdateTaskColumn(statusTask.id, nextColumnId);
                  await loadDepartmentFocus();
                } catch (err: any) {
                  console.error('Failed to update priority task status:', err);
                  alert(err?.response?.data?.message || 'Failed to update task column.');
                } finally {
                  setUpdatingPriorityStatusTaskId(null);
                }
              }}
              style={{
                minWidth: '130px',
                fontSize: '0.72rem',
                padding: '0.3rem 0.4rem',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                background: 'white',
              }}
              title="Update Kanban column"
            >
              {COLUMN_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          )}
          {statusTask && !statusTask.isCompleted && (
            <button
              type="button"
              disabled={savingProgressNoteTaskId === statusTask.id || loadingProgressTaskId === statusTask.id}
              onClick={async () => {
                setLoadingProgressTaskId(statusTask.id);
                const existing = await loadExistingProgressNote(statusTask.id);
                setProgressTask(statusTask);
                setEditingProgressQuestionId(existing?.questionId || null);
                setProgressNote(existing?.note || '');
                setProgressLinks(existing?.links?.length ? existing.links : ['']);
                setShowProgressModal(true);
                setLoadingProgressTaskId(null);
              }}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                background: 'white',
                color: '#334155',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: savingProgressNoteTaskId === statusTask.id ? 'not-allowed' : 'pointer',
              }}
              title="Add progress note for EOD"
            >
              {savingProgressNoteTaskId === statusTask.id
                ? 'Saving…'
                : loadingProgressTaskId === statusTask.id
                  ? 'Loading…'
                  : existingProgressNoteByTaskId[statusTask.id]
                    ? 'Edit note'
                    : 'Progress note'}
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
              type="button"
              onClick={() => navigate(`/project/${rowProjectId}`)}
              style={{
                padding: '0.35rem 0.75rem', borderRadius: '6px',
                border: `1px solid ${color}`, background: 'white', color,
                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
              }}
            >
              Open project
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <>
      <div
        style={{
          marginBottom: '1.5rem', padding: '1.25rem 1.5rem', borderRadius: '12px',
          border: `1px solid ${color}40`,
          background: `linear-gradient(135deg, ${color}08 0%, ${color}15 100%)`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FaFlag style={{ color, fontSize: '1.125rem' }} />
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>
              Today&apos;s priority projects
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.8125rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              Date
              <input
                type="date"
                value={focusDateStr}
                onChange={(e) => setFocusDateStr(e.target.value)}
                style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8125rem' }}
              />
            </label>
            <button
              type="button"
              onClick={() => loadDepartmentFocus()}
              disabled={loading}
              style={{
                padding: '0.4rem 0.75rem', borderRadius: '8px',
                border: '1px solid #e2e8f0', background: 'white',
                fontSize: '0.8125rem', cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading ? <FaSpinner className="spinner" style={{ animation: 'spin 1s linear infinite' }} /> : 'Refresh'}
            </button>
            {canEditTeamOverride && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTeamOverrideIds(
                    overrideFocusRows.map((r) => r.taskId).filter(Boolean) as string[],
                  );
                  setShowTeamOverrideModal(true);
                }}
                style={{
                  padding: '0.4rem 0.9rem', borderRadius: '8px', border: 'none',
                  background: color, color: 'white', fontWeight: 600,
                  fontSize: '0.8125rem', cursor: 'pointer',
                }}
              >
                Team add-ons
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.5 }}>
          <strong>PM priorities</strong> are set by Project Managers (Department priorities in the sidebar). Everyone in {departmentName} sees them here.{' '}
          <strong>Team add-ons</strong> are optional extra clients your team lead can flag when you&apos;re also working on work outside the PM list (they cannot duplicate PM picks).
        </p>

        {/* Error */}
        {fetchError && (
          <div style={{ margin: '0 0 0.75rem 0', padding: '0.5rem 0.75rem', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: '0.8125rem' }}>
            {fetchError}
          </div>
        )}

        {loading ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8' }}>Loading…</p>
        ) : (
          <>
            {/* PM priorities */}
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              PM priorities
            </h3>
            {pmFocusRows.length === 0 ? (
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#94a3b8', fontStyle: 'italic' }}>
                None for this date yet. PMs set these from <strong>Department priorities</strong> (sidebar).
              </p>
            ) : (
              <ul style={{ margin: '0 0 1.25rem 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {pmFocusRows.map((row, idx) => renderRow(row, idx, 'pm'))}
              </ul>
            )}

            {/* Team add-ons */}
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Team add-ons
            </h3>
            {overrideFocusRows.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8', fontStyle: 'italic' }}>
                {canEditTeamOverride
                  ? 'None yet. Use "Team add-ons" for extra clients outside the PM list.'
                  : 'None. Your team lead can add clients here when needed.'}
              </p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {overrideFocusRows.map((row, idx) => renderRow(row, idx, 'override'))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Team Override Modal */}
      {showTeamOverrideModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, padding: '1.5rem',
          }}
          onClick={() => { if (!savingTeamOverride) setShowTeamOverrideModal(false); }}
        >
          <div
            style={{
              background: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px',
              maxHeight: '85vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 24px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#111827' }}>
                Team add-on priorities — {departmentName}
              </h2>
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                Date: {focusDateStr}. Extra clients outside the PM list (cannot duplicate PM priorities).
              </p>
            </div>
            <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
              {tasksForTeamOverrideModal.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                  No eligible tasks (PM list may already include all active department tasks).
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {tasksForTeamOverrideModal.map((t: any) => {
                    const project =
                      projects.find((p: any) => p.id === t.projectId) ||
                      null;
                    const projectName =
                      t.projectName ||
                      project?.clientName ||
                      'Project';
                    const taskTitle = t.title || 'Untitled task';
                    return (
                      <label
                        key={t.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.65rem',
                          padding: '0.5rem 0.65rem', borderRadius: '8px', cursor: 'pointer',
                          border: '1px solid #f1f5f9',
                          fontSize: '0.875rem',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTeamOverrideIds.includes(t.id)}
                          onChange={() => {
                            setSelectedTeamOverrideIds((prev) =>
                              prev.includes(t.id)
                                ? prev.filter((x) => x !== t.id)
                                : [...prev, t.id]
                            );
                          }}
                          style={{ accentColor: color }}
                        />
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{taskTitle}</span>
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>({projectName})</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                disabled={savingTeamOverride}
                onClick={() => setShowTeamOverrideModal(false)}
                style={{
                  padding: '0.6rem 1.1rem', borderRadius: '8px', border: '1px solid #e5e7eb',
                  background: 'white', color: '#374151', fontWeight: 600, fontSize: '0.875rem',
                  cursor: savingTeamOverride ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingTeamOverride}
                onClick={handleSaveTeamOverride}
                style={{
                  padding: '0.6rem 1.1rem', borderRadius: '8px', border: 'none',
                  background: savingTeamOverride ? '#9ca3af' : color, color: 'white',
                  fontWeight: 600, fontSize: '0.875rem',
                  cursor: savingTeamOverride ? 'not-allowed' : 'pointer',
                }}
              >
                {savingTeamOverride ? 'Saving…' : 'Save add-ons'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showProgressModal && progressTask && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2100,
            padding: '1.5rem',
          }}
          onClick={() => {
            if (savingProgressNoteTaskId === progressTask.id) return;
            resetProgressModal();
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '620px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>
                  {editingProgressQuestionId ? 'Edit progress update' : 'Add progress update'}
                </h2>
                <button
                  type="button"
                  onClick={resetProgressModal}
                  disabled={savingProgressNoteTaskId === progressTask.id}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#64748b',
                    cursor: savingProgressNoteTaskId === progressTask.id ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.25rem',
                  }}
                >
                  <FaTimes />
                </button>
              </div>
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                This update is attached to task activity and appears in End-of-Day for unfinished planned tasks.
              </p>
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#334155' }}>
                <strong>Task:</strong> {progressTask.title || 'Untitled task'}
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>
                  Progress note
                </label>
                <textarea
                  value={progressNote}
                  onChange={(e) => setProgressNote(e.target.value)}
                  placeholder="What was completed, what is blocked, and what is next?"
                  rows={5}
                  style={{
                    width: '100%',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    padding: '0.65rem 0.75rem',
                    fontSize: '0.86rem',
                    color: '#1f2937',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>
                  Links / references (optional)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {progressLinks.map((link, idx) => (
                    <div key={`progress-link-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <FaLink style={{ color: '#94a3b8', fontSize: '0.82rem' }} />
                      <input
                        type="url"
                        value={link}
                        onChange={(e) => {
                          const next = [...progressLinks];
                          next[idx] = e.target.value;
                          setProgressLinks(next);
                        }}
                        placeholder="https://drive.google.com/... or Loom/Figma URL"
                        style={{
                          flex: 1,
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          padding: '0.5rem 0.65rem',
                          fontSize: '0.82rem',
                        }}
                      />
                      {progressLinks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setProgressLinks((prev) => prev.filter((_, i) => i !== idx))}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            padding: '0.25rem',
                          }}
                          title="Remove link"
                        >
                          <FaTimes />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setProgressLinks((prev) => [...prev, ''])}
                  style={{
                    marginTop: '0.55rem',
                    padding: '0.35rem 0.6rem',
                    borderRadius: '7px',
                    border: '1px solid #e2e8f0',
                    background: 'white',
                    color: '#334155',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    cursor: 'pointer',
                  }}
                >
                  <FaPlus style={{ fontSize: '0.65rem' }} /> Add link
                </button>
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                disabled={savingProgressNoteTaskId === progressTask.id}
                onClick={resetProgressModal}
                style={{
                  padding: '0.6rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  background: 'white',
                  color: '#374151',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: savingProgressNoteTaskId === progressTask.id ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingProgressNoteTaskId === progressTask.id || !progressNote.trim()}
                onClick={handleSaveProgressNote}
                style={{
                  padding: '0.6rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: savingProgressNoteTaskId === progressTask.id ? '#9ca3af' : color,
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: savingProgressNoteTaskId === progressTask.id ? 'not-allowed' : 'pointer',
                }}
              >
                {savingProgressNoteTaskId === progressTask.id
                  ? 'Saving…'
                  : editingProgressQuestionId
                    ? 'Save changes'
                    : 'Save update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DepartmentPriorityProjects;
