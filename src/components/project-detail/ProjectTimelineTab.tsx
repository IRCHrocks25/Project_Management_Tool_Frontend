import React, { useMemo, useState } from 'react';
import {
  FaCheck,
  FaCheckCircle,
  FaClock,
  FaEdit,
  FaEnvelope,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaHistory,
  FaPaperPlane,
  FaStream,
  FaColumns,
  FaUser,
} from 'react-icons/fa';

type ViewMode = 'timeline' | 'department';
type SortOrder = 'newest' | 'oldest';

const VIEW_STORAGE_KEY = 'projectTimelineView';

const DEPARTMENT_COLORS: Record<string, string> = {
  'Design': '#111111',
  'Copy Writing': '#111111',
  'Development': '#10b981',
  'Project Management': '#111111',
  'Onboarding': '#f59e0b',
  'General': '#6b7280',
};

const getDepartmentColor = (dept: string) => DEPARTMENT_COLORS[dept] || '#6b7280';

const getActionIcon = (action: string) => {
  if (action.includes('Created')) return <FaCheckCircle style={{ color: '#10b981' }} />;
  if (action.includes('Approved')) return <FaCheck style={{ color: '#10b981' }} />;
  if (action.includes('Revision')) return <FaExclamationTriangle style={{ color: '#f59e0b' }} />;
  if (action.includes('Submitted')) return <FaPaperPlane style={{ color: '#111111' }} />;
  if (action.includes('Updated')) return <FaEdit style={{ color: '#111111' }} />;
  if (action.includes('Email')) return <FaEnvelope style={{ color: '#111111' }} />;
  return <FaHistory style={{ color: '#6b7280' }} />;
};

const formatDateTime = (date: string | Date) =>
  new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatTime = (date: string | Date) =>
  new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const formatRelative = (date: string | Date) => {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return formatTime(date);
};

