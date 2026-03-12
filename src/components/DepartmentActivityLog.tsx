import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUsers, FaTimes, FaClock, FaUser, FaBell, FaCog, FaSignOutAlt, FaArrowLeft, FaSearch, FaComments } from 'react-icons/fa';
import { authService } from '../services/auth.service';
import { projectService } from '../services/project.service';
import { taskService } from '../services/task.service';
import { notificationService } from '../services/notification.service';
import NotificationsModal from './NotificationsModal';
import LiveChatPanel from './LiveChatPanel';
import { useUnreadChatCount } from '../hooks/useUnreadChatCount';
import './Dashboard.css';

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

  .dal-root * { box-sizing: border-box; }

  .dal-root {
    font-family: 'DM Sans', sans-serif;
    background: #f5f6fa;
    min-height: 100vh;
    color: #1e293b;
  }

  /* ── NAV ── */
  .dal-nav {
    position: sticky; top: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 2rem; height: 58px;
    background: #ffffff;
    border-bottom: 1px solid #e8ecf0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .dal-nav-back {
    display: flex; align-items: center; gap: 0.5rem;
    background: transparent; border: none; color: #94a3b8;
    cursor: pointer; font-family: 'DM Sans', sans-serif;
    font-size: 0.875rem; font-weight: 500;
    padding: 0.375rem 0.625rem; border-radius: 6px; transition: all 0.15s;
  }
  .dal-nav-back:hover { background: #f1f5f9; color: #475569; }
  .dal-nav-title {
    font-size: 0.8125rem; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8;
  }
  .dal-nav-right { display: flex; align-items: center; gap: 0.625rem; }
  .dal-icon-btn {
    position: relative; background: transparent; border: none; color: #94a3b8;
    cursor: pointer; width: 34px; height: 34px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; transition: all 0.15s;
  }
  .dal-icon-btn:hover { background: #f1f5f9; color: #475569; }
  .dal-badge {
    position: absolute; top: 2px; right: 2px;
    min-width: 16px; height: 16px; border-radius: 8px;
    font-size: 0.5625rem; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #fff;
  }

  /* ── AVATAR DROPDOWN ── */
  .dal-avatar {
    width: 30px; height: 30px; border-radius: 8px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.75rem; font-weight: 700; color: white;
    cursor: pointer; border: none; transition: opacity 0.15s;
  }
  .dal-avatar:hover { opacity: 0.85; }
  .dal-dropdown {
    position: absolute; top: calc(100% + 8px); right: 0; width: 210px;
    background: #fff; border: 1px solid #e8ecf0; border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.1); z-index: 9999; overflow: hidden;
    animation: fadeDown 0.15s ease;
  }
  @keyframes fadeDown {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .dal-dropdown-header {
    padding: 0.875rem 1rem; border-bottom: 1px solid #f1f5f9;
    display: flex; align-items: center; gap: 0.625rem;
  }
  .dal-dropdown-name { font-size: 0.875rem; font-weight: 600; color: #1e293b; }
  .dal-dropdown-email { font-size: 0.75rem; color: #94a3b8; margin-top: 1px; }
  .dal-dropdown-item {
    display: flex; align-items: center; gap: 0.625rem;
    width: 100%; background: transparent; border: none;
    padding: 0.5625rem 1rem; font-family: 'DM Sans', sans-serif;
    font-size: 0.8125rem; color: #475569; cursor: pointer;
    transition: all 0.12s; text-align: left;
  }
  .dal-dropdown-item:hover { background: #f8fafc; color: #1e293b; }
  .dal-dropdown-item.danger { color: #ef4444; }
  .dal-dropdown-item.danger:hover { background: #fef2f2; }
  .dal-divider { height: 1px; background: #f1f5f9; margin: 4px 0; }

  /* ── MAIN ── */
  .dal-main { max-width: 1280px; margin: 0 auto; padding: 2rem 2rem 3rem; }

  /* ── PAGE HEADER ── */
  .dal-page-header {
    display: flex; align-items: flex-end; justify-content: space-between;
    margin-bottom: 1.75rem; gap: 1rem; flex-wrap: wrap;
  }
  .dal-page-heading {
    font-size: 1.5rem; font-weight: 600; color: #0f172a;
    margin: 0 0 0.25rem; letter-spacing: -0.02em;
  }
  .dal-page-sub { font-size: 0.875rem; color: #94a3b8; margin: 0; }

  /* ── SEARCH ── */
  .dal-search-wrap { position: relative; }
  .dal-search-wrap svg {
    position: absolute; left: 0.75rem; top: 50%;
    transform: translateY(-50%); color: #cbd5e1; font-size: 0.75rem; pointer-events: none;
  }
  .dal-search {
    background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
    color: #1e293b; font-family: 'DM Sans', sans-serif; font-size: 0.875rem;
    padding: 0.5rem 0.875rem 0.5rem 2.125rem; width: 210px;
    transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  }
  .dal-search::placeholder { color: #cbd5e1; }
  .dal-search:focus { outline: none; border-color: #6366f1; width: 250px; box-shadow: 0 0 0 3px rgba(99,102,241,0.08); }

  /* ── STATS ── */
  .dal-stats {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 1px; background: #e8ecf0; border: 1px solid #e8ecf0;
    border-radius: 12px; overflow: hidden; margin-bottom: 2rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .dal-stat {
    background: #fff; padding: 1.125rem 1.375rem;
    display: flex; flex-direction: column; gap: 0.25rem;
  }
  .dal-stat-label {
    font-size: 0.6875rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.07em; color: #94a3b8;
  }
  .dal-stat-value {
    font-family: 'DM Mono', monospace; font-size: 1.5rem;
    font-weight: 500; color: #0f172a; line-height: 1;
  }
  .dal-stat-dot { width: 6px; height: 6px; border-radius: 50%; margin-bottom: 0.125rem; }

  /* ── TABS ── */
  .dal-tabs-row {
    display: flex; align-items: stretch;
    background: #fff; border: 1px solid #e2e8f0;
    border-radius: 12px 12px 0 0; overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .dal-tab {
    display: flex; align-items: center; gap: 0.5rem; flex: 1;
    background: transparent; border: none;
    padding: 0.875rem 1.25rem;
    font-family: 'DM Sans', sans-serif; font-size: 0.875rem; font-weight: 500;
    color: #94a3b8; cursor: pointer;
    border-right: 1px solid #f1f5f9;
    transition: all 0.15s; position: relative;
    justify-content: center; white-space: nowrap;
  }
  .dal-tab:last-child { border-right: none; }
  .dal-tab:hover { background: #f8fafc; color: #475569; }
  .dal-tab.active { color: #1e293b; font-weight: 600; background: #fff; }
  .dal-tab.active::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0;
    height: 2.5px; border-radius: 2px 2px 0 0;
    background: var(--tab-color, #6366f1);
  }
  .dal-tab-count {
    font-family: 'DM Mono', monospace; font-size: 0.6875rem;
    padding: 0.125rem 0.4375rem; border-radius: 20px;
    background: #f1f5f9; color: #94a3b8; font-weight: 500; transition: all 0.15s;
  }
  .dal-tab.active .dal-tab-count {
    background: var(--tab-bg, #eef2ff);
    color: var(--tab-color, #6366f1);
  }
  .dal-tab-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

  /* ── TAB PANEL ── */
  .dal-tab-panel {
    background: #fff; border: 1px solid #e2e8f0; border-top: none;
    border-radius: 0 0 12px 12px; overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04); min-height: 300px;
    animation: fadeTab 0.18s ease;
  }
  @keyframes fadeTab {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── TASK ROWS ── */
  .dal-tasks-scroll { max-height: 560px; overflow-y: auto; }
  .dal-tasks-scroll::-webkit-scrollbar { width: 4px; }
  .dal-tasks-scroll::-webkit-scrollbar-track { background: transparent; }
  .dal-tasks-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }

  .dal-task {
    padding: 1rem 1.5rem; border-bottom: 1px solid #f8fafc;
    display: grid; grid-template-columns: 1fr auto;
    gap: 1.25rem; align-items: center; transition: background 0.1s;
  }
  .dal-task:last-child { border-bottom: none; }
  .dal-task:hover { background: #fafbfc; }

  .dal-task-title {
    font-size: 0.9375rem; font-weight: 500; color: #1e293b;
    margin-bottom: 0.375rem; line-height: 1.35;
  }
  .dal-task-meta { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .dal-task-project { font-size: 0.8125rem; color: #94a3b8; }
  .dal-task-sep { color: #e2e8f0; font-size: 0.75rem; }

  .dal-chip {
    display: inline-flex; align-items: center;
    padding: 0.1875rem 0.5rem; border-radius: 4px;
    font-size: 0.6875rem; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
  }

  .dal-task-right {
    display: flex; flex-direction: column;
    align-items: flex-end; gap: 0.5rem; flex-shrink: 0;
  }
  .dal-task-time {
    font-family: 'DM Mono', monospace; font-size: 0.6875rem;
    color: #cbd5e1; white-space: nowrap;
  }
  .dal-user-btn {
    background: transparent; border: none; cursor: pointer;
    display: flex; align-items: center; gap: 0.375rem;
    padding: 0.25rem 0.5rem; border-radius: 20px; transition: background 0.12s;
  }
  .dal-user-btn:hover { background: #f1f5f9; }
  .dal-user-mini {
    width: 20px; height: 20px; border-radius: 5px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.5625rem; font-weight: 700; color: white; flex-shrink: 0;
  }
  .dal-user-name { font-size: 0.8125rem; font-weight: 500; color: #6366f1; }

  /* ── EMPTY ── */
  .dal-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 4rem 2rem; text-align: center; color: #cbd5e1;
  }
  .dal-empty-icon { font-size: 2.25rem; margin-bottom: 1rem; opacity: 0.4; }
  .dal-empty-head { font-size: 1rem; font-weight: 600; color: #94a3b8; margin-bottom: 0.375rem; }
  .dal-empty-sub { font-size: 0.875rem; }

  /* ── USER PANEL ── */
  .dal-overlay {
    position: fixed; inset: 0; background: rgba(15,23,42,0.4); z-index: 10001;
    display: flex; align-items: stretch; justify-content: flex-end;
    animation: fadein 0.2s ease;
  }
  @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
  .dal-panel {
    background: #fff; width: 100%; max-width: 540px; height: 100%;
    display: flex; flex-direction: column;
    border-left: 1px solid #e8ecf0; box-shadow: -8px 0 40px rgba(0,0,0,0.08);
    animation: slideIn 0.25s cubic-bezier(0.22,1,0.36,1);
  }
  @keyframes slideIn {
    from { transform: translateX(60px); opacity: 0; }
    to   { transform: translateX(0); opacity: 1; }
  }
  .dal-panel-header {
    padding: 1.375rem 1.75rem; border-bottom: 1px solid #f1f5f9;
    display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-shrink: 0;
  }
  .dal-panel-title { font-size: 1.0625rem; font-weight: 600; color: #0f172a; margin: 0 0 0.25rem; }
  .dal-panel-sub { font-size: 0.8125rem; color: #94a3b8; margin: 0; }
  .dal-panel-close {
    background: #f8fafc; border: 1px solid #e8ecf0; color: #94a3b8; cursor: pointer;
    width: 30px; height: 30px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s;
  }
  .dal-panel-close:hover { background: #f1f5f9; color: #475569; }
  .dal-panel-body { flex: 1; overflow-y: auto; padding: 1.375rem 1.75rem; }
  .dal-panel-body::-webkit-scrollbar { width: 4px; }
  .dal-panel-body::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }
  .dal-panel-card {
    background: #fafbfc; border: 1px solid #f1f5f9; border-radius: 10px;
    padding: 1.0625rem; margin-bottom: 0.625rem; transition: border-color 0.15s, box-shadow 0.15s;
  }
  .dal-panel-card:hover { border-color: #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
  .dal-panel-card-title { font-size: 0.9375rem; font-weight: 600; color: #1e293b; margin-bottom: 0.3125rem; }
  .dal-panel-card-project { font-size: 0.8125rem; color: #94a3b8; margin-bottom: 0.625rem; }
  .dal-panel-card-chips { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .dal-panel-card-footer {
    display: flex; align-items: center; gap: 0.375rem;
    margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #f1f5f9;
    font-family: 'DM Mono', monospace; font-size: 0.6875rem; color: #cbd5e1;
  }

  /* ── LOADING ── */
  .dal-loading {
    display: flex; align-items: center; justify-content: center;
    height: 100vh; background: #f5f6fa;
    font-family: 'DM Sans', sans-serif; font-size: 0.875rem; color: #94a3b8; gap: 0.625rem;
  }
  .dal-spinner {
    width: 16px; height: 16px; border: 2px solid #e2e8f0;
    border-top-color: #6366f1; border-radius: 50%; animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .dal-no-results {
    padding: 2.5rem 1.5rem; text-align: center; font-size: 0.875rem; color: #94a3b8;
  }
`;

const DEPT_CONFIG: Record<string, { color: string; bg: string }> = {
  'Onboarding':      { color: '#7c3aed', bg: '#f5f3ff' },
  'Copy Writing':    { color: '#6366f1', bg: '#eef2ff' },
  'Design':          { color: '#d97706', bg: '#fffbeb' },
  'Development':     { color: '#059669', bg: '#ecfdf5' },
  'AI Team':         { color: '#ec4899', bg: '#fdf2f8' },
  'Social Media Team': { color: '#06b6d4', bg: '#ecfeff' },
  'CRM':             { color: '#8b5cf6', bg: '#f5f3ff' },
  'SEO/GEO Team':    { color: '#14b8a6', bg: '#f0fdfa' },
};

const statusStyle = (s: string) => {
  if (s === 'Completed')   return { background: '#ecfdf5', color: '#059669' };
  if (s === 'In Progress') return { background: '#eff6ff', color: '#2563eb' };
  return                          { background: '#f8fafc',  color: '#64748b' };
};

const fmt = (d: Date) =>
  `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

/* ══════════════════════════════════════════════════════════════════════════ */

const DepartmentActivityLog: React.FC = () => {
  const navigate = useNavigate();
  const user     = authService.getUser();
  const [projects,  setProjects]  = useState<any[]>([]);
  const [tasks,     setTasks]     = useState<any[]>([]);
  const [users,     setUsers]     = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [showAvatar, setShowAvatar] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showLiveChat, setShowLiveChat] = useState(false);
  const [unread,     setUnread]     = useState(0);
  const [unreadChatCount, refreshUnreadChat] = useUnreadChatCount();
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  const skipRef = useRef<number | null>(null);

  useEffect(() => {
    loadAll();
    loadUnread();
    const iv = setInterval(() => {
      if (skipRef.current && Date.now() < skipRef.current) return;
      loadUnread();
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  const loadAll = async () => {
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
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadUnread = async () => {
    try {
      if (skipRef.current && Date.now() < skipRef.current) return;
      setUnread(await notificationService.getUnreadCount());
    } catch {}
  };

  const DEPT_MAP: Record<string, string[]> = {
    'Onboarding':      ['Onboarding'],
    'Copy Writing':    ['Copy'],
    'Design':          ['Design'],
    'Development':     ['Dev'],
    'AI Team':         ['AI'],
    'Social Media Team': ['Social Media'],
    'CRM':             ['CRM'],
    'SEO/GEO Team':    ['SEO/GEO'],
  };

  const buildDepts = () => {
    const out: Record<string, any[]> = {};
    tasks.forEach((task: any) => {
      // Find the department for this task type
      let dept: string | null = null;
      for (const [d, types] of Object.entries(DEPT_MAP)) {
        if (types.includes(task.type)) { dept = d; break; }
      }
      // Skip tasks that don't match any known department (shouldn't happen, but safety check)
      if (!dept) return;
      
      if (!out[dept]) out[dept] = [];
      const proj     = projects.find((p: any) => p.id === task.projectId);
      const assigned = task.assignedTo || users.find((u: any) => u.id === task.assignedToId);
      out[dept].push({
        taskId:      task.id,
        taskTitle:   task.title || 'Untitled Task',
        projectName: proj?.clientName || 'Unknown',
        projectId:   task.projectId,
        userName:    assigned?.name || 'Unassigned',
        userId:      assigned?.id   || '',
        updatedAt:   new Date(task.updatedAt),
        status:      task.status    || 'Not Started',
        type:        task.type,
      });
    });
    Object.keys(out).forEach(d =>
      out[d].sort((a, b) => b.updatedAt - a.updatedAt)
    );
    return out;
  };

  const deptMap = buildDepts();
  const DEPT_ORDER = ['Onboarding', 'Copy Writing', 'Design', 'Development', 'AI Team', 'Social Media Team', 'CRM', 'SEO/GEO Team'];
  const depts = DEPT_ORDER.filter(d => deptMap[d]?.length)
    .concat(Object.keys(deptMap).filter(d => !DEPT_ORDER.includes(d)));

  const currentTab = activeTab || depts[0] || '';

  const filteredRows = (dept: string) => {
    if (!search.trim()) return deptMap[dept] || [];
    const q = search.toLowerCase();
    return (deptMap[dept] || []).filter(t =>
      t.taskTitle.toLowerCase().includes(q) ||
      t.projectName.toLowerCase().includes(q) ||
      t.userName.toLowerCase().includes(q)
    );
  };

  const totalTasks      = tasks.length;
  const completedTasks  = tasks.filter((t: any) => t.status === 'Completed').length;
  const inProgressTasks = tasks.filter((t: any) => t.status === 'In Progress').length;

  if (loading) return (
    <>
      <style>{css}</style>
      <div className="dal-loading">
        <div className="dal-spinner" />
        Loading activity…
      </div>
    </>
  );

  const tabRows = filteredRows(currentTab);

  return (
    <>
      <style>{css}</style>
      <div className="dal-root">

        {/* ── NAV ── */}
        <nav className="dal-nav">
          <button className="dal-nav-back" onClick={() => navigate('/dashboard')}>
            <FaArrowLeft /> Back
          </button>
          <span className="dal-nav-title">Activity Log</span>
          <div className="dal-nav-right">
            <button className="dal-icon-btn" onClick={() => setShowLiveChat(true)} title="Live Chat">
              <FaComments />
              {unreadChatCount > 0 && (
                <span className="dal-badge" style={{
                  background: unreadChatCount >= 10 ? '#ef4444' : unreadChatCount >= 5 ? '#f59e0b' : '#10b981'
                }}>
                  {unreadChatCount > 99 ? '99+' : unreadChatCount}
                </span>
              )}
            </button>
            <button className="dal-icon-btn" onClick={() => setShowNotifs(true)}>
              <FaBell />
              {unread > 0 && (
                <span className="dal-badge" style={{
                  background: unread >= 10 ? '#ef4444' : unread >= 5 ? '#f59e0b' : '#10b981'
                }}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
            <div style={{ position: 'relative' }}>
              <button className="dal-avatar" onClick={() => setShowAvatar(v => !v)}>
                {user?.name?.charAt(0).toUpperCase()}
              </button>
              {showAvatar && (
                <div className="dal-dropdown" onClick={e => e.stopPropagation()}>
                  <div className="dal-dropdown-header">
                    <div className="dal-avatar" style={{ cursor: 'default' }}>{user?.name?.charAt(0).toUpperCase()}</div>
                    <div>
                      <div className="dal-dropdown-name">{user?.name}</div>
                      <div className="dal-dropdown-email">{user?.email}</div>
                    </div>
                  </div>
                  <div className="dal-divider" />
                  {[
                    { label: 'Clients',       icon: <FaUsers />, path: '/clients' },
                    { label: 'Users',         icon: <FaUsers />, path: '/users' },
                    { label: 'Profile',       icon: <FaUser />,  path: '/profile' },
                    { label: 'Notifications', icon: <FaBell />,  action: () => { setShowAvatar(false); setShowNotifs(true); } },
                    { label: 'Settings',      icon: <FaCog />,   path: '/settings' },
                  ].map(it => (
                    <button key={it.label} className="dal-dropdown-item"
                      onClick={() => { setShowAvatar(false); it.action ? it.action() : navigate(it.path!); }}>
                      {it.icon} {it.label}
                    </button>
                  ))}
                  <div className="dal-divider" />
                  <button className="dal-dropdown-item danger"
                    onClick={() => { authService.logout(); navigate('/'); }}>
                    <FaSignOutAlt /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* ── MAIN ── */}
        <div className="dal-main">

          {/* Page header */}
          <div className="dal-page-header">
            <div>
              <h1 className="dal-page-heading">Department Activity</h1>
              <p className="dal-page-sub">All task activity across departments, sorted by recency</p>
            </div>
            <div className="dal-search-wrap">
              <FaSearch />
              <input
                className="dal-search"
                placeholder="Search tasks, projects…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Stat strip */}
          <div className="dal-stats">
            {[
              { label: 'Total Tasks', value: totalTasks,      dot: '#6366f1' },
              { label: 'In Progress', value: inProgressTasks, dot: '#2563eb' },
              { label: 'Completed',   value: completedTasks,  dot: '#059669' },
              { label: 'Departments', value: depts.length,    dot: '#d97706' },
            ].map(s => (
              <div className="dal-stat" key={s.label}>
                <div className="dal-stat-dot" style={{ background: s.dot }} />
                <div className="dal-stat-value">{s.value}</div>
                <div className="dal-stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Empty */}
          {depts.length === 0 ? (
            <div className="dal-empty" style={{
              background: '#fff', border: '1px solid #e2e8f0',
              borderRadius: 12, padding: '5rem 2rem'
            }}>
              <div className="dal-empty-icon"><FaUsers /></div>
              <div className="dal-empty-head">No activity yet</div>
              <div className="dal-empty-sub">Tasks will appear here as they're updated</div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="dal-tabs-row">
                {depts.map(dept => {
                  const cfg    = DEPT_CONFIG[dept] || { color: '#64748b', bg: '#f8fafc' };
                  const count  = filteredRows(dept).length;
                  const active = dept === currentTab;
                  return (
                    <button
                      key={dept}
                      className={`dal-tab${active ? ' active' : ''}`}
                      style={{ '--tab-color': cfg.color, '--tab-bg': cfg.bg } as React.CSSProperties}
                      onClick={() => setActiveTab(dept)}
                    >
                      <span className="dal-tab-dot" style={{ background: cfg.color }} />
                      {dept}
                      <span className="dal-tab-count">{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="dal-tab-panel" key={currentTab}>
                {tabRows.length === 0 ? (
                  <div className="dal-no-results">
                    {search
                      ? `No results for "${search}" in ${currentTab}`
                      : `No tasks in ${currentTab}`}
                  </div>
                ) : (
                  <div className="dal-tasks-scroll">
                    {tabRows.map(t => (
                      <div className="dal-task" key={t.taskId}>
                        <div>
                          <div className="dal-task-title">{t.taskTitle}</div>
                          <div className="dal-task-meta">
                            <span className="dal-task-project">{t.projectName}</span>
                            <span className="dal-task-sep">·</span>
                            <span className="dal-chip" style={statusStyle(t.status)}>{t.status}</span>
                          </div>
                        </div>
                        <div className="dal-task-right">
                          {t.userId ? (
                            <button className="dal-user-btn"
                              onClick={() => setSelectedUser({ id: t.userId, name: t.userName })}>
                              <div className="dal-user-mini">{t.userName.charAt(0).toUpperCase()}</div>
                              <span className="dal-user-name">{t.userName}</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.8125rem', color: '#cbd5e1' }}>Unassigned</span>
                          )}
                          <span className="dal-task-time">{fmt(t.updatedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── USER PANEL ── */}
        {selectedUser && (
          <div className="dal-overlay" onClick={() => setSelectedUser(null)}>
            <div className="dal-panel" onClick={e => e.stopPropagation()}>
              <div className="dal-panel-header">
                <div>
                  <h2 className="dal-panel-title">{selectedUser.name}</h2>
                  <p className="dal-panel-sub">All assigned tasks · sorted by recency</p>
                </div>
                <button className="dal-panel-close" onClick={() => setSelectedUser(null)}>
                  <FaTimes />
                </button>
              </div>
              <div className="dal-panel-body">
                {(() => {
                  const userTasks = tasks
                    .filter((t: any) => t.assignedToId === selectedUser.id)
                    .map((t: any) => ({
                      ...t,
                      projectName: projects.find((p: any) => p.id === t.projectId)?.clientName || 'Unknown',
                      updatedAt:   new Date(t.updatedAt || t.createdAt),
                    }))
                    .sort((a: any, b: any) => b.updatedAt - a.updatedAt);

                  if (!userTasks.length) return (
                    <div className="dal-empty">
                      <div className="dal-empty-icon"><FaUser /></div>
                      <div className="dal-empty-head">No tasks assigned</div>
                      <div className="dal-empty-sub">This user has no task assignments</div>
                    </div>
                  );

                  return userTasks.map((t: any) => {
                    const deptEntry = Object.entries(DEPT_MAP).find(([, types]) => types.includes(t.type));
                    const deptName  = deptEntry ? deptEntry[0] : null;
                    const cfg       = deptName ? DEPT_CONFIG[deptName] : { color: '#64748b', bg: '#f8fafc' };
                    return (
                      <div className="dal-panel-card" key={t.id}>
                        <div className="dal-panel-card-title">{t.title || 'Untitled'}</div>
                        <div className="dal-panel-card-project">{t.projectName}</div>
                        <div className="dal-panel-card-chips">
                          <span className="dal-chip" style={{ background: cfg.bg, color: cfg.color }}>{t.type}</span>
                          <span className="dal-chip" style={statusStyle(t.status)}>{t.status || 'Not Started'}</span>
                        </div>
                        <div className="dal-panel-card-footer">
                          <FaClock style={{ fontSize: '0.625rem' }} />
                          {fmt(t.updatedAt)}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ── LIVE CHAT ── */}
        <LiveChatPanel
          isOpen={showLiveChat}
          onClose={() => {
            setShowLiveChat(false);
            refreshUnreadChat();
          }}
          accentColor="#667eea"
        />
        {/* ── NOTIFS ── */}
        <NotificationsModal
          isOpen={showNotifs}
          onClose={() => { setShowNotifs(false); loadUnread(); }}
          onUpdate={loadUnread}
        />
      </div>
    </>
  );
};

export default DepartmentActivityLog;