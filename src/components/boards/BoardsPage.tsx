import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FaAngleDoubleLeft, FaAngleDoubleRight, FaCaretDown, FaColumns, FaExternalLinkAlt, FaTable } from 'react-icons/fa';
import { authService } from '../../services/auth.service';
import { boardService, BoardPerson, BoardSummary, BoardTaskRow } from '../../services/board.service';
import UserAvatar from '../UserAvatar';
import Popover from './Popover';
import { BoardContext, BoardContextValue, SearchField } from './cells';
import BoardTable from './BoardTable';
import BoardKanban from './BoardKanban';
import BoardToolbar from './BoardToolbar';
import BoardSwitch from './BoardSwitch';
import TaskPanel, { PanelTab } from './TaskPanel';
import { useBoard } from './useBoard';
import { useTaskOverlays } from './useTaskOverlays';
import {
  BoardFilters,
  BoardPrefs,
  BoardSort,
  buildSections,
  filterTasks,
  loadPrefs,
  NO_FILTERS,
  orderedColumns,
  savePrefs,
  sortTasks,
  stageLabel,
} from './boardConfig';
import './boards.css';

const LAST_BOARD_KEY = 'boards:last';

const readLastBoard = (): string | null => {
  try {
    return localStorage.getItem(LAST_BOARD_KEY);
  } catch {
    return null;
  }
};

const rememberBoard = (id: string) => {
  try {
    localStorage.setItem(LAST_BOARD_KEY, id);
  } catch {
    // Only a convenience.
  }
};

const NewGroupPrompt: React.FC<{ anchor: HTMLElement | null; onClose: () => void; onSave: (name: string) => void }> = ({ anchor, onClose, onSave }) => {
  const [name, setName] = useState('');
  return (
    <Popover anchor={anchor} onClose={onClose} width={260}>
      <form
        className="bv-col-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim());
          onClose();
        }}
      >
        <label>
          Group name
          <input autoFocus maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" className="bv-btn bv-btn-primary" disabled={!name.trim()}>Add group</button>
      </form>
    </Popover>
  );
};

