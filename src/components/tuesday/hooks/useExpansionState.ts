import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ExpandedState, Updater } from '@tanstack/table-core';

const PARAM = 'expanded';

// Persists row expansion state in the URL search params as a comma-separated
// list of TanStack row IDs. Reloads keep position; deep links work.
export function useExpansionState(): [ExpandedState, (u: Updater<ExpandedState>) => void] {
  const [params, setParams] = useSearchParams();

  const expanded: ExpandedState = useMemo(() => {
    const raw = params.get(PARAM);
    if (!raw) return {};
    const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const obj: Record<string, boolean> = {};
    for (const id of ids) obj[id] = true;
    return obj;
  }, [params]);

  const setExpanded = useCallback(
    (updater: Updater<ExpandedState>) => {
      const next = typeof updater === 'function' ? (updater as any)(expanded) : updater;
      const ids = next === true ? [] : Object.entries(next).filter(([, v]) => !!v).map(([k]) => k);
      const nextParams = new URLSearchParams(params);
      if (ids.length === 0) nextParams.delete(PARAM);
      else nextParams.set(PARAM, ids.join(','));
      setParams(nextParams, { replace: true });
    },
    [expanded, params, setParams],
  );

  return [expanded, setExpanded];
}
