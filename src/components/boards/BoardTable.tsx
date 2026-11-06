import React, { useMemo, useRef, useState } from 'react';
import {
  FaAngleDown,
  FaAngleRight,
  FaArrowDown,
  FaArrowUp,
  FaEllipsisH,
  FaEyeSlash,
  FaPen,
  FaPlus,
  FaRegComment,
  FaTimes,
  FaTrash,
} from 'react-icons/fa';
import { BoardTaskRow } from '../../services/board.service';
import ConfirmModal from '../ConfirmModal';
import Popover from './Popover';
import ColumnPicker from './ColumnPicker';
import { ColumnCell, FilterCheck, useBoardContext } from './cells';
import {
  BoardColumnDef,
  BoardPrefs,
  BoardSort,
  EMPTY_FILL,
  formatRange,
  GroupByKey,
  mostCommonType,
  PRIORITIES,
  PRIORITY_COLOR,
  STAGE_COLOR,
  stageLabel,
  STAGE_ORDER,
  TaskSection,
  UNASSIGNED_GROUP,
} from './boardConfig';

const CHECK_WIDTH = 40;
const ADD_WIDTH = 48;

interface BoardTableProps {
  sections: TaskSection[];
  columns: BoardColumnDef[];
  prefs: BoardPrefs;
  sort: BoardSort | null;
  canManage: boolean;
  addTaskFocus: number;
  onPrefs: (patch: Partial<BoardPrefs>) => void;
  onSort: (sort: BoardSort | null) => void;
  onAddGroup: () => void;
}

const newTaskContext = (section: TaskSection, groupBy: GroupByKey) => {
  const base = { type: mostCommonType(section.tasks) };
  switch (groupBy) {
    case 'deliverable': return { ...base, deliverableId: section.id === UNASSIGNED_GROUP ? null : section.id };
    case 'priority': return { ...base, priority: section.id === 'none' ? null : section.id };
    case 'owner': return { ...base, owner: section.id === 'none' ? null : section.id };
    case 'department': return { type: section.id };
    default: return base;
  }
};

