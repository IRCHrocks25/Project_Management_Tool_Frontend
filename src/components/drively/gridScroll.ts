/**
 * FortuneSheet moves one whole row per wheel event, however far the fingers moved, and only one direction at a
 * time. That makes a trackpad race and stutter. This scrolls its scrollbars by the real distance instead.
 */
const LINE_PX = 20;

export function wheelPixels(
  e: { deltaX: number; deltaY: number; deltaMode: number; shiftKey?: boolean },
  page: { width: number; height: number },
): { x: number; y: number } {
  const unitX = e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? page.width : 1;
  const unitY = e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? page.height : 1;
  const x = e.deltaX * unitX;
  const y = e.deltaY * unitY;
  // A mouse wheel with Shift held scrolls sideways.
  return e.shiftKey && x === 0 ? { x: y, y: 0 } : { x, y };
}

/** Menus and dialogs inside the grid keep their own scrolling. */
function inOwnScroller(target: Element, host: Element): boolean {
  for (let el: Element | null = target; el && el !== host; el = el.parentElement) {
    if (el.classList.contains('luckysheet-scrollbars')) return false;
    const { overflowX, overflowY } = getComputedStyle(el);
    const scrolls = (v: string) => v === 'auto' || v === 'scroll';
    if ((scrolls(overflowY) && el.scrollHeight > el.clientHeight) || (scrolls(overflowX) && el.scrollWidth > el.clientWidth)) return true;
  }
  return false;
}

/** Takes over wheel scrolling on the sheet. Returns the clean-up. */
export function attachGridScroll(host: HTMLElement): () => void {
  const onWheel = (e: WheelEvent) => {
    const target = e.target as Element;
    if (!target.closest('.fortune-sheet-container') || inOwnScroller(target, host)) return;
    const down = host.querySelector<HTMLElement>('.luckysheet-scrollbar-y');
    const across = host.querySelector<HTMLElement>('.luckysheet-scrollbar-x');
    if (!down || !across) return;
    const { x, y } = wheelPixels(e, { width: across.clientWidth, height: down.clientHeight });
    across.scrollLeft += x;
    down.scrollTop += y;
    e.preventDefault();
    e.stopPropagation();
  };
  // Capture, so this runs before FortuneSheet's own listener further in.
  host.addEventListener('wheel', onWheel, { capture: true, passive: false });
  return () => host.removeEventListener('wheel', onWheel, { capture: true });
}
