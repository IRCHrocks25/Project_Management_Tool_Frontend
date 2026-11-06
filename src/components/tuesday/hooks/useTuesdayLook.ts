import { useCallback, useState } from 'react';

export type TuesdayLook = 'classic' | 'new';

const STORAGE_KEY = 'tuesday.look';

function readLook(): TuesdayLook {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'new' ? 'new' : 'classic';
  } catch {
    return 'classic';
  }
}

/** Which Tuesday look this person prefers. Everyone starts on Classic, remembered per browser. */
export function useTuesdayLook(): [TuesdayLook, (look: TuesdayLook) => void] {
  const [look, setLookState] = useState<TuesdayLook>(readLook);
  const setLook = useCallback((next: TuesdayLook) => {
    setLookState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private windows can block storage; the choice still applies until the page reloads.
    }
  }, []);
  return [look, setLook];
}
