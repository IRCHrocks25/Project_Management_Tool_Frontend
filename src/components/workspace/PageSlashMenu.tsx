/**
 * The list shown for "/" commands. Focus stays in the editor: keys arrive through the store
 * (see pageSlash.ts) and pressing an item doesn't move the cursor.
 */
import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import Icon from '../hub/ui/Icon';
import { HubPortal } from '../hub/ui/layers';
import { SlashStore } from './pageSlash';

const GAP = 6;
const EDGE = 8;

const PageSlashMenu: React.FC<{ store: SlashStore }> = ({ store }) => {
  const view = useSyncExternalStore(store.subscribe, store.getView);
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden', top: 0, left: 0 });
  const open = !!view;
  const clientRect = view ? view.clientRect : null;
  const count = view ? view.items.length : 0;
  const index = view ? view.index : 0;

  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const el = ref.current;
      const rect = clientRect ? clientRect() : null;
      if (!el || !rect) return;
      // On phones the keyboard shrinks the visual viewport, not the window.
      const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const h = el.offsetHeight;
      const below = rect.bottom + GAP;
      setStyle({
        left: Math.max(EDGE, Math.min(rect.left, window.innerWidth - el.offsetWidth - EDGE)),
        top: below + h > height - EDGE && rect.top - GAP - h >= EDGE ? rect.top - GAP - h : below,
      });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
    // `count` changes the height; the caret moves with each typed character.
  }, [open, clientRect, count]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) store.dismiss();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, store]);

  useEffect(() => {
    const active = ref.current ? ref.current.querySelector<HTMLElement>('[aria-selected="true"]') : null;
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!view) return null;

  return (
    <HubPortal>
      <div ref={ref} className="hub-menu ws-slash" role="listbox" aria-label="Insert a block" style={style}>
        {view.items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={i === view.index}
            tabIndex={-1}
            className={i === view.index ? 'ws-slash-on' : undefined}
            // Keep the cursor in the editor, so the command applies where you were typing.
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => store.setIndex(i)}
            onClick={() => store.select(i)}
          >
            <span className="ws-slash-mark" aria-hidden="true">
              {item.icon ? <Icon name={item.icon} size={14} /> : item.glyph}
            </span>
            <span className="ws-slash-text">
              <b>{item.title}</b>
              <small>{item.hint}</small>
            </span>
          </button>
        ))}
      </div>
    </HubPortal>
  );
};

export default PageSlashMenu;
