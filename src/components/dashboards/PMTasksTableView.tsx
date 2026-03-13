import React, { useState, useMemo } from 'react';
import { FaTasks, FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import { projectService } from '../../services/project.service';
import TaskDetailSideModal from '../TaskDetailSideModal';

export const TASK_TYPE_TO_DEPARTMENT: Record<string, string> = {
  Copy: 'Copy Writing',
  Design: 'Design',
  Dev: 'Development',
  AI: 'AI Development',
  'Social Media': 'Social Media',
  CRM: 'CRM',
  SEO: 'SEO/GEO',
  Onboarding: 'Onboarding',
};

const DEPT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Copy Writing':   { bg: '#fefce8', text: '#92400e', border: '#fde68a' },
  'Design':         { bg: '#f5f3ff', text: '#5b21b6', border: '#ddd6fe' },
  'Development':    { bg: '#f0fdf4', text: '#14532d', border: '#bbf7d0' },
  'AI Development': { bg: '#eff6ff', text: '#1e3a5f', border: '#bfdbfe' },
  'Social Media':   { bg: '#fff1f2', text: '#881337', border: '#fecdd3' },
  'CRM':            { bg: '#fff7ed', text: '#7c2d12', border: '#fed7aa' },
  'SEO/GEO':        { bg: '#f0fdfa', text: '#134e4a', border: '#99f6e4' },
  'Onboarding':     { bg: '#f7fee7', text: '#365314', border: '#d9f99d' },
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');

  .pmt-wrap {
    --bg: #ffffff;
    --surface: #f8f9fb;
    --surface-hover: #f1f4f8;
    --border: #e8ecf0;
    --border-strong: #d0d7de;
    --text-primary: #0f1923;
    --text-secondary: #4a5568;
    --text-muted: #94a3b8;
    --accent: #2563eb;
    --accent-light: #eff6ff;
    font-family: 'Instrument Sans', sans-serif;
    background: var(--bg);
    border-radius: 12px;
    border: 1px solid var(--border);
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06);
    overflow: hidden;
  }

  .pmt-head {
    display: grid;
    grid-template-columns: 168px 1fr 2fr 168px 168px 116px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .pmt-head-cell {
    padding: 0 18px;
    height: 48px;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--text-muted);
    border-right: 1px solid var(--border);
    box-sizing: border-box;
  }
  .pmt-head-cell:last-child { border-right: none; }

  .pmt-head-btn {
    all: unset;
    padding: 0 18px;
    height: 48px;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--text-muted);
    border-right: 1px solid var(--border);
    box-sizing: border-box;
    cursor: pointer;
    transition: color 0.13s, background 0.13s;
    white-space: nowrap;
  }
  .pmt-head-btn:hover { color: var(--text-secondary); background: rgba(0,0,0,0.02); }
  .pmt-head-btn.sorted { color: var(--accent); background: var(--accent-light); }
  .pmt-head-btn:last-child { border-right: none; }

  .pmt-filter-cell {
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 1px;
    padding: 8px 18px;
  }

  .pmt-filter-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--text-muted);
    line-height: 1;
  }

  .pmt-filter-select {
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-secondary);
    font-size: 12.5px;
    font-family: 'Instrument Sans', sans-serif;
    font-weight: 500;
    cursor: pointer;
    max-width: 132px;
    appearance: none;
    -webkit-appearance: none;
    padding: 0;
  }
  .pmt-filter-select.active { color: var(--accent); font-weight: 600; }
  .pmt-filter-select option { background: #fff; color: #0f1923; }

  .pmt-row {
    display: grid;
    grid-template-columns: 168px 1fr 2fr 168px 168px 116px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    transition: background 0.1s;
    animation: rowIn 0.2s ease both;
  }
  .pmt-row:last-child { border-bottom: none; }
  .pmt-row:hover { background: var(--surface-hover); }

  @keyframes rowIn {
    from { opacity: 0; transform: translateY(3px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .pmt-cell {
    padding: 13px 18px;
    display: flex;
    align-items: center;
    font-size: 13px;
    color: var(--text-secondary);
    border-right: 1px solid var(--border);
    min-width: 0;
    overflow: hidden;
    box-sizing: border-box;
  }
  .pmt-cell:last-child { border-right: none; }

  .pmt-dept-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px 3px 7px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.03em;
    white-space: nowrap;
    border: 1px solid transparent;
  }
  .pmt-dept-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .pmt-project-name {
    font-weight: 600;
    font-size: 13px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.12s;
  }
  .pmt-row:hover .pmt-project-name { color: var(--accent); }

  .pmt-task-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-secondary);
    font-size: 13px;
  }

  .pmt-assignee-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .pmt-avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .pmt-avatar-assigned { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; }
  .pmt-avatar-unassigned {
    background: var(--surface);
    color: var(--text-muted);
    border: 1.5px dashed var(--border-strong);
  }
  .pmt-assignee-name {
    font-size: 12.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pmt-assignee-unassigned { color: var(--text-muted); font-style: italic; }

  .pmt-timestamp {
    font-family: 'DM Mono', monospace;
    font-size: 11.5px;
    color: var(--text-muted);
  }

  .pmt-pm-select {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 7px;
    color: var(--text-secondary);
    font-family: 'Instrument Sans', sans-serif;
    font-size: 12.5px;
    padding: 4px 8px;
    cursor: pointer;
    width: 100%;
    appearance: none;
    -webkit-appearance: none;
    transition: border-color 0.13s, background 0.13s;
  }
  .pmt-pm-select:hover { border-color: var(--border-strong); background: var(--surface); }
  .pmt-pm-select:focus { outline: none; border-color: var(--accent); }
  .pmt-pm-select:disabled { opacity: 0.5; cursor: wait; }
  .pmt-pm-select option { background: #fff; color: #0f1923; }

  .pmt-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 72px 24px;
    color: var(--text-muted);
    gap: 10px;
    font-size: 13.5px;
  }
`;

interface PMTasksTableViewProps {
  tasks: any[];
  filteredProjects: any[];
  projects: any[];
  users: any[];
  searchTerm: string;
  setProjects: React.Dispatch<React.SetStateAction<any[]>>;
  setTasks: React.Dispatch<React.SetStateAction<any[]>>;
  tasksRef: React.MutableRefObject<any[]>;
  getProjectName: (projectId: string) => string;
  getProjectPmName: (projectId: string) => string;
  tasksTableSort: { column: string; dir: 'asc' | 'desc' };
  setTasksTableSort: React.Dispatch<React.SetStateAction<{ column: string; dir: 'asc' | 'desc' }>>;
  tasksDepartmentFilter: string;
  setTasksDepartmentFilter: React.Dispatch<React.SetStateAction<string>>;
  tasksPmFilter: string;
  setTasksPmFilter: React.Dispatch<React.SetStateAction<string>>;
  tasksAssigneeFilter: string;
  setTasksAssigneeFilter: React.Dispatch<React.SetStateAction<string>>;
}

const PMTasksTableView: React.FC<PMTasksTableViewProps> = ({
  tasks, filteredProjects, projects, users, searchTerm,
  setProjects, setTasks, tasksRef,
  getProjectName, getProjectPmName,
  tasksTableSort, setTasksTableSort,
  tasksDepartmentFilter, setTasksDepartmentFilter,
  tasksPmFilter, setTasksPmFilter,
  tasksAssigneeFilter, setTasksAssigneeFilter,
}) => {
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<any | null>(null);
  const [reassigningPMFor, setReassigningPMFor] = useState<string | null>(null);

  const getUserName = (userId: string) => users.find((u: any) => u.id === userId)?.name || 'Unassigned';
  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const sortIcon = (col: string) => {
    if (tasksTableSort.column !== col) return <FaSort style={{ opacity: 0.3, fontSize: 9 }} />;
    return tasksTableSort.dir === 'asc' ? <FaSortUp style={{ fontSize: 9 }} /> : <FaSortDown style={{ fontSize: 9 }} />;
  };

  const toggleSort = (col: string) =>
    setTasksTableSort((s) => ({ column: col, dir: s.column === col && s.dir === 'asc' ? 'desc' : 'asc' }));

  const tasksForTable = useMemo(() => {
    const filteredProjectIds = new Set(filteredProjects.map((p: any) => p.id));
    let list = tasks.filter((t: any) => filteredProjectIds.has(t.projectId));
    if (tasksDepartmentFilter !== 'All Departments')
      list = list.filter((t: any) => (TASK_TYPE_TO_DEPARTMENT[t.type] || t.type) === tasksDepartmentFilter);
    if (tasksPmFilter !== 'All') {
      const pmProjects = new Set(projects.filter((p: any) => (p.pmId || (p.pm as any)?.id) === tasksPmFilter).map((p: any) => p.id));
      list = list.filter((t: any) => pmProjects.has(t.projectId));
    }
    if (tasksAssigneeFilter !== 'All') {
      list = tasksAssigneeFilter === '__unassigned__'
        ? list.filter((t: any) => !t.assignedToId)
        : list.filter((t: any) => t.assignedToId === tasksAssigneeFilter);
    }
    const searchLower = searchTerm.trim().toLowerCase();
    if (searchLower) {
      const projectIds = new Set(projects.filter((p: any) => p.clientName?.toLowerCase().includes(searchLower)).map((p: any) => p.id));
      list = list.filter((t: any) =>
        t.title?.toLowerCase().includes(searchLower) ||
        projectIds.has(t.projectId) ||
        (TASK_TYPE_TO_DEPARTMENT[t.type] || t.type).toLowerCase().includes(searchLower)
      );
    }
    const { column, dir } = tasksTableSort;
    const mult = dir === 'asc' ? 1 : -1;
    const projectMap = new Map(projects.map((p: any) => [p.id, p]));
    const pmNameMap = new Map<string, string>();
    const userNameMap = new Map<string, string>();
    for (const p of projects) {
      const pmId = p.pmId || (p.pm as any)?.id;
      if (pmId) { const u = users.find((us: any) => us.id === pmId); if (u?.name) pmNameMap.set(p.id, u.name); }
    }
    for (const u of users) { if (u?.name) userNameMap.set(u.id, u.name); }
    return [...list].sort((a: any, b: any) => {
      let av: string | number, bv: string | number;
      switch (column) {
        case 'department': av = (TASK_TYPE_TO_DEPARTMENT[a.type] || a.type || '').toLowerCase(); bv = (TASK_TYPE_TO_DEPARTMENT[b.type] || b.type || '').toLowerCase(); break;
        case 'project': av = (projectMap.get(a.projectId)?.clientName || '').toLowerCase(); bv = (projectMap.get(b.projectId)?.clientName || '').toLowerCase(); break;
        case 'title': av = (a.title || '').toLowerCase(); bv = (b.title || '').toLowerCase(); break;
        case 'pm': av = (pmNameMap.get(a.projectId) || '').toLowerCase(); bv = (pmNameMap.get(b.projectId) || '').toLowerCase(); break;
        case 'assignee': av = (userNameMap.get(a.assignedToId) || 'zzz').toLowerCase(); bv = (userNameMap.get(b.assignedToId) || 'zzz').toLowerCase(); break;
        default: av = new Date(a.updatedAt || a.createdAt || 0).getTime(); bv = new Date(b.updatedAt || b.createdAt || 0).getTime();
      }
      return mult * (typeof av === 'string' ? av.localeCompare(bv as string) : (av - (bv as number)));
    });
  }, [tasks, filteredProjects, projects, users, searchTerm, tasksTableSort, tasksDepartmentFilter, tasksPmFilter, tasksAssigneeFilter]);

  return (
    <>
      <style>{STYLES}</style>

      <div className="pmt-wrap">
        {/* ── Header ── */}
        <div className="pmt-head">
          <div className="pmt-head-cell pmt-filter-cell">
            <span className="pmt-filter-label">Department</span>
            <select
              className={`pmt-filter-select${tasksDepartmentFilter !== 'All Departments' ? ' active' : ''}`}
              value={tasksDepartmentFilter}
              onChange={(e) => setTasksDepartmentFilter(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="All Departments">All</option>
              {Object.values(TASK_TYPE_TO_DEPARTMENT).filter((v, i, a) => a.indexOf(v) === i).sort().map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <button type="button" className={`pmt-head-btn${tasksTableSort.column === 'project' ? ' sorted' : ''}`} onClick={() => toggleSort('project')}>
            Project / Client {sortIcon('project')}
          </button>

          <button type="button" className={`pmt-head-btn${tasksTableSort.column === 'title' ? ' sorted' : ''}`} onClick={() => toggleSort('title')}>
            Task Name {sortIcon('title')}
          </button>

          <div className="pmt-head-cell pmt-filter-cell">
            <span className="pmt-filter-label">PM Assigned</span>
            <select
              className={`pmt-filter-select${tasksPmFilter !== 'All' ? ' active' : ''}`}
              value={tasksPmFilter}
              onChange={(e) => setTasksPmFilter(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="All">All</option>
              {users.filter((u: any) => u.role === 'Project Manager').sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')).map((pm: any) => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
          </div>

          <div className="pmt-head-cell pmt-filter-cell">
            <span className="pmt-filter-label">Assigned To</span>
            <select
              className={`pmt-filter-select${tasksAssigneeFilter !== 'All' ? ' active' : ''}`}
              value={tasksAssigneeFilter}
              onChange={(e) => setTasksAssigneeFilter(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="All">All</option>
              <option value="__unassigned__">Unassigned</option>
              {users.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')).map((u: any) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <button type="button" className={`pmt-head-btn${tasksTableSort.column === 'updated' ? ' sorted' : ''}`} onClick={() => toggleSort('updated')}>
            Updated {sortIcon('updated')}
          </button>
        </div>

        {/* ── Body ── */}
        <div className="pmt-body">
          {tasksForTable.length === 0 ? (
            <div className="pmt-empty">
              <FaTasks style={{ fontSize: '2rem', opacity: 0.2 }} />
              <p style={{ margin: 0 }}>No tasks found.</p>
            </div>
          ) : (
            tasksForTable.map((task: any, i: number) => {
              const dept = TASK_TYPE_TO_DEPARTMENT[task.type] || task.type || '—';
              const ds = DEPT_COLORS[dept] || { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
              const project = projects.find((p: any) => p.id === task.projectId);
              const assigneeName = task.assignedToId ? getUserName(task.assignedToId) : null;

              return (
                <div
                  key={task.id}
                  className="pmt-row"
                  style={{ animationDelay: `${Math.min(i * 0.02, 0.3)}s` }}
                  onClick={() => { setSelectedTaskDetail(task); setShowTaskDetailModal(true); }}
                >
                  {/* Department */}
                  <div className="pmt-cell">
                    <span className="pmt-dept-badge" style={{ background: ds.bg, color: ds.text, borderColor: ds.border }}>
                      <span className="pmt-dept-dot" style={{ background: ds.text }} />
                      {dept}
                    </span>
                  </div>

                  {/* Project */}
                  <div className="pmt-cell">
                    <span className="pmt-project-name">{getProjectName(task.projectId)}</span>
                  </div>

                  {/* Task title */}
                  <div className="pmt-cell">
                    <span className="pmt-task-title">{task.title || 'Untitled'}</span>
                  </div>

                  {/* PM (inline reassign) */}
                  <div className="pmt-cell" onClick={(e) => e.stopPropagation()}>
                    {project ? (
                      <select
                        className="pmt-pm-select"
                        value={project.pmId || (project.pm as any)?.id || ''}
                        disabled={reassigningPMFor === project.id}
                        onChange={async (e) => {
                          const newPmId = e.target.value;
                          if (!newPmId || newPmId === (project.pmId || (project.pm as any)?.id)) return;
                          setReassigningPMFor(project.id);
                          try {
                            await projectService.update(project.id, { pmId: newPmId });
                            const newPM = users.find((u: any) => u.id === newPmId);
                            setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, pmId: newPmId, pm: newPM || p.pm } : p));
                          } catch (err: any) {
                            alert((err as any)?.response?.data?.message || (err as Error)?.message || 'Failed to reassign PM');
                          } finally {
                            setReassigningPMFor(null);
                          }
                        }}
                      >
                        <option value="">Unassigned</option>
                        {users.filter((u: any) => u.role === 'Project Manager').map((pm: any) => (
                          <option key={pm.id} value={pm.id}>{pm.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{getProjectPmName(task.projectId) || '—'}</span>
                    )}
                  </div>

                  {/* Assignee */}
                  <div className="pmt-cell">
                    <div className="pmt-assignee-wrap">
                      <div className={`pmt-avatar ${assigneeName ? 'pmt-avatar-assigned' : 'pmt-avatar-unassigned'}`}>
                        {assigneeName ? getInitials(assigneeName) : '?'}
                      </div>
                      <span className={`pmt-assignee-name${!assigneeName ? ' pmt-assignee-unassigned' : ''}`}>
                        {assigneeName || 'Unassigned'}
                      </span>
                    </div>
                  </div>

                  {/* Updated */}
                  <div className="pmt-cell">
                    <span className="pmt-timestamp">{getTimeAgo(task.updatedAt || task.createdAt || '')}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <TaskDetailSideModal
        isOpen={showTaskDetailModal}
        task={selectedTaskDetail}
        onClose={() => { setShowTaskDetailModal(false); setSelectedTaskDetail(null); }}
        allUsers={users}
        getProjectName={getProjectName}
        getProjectPmName={getProjectPmName}
        onTaskUpdate={(updatedTask) => {
          setSelectedTaskDetail(updatedTask);
          setTasks((prev) => prev.map((t: any) => t.id === updatedTask.id ? updatedTask : t));
          tasksRef.current = tasksRef.current.map((t: any) => t.id === updatedTask.id ? updatedTask : t);
        }}
      />
    </>
  );
};

export default PMTasksTableView;