const TaskName: React.FC<{ task: BoardTaskRow }> = ({ task }) => {
  const { actions, openTask } = useBoardContext();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  if (editing) {
    return (
      <input
        autoFocus
        className="bv-inline-input bv-name-input"
        value={draft}
        aria-label="Task name"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          actions.setTitle(task, draft);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(task.title);
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <>
      <button type="button" className="bv-name" title={task.title} onClick={() => openTask(task)}>
        <span className="bv-ellipsis">{task.title}</span>
      </button>
      <button
        type="button"
        className="bv-name-edit"
        aria-label={`Rename ${task.title}`}
        onClick={() => {
          setDraft(task.title);
          setEditing(true);
        }}
      >
        <FaPen />
      </button>
      <button type="button" className={`bv-updates-btn${task.updateCount ? ' has' : ''}`} aria-label={`Updates on ${task.title}: ${task.updateCount}`} onClick={() => openTask(task, 'updates')}>
        <FaRegComment />
        {task.updateCount > 0 ? <span>{task.updateCount}</span> : <FaPlus className="bv-updates-plus" />}
      </button>
    </>
  );
};

const AddTaskRow: React.FC<{ section: TaskSection; groupBy: GroupByKey; template: string; focusSignal: number }> = ({ section, groupBy, template, focusSignal }) => {
  const { actions } = useBoardContext();
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (focusSignal > 0) inputRef.current?.focus();
  }, [focusSignal]);
  const submit = () => {
    const value = title.trim();
    if (!value) return;
    setTitle('');
    actions.addTask(value, newTaskContext(section, groupBy));
  };
  return (
    <div className="bv-row bv-add-row" style={{ gridTemplateColumns: template }}>
      <div className="bv-cell bv-sticky bv-sticky-check" style={{ borderLeftColor: section.color }} />
      <div className="bv-cell bv-sticky bv-sticky-name">
        <input
          ref={inputRef}
          className="bv-add-input"
          placeholder="+ Add task"
          aria-label={`Add a task to ${section.name}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') setTitle('');
          }}
        />
      </div>
    </div>
  );
};

const StackBar: React.FC<{ parts: { key: string; color: string; count: number; label: string }[]; total: number }> = ({ parts, total }) => (
  <span className="bv-stack" role="img" aria-label={parts.filter((p) => p.count).map((p) => `${p.label}: ${p.count}`).join(', ') || 'Empty'}>
    {total === 0 && <span style={{ flex: 1, background: EMPTY_FILL }} />}
    {parts.filter((p) => p.count > 0).map((p) => (
      <span key={p.key} title={`${p.label}: ${p.count}`} style={{ flex: p.count, background: p.color }} />
    ))}
  </span>
);

const SummaryCell: React.FC<{ column: BoardColumnDef; tasks: BoardTaskRow[]; color: string }> = ({ column, tasks, color }) => {
  switch (column.id) {
    case 'status':
      return (
        <StackBar
          total={tasks.length}
          parts={[...STAGE_ORDER, 'elliot_review'].map((id) => ({
            key: id,
            color: STAGE_COLOR[id],
            label: stageLabel(id),
            count: tasks.filter((t) => t.stageId === id).length,
          }))}
        />
      );
    case 'priority':
      return (
        <StackBar
          total={tasks.length}
          parts={[
            ...PRIORITIES.map((p) => ({ key: p, color: PRIORITY_COLOR[p], label: p, count: tasks.filter((t) => t.priority === p).length })),
            { key: 'none', color: EMPTY_FILL, label: 'No priority', count: tasks.filter((t) => !t.priority).length },
          ]}
        />
      );
    case 'timeline': {
      const days = tasks.flatMap((t) => [t.startDate, t.dueDate]).filter(Boolean).sort() as string[];
      return days.length ? <span className="bv-timeline small" style={{ background: color }}>{formatRange(days[0], days[days.length - 1])}</span> : <span className="bv-timeline small empty">-</span>;
    }
    case 'files': {
      const count = tasks.reduce((sum, t) => sum + t.files.length, 0);
      return count ? <span className="bv-summary-text">{count} file{count === 1 ? '' : 's'}</span> : null;
    }
    default:
      if (column.custom?.type === 'number') {
        const total = tasks.reduce((sum, t) => sum + (Number(t.customFields?.[column.id]) || 0), 0);
        return <span className="bv-summary-text"><b>{total.toLocaleString()}</b> sum</span>;
      }
      return null;
  }
};

const ColumnHeader: React.FC<{
  column: BoardColumnDef;
  sort: BoardSort | null;
  canManage: boolean;
  onHide: () => void;
  onSort: (sort: BoardSort | null) => void;
  onResize: (width: number) => void;
  onDragStart: () => void;
  onDropOn: () => void;
}> = ({ column, sort, canManage, onHide, onSort, onResize, onDragStart, onDropOn }) => {
  const { actions } = useBoardContext();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(column.label);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const sortable = column.id !== 'notes' && column.id !== 'files' && column.id !== 'timeline' && column.id !== 'department';
  const sortKey = column.id;
  const sorted = sort?.key === sortKey ? sort.direction : null;

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = column.width;
    const move = (m: PointerEvent) => onResize(Math.max(80, Math.min(480, startWidth + m.clientX - startX)));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div
      className="bv-cell bv-head-cell"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-board-column', column.id);
        onDragStart();
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/x-board-column')) e.preventDefault();
      }}
      onDrop={(e) => {
        if (e.dataTransfer.types.includes('application/x-board-column')) {
          e.preventDefault();
          e.stopPropagation();
          onDropOn();
        }
      }}
    >
      <span className="bv-ellipsis">{column.label}</span>
      {sorted && (sorted === 'asc' ? <FaArrowUp className="bv-sort-mark" aria-label="Sorted ascending" /> : <FaArrowDown className="bv-sort-mark" aria-label="Sorted descending" />)}
      <button ref={ref} type="button" className="bv-head-menu" aria-label={`Options for ${column.label}`} onClick={() => setOpen(!open)}>
        <FaEllipsisH />
      </button>
      <span className="bv-resize" onPointerDown={startResize} aria-hidden />
      {open && (
        <Popover anchor={ref.current} onClose={() => { setOpen(false); setRenaming(false); }} width={200} align="right">
          {renaming ? (
            <form
              className="bv-col-form"
              onSubmit={(e) => {
                e.preventDefault();
                setOpen(false);
                setRenaming(false);
                actions.renameColumn(column.id, draft);
              }}
            >
              <label>
                Column name
                <input autoFocus maxLength={80} value={draft} onChange={(e) => setDraft(e.target.value)} />
              </label>
              <button type="submit" className="bv-btn bv-btn-primary">Save</button>
            </form>
          ) : (
            <>
              {sortable && (
                <>
                  <button type="button" className="bv-menu-item" onClick={() => { setOpen(false); onSort({ key: sortKey, direction: 'asc' }); }}><FaArrowUp /> Sort ascending</button>
                  <button type="button" className="bv-menu-item" onClick={() => { setOpen(false); onSort({ key: sortKey, direction: 'desc' }); }}><FaArrowDown /> Sort descending</button>
                </>
              )}
              <button type="button" className="bv-menu-item" onClick={() => { setOpen(false); onHide(); }}><FaEyeSlash /> Hide column</button>
              {column.custom && canManage && (
                <>
                  <button type="button" className="bv-menu-item" onClick={() => { setDraft(column.label); setRenaming(true); }}><FaPen /> Rename</button>
                  <button type="button" className="bv-menu-item danger" onClick={() => { setOpen(false); setConfirmDelete(true); }}><FaTrash /> Delete column</button>
                </>
              )}
            </>
          )}
        </Popover>
      )}
      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          actions.deleteColumn(column.id);
        }}
        title={`Delete "${column.label}"?`}
        message="Everything filled in under this column on this board will be deleted. This can't be undone."
        confirmText="Delete column"
        type="danger"
      />
    </div>
  );
};

const GroupMenu: React.FC<{ section: TaskSection }> = ({ section }) => {
  const { actions } = useBoardContext();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(section.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const group = section.group;
  if (!group || group.id === UNASSIGNED_GROUP) return null;
  const empty = (actions.board?.tasks || []).every((t) => t.deliverableId !== group.id);
  return (
    <>
      <button ref={ref} type="button" className="bv-group-menu" aria-label={`Options for ${section.name}`} onClick={() => setOpen(!open)}>
        <FaEllipsisH />
      </button>
      {open && (
        <Popover anchor={ref.current} onClose={() => { setOpen(false); setRenaming(false); }} width={220}>
          {renaming ? (
            <form
              className="bv-col-form"
              onSubmit={(e) => {
                e.preventDefault();
                setOpen(false);
                setRenaming(false);
                actions.renameGroup(group.id, draft);
              }}
            >
              <label>
                Group name
                <input autoFocus maxLength={120} value={draft} onChange={(e) => setDraft(e.target.value)} />
              </label>
              <button type="submit" className="bv-btn bv-btn-primary">Save</button>
            </form>
          ) : (
            <>
              <button
                type="button"
                className="bv-menu-item"
                disabled={!group.renamable}
                title={group.renamable ? undefined : 'Standard deliverables keep their name'}
                onClick={() => { setDraft(section.name); setRenaming(true); }}
              >
                <FaPen /> Rename
              </button>
              <button
                type="button"
                className="bv-menu-item danger"
                disabled={!empty}
                title={empty ? undefined : 'Move its tasks out first'}
                onClick={() => { setOpen(false); setConfirmDelete(true); }}
              >
                <FaTrash /> Delete group
              </button>
            </>
          )}
        </Popover>
      )}
      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          actions.deleteGroup(group.id);
        }}
        title={`Delete "${section.name}"?`}
        message="This removes the deliverable from the project."
        confirmText="Delete group"
        type="danger"
      />
    </>
  );
};

const BoardTable: React.FC<BoardTableProps> = ({ sections, columns, prefs, sort, canManage, addTaskFocus, onPrefs, onSort, onAddGroup }) => {
  const { actions, requestMove } = useBoardContext();
  const [selected, setSelected] = useState<string[]>([]);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkMenu, setBulkMenu] = useState<'group' | 'priority' | null>(null);
  const addColumnRef = useRef<HTMLElement | null>(null);
  const bulkAnchor = useRef<HTMLElement | null>(null);
  const draggedColumn = useRef<string | null>(null);

  const visible = useMemo(() => columns.filter((c) => !prefs.hidden.includes(c.id)), [columns, prefs.hidden]);
  const template = [
    `${CHECK_WIDTH}px`,
    'var(--bv-name-width)',
    ...visible.map((c) => `${c.width}px`),
    `${ADD_WIDTH}px`,
  ].join(' ');

  const allTasks = actions.board?.tasks || [];
  const selectedTasks = allTasks.filter((t) => selected.includes(t.id));

  const reorderColumn = (targetId: string) => {
    const source = draggedColumn.current;
    draggedColumn.current = null;
    if (!source || source === targetId) return;
    const ids = columns.map((c) => c.id).filter((id) => id !== source);
    ids.splice(ids.indexOf(targetId), 0, source);
    onPrefs({ order: ids });
  };

  const canDropRows = prefs.groupBy === 'deliverable' || prefs.groupBy === 'stage' || prefs.groupBy === 'priority';
  const dropTask = (taskId: string, section: TaskSection) => {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;
    if (prefs.groupBy === 'deliverable') {
      const target = section.id === UNASSIGNED_GROUP ? null : section.id;
      if ((task.deliverableId || null) !== target) actions.setFields(task, { deliverableId: target });
    } else if (prefs.groupBy === 'stage') {
      requestMove(task, section.id);
    } else if (prefs.groupBy === 'priority') {
      const target = section.id === 'none' ? null : section.id;
      if ((task.priority || null) !== target) actions.setFields(task, { priority: target });
    }
  };

  const toggleCollapsed = (id: string) => {
    onPrefs({ collapsed: prefs.collapsed.includes(id) ? prefs.collapsed.filter((c) => c !== id) : [...prefs.collapsed, id] });
  };

  return (
    <div className="bv-table-wrap">
      <div className="bv-scroll">
        <div className="bv-scroll-inner">
          {sections.map((section, sectionIndex) => {
            const collapsed = prefs.collapsed.includes(section.id);
            const sectionIds = section.tasks.map((t) => t.id);
            const allChecked = sectionIds.length > 0 && sectionIds.every((id) => selected.includes(id));
            return (
              <section
                key={section.id}
                className={`bv-group${dropTarget === section.id ? ' drop' : ''}`}
                onDragOver={(e) => {
                  if (canDropRows && e.dataTransfer.types.includes('application/x-board-task')) {
                    e.preventDefault();
                    setDropTarget(section.id);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null);
                }}
                onDrop={(e) => {
                  const taskId = e.dataTransfer.getData('application/x-board-task');
                  setDropTarget(null);
                  if (taskId && canDropRows) {
                    e.preventDefault();
                    dropTask(taskId, section);
                  }
                }}
              >
                <header className="bv-group-head">
                  <button type="button" className="bv-group-toggle" style={{ color: section.color }} aria-expanded={!collapsed} onClick={() => toggleCollapsed(section.id)}>
                    {collapsed ? <FaAngleRight /> : <FaAngleDown />}
                    <span>{section.name}</span>
                  </button>
                  <span className="bv-group-count">{section.tasks.length} task{section.tasks.length === 1 ? '' : 's'}</span>
                  <GroupMenu section={section} />
                </header>

                {collapsed ? (
                  <div className="bv-row bv-summary-row collapsed" style={{ gridTemplateColumns: template }}>
                    <div className="bv-cell bv-sticky bv-sticky-check" style={{ borderLeftColor: section.color }} />
                    <div className="bv-cell bv-sticky bv-sticky-name" />
                    {visible.map((c) => <div key={c.id} className="bv-cell bv-summary-cell"><SummaryCell column={c} tasks={section.tasks} color={section.color} /></div>)}
                  </div>
                ) : (
                  <>
                    <div className="bv-row bv-head-row" style={{ gridTemplateColumns: template }}>
                      <div className="bv-cell bv-sticky bv-sticky-check" style={{ borderLeftColor: section.color }}>
                        <input
                          type="checkbox"
                          className="bv-row-check"
                          checked={allChecked}
                          disabled={sectionIds.length === 0}
                          aria-label={`Select every task in ${section.name}`}
                          onChange={() =>
                            setSelected(allChecked ? selected.filter((id) => !sectionIds.includes(id)) : Array.from(new Set([...selected, ...sectionIds])))
                          }
                        />
                      </div>
                      <div className="bv-cell bv-sticky bv-sticky-name bv-head-name">Task</div>
                      {visible.map((column) => (
                        <ColumnHeader
                          key={column.id}
                          column={column}
                          sort={sort}
                          canManage={canManage}
                          onSort={onSort}
                          onHide={() => onPrefs({ hidden: [...prefs.hidden, column.id] })}
                          onResize={(width) => onPrefs({ widths: { ...prefs.widths, [column.id]: width } })}
                          onDragStart={() => { draggedColumn.current = column.id; }}
                          onDropOn={() => reorderColumn(column.id)}
                        />
                      ))}
                      <div className="bv-cell bv-head-add">
                        {canManage && (
                          <button
                            type="button"
                            aria-label="Add column"
                            title="Add column"
                            onClick={(e) => {
                              addColumnRef.current = e.currentTarget;
                              setAddColumnOpen(true);
                            }}
                          >
                            <FaPlus />
                          </button>
                        )}
                      </div>
                    </div>

                    {section.tasks.map((task) => (
                      <div key={task.id} className={`bv-row bv-task-row${selected.includes(task.id) ? ' selected' : ''}`} style={{ gridTemplateColumns: template }}>
                        <div className="bv-cell bv-sticky bv-sticky-check" style={{ borderLeftColor: section.color }}>
                          <input
                            type="checkbox"
                            className="bv-row-check"
                            checked={selected.includes(task.id)}
                            aria-label={`Select ${task.title}`}
                            onChange={() => setSelected(selected.includes(task.id) ? selected.filter((id) => id !== task.id) : [...selected, task.id])}
                          />
                        </div>
                        <div
                          className="bv-cell bv-sticky bv-sticky-name bv-name-cell"
                          draggable={canDropRows}
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('application/x-board-task', task.id);
                          }}
                        >
                          <TaskName task={task} />
                        </div>
                        {visible.map((column) => (
                          <div key={column.id} className={`bv-cell bv-cell-${column.id}`}>
                            <ColumnCell columnId={column.id} custom={column.custom} task={task} color={section.color} />
                          </div>
                        ))}
                      </div>
                    ))}

                    {/* New tasks start at the beginning. Any later stage is a status change, which needs notes. */}
                    {(prefs.groupBy !== 'stage' || section.id === 'not_started') && (
                      <AddTaskRow section={section} groupBy={prefs.groupBy} template={template} focusSignal={sectionIndex === 0 ? addTaskFocus : 0} />
                    )}

                    <div className="bv-row bv-summary-row" style={{ gridTemplateColumns: template }}>
                      <div className="bv-cell bv-sticky bv-sticky-check blank" />
                      <div className="bv-cell bv-sticky bv-sticky-name blank" />
                      {visible.map((c) => <div key={c.id} className="bv-cell bv-summary-cell"><SummaryCell column={c} tasks={section.tasks} color={section.color} /></div>)}
                    </div>
                  </>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {prefs.groupBy === 'deliverable' && (
        <button type="button" className="bv-btn bv-add-group" onClick={onAddGroup}><FaPlus /> Add group</button>
      )}

      {addColumnOpen && (
        <Popover anchor={addColumnRef.current} onClose={() => setAddColumnOpen(false)} width={340} align="right">
          <ColumnPicker onAdd={actions.addColumn} onDone={() => setAddColumnOpen(false)} />
        </Popover>
      )}

      {selected.length > 0 && selectedTasks.length > 0 && (
        <div className="bv-bulk" role="toolbar" aria-label="Actions for the selected tasks">
          <span className="bv-bulk-count">{selectedTasks.length}</span>
          <span className="bv-bulk-label">task{selectedTasks.length === 1 ? '' : 's'} selected</span>
          <button type="button" onClick={(e) => { bulkAnchor.current = e.currentTarget; setBulkMenu('group'); }}>Move to</button>
          <button type="button" onClick={(e) => { bulkAnchor.current = e.currentTarget; setBulkMenu('priority'); }}>Priority</button>
          <button type="button" className="danger" onClick={() => setConfirmBulkDelete(true)}><FaTrash /> Delete</button>
          <button type="button" aria-label="Clear selection" onClick={() => setSelected([])}><FaTimes /></button>
        </div>
      )}

      {bulkMenu && (
        <Popover anchor={bulkAnchor.current} onClose={() => setBulkMenu(null)} width={220} align="center">
          {bulkMenu === 'group'
            ? (actions.board?.groups || []).map((group) => (
                <FilterCheck
                  key={group.id}
                  checked={false}
                  label={group.name}
                  onToggle={() => {
                    setBulkMenu(null);
                    selectedTasks.forEach((t) => actions.setFields(t, { deliverableId: group.id === UNASSIGNED_GROUP ? null : group.id }));
                    setSelected([]);
                  }}
                />
              ))
            : [...PRIORITIES, ''].map((priority) => (
                <FilterCheck
                  key={priority || 'none'}
                  checked={false}
                  label={priority || 'No priority'}
                  onToggle={() => {
                    setBulkMenu(null);
                    selectedTasks.forEach((t) => actions.setFields(t, { priority: priority || null }));
                    setSelected([]);
                  }}
                />
              ))}
        </Popover>
      )}

      <ConfirmModal
        isOpen={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={() => {
          setConfirmBulkDelete(false);
          actions.deleteTasks(selected);
          setSelected([]);
        }}
        title={`Delete ${selectedTasks.length} task${selectedTasks.length === 1 ? '' : 's'}?`}
        message="They will be removed from every board. A record of what was deleted stays in the activity log."
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
};

export default BoardTable;
