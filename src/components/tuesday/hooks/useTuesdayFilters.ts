import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/*
 * URL-backed state for Tuesday's toolbar (search, filter chips, sort,
 * pagination).
 *
 * Format (each param optional, omitted when at default):
 *   ?q=design                       full-text search on project + task names
 *   ?dept=Design,Copy               department filter (task.type values)
 *   ?pm=<uuid>,<uuid>               PM filter (user.id values)
 *   ?status=for_approval,revision   status filter (kanban column ids)
 *   ?priority=High,Urgent           priority filter (project.priority enum)
 *   ?assignee=<uuid>,<uuid>         assignee filter (user.id values)
 *   ?sort=priority:desc             column:direction
 *   ?page=2                         pagination (omitted when on page 1)
 *   ?expanded=p:abc,d:xyz           (existing — owned by useExpansionState)
 *
 * Filter logic semantics: AND across categories, OR within a category.
 * Pagination semantics: any filter or sort change resets to page 1
 * (otherwise users on page 5 apply a filter that returns 60 results
 * and see an empty page 5).
 */

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: string;
  direction: SortDirection;
}

export interface TuesdayFilterState {
  search: string;
  department: Set<string>;
  pm: Set<string>;
  status: Set<string>;
  priority: Set<string>;
  assignee: Set<string>;
}

export interface TuesdayFilterControls {
  state: TuesdayFilterState;
  sort: SortState | null;
  page: number;
  setSearch: (s: string) => void;
  toggleFilter: (key: keyof TuesdayFilterState, value: string) => void;
  clearAll: () => void;
  setSort: (next: SortState | null) => void;
  setPage: (page: number) => void;
  anyActive: boolean;
}

const FILTER_KEYS = ['department', 'pm', 'status', 'priority', 'assignee'] as const;
const URL_PARAM: Record<typeof FILTER_KEYS[number], string> = {
  department: 'dept',
  pm: 'pm',
  status: 'status',
  priority: 'priority',
  assignee: 'assignee',
};

function readSet(params: URLSearchParams, key: string): Set<string> {
  const raw = params.get(key);
  if (!raw) return new Set();
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

export function useTuesdayFilters(): TuesdayFilterControls {
  const [params, setParams] = useSearchParams();

  const state: TuesdayFilterState = useMemo(
    () => ({
      search: params.get('q') || '',
      department: readSet(params, URL_PARAM.department),
      pm: readSet(params, URL_PARAM.pm),
      status: readSet(params, URL_PARAM.status),
      priority: readSet(params, URL_PARAM.priority),
      assignee: readSet(params, URL_PARAM.assignee),
    }),
    [params],
  );

  const sort: SortState | null = useMemo(() => {
    const raw = params.get('sort');
    if (!raw) return null;
    const [column, direction] = raw.split(':');
    if (!column || (direction !== 'asc' && direction !== 'desc')) return null;
    return { column, direction };
  }, [params]);

  const page: number = useMemo(() => {
    const raw = params.get('page');
    if (!raw) return 1;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  }, [params]);

  // Helper that writes params + drops `page` (filters/sort changes reset
  // to page 1; the absent `page` param is the canonical "page 1" form).
  const writeParamsResetPage = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      next.delete('page'); // reset to page 1 on any non-page change
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const setSearch = useCallback(
    (s: string) => {
      writeParamsResetPage({ q: s.trim() ? s : null });
    },
    [writeParamsResetPage],
  );

  const toggleFilter = useCallback(
    (key: keyof TuesdayFilterState, value: string) => {
      if (key === 'search') return; // search has its own setter
      const param = URL_PARAM[key];
      const current = readSet(params, param);
      if (current.has(value)) current.delete(value);
      else current.add(value);
      const serialized = Array.from(current).join(',');
      writeParamsResetPage({ [param]: serialized || null });
    },
    [params, writeParamsResetPage],
  );

  const clearAll = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete('q');
    for (const k of FILTER_KEYS) next.delete(URL_PARAM[k]);
    next.delete('sort');
    next.delete('page');
    setParams(next, { replace: true });
  }, [params, setParams]);

  const setSort = useCallback(
    (next: SortState | null) => {
      writeParamsResetPage({ sort: next ? `${next.column}:${next.direction}` : null });
    },
    [writeParamsResetPage],
  );

  // Pagination changes don't reset filters. Page 1 omits the param.
  const setPage = useCallback(
    (nextPage: number) => {
      const next = new URLSearchParams(params);
      if (nextPage <= 1) next.delete('page');
      else next.set('page', String(nextPage));
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const anyActive =
    state.search.length > 0 ||
    state.department.size > 0 ||
    state.pm.size > 0 ||
    state.status.size > 0 ||
    state.priority.size > 0 ||
    state.assignee.size > 0;

  return { state, sort, page, setSearch, toggleFilter, clearAll, setSort, setPage, anyActive };
}
