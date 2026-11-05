import {
  BOARD_COLUMN_TITLE,
  BOARD_DISPLAY_ORDER,
  COLUMN_LABEL,
  ColumnId,
} from '../dashboards/taskColumns';
import { BoardColumn, BoardGroup, BoardTaskRow, ProjectBoard } from '../../services/board.service';

/** Colour carries meaning: teal is moving, amber needs a look, red needs a fix, green is done. */
export const STAGE_COLOR: Record<string, string> = {
  not_started: '#6b7280',
  owned_in_progress: '#0f766e',
  for_approval: '#b45309',
  revision: '#b91c1c',
  elliot_review: '#57534e',
  approved_completed: '#15803d',
  qa_before_client: '#475569',
  client_validation: '#a16207',
};

export const stageLabel = (id: string): string =>
  BOARD_COLUMN_TITLE[id as ColumnId] || COLUMN_LABEL[id as ColumnId] || id;

export const STAGE_ORDER: string[] = [...BOARD_DISPLAY_ORDER];

export const stagesForBoard = (tasks: BoardTaskRow[]): string[] =>
  tasks.some((t) => t.stageId === 'elliot_review') ? [...STAGE_ORDER, 'elliot_review'] : STAGE_ORDER;

export const PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'];

export const PRIORITY_COLOR: Record<string, string> = {
  Urgent: '#991b1b',
  High: '#c2410c',
  Medium: '#a16207',
  Low: '#64748b',
};

export const GROUP_COLORS = ['#0f766e', '#15803d', '#b45309', '#b91c1c', '#475569', '#a16207', '#57534e'];
export const EMPTY_FILL = '#e5e7eb';
export const UNASSIGNED_GROUP = '__unassigned__';

export type GroupByKey = 'deliverable' | 'stage' | 'priority' | 'owner' | 'department';

export const GROUP_BY_OPTIONS: { key: GroupByKey; label: string }[] = [
  { key: 'deliverable', label: 'Deliverable' },
  { key: 'stage', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'owner', label: 'Owner' },
  { key: 'department', label: 'Department' },
];

export interface BoardColumnDef {
  id: string;
  label: string;
  width: number;
  custom?: BoardColumn;
}

export const BUILTIN_COLUMNS: BoardColumnDef[] = [
  { id: 'owner', label: 'Owner', width: 110 },
  { id: 'status', label: 'Status', width: 170 },
  { id: 'due', label: 'Due date', width: 130 },
  { id: 'priority', label: 'Priority', width: 130 },
  { id: 'notes', label: 'Notes', width: 200 },
  { id: 'updated', label: 'Last updated', width: 170 },
  { id: 'timeline', label: 'Timeline', width: 170 },
  { id: 'files', label: 'Files', width: 110 },
  { id: 'department', label: 'Department', width: 130 },
];

export interface BoardPrefs {
  hidden: string[];
  order: string[];
  widths: Record<string, number>;
  groupBy: GroupByKey;
  collapsed: string[];
}

const DEFAULT_PREFS: BoardPrefs = { hidden: [], order: [], widths: {}, groupBy: 'deliverable', collapsed: [] };

export const loadPrefs = (projectId: string): BoardPrefs => {
  try {
    const raw = localStorage.getItem(`boardPrefs:${projectId}`);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
};

export const savePrefs = (projectId: string, prefs: BoardPrefs): void => {
  try {
    localStorage.setItem(`boardPrefs:${projectId}`, JSON.stringify(prefs));
  } catch {
    // Only a convenience: the board still works if the browser refuses storage.
  }
};

/** Every column in the viewer's order, including columns added after they last arranged theirs. */
export const orderedColumns = (columns: BoardColumn[], prefs: BoardPrefs): BoardColumnDef[] => {
  const all: BoardColumnDef[] = [
    ...BUILTIN_COLUMNS,
    ...columns.map((custom) => ({ id: custom.id, label: custom.name, width: 150, custom })),
  ];
  const rank = (id: string) => {
    const index = prefs.order.indexOf(id);
    return index === -1 ? prefs.order.length + all.findIndex((c) => c.id === id) : index;
  };
  return [...all]
    .sort((a, b) => rank(a.id) - rank(b.id))
    .map((c) => ({ ...c, width: prefs.widths[c.id] || c.width }));
};

// ── Dates ─────────────────────────────────────────────────────────────────

const asUtc = (day: string) => new Date(`${day.slice(0, 10)}T00:00:00Z`);

export const formatDay = (day?: string | null): string =>
  day ? asUtc(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';

export const todayDay = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${date}`;
};

export const isOverdue = (task: BoardTaskRow): boolean =>
  !!task.dueDate && !task.isCompleted && task.dueDate < todayDay();

export const formatRange = (start?: string | null, end?: string | null): string => {
  if (!start && !end) return '';
  if (!start || !end || start === end) return formatDay(start || end);
  const a = asUtc(start);
  const b = asUtc(end);
  if (a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${formatDay(start)} - ${b.getUTCDate()}`;
  }
  return `${formatDay(start)} - ${formatDay(end)}`;
};

/** How far through its dates a task is today, 0 to 1. */
export const timelineProgress = (start?: string | null, end?: string | null): number => {
  if (!start || !end) return 0;
  const a = asUtc(start).getTime();
  const b = asUtc(end).getTime();
  const now = asUtc(todayDay()).getTime();
  if (now >= b) return 1;
  if (now <= a) return 0;
  return (now - a) / (b - a);
};