const dayKey = (date: string | Date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const dayLabel = (date: string | Date) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(d) === dayKey(today)) return 'Today';
  if (dayKey(d) === dayKey(yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
};

const getUserName = (activity: any) =>
  activity.user ? activity.user.name || activity.user.email || 'Unknown' : null;

/** Task / deliverable / file / status / notes details shared by both views */
const ActivityDetails: React.FC<{ activity: any }> = ({ activity }) => {
  const meta = activity.metadata || {};
  const notes: string | undefined = meta.notes;
  const attachmentMatch = notes?.match(/Attachment:\s*(https?:\/\/[^\s]+)/i);
  const notesText = attachmentMatch ? notes!.replace(/Attachment:\s*https?:\/\/[^\s]+/i, '').trim() : notes?.trim();

  if (!meta.taskTitle && !meta.deliverableType && !meta.fileUrl && !(meta.previousStatus && meta.newStatus) && !notes) {
    return null;
  }

  return (
    <div className="activity-log-card-body">
      {meta.taskTitle && (
        <div className="activity-meta-item">
          <strong>Task:</strong> {meta.taskTitle}
        </div>
      )}
      {meta.deliverableType && (
        <div className="activity-meta-item">
          <strong>Deliverable:</strong> {meta.deliverableType}
          {meta.deliverableCustomType && ` (${meta.deliverableCustomType})`}
        </div>
      )}
      {meta.previousStatus && meta.newStatus && (
        <div className="activity-meta-item tl-status-change">
          <span className="tl-status-chip">{meta.previousStatus}</span>
          <span aria-hidden="true">→</span>
          <span className="sr-only">changed to</span>
          <span className="tl-status-chip tl-status-chip--new">{meta.newStatus}</span>
        </div>
      )}
      {meta.fileUrl && (
        <div className="activity-meta-item">
          <a
            href={meta.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="activity-file-link"
            title={meta.fileUrl}
          >
            <FaExternalLinkAlt style={{ fontSize: '0.625rem', marginRight: '0.3rem' }} aria-hidden="true" />
            {meta.fileUrl.length > 50 ? meta.fileUrl.substring(0, 50) + '…' : meta.fileUrl}
          </a>
        </div>
      )}
      {(notesText || attachmentMatch) && (
        <div className="activity-meta-item tl-notes">
          {notesText && <div style={{ whiteSpace: 'pre-wrap' }}>{notesText}</div>}
          {attachmentMatch && (
            <a
              href={attachmentMatch[1]}
              target="_blank"
              rel="noopener noreferrer"
              className="activity-file-link"
              style={{ display: 'inline-block', marginTop: notesText ? '0.375rem' : 0 }}
            >
              Attachment ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
};

/** The original per-department board, kept as an alternative view */
const DepartmentBoard: React.FC<{ activities: any[] }> = ({ activities }) => {
  const groupedByDepartment: Record<string, any[]> = {};
  activities.forEach((activity) => {
    const dept = activity.department || 'General';
    if (!groupedByDepartment[dept]) groupedByDepartment[dept] = [];
    groupedByDepartment[dept].push(activity);
  });
  const departments = Object.keys(groupedByDepartment).sort();

  return (
    <div className="activity-log-columns">
      {departments.map((dept) => (
        <div key={dept} className="activity-log-column">
          <div className="activity-log-column-header" style={{ borderLeftColor: getDepartmentColor(dept) }}>
            <h3>{dept}</h3>
            <span className="activity-count">{groupedByDepartment[dept].length}</span>
          </div>
          <div className="activity-log-column-content">
            {groupedByDepartment[dept].map((activity) => (
              <div key={activity.id} className="activity-log-card">
                <div className="activity-log-card-header">
                  <div className="activity-icon-wrapper">{getActionIcon(activity.action)}</div>
                  <div className="activity-action-text">
                    <span className="activity-action">{activity.action}</span>
                  </div>
                </div>
                <ActivityDetails activity={activity} />
                <div className="activity-log-card-footer">
                  <div className="activity-user">
                    {getUserName(activity) ? (
                      <>
                        <FaUser style={{ fontSize: '0.75rem', marginRight: '0.25rem' }} />
                        {getUserName(activity)}
                      </>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>System</span>
                    )}
                  </div>
                  <time className="activity-time" dateTime={new Date(activity.createdAt).toISOString()}>
                    <FaClock style={{ fontSize: '0.75rem', marginRight: '0.25rem' }} />
                    {formatDateTime(activity.createdAt)}
                  </time>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

/** Chronological feed grouped by day */
const ChronologicalTimeline: React.FC<{ activities: any[] }> = ({ activities }) => {
  const days: { key: string; label: string; items: any[] }[] = [];
  activities.forEach((activity) => {
    const key = dayKey(activity.createdAt);
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      day = { key, label: dayLabel(activity.createdAt), items: [] };
      days.push(day);
    }
    day.items.push(activity);
  });

  return (
    <div className="tl-feed">
      {days.map((day) => (
        <section key={day.key} className="tl-day" aria-label={day.label}>
          <h3 className="tl-day-label">
            {day.label}
            <span className="tl-day-count">{day.items.length}</span>
          </h3>
          <ol className="tl-list">
            {day.items.map((activity) => {
              const dept = activity.department || 'General';
              const color = getDepartmentColor(dept);
              const userName = getUserName(activity);
              return (
                <li key={activity.id} className="tl-item">
                  <span className="tl-marker" aria-hidden="true">{getActionIcon(activity.action)}</span>
                  <div className="tl-entry">
                    <div className="tl-entry-head">
                      <span className="tl-action">{activity.action}</span>
                      <span className="tl-dept" style={{ color, background: `${color}14` }}>
                        <span className="tl-dept-dot" style={{ background: color }} />
                        {dept}
                      </span>
                      <time
                        className="tl-time"
                        dateTime={new Date(activity.createdAt).toISOString()}
                        title={formatDateTime(activity.createdAt)}
                      >
                        {formatRelative(activity.createdAt)}
                      </time>
                    </div>
                    <ActivityDetails activity={activity} />
                    <div className="tl-by">
                      {userName ? <>by <strong>{userName}</strong></> : 'by System'}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
};

export const ProjectTimelineSkeleton: React.FC = () => (
  <div className="tl-skeleton" aria-busy="true" aria-label="Loading activity">
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="tl-skeleton-row">
        <span className="tl-skeleton-dot" />
        <div style={{ flex: 1 }}>
          <span className="tl-skeleton-line" style={{ width: `${40 + (i % 3) * 15}%` }} />
          <span className="tl-skeleton-line tl-skeleton-line--short" />
        </div>
      </div>
    ))}
  </div>
);

const ProjectTimelineTab: React.FC<{ activities: any[] }> = ({ activities }) => {
  const [view, setView] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem(VIEW_STORAGE_KEY) === 'department' ? 'department' : 'timeline';
    } catch {
      return 'timeline';
    }
  });
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [deptFilter, setDeptFilter] = useState<string>('All');

  const changeView = (next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Preference just won't persist
    }
  };

  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    activities.forEach((a) => {
      const dept = a.department || 'General';
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return counts;
  }, [activities]);

  const visible = useMemo(() => {
    const filtered = deptFilter === 'All'
      ? activities
      : activities.filter((a) => (a.department || 'General') === deptFilter);
    // The department board always reads oldest first (as it always has); the timeline follows the sort control
    const order = view === 'department' ? 'oldest' : sortOrder;
    return [...filtered].sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return order === 'newest' ? -diff : diff;
    });
  }, [activities, deptFilter, sortOrder, view]);

  if (activities.length === 0) {
    return (
      <div className="overview-empty-state" style={{ padding: '3rem 1rem' }}>
        <FaHistory className="overview-empty-icon" style={{ fontSize: '2rem' }} aria-hidden="true" />
        <strong>No activity yet</strong>
        Task updates, submissions, approvals and revisions on this project will appear here.
      </div>
    );
  }

  return (
    <div className="activity-log-kanban">
      <div className="activity-log-header tl-header">
        <div>
          <h2>Activity Log</h2>
          <p className="activity-log-subtitle">
            {activities.length} {activities.length === 1 ? 'update' : 'updates'} on this project
          </p>
        </div>
        <div className="tl-controls">
          {view === 'timeline' && (
            <label className="tl-sort">
              <span className="sr-only">Sort order</span>
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOrder)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          )}
          <div className="tl-view-toggle" role="group" aria-label="Layout">
            <button
              type="button"
              className={view === 'timeline' ? 'active' : ''}
              aria-pressed={view === 'timeline'}
              onClick={() => changeView('timeline')}
            >
              <FaStream aria-hidden="true" /> Timeline
            </button>
            <button
              type="button"
              className={view === 'department' ? 'active' : ''}
              aria-pressed={view === 'department'}
              onClick={() => changeView('department')}
            >
              <FaColumns aria-hidden="true" /> By department
            </button>
          </div>
        </div>
      </div>

      <div className="tl-filters" role="group" aria-label="Filter by department">
        {['All', ...Object.keys(deptCounts).sort()].map((dept) => (
          <button
            key={dept}
            type="button"
            className={`tl-chip${deptFilter === dept ? ' active' : ''}`}
            aria-pressed={deptFilter === dept}
            onClick={() => setDeptFilter(dept)}
          >
            {dept !== 'All' && <span className="tl-dept-dot" style={{ background: getDepartmentColor(dept) }} />}
            {dept}
            <span className="tl-chip-count">{dept === 'All' ? activities.length : deptCounts[dept]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="overview-empty-state">
          <strong>No {deptFilter} activity</strong>
          <button type="button" className="kanban-text-btn" onClick={() => setDeptFilter('All')}>
            Show all departments
          </button>
        </div>
      ) : view === 'timeline' ? (
        <ChronologicalTimeline activities={visible} />
      ) : (
        <DepartmentBoard activities={visible} />
      )}
    </div>
  );
};

export default ProjectTimelineTab;
