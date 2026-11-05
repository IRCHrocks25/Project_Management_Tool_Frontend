import React, { useMemo, useRef, useState } from 'react';
import {
  FaAngleDoubleDown,
  FaAngleDoubleUp,
  FaCaretDown,
  FaEllipsisH,
  FaEyeSlash,
  FaFileExcel,
  FaFilter,
  FaLayerGroup,
  FaPlus,
  FaRegUserCircle,
  FaSearch,
  FaSort,
  FaTimes,
} from 'react-icons/fa';
import UserAvatar from '../UserAvatar';
import { BoardPerson, ProjectBoard } from '../../services/board.service';
import Popover from './Popover';
import { FilterCheck, SearchField } from './cells';
import {
  activeFilterCount,
  BoardColumnDef,
  BoardFilters,
  BoardPrefs,
  BoardSort,
  GROUP_BY_OPTIONS,
  NO_FILTERS,
  PRIORITIES,
  SORT_OPTIONS,
  stageLabel,
  stagesForBoard,
} from './boardConfig';

type MenuKey = 'new' | 'person' | 'filter' | 'sort' | 'hide' | 'group' | 'more';

interface BoardToolbarProps {
  view: 'table' | 'kanban';
  board: ProjectBoard;
  columns: BoardColumnDef[];
  filters: BoardFilters;
  sort: BoardSort | null;
  prefs: BoardPrefs;
  allCollapsed: boolean;
  onFilters: (filters: BoardFilters) => void;
  onSort: (sort: BoardSort | null) => void;
  onPrefs: (patch: Partial<BoardPrefs>) => void;
  onNewTask: () => void;
  onNewGroup: () => void;
  onExport: () => void;
  onToggleAllGroups: () => void;
}

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

