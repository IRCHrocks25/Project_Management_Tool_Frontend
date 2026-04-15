import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  FaArrowLeft,
  FaBullseye,
  FaClipboard,
  FaDownload,
  FaEdit,
  FaFileAlt,
  FaMinus,
  FaPlus,
  FaSave,
  FaSignOutAlt,
  FaSpinner,
  FaTimes,
  FaCheckCircle,
  FaCircle,
  FaChevronRight,
} from 'react-icons/fa';
import { authService } from '../services/auth.service';
import { taskService } from '../services/task.service';
import TaskDetailSideModal from './TaskDetailSideModal';
import {
  dailyFocusService,
  DailyFocusRow,
  EndOfDayReport,
  EndOfDaySnapshotMeta,
} from '../services/dailyFocus.service';
import './Dashboard.css';

const DEPT_KEYS: { key: string; label: string; color: string }[] = [
  { key: 'Copy',         label: 'Copy',         color: '#7c3aed' },
  { key: 'Design',       label: 'Design',       color: '#0ea5e9' },
  { key: 'Dev',          label: 'Dev',          color: '#10b981' },
  { key: 'AI',           label: 'AI',           color: '#f59e0b' },
  { key: 'Social Media', label: 'Social',       color: '#ec4899' },
  { key: 'CRM',          label: 'CRM',          color: '#6366f1' },
  { key: 'SEO/GEO',      label: 'SEO/GEO',      color: '#14b8a6' },
  { key: 'Onboarding',   label: 'Onboarding',   color: '#f97316' },
  { key: 'General',      label: 'General',      color: '#64748b' },
];

const DEPT_TO_TASK_TYPE: Record<string, string> = {
  Copy: 'Copy',
  Design: 'Design',
  Dev: 'Dev',
  AI: 'AI',
  'Social Media': 'Social Media',
  CRM: 'CRM',
  'SEO/GEO': 'SEO/GEO',
  Onboarding: 'Onboarding',
  General: 'General',
};

const DEPT_TO_USER_ROLES: Record<string, string[]> = {
  Copy: ['Copy Writing'],
  Design: ['Designer'],
  Dev: ['Developer'],
  AI: ['AI Developer'],
  'Social Media': ['Social Media'],
  CRM: ['CRM'],
  'SEO/GEO': ['SEO/GEO'],
  Onboarding: ['Project Manager', 'FOUNDER/CEO', 'Rapid Prospect'],
  General: [],
};

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Aligns with department kanban / EOD: For approval = work submitted (counts as done). */
function isTaskForApprovalColumn(task: any): boolean {
  if (!task || task.status !== 'In Review') return false;
  const d = task.description || '';
  if (d.includes('--- Column: Revision ---')) return false;
  if (d.includes('--- Column: Elliot Review ---')) return false;
  if (d.includes('--- Column: QA Review ---')) return false;
  if (d.includes('--- Column: Client Review ---')) return false;
  return true;
}

/** Task is finished for daily-focus pinning (same as excluded from EOD "still to do" when for approval). */
function isTaskEffectivelyDoneForFocus(t: any): boolean {
  if (t.status === 'Completed' || t.isCompleted) return true;
  if (t.project?.isArchived) return true;
  if (isTaskForApprovalColumn(t)) return true;
  return false;
}

function isTaskSelectable(t: any): boolean {
  if (t.isArchived || t.project?.isArchived) return false;
  return !isTaskEffectivelyDoneForFocus(t);
}

