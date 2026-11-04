import React from 'react';
import { FaFolderOpen, FaLayerGroup } from 'react-icons/fa';
import KanbanBoard from '../KanbanBoard';

interface PMKanbanViewProps {
  user: any;
  headViewAllProjects: boolean;
  setHeadViewAllProjects: React.Dispatch<React.SetStateAction<boolean>>;
  projectsForView: any[];
  tasksForView: any[];
  onKanbanUpdate: () => void;
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap');

  .pmk-scope-bar {
    --accent: #111111;
    --accent-light: #f7f7f7;
    --border: #ececec;
    --text-secondary: #595959;
    --text-muted: #a6a6a6;
    font-family: 'Instrument Sans', sans-serif;

    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 16px;
    padding: 12px 16px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: #fafafa;
    transition: background 0.2s, border-color 0.2s;
  }

  .pmk-scope-bar.all-active {
    background: var(--accent-light);
    border-color: #dedede;
  }

  .pmk-scope-left {
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .pmk-scope-icon {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 13px;
    background: white;
    border: 1px solid var(--border);
    color: var(--text-muted);
    transition: all 0.2s;
  }
  .pmk-scope-bar.all-active .pmk-scope-icon {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .pmk-scope-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .pmk-scope-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
    line-height: 1;
  }
  .pmk-scope-bar.all-active .pmk-scope-label {
    color: #111111;
  }
  .pmk-scope-desc {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    line-height: 1.3;
  }

  .pmk-toggle-btn {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 7px 14px;
    border-radius: 8px;
    border: none;
    font-family: 'Instrument Sans', sans-serif;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .pmk-toggle-btn.to-all {
    background: var(--accent);
    color: white;
  }
  .pmk-toggle-btn.to-all:hover {
    background: #111111;
  }

  .pmk-toggle-btn.to-dept {
    background: white;
    color: var(--accent);
    border: 1px solid #dedede;
  }
  .pmk-toggle-btn.to-dept:hover {
    background: #ececec;
  }
`;

const PMKanbanView: React.FC<PMKanbanViewProps> = ({
  user,
  headViewAllProjects,
  setHeadViewAllProjects,
  projectsForView,
  tasksForView,
  onKanbanUpdate,
}) => {
  const isTeamLeadNonPM = user?.role !== 'Project Manager' && !!user?.isTeamLead;

  return (
    <>
      <style>{STYLES}</style>

      {isTeamLeadNonPM && (
        <div className={`pmk-scope-bar${headViewAllProjects ? ' all-active' : ''}`}>
          <div className="pmk-scope-left">
            <div className="pmk-scope-icon">
              {headViewAllProjects
                ? <FaLayerGroup />
                : <FaFolderOpen />
              }
            </div>
            <div className="pmk-scope-text">
              <span className="pmk-scope-label">
                {headViewAllProjects ? 'All Departments' : 'My Department'}
              </span>
              <span className="pmk-scope-desc">
                {headViewAllProjects
                  ? 'Viewing all projects across every department'
                  : 'Viewing projects in your department only'}
              </span>
            </div>
          </div>

          <button
            className={`pmk-toggle-btn ${headViewAllProjects ? 'to-dept' : 'to-all'}`}
            onClick={() => setHeadViewAllProjects(!headViewAllProjects)}
          >
            {headViewAllProjects ? (
              <>
                <FaFolderOpen style={{ fontSize: 11 }} />
                My Department Only
              </>
            ) : (
              <>
                <FaLayerGroup style={{ fontSize: 11 }} />
                See All Projects
              </>
            )}
          </button>
        </div>
      )}

      <KanbanBoard
        projects={projectsForView}
        tasks={tasksForView}
        onUpdate={onKanbanUpdate}
        showAllDepartments={isTeamLeadNonPM ? headViewAllProjects : undefined}
      />
    </>
  );
};

export default PMKanbanView;