import {
  BoardProject,
  BoardDeliverable,
  BoardTask,
} from '../../services/boardView.service';
import { KANBAN_COLUMNS } from '../../utils/taskKanbanColumn';
import { SortState } from './hooks/useTuesdayFilters';

/*
 * Within-project sort: deliverables within a project (L2) and tasks
 * within a deliverable (L3). Pure function — caller memoizes on
 * (data, sort) identity.
 *
 * L1 (project-level) sort moved to backend SQL ORDER BY in Phase 5b.
 * The frontend receives projects already sorted at L1 by the server;
 * applySort only reorders the *children* of each loaded project.
 *
 * Per-column key extraction:
 *   name      L2 deliverable.name | L3 task.title
 *   status    L2 enum-ordered deliverable.status | L3 KANBAN_COLUMNS index
 *   priority  L2/L3 inherit project.priority (no-op within a project)
 *   timeline  L2 minDueDate | L3 dueDate
 *   pm        L2/L3 inherit project.pm.name (no-op within a project)
 *   department L2 first child task.type alpha | L3 task.type
 *
 * The synthetic '__unassigned__' bucket is pinned to the bottom of
 * each project's deliverable list regardless of sort direction (it's
 * a data-quality marker, not a peer of real deliverables).
 *
 * Nulls always sort last regardless of direction.
 */

const PRIORITY_ORDER: Record<string, number> = { Low: 0, Medium: 1, High: 2, Urgent: 3 };

const DELIV_STATUS_ORDER: Record<string, number> = {
  'Not Started': 0,
  'In Progress': 1,
  'Ready for Review': 2,
  'Client Review': 3,
  'Approved': 4,
  'Revision': 5,
};

const KANBAN_INDEX: Record<string, number> = KANBAN_COLUMNS.reduce((acc, c, i) => {
  acc[c.id] = i;
  return acc;
}, {} as Record<string, number>);

type SortValue = string | number | null;

function deliverableKey(d: BoardDeliverable, p: BoardProject, column: string): SortValue {
  switch (column) {
    case 'name':       return d.name || null;
    case 'status':     return d.status ? (DELIV_STATUS_ORDER[d.status] ?? null) : null;
    case 'priority':   return PRIORITY_ORDER[p.priority] ?? null;     // inherited
    case 'timeline':   return d.minDueDate ? new Date(d.minDueDate).getTime() : null;
    case 'pm':         return p.pm?.name || null;                     // inherited
    case 'department': {
      const types = new Set<string>(d.tasks.map((t) => t.type));
      const sorted = Array.from(types).sort();
      return sorted[0] || null;
    }
    default: return null;
  }
}

function taskKey(t: BoardTask, p: BoardProject, column: string): SortValue {
  switch (column) {
    case 'name':       return t.title || null;
    case 'status':     return KANBAN_INDEX[t.kanbanColumnId] ?? null;
    case 'priority':   return PRIORITY_ORDER[p.priority] ?? null;     // inherited
    case 'timeline':   return t.dueDate ? new Date(t.dueDate).getTime() : null;
    case 'pm':         return p.pm?.name || null;                     // inherited
    case 'department': return t.type || null;
    default: return null;
  }
}

// Comparator: nulls last (regardless of direction); locale-aware for
// strings; numeric subtraction for numbers; fallback to <,> otherwise.
function compareWith(direction: 'asc' | 'desc') {
  const sign = direction === 'asc' ? 1 : -1;
  return (a: SortValue, b: SortValue): number => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;        // a sorts last
    if (b === null) return -1;       // b sorts last
    if (typeof a === 'string' && typeof b === 'string') {
      return sign * a.localeCompare(b);
    }
    if (typeof a === 'number' && typeof b === 'number') {
      return sign * (a - b);
    }
    if (a < b) return sign * -1;
    if (a > b) return sign * 1;
    return 0;
  };
}

export function applySort(
  data: BoardProject[],
  sort: SortState | null,
): BoardProject[] {
  if (!sort) return data;
  const cmp = compareWith(sort.direction);

  // Pass-through at L1 — the project order in `data` is already what
  // the server returned, sorted by SQL at the project level.
  return data.map((project) => {
    // L3: sort tasks within each deliverable (Unassigned bucket included
    // since its child tasks are real and benefit from the sort).
    const withSortedTasks = project.deliverables.map((d) => ({
      ...d,
      tasks: [...d.tasks].sort((a, b) => cmp(taskKey(a, project, sort.column), taskKey(b, project, sort.column))),
    }));

    // L2: partition deliverables — real ones sort normally; the
    // synthetic '__unassigned__' bucket pins to the bottom regardless
    // of sort direction.
    const real = withSortedTasks.filter((d) => d.id !== '__unassigned__');
    const unassigned = withSortedTasks.filter((d) => d.id === '__unassigned__');
    real.sort((a, b) => cmp(deliverableKey(a, project, sort.column), deliverableKey(b, project, sort.column)));

    return { ...project, deliverables: [...real, ...unassigned] };
  });
}
