import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaFolder, FaUser, FaEllipsisV, FaEye, FaEnvelope, FaCheckCircle, FaArchive, FaTimes } from 'react-icons/fa';
import { projectService } from '../../services/project.service';

const ITEMS_PER_PAGE = 10;

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');

  .pml-wrap {
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
    --danger: #dc2626;
    --danger-light: #fff1f2;
    --success: #16a34a;
    --success-light: #f0fdf4;
    font-family: 'Instrument Sans', sans-serif;
    background: var(--bg);
    border-radius: 12px;
    border: 1px solid var(--border);
    box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06);
    overflow: visible;
  }

  /* ── Bulk bar ── */
  .pml-bulk-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    background: var(--accent-light);
    border-bottom: 1px solid #bfdbfe;
    border-radius: 12px 12px 0 0;
  }
  .pml-bulk-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
  }
  .pml-bulk-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 7px;
    font-family: 'Instrument Sans', sans-serif;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.13s;
  }
  .pml-bulk-btn:hover { background: #1d4ed8; }

  /* ── Header ── */
  .pml-head {
    display: grid;
    grid-template-columns: 44px 2fr 110px 100px 110px 110px 150px 200px 100px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    border-radius: 12px 12px 0 0;
  }
  .pml-bulk-bar + .pml-head { border-radius: 0; }

  .pml-head-cell {
    padding: 0 16px;
    height: 48px;
    display: flex;
    align-items: center;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--text-muted);
    border-right: 1px solid var(--border);
    box-sizing: border-box;
    white-space: nowrap;
  }
  .pml-head-cell:last-child { border-right: none; }
  .pml-head-cell.center { justify-content: center; }
  .pml-head-cell.filter-col {
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 4px;
    padding: 6px 16px;
    height: auto;
    min-height: 56px;
  }

  .pml-date-filter {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 11px;
    font-family: 'Instrument Sans', sans-serif;
    background: white;
    color: var(--text-secondary);
    cursor: pointer;
    transition: border-color 0.13s, box-shadow 0.13s;
    box-sizing: border-box;
  }
  .pml-date-filter:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
  }

  .pml-clear-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    background: var(--danger-light);
    border: 1px solid #fecaca;
    border-radius: 5px;
    color: var(--danger);
    font-size: 10.5px;
    font-weight: 500;
    font-family: 'Instrument Sans', sans-serif;
    cursor: pointer;
    transition: background 0.12s;
  }
  .pml-clear-btn:hover { background: #fecaca; }

  /* ── Rows ── */
  .pml-row {
    display: grid;
    grid-template-columns: 44px 2fr 110px 100px 110px 110px 150px 200px 100px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    transition: background 0.1s;
    animation: rowIn 0.2s ease both;
    position: relative;
  }
  .pml-row:last-child { border-bottom: none; }
  .pml-row:hover { background: var(--surface-hover); }
  .pml-row.selected { background: var(--accent-light); }

  @keyframes rowIn {
    from { opacity: 0; transform: translateY(3px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .pml-cell {
    padding: 13px 16px;
    display: flex;
    align-items: center;
    font-size: 13px;
    color: var(--text-secondary);
    border-right: 1px solid var(--border);
    min-width: 0;
    overflow: hidden;
    box-sizing: border-box;
  }
  .pml-cell:last-child { border-right: none; }
  .pml-cell.center { justify-content: center; }

  /* Project name */
  .pml-project-name {
    font-weight: 600;
    font-size: 13.5px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.12s;
  }
  .pml-row:hover .pml-project-name { color: var(--accent); }

  /* Badges */
  .pml-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.03em;
    border: 1px solid transparent;
    white-space: nowrap;
  }
  .pml-badge-retainer  { background: #f0fdf4; color: #14532d; border-color: #bbf7d0; }
  .pml-badge-one-time  { background: #eff6ff; color: #1e3a5f; border-color: #bfdbfe; }
  .pml-badge-default   { background: var(--surface); color: var(--text-secondary); border-color: var(--border); }

  .pml-priority-high   { background: #fff1f2; color: #881337; border-color: #fecdd3; }
  .pml-priority-medium { background: #fff7ed; color: #7c2d12; border-color: #fed7aa; }
  .pml-priority-low    { background: #f0fdf4; color: #14532d; border-color: #bbf7d0; }

  .pml-stage-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 500;
    background: var(--surface);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    white-space: nowrap;
  }

  /* Days in stage */
  .pml-days {
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    color: var(--text-muted);
  }
  .pml-days.warn { color: #d97706; font-weight: 500; }
  .pml-days.danger { color: var(--danger); font-weight: 600; }

  /* PM select */
  .pml-pm-wrap {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    min-width: 0;
  }
  .pml-pm-select {
    flex: 1;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 7px;
    color: var(--text-secondary);
    font-family: 'Instrument Sans', sans-serif;
    font-size: 12.5px;
    padding: 4px 8px;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    min-width: 0;
    transition: border-color 0.13s;
  }
  .pml-pm-select:hover { border-color: var(--border-strong); }
  .pml-pm-select:focus { outline: none; border-color: var(--accent); }
  .pml-pm-select:disabled { opacity: 0.5; cursor: wait; }
  .pml-pm-select option { background: #fff; color: #0f1923; }

  /* Email log */
  .pml-email-date {
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-primary);
    font-family: 'DM Mono', monospace;
  }
  .pml-email-date.overdue { color: var(--danger); }
  .pml-email-time {
    font-size: 11px;
    color: var(--text-muted);
    font-family: 'DM Mono', monospace;
  }
  .pml-email-keyword {
    font-size: 11px;
    color: var(--accent);
    font-style: italic;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
  .pml-email-overdue-label {
    font-size: 10.5px;
    color: var(--danger);
    font-weight: 600;
    background: var(--danger-light);
    padding: 1px 6px;
    border-radius: 10px;
    display: inline-block;
  }
  .pml-no-log {
    font-size: 12.5px;
    color: var(--text-muted);
    font-style: italic;
  }

  /* Action menu */
  .pml-action-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 7px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.13s;
    flex-shrink: 0;
  }
  .pml-action-btn:hover {
    background: var(--surface-hover);
    border-color: var(--border-strong);
    color: var(--text-secondary);
  }

  .pml-menu {
    position: absolute;
    top: calc(100% - 8px);
    right: 16px;
    background: white;
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.06);
    z-index: 9999;
    min-width: 176px;
    overflow: hidden;
  }
  .pml-menu-item {
    width: 100%;
    padding: 10px 14px;
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: 'Instrument Sans', sans-serif;
    font-size: 13px;
    color: var(--text-secondary);
    transition: background 0.1s;
    box-sizing: border-box;
  }
  .pml-menu-item:hover { background: var(--surface); color: var(--text-primary); }
  .pml-menu-item.danger:hover { background: var(--danger-light); color: var(--danger); }
  .pml-menu-divider { height: 1px; background: var(--border); margin: 3px 0; }

  /* Checkbox */
  .pml-checkbox {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--accent);
  }

  /* Empty */
  .pml-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 72px 24px;
    color: var(--text-muted);
    gap: 10px;
    font-size: 13.5px;
  }

  /* ── Pagination ── */
  .pml-pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-top: 1px solid var(--border);
    background: var(--surface);
    border-radius: 0 0 12px 12px;
  }
  .pml-pagination-center {
    justify-content: center;
  }
  .pml-page-info {
    font-size: 12.5px;
    color: var(--text-muted);
    font-family: 'DM Mono', monospace;
    min-width: 90px;
    text-align: center;
  }
  .pml-page-count {
    font-size: 12.5px;
    color: var(--text-muted);
  }
  .pml-page-btn {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 7px;
    background: white;
    color: var(--text-secondary);
    font-family: 'Instrument Sans', sans-serif;
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s;
  }
  .pml-page-btn:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--border-strong);
  }
  .pml-page-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .pml-see-all-btn {
    padding: 6px 14px;
    border: 1px solid var(--accent);
    border-radius: 7px;
    background: white;
    color: var(--accent);
    font-family: 'Instrument Sans', sans-serif;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s;
  }
  .pml-see-all-btn:hover {
    background: var(--accent);
    color: white;
  }
`;

export interface PMListViewProps {
  paginatedProjects: any[];
  filteredProjects: any[];
  selectedProjects: Set<string>;
  lastEmailLogDateFilter: string;
  setLastEmailLogDateFilter: React.Dispatch<React.SetStateAction<string>>;
  lastEmailLogs: Record<string, { date: string; pmName?: string; notes?: string; pmId?: string }>;
  users: any[];
  setProjects: React.Dispatch<React.SetStateAction<any[]>>;
  reassigningPMFor: string | null;
  setReassigningPMFor: React.Dispatch<React.SetStateAction<string | null>>;
  actionMenuOpen: string | null;
  setActionMenuOpen: React.Dispatch<React.SetStateAction<string | null>>;
  totalPages: number;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  showAll: boolean;
  setShowAll: React.Dispatch<React.SetStateAction<boolean>>;
  getEmailLogKeyword: (notes?: string) => string;
  onSelectAll: (e: React.MouseEvent) => void;
  onToggleSelect: (projectId: string, e: React.MouseEvent) => void;
  onBulkArchive: () => void;
  onLogEmail: (project: any, e: React.MouseEvent) => void;
  onComplete: (projectId: string, e: React.MouseEvent) => void;
  onArchive: (projectId: string, e: React.MouseEvent) => void;
}

const PMListView: React.FC<PMListViewProps> = ({
  paginatedProjects, filteredProjects, selectedProjects,
  lastEmailLogDateFilter, setLastEmailLogDateFilter,
  lastEmailLogs, users, setProjects,
  reassigningPMFor, setReassigningPMFor,
  actionMenuOpen, setActionMenuOpen,
  totalPages, currentPage, setCurrentPage,
  showAll, setShowAll,
  getEmailLogKeyword, onSelectAll, onToggleSelect,
  onBulkArchive, onLogEmail, onComplete, onArchive,
}) => {
  const navigate = useNavigate();

  const getClientTypeCls = (type?: string) => {
    if (!type) return 'pml-badge pml-badge-default';
    const t = type.toLowerCase();
    if (t.includes('retainer')) return 'pml-badge pml-badge-retainer';
    if (t.includes('one')) return 'pml-badge pml-badge-one-time';
    return 'pml-badge pml-badge-default';
  };

  const getPriorityCls = (p?: string) => {
    const map: Record<string, string> = { high: 'pml-priority-high', medium: 'pml-priority-medium', low: 'pml-priority-low' };
    return `pml-badge ${map[p?.toLowerCase() || ''] || 'pml-badge-default'}`;
  };

  const getDaysCls = (days: number) => {
    if (days >= 14) return 'pml-days danger';
    if (days >= 7) return 'pml-days warn';
    return 'pml-days';
  };

  return (
    <>
      <style>{STYLES}</style>
      <div className="pml-wrap">

        {/* Bulk selection bar */}
        {selectedProjects.size > 0 && (
          <div className="pml-bulk-bar">
            <span className="pml-bulk-label">
              {selectedProjects.size} project{selectedProjects.size === 1 ? '' : 's'} selected
            </span>
            <button className="pml-bulk-btn" onClick={onBulkArchive}>
              <FaArchive style={{ fontSize: 11 }} />
              Archive Selected
            </button>
          </div>
        )}

        {/* Header */}
        <div className="pml-head">
          <div className="pml-head-cell center">
            <input
              type="checkbox"
              className="pml-checkbox"
              checked={filteredProjects.length > 0 && selectedProjects.size === filteredProjects.length}
              onChange={() => {}}
              onClick={onSelectAll}
            />
          </div>
          <div className="pml-head-cell">Project Name</div>
          <div className="pml-head-cell">Client Type</div>
          <div className="pml-head-cell">Priority</div>
          <div className="pml-head-cell">Stage</div>
          <div className="pml-head-cell">Days in Stage</div>
          <div className="pml-head-cell">PM</div>
          <div className="pml-head-cell filter-col">
            <span>Last Email Log</span>
            <input
              type="date"
              className="pml-date-filter"
              value={lastEmailLogDateFilter}
              onChange={(e) => setLastEmailLogDateFilter(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            {lastEmailLogDateFilter && (
              <button className="pml-clear-btn" onClick={(e) => { e.stopPropagation(); setLastEmailLogDateFilter(''); }}>
                <FaTimes style={{ fontSize: 9 }} /> Clear
              </button>
            )}
          </div>
          <div className="pml-head-cell center">Actions</div>
        </div>

        {/* Body */}
        <div className="pml-body">
          {filteredProjects.length === 0 ? (
            <div className="pml-empty">
              <FaFolder style={{ fontSize: '2rem', opacity: 0.2 }} />
              <p style={{ margin: 0 }}>No projects found matching your filters.</p>
            </div>
          ) : (
            paginatedProjects.map((project: any, i: number) => {
              const daysInStage = project.updatedAt
                ? Math.ceil((Date.now() - new Date(project.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
                : 0;

              const lastLog = lastEmailLogs[project.id];
              const logDate = lastLog ? new Date(lastLog.date) : null;
              const daysSinceLog = logDate ? Math.floor((Date.now() - logDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
              const isOverdue = daysSinceLog !== null && daysSinceLog >= 7;
              const keyword = lastLog ? getEmailLogKeyword(lastLog.notes) : null;

              return (
                <div
                  key={project.id}
                  className={`pml-row${selectedProjects.has(project.id) ? ' selected' : ''}`}
                  style={{ animationDelay: `${Math.min(i * 0.02, 0.3)}s` }}
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  {/* Checkbox */}
                  <div className="pml-cell center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="pml-checkbox"
                      checked={selectedProjects.has(project.id)}
                      onChange={() => {}}
                      onClick={(e) => onToggleSelect(project.id, e)}
                    />
                  </div>

                  {/* Project name */}
                  <div className="pml-cell">
                    <span className="pml-project-name">{project.clientName}</span>
                  </div>

                  {/* Client type */}
                  <div className="pml-cell">
                    <span className={getClientTypeCls(project.clientType)}>{project.clientType || '—'}</span>
                  </div>

                  {/* Priority */}
                  <div className="pml-cell">
                    <span className={getPriorityCls(project.priority)}>{project.priority || '—'}</span>
                  </div>

                  {/* Stage */}
                  <div className="pml-cell">
                    <span className="pml-stage-badge">{project.stage || '—'}</span>
                  </div>

                  {/* Days in stage */}
                  <div className="pml-cell">
                    <span className={getDaysCls(daysInStage)}>
                      {daysInStage}d
                    </span>
                  </div>

                  {/* PM reassign */}
                  <div className="pml-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="pml-pm-wrap">
                      <FaUser style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }} />
                      <select
                        className="pml-pm-select"
                        value={project.pmId || project.pm?.id || ''}
                        disabled={reassigningPMFor === project.id}
                        onChange={async (e) => {
                          const newPmId = e.target.value;
                          if (!newPmId || newPmId === (project.pmId || project.pm?.id)) return;
                          setReassigningPMFor(project.id);
                          try {
                            await projectService.update(project.id, { pmId: newPmId });
                            const newPM = users.find((u: any) => u.id === newPmId);
                            setProjects((prev) =>
                              prev.map((p) => p.id === project.id ? { ...p, pmId: newPmId, pm: newPM || p.pm } : p)
                            );
                          } catch (err: any) {
                            alert(err.response?.data?.message || err.message || 'Failed to reassign PM');
                          } finally {
                            setReassigningPMFor(null);
                          }
                        }}
                      >
                        <option value="">Unassigned</option>
                        {users
                          .filter((u: any) => u.role === 'Project Manager')
                          .map((pm: any) => (
                            <option key={pm.id} value={pm.id}>{pm.name}</option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Last email log */}
                  <div className="pml-cell">
                    {logDate ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                        <span className={`pml-email-date${isOverdue ? ' overdue' : ''}`}>
                          {logDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="pml-email-time">
                          {logDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {keyword && <span className="pml-email-keyword">"{keyword}"</span>}
                        {isOverdue && (
                          <span className="pml-email-overdue-label">{daysSinceLog}d ago</span>
                        )}
                      </div>
                    ) : (
                      <span className="pml-no-log">No logs</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pml-cell center" onClick={(e) => e.stopPropagation()} style={{ overflow: 'visible' }}>
                    <button
                      className="pml-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionMenuOpen(actionMenuOpen === project.id ? null : project.id);
                      }}
                    >
                      <FaEllipsisV style={{ fontSize: 12 }} />
                    </button>
                    {actionMenuOpen === project.id && (
                      <div className="pml-menu" onClick={(e) => e.stopPropagation()}>
                        <button className="pml-menu-item" onClick={(e) => { setActionMenuOpen(null); navigate(`/project/${project.id}`); }}>
                          <FaEye style={{ fontSize: 12, color: '#3b82f6' }} /> View
                        </button>
                        <button className="pml-menu-item" onClick={(e) => { setActionMenuOpen(null); onLogEmail(project, e); }}>
                          <FaEnvelope style={{ fontSize: 12, color: '#6366f1' }} /> Log Email
                        </button>
                        <button className="pml-menu-item" onClick={(e) => { setActionMenuOpen(null); onComplete(project.id, e); }}>
                          <FaCheckCircle style={{ fontSize: 12, color: '#16a34a' }} /> Mark Complete
                        </button>
                        <div className="pml-menu-divider" />
                        <button className="pml-menu-item danger" onClick={(e) => { setActionMenuOpen(null); onArchive(project.id, e); }}>
                          <FaArchive style={{ fontSize: 12 }} /> Archive
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {filteredProjects.length > ITEMS_PER_PAGE && !showAll && (
          <div className="pml-pagination">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="pml-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ← Prev
              </button>
              <span className="pml-page-info">
                {currentPage} / {totalPages}
              </span>
              <button
                className="pml-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next →
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="pml-page-count">
                {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredProjects.length)} of {filteredProjects.length}
              </span>
              <button className="pml-see-all-btn" onClick={() => setShowAll(true)}>
                See All
              </button>
            </div>
          </div>
        )}

        {showAll && filteredProjects.length > ITEMS_PER_PAGE && (
          <div className="pml-pagination" style={{ justifyContent: 'center', gap: 12 }}>
            <span className="pml-page-count">Showing all {filteredProjects.length} projects</span>
            <button
              className="pml-see-all-btn"
              onClick={() => { setShowAll(false); setCurrentPage(1); }}
            >
              Show Less
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default PMListView;