export const timeAgo = (iso?: string | null): string => {
  if (!iso) return '';
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ── Filtering, sorting, grouping ──────────────────────────────────────────

export interface BoardFilters {
  query: string;
  owners: string[];
  stages: string[];
  priorities: string[];
  departments: string[];
  due: '' | 'overdue' | 'week' | 'none';
}

export const NO_FILTERS: BoardFilters = { query: '', owners: [], stages: [], priorities: [], departments: [], due: '' };

export const activeFilterCount = (f: BoardFilters): number =>
  [f.stages.length, f.priorities.length, f.departments.length, f.due ? 1 : 0].filter(Boolean).length;

const addDays = (day: string, days: number) => {
  const d = asUtc(day);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const filterTasks = (tasks: BoardTaskRow[], f: BoardFilters): BoardTaskRow[] => {
  const query = f.query.trim().toLowerCase();
  const today = todayDay();
  return tasks.filter((t) => {
    if (query && !`${t.title} ${t.notes || ''}`.toLowerCase().includes(query)) return false;
    if (f.owners.length && !t.owners.some((o) => f.owners.includes(o.id))) return false;
    if (f.stages.length && !f.stages.includes(t.stageId)) return false;
    if (f.priorities.length && !f.priorities.includes(t.priority || '')) return false;
    if (f.departments.length && !f.departments.includes(t.type)) return false;
    if (f.due === 'overdue' && !isOverdue(t)) return false;
    if (f.due === 'none' && t.dueDate) return false;
    if (f.due === 'week' && (!t.dueDate || t.dueDate < today || t.dueDate > addDays(today, 7))) return false;
    return true;
  });
};

export interface BoardSort {
  key: string;
  direction: 'asc' | 'desc';
}

export const SORT_OPTIONS: { key: string; label: string }[] = [
  { key: 'title', label: 'Task' },
  { key: 'owner', label: 'Owner' },
  { key: 'status', label: 'Status' },
  { key: 'due', label: 'Due date' },
  { key: 'priority', label: 'Priority' },
  { key: 'updated', label: 'Last updated' },
];

const sortValue = (t: BoardTaskRow, key: string): string | number | null => {
  switch (key) {
    case 'title': return t.title.toLowerCase();
    case 'owner': return t.owners[0]?.name.toLowerCase() ?? null;
    case 'status': return STAGE_ORDER.indexOf(t.stageId);
    case 'due': return t.dueDate;
    case 'priority': return t.priority ? PRIORITIES.indexOf(t.priority) : null;
    case 'updated': return t.updatedAt;
    default: {
      const value = t.customFields?.[key];
      if (value === undefined || value === null) return null;
      return typeof value === 'number' ? value : String(value).toLowerCase();
    }
  }
};

export const sortTasks = (tasks: BoardTaskRow[], sort: BoardSort | null): BoardTaskRow[] => {
  if (!sort) return tasks;
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...tasks].sort((a, b) => {
    const x = sortValue(a, sort.key);
    const y = sortValue(b, sort.key);
    if (x === y) return 0;
    if (x === null) return 1; // Empty cells stay last either way
    if (y === null) return -1;
    return x < y ? -sign : sign;
  });
};

export interface TaskSection {
  id: string;
  name: string;
  color: string;
  tasks: BoardTaskRow[];
  group?: BoardGroup;
}

const colorAt = (index: number) => GROUP_COLORS[index % GROUP_COLORS.length];

export const buildSections = (board: ProjectBoard, tasks: BoardTaskRow[], groupBy: GroupByKey): TaskSection[] => {
  switch (groupBy) {
    case 'stage':
      return stagesForBoard(board.tasks).map((id) => ({
        id,
        name: stageLabel(id),
        color: STAGE_COLOR[id],
        tasks: tasks.filter((t) => t.stageId === id),
      }));
    case 'priority':
      return [...PRIORITIES, ''].map((priority) => ({
        id: priority || 'none',
        name: priority || 'No priority',
        color: PRIORITY_COLOR[priority] || '#6b7280',
        tasks: tasks.filter((t) => (t.priority || '') === priority),
      }));
    case 'owner': {
      const people = new Map<string, string>();
      board.tasks.forEach((t) => t.owners.forEach((o) => people.set(o.id, o.name)));
      const sections: TaskSection[] = Array.from(people.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([id, name], i) => ({
          id,
          name,
          color: colorAt(i),
          tasks: tasks.filter((t) => t.owners[0]?.id === id),
        }));
      sections.push({ id: 'none', name: 'No owner', color: '#6b7280', tasks: tasks.filter((t) => t.owners.length === 0) });
      return sections;
    }
    case 'department': {
      const departments = Array.from(new Set(board.tasks.map((t) => t.type))).sort();
      return departments.map((type, i) => ({
        id: type,
        name: type,
        color: colorAt(i),
        tasks: tasks.filter((t) => t.type === type),
      }));
    }
    default:
      return board.groups.map((group, i) => ({
        id: group.id,
        name: group.name,
        color: colorAt(i),
        group,
        tasks: tasks.filter((t) => (t.deliverableId || UNASSIGNED_GROUP) === group.id),
      }));
  }
};

export const mostCommonType = (tasks: BoardTaskRow[]): string => {
  const counts = new Map<string, number>();
  tasks.forEach((t) => counts.set(t.type, (counts.get(t.type) || 0) + 1));
  let best = 'General';
  let bestCount = 0;
  counts.forEach((count, type) => {
    if (count > bestCount) {
      best = type;
      bestCount = count;
    }
  });
  return best;
};

export const showBoardToast = (message: string): void => {
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};