const BoardsPage: React.FC = () => {
  const { projectId, taskId } = useParams<{ projectId?: string; taskId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = authService.getUser();
  const canManage = !!user && (user.role === 'Project Manager' || user.role === 'FOUNDER/CEO' || !!user.isTeamLead || !!user.isHeadPM);

  const view: 'table' | 'kanban' = searchParams.get('view') === 'kanban' ? 'kanban' : 'table';
  const tab: PanelTab = (['updates', 'files', 'activity'] as const).find((t) => t === searchParams.get('tab')) || 'updates';

  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [listQuery, setListQuery] = useState('');
  const [listCollapsed, setListCollapsed] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [filters, setFilters] = useState<BoardFilters>(NO_FILTERS);
  const [sort, setSort] = useState<BoardSort | null>(null);
  const [prefs, setPrefs] = useState<BoardPrefs>(() => (projectId ? loadPrefs(projectId) : loadPrefs('')));
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [groupPromptAnchor, setGroupPromptAnchor] = useState<HTMLElement | null>(null);
  const [addTaskFocus, setAddTaskFocus] = useState(0);
  const switcherRef = useRef<HTMLButtonElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const actions = useBoard(projectId);
  const { board, loading, error } = actions;
  const { requestMove, transferTask, openFullDetails, overlays } = useTaskOverlays(actions, allUsers);

  useEffect(() => {
    boardService.list().then(setBoards).catch(() => setBoards([]));
    authService.getAllUsers().then((u) => setAllUsers(u || [])).catch(() => setAllUsers([]));
  }, []);

  // /boards opens the board you were last on.
  useEffect(() => {
    if (projectId || !boards || boards.length === 0) return;
    const last = readLastBoard();
    const target = boards.find((b) => b.id === last) || boards[0];
    navigate(`/boards/${target.id}`, { replace: true });
  }, [projectId, boards, navigate]);

  useEffect(() => {
    if (!projectId) return;
    rememberBoard(projectId);
    setPrefs(loadPrefs(projectId));
    setFilters(NO_FILTERS);
    setSort(null);
  }, [projectId]);

  const updatePrefs = useCallback(
    (patch: Partial<BoardPrefs>) => {
      setPrefs((current) => {
        const next = { ...current, ...patch };
        if (projectId) savePrefs(projectId, next);
        return next;
      });
    },
    [projectId],
  );

  const people: BoardPerson[] = useMemo(
    () => allUsers.map((u) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl ?? null })).sort((a, b) => a.name.localeCompare(b.name)),
    [allUsers],
  );

  const openTask = useCallback(
    (task: BoardTaskRow, nextTab?: PanelTab) => {
      const params = new URLSearchParams(searchParams);
      if (nextTab) params.set('tab', nextTab);
      else params.delete('tab');
      navigate(`/boards/${task.projectId}/${task.id}?${params.toString()}`);
    },
    [navigate, searchParams],
  );

  const closeTask = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete('tab');
    navigate(`/boards/${projectId}?${params.toString()}`);
  }, [navigate, projectId, searchParams]);

  const setPanelTab = (next: PanelTab) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  const setView = (next: 'table' | 'kanban') => {
    const params = new URLSearchParams(searchParams);
    if (next === 'kanban') params.set('view', 'kanban');
    else params.delete('view');
    setSearchParams(params, { replace: true });
  };

  const context: BoardContextValue = useMemo(
    () => ({ actions, people, openTask, transferTask, requestMove }),
    [actions, people, openTask, transferTask, requestMove],
  );

  const columns = useMemo(() => orderedColumns(board?.columns || [], prefs), [board?.columns, prefs]);
  const shownTasks = useMemo(() => (board ? sortTasks(filterTasks(board.tasks, filters), sort) : []), [board, filters, sort]);
  const sections = useMemo(() => (board ? buildSections(board, shownTasks, prefs.groupBy) : []), [board, shownTasks, prefs.groupBy]);
  const openedTask = board && taskId ? board.tasks.find((t) => t.id === taskId) || null : null;
  const filtered = !!filters.query || filters.owners.length > 0 || filters.stages.length > 0 || filters.priorities.length > 0 || filters.departments.length > 0 || !!filters.due;
  const allCollapsed = sections.length > 0 && sections.every((s) => prefs.collapsed.includes(s.id));

  const exportBoard = async () => {
    if (!board) return;
    const XLSX = await import('xlsx');
    const rows = shownTasks.map((t) => {
      const row: Record<string, unknown> = {
        Task: t.title,
        Group: board.groups.find((g) => g.id === (t.deliverableId || '__unassigned__'))?.name || '',
        Owner: t.owners.map((o) => o.name).join(', '),
        Status: stageLabel(t.stageId),
        'Start date': t.startDate || '',
        'Due date': t.dueDate || '',
        Priority: t.priority || '',
        Notes: t.notes || '',
        Department: t.type,
        Files: t.files.length,
      };
      board.columns.forEach((c) => {
        const value = t.customFields?.[c.id];
        row[c.name] = c.type === 'people' && Array.isArray(value)
          ? value.map((id: string) => people.find((p) => p.id === id)?.name || '').join(', ')
          : value ?? '';
      });
      return row;
    });
    const workbook = XLSX.utils.book_new();
    const headers = rows.length ? Object.keys(rows[0]) : ['Task'];
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows.map((row) => headers.map((h) => row[h]))]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Tasks');
    XLSX.writeFile(workbook, `${board.project.name} tasks.xlsx`);
  };

  const listed = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    return (boards || []).filter((b) => !q || b.name.toLowerCase().includes(q));
  }, [boards, listQuery]);

  const switchList = (onChoose: () => void) => (
    <>
      <div className="bv-list-search"><SearchField value={listQuery} placeholder="Search boards" onChange={setListQuery} /></div>
      <nav className="bv-list" aria-label="Boards">
        {boards === null && <div className="bv-menu-empty">Loading…</div>}
        {boards !== null && listed.length === 0 && <div className="bv-menu-empty">No boards found</div>}
        {listed.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`bv-list-item${b.id === projectId ? ' active' : ''}`}
            aria-current={b.id === projectId ? 'page' : undefined}
            onClick={() => {
              onChoose();
              navigate(`/boards/${b.id}${view === 'kanban' ? '?view=kanban' : ''}`);
            }}
          >
            <FaTable aria-hidden />
            <span className="bv-ellipsis">{b.name}</span>
          </button>
        ))}
      </nav>
    </>
  );

  return (
    <div className="bv-page">
      <aside className={`bv-side${listCollapsed ? ' collapsed' : ''}`}>
        <div className="bv-side-head">
          {!listCollapsed && <h2>Boards</h2>}
          <button
            type="button"
            className="bv-icon-btn"
            aria-label={listCollapsed ? 'Show boards list' : 'Hide boards list'}
            title={listCollapsed ? 'Show boards list' : 'Hide boards list'}
            onClick={() => setListCollapsed(!listCollapsed)}
          >
            {listCollapsed ? <FaAngleDoubleRight /> : <FaAngleDoubleLeft />}
          </button>
        </div>
        {!listCollapsed && switchList(() => {})}
      </aside>

      <main className="bv-main">
        {!projectId && boards !== null && boards.length === 0 && (
          <div className="bv-state"><h2>No boards yet</h2><p>Each active project gets a board. Create a project to start one.</p></div>
        )}
        {projectId && loading && !board && <div className="bv-state"><p>Loading board…</p></div>}
        {projectId && error && !board && (
          <div className="bv-state">
            <h2>This board could not be opened</h2>
            <p>{error}</p>
            <button type="button" className="bv-btn" onClick={() => actions.reload()}>Try again</button>
          </div>
        )}

        {board && (
          <BoardContext.Provider value={context}>
            <header className="bv-head">
              <div className="bv-head-top">
                <button ref={switcherRef} type="button" className="bv-board-title" aria-label={`${board.project.name}: switch board`} onClick={() => setSwitcherOpen(!switcherOpen)}>
                  <h1>{board.project.name}</h1>
                  <FaCaretDown aria-hidden />
                </button>
                <div className="bv-head-meta">
                  <BoardSwitch active="boards" role={user?.role} />
                  {board.project.pm && (
                    <span className="bv-pm" title={`PM: ${board.project.pm.name}`}>
                      <UserAvatar name={board.project.pm.name} avatarUrl={board.project.pm.avatarUrl} size={28} />
                      <span>{board.project.pm.name}</span>
                    </span>
                  )}
                  <button type="button" className="bv-btn" onClick={() => navigate(`/project/${board.project.id}`)}>
                    Project details <FaExternalLinkAlt aria-hidden />
                  </button>
                </div>
              </div>
              <div className="bv-views" role="tablist" aria-label="Board views">
                <button type="button" role="tab" aria-selected={view === 'table'} className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}><FaTable aria-hidden /> Table</button>
                <button type="button" role="tab" aria-selected={view === 'kanban'} className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')}><FaColumns aria-hidden /> Kanban</button>
              </div>
              <div ref={toolbarRef}>
                <BoardToolbar
                  view={view}
                  board={board}
                  columns={columns}
                  filters={filters}
                  sort={sort}
                  prefs={prefs}
                  allCollapsed={allCollapsed}
                  onFilters={setFilters}
                  onSort={setSort}
                  onPrefs={updatePrefs}
                  onNewTask={() => {
                    updatePrefs({ collapsed: prefs.collapsed.filter((id) => id !== sections[0]?.id) });
                    setAddTaskFocus((n) => n + 1);
                  }}
                  onNewGroup={() => setGroupPromptAnchor(toolbarRef.current)}
                  onExport={exportBoard}
                  onToggleAllGroups={() => updatePrefs({ collapsed: allCollapsed ? [] : sections.map((s) => s.id) })}
                />
              </div>
            </header>

            {filtered && shownTasks.length === 0 ? (
              <div className="bv-state">
                <h2>No tasks match</h2>
                <button type="button" className="bv-btn" onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>
              </div>
            ) : view === 'table' ? (
              <BoardTable
                sections={sections}
                columns={columns}
                prefs={prefs}
                sort={sort}
                canManage={canManage}
                addTaskFocus={addTaskFocus}
                onPrefs={updatePrefs}
                onSort={setSort}
                onAddGroup={() => setGroupPromptAnchor(toolbarRef.current)}
              />
            ) : (
              <BoardKanban tasks={shownTasks} hidden={prefs.hidden} />
            )}

            {taskId && !openedTask && !loading && (
              <div className="bv-missing-task" role="status">
                That task isn't on this board any more.
                <button type="button" className="bv-link-btn" onClick={closeTask}>Dismiss</button>
              </div>
            )}

            {openedTask && (
              <TaskPanel
                key={openedTask.id}
                task={openedTask}
                board={board}
                columns={columns.filter((c) => !prefs.hidden.includes(c.id))}
                tab={tab}
                allUsers={allUsers}
                onTab={setPanelTab}
                onClose={closeTask}
                onOpenFullDetails={openFullDetails}
              />
            )}

            {groupPromptAnchor && (
              <NewGroupPrompt anchor={groupPromptAnchor} onClose={() => setGroupPromptAnchor(null)} onSave={actions.addGroup} />
            )}
          </BoardContext.Provider>
        )}
      </main>

      {switcherOpen && (
        <Popover anchor={switcherRef.current} onClose={() => setSwitcherOpen(false)} width={300}>
          {switchList(() => setSwitcherOpen(false))}
        </Popover>
      )}

      {overlays}
    </div>
  );
};

export default BoardsPage;
