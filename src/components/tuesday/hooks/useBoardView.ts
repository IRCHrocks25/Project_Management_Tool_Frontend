import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  boardViewService,
  BoardProject,
  BoardViewQueryParams,
  BoardViewSort,
} from '../../../services/boardView.service';

export interface UseBoardViewArgs {
  page?: number;
  pageSize?: number;
  search?: string;
  dept?: string[];
  pm?: string[];
  status?: string[];
  priority?: string[];
  assignee?: string[];
  sort?: BoardViewSort | null;
  projectId?: string;
}

interface State {
  // `data` keeps its original shape (BoardProject[] | null) — extracted
  // from the wrapper response. Existing consumers that only destructure
  // {data, loading, error, setData, refetch} keep working unchanged.
  data: BoardProject[] | null;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  loading: boolean;       // true ONLY on initial load (data === null)
  refetching: boolean;    // true during background refetches (data !== null)
  error: string | null;
}

const INITIAL_STATE: State = {
  data: null,
  totalCount: 0,
  page: 1,
  pageSize: 50,
  totalPages: 0,
  loading: true,
  refetching: false,
  error: null,
};

export function useBoardView(args: UseBoardViewArgs = {}) {
  const [state, setState] = useState<State>(INITIAL_STATE);
  // Bumping `tick` triggers an explicit refetch via refetch().
  const [tick, setTick] = useState(0);
  const cancelledRef = useRef(false);

  // Serialize args into a stable string key. The effect re-runs only
  // when the values actually change — callers don't need to memoize
  // the args object themselves. Order-stable: arrays joined with ',',
  // sort serialized as 'col:dir'.
  const argsKey = useMemo(() => {
    const parts: string[] = [];
    parts.push(`page=${args.page ?? 1}`);
    parts.push(`size=${args.pageSize ?? 50}`);
    if (args.search && args.search.trim()) parts.push(`q=${args.search.trim()}`);
    if (args.dept && args.dept.length > 0) parts.push(`dept=${[...args.dept].sort().join(',')}`);
    if (args.pm && args.pm.length > 0) parts.push(`pm=${[...args.pm].sort().join(',')}`);
    if (args.status && args.status.length > 0) parts.push(`status=${[...args.status].sort().join(',')}`);
    if (args.priority && args.priority.length > 0) parts.push(`priority=${[...args.priority].sort().join(',')}`);
    if (args.assignee && args.assignee.length > 0) parts.push(`assignee=${[...args.assignee].sort().join(',')}`);
    if (args.sort) parts.push(`sort=${args.sort.column}:${args.sort.direction}`);
    if (args.projectId) parts.push(`projectId=${args.projectId}`);
    return parts.join('|');
  }, [
    args.page, args.pageSize, args.search,
    args.dept, args.pm, args.status, args.priority, args.assignee,
    args.sort, args.projectId,
  ]);

  useEffect(() => {
    cancelledRef.current = false;

    // Toggle the right loading flag. On initial fetch (data null) we
    // show the full-page loading state; on subsequent refetches we
    // keep prior data visible and surface `refetching` for a subtle
    // toolbar/footer indicator.
    setState((prev) => ({
      ...prev,
      loading: prev.data === null,
      refetching: prev.data !== null,
      error: null,
    }));

    const params: BoardViewQueryParams = {
      page: args.page,
      pageSize: args.pageSize,
      q: args.search,
      dept: args.dept,
      pm: args.pm,
      status: args.status,
      priority: args.priority,
      assignee: args.assignee,
      sort: args.sort ?? undefined,
      projectId: args.projectId,
    };

    boardViewService
      .fetch(params)
      .then((response) => {
        if (cancelledRef.current) return;
        setState({
          data: response.projects,
          totalCount: response.totalCount,
          page: response.page,
          pageSize: response.pageSize,
          totalPages: response.totalPages,
          loading: false,
          refetching: false,
          error: null,
        });
      })
      .catch((err) => {
        if (cancelledRef.current) return;
        const message = err?.response?.data?.message || err?.message || 'Failed to load board view';
        setState((prev) => ({
          ...prev,
          loading: false,
          refetching: false,
          error: String(message),
        }));
      });

    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [argsKey, tick]);

  const setData = useCallback(
    (updater: (data: BoardProject[] | null) => BoardProject[] | null) => {
      setState((prev) => ({ ...prev, data: updater(prev.data) }));
    },
    [],
  );

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { ...state, setData, refetch };
}
