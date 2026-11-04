import React, { useMemo, useState } from 'react';
import { FaArrowRight, FaCheckCircle, FaChevronRight, FaExclamationTriangle, FaFilter, FaUserPlus } from 'react-icons/fa';
import UserAvatar from '../UserAvatar';
import { COLUMN_LABEL, ColumnId, getAssigneeIds, getDueInfo, getTaskColumn } from './taskColumns';

export const PM_STAGES = ['Onboarding', 'Copy Writing', 'Design', 'Development', 'AI Team', 'Social Media Team', 'CRM', 'SEO/GEO Team', 'Ready to Close'];

const STAGE_TASK_TYPES: Record<string, string[]> = {
  Onboarding: ['Onboarding', 'Intake'],
  'Copy Writing': ['Copy'],
  Design: ['Design'],
  Development: ['Dev'],
  'AI Team': ['AI'],
  'Social Media Team': ['Social Media'],
  CRM: ['CRM'],
  'SEO/GEO Team': ['SEO/GEO'],
  'Ready to Close': [],
};
const STAGE_COLOR: Record<string, string> = {
  Onboarding: '#111111',
  'Copy Writing': '#111111',
  Design: '#eeaa63',
  Development: '#111111',
  'AI Team': '#cc8abe',
  'Social Media Team': '#3bb3b4',
  CRM: '#111111',
  'SEO/GEO Team': '#3da67a',
  'Ready to Close': '#5fbd8d',
};
const LIST_PAGE_SIZE = 30;

const isOpenTask = (t: any) => !t.isArchived && !t.isCompleted && t.status !== 'Completed';
const isOverdue = (t: any) => getDueInfo(t).className === 'rd-overdue';
const dueTime = (t: any) => (t?.dueDate ? new Date(t.dueDate).getTime() : Number.MAX_SAFE_INTEGER);
const priorityRank: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

const getTaskTag = (task: any): { label: string; tone: string } => {
  if (task.status === 'Blocked') return { label: 'Blocked', tone: 'danger' };
  if (getAssigneeIds(task).length === 0) return { label: 'Needs owner', tone: 'danger' };
  const column = getTaskColumn(task);
  if (column === 'revision') return { label: 'Changes requested', tone: 'danger' };
  if (column === 'for_approval') return { label: 'Review needed', tone: 'warn' };
  if (column === 'client_validation') return { label: 'Waiting on client', tone: 'warn' };
  if (column === 'qa_before_client') return { label: 'QA review', tone: 'good' };
  return { label: COLUMN_LABEL[column], tone: '' };
};

export type Workstream = {
  key: string;
  stage: string;
  project: any;
  tasks: any[];
  next: any | null;
  tag: { label: string; tone: string };
  priority: string;
};

/**
 * One card per project per department. Lanes are built from the same project lists as the
 * "Projects by Stage" counts, so a project with no open tasks there still gets a card.
 */
export const buildWorkstreams = (stageProjectsMap: Map<string, any[]>, tasks: any[]): Workstream[] => {
  const openByKey = new Map<string, any[]>();
  tasks.filter(isOpenTask).forEach((t) => {
    const key = `${t.projectId}|${t.type}`;
    openByKey.set(key, [...(openByKey.get(key) || []), t]);
  });
  const result: Workstream[] = [];
  PM_STAGES.forEach((stage) => {
    (stageProjectsMap.get(stage) || []).forEach((project) => {
      const stageTasks = (STAGE_TASK_TYPES[stage] || [])
        .flatMap((type) => openByKey.get(`${project.id}|${type}`) || [])
        .sort((a, b) => Number(b.status === 'Blocked') - Number(a.status === 'Blocked') || dueTime(a) - dueTime(b));
      const next = stageTasks[0] || null;
      result.push({
        key: `${stage}|${project.id}`,
        stage,
        project,
        tasks: stageTasks,
        next,
        tag: next
          ? getTaskTag(next)
          : { label: stage === 'Ready to Close' ? 'Ready to close' : 'No open tasks', tone: stage === 'Ready to Close' ? 'good' : '' },
        priority: next?.priority || project.priority || '',
      });
    });
  });
  return result;
};

