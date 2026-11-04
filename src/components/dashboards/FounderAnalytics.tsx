import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaCheckCircle,
  FaEnvelope,
  FaExclamationTriangle,
  FaFire,
  FaHistory,
  FaTasks,
  FaUsers,
} from 'react-icons/fa';
import UserAvatar from '../UserAvatar';
import './FounderAnalytics.css';

const ONE_DAY = 24 * 60 * 60 * 1000;
const DIST_MAX_ROWS = 6;
const LIST_PAGE = 5;
const ACTIVITY_DAYS = 7;
const ACTIVITY_PAGE = 8;

interface FounderAnalyticsProps {
  projects: any[];
  tasks: any[];
  users: any[];
  /** Latest client email per project, as already loaded by the PM dashboard */
  lastEmailLogs: Record<string, { date: string; pmName?: string; notes?: string }>;
}

const daysSinceUpdate = (project: any, now: number) =>
  project.updatedAt ? Math.floor((now - new Date(project.updatedAt).getTime()) / ONE_DAY) : 999;

const timeAgo = (time: number, now: number) => {
  const minutes = Math.floor((now - time) / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const toDistribution = (projects: any[], key: string, fallback: string) => {
  const counts = new Map<string, number>();
  projects.forEach((p) => {
    const label = p[key] || fallback;
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (sorted.length <= DIST_MAX_ROWS) return sorted;
  const shown = sorted.slice(0, DIST_MAX_ROWS - 1);
  const other = sorted.slice(DIST_MAX_ROWS - 1).reduce((sum, [, n]) => sum + n, 0);
  return [...shown, ['Other', other] as [string, number]];
};

const Distribution: React.FC<{ title: string; rows: [string, number][] }> = ({ title, rows }) => {
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <section className="fa-card">
      <h3 style={{ marginBottom: 14 }}>{title}</h3>
      {rows.length === 0 && <p className="fa-empty">No projects yet</p>}
      {rows.map(([label, value]) => (
        <div className="fa-dist-row" key={label}>
          <div className="fa-dist-label"><span>{label}</span><b>{value}</b></div>
          <span className="fa-track"><span className="fa-fill" style={{ width: `${(value / max) * 100}%` }} /></span>
        </div>
      ))}
    </section>
  );
};

/** Company-wide numbers shown to the founder at the top of the PM overview. */
const FounderAnalytics: React.FC<FounderAnalyticsProps> = ({ projects, tasks, users, lastEmailLogs }) => {
  const navigate = useNavigate();
  const [showAllPms, setShowAllPms] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const data = useMemo(() => {
    const now = Date.now();
    const openProjects = projects.filter((p) => p.stage !== 'Closed');
    const withAge = openProjects
      .map((project) => ({ project, age: daysSinceUpdate(project, now) }))
      .sort((a, b) => b.age - a.age);
    const healthy = withAge.filter((x) => x.age < 7).length;
    const attention = withAge.filter((x) => x.age >= 7 && x.age < 14).length;
    const critical = withAge.filter((x) => x.age >= 14).length;

    const completed = tasks.filter((t) => t.isCompleted).length;
    const overdue = tasks.filter((t) => t.dueDate && !t.isCompleted && new Date(t.dueDate).getTime() < now).length;

    const projectById = new Map<string, any>(projects.map((p) => [p.id, p]));
    const pmIdOf = (p: any) => p?.pm?.id || p?.pmId;
    const pms = users
      .filter((u) => u.role === 'Project Manager')
      .map((pm) => {
        const pmProjects = projects.filter((p) => pmIdOf(p) === pm.id);
        const pmTasks = tasks.filter((t) => pmIdOf(projectById.get(t.projectId)) === pm.id);
        const pmCompleted = pmTasks.filter((t) => t.isCompleted).length;
        const latest = pmProjects.reduce((best: number | null, p) => {
          const log = lastEmailLogs[p.id];
          if (!log?.date) return best;
          const time = new Date(log.date).getTime();
          return best === null || time > best ? time : best;
        }, null);
        return {
          id: pm.id,
          name: pm.name,
          avatarUrl: pm.avatarUrl,
          projectCount: pmProjects.length,
          taskCount: pmTasks.length,
          rate: pmTasks.length > 0 ? Math.round((pmCompleted / pmTasks.length) * 100) : null,
          daysSinceEmail: latest === null ? null : Math.floor((now - latest) / ONE_DAY),
        };
      })
      .sort((a, b) => b.projectCount - a.projectCount || a.name.localeCompare(b.name));

    // One entry per task (its latest known change) plus each project's latest client email
    const userName = (id?: string) => users.find((u) => u.id === id)?.name;
    const cutoff = now - ACTIVITY_DAYS * ONE_DAY;
    const activity: { id: string; projectId: string; text: string; detail: string; time: number; icon: React.ReactNode }[] = [];
    tasks.forEach((t) => {
      const created = t.createdAt ? new Date(t.createdAt).getTime() : 0;
      const updated = t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
      const time = Math.max(created, updated);
      if (time < cutoff) return;
      const owner = userName(t.assignedToId);
      const client = projectById.get(t.projectId)?.clientName || 'Unknown project';
      const wasEdited = updated > created + 60000;
      activity.push({
        id: `task-${t.id}`,
        projectId: t.projectId,
        text: t.isCompleted && wasEdited
          ? `"${t.title}" was completed`
          : wasEdited
            ? `"${t.title}" is now ${t.status}`
            : `"${t.title}" was created`,
        detail: owner ? `${client} · ${owner}` : client,
        time,
        icon: t.isCompleted ? <FaCheckCircle /> : <FaTasks />,
      });
    });
    Object.entries(lastEmailLogs).forEach(([projectId, log]) => {
      const time = log?.date ? new Date(log.date).getTime() : 0;
      if (time < cutoff) return;
      activity.push({
        id: `email-${projectId}`,
        projectId,
        text: log.notes ? `Client email: ${log.notes.slice(0, 80)}` : 'Client email sent',
        detail: `${projectById.get(projectId)?.clientName || 'Unknown project'}${log.pmName ? ` · ${log.pmName}` : ''}`,
        time,
        icon: <FaEnvelope />,
      });
    });
    activity.sort((a, b) => b.time - a.time);

    return {
      now,
      activity,
      healthy,
      attention,
      critical,
      openTotal: openProjects.length,
      stale: withAge.filter((x) => x.age >= 7),
      totalTasks: tasks.length,
      completed,
      overdue,
      completionRate: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
      pms,
      activePms: pms.filter((pm) => pm.projectCount > 0).length,
      clientTypes: toDistribution(projects, 'clientType', 'Unknown'),
      priorities: toDistribution(projects, 'priority', 'Unassigned'),
    };
  }, [projects, tasks, users, lastEmailLogs]);

  const visiblePms = showAllPms ? data.pms : data.pms.slice(0, LIST_PAGE);
  const visibleStale = showAllProjects ? data.stale : data.stale.slice(0, LIST_PAGE);
  const tiles = [
    { label: 'Task completion', value: `${data.completionRate}%`, foot: `${data.completed} of ${data.totalTasks} tasks`, icon: <FaTasks /> },
    { label: 'Overdue tasks', value: data.overdue, foot: 'Past due and still open', icon: <FaHistory /> },
    { label: 'Active PMs', value: data.activePms, foot: `Of ${data.pms.length} project managers`, icon: <FaUsers /> },
    { label: 'Projects needing attention', value: data.attention + data.critical, foot: `${data.critical} critical`, icon: <FaExclamationTriangle /> },
  ];
  const healthSegments = [
    { key: 'healthy', label: 'Healthy', value: data.healthy, icon: <FaCheckCircle /> },
    { key: 'attention', label: 'Needs attention', value: data.attention, icon: <FaExclamationTriangle /> },
    { key: 'critical', label: 'Critical', value: data.critical, icon: <FaFire /> },
  ];

  return (
    <div className="fa-root">
      <div className="fa-head">
        <h2>Company analytics</h2>
        <p>How projects, tasks and project managers are doing across the company.</p>
      </div>

      <div className="fa-tiles">
        {tiles.map((tile) => (
          <div className="fa-card" key={tile.label}>
            <div className="fa-tile-top">
              <span>{tile.label}</span>
              <span className="fa-tile-icon" aria-hidden="true">{tile.icon}</span>
            </div>
            <div className="fa-tile-num">{tile.value}</div>
            <div className="fa-tile-foot">{tile.foot}</div>
          </div>
        ))}
      </div>

      <div className="fa-grid">
        <section className="fa-card">
          <h3>Project health</h3>
          <p className="fa-card-sub">
            {data.openTotal} open projects, by days since the last update: under 7 is healthy, 7–13 needs attention, 14 or more is critical.
          </p>
          <div className="fa-health-bar" role="img" aria-label={healthSegments.map((s) => `${s.label}: ${s.value}`).join(', ')}>
            {data.openTotal === 0 && <span className="fa-health-empty" />}
            {healthSegments.filter((s) => s.value > 0).map((s) => (
              <span key={s.key} className={`fa-health-seg ${s.key}`} style={{ flexGrow: s.value }} title={`${s.label}: ${s.value}`} />
            ))}
          </div>
          <div className="fa-legend">
            {healthSegments.map((s) => (
              <div className="fa-legend-item" key={s.key}>
                <span className={`fa-legend-icon ${s.key}`} aria-hidden="true">{s.icon}</span>
                <div><b>{s.value}</b><span>{s.label}</span></div>
              </div>
            ))}
          </div>
        </section>

        <section className="fa-card">
          <h3>Projects needing attention</h3>
          <p className="fa-card-sub">Open projects with no update in the last 7 days, longest first.</p>
          {data.stale.length === 0 && <p className="fa-empty">Every open project was updated this week.</p>}
          {visibleStale.map(({ project, age }) => (
            <button key={project.id} type="button" className="fa-project-row" onClick={() => navigate(`/project/${project.id}`)}>
              <span className="fa-project-text">
                <b>{project.clientName || 'Untitled project'}</b>
                <small>{project.stage || 'No stage'}{project.pm?.name ? ` · PM: ${project.pm.name}` : ''}</small>
              </span>
              <span className={`fa-project-age ${age >= 14 ? 'fa-critical' : 'fa-stale'}`}>{age >= 999 ? 'Never updated' : `${age}d ago`}</span>
            </button>
          ))}
          {data.stale.length > LIST_PAGE && (
            <button type="button" className="fa-more" onClick={() => setShowAllProjects(!showAllProjects)}>
              {showAllProjects ? 'Show less' : `Show all ${data.stale.length}`}
            </button>
          )}
        </section>
      </div>

      <div className="fa-grid">
        <section className="fa-card">
          <h3 style={{ marginBottom: 14 }}>PM performance</h3>
          {data.pms.length === 0 && <p className="fa-empty">No project managers yet</p>}
          {data.pms.length > 0 && (
            <table className="fa-table">
              <thead>
                <tr>
                  <th>Project manager</th>
                  <th>Projects</th>
                  <th className="fa-hide-sm">Tasks</th>
                  <th>Completed</th>
                  <th className="fa-hide-sm">Last client email</th>
                </tr>
              </thead>
              <tbody>
                {visiblePms.map((pm) => (
                  <tr key={pm.id}>
                    <td>
                      <span className="fa-person">
                        <UserAvatar name={pm.name} avatarUrl={pm.avatarUrl} size={25} color="#111111" />
                        {pm.name}
                      </span>
                    </td>
                    <td>{pm.projectCount}</td>
                    <td className="fa-hide-sm">{pm.taskCount}</td>
                    <td>{pm.rate === null ? '–' : `${pm.rate}%`}</td>
                    <td className="fa-hide-sm">
                      {pm.daysSinceEmail === null ? 'None logged' : pm.daysSinceEmail === 0 ? 'Today' : `${pm.daysSinceEmail}d ago`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data.pms.length > LIST_PAGE && (
            <button type="button" className="fa-more" onClick={() => setShowAllPms(!showAllPms)}>
              {showAllPms ? 'Show less' : `Show all ${data.pms.length}`}
            </button>
          )}
        </section>

        <div className="fa-grid" style={{ marginBottom: 0 }}>
          <Distribution title="Projects by client type" rows={data.clientTypes} />
          <Distribution title="Projects by priority" rows={data.priorities} />
        </div>
      </div>

      <section className="fa-card">
        <h3>Team activity</h3>
        <p className="fa-card-sub">Task changes and client emails across the company in the last {ACTIVITY_DAYS} days.</p>
        {data.activity.length === 0 && <p className="fa-empty">No activity in the last {ACTIVITY_DAYS} days.</p>}
        {(showAllActivity ? data.activity.slice(0, 50) : data.activity.slice(0, ACTIVITY_PAGE)).map((item) => (
          <button key={item.id} type="button" className="fa-project-row" onClick={() => navigate(`/project/${item.projectId}`)}>
            <span className="fa-activity-icon" aria-hidden="true">{item.icon}</span>
            <span className="fa-project-text" style={{ flex: 1 }}>
              <b>{item.text}</b>
              <small>{item.detail}</small>
            </span>
            <span className="fa-project-age" style={{ color: '#747b8c' }}>{timeAgo(item.time, data.now)}</span>
          </button>
        ))}
        {data.activity.length > ACTIVITY_PAGE && (
          <button type="button" className="fa-more" onClick={() => setShowAllActivity(!showAllActivity)}>
            {showAllActivity ? 'Show less' : `Show more (${Math.min(data.activity.length, 50)})`}
          </button>
        )}
      </section>
    </div>
  );
};

export default FounderAnalytics;