function escapeCsv(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Matches EOD report rules: in "completed today" set, or server `doneForEod` (for approval / formal done). Avoids `??` with `false` hiding the completed-today fallback. */
function isPlannedRowDoneForEod(
  p: { taskId: string; doneForEod?: boolean },
  completedTaskIds: Set<string>,
): boolean {
  if (completedTaskIds.has(p.taskId)) return true;
  const anyP = p as { doneForEod?: boolean; done_for_eod?: boolean };
  const raw = anyP.doneForEod ?? anyP.done_for_eod;
  return raw === true || (typeof raw === 'string' && raw === 'true');
}

function buildEodCsv(report: EndOfDayReport): string {
  const lines: string[] = [];
  lines.push(['section','department','project','task_title','assignee','planned_rank','completed','completed_at','latest_progress_note','latest_progress_by','latest_progress_at'].join(','));
  const completedById = new Map(report.completed.map((c) => [c.taskId, c]));
  const completedIds = new Set(report.completed.map((c) => c.taskId));
  report.planned.forEach((p) => {
    const c = completedById.get(p.taskId);
    const done = isPlannedRowDoneForEod(p, completedIds);
    lines.push(['planned', escapeCsv(p.departmentKey), escapeCsv(p.projectName), escapeCsv(p.taskTitle), escapeCsv(p.assigneeName), p.rank ?? '', done ? 'yes' : 'no', escapeCsv(c?.completedAt || ''), '', '', ''].join(','));
  });
  report.completed.forEach((c) => {
    lines.push(['completed_today', escapeCsv(c.departmentKey), escapeCsv(c.projectName), escapeCsv(c.taskTitle), escapeCsv(c.assigneeName), '', 'yes', escapeCsv(c.completedAt), '', '', ''].join(','));
  });
  report.notDone.forEach((p) => {
    lines.push([
      'not_done',
      escapeCsv(p.departmentKey),
      escapeCsv(p.projectName),
      escapeCsv(p.taskTitle),
      escapeCsv(p.assigneeName),
      p.rank ?? '',
      'no',
      '',
      escapeCsv(p.latestProgressUpdate?.text || ''),
      escapeCsv(p.latestProgressUpdate?.authorName || ''),
      escapeCsv(p.latestProgressUpdate?.createdAt || ''),
    ].join(','));
  });
  return lines.join('\n');
}

function buildEodPlainText(report: EndOfDayReport): string {
  const lines: string[] = [];
  lines.push(`End of day — ${report.date} (${report.timezone})`);
  lines.push('');
  lines.push('Planned (morning pins):');
  report.planned.forEach((p) => { lines.push(`- [${p.departmentKey}] (#${p.rank}) ${p.taskTitle} — ${p.projectName || 'Project'} — ${p.assigneeName || 'Unassigned'}`); });
  lines.push('');
  lines.push('Completed today (all departments):');
  report.completed.forEach((c) => { lines.push(`- [${c.departmentKey}] ${c.taskTitle} — ${c.projectName || 'Project'} — ${c.assigneeName || 'Unassigned'}`); });
  lines.push('');
  lines.push('Planned but not completed today:');
  if (report.notDone.length === 0) { lines.push('- (none)'); }
  else {
    report.notDone.forEach((p) => {
      const progress = p.latestProgressUpdate
        ? ` | progress: ${p.latestProgressUpdate.text} (${p.latestProgressUpdate.authorName})`
        : '';
      lines.push(`- [${p.departmentKey}] (#${p.rank}) ${p.taskTitle} — ${p.projectName || 'Project'}${progress}`);
    });
  }
  return lines.join('\n');
}

const MIN_SLOTS_PER_DEPT = 3;
type Slots = Record<string, string[]>;

const emptySlots = (): Slots => {
  const s: Slots = {};
  DEPT_KEYS.forEach((d) => { s[d.key] = Array(MIN_SLOTS_PER_DEPT).fill(''); });
  return s;
};

// ─── Inline styles ──────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');

  .dfe-root * { box-sizing: border-box; }
  .dfe-root { font-family: 'DM Sans', sans-serif; }

  .dfe-header {
    position: sticky; top: 0; z-index: 100;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid #f1f5f9;
    padding: 0 2rem;
    height: 60px;
    display: flex; align-items: center;
  }
  .dfe-header-inner {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; max-width: 1100px; margin: 0 auto;
  }
  .dfe-back-btn {
    display: flex; align-items: center; gap: 6px;
    font-size: 0.8125rem; font-weight: 500; color: #64748b;
    background: none; border: none; cursor: pointer; padding: 4px 0;
    transition: color 0.15s;
  }
  .dfe-back-btn:hover { color: #1e293b; }
  .dfe-logo {
    display: flex; align-items: center; gap: 8px;
    font-size: 1rem; font-weight: 700; color: #0f172a;
  }
  .dfe-logo-dot {
    width: 28px; height: 28px; border-radius: 8px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex; align-items: center; justify-content: center;
    color: white; font-size: 0.75rem;
  }
  .dfe-header-right {
    display: flex; align-items: center; gap: 10px;
  }
  .dfe-user-badge {
    font-size: 0.8125rem; color: #475569; font-weight: 500;
    background: #f8fafc; border: 1px solid #e2e8f0;
    padding: 4px 10px; border-radius: 20px;
  }
  .dfe-signout-btn {
    display: flex; align-items: center; gap: 6px;
    font-size: 0.8125rem; font-weight: 500; color: #64748b;
    background: none; border: 1px solid #e2e8f0;
    border-radius: 8px; padding: 5px 12px; cursor: pointer;
    transition: all 0.15s;
  }
  .dfe-signout-btn:hover { border-color: #cbd5e1; color: #1e293b; background: #f8fafc; }

  .dfe-main {
    max-width: 1100px; margin: 0 auto;
    padding: 2rem 2rem 4rem;
    background: #f8fafc; min-height: calc(100vh - 60px);
  }

  /* Toast */
  .dfe-toast {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 16px; border-radius: 10px;
    font-size: 0.875rem; font-weight: 500;
    margin-bottom: 1.25rem;
    animation: slideIn 0.2s ease;
  }
  @keyframes slideIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
  .dfe-toast-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .dfe-toast-error   { background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; }

  /* Tab switcher */
  .dfe-tabs {
    display: flex; gap: 4px; margin-bottom: 1.75rem;
    background: #f1f5f9; border-radius: 12px; padding: 4px;
    width: fit-content;
  }
  .dfe-tab {
    padding: 7px 20px; border-radius: 9px; border: none;
    font-size: 0.875rem; font-weight: 600; cursor: pointer;
    transition: all 0.18s; color: #64748b; background: transparent;
  }
  .dfe-tab.active {
    background: white; color: #0f172a;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04);
  }
  .dfe-tab:hover:not(.active) { color: #334155; }

  /* Toolbar row */
  .dfe-toolbar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
    margin-bottom: 1.25rem;
  }
  .dfe-date-group {
    display: flex; align-items: center; gap: 8px;
  }
  .dfe-date-label { font-size: 0.8125rem; font-weight: 600; color: #475569; }
  .dfe-date-input {
    padding: 6px 10px; border-radius: 8px;
    border: 1px solid #e2e8f0; font-size: 0.875rem;
    font-family: 'JetBrains Mono', monospace;
    background: white; color: #1e293b;
    transition: border-color 0.15s;
  }
  .dfe-date-input:focus { outline: none; border-color: #6366f1; }
  .dfe-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: 8px; font-size: 0.8125rem;
    font-weight: 600; cursor: pointer; border: none;
    transition: all 0.15s; white-space: nowrap;
    font-family: 'DM Sans', sans-serif;
  }
  .dfe-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .dfe-btn-ghost { background: white; border: 1px solid #e2e8f0; color: #334155; }
  .dfe-btn-ghost:hover:not(:disabled) { border-color: #cbd5e1; background: #f8fafc; }
  .dfe-btn-primary { background: #6366f1; color: white; }
  .dfe-btn-primary:hover:not(:disabled) { background: #4f46e5; }
  .dfe-btn-dark { background: #0f172a; color: white; }
  .dfe-btn-dark:hover:not(:disabled) { background: #1e293b; }

  /* Dept tabs */
  .dfe-dept-bar {
    display: flex; flex-wrap: wrap; gap: 6px;
    margin-bottom: 1.25rem;
  }
  .dfe-dept-tab {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 14px; border-radius: 8px; border: 1.5px solid transparent;
    font-size: 0.8125rem; font-weight: 600; cursor: pointer;
    background: white; color: #475569;
    transition: all 0.15s;
  }
  .dfe-dept-tab:hover:not(.active) { background: #f8fafc; border-color: #e2e8f0; }
  .dfe-dept-tab.active { color: white; border-color: transparent; }
  .dfe-dept-dot {
    width: 8px; height: 8px; border-radius: 50%;
  }
  .dfe-dept-filled-count {
    font-size: 0.6875rem; background: rgba(255,255,255,0.25);
    padding: 1px 5px; border-radius: 99px; font-weight: 700;
    line-height: 1.4;
  }
  .dfe-dept-filled-count.inactive {
    background: #f1f5f9; color: #94a3b8;
  }

  /* Focus panel */
  .dfe-panel {
    background: white; border-radius: 14px;
    border: 1px solid #e8edf4;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    overflow: hidden;
  }
  .dfe-panel-header {
    padding: 16px 20px; border-bottom: 1px solid #f1f5f9;
    display: flex; align-items: center; justify-content: space-between;
  }
  .dfe-panel-title {
    font-size: 0.875rem; font-weight: 700; color: #0f172a;
    display: flex; align-items: center; gap: 8px;
  }
  .dfe-panel-body { padding: 16px 20px; }

  /* Priority row */
  .dfe-priority-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 0; border-bottom: 1px solid #f8fafc;
    transition: background 0.1s;
  }
  .dfe-priority-row:last-of-type { border-bottom: none; }
  .dfe-priority-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6875rem; font-weight: 700;
    color: #94a3b8; min-width: 22px; text-align: right;
    flex-shrink: 0;
  }
  .dfe-priority-select {
    flex: 1; min-width: 0;
    padding: 7px 10px; border-radius: 8px;
    border: 1px solid #e8edf4; font-size: 0.875rem;
    font-family: 'DM Sans', sans-serif; color: #1e293b;
    background: #fafbfc; transition: all 0.15s;
    cursor: pointer;
  }
  .dfe-priority-select:focus { outline: none; border-color: #6366f1; background: white; }
  .dfe-priority-select.filled { background: white; border-color: #c7d2fe; color: #1e293b; }
  .dfe-task-btn {
    padding: 5px 10px; border-radius: 7px; font-size: 0.75rem;
    font-weight: 700; cursor: pointer; border: 1.5px solid;
    background: transparent; transition: all 0.15s; flex-shrink: 0;
    font-family: 'DM Sans', sans-serif;
    display: flex; align-items: center; gap: 4px;
  }
  .dfe-task-btn:hover { background: #6366f1; border-color: #6366f1; color: white; }
  .dfe-task-btn-icon {
    width: 28px; height: 28px; border-radius: 7px;
    border: 1.5px solid #e2e8f0; background: white;
    color: #64748b; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: all 0.15s; font-size: 0.75rem;
  }
  .dfe-task-btn-icon:hover { border-color: #6366f1; color: #6366f1; background: #eef2ff; }
  .dfe-slot-actions {
    display: flex; gap: 8px; margin-top: 12px; padding-top: 12px;
    border-top: 1px dashed #e8edf4;
  }
  .dfe-empty-dept {
    text-align: center; padding: 2rem 1rem;
    color: #94a3b8; font-size: 0.875rem;
  }

  /* EOD */
  .dfe-eod-meta {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px; border-radius: 8px;
    background: #f8fafc; border: 1px solid #e8edf4;
    font-size: 0.8125rem; color: #475569;
    margin-bottom: 1.5rem; width: fit-content;
  }
  .dfe-eod-section { margin-bottom: 1.75rem; }
  .dfe-eod-section-title {
    font-size: 0.9375rem; font-weight: 700; color: #0f172a;
    margin-bottom: 0.75rem; display: flex; align-items: center; gap: 8px;
  }
  .dfe-table-wrap {
    background: white; border-radius: 12px;
    border: 1px solid #e8edf4; overflow: hidden;
    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  }
  .dfe-table {
    width: 100%; border-collapse: collapse; font-size: 0.875rem;
  }
  .dfe-table thead tr {
    background: #f8fafc;
  }
  .dfe-table th {
    padding: 10px 14px; text-align: left;
    font-size: 0.75rem; font-weight: 700;
    color: #64748b; letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .dfe-table td {
    padding: 10px 14px; color: #334155;
    border-top: 1px solid #f1f5f9;
  }
  .dfe-table tr:hover td { background: #fafbff; }
  .dfe-done-badge {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 0.75rem; font-weight: 700;
    padding: 2px 8px; border-radius: 20px;
  }
  .dfe-done-badge.yes { background: #ecfdf5; color: #059669; }
  .dfe-done-badge.no  { background: #fff7ed; color: #c2410c; }
  .dfe-dept-badge {
    display: inline-block; padding: 2px 8px; border-radius: 6px;
    font-size: 0.75rem; font-weight: 700;
  }
  .dfe-not-done-list {
    margin: 0; padding: 0; list-style: none;
  }
  .dfe-not-done-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 14px; border-bottom: 1px solid #f1f5f9;
    background: white; font-size: 0.875rem; color: #334155;
  }
  .dfe-not-done-item:first-child { border-radius: 12px 12px 0 0; }
  .dfe-not-done-item:last-child { border-radius: 0 0 12px 12px; border-bottom: none; }
  .dfe-not-done-wrap {
    border-radius: 12px; border: 1px solid #e8edf4; overflow: hidden;
  }
  .dfe-empty-table {
    padding: 2rem; text-align: center; color: #94a3b8;
    font-size: 0.875rem;
  }

  /* Modal */
  .dfe-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(15, 23, 42, 0.5);
    display: flex; align-items: center; justify-content: center;
    z-index: 1300; padding: 1.5rem;
    backdrop-filter: blur(4px);
  }
  .dfe-modal {
    background: white; border-radius: 16px;
    width: 100%; max-width: 560px; max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 24px 64px rgba(0,0,0,0.18);
    animation: modalIn 0.2s ease;
  }
  @keyframes modalIn { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .dfe-modal-header {
    padding: 20px 24px;
    border-bottom: 1px solid #f1f5f9;
    display: flex; align-items: center; justify-content: space-between;
    position: sticky; top: 0; background: white; z-index: 1;
  }
  .dfe-modal-title { font-size: 1.125rem; font-weight: 700; color: #0f172a; }
  .dfe-modal-close {
    width: 32px; height: 32px; border-radius: 8px;
    border: 1px solid #e2e8f0; background: white;
    color: #64748b; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s; flex-shrink: 0;
  }
  .dfe-modal-close:hover { border-color: #cbd5e1; background: #f8fafc; color: #1e293b; }
  .dfe-modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
  .dfe-modal-footer {
    padding: 16px 24px; border-top: 1px solid #f1f5f9;
    display: flex; justify-content: flex-end; gap: 10px;
    position: sticky; bottom: 0; background: white; z-index: 1;
  }
  .dfe-field-label {
    display: block; font-size: 0.8125rem; font-weight: 700;
    color: #374151; margin-bottom: 6px;
  }
  .dfe-field-input, .dfe-field-textarea, .dfe-field-select {
    width: 100%; padding: 9px 12px;
    border: 1px solid #e5e7eb; border-radius: 8px;
    font-size: 0.875rem; font-family: 'DM Sans', sans-serif;
    color: #1e293b; transition: border-color 0.15s;
    background: white;
  }
  .dfe-field-input:focus, .dfe-field-textarea:focus, .dfe-field-select:focus {
    outline: none; border-color: #6366f1;
  }
  .dfe-field-textarea { resize: vertical; min-height: 88px; }
  .dfe-spinner { animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .dfe-hint {
    background: #f8fafc; border: 1px solid #e8edf4;
    border-radius: 10px; padding: 12px 14px;
    font-size: 0.8125rem; color: #64748b; line-height: 1.6;
    margin-bottom: 1rem;
  }
  .dfe-hint strong { color: #475569; }
`;

function getDeptColor(key: string) {
  return DEPT_KEYS.find((d) => d.key === key)?.color || '#64748b';
}

// ─── Component ───────────────────────────────────────────────────────────────

const DailyFocusAndEodView: React.FC = () => {
  const navigate = useNavigate();
  const user = authService.getUser();

  const [tab, setTab] = useState<'focus' | 'eod'>('focus');
  const [focusDate, setFocusDate] = useState(() => ymdLocal(new Date()));
  const [eodDate, setEodDate] = useState(() => ymdLocal(new Date()));
  const [activeDept, setActiveDept] = useState(DEPT_KEYS[0].key);
  const [slots, setSlots] = useState<Slots>(emptySlots);
  const [maxSlotsPerDept, setMaxSlotsPerDept] = useState(20);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingFocus, setLoadingFocus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eodReport, setEodReport] = useState<EndOfDayReport | null>(null);
  const [loadingEod, setLoadingEod] = useState(false);
  const [snapshots, setSnapshots] = useState<EndOfDaySnapshotMeta[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [editTaskData, setEditTaskData] = useState({ title: '', description: '', dueDate: '', assignedToId: '' });
  const [isUpdatingTaskInModal, setIsUpdatingTaskInModal] = useState(false);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<any | null>(null);
  const [taskDetailTab, setTaskDetailTab] = useState<'details' | 'conversation'>('details');
  const [showProgressDetailModal, setShowProgressDetailModal] = useState(false);
  const [selectedNotDoneRow, setSelectedNotDoneRow] = useState<any | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [createTaskData, setCreateTaskData] = useState({
    projectId: '',
    title: '',
    description: '',
    dueDate: '',
    assignedToId: '',
  });
  const eodPrintableRef = useRef<HTMLDivElement | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setLoadingTasks(true);
      const data = await taskService.getAll(undefined, undefined, { all: true });
      setAllTasks(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load tasks');
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  const applyFocusRows = useCallback((rows: DailyFocusRow[]) => {
    const next = emptySlots();
    DEPT_KEYS.forEach((d) => {
      const deptRows = rows.filter((r) => r.departmentKey === d.key);
      const maxR = deptRows.length ? Math.max(...deptRows.map((r) => r.rank)) : 0;
      const len = Math.max(MIN_SLOTS_PER_DEPT, maxR);
      const arr: string[] = Array(len).fill('');
      deptRows.forEach((r) => { if (r.rank >= 1 && r.rank <= len) arr[r.rank - 1] = r.taskId; });
      next[d.key] = arr;
    });
    setSlots(next);
  }, []);

  const loadFocus = useCallback(async () => {
    try {
      setLoadingFocus(true); setError(null);
      const rows = await dailyFocusService.getByDate(focusDate);
      applyFocusRows(rows);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load daily focus');
    } finally {
      setLoadingFocus(false);
    }
  }, [focusDate, applyFocusRows]);

  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await dailyFocusService.getMeta();
        if (!cancelled && m?.maxRankPerDepartment) setMaxSlotsPerDept(m.maxRankPerDepartment);
      } catch { if (!cancelled) setMaxSlotsPerDept(20); }
    })();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { if (tab === 'focus') loadFocus(); }, [tab, loadFocus]);
  useEffect(() => {
    (async () => {
      try { setUsers(await authService.getAllUsers()); }
      catch (e) { console.error('Failed to load users:', e); }
    })();
  }, []);

  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of allTasks) {
      const id = t.projectId; const name = t.project?.clientName;
      if (id && name) map.set(id, name);
    }
    return map;
  }, [allTasks]);

  const getProjectName = useCallback((projectId: string) => projectNameMap.get(projectId) || 'Unknown Project', [projectNameMap]);
  const getProjectPmName = useCallback((projectId: string) => {
    const hit = allTasks.find((x: any) => x.projectId === projectId && x.project?.pm?.name);
    return hit?.project?.pm?.name || '';
  }, [allTasks]);

  const handleCloseTaskDetail = useCallback(() => { setShowTaskDetailModal(false); setSelectedTaskDetail(null); }, []);
  const handleOpenTaskDetail = useCallback((task: any, tab?: 'details' | 'conversation') => {
    setSelectedTaskDetail(task); setTaskDetailTab(tab || 'details'); setShowTaskDetailModal(true);
  }, []);
  const handleEditTask = useCallback((task: any) => {
    setEditingTask(task);
    setEditTaskData({ title: task.title || '', description: task.description || '', dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '', assignedToId: task.assignedToId || '' });
    setShowEditTaskModal(true);
  }, []);

  const handleUpdateTask = async () => {
    if (!editingTask || !editTaskData.title.trim()) { alert('Please enter a task title'); return; }
    setIsUpdatingTaskInModal(true);
    try {
      const updateData: any = { title: editTaskData.title, description: editTaskData.description };
      if (editTaskData.dueDate) updateData.dueDate = new Date(editTaskData.dueDate);
      await taskService.update(editingTask.id, updateData);
      if (editTaskData.assignedToId !== (editingTask.assignedToId || '')) {
        if (editTaskData.assignedToId) await taskService.assign(editingTask.id, editTaskData.assignedToId);
        else if (editingTask.assignedToId) { try { await taskService.assign(editingTask.id, ''); } catch { /* ignore */ } }
      }
      await loadTasks();
      try { const fresh = await taskService.getOne(editingTask.id); setSelectedTaskDetail((prev: any) => prev?.id === editingTask.id ? fresh : prev); } catch { /* ignore */ }
      setShowEditTaskModal(false); setEditingTask(null);
      setEditTaskData({ title: '', description: '', dueDate: '', assignedToId: '' });
      setMessage('Task updated successfully.');
    } catch {
      setError('Failed to update task. Please try again.');
    } finally {
      setIsUpdatingTaskInModal(false);
    }
  };

  const tasksForDept = useMemo(() =>
    allTasks.filter((t) => t.type === activeDept && isTaskSelectable(t) && !t.isArchived),
    [allTasks, activeDept]
  );

  const optionsForRank = useCallback((rank: number) => {
    const row = slots[activeDept];
    const takenElsewhere = new Set(row.map((id, i) => (i !== rank && id ? id : null)).filter(Boolean) as string[]);
    let list = tasksForDept.filter((t) => !takenElsewhere.has(t.id) || t.id === row[rank]);
    const currentId = row[rank];
    // Pinned tasks must always appear as an option; otherwise the select value has no <option>
    // and the UI shows "— Select task —" even though slots count them as filled (e.g. For approval / completed).
    if (currentId) {
      const pinned = allTasks.find((t: any) => t.id === currentId && !t.isArchived);
      if (pinned && !list.some((t) => t.id === currentId)) {
        list = [...list, pinned];
      }
    }
    return list;
  }, [tasksForDept, activeDept, slots, allTasks]);

  const setSlot = (rank: number, taskId: string) => {
    setSlots((prev) => { const copy = { ...prev }; const row = [...copy[activeDept]]; row[rank] = taskId; copy[activeDept] = row; return copy; });
  };
  const addPrioritySlot = () => {
    setSlots((prev) => { const row = prev[activeDept]; if (row.length >= maxSlotsPerDept) return prev; const copy = { ...prev }; copy[activeDept] = [...row, '']; return copy; });
  };
  const removeLastPrioritySlot = () => {
    setSlots((prev) => { const row = prev[activeDept]; if (row.length <= MIN_SLOTS_PER_DEPT) return prev; const copy = { ...prev }; copy[activeDept] = row.slice(0, -1); return copy; });
  };

  const buildItemsFromSlots = () => {
    const items: Array<{ departmentKey: string; taskId: string; rank: number }> = [];
    DEPT_KEYS.forEach((d) => { slots[d.key].forEach((taskId, i) => { if (taskId) items.push({ departmentKey: d.key, taskId, rank: i + 1 }); }); });
    return items;
  };

  const handleSaveFocus = async () => {
    if (focusDate < ymdLocal(new Date())) { if (!window.confirm('You are saving pins for a past date. Continue?')) return; }
    try {
      setSaving(true); setError(null); setMessage(null);
      const rows = await dailyFocusService.save(focusDate, buildItemsFromSlots());
      applyFocusRows(rows); setMessage('Daily focus saved.');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save daily focus');
    } finally { setSaving(false); }
  };

  const loadEod = useCallback(async () => {
    try {
      setLoadingEod(true); setError(null);
      setEodReport(await dailyFocusService.getEndOfDay(eodDate));
      setSelectedSnapshotId('');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load end-of-day report'); setEodReport(null);
    } finally { setLoadingEod(false); }
  }, [eodDate]);

  const loadSnapshots = useCallback(async () => {
    try {
      setLoadingSnapshots(true);
      const data = await dailyFocusService.listEndOfDaySnapshots();
      setSnapshots(data || []);
    } catch (e: any) {
      console.error('Failed to load EOD snapshots:', e);
    } finally {
      setLoadingSnapshots(false);
    }
  }, []);

  useEffect(() => { if (tab === 'eod') loadEod(); }, [tab, eodDate, loadEod]);
  useEffect(() => { if (tab === 'eod') loadSnapshots(); }, [tab, loadSnapshots]);

  const copyEod = async () => {
    if (!eodReport) return;
    try { await navigator.clipboard.writeText(buildEodPlainText(eodReport)); setMessage('Report copied to clipboard.'); }
    catch { setError('Could not copy to clipboard.'); }
  };
  const downloadEodCsv = () => {
    if (!eodReport) return;
    const blob = new Blob([buildEodCsv(eodReport)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `eod-${eodReport.date}.csv` });
    a.click(); URL.revokeObjectURL(url);
  };

  const downloadEodPdf = async () => {
    if (!eodReport || !eodPrintableRef.current) return;
    try {
      setGeneratingPdf(true);
      const canvas = await html2canvas(eodPrintableRef.current, {
        backgroundColor: '#f8fafc',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const printableWidth = pageWidth - margin * 2;
      const printableHeight = pageHeight - margin * 2;
      const imageHeight = (canvas.height * printableWidth) / canvas.width;
      const imgData = canvas.toDataURL('image/png');

      let renderedHeight = 0;
      let pageIndex = 0;
      while (renderedHeight < imageHeight) {
        if (pageIndex > 0) {
          pdf.addPage();
        }
        const yOffset = margin - renderedHeight;
        pdf.addImage(imgData, 'PNG', margin, yOffset, printableWidth, imageHeight, undefined, 'FAST');
        renderedHeight += printableHeight;
        pageIndex += 1;
      }

      pdf.save(`eod-${eodReport.date}.pdf`);
    } catch (e) {
      console.error('Failed to generate PDF:', e);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSaveSnapshot = async () => {
    try {
      const saved = await dailyFocusService.saveEndOfDaySnapshot(eodDate);
      setMessage(`EOD snapshot saved for ${saved.reportDate}.`);
      await loadSnapshots();
      setSelectedSnapshotId(saved.id);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to save EOD snapshot');
    }
  };

  const handleLoadSnapshot = async () => {
    if (!selectedSnapshotId) return;
    try {
      setLoadingEod(true);
      const row = await dailyFocusService.getEndOfDaySnapshot(selectedSnapshotId);
      setEodReport(row.snapshot);
      setEodDate(row.reportDate);
      setMessage(`Loaded archived EOD for ${row.reportDate}.`);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load EOD snapshot');
    } finally {
      setLoadingEod(false);
    }
  };

  const extractUrls = (text: string): string[] => {
    if (!text) return [];
    const matches = text.match(/https?:\/\/[^\s)]+/g) || [];
    return Array.from(new Set(matches));
  };

  const eodCompletedTaskIds = useMemo(() => {
    if (!eodReport) return new Set<string>();
    return new Set(eodReport.completed.map((c) => c.taskId));
  }, [eodReport]);

  const departmentAnalytics = useMemo(() => {
    if (!eodReport) return [];
    const completedByDept = new Map<string, number>();
    const plannedByDept = new Map<string, number>();
    const completedPlannedByDept = new Map<string, number>();
    const completedIds = eodCompletedTaskIds;

    eodReport.completed.forEach((c) => {
      completedByDept.set(c.departmentKey, (completedByDept.get(c.departmentKey) || 0) + 1);
    });
    eodReport.planned.forEach((p) => {
      plannedByDept.set(p.departmentKey, (plannedByDept.get(p.departmentKey) || 0) + 1);
      const plannedDone = isPlannedRowDoneForEod(p, completedIds);
      if (plannedDone) {
        completedPlannedByDept.set(
          p.departmentKey,
          (completedPlannedByDept.get(p.departmentKey) || 0) + 1,
        );
      }
    });

    const allDeptKeys = new Set<string>([
      ...Array.from(plannedByDept.keys()),
      ...Array.from(completedByDept.keys()),
    ]);

    const rows = Array.from(allDeptKeys).map((deptKey) => {
      const completed = completedByDept.get(deptKey) || 0;
      const planned = plannedByDept.get(deptKey) || 0;
      const completedPlanned = completedPlannedByDept.get(deptKey) || 0;
      const completionRate = planned > 0 ? Math.round((completedPlanned / planned) * 100) : 0;
      return {
        deptKey,
        color: getDeptColor(deptKey),
        completed,
        planned,
        completedPlanned,
        completionRate,
      };
    });

    rows.sort((a, b) => {
      if (b.completed !== a.completed) return b.completed - a.completed;
      if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate;
      return a.deptKey.localeCompare(b.deptKey);
    });
    return rows;
  }, [eodReport, eodCompletedTaskIds]);

  const totalCompletedForAnalytics = useMemo(
    () => departmentAnalytics.reduce((sum, row) => sum + row.completed, 0),
    [departmentAnalytics],
  );

  // dept pill counts
  const filledCountForDept = (key: string) => slots[key]?.filter(Boolean).length ?? 0;

  const deptInfo = DEPT_KEYS.find((d) => d.key === activeDept);
  const activeDeptTaskType = DEPT_TO_TASK_TYPE[activeDept] || 'General';

  const connectedProjectsForActiveDept = useMemo(() => {
    const byProjectId = new Map<string, { id: string; clientName: string }>();
    allTasks.forEach((t: any) => {
      if (t.type !== activeDeptTaskType) return;
      if (!t.projectId || t.isArchived || t.project?.isArchived) return;
      if (!byProjectId.has(t.projectId)) {
        byProjectId.set(t.projectId, {
          id: t.projectId,
          clientName: t.project?.clientName || getProjectName(t.projectId),
        });
      }
    });
    return Array.from(byProjectId.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [allTasks, activeDeptTaskType, getProjectName]);

  const assignableUsersForActiveDept = useMemo(() => {
    const allowedRoles = DEPT_TO_USER_ROLES[activeDept] || [];
    if (allowedRoles.length === 0) return users;
    return users.filter((u: any) => allowedRoles.includes(u.role));
  }, [users, activeDept]);

  const openCreateTaskModal = () => {
    setCreateTaskData({
      projectId: connectedProjectsForActiveDept[0]?.id || '',
      title: '',
      description: '',
      dueDate: '',
      assignedToId: '',
    });
    setShowCreateTaskModal(true);
  };

  const handleCreateTask = async () => {
    if (!createTaskData.projectId || !createTaskData.title.trim()) {
      alert('Please select a connected project and enter a task title.');
      return;
    }
    try {
      setIsCreatingTask(true);
      const payload: any = {
        projectId: createTaskData.projectId,
        title: createTaskData.title.trim(),
        description: createTaskData.description.trim(),
        type: activeDeptTaskType,
        status: 'Todo',
        isCompleted: false,
      };
      if (createTaskData.dueDate) {
        payload.dueDate = new Date(createTaskData.dueDate);
      }
      if (createTaskData.assignedToId) {
        payload.assignedToId = createTaskData.assignedToId;
      }

      const createdTask = await taskService.create(payload);
      setAllTasks((prev) => [createdTask, ...prev]);

      // Auto-place the new task into the first empty slot for this department.
      setSlots((prev) => {
        const next = { ...prev };
        const deptSlots = [...(next[activeDept] || [])];
        const firstEmpty = deptSlots.findIndex((x) => !x);
        if (firstEmpty >= 0) deptSlots[firstEmpty] = createdTask.id;
        next[activeDept] = deptSlots;
        return next;
      });

      setShowCreateTaskModal(false);
      setMessage(`Task created in ${deptInfo?.label || activeDept} and linked to the selected project.`);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create task');
    } finally {
      setIsCreatingTask(false);
    }
  };

  return (
    <div className="dfe-root" style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <style>{css}</style>

      {/* ── Header ── */}
      <header className="dfe-header">
        <div className="dfe-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button type="button" className="dfe-back-btn" onClick={() => navigate('/pm-dashboard')}>
              <FaArrowLeft style={{ fontSize: '0.75rem' }} /> PM Dashboard
            </button>
            <span style={{ color: '#e2e8f0' }}>|</span>
            <div className="dfe-logo">
              <div className="dfe-logo-dot"><FaBullseye /></div>
              Daily Focus & EOD
            </div>
          </div>
          <div className="dfe-header-right">
            {user?.name && <span className="dfe-user-badge">{user.name}</span>}
            <button type="button" className="dfe-signout-btn" onClick={() => { authService.logout(); navigate('/login'); }}>
              <FaSignOutAlt style={{ fontSize: '0.75rem' }} /> Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="dfe-main">
        {message && (
          <div className="dfe-toast dfe-toast-success">
            <FaCheckCircle /> {message}
            <button type="button" onClick={() => setMessage(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#065f46' }}><FaTimes /></button>
          </div>
        )}
        {error && (
          <div className="dfe-toast dfe-toast-error">
            <span>⚠</span> {error}
            <button type="button" onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}><FaTimes /></button>
          </div>
        )}

        {/* ── Tab switcher ── */}
        <div className="dfe-tabs">
          <button type="button" className={`dfe-tab${tab === 'focus' ? ' active' : ''}`} onClick={() => { setTab('focus'); setMessage(null); }}>
            🎯 Daily Focus
          </button>
          <button type="button" className={`dfe-tab${tab === 'eod' ? ' active' : ''}`} onClick={() => { setTab('eod'); setMessage(null); }}>
            📋 End of Day
          </button>
        </div>

        {/* ════════════ FOCUS TAB ════════════ */}
        {tab === 'focus' && (
          <div>
            {/* Toolbar */}
            <div className="dfe-toolbar">
              <div className="dfe-date-group">
                <span className="dfe-date-label">Date</span>
                <input type="date" className="dfe-date-input" value={focusDate} onChange={(e) => setFocusDate(e.target.value)} />
              </div>
              <button type="button" className="dfe-btn dfe-btn-ghost" onClick={loadFocus} disabled={loadingFocus}>
                {loadingFocus ? <FaSpinner className="dfe-spinner" /> : '↺'} Load
              </button>
              <button type="button" className="dfe-btn dfe-btn-primary" onClick={handleSaveFocus} disabled={saving || loadingTasks}>
                {saving ? <><FaSpinner className="dfe-spinner" /> Saving…</> : <><FaSave /> Save pins</>}
              </button>
            </div>

            <div className="dfe-hint">
              Set priorities for the team huddle — starts with <strong>{MIN_SLOTS_PER_DEPT} slots</strong> per department, up to <strong>{maxSlotsPerDept}</strong>. Tasks must match the department type. Click <strong>Task</strong> to open the details panel, or the pencil icon to edit inline.
            </div>

            {/* Dept tabs */}
            <div className="dfe-dept-bar">
              {DEPT_KEYS.map((d) => {
                const isActive = activeDept === d.key;
                const count = filledCountForDept(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    className={`dfe-dept-tab${isActive ? ' active' : ''}`}
                    onClick={() => setActiveDept(d.key)}
                    style={isActive ? { background: d.color, borderColor: d.color } : {}}
                  >
                    <span className="dfe-dept-dot" style={{ background: isActive ? 'rgba(255,255,255,0.5)' : d.color }} />
                    {d.label}
                    {count > 0 && (
                      <span className={`dfe-dept-filled-count${isActive ? '' : ' inactive'}`}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Priority panel */}
            <div className="dfe-panel">
              <div className="dfe-panel-header">
                <div className="dfe-panel-title">
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: deptInfo?.color }} />
                  {deptInfo?.label} priorities
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                    {slots[activeDept].filter(Boolean).length} / {slots[activeDept].length} filled
                  </span>
                  <button
                    type="button"
                    className="dfe-btn dfe-btn-ghost"
                    onClick={openCreateTaskModal}
                    disabled={connectedProjectsForActiveDept.length === 0}
                    title={connectedProjectsForActiveDept.length === 0 ? 'No projects connected to this department yet' : 'Create task in this department'}
                    style={{ padding: '6px 10px' }}
                  >
                    <FaPlus style={{ fontSize: '0.65rem' }} /> Create task
                  </button>
                </div>
              </div>
              <div className="dfe-panel-body">
                {loadingTasks ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', padding: '1rem 0' }}>
                    <FaSpinner className="dfe-spinner" /> Loading tasks…
                  </div>
                ) : (
                  <>
                    {slots[activeDept].map((_, rank) => {
                      const slotTaskId = slots[activeDept][rank];
                      const slotTask = slotTaskId ? allTasks.find((x: any) => x.id === slotTaskId) : null;
                      return (
                        <div key={rank} className="dfe-priority-row">
                          <span className="dfe-priority-num">#{rank + 1}</span>
                          <select
                            className={`dfe-priority-select${slotTaskId ? ' filled' : ''}`}
                            value={slotTaskId}
                            onChange={(e) => setSlot(rank, e.target.value)}
                          >
                            <option value="">— Select task —</option>
                            {optionsForRank(rank).map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.title}{t.project?.clientName ? ` · ${t.project.clientName}` : ''}
                                {t.type !== activeDept ? ` (${t.type})` : ''}
                              </option>
                            ))}
                            {slotTaskId && !slotTask && (
                              <option value={slotTaskId}>
                                ⚠ Task missing (reload tasks or clear slot)
                              </option>
                            )}
                          </select>
                          {slotTask && (
                            <>
                              <button
                                type="button"
                                className="dfe-task-btn"
                                onClick={() => handleOpenTaskDetail(slotTask)}
                                style={{ borderColor: deptInfo?.color, color: deptInfo?.color }}
                              >
                                <FaChevronRight style={{ fontSize: '0.6rem' }} /> Task
                              </button>
                              <button
                                type="button"
                                className="dfe-task-btn-icon"
                                onClick={() => handleEditTask(slotTask)}
                                title="Edit task"
                              >
                                <FaEdit />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {tasksForDept.length === 0 && (
                      <div className="dfe-empty-dept">
                        <FaCircle style={{ fontSize: '0.5rem', opacity: 0.3, display: 'block', margin: '0 auto 6px' }} />
                        No open tasks for this department.
                        <div style={{ marginTop: 10 }}>
                          <button
                            type="button"
                            className="dfe-btn dfe-btn-ghost"
                            onClick={openCreateTaskModal}
                            disabled={connectedProjectsForActiveDept.length === 0}
                          >
                            <FaPlus style={{ fontSize: '0.65rem' }} /> Create first task
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="dfe-slot-actions">
                      <button
                        type="button"
                        className="dfe-btn dfe-btn-ghost"
                        onClick={addPrioritySlot}
                        disabled={slots[activeDept].length >= maxSlotsPerDept}
                        style={{ fontSize: '0.8125rem' }}
                      >
                        <FaPlus style={{ fontSize: '0.625rem' }} /> Add priority slot
                      </button>
                      <button
                        type="button"
                        className="dfe-btn dfe-btn-ghost"
                        onClick={removeLastPrioritySlot}
                        disabled={slots[activeDept].length <= MIN_SLOTS_PER_DEPT}
                        style={{ fontSize: '0.8125rem', color: '#94a3b8' }}
                      >
                        <FaMinus style={{ fontSize: '0.625rem' }} /> Remove last
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════ EOD TAB ════════════ */}
        {tab === 'eod' && (
          <div>
            <div className="dfe-toolbar">
              <div className="dfe-date-group">
                <span className="dfe-date-label">Date</span>
                <input type="date" className="dfe-date-input" value={eodDate} onChange={(e) => setEodDate(e.target.value)} />
              </div>
              <button type="button" className="dfe-btn dfe-btn-ghost" onClick={loadEod} disabled={loadingEod}>
                {loadingEod ? <FaSpinner className="dfe-spinner" /> : '↺'} Refresh
              </button>
              <button type="button" className="dfe-btn dfe-btn-dark" onClick={downloadEodCsv} disabled={!eodReport || loadingEod}>
                <FaDownload /> CSV
              </button>
              <button type="button" className="dfe-btn dfe-btn-dark" onClick={downloadEodPdf} disabled={!eodReport || loadingEod || generatingPdf}>
                {generatingPdf ? <><FaSpinner className="dfe-spinner" /> PDF…</> : <><FaDownload /> PDF</>}
              </button>
              <button type="button" className="dfe-btn dfe-btn-ghost" onClick={copyEod} disabled={!eodReport || loadingEod}>
                <FaClipboard /> Copy report
              </button>
              <button type="button" className="dfe-btn dfe-btn-primary" onClick={handleSaveSnapshot} disabled={loadingEod}>
                <FaSave /> Save snapshot
              </button>
              <select
                value={selectedSnapshotId}
                onChange={(e) => setSelectedSnapshotId(e.target.value)}
                className="dfe-date-input"
                style={{ minWidth: '220px' }}
                disabled={loadingSnapshots}
              >
                <option value="">{loadingSnapshots ? 'Loading archives...' : 'Select archived EOD'}</option>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.reportDate} ({s.timezone})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="dfe-btn dfe-btn-ghost"
                onClick={handleLoadSnapshot}
                disabled={!selectedSnapshotId || loadingEod}
              >
                Load archived
              </button>
            </div>

            {loadingEod && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', padding: '2rem 0' }}>
                <FaSpinner className="dfe-spinner" /> Loading report…
              </div>
            )}

            {eodReport && !loadingEod && (
              <div ref={eodPrintableRef}>
                <div className="dfe-eod-meta">
                  🕐 Day boundaries in timezone: <strong style={{ color: '#334155' }}>{eodReport.timezone}</strong>
                  &nbsp;·&nbsp; Planned <strong>Done</strong> = marked Completed within that day, or <strong>For approval</strong> (work submitted; archived projects excluded).
                </div>

                {/* Analytics */}
                <div className="dfe-eod-section">
                  <div className="dfe-eod-section-title">
                    📊 Department completion analytics
                  </div>
                  <div
                    className="dfe-table-wrap"
                    style={{ padding: '1rem 1.1rem', display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1rem' }}
                  >
                    <div style={{ borderRight: '1px solid #eef2f7', paddingRight: '1rem' }}>
                      {departmentAnalytics.length > 0 && totalCompletedForAnalytics > 0 ? (
                        <>
                          <div
                            style={{
                              width: '130px',
                              height: '130px',
                              margin: '0 auto 0.75rem auto',
                              borderRadius: '50%',
                              background: `conic-gradient(${departmentAnalytics
                                .filter((d) => d.completed > 0)
                                .map((d, idx, arr) => {
                                  const prev = arr
                                    .slice(0, idx)
                                    .reduce((s, x) => s + x.completed, 0);
                                  const start = (prev / totalCompletedForAnalytics) * 360;
                                  const end = ((prev + d.completed) / totalCompletedForAnalytics) * 360;
                                  return `${d.color} ${start}deg ${end}deg`;
                                })
                                .join(', ')})`,
                              position: 'relative',
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                inset: '18px',
                                borderRadius: '50%',
                                background: 'white',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                lineHeight: 1.1,
                              }}
                            >
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Completed</span>
                              <strong style={{ fontSize: '1.15rem', color: '#0f172a' }}>{totalCompletedForAnalytics}</strong>
                            </div>
                          </div>
                          <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#334155' }}>
                            Top dept:{' '}
                            <strong style={{ color: departmentAnalytics[0]?.color }}>
                              {departmentAnalytics[0]?.deptKey}
                            </strong>{' '}
                            ({departmentAnalytics[0]?.completed} done)
                          </div>
                        </>
                      ) : (
                        <div style={{ color: '#94a3b8', fontSize: '0.82rem', textAlign: 'center', paddingTop: '2.4rem' }}>
                          No completed tasks for this day yet.
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {departmentAnalytics.length === 0 ? (
                        <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>No department data yet.</div>
                      ) : (
                        departmentAnalytics.map((row) => {
                          const widthPct = totalCompletedForAnalytics > 0
                            ? Math.max(8, Math.round((row.completed / totalCompletedForAnalytics) * 100))
                            : 8;
                          return (
                            <div key={`analytics-${row.deptKey}`}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', color: '#334155' }}>
                                  <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: row.color }} />
                                  <strong>{row.deptKey}</strong>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  {row.completed} done
                                  {row.planned > 0 ? ` · ${row.completedPlanned}/${row.planned} planned (${row.completionRate}%)` : ''}
                                </div>
                              </div>
                              <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${widthPct}%`,
                                    height: '100%',
                                    background: row.color,
                                    borderRadius: '999px',
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Planned */}
                <div className="dfe-eod-section">
                  <div className="dfe-eod-section-title">
                    <FaBullseye style={{ color: '#6366f1' }} /> Planned (morning pins)
                  </div>
                  <div className="dfe-table-wrap">
                    {eodReport.planned.length === 0 ? (
                      <div className="dfe-empty-table">No pins for this date.</div>
                    ) : (
                      <table className="dfe-table">
                        <thead>
                          <tr>
                            <th>Dept</th>
                            <th>#</th>
                            <th>Task</th>
                            <th>Project</th>
                            <th>Assignee</th>
                            <th>Done today</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eodReport.planned.map((p) => {
                            const done = isPlannedRowDoneForEod(p, eodCompletedTaskIds);
                            const color = getDeptColor(p.departmentKey);
                            return (
                              <tr key={p.id}>
                                <td>
                                  <span className="dfe-dept-badge" style={{ background: color + '1a', color }}>
                                    {p.departmentKey}
                                  </span>
                                </td>
                                <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: '#94a3b8' }}>{p.rank}</td>
                                <td style={{ fontWeight: 500 }}>{p.taskTitle}</td>
                                <td style={{ color: '#64748b' }}>{p.projectName}</td>
                                <td style={{ color: '#64748b' }}>{p.assigneeName}</td>
                                <td>
                                  <span className={`dfe-done-badge ${done ? 'yes' : 'no'}`}>
                                    {done ? <FaCheckCircle /> : <FaCircle style={{ fontSize: '0.5rem' }} />}
                                    {done ? 'Yes' : 'No'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Completed */}
                <div className="dfe-eod-section">
                  <div className="dfe-eod-section-title">
                    <FaCheckCircle style={{ color: '#10b981' }} /> Completed today (all departments)
                  </div>
                  <div className="dfe-table-wrap">
                    {eodReport.completed.length === 0 ? (
                      <div className="dfe-empty-table">No tasks completed on this day.</div>
                    ) : (
                      <table className="dfe-table">
                        <thead>
                          <tr>
                            <th>Dept</th>
                            <th>Task</th>
                            <th>Project</th>
                            <th>Assignee</th>
                            <th>Completed at (UTC)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eodReport.completed.map((c) => {
                            const color = getDeptColor(c.departmentKey);
                            return (
                              <tr key={c.taskId}>
                                <td>
                                  <span className="dfe-dept-badge" style={{ background: color + '1a', color }}>
                                    {c.departmentKey}
                                  </span>
                                </td>
                                <td style={{ fontWeight: 500 }}>{c.taskTitle}</td>
                                <td style={{ color: '#64748b' }}>{c.projectName}</td>
                                <td style={{ color: '#64748b' }}>{c.assigneeName}</td>
                                <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: '#64748b' }}>{c.completedAt}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Not done */}
                <div className="dfe-eod-section">
                  <div className="dfe-eod-section-title">
                    <FaFileAlt style={{ color: '#f59e0b' }} /> Planned but not completed
                  </div>
                  {eodReport.notDone.length === 0 ? (
                    <div style={{ color: '#10b981', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FaCheckCircle /> All planned tasks were completed!
                    </div>
                  ) : (
                    <div className="dfe-not-done-wrap">
                      <table className="dfe-table">
                        <thead>
                          <tr>
                            <th>Dept</th>
                            <th>#</th>
                            <th>Task</th>
                            <th>Project</th>
                            <th>Assignee</th>
                            <th>Progress note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eodReport.notDone.map((p) => {
                            const color = getDeptColor(p.departmentKey);
                            const hasProgress = !!p.latestProgressUpdate;
                            return (
                              <tr key={p.id}>
                                <td>
                                  <span className="dfe-dept-badge" style={{ background: color + '1a', color }}>
                                    {p.departmentKey}
                                  </span>
                                </td>
                                <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: '#94a3b8' }}>
                                  #{p.rank}
                                </td>
                                <td style={{ fontWeight: 500 }}>{p.taskTitle}</td>
                                <td style={{ color: '#64748b' }}>{p.projectName}</td>
                                <td style={{ color: '#64748b' }}>{p.assigneeName || 'Unassigned'}</td>
                                <td>
                                  {hasProgress ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedNotDoneRow(p);
                                        setShowProgressDetailModal(true);
                                      }}
                                      style={{
                                        padding: '0.3rem 0.55rem',
                                        borderRadius: '6px',
                                        border: '1px solid #c7d2fe',
                                        background: '#eef2ff',
                                        color: '#4338ca',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      View note
                                    </button>
                                  ) : (
                                    <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>No update</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Edit Task Modal ── */}
      {showCreateTaskModal && (
        <div className="dfe-modal-overlay" onClick={() => setShowCreateTaskModal(false)}>
          <div className="dfe-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dfe-modal-header">
              <div className="dfe-modal-title">Create {deptInfo?.label || activeDept} Task</div>
              <button type="button" className="dfe-modal-close" onClick={() => setShowCreateTaskModal(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="dfe-modal-body">
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Department will be set to <strong>{activeDeptTaskType}</strong>. Only projects already connected to this department are shown.
              </div>
              <div>
                <label className="dfe-field-label">Project *</label>
                <select
                  className="dfe-field-select"
                  value={createTaskData.projectId}
                  onChange={(e) => setCreateTaskData((prev) => ({ ...prev, projectId: e.target.value }))}
                >
                  <option value="">Select connected project...</option>
                  {connectedProjectsForActiveDept.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.clientName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="dfe-field-label">Task Title *</label>
                <input
                  type="text"
                  className="dfe-field-input"
                  value={createTaskData.title}
                  onChange={(e) => setCreateTaskData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter task title"
                />
              </div>
              <div>
                <label className="dfe-field-label">Description</label>
                <textarea
                  className="dfe-field-textarea"
                  value={createTaskData.description}
                  onChange={(e) => setCreateTaskData((prev) => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  placeholder="Optional task description"
                />
              </div>
              <div>
                <label className="dfe-field-label">Due Date</label>
                <input
                  type="date"
                  className="dfe-field-input"
                  value={createTaskData.dueDate}
                  onChange={(e) => setCreateTaskData((prev) => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="dfe-field-label">Assign To (Optional)</label>
                <select
                  className="dfe-field-select"
                  value={createTaskData.assignedToId}
                  onChange={(e) => setCreateTaskData((prev) => ({ ...prev, assignedToId: e.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {assignableUsersForActiveDept.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="dfe-modal-footer">
              <button type="button" className="dfe-btn dfe-btn-ghost" onClick={() => setShowCreateTaskModal(false)} disabled={isCreatingTask}>
                Cancel
              </button>
              <button
                type="button"
                className="dfe-btn dfe-btn-primary"
                onClick={handleCreateTask}
                disabled={isCreatingTask || !createTaskData.projectId || !createTaskData.title.trim()}
              >
                {isCreatingTask ? <><FaSpinner className="dfe-spinner" /> Creating…</> : <><FaPlus /> Create Task</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Task Modal ── */}
      {showProgressDetailModal && selectedNotDoneRow && (
        <div className="dfe-modal-overlay" onClick={() => { setShowProgressDetailModal(false); setSelectedNotDoneRow(null); }}>
          <div className="dfe-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dfe-modal-header">
              <div className="dfe-modal-title">Progress update details</div>
              <button type="button" className="dfe-modal-close" onClick={() => { setShowProgressDetailModal(false); setSelectedNotDoneRow(null); }}>
                <FaTimes />
              </button>
            </div>
            <div className="dfe-modal-body">
              <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                <strong>Task:</strong> {selectedNotDoneRow.taskTitle}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                <strong>Assignee:</strong> {selectedNotDoneRow.assigneeName || 'Unassigned'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                <strong>Updated by:</strong> {selectedNotDoneRow.latestProgressUpdate?.authorName || 'Unknown'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                <strong>Updated at:</strong> {selectedNotDoneRow.latestProgressUpdate?.createdAt || '—'}
              </div>
              <div>
                <label className="dfe-field-label">Note</label>
                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.86rem',
                    color: '#1f2937',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '0.7rem 0.8rem',
                    lineHeight: 1.5,
                  }}
                >
                  {selectedNotDoneRow.latestProgressUpdate?.text || 'No note'}
                </div>
              </div>
              {extractUrls(selectedNotDoneRow.latestProgressUpdate?.text || '').length > 0 && (
                <div>
                  <label className="dfe-field-label">Links</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {extractUrls(selectedNotDoneRow.latestProgressUpdate?.text || '').map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '0.82rem',
                          color: '#2563eb',
                          textDecoration: 'none',
                          wordBreak: 'break-all',
                        }}
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="dfe-modal-footer">
              <button type="button" className="dfe-btn dfe-btn-primary" onClick={() => { setShowProgressDetailModal(false); setSelectedNotDoneRow(null); }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Task Modal ── */}
      {showEditTaskModal && editingTask && (
        <div className="dfe-modal-overlay">
          <div className="dfe-modal">
            <div className="dfe-modal-header">
              <div className="dfe-modal-title">Edit Task</div>
              <button type="button" className="dfe-modal-close" onClick={() => { setShowEditTaskModal(false); setEditingTask(null); setEditTaskData({ title: '', description: '', dueDate: '', assignedToId: '' }); }}>
                <FaTimes />
              </button>
            </div>
            <div className="dfe-modal-body">
              <div>
                <label className="dfe-field-label">Task Title *</label>
                <input type="text" className="dfe-field-input" value={editTaskData.title} onChange={(e) => setEditTaskData({ ...editTaskData, title: e.target.value })} placeholder="Enter task title" />
              </div>
              <div>
                <label className="dfe-field-label">Description</label>
                <textarea className="dfe-field-textarea" value={editTaskData.description} onChange={(e) => setEditTaskData({ ...editTaskData, description: e.target.value })} placeholder="Enter task description" rows={4} />
              </div>
              <div>
                <label className="dfe-field-label">Due Date</label>
                <input type="date" className="dfe-field-input" value={editTaskData.dueDate} onChange={(e) => setEditTaskData({ ...editTaskData, dueDate: e.target.value })} />
              </div>
              <div>
                <label className="dfe-field-label">Assign To</label>
                <select className="dfe-field-select" value={editTaskData.assignedToId} onChange={(e) => setEditTaskData({ ...editTaskData, assignedToId: e.target.value })}>
                  <option value="">Unassigned</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div className="dfe-modal-footer">
              <button type="button" className="dfe-btn dfe-btn-ghost" onClick={() => { setShowEditTaskModal(false); setEditingTask(null); setEditTaskData({ title: '', description: '', dueDate: '', assignedToId: '' }); }}>
                Cancel
              </button>
              <button type="button" className="dfe-btn dfe-btn-primary" onClick={handleUpdateTask} disabled={isUpdatingTaskInModal || !editTaskData.title.trim()}>
                {isUpdatingTaskInModal ? <><FaSpinner className="dfe-spinner" /> Updating…</> : <><FaSave /> Update Task</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <TaskDetailSideModal
        isOpen={!!(showTaskDetailModal && selectedTaskDetail)}
        task={selectedTaskDetail}
        onClose={handleCloseTaskDetail}
        allUsers={users}
        getProjectName={getProjectName}
        getProjectPmName={getProjectPmName}
        onEditTask={handleEditTask}
        initialTab={taskDetailTab}
        onTaskUpdate={(updatedTask) => {
          setSelectedTaskDetail(updatedTask);
          setAllTasks((prev) => prev.map((t: any) => t.id === updatedTask?.id ? updatedTask : t));
        }}
      />
    </div>
  );
};

export default DailyFocusAndEodView;