const BoardToolbar: React.FC<BoardToolbarProps> = ({ view, board, columns, filters, sort, prefs, allCollapsed, onFilters, onSort, onPrefs, onNewTask, onNewGroup, onExport, onToggleAllGroups }) => {
  const [menu, setMenu] = useState<MenuKey | null>(null);
  const [searching, setSearching] = useState(false);
  const anchor = useRef<HTMLElement | null>(null);

  const open = (key: MenuKey) => (e: React.MouseEvent<HTMLElement>) => {
    anchor.current = e.currentTarget;
    setMenu(menu === key ? null : key);
  };
  const close = () => setMenu(null);

  const owners = useMemo(() => {
    const people = new Map<string, BoardPerson>();
    board.tasks.forEach((t) => t.owners.forEach((o) => people.set(o.id, o)));
    return Array.from(people.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [board.tasks]);
  const departments = useMemo(() => Array.from(new Set(board.tasks.map((t) => t.type))).sort(), [board.tasks]);
  const stages = stagesForBoard(board.tasks);
  const filterCount = activeFilterCount(filters);
  const sortOptions = [
    ...SORT_OPTIONS,
    ...columns.filter((c) => c.custom && c.custom.type !== 'people').map((c) => ({ key: c.id, label: c.label })),
  ];

  return (
    <div className="bv-toolbar">
      {view === 'table' && (
        <div className="bv-split">
          <button type="button" className="bv-btn bv-btn-primary" onClick={onNewTask}>New task</button>
          <button type="button" className="bv-btn bv-btn-primary" aria-label="More ways to add" onClick={open('new')}><FaCaretDown /></button>
        </div>
      )}

      {searching || filters.query ? (
        <div className="bv-tool-search">
          <SearchField autoFocus value={filters.query} placeholder="Search tasks" onChange={(query) => onFilters({ ...filters, query })} />
          <button type="button" aria-label="Close search" onClick={() => { onFilters({ ...filters, query: '' }); setSearching(false); }}><FaTimes /></button>
        </div>
      ) : (
        <button type="button" className="bv-tool" onClick={() => setSearching(true)}><FaSearch /> Search</button>
      )}

      <button type="button" className={`bv-tool${filters.owners.length ? ' on' : ''}`} onClick={open('person')}>
        <FaRegUserCircle /> Person{filters.owners.length ? ` / ${filters.owners.length}` : ''}
      </button>
      <button type="button" className={`bv-tool${filterCount ? ' on' : ''}`} onClick={open('filter')}>
        <FaFilter /> Filter{filterCount ? ` / ${filterCount}` : ''}
      </button>
      {view === 'table' && (
        <button type="button" className={`bv-tool${sort ? ' on' : ''}`} onClick={open('sort')}>
          <FaSort /> Sort{sort ? ' / 1' : ''}
        </button>
      )}
      <button type="button" className={`bv-tool${prefs.hidden.length ? ' on' : ''}`} onClick={open('hide')}>
        <FaEyeSlash /> Hide{prefs.hidden.length ? ` / ${prefs.hidden.length}` : ''}
      </button>
      {view === 'table' && (
        <button type="button" className={`bv-tool${prefs.groupBy !== 'deliverable' ? ' on' : ''}`} onClick={open('group')}>
          <FaLayerGroup /> Group by
        </button>
      )}
      <button type="button" className="bv-tool icon" aria-label="More options" onClick={open('more')}><FaEllipsisH /></button>

      {view === 'table' && (
        <button type="button" className="bv-tool icon bv-tool-end" aria-label={allCollapsed ? 'Expand every group' : 'Collapse every group'} title={allCollapsed ? 'Expand every group' : 'Collapse every group'} onClick={onToggleAllGroups}>
          {allCollapsed ? <FaAngleDoubleDown /> : <FaAngleDoubleUp />}
        </button>
      )}

      {menu === 'new' && (
        <Popover anchor={anchor.current} onClose={close} width={200}>
          <button type="button" className="bv-menu-item" onClick={() => { close(); onNewGroup(); }}><FaPlus /> New group</button>
        </Popover>
      )}

      {menu === 'person' && (
        <Popover anchor={anchor.current} onClose={close} width={260}>
          <div className="bv-menu-title">Show tasks owned by</div>
          {owners.length === 0 && <div className="bv-menu-empty">No one owns a task on this board yet</div>}
          {owners.map((person) => (
            <FilterCheck
              key={person.id}
              checked={filters.owners.includes(person.id)}
              label={<span className="bv-person-line"><UserAvatar name={person.name} avatarUrl={person.avatarUrl} size={22} /> {person.name}</span>}
              onToggle={() => onFilters({ ...filters, owners: toggle(filters.owners, person.id) })}
            />
          ))}
        </Popover>
      )}

      {menu === 'filter' && (
        <Popover anchor={anchor.current} onClose={close} width={560}>
          <div className="bv-filter-head">
            <b>Filter tasks</b>
            <button type="button" className="bv-link-btn" onClick={() => onFilters({ ...NO_FILTERS, query: filters.query, owners: filters.owners })}>Clear all</button>
          </div>
          <div className="bv-filter-grid">
            <div>
              <div className="bv-menu-title">Status</div>
              {stages.map((id) => (
                <FilterCheck key={id} checked={filters.stages.includes(id)} label={stageLabel(id)} onToggle={() => onFilters({ ...filters, stages: toggle(filters.stages, id) })} />
              ))}
            </div>
            <div>
              <div className="bv-menu-title">Priority</div>
              {PRIORITIES.map((p) => (
                <FilterCheck key={p} checked={filters.priorities.includes(p)} label={p} onToggle={() => onFilters({ ...filters, priorities: toggle(filters.priorities, p) })} />
              ))}
              <div className="bv-menu-title">Due</div>
              {([['overdue', 'Overdue'], ['week', 'Next 7 days'], ['none', 'No date']] as const).map(([key, label]) => (
                <FilterCheck key={key} checked={filters.due === key} label={label} onToggle={() => onFilters({ ...filters, due: filters.due === key ? '' : key })} />
              ))}
            </div>
            <div>
              <div className="bv-menu-title">Department</div>
              {departments.map((d) => (
                <FilterCheck key={d} checked={filters.departments.includes(d)} label={d} onToggle={() => onFilters({ ...filters, departments: toggle(filters.departments, d) })} />
              ))}
            </div>
          </div>
        </Popover>
      )}

      {menu === 'sort' && (
        <Popover anchor={anchor.current} onClose={close} width={280}>
          <div className="bv-menu-title">Sort tasks in each group by</div>
          <div className="bv-sort-form">
            <select
              aria-label="Sort by"
              value={sort?.key || ''}
              onChange={(e) => onSort(e.target.value ? { key: e.target.value, direction: sort?.direction || 'asc' } : null)}
            >
              <option value="">No sorting</option>
              {sortOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <select
              aria-label="Sort direction"
              disabled={!sort}
              value={sort?.direction || 'asc'}
              onChange={(e) => sort && onSort({ key: sort.key, direction: e.target.value as 'asc' | 'desc' })}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </Popover>
      )}

      {menu === 'hide' && (
        <Popover anchor={anchor.current} onClose={close} width={240}>
          <div className="bv-menu-title">Show these columns</div>
          {columns.map((column) => (
            <FilterCheck
              key={column.id}
              checked={!prefs.hidden.includes(column.id)}
              label={column.label}
              onToggle={() => onPrefs({ hidden: toggle(prefs.hidden, column.id) })}
            />
          ))}
        </Popover>
      )}

      {menu === 'group' && (
        <Popover anchor={anchor.current} onClose={close} width={200}>
          <div className="bv-menu-title">Group tasks by</div>
          {GROUP_BY_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`bv-menu-item${prefs.groupBy === option.key ? ' selected' : ''}`}
              onClick={() => { close(); onPrefs({ groupBy: option.key, collapsed: [] }); }}
            >
              {option.label}
            </button>
          ))}
        </Popover>
      )}

      {menu === 'more' && (
        <Popover anchor={anchor.current} onClose={close} width={210}>
          <button type="button" className="bv-menu-item" onClick={() => { close(); onExport(); }}><FaFileExcel /> Export to Excel</button>
        </Popover>
      )}
    </div>
  );
};

export default BoardToolbar;
