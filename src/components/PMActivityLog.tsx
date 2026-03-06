import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaHistory, FaTimes, FaClock, FaUser, FaBell, FaCog, FaSignOutAlt, FaArrowLeft, FaSearch, FaUsers, FaExchangeAlt, FaCheckSquare, FaSquare } from 'react-icons/fa';
import { authService } from '../services/auth.service';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import { notificationService } from '../services/notification.service';
import { clientUpdatesService } from '../services/client-updates.service';
import NotificationsModal from './NotificationsModal';
import './Dashboard.css';

/* ─── Styles (same design language as DepartmentActivityLog) ──────────────── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

  .pm-root * { box-sizing: border-box; }
  .pm-root {
    font-family: 'DM Sans', sans-serif;
    background: #f5f6fa;
    min-height: 100vh;
    color: #1e293b;
  }

  /* ── NAV ── */
  .pm-nav {
    position: sticky; top: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 2rem; height: 58px;
    background: #fff;
    border-bottom: 1px solid #e8ecf0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .pm-nav-back {
    display: flex; align-items: center; gap: 0.5rem;
    background: transparent; border: none; color: #94a3b8;
    cursor: pointer; font-family: 'DM Sans', sans-serif;
    font-size: 0.875rem; font-weight: 500;
    padding: 0.375rem 0.625rem; border-radius: 6px; transition: all 0.15s;
  }
  .pm-nav-back:hover { background: #f1f5f9; color: #475569; }
  .pm-nav-title {
    font-size: 0.8125rem; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8;
  }
  .pm-nav-right { display: flex; align-items: center; gap: 0.625rem; }
  .pm-icon-btn {
    position: relative; background: transparent; border: none; color: #94a3b8;
    cursor: pointer; width: 34px; height: 34px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; transition: all 0.15s;
  }
  .pm-icon-btn:hover { background: #f1f5f9; color: #475569; }
  .pm-badge {
    position: absolute; top: 2px; right: 2px;
    min-width: 16px; height: 16px; border-radius: 8px;
    font-size: 0.5625rem; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #fff;
  }

  /* ── AVATAR DROPDOWN ── */
  .pm-avatar {
    width: 30px; height: 30px; border-radius: 8px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.75rem; font-weight: 700; color: white;
    cursor: pointer; border: none; transition: opacity 0.15s;
  }
  .pm-avatar:hover { opacity: 0.85; }
  .pm-dropdown {
    position: absolute; top: calc(100% + 8px); right: 0; width: 210px;
    background: #fff; border: 1px solid #e8ecf0; border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.1); z-index: 9999; overflow: hidden;
    animation: pmFadeDown 0.15s ease;
  }
  @keyframes pmFadeDown {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .pm-dropdown-header {
    padding: 0.875rem 1rem; border-bottom: 1px solid #f1f5f9;
    display: flex; align-items: center; gap: 0.625rem;
  }
  .pm-dropdown-name { font-size: 0.875rem; font-weight: 600; color: #1e293b; }
  .pm-dropdown-email { font-size: 0.75rem; color: #94a3b8; margin-top: 1px; }
  .pm-dropdown-item {
    display: flex; align-items: center; gap: 0.625rem;
    width: 100%; background: transparent; border: none;
    padding: 0.5625rem 1rem; font-family: 'DM Sans', sans-serif;
    font-size: 0.8125rem; color: #475569; cursor: pointer;
    transition: all 0.12s; text-align: left;
  }
  .pm-dropdown-item:hover { background: #f8fafc; color: #1e293b; }
  .pm-dropdown-item.danger { color: #ef4444; }
  .pm-dropdown-item.danger:hover { background: #fef2f2; }
  .pm-divider { height: 1px; background: #f1f5f9; margin: 4px 0; }

  /* ── MAIN ── */
  .pm-main { max-width: 1280px; margin: 0 auto; padding: 2rem 2rem 3rem; }

  /* ── PAGE HEADER ── */
  .pm-page-header {
    display: flex; align-items: flex-end; justify-content: space-between;
    margin-bottom: 1.75rem; gap: 1rem; flex-wrap: wrap;
  }
  .pm-page-heading {
    font-size: 1.5rem; font-weight: 600; color: #0f172a;
    margin: 0 0 0.25rem; letter-spacing: -0.02em;
  }
  .pm-page-sub { font-size: 0.875rem; color: #94a3b8; margin: 0; }

  /* ── SEARCH ── */
  .pm-search-wrap { position: relative; }
  .pm-search-wrap svg {
    position: absolute; left: 0.75rem; top: 50%;
    transform: translateY(-50%); color: #cbd5e1; font-size: 0.75rem; pointer-events: none;
  }
  .pm-search {
    background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
    color: #1e293b; font-family: 'DM Sans', sans-serif; font-size: 0.875rem;
    padding: 0.5rem 0.875rem 0.5rem 2.125rem; width: 210px;
    transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  }
  .pm-search::placeholder { color: #cbd5e1; }
  .pm-search:focus { outline: none; border-color: #6366f1; width: 250px; box-shadow: 0 0 0 3px rgba(99,102,241,0.08); }

  /* ── STATS ── */
  .pm-stats {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 1px; background: #e8ecf0; border: 1px solid #e8ecf0;
    border-radius: 12px; overflow: hidden; margin-bottom: 2rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .pm-stat {
    background: #fff; padding: 1.125rem 1.375rem;
    display: flex; flex-direction: column; gap: 0.25rem;
  }
  .pm-stat-dot { width: 6px; height: 6px; border-radius: 50%; margin-bottom: 0.125rem; }
  .pm-stat-value {
    font-family: 'DM Mono', monospace; font-size: 1.5rem;
    font-weight: 500; color: #0f172a; line-height: 1;
  }
  .pm-stat-label {
    font-size: 0.6875rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.07em; color: #94a3b8;
  }

  /* ── PM TABS ── */
  .pm-tabs-row {
    display: flex; align-items: stretch; flex-wrap: nowrap;
    background: #fff; border: 1px solid #e2e8f0;
    border-radius: 12px 12px 0 0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    overflow-x: auto; overflow-y: hidden;
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 transparent;
  }
  .pm-tabs-row::-webkit-scrollbar {
    height: 6px;
  }
  .pm-tabs-row::-webkit-scrollbar-track {
    background: transparent;
  }
  .pm-tabs-row::-webkit-scrollbar-thumb {
    background: #cbd5e1; border-radius: 3px;
  }
  .pm-tabs-row::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  .pm-tab {
    display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;
    background: transparent; border: none;
    padding: 0.875rem 1.375rem;
    font-family: 'DM Sans', sans-serif; font-size: 0.875rem; font-weight: 500;
    color: #94a3b8; cursor: pointer;
    border-right: 1px solid #f1f5f9;
    transition: all 0.15s; position: relative; white-space: nowrap;
  }
  .pm-tab:last-child { border-right: none; }
  .pm-tab:hover { background: #f8fafc; color: #475569; }
  .pm-tab.active { color: #1e293b; font-weight: 600; background: #fff; }
  .pm-tab.active::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0;
    height: 2.5px; border-radius: 2px 2px 0 0;
    background: #6366f1;
  }
  .pm-tab-avatar {
    width: 22px; height: 22px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.625rem; font-weight: 700; color: white; flex-shrink: 0;
  }
  .pm-tab-count {
    font-family: 'DM Mono', monospace; font-size: 0.6875rem;
    padding: 0.125rem 0.4375rem; border-radius: 20px;
    background: #f1f5f9; color: #94a3b8; font-weight: 500; transition: all 0.15s;
  }
  .pm-tab.active .pm-tab-count {
    background: #eef2ff; color: #6366f1;
  }

  /* ── TAB PANEL ── */
  .pm-tab-panel {
    background: #fff; border: 1px solid #e2e8f0; border-top: none;
    border-radius: 0 0 12px 12px; overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04); min-height: 320px;
    animation: pmFadeTab 0.18s ease;
  }
  @keyframes pmFadeTab {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── PM PANEL HEADER ── */
  .pm-panel-header {
    padding: 1.125rem 1.5rem;
    border-bottom: 1px solid #f8fafc;
    display: flex; align-items: center; justify-content: space-between;
    background: #fafbfc;
  }
  .pm-panel-pm-info { display: flex; align-items: center; gap: 0.75rem; }
  .pm-panel-avatar {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.875rem; font-weight: 700; color: white; flex-shrink: 0;
  }
  .pm-panel-name { font-size: 0.9375rem; font-weight: 600; color: #0f172a; }
  .pm-panel-role { font-size: 0.8125rem; color: #94a3b8; margin-top: 1px; }
  .pm-panel-meta { display: flex; align-items: center; gap: 0.75rem; }
  .pm-panel-stat {
    display: flex; flex-direction: column; align-items: flex-end;
    gap: 0.125rem;
  }
  .pm-panel-stat-val {
    font-family: 'DM Mono', monospace; font-size: 1.125rem;
    font-weight: 500; color: #0f172a; line-height: 1;
  }
  .pm-panel-stat-label { font-size: 0.6875rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .pm-panel-divider { width: 1px; height: 32px; background: #e8ecf0; }

  /* ── ACTIVITY LIST ── */
  .pm-activities { max-height: 560px; overflow-y: auto; }
  .pm-activities::-webkit-scrollbar { width: 4px; }
  .pm-activities::-webkit-scrollbar-track { background: transparent; }
  .pm-activities::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }

  .pm-activity {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #f8fafc;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.875rem;
    align-items: flex-start;
    transition: background 0.1s;
  }
  .pm-activity:last-child { border-bottom: none; }
  .pm-activity:hover { background: #fafbfc; }

  .pm-activity-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: #6366f1; margin-top: 0.4375rem; flex-shrink: 0;
  }
  .pm-activity-project {
    font-size: 0.875rem; font-weight: 600; color: #1e293b; margin-bottom: 0.25rem;
  }
  .pm-activity-desc {
    font-size: 0.875rem; color: #475569; margin-bottom: 0.375rem; line-height: 1.4;
  }
  .pm-activity-time {
    font-family: 'DM Mono', monospace; font-size: 0.6875rem;
    color: #cbd5e1; display: flex; align-items: center; gap: 0.375rem;
  }
  .pm-activity-type {
    display: inline-flex; align-items: center;
    padding: 0.1875rem 0.5rem; border-radius: 4px;
    font-size: 0.6875rem; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
    flex-shrink: 0; align-self: flex-start; margin-top: 2px;
  }

  /* ── EMPTY / NO RESULTS ── */
  .pm-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 4rem 2rem; text-align: center; color: #cbd5e1;
  }
  .pm-empty-icon { font-size: 2.25rem; margin-bottom: 1rem; opacity: 0.35; }
  .pm-empty-head { font-size: 1rem; font-weight: 600; color: #94a3b8; margin-bottom: 0.375rem; }
  .pm-empty-sub { font-size: 0.875rem; }
  .pm-no-results { padding: 2.5rem 1.5rem; text-align: center; font-size: 0.875rem; color: #94a3b8; }

  /* ── LOADING ── */
  .pm-loading {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100vh; background: #f5f6fa;
    font-family: 'DM Sans', sans-serif; font-size: 0.875rem; color: #94a3b8; gap: 0.625rem;
  }
  .pm-spinner {
    width: 20px; height: 20px; border: 2px solid #e2e8f0;
    border-top-color: #6366f1; border-radius: 50%; animation: pmSpin 0.7s linear infinite;
  }
  @keyframes pmSpin { to { transform: rotate(360deg); } }
  .pm-loading-sub { font-size: 0.8125rem; color: #cbd5e1; }

  /* ── REASSIGN MODAL ── */
  .pm-modal-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5); z-index: 10000;
    display: flex; align-items: center; justify-content: center;
    padding: 2rem; animation: pmFadeIn 0.15s ease;
  }
  @keyframes pmFadeIn { from { opacity: 0; } to { opacity: 1; } }
  .pm-modal {
    background: #fff; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    width: 100%; max-width: 700px; max-height: 85vh; display: flex; flex-direction: column;
    animation: pmSlideUp 0.2s ease;
  }
  @keyframes pmSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .pm-modal-header {
    padding: 1.5rem; border-bottom: 1px solid #e8ecf0;
    display: flex; align-items: center; justify-content: space-between;
  }
  .pm-modal-title { font-size: 1.25rem; font-weight: 600; color: #0f172a; }
  .pm-modal-close {
    background: transparent; border: none; color: #94a3b8;
    cursor: pointer; width: 32px; height: 32px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
  }
  .pm-modal-close:hover { background: #f1f5f9; color: #475569; }
  .pm-modal-body {
    padding: 1.5rem; overflow-y: auto; flex: 1;
  }
  .pm-modal-section { margin-bottom: 1.5rem; }
  .pm-modal-label {
    font-size: 0.875rem; font-weight: 600; color: #1e293b;
    margin-bottom: 0.625rem; display: block;
  }
  .pm-modal-select {
    width: 100%; padding: 0.625rem 0.875rem;
    border: 1px solid #e2e8f0; border-radius: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 0.875rem;
    color: #1e293b; background: #fff;
    transition: all 0.2s;
  }
  .pm-modal-select:focus {
    outline: none; border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.08);
  }
  .pm-modal-search {
    width: 100%; padding: 0.625rem 0.875rem 0.625rem 2.125rem;
    border: 1px solid #e2e8f0; border-radius: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 0.875rem;
    color: #1e293b; background: #fff;
    transition: all 0.2s;
  }
  .pm-modal-search::placeholder { color: #cbd5e1; }
  .pm-modal-search:focus {
    outline: none; border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.08);
  }
  .pm-projects-list {
    max-height: 300px; overflow-y: auto; border: 1px solid #e8ecf0;
    border-radius: 8px; background: #fafbfc;
  }
  .pm-project-item {
    padding: 0.875rem 1rem; border-bottom: 1px solid #f1f5f9;
    display: flex; align-items: center; gap: 0.75rem;
    transition: background 0.1s; cursor: pointer;
  }
  .pm-project-item:last-child { border-bottom: none; }
  .pm-project-item:hover { background: #fff; }
  .pm-project-checkbox {
    color: #6366f1; cursor: pointer; flex-shrink: 0;
  }
  .pm-project-name { font-size: 0.875rem; font-weight: 500; color: #1e293b; flex: 1; }
  .pm-project-meta {
    font-size: 0.75rem; color: #94a3b8;
  }
  .pm-modal-footer {
    padding: 1.5rem; border-top: 1px solid #e8ecf0;
    display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem;
  }
  .pm-modal-btn {
    padding: 0.625rem 1.25rem; border-radius: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 0.875rem; font-weight: 500;
    cursor: pointer; transition: all 0.15s; border: none;
  }
  .pm-modal-btn-secondary {
    background: #f1f5f9; color: #475569;
  }
  .pm-modal-btn-secondary:hover { background: #e2e8f0; }
  .pm-modal-btn-primary {
    background: #6366f1; color: #fff;
  }
  .pm-modal-btn-primary:hover { background: #4f46e5; }
  .pm-modal-btn-primary:disabled {
    background: #cbd5e1; color: #94a3b8; cursor: not-allowed;
  }
  .pm-reassign-btn {
    display: inline-flex; align-items: center; gap: 0.5rem;
    padding: 0.5rem 1rem; background: #f1f5f9; border: 1px solid #e2e8f0;
    border-radius: 8px; font-family: 'DM Sans', sans-serif;
    font-size: 0.8125rem; font-weight: 500; color: #475569;
    cursor: pointer; transition: all 0.15s;
  }
  .pm-reassign-btn:hover {
    background: #e2e8f0; border-color: #cbd5e1; color: #1e293b;
  }
`;

/* ─── Activity type display config ───────────────────────────────────────── */
const activityTypeStyle = (type: string): { background: string; color: string; label: string } => {
  switch (type) {
    case 'email_log':       return { background: '#eff6ff', color: '#2563eb', label: 'Email' };
    case 'task_created':    return { background: '#ecfdf5', color: '#059669', label: 'Created' };
    case 'task_assigned':   return { background: '#f5f3ff', color: '#7c3aed', label: 'Assigned' };
    case 'task_updated':    return { background: '#fff7ed', color: '#c2410c', label: 'Updated' };
    case 'task_status_changed': return { background: '#fefce8', color: '#a16207', label: 'Status' };
    default:                return { background: '#f8fafc',  color: '#64748b', label: type.replace(/_/g, ' ') };
  }
};

const fmt = (d: Date) =>
  `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

/* ── PM avatar gradient by index ── */
const PM_GRADIENTS = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#0ea5e9,#6366f1)',
  'linear-gradient(135deg,#10b981,#0ea5e9)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#ec4899,#8b5cf6)',
  'linear-gradient(135deg,#14b8a6,#6366f1)',
];

/* ═══════════════════════════════════════════════════════════════════════════ */

const PMActivityLog: React.FC = () => {
  const navigate = useNavigate();
  const user     = authService.getUser();
  const [projects,          setProjects]          = useState<any[]>([]);
  const [tasks,             setTasks]             = useState<any[]>([]);
  const [users,             setUsers]             = useState<any[]>([]);
  const [projectActivities, setProjectActivities] = useState<Record<string, any[]>>({});
  const [lastEmailLogs,     setLastEmailLogs]     = useState<Record<string, { date: string; pmName?: string; notes?: string; pmId?: string }>>({});
  const [loading,           setLoading]           = useState(true);
  const [showAvatar,        setShowAvatar]        = useState(false);
  const [showNotifs,        setShowNotifs]        = useState(false);
  const [unread,            setUnread]            = useState(0);
  const [activeTab,         setActiveTab]         = useState('');
  const [search,            setSearch]            = useState('');
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedProjects,  setSelectedProjects]  = useState<Set<string>>(new Set());
  const [newPMId,           setNewPMId]           = useState('');
  const [reassigning,      setReassigning]       = useState(false);
  const [projectSearch,    setProjectSearch]     = useState('');
  const skipRef = useRef<number | null>(null);

  const loadUnread = async () => {
    try {
      if (skipRef.current && Date.now() < skipRef.current) return;
      setUnread(await notificationService.getUnreadCount());
    } catch {}
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [pd, td, ud] = await Promise.all([
        projectService.getAll(),
        taskService.getAll(undefined, undefined, { all: true }),
        authService.getAllUsers(),
      ]);
      setProjects(pd);
      setTasks(td);
      setUsers(ud || []);

      const activeProjects  = pd.filter((p: any) => !p.isArchived);
      const sixMonthsAgo    = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const recentProjects  = activeProjects.filter((p: any) => {
        const u = p.updatedAt ? new Date(p.updatedAt) : null;
        return !u || u > sixMonthsAgo;
      }).slice(0, 100);

      await Promise.all([
        loadLastEmailLogs(recentProjects, ud || []),
        loadProjectActivities(recentProjects),
      ]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadData();
    loadUnread();
    const iv = setInterval(() => {
      if (skipRef.current && Date.now() < skipRef.current) return;
      loadUnread();
    }, 30000);
    return () => clearInterval(iv);
  }, [loadData]);

  const loadLastEmailLogs = async (projs: any[], usersData: any[]) => {
    const lastMap: Record<string, any> = {};
    const batchSize = 20;
    for (let i = 0; i < projs.length; i += batchSize) {
      await Promise.all(projs.slice(i, i + batchSize).map(async (p) => {
        try {
          const updates = await Promise.race([
            clientUpdatesService.getAllByProject(p.id),
            new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), 10000)),
          ]) as any[];
          if (updates?.length) {
            const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 3);
            const recent = updates.filter((u: any) => u.emailSentAt && new Date(u.emailSentAt) > cutoff);
            if (recent.length) {
              const last = recent[recent.length - 1];
              if (last.emailSentAt) lastMap[p.id] = { date: last.emailSentAt, pmName: last.pm?.name, pmId: last.pmId || last.pm?.id, notes: last.notes };
            }
          }
        } catch {}
      }));
    }
    setLastEmailLogs(lastMap);
  };

  const loadProjectActivities = async (projs: any[]) => {
    const map: Record<string, any[]> = {};
    const batchSize = 20;
    for (let i = 0; i < projs.length; i += batchSize) {
      await Promise.all(projs.slice(i, i + batchSize).map(async (p) => {
        try {
          const acts = await Promise.race([
            projectService.getActivity(p.id),
            new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), 10000)),
          ]) as any[];
          if (Array.isArray(acts)) {
            const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 3);
            const recent = acts.filter((a: any) => new Date(a.createdAt || a.date || a.timestamp || 0) > cutoff);
            if (recent.length) map[p.id] = recent;
          }
        } catch {}
      }));
    }
    setProjectActivities(map);
  };

  /* ── Build PM activity data ── */
  const getAllPMActivities = () => {
    const userMap  = new Map<string, any>();
    const allPMs   = new Map<string, any>();
    users.forEach((u: any) => {
      if (u.id) {
        userMap.set(u.id, u);
        if (u.role === 'Project Manager') allPMs.set(u.id, u);
      }
    });
    const projectMap = new Map<string, any>();
    projects.forEach((p: any) => projectMap.set(p.id, p));

    const allActivities: Array<{
      projectId: string; projectName: string;
      pmName: string; pmId?: string;
      activityType: string; date: Date; description: string;
    }> = [];

    // Project activity logs
    for (const [pid, acts] of Object.entries(projectActivities)) {
      const proj = projectMap.get(pid);
      const projectName = proj?.clientName || 'Unknown Project';
      for (const a of (acts || [])) {
        const uid = a.userId || a.user?.id || a.createdBy || a.pmId;
        const aUser = uid ? userMap.get(uid) : a.user;
        const isPM = aUser?.role === 'Project Manager' || a.user?.role === 'Project Manager' || a.pmId || a.pm?.role === 'Project Manager';
        if (!isPM) continue;
        allActivities.push({
          projectId: pid, projectName,
          pmName: aUser?.name || a.user?.name || a.pm?.name || 'Unknown PM',
          pmId:   aUser?.id   || uid           || a.pmId   || a.pm?.id,
          activityType: a.type || a.action || 'activity',
          date:   new Date(a.createdAt || a.date || a.timestamp || 0),
          description: a.description || a.notes || `Activity on ${projectName}`,
        });
      }
    }

    // Email logs (last per project)
    for (const [pid, log] of Object.entries(lastEmailLogs)) {
      if (!log.pmName || !log.date) continue;
      const proj = projectMap.get(pid);
      const projectName = proj?.clientName || 'Unknown Project';
      let pmId = log.pmId;
      let pmName = log.pmName;
      if (pmId) { const u = userMap.get(pmId); if (u?.role === 'Project Manager') pmName = u.name; }
      else {
        const found = Array.from(userMap.values()).find((u: any) => u.name === pmName && u.role === 'Project Manager');
        if (found) { pmId = found.id; pmName = found.name; }
      }
      if (pmName && (pmId || pmName !== 'Unknown PM')) {
        allActivities.push({ projectId: pid, projectName, pmName, pmId, activityType: 'email_log', date: new Date(log.date), description: log.notes ? `Email log: ${log.notes.substring(0, 100)}` : `Email log update for ${projectName}` });
      }
    }

    // Task activities
    const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const recentTasks = tasks.filter((t: any) => new Date(t.updatedAt || t.createdAt || 0) > threeMonthsAgo);
    const added = new Set<string>();

    for (const task of recentTasks) {
      if (!task.projectId) continue;
      const proj = projectMap.get(task.projectId);
      if (!proj) continue;
      const projectName = proj.clientName || 'Unknown Project';
      const taskDate = new Date(task.updatedAt || task.createdAt || 0);
      const pmId = proj.pmId;
      if (pmId) {
        const pm = userMap.get(pmId);
        if (pm?.role === 'Project Manager') {
          const timeDiff = Math.abs(new Date(task.updatedAt || 0).getTime() - new Date(task.createdAt || 0).getTime());
          let activityType = 'task_updated';
          let description  = `Updated task: ${task.title}`;
          if (timeDiff < 2000) { activityType = 'task_created'; description = `Created task: ${task.title}`; }
          else if (task.assignedToId) {
            const au = userMap.get(task.assignedToId);
            activityType = au ? 'task_assigned' : 'task_status_changed';
            description  = au ? `Assigned task "${task.title}" to ${au.name}` : `Changed status of "${task.title}" to ${task.status}`;
          } else if (task.status) { activityType = 'task_status_changed'; description = `Changed status of "${task.title}" to ${task.status}`; }
          const key = `${pmId}-${task.id}-${activityType}-${taskDate.getTime()}`;
          if (!added.has(key)) { added.add(key); allActivities.push({ projectId: task.projectId, projectName, pmName: pm.name, pmId, activityType, date: taskDate, description }); }
        }
      }
      const createdById = task.createdById || task.createdBy?.id;
      if (createdById) {
        const creator = userMap.get(createdById);
        const isCreatorPM = creator?.role === 'Project Manager' || task.createdBy?.role === 'Project Manager';
        if (isCreatorPM && (!pmId || pmId !== createdById)) {
          const key = `${createdById}-${task.id}-task_created-${new Date(task.createdAt || 0).getTime()}`;
          if (!added.has(key)) { added.add(key); allActivities.push({ projectId: task.projectId, projectName, pmName: creator?.name || task.createdBy?.name || 'Unknown PM', pmId: createdById, activityType: 'task_created', date: new Date(task.createdAt || 0), description: `Created task: ${task.title}` }); }
        }
      }
    }

    allActivities.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Group by PM
    const activitiesByPM = new Map<string, typeof allActivities>();
    allPMs.forEach((pm) => activitiesByPM.set(pm.id, []));
    for (const act of allActivities) {
      let key = act.pmId;
      if (!key && act.pmName) {
        const found = Array.from(allPMs.values()).find((pm: any) => pm.name === act.pmName);
        key = found ? found.id : act.pmName;
      }
      if (key) {
        if (!activitiesByPM.has(key)) activitiesByPM.set(key, []);
        activitiesByPM.get(key)!.push(act);
      }
    }

    return { allActivities, activitiesByPM, allPMs };
  };

  if (loading) return (
    <>
      <style>{css}</style>
      <div className="pm-loading">
        <div className="pm-spinner" />
        Loading PM activity…
        <span className="pm-loading-sub">This may take a moment</span>
      </div>
    </>
  );

  const { allActivities, activitiesByPM, allPMs } = getAllPMActivities();

  // Build sorted PM tab list — PMs with activity first
  const pmTabList = Array.from(activitiesByPM.entries())
    .map(([key, acts]) => {
      let info = allPMs.get(key);
      if (!info && acts.length > 0) info = { id: acts[0].pmId || key, name: acts[0].pmName, role: 'Project Manager' };
      return info ? { key, info, acts } : null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a!.acts.length > 0 && b!.acts.length === 0) return -1;
      if (a!.acts.length === 0 && b!.acts.length > 0) return 1;
      return (a!.info.name || '').localeCompare(b!.info.name || '');
    }) as Array<{ key: string; info: any; acts: any[] }>;

  const currentTabKey  = activeTab || pmTabList[0]?.key || '';
  const currentTabData = pmTabList.find(t => t.key === currentTabKey);
  const currentActs    = currentTabData?.acts || [];

  const filteredActs = search.trim()
    ? currentActs.filter(a =>
        a.projectName.toLowerCase().includes(search.toLowerCase()) ||
        a.description.toLowerCase().includes(search.toLowerCase()) ||
        a.activityType.toLowerCase().includes(search.toLowerCase())
      )
    : currentActs;

  const activePMsCount = Array.from(activitiesByPM.values()).filter(a => a.length > 0).length;

  return (
    <>
      <style>{css}</style>
      <div className="pm-root">

        {/* ── NAV ── */}
        <nav className="pm-nav">
          <button className="pm-nav-back" onClick={() => navigate('/dashboard')}>
            <FaArrowLeft /> Back
          </button>
          <span className="pm-nav-title">PM Activity Log</span>
          <div className="pm-nav-right">
            <button className="pm-icon-btn" onClick={() => setShowNotifs(true)}>
              <FaBell />
              {unread > 0 && (
                <span className="pm-badge" style={{
                  background: unread >= 10 ? '#ef4444' : unread >= 5 ? '#f59e0b' : '#10b981'
                }}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
            <div style={{ position: 'relative' }}>
              <button className="pm-avatar" onClick={() => setShowAvatar(v => !v)}>
                {user?.name?.charAt(0).toUpperCase()}
              </button>
              {showAvatar && (
                <div className="pm-dropdown" onClick={e => e.stopPropagation()}>
                  <div className="pm-dropdown-header">
                    <div className="pm-avatar" style={{ cursor: 'default' }}>{user?.name?.charAt(0).toUpperCase()}</div>
                    <div>
                      <div className="pm-dropdown-name">{user?.name}</div>
                      <div className="pm-dropdown-email">{user?.email}</div>
                    </div>
                  </div>
                  <div className="pm-divider" />
                  {[
                    { label: 'Clients',       icon: <FaUsers />,  path: '/clients' },
                    { label: 'Users',         icon: <FaUsers />,  path: '/users' },
                    { label: 'Profile',       icon: <FaUser />,   path: '/profile' },
                    { label: 'Notifications', icon: <FaBell />,   action: () => { setShowAvatar(false); setShowNotifs(true); } },
                    { label: 'Settings',      icon: <FaCog />,    path: '/settings' },
                  ].map(it => (
                    <button key={it.label} className="pm-dropdown-item"
                      onClick={() => { setShowAvatar(false); it.action ? it.action() : navigate(it.path!); }}>
                      {it.icon} {it.label}
                    </button>
                  ))}
                  <div className="pm-divider" />
                  <button className="pm-dropdown-item danger"
                    onClick={() => { authService.logout(); navigate('/'); }}>
                    <FaSignOutAlt /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* ── MAIN ── */}
        <div className="pm-main">

          {/* Page header */}
          <div className="pm-page-header">
            <div>
              <h1 className="pm-page-heading">PM Activity</h1>
              <p className="pm-page-sub">Track all Project Manager activities across projects</p>
            </div>
            <div className="pm-search-wrap">
              <FaSearch />
              <input
                className="pm-search"
                placeholder="Search activities…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="pm-stats">
            {[
              { label: 'Total PMs',        value: allPMs.size,          dot: '#6366f1' },
              { label: 'PMs with Activity',value: activePMsCount,       dot: '#059669' },
              { label: 'Total Activities', value: allActivities.length, dot: '#2563eb' },
              { label: 'Viewing',          value: currentActs.length,   dot: '#d97706' },
            ].map(s => (
              <div className="pm-stat" key={s.label}>
                <div className="pm-stat-dot" style={{ background: s.dot }} />
                <div className="pm-stat-value">{s.value}</div>
                <div className="pm-stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Empty */}
          {pmTabList.length === 0 ? (
            <div className="pm-empty" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '5rem 2rem' }}>
              <div className="pm-empty-icon"><FaHistory /></div>
              <div className="pm-empty-head">No PM activity found</div>
              <div className="pm-empty-sub">Activity will appear here as PMs interact with projects</div>
            </div>
          ) : (
            <>
              {/* PM Tabs */}
              <div className="pm-tabs-row">
                {pmTabList.map(({ key, info, acts }, idx) => {
                  const gradient = PM_GRADIENTS[idx % PM_GRADIENTS.length];
                  const active   = key === currentTabKey;
                  return (
                    <button
                      key={key}
                      className={`pm-tab${active ? ' active' : ''}`}
                      onClick={() => { setActiveTab(key); setSearch(''); }}
                    >
                      <div className="pm-tab-avatar" style={{ background: gradient }}>
                        {(info.name || '?').charAt(0).toUpperCase()}
                      </div>
                      {info.name || 'Unknown PM'}
                      <span className="pm-tab-count">{acts.length}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="pm-tab-panel" key={currentTabKey}>

                {/* PM summary header */}
                {currentTabData && (
                  <div className="pm-panel-header">
                    <div className="pm-panel-pm-info">
                      <div className="pm-panel-avatar" style={{ background: PM_GRADIENTS[pmTabList.findIndex(t => t.key === currentTabKey) % PM_GRADIENTS.length] }}>
                        {(currentTabData.info.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="pm-panel-name">{currentTabData.info.name || 'Unknown PM'}</div>
                        <div className="pm-panel-role">Project Manager</div>
                      </div>
                    </div>
                    <div className="pm-panel-meta">
                      <button
                        className="pm-reassign-btn"
                        onClick={() => {
                          const pmProjects = projects.filter((p: any) => p.pmId === currentTabData.info.id);
                          setSelectedProjects(new Set(pmProjects.map((p: any) => p.id)));
                          setNewPMId('');
                          setProjectSearch('');
                          setShowReassignModal(true);
                        }}
                        title="Reassign projects to another PM"
                      >
                        <FaExchangeAlt /> Reassign Projects
                      </button>
                      <div className="pm-panel-divider" />
                      <div className="pm-panel-stat">
                        <span className="pm-panel-stat-val">{currentActs.length}</span>
                        <span className="pm-panel-stat-label">Activities</span>
                      </div>
                      <div className="pm-panel-divider" />
                      <div className="pm-panel-stat">
                        <span className="pm-panel-stat-val">
                          {new Set(currentActs.map(a => a.projectId)).size}
                        </span>
                        <span className="pm-panel-stat-label">Projects</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Activity rows */}
                {filteredActs.length === 0 ? (
                  <div className="pm-no-results">
                    {search
                      ? `No results for "${search}"`
                      : 'No activities recorded yet'}
                  </div>
                ) : (
                  <div className="pm-activities">
                    {filteredActs.map((act, idx) => {
                      const ts = activityTypeStyle(act.activityType);
                      return (
                        <div className="pm-activity" key={idx}>
                          <div className="pm-activity-dot" />
                          <div>
                            <div className="pm-activity-project">{act.projectName}</div>
                            <div className="pm-activity-desc">{act.description}</div>
                            <div className="pm-activity-time">
                              <FaClock style={{ fontSize: '0.625rem' }} />
                              {fmt(act.date)}
                            </div>
                          </div>
                          <span className="pm-activity-type" style={{ background: ts.background, color: ts.color }}>
                            {ts.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── NOTIFS ── */}
        <NotificationsModal
          isOpen={showNotifs}
          onClose={() => { setShowNotifs(false); loadUnread(); }}
          onUpdate={loadUnread}
        />

        {/* ── REASSIGN MODAL ── */}
        {showReassignModal && currentTabData && (
          <div className="pm-modal-overlay" onClick={() => !reassigning && setShowReassignModal(false)}>
            <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="pm-modal-header">
                <h2 className="pm-modal-title">
                  Reassign Projects from {currentTabData.info.name}
                </h2>
                <button
                  className="pm-modal-close"
                  onClick={() => !reassigning && setShowReassignModal(false)}
                  disabled={reassigning}
                >
                  <FaTimes />
                </button>
              </div>
              <div className="pm-modal-body">
                <div className="pm-modal-section">
                  <label className="pm-modal-label">Select New Project Manager</label>
                  <select
                    className="pm-modal-select"
                    value={newPMId}
                    onChange={(e) => setNewPMId(e.target.value)}
                    disabled={reassigning}
                  >
                    <option value="">Choose a PM...</option>
                    {Array.from(users)
                      .filter((u: any) => u.role === 'Project Manager' && u.id !== currentTabData.info.id)
                      .map((pm: any) => (
                        <option key={pm.id} value={pm.id}>
                          {pm.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="pm-modal-section">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                    <label className="pm-modal-label" style={{ marginBottom: 0 }}>
                      Select Projects ({selectedProjects.size} selected)
                    </label>
                    <button
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#6366f1',
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: '0.25rem 0.5rem',
                      }}
                      onClick={() => {
                        const pmProjects = projects.filter((p: any) => p.pmId === currentTabData.info.id);
                        const filtered = projectSearch.trim()
                          ? pmProjects.filter((p: any) => 
                              p.clientName.toLowerCase().includes(projectSearch.toLowerCase())
                            )
                          : pmProjects;
                        const filteredIds = new Set(filtered.map((p: any) => p.id));
                        const allFilteredSelected = filtered.length > 0 && filtered.every((p: any) => selectedProjects.has(p.id));
                        if (allFilteredSelected) {
                          // Deselect all filtered projects
                          const newSet = new Set(selectedProjects);
                          filteredIds.forEach(id => newSet.delete(id));
                          setSelectedProjects(newSet);
                        } else {
                          // Select all filtered projects
                          const newSet = new Set(selectedProjects);
                          filteredIds.forEach(id => newSet.add(id));
                          setSelectedProjects(newSet);
                        }
                      }}
                      disabled={reassigning}
                    >
                      {(() => {
                        const pmProjects = projects.filter((p: any) => p.pmId === currentTabData.info.id);
                        const filtered = projectSearch.trim()
                          ? pmProjects.filter((p: any) => 
                              p.clientName.toLowerCase().includes(projectSearch.toLowerCase())
                            )
                          : pmProjects;
                        const allFilteredSelected = filtered.length > 0 && filtered.every((p: any) => selectedProjects.has(p.id));
                        return allFilteredSelected ? 'Deselect All' : 'Select All';
                      })()}
                    </button>
                  </div>
                  <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                    <FaSearch style={{
                      position: 'absolute',
                      left: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#cbd5e1',
                      fontSize: '0.75rem',
                      pointerEvents: 'none'
                    }} />
                    <input
                      type="text"
                      className="pm-modal-search"
                      placeholder="Search projects by name..."
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      disabled={reassigning}
                    />
                  </div>
                  <div className="pm-projects-list">
                    {(() => {
                      const pmProjects = projects.filter((p: any) => p.pmId === currentTabData.info.id);
                      const filtered = projectSearch.trim()
                        ? pmProjects.filter((p: any) => 
                            p.clientName.toLowerCase().includes(projectSearch.toLowerCase())
                          )
                        : pmProjects;
                      return filtered.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                          {projectSearch.trim() ? `No projects found matching "${projectSearch}"` : 'No projects found'}
                        </div>
                      ) : (
                        filtered.map((project: any) => (
                          <div
                            key={project.id}
                            className="pm-project-item"
                            onClick={() => {
                              if (reassigning) return;
                              const newSet = new Set(selectedProjects);
                              if (newSet.has(project.id)) {
                                newSet.delete(project.id);
                              } else {
                                newSet.add(project.id);
                              }
                              setSelectedProjects(newSet);
                            }}
                          >
                            {selectedProjects.has(project.id) ? (
                              <FaCheckSquare className="pm-project-checkbox" />
                            ) : (
                              <FaSquare className="pm-project-checkbox" style={{ color: '#cbd5e1' }} />
                            )}
                            <div style={{ flex: 1 }}>
                              <div className="pm-project-name">{project.clientName}</div>
                              <div className="pm-project-meta">
                                {project.package} · {project.stage}
                              </div>
                            </div>
                          </div>
                        ))
                      );
                    })()}
                  </div>
                </div>
              </div>
              <div className="pm-modal-footer">
                <button
                  className="pm-modal-btn pm-modal-btn-secondary"
                  onClick={() => setShowReassignModal(false)}
                  disabled={reassigning}
                >
                  Cancel
                </button>
                <button
                  className="pm-modal-btn pm-modal-btn-primary"
                  onClick={async () => {
                    if (!newPMId || selectedProjects.size === 0 || reassigning) return;
                    setReassigning(true);
                    try {
                      const projectIds = Array.from(selectedProjects);
                      const promises = projectIds.map((id) =>
                        projectService.update(id, { pmId: newPMId })
                      );
                      await Promise.all(promises);
                      // Store the new PM name before reloading
                      const newPMName = users.find((u: any) => u.id === newPMId)?.name || 'new PM';
                      
                      // Close modal first
                      setShowReassignModal(false);
                      setSelectedProjects(new Set());
                      setNewPMId('');
                      setProjectSearch('');
                      
                      // Reload data to get updated project assignments
                      await loadData();
                      
                      // Reset active tab to force recalculation - this will show the first PM tab
                      // The new PM should now have activities from the reassigned projects
                      setActiveTab('');
                      
                      // Show success message
                      alert(`Successfully reassigned ${projectIds.length} project(s) to ${newPMName}. The PM tabs have been updated.`);
                    } catch (error: any) {
                      console.error('Error reassigning projects:', error);
                      alert(`Error: ${error.response?.data?.message || error.message || 'Failed to reassign projects'}`);
                    } finally {
                      setReassigning(false);
                    }
                  }}
                  disabled={!newPMId || selectedProjects.size === 0 || reassigning}
                >
                  {reassigning ? 'Reassigning...' : `Reassign ${selectedProjects.size} Project(s)`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PMActivityLog;