const Priority: React.FC<{ value: string }> = ({ value }) =>
  value ? <span className={`pm-priority ${value.toLowerCase()}`}>{value}</span> : null;

const Owner: React.FC<{ task: any; users: any[] }> = ({ task, users }) => {
  const ids = task ? getAssigneeIds(task) : [];
  if (ids.length === 0) return <span className="rd-unassigned">{task ? 'Unassigned' : '–'}</span>;
  const first = users.find((u) => u.id === ids[0]);
  const name = first?.name || 'Unknown';
  return (
    <span className="rd-owner">
      <UserAvatar name={name} avatarUrl={first?.avatarUrl} size={22} color="#111111" />
      <span className="rd-owner-name">{name}{ids.length > 1 ? ` +${ids.length - 1}` : ''}</span>
    </span>
  );
};

interface PipelineProps {
  workstreams: Workstream[];
  users: any[];
  getProjectPmName: (projectId: string) => string;
  onOpen: (workstream: Workstream) => void;
  onOpenKanban: () => void;
}

export const PMPipelineView: React.FC<PipelineProps> = ({ workstreams, users, getProjectPmName, onOpen, onOpenKanban }) => {
  const [mode, setMode] = useState<'board' | 'list'>('board');
  const [assignee, setAssignee] = useState('all');
  const [due, setDue] = useState('all');
  const [sort, setSort] = useState('urgency');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [visible, setVisible] = useState(LIST_PAGE_SIZE);

  const filtered = useMemo(() => {
    const now = new Date();
    const weekEnd = now.getTime() + 7 * 86400000;
    const list = workstreams.filter((w) => {
      const task = w.next;
      if (assignee === '__unassigned__' && (!task || w.tasks.some((t) => getAssigneeIds(t).length > 0))) return false;
      if (assignee !== 'all' && assignee !== '__unassigned__' && !w.tasks.some((t) => getAssigneeIds(t).includes(assignee))) return false;
      if (due === 'overdue' && !w.tasks.some(isOverdue)) return false;
      if (due === 'today' && !w.tasks.some((t) => t.dueDate && new Date(t.dueDate).toDateString() === now.toDateString())) return false;
      if (due === 'week' && !w.tasks.some((t) => t.dueDate && dueTime(t) <= weekEnd)) return false;
      if (due === 'blocked' && !w.tasks.some((t) => t.status === 'Blocked')) return false;
      if (attentionOnly && !w.tasks.some((t) => isOverdue(t) || t.status === 'Blocked' || getTaskColumn(t) === 'for_approval' || getAssigneeIds(t).length === 0)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      const byClient = (a.project.clientName || '').localeCompare(b.project.clientName || '');
      const byPriority = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
      const byDue = dueTime(a.next) - dueTime(b.next);
      if (sort === 'client') return byClient;
      if (sort === 'priority') return byPriority || byDue;
      return byDue || byPriority || byClient;
    });
  }, [workstreams, assignee, due, sort, attentionOnly]);

  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach((w) => counts.set(w.stage, (counts.get(w.stage) || 0) + 1));
    return counts;
  }, [filtered]);
  const jumpTo = (stage: string) => {
    if (mode !== 'board') setMode('board');
    window.setTimeout(() => {
      document.getElementById(`pm-lane-${PM_STAGES.indexOf(stage)}`)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }, 0);
  };

  return (
    <section className="rd-panel pm-panel">
      <div className="rd-panel-head">
        <div>
          <h2 className="rd-panel-title">Department pipeline</h2>
          <p className="rd-panel-sub">Each card is a client's work in one department. One client can appear in more than one department.</p>
        </div>
        <div className="rd-segmented" role="group" aria-label="Pipeline layout">
          <button type="button" className={`rd-segment${mode === 'board' ? ' active' : ''}`} aria-pressed={mode === 'board'} onClick={() => setMode('board')}>Board</button>
          <button type="button" className={`rd-segment${mode === 'list' ? ' active' : ''}`} aria-pressed={mode === 'list'} onClick={() => setMode('list')}>List</button>
        </div>
      </div>

      <div className="rd-toolbar">
        <div className="rd-tools pm-tools">
          <select className="rd-select" aria-label="Filter by assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="all">All assignees</option>
            <option value="__unassigned__">Unassigned</option>
            {[...users].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select className="rd-select" aria-label="Filter by due date" value={due} onChange={(e) => setDue(e.target.value)}>
            <option value="all">Any due date</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="week">Due this week</option>
            <option value="blocked">Blocked</option>
          </select>
          <select className="rd-select" aria-label="Sort work" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="urgency">Urgency first</option>
            <option value="priority">Priority first</option>
            <option value="client">Client A–Z</option>
          </select>
          <button type="button" className={`rd-chip${attentionOnly ? ' active' : ''}`} aria-pressed={attentionOnly} onClick={() => setAttentionOnly(!attentionOnly)}>
            <FaFilter aria-hidden="true" style={{ marginRight: 5, fontSize: 10 }} />Needs attention
          </button>
        </div>
        <button type="button" className="rd-link" onClick={onOpenKanban}>Move projects on the Kanban board</button>
      </div>

      <div className="pm-stage-map" aria-label="Jump to a department">
        {PM_STAGES.map((stage) => (
          <button key={stage} type="button" className={`pm-stage-tile${stageCounts.get(stage) ? '' : ' empty'}`} onClick={() => jumpTo(stage)}>
            <span>{stage}</span>
            <b>{stageCounts.get(stage) || 0}</b>
          </button>
        ))}
      </div>

      {mode === 'board' ? (
        <div className="pm-board">
          {PM_STAGES.map((stage, index) => {
            const lane = filtered.filter((w) => w.stage === stage);
            return (
              <div key={stage} id={`pm-lane-${index}`} className="pm-lane" style={{ '--lane': STAGE_COLOR[stage] } as React.CSSProperties}>
                <div className="pm-lane-head">
                  <i aria-hidden="true" />
                  <span>{stage}</span>
                  <b>{lane.length}</b>
                </div>
                <div className="pm-lane-cards">
                  {lane.map((w) => {
                    const dueInfo = w.next ? getDueInfo(w.next) : null;
                    const pm = getProjectPmName(w.project.id);
                    return (
                      <button key={w.key} type="button" className="pm-card" onClick={() => onOpen(w)}>
                        <span className="pm-card-top">
                          <span className="pm-card-client">{w.project.clientName || 'Untitled project'}</span>
                          <Priority value={w.priority} />
                        </span>
                        <span className="pm-card-title">{w.next?.title || 'No open tasks in this department'}</span>
                        <span className="pm-card-meta">
                          {pm ? `PM: ${pm}` : 'No PM'}
                          {w.tasks.length > 1 ? ` · ${w.tasks.length} open tasks` : ''}
                        </span>
                        <span className={`pm-tag ${w.tag.tone}`}>{w.tag.label}</span>
                        {w.next && (
                          <span className="pm-card-foot">
                            <Owner task={w.next} users={users} />
                            <span className={dueInfo?.className} style={{ flexShrink: 0 }}>{dueInfo?.text}</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {lane.length === 0 && <div className="rd-board-empty">Nothing here</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <table className="rd-table pm-table">
            <thead>
              <tr>
                <th className="pm-col-client">Client / PM</th>
                <th>Next task</th>
                <th className="pm-col-dept">Department</th>
                <th className="pm-col-owner">Assignee</th>
                <th className="pm-col-pri">Priority</th>
                <th className="pm-col-due">Next due</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, visible).map((w) => {
                const dueInfo = w.next ? getDueInfo(w.next) : null;
                const pm = getProjectPmName(w.project.id);
                return (
                  <tr
                    key={w.key}
                    tabIndex={0}
                    onClick={() => onOpen(w)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onOpen(w); }}
                  >
                    <td className="pm-col-client">
                      <div className="rd-task-name">{w.project.clientName || 'Untitled project'}</div>
                      <div className="rd-task-meta">{pm ? `PM: ${pm}` : 'No PM'}</div>
                    </td>
                    <td>
                      <div className="rd-task-name">{w.next?.title || 'No open tasks'}</div>
                      <div className="rd-task-meta"><span className={`pm-tag ${w.tag.tone}`}>{w.tag.label}</span>{w.tasks.length > 1 ? ` ${w.tasks.length} open tasks` : ''}</div>
                    </td>
                    <td className="pm-col-dept">{w.stage}</td>
                    <td className="pm-col-owner"><Owner task={w.next} users={users} /></td>
                    <td className="pm-col-pri"><Priority value={w.priority} /></td>
                    <td className="pm-col-due"><span className={dueInfo?.className}>{dueInfo?.text || '–'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="rd-empty"><b>No work matches these filters</b>Try clearing a filter.</div>}
          {filtered.length > 0 && (
            <div className="rd-panel-foot">
              <span>Showing {Math.min(visible, filtered.length)} of {filtered.length}</span>
              {visible < filtered.length && <button type="button" className="rd-link" onClick={() => setVisible((n) => n + LIST_PAGE_SIZE)}>Show more</button>}
            </div>
          )}
        </>
      )}
    </section>
  );
};

interface QueueProps {
  tasks: any[];
  activeProjectIds: Set<string>;
  getProjectName: (projectId: string) => string;
  onOpenTask: (task: any) => void;
  onOpenInbox: () => void;
}

/** Tasks that need a PM decision, most urgent first. */
export const PMActionQueue: React.FC<QueueProps> = ({ tasks, activeProjectIds, getProjectName, onOpenTask, onOpenInbox }) => {
  const [showAll, setShowAll] = useState(false);
  const queue = useMemo(() => {
    const score = (t: any) => {
      if (t.status === 'Blocked') return 0;
      if (getTaskColumn(t) === 'for_approval') return 1;
      if (isOverdue(t)) return 2;
      if (getAssigneeIds(t).length === 0) return 3;
      return 9;
    };
    return tasks
      .filter((t) => isOpenTask(t) && activeProjectIds.has(t.projectId) && score(t) < 9)
      .map((t) => ({ task: t, score: score(t) }))
      .sort((a, b) => a.score - b.score || dueTime(a.task) - dueTime(b.task));
  }, [tasks, activeProjectIds]);
  const reason = ['Blocked', 'Review needed', 'Overdue', 'Needs owner'];
  const icons = [<FaExclamationTriangle />, <FaCheckCircle />, <FaExclamationTriangle />, <FaUserPlus />];
  const shown = showAll ? queue : queue.slice(0, 8);

  return (
    <section className="rd-panel pm-side-panel">
      <div className="pm-side-head">
        <div>
          <h2 className="rd-panel-title">Your action queue</h2>
          <p className="rd-panel-sub">{queue.length} tasks need a PM decision.</p>
        </div>
        <button type="button" className="rd-btn rd-btn-subtle" onClick={onOpenInbox}>Task inbox <FaArrowRight aria-hidden="true" /></button>
      </div>
      {queue.length === 0 && <p className="rd-empty" style={{ margin: 0 }}>Nothing needs a decision right now.</p>}
      {shown.map(({ task, score }) => {
        const dueInfo = getDueInfo(task);
        return (
          <button key={task.id} type="button" className="pm-queue-row" onClick={() => onOpenTask(task)}>
            <span className={`pm-queue-icon s${score}`} aria-hidden="true">{icons[score]}</span>
            <span className="pm-queue-text">
              <b>{task.title}</b>
              <small>{getProjectName(task.projectId)} · {reason[score]}</small>
            </span>
            <span className={dueInfo.className} style={{ flexShrink: 0, fontSize: 11.5 }}>{dueInfo.text}</span>
            <FaChevronRight className="pm-queue-arrow" aria-hidden="true" />
          </button>
        );
      })}
      {queue.length > 8 && (
        <div className="rd-panel-foot">
          <span>Showing {shown.length} of {queue.length}</span>
          <button type="button" className="rd-link" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show less' : 'Show all'}</button>
        </div>
      )}
    </section>
  );
};

export const PMDepartmentBars: React.FC<{ stageProjectsMap: Map<string, any[]>; onOpenStage: (stage: string) => void }> = ({ stageProjectsMap, onOpenStage }) => {
  const max = Math.max(1, ...PM_STAGES.map((s) => (stageProjectsMap.get(s) || []).length));
  return (
    <section className="rd-panel pm-side-panel">
      <div className="pm-side-head">
        <div>
          <h2 className="rd-panel-title">Projects by stage</h2>
          <p className="rd-panel-sub">Projects with work in each department. Select one to open it.</p>
        </div>
      </div>
      <div className="pm-bars">
        {PM_STAGES.map((stage) => {
          const count = (stageProjectsMap.get(stage) || []).length;
          return (
            <button key={stage} type="button" className="pm-bar-row" onClick={() => onOpenStage(stage)}>
              <span className="pm-bar-label">{stage}</span>
              <span className="rd-track"><span className="rd-fill" style={{ width: `${(count / max) * 100}%` }} /></span>
              <b>{count}</b>
            </button>
          );
        })}
      </div>
    </section>
  );
};

const APPROVAL_COLUMNS: ColumnId[] = ['for_approval', 'revision', 'qa_before_client', 'client_validation'];

interface ApprovalsProps {
  tasks: any[];
  users: any[];
  activeProjectIds: Set<string>;
  searchTerm: string;
  getProjectName: (projectId: string) => string;
  getProjectPmName: (projectId: string) => string;
  onOpenTask: (task: any) => void;
}

export const PMApprovalsView: React.FC<ApprovalsProps> = ({ tasks, users, activeProjectIds, searchTerm, getProjectName, getProjectPmName, onOpenTask }) => {
  const [column, setColumn] = useState<ColumnId>('for_approval');
  const [visible, setVisible] = useState(LIST_PAGE_SIZE);
  const inScope = useMemo(() => tasks.filter((t) => isOpenTask(t) && activeProjectIds.has(t.projectId)), [tasks, activeProjectIds]);
  const query = searchTerm.trim().toLowerCase();
  const rows = useMemo(
    () =>
      inScope
        .filter((t) => getTaskColumn(t) === column)
        .filter((t) => !query || (t.title || '').toLowerCase().includes(query) || getProjectName(t.projectId).toLowerCase().includes(query))
        .sort((a, b) => dueTime(a) - dueTime(b)),
    [inScope, column, query, getProjectName],
  );
  return (
    <section className="rd-panel pm-panel">
      <div className="rd-panel-head">
        <div>
          <h2 className="rd-panel-title">Approvals</h2>
          <p className="rd-panel-sub">Work under review in every department. Open a task to complete it or request changes.</p>
        </div>
      </div>
      <div className="rd-toolbar">
        <div className="rd-chips">
          {APPROVAL_COLUMNS.map((id) => (
            <button key={id} type="button" className={`rd-chip${column === id ? ' active' : ''}`} onClick={() => { setColumn(id); setVisible(LIST_PAGE_SIZE); }}>
              {COLUMN_LABEL[id]}<span className="rd-chip-count">{inScope.filter((t) => getTaskColumn(t) === id).length}</span>
            </button>
          ))}
        </div>
      </div>
      <table className="rd-table pm-table">
        <thead>
          <tr>
            <th>Task / project</th>
            <th className="pm-col-dept">Department</th>
            <th className="pm-col-owner">Assignee</th>
            <th className="pm-col-due">Due date</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, visible).map((t) => {
            const dueInfo = getDueInfo(t);
            const pm = getProjectPmName(t.projectId);
            return (
              <tr key={t.id} tabIndex={0} onClick={() => onOpenTask(t)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onOpenTask(t); }}>
                <td>
                  <div className="rd-task-name">{t.title}</div>
                  <div className="rd-task-meta">{getProjectName(t.projectId)}{pm ? ` · PM: ${pm}` : ''}</div>
                </td>
                <td className="pm-col-dept">{t.type}</td>
                <td className="pm-col-owner"><Owner task={t} users={users} /></td>
                <td className="pm-col-due"><span className={dueInfo.className}>{dueInfo.text}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <div className="rd-empty"><b>Nothing here</b>No tasks are in {COLUMN_LABEL[column].toLowerCase()} right now.</div>}
      {rows.length > 0 && (
        <div className="rd-panel-foot">
          <span>Showing {Math.min(visible, rows.length)} of {rows.length}</span>
          {visible < rows.length && <button type="button" className="rd-link" onClick={() => setVisible((n) => n + LIST_PAGE_SIZE)}>Show more</button>}
        </div>
      )}
    </section>
  );
};

interface WorkloadProps {
  tasks: any[];
  users: any[];
  activeProjectIds: Set<string>;
  onOpenAssignee: (assigneeId: string) => void;
}

export const PMWorkloadView: React.FC<WorkloadProps> = ({ tasks, users, activeProjectIds, onOpenAssignee }) => {
  const { rows, unassigned } = useMemo(() => {
    const open = tasks.filter((t) => isOpenTask(t) && activeProjectIds.has(t.projectId));
    const map = new Map<string, { id: string; user: any; open: number; progress: number; review: number; overdue: number }>();
    let unassignedCount = 0;
    open.forEach((t) => {
      const ids = getAssigneeIds(t);
      if (ids.length === 0) unassignedCount += 1;
      ids.forEach((id) => {
        if (!map.has(id)) map.set(id, { id, user: users.find((u) => u.id === id), open: 0, progress: 0, review: 0, overdue: 0 });
        const row = map.get(id)!;
        row.open += 1;
        const column = getTaskColumn(t);
        if (column === 'owned_in_progress') row.progress += 1;
        if (column === 'for_approval') row.review += 1;
        if (isOverdue(t)) row.overdue += 1;
      });
    });
    return { rows: Array.from(map.values()).sort((a, b) => b.open - a.open), unassigned: unassignedCount };
  }, [tasks, users, activeProjectIds]);

  return (
    <section className="rd-panel pm-panel">
      <div className="rd-panel-head">
        <div>
          <h2 className="rd-panel-title">Team workload</h2>
          <p className="rd-panel-sub">Open tasks per person across every department. Select someone to see their tasks in the task inbox.</p>
        </div>
      </div>
      <div className="rd-team-row head" aria-hidden="true">
        <span>Person</span>
        <span className="rd-team-num">Open</span>
        <span className="rd-team-num rd-team-hide">In progress</span>
        <span className="rd-team-num rd-team-hide">In approval</span>
        <span className="rd-team-num">Overdue</span>
      </div>
      {rows.map((row) => (
        <button key={row.id} type="button" className="rd-team-row" onClick={() => onOpenAssignee(row.id)}>
          <span className="rd-owner">
            <UserAvatar name={row.user?.name || 'Unknown'} avatarUrl={row.user?.avatarUrl} size={25} color="#111111" />
            <span className="rd-owner-name">{row.user?.name || 'Unknown user'}{row.user?.role ? <small className="pm-person-role"> · {row.user.role}</small> : null}</span>
          </span>
          <span className="rd-team-num">{row.open}</span>
          <span className="rd-team-num rd-team-hide">{row.progress}</span>
          <span className="rd-team-num rd-team-hide">{row.review}</span>
          <span className={`rd-team-num${row.overdue > 0 ? ' rd-overdue' : ''}`}>{row.overdue}</span>
        </button>
      ))}
      {unassigned > 0 && (
        <button type="button" className="rd-team-row" onClick={() => onOpenAssignee('__unassigned__')}>
          <span className="rd-unassigned">Unassigned</span>
          <span className="rd-team-num">{unassigned}</span>
          <span className="rd-team-num rd-team-hide">–</span>
          <span className="rd-team-num rd-team-hide">–</span>
          <span className="rd-team-num">–</span>
        </button>
      )}
      {rows.length === 0 && unassigned === 0 && <div className="rd-empty"><b>No open tasks</b>Workload appears here once tasks are open.</div>}
    </section>
  );
};
