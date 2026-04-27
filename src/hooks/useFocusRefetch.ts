import { useEffect } from 'react';

/**
 * Calls the provided refetch function whenever the tab/window regains focus
 * after being away for at least `minIdleMs`. Avoids spamming refetches when
 * the user just briefly clicks elsewhere.
 */
export function useFocusRefetch(refetch: () => void, minIdleMs = 30000) {
  useEffect(() => {
    let lastBlur = 0;
    const onBlur = () => { lastBlur = Date.now(); };
    const onFocus = () => {
      if (lastBlur > 0 && Date.now() - lastBlur >= minIdleMs) {
        refetch();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') onFocus();
      else lastBlur = Date.now();
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refetch, minIdleMs]);
}
