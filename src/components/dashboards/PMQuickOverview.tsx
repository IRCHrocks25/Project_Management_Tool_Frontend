import React from 'react';
import { FaFolder, FaCheckCircle, FaClock, FaExclamationTriangle, FaArrowRight } from 'react-icons/fa';

interface PMQuickOverviewProps {
  projects: any[];
  activeTasksCount: number;
  todayTasks: number;
  waitingOnClient: number;
  navigate: (path: string) => void;
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap');

  .pmqo-wrap {
    margin-bottom: 2.5rem;
    font-family: 'Instrument Sans', sans-serif;
  }

  .pmqo-heading {
    font-size: 1.1rem;
    font-weight: 600;
    color: #94a3b8;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin: 0 0 1.25rem 2px;
  }

  .pmqo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px;
  }

  .pmqo-card {
    background: #ffffff;
    border: 1px solid #e8ecf0;
    border-radius: 14px;
    padding: 22px 24px 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04);
    position: relative;
    overflow: hidden;
    transition: box-shadow 0.15s, transform 0.15s, border-color 0.15s;
  }
  .pmqo-card:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.08);
    transform: translateY(-2px);
  }
  .pmqo-card.clickable { cursor: pointer; }

  /* Colored left accent bar */
  .pmqo-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 16px;
    bottom: 16px;
    width: 3px;
    border-radius: 0 3px 3px 0;
  }
  .pmqo-card.blue::before   { background: #2563eb; }
  .pmqo-card.green::before  { background: #16a34a; }
  .pmqo-card.amber::before  { background: #d97706; }
  .pmqo-card.rose::before   { background: #e11d48; }

  /* Top row: icon + label */
  .pmqo-top {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
  }

  .pmqo-icon-wrap {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    flex-shrink: 0;
  }
  .pmqo-card.blue  .pmqo-icon-wrap { background: #eff6ff; color: #2563eb; }
  .pmqo-card.green .pmqo-icon-wrap { background: #f0fdf4; color: #16a34a; }
  .pmqo-card.amber .pmqo-icon-wrap { background: #fffbeb; color: #d97706; }
  .pmqo-card.rose  .pmqo-icon-wrap { background: #fff1f2; color: #e11d48; }

  .pmqo-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #94a3b8;
    line-height: 1;
  }

  /* Number */
  .pmqo-number {
    font-family: 'DM Mono', monospace;
    font-size: 2.6rem;
    font-weight: 500;
    line-height: 1;
    letter-spacing: -0.03em;
    margin-bottom: 10px;
  }
  .pmqo-card.blue  .pmqo-number { color: #2563eb; }
  .pmqo-card.green .pmqo-number { color: #16a34a; }
  .pmqo-card.amber .pmqo-number { color: #d97706; }
  .pmqo-card.rose  .pmqo-number { color: #e11d48; }

  /* Footer */
  .pmqo-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 10px;
    border-top: 1px solid #f1f4f8;
  }
  .pmqo-sub {
    font-size: 12px;
    color: #94a3b8;
  }
  .pmqo-link {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    font-weight: 600;
    color: #94a3b8;
    transition: color 0.12s;
  }
  .pmqo-card.clickable:hover .pmqo-link { color: #2563eb; }
  .pmqo-card.blue:hover  .pmqo-link { color: #2563eb; }
  .pmqo-card.green:hover .pmqo-link { color: #16a34a; }
  .pmqo-card.amber:hover .pmqo-link { color: #d97706; }
  .pmqo-card.rose:hover  .pmqo-link { color: #e11d48; }
`;

const PMQuickOverview: React.FC<PMQuickOverviewProps> = ({
  projects,
  activeTasksCount,
  todayTasks,
  waitingOnClient,
  navigate,
}) => {
  const activeProjects = projects.filter((p: any) => !p.isArchived).length;

  const cards = [
    {
      color: 'blue',
      icon: <FaFolder />,
      label: 'Total Projects',
      value: activeProjects,
      sub: `${activeProjects} active`,
      link: null,
    },
    {
      color: 'green',
      icon: <FaCheckCircle />,
      label: 'Active Tasks',
      value: activeTasksCount,
      sub: 'in progress',
      link: null,
    },
    {
      color: 'amber',
      icon: <FaClock />,
      label: 'Due Today',
      value: todayTasks,
      sub: 'tasks due',
      link: { label: 'View all', path: '/tasks-due-today' },
    },
    {
      color: 'rose',
      icon: <FaExclamationTriangle />,
      label: 'Waiting on Client',
      value: waitingOnClient,
      sub: 'pending response',
      link: null,
    },
  ];

  return (
    <>
      <style>{STYLES}</style>
      <div className="pmqo-wrap">
        <p className="pmqo-heading">Quick Overview</p>
        <div className="pmqo-grid">
          {cards.map((card) => (
            <div
              key={card.label}
              className={`pmqo-card ${card.color}${card.link ? ' clickable' : ''}`}
              onClick={card.link ? () => navigate(card.link!.path) : undefined}
              title={card.link ? `View ${card.label.toLowerCase()}` : undefined}
            >
              <div className="pmqo-top">
                <div className="pmqo-icon-wrap">{card.icon}</div>
                <span className="pmqo-label">{card.label}</span>
              </div>
              <div className="pmqo-number">{card.value}</div>
              <div className="pmqo-footer">
                <span className="pmqo-sub">{card.sub}</span>
                {card.link && (
                  <span className="pmqo-link">
                    {card.link.label} <FaArrowRight style={{ fontSize: 9 }} />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default PMQuickOverview;