import { useEffect } from 'react';

const EDGE_PX = 90;
const SPEED = 14;
const QUIET_MS = 450;

/** Browsers barely scroll the page during a drag, so columns below the fold would be out of reach. */
export const useDragEdgeScroll = (dragging: boolean) => {
  useEffect(() => {
    if (!dragging) return undefined;
    let speed = 0;
    let lastPointerEvent = 0;
    let frame = 0;
    const scroll = () => {
      // Stop if the browser has gone quiet, so the page can't run away during a drag.
      if (speed !== 0 && performance.now() - lastPointerEvent < QUIET_MS) window.scrollBy(0, speed);
      frame = window.requestAnimationFrame(scroll);
    };
    const onPointerMove = (e: DragEvent) => {
      lastPointerEvent = performance.now();
      if (e.clientY > window.innerHeight - EDGE_PX) speed = SPEED;
      else if (e.clientY < EDGE_PX) speed = -SPEED;
      else speed = 0;
    };
    window.addEventListener('dragover', onPointerMove);
    window.addEventListener('dragenter', onPointerMove);
    frame = window.requestAnimationFrame(scroll);
    return () => {
      window.removeEventListener('dragover', onPointerMove);
      window.removeEventListener('dragenter', onPointerMove);
      window.cancelAnimationFrame(frame);
    };
  }, [dragging]);
};
