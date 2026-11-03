import React from 'react';
import { FaSearch, FaArrowRight, FaTimes } from 'react-icons/fa';

interface PMOverviewSearchResultsProps {
  searchTerm: string;
  /** Projects already filtered by the dashboard's search + priority/client-type filters */
  matchingProjects: any[];
  hasOtherFilters: boolean;
  getProjectPmName: (projectId: string) => string;
  onOpenProject: (projectId: string) => void;
  onShowAllInList: () => void;
  onClearSearch: () => void;
}

const MAX_RESULTS = 8;

const STYLES = `
  .pmos-wrap {
    margin-bottom: 2rem;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    font-family: 'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    overflow: hidden;
  }
  .pmos-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 14px 20px;
    border-bottom: 1px solid #f1f5f9;
  }
  .pmos-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: #1e293b;
  }
  .pmos-count { font-weight: 500; color: #64748b; }
  .pmos-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    background: #ffffff;
    color: #475569;
    font: inherit;
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
  }
  .pmos-btn:hover { background: #f8fafc; border-color: #cbd5e1; }
  .pmos-btn.primary { color: #2563eb; border-color: #bfdbfe; }
  .pmos-btn:focus-visible, .pmos-row:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .pmos-list { list-style: none; margin: 0; padding: 0; }
  .pmos-row {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 20px;
    border: none;
    border-bottom: 1px solid #f1f5f9;
    background: #ffffff;
    text-align: left;
    font: inherit;
    cursor: pointer;
    transition: background 0.1s;
  }
  .pmos-list li:last-child .pmos-row { border-bottom: none; }
  .pmos-row:hover { background: #f8fafc; }
  .pmos-name { font-size: 13.5px; font-weight: 600; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pmos-meta { font-size: 12.5px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pmos-arrow { color: #94a3b8; font-size: 11px; }
  .pmos-more { padding: 10px 20px; font-size: 12.5px; color: #64748b; background: #f8fafc; border-top: 1px solid #f1f5f9; }
  .pmos-empty { padding: 36px 20px; text-align: center; color: #64748b; font-size: 13.5px; }
  .pmos-empty strong { display: block; color: #1e293b; font-size: 14px; margin-bottom: 4px; }
  @media (max-width: 768px) {
    .pmos-row { grid-template-columns: minmax(0, 1fr) auto; }
    .pmos-row .pmos-meta.hide-sm { display: none; }
  }
`;

const PMOverviewSearchResults: React.FC<PMOverviewSearchResultsProps> = ({
  searchTerm,
  matchingProjects,
  hasOtherFilters,
  getProjectPmName,
  onOpenProject,
  onShowAllInList,
  onClearSearch,
}) => {
  const term = searchTerm.trim();
  const shown = matchingProjects.slice(0, MAX_RESULTS);

  return (
    <section className="pmos-wrap" aria-label="Search results">
      <style>{STYLES}</style>
      <div className="pmos-head">
        <h2 className="pmos-title">
          <FaSearch style={{ color: '#94a3b8', fontSize: 13 }} />
          Projects matching “{term}”
          <span className="pmos-count" aria-live="polite">· {matchingProjects.length}</span>
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {matchingProjects.length > 0 && (
            <button type="button" className="pmos-btn primary" onClick={onShowAllInList}>
              Open in List <FaArrowRight style={{ fontSize: 10 }} />
            </button>
          )}
          <button type="button" className="pmos-btn" onClick={onClearSearch}>
            <FaTimes style={{ fontSize: 10 }} /> Clear search
          </button>
        </div>
      </div>

      {matchingProjects.length === 0 ? (
        <div className="pmos-empty">
          <strong>No projects match “{term}”</strong>
          {hasOtherFilters
            ? 'Try a different name, or reset the priority / client type filters.'
            : 'Try a different client or project name.'}
        </div>
      ) : (
        <>
          <ul className="pmos-list">
            {shown.map((p: any) => {
              const pmName = getProjectPmName(p.id);
              return (
                <li key={p.id}>
                  <button type="button" className="pmos-row" onClick={() => onOpenProject(p.id)}>
                    <span className="pmos-name">{p.clientName || 'Untitled project'}</span>
                    <span className="pmos-meta">{p.stage || '—'}</span>
                    <span className="pmos-meta hide-sm">{pmName ? `PM: ${pmName}` : 'No PM'}</span>
                    <FaArrowRight className="pmos-arrow" />
                  </button>
                </li>
              );
            })}
          </ul>
          {matchingProjects.length > MAX_RESULTS && (
            <div className="pmos-more">
              Showing {MAX_RESULTS} of {matchingProjects.length}. Use “Open in List” to see them all.
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default PMOverviewSearchResults;
