import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { driver, DriveStep, Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './ProductTour.css';

/** Bump a tour's version in its key to show it again after a big change. */
const seenKey = (tourKey: string, userId?: string) => `productTour.${tourKey}.${userId || 'anonymous'}`;

const hasSeen = (key: string) => {
  try {
    return window.localStorage.getItem(key) === 'done';
  } catch {
    return true; // Storage blocked: don't risk showing the tour on every visit
  }
};
const markSeen = (key: string) => {
  try {
    window.localStorage.setItem(key, 'done');
  } catch {
    // Remembering the tour is only a convenience
  }
};

const isOnScreen = (selector: string) => {
  const element = document.querySelector(selector);
  return !!element && element.getClientRects().length > 0;
};

interface Options {
  tourKey: string;
  userId?: string;
  ready: boolean;
  steps: DriveStep[];
  /** Puts the page in the view the tour expects, e.g. back on Overview. */
  beforeStart?: () => void;
}

/**
 * Shows a tour once per person on this browser, and again when the URL has ?tour=1.
 * Steps whose target isn't on screen (other roles, phone layout) are skipped.
 */
export const useProductTour = ({ tourKey, userId, ready, steps, beforeStart }: Options) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const replayRequested = searchParams.get('tour') === '1';
  const activeRef = useRef<Driver | null>(null);
  const beforeStartRef = useRef(beforeStart);
  beforeStartRef.current = beforeStart;
  const key = seenKey(tourKey, userId);

  const start = useCallback(() => {
    activeRef.current?.destroy();
    beforeStartRef.current?.();
    // Let the page render the view it just switched to
    window.setTimeout(() => {
      const available = steps.filter((step) => !step.element || isOnScreen(step.element as string));
      const tour = driver({
        steps: available,
        popoverClass: 'kp-tour',
        showProgress: true,
        progressText: '{{current}} of {{total}}',
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Done',
        overlayColor: '#000000',
        overlayOpacity: 0.55,
        stagePadding: 6,
        stageRadius: 10,
        allowClose: true,
        onDestroyed: () => {
          activeRef.current = null;
        },
      });
      activeRef.current = tour;
      // Saved when it opens, so nobody sees it twice even if they close the tab midway
      markSeen(key);
      tour.drive();
    }, 350);
  }, [steps, key]);

  useEffect(() => {
    if (!ready) return;
    if (replayRequested) {
      const next = new URLSearchParams(searchParams);
      next.delete('tour');
      setSearchParams(next, { replace: true });
      start();
    } else if (!hasSeen(key)) {
      start();
    }
    // Runs when the page is ready or a replay is asked for
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, replayRequested]);

  useEffect(() => () => activeRef.current?.destroy(), []);

  return start;
};
