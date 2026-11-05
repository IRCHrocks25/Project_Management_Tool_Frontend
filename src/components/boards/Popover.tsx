import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface PopoverProps {
  anchor: HTMLElement | null;
  onClose: () => void;
  width?: number;
  align?: 'left' | 'center' | 'right';
  children: React.ReactNode;
}

const GAP = 6;
const EDGE = 8;

/** Rendered on the body so a scrolling table can't clip it. */
const Popover: React.FC<PopoverProps> = ({ anchor, onClose, width = 240, align = 'left', children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const rect = anchor.getBoundingClientRect();
    const box = ref.current.getBoundingClientRect();
    let left = rect.left;
    if (align === 'center') left = rect.left + rect.width / 2 - box.width / 2;
    if (align === 'right') left = rect.right - box.width;
    left = Math.max(EDGE, Math.min(left, window.innerWidth - box.width - EDGE));
    let top = rect.bottom + GAP;
    if (top + box.height > window.innerHeight - EDGE) {
      top = Math.max(EDGE, rect.top - box.height - GAP);
    }
    setPosition({ top, left });
  }, [anchor, align]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const onScroll = (e: Event) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={ref}
      className="bv-popover"
      role="dialog"
      style={{
        width,
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>,
    document.body,
  );
};

export default Popover;
