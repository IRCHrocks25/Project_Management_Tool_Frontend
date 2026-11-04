/**
 * OverflowMenu — "…" button that opens a small action menu.
 *
 *   <OverflowMenu
 *     label="More actions for Release notes.pdf"        // aria-label of the trigger
 *     items={[
 *       { label: 'Edit', icon: 'edit', onSelect: openEdit },
 *       { label: 'Delete file', icon: 'trash', danger: true, onSelect: askDelete },
 *     ]}
 *   />
 *   Optional: size="md" (default "sm"), triggerIcon, triggerLabel (renders a text button instead).
 *
 * Arrow keys / Home / End move, Enter or Space selects, Esc or Tab closes and returns focus to the
 * trigger. Items can be `hidden` or `disabled`.
 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import Icon, { IconName } from './Icon';
import { HubPortal, useLayer } from './layers';

export interface OverflowItem {
  label: string;
  icon?: IconName;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  onSelect: () => void;
}

export interface OverflowMenuProps {
  label: string;
  items: OverflowItem[];
  size?: 'sm' | 'md';
  triggerIcon?: IconName;
  /** Show a text button ("More") instead of an icon button. */
  triggerLabel?: string;
}

const Menu: React.FC<{ anchor: HTMLElement; items: OverflowItem[]; onClose: (refocus: boolean) => void; onPick: (it: OverflowItem) => void }> = ({
  anchor,
  items,
  onClose,
  onPick,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden', top: 0, left: 0 });

  useLayer(ref, { onEscape: () => onClose(true), restoreFocus: false });

  useLayoutEffect(() => {
    const place = () => {
      const m = ref.current;
      if (!m) return;
      const r = anchor.getBoundingClientRect();
      const mw = m.offsetWidth;
      const mh = m.offsetHeight;
      setStyle({
        left: Math.max(8, Math.min(r.right - mw, window.innerWidth - mw - 8)),
        top: r.bottom + 4 + mh > window.innerHeight ? Math.max(8, r.top - mh - 4) : r.bottom + 4,
      });
    };
    place();
    const close = () => onClose(false);
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose(false);
    };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', place, true);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('mousedown', onDown);
    };
  }, [anchor, onClose]);

  const onKey = (e: React.KeyboardEvent) => {
    const btns = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || []);
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      btns[(i + 1) % btns.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      btns[(i - 1 + btns.length) % btns.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      btns[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      btns[btns.length - 1]?.focus();
    } else if (e.key === 'Tab' || e.key === 'Escape') {
      e.preventDefault();
      onClose(true);
    }
  };

  return (
    <HubPortal>
      <div
        ref={ref}
        className="hub-menu"
        role="menu"
        style={style}
        onKeyDown={onKey}
        // Portal events bubble through the React tree; keep clicks from reaching e.g. a clickable row.
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((it, i) => (
          <button
            key={`${it.label}-${i}`}
            type="button"
            role="menuitem"
            className={it.danger ? 'hub-danger' : undefined}
            disabled={it.disabled}
            data-autofocus={i === items.findIndex((x) => !x.disabled) ? true : undefined}
            onClick={() => onPick(it)}
          >
            {it.icon ? <Icon name={it.icon} size={15} /> : null}
            {it.label}
          </button>
        ))}
      </div>
    </HubPortal>
  );
};

const OverflowMenu: React.FC<OverflowMenuProps> = ({ label, items, size = 'sm', triggerIcon = 'more', triggerLabel }) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const visible = items.filter((it) => !it.hidden);
  const closeRef = useRef((refocus: boolean) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  });

  if (!visible.length) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={triggerLabel ? 'hub-btn' : `hub-icon-btn${size === 'sm' ? ' hub-sm' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel ? undefined : label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <Icon name={triggerIcon} size={18} />
        {triggerLabel}
      </button>
      {open && btnRef.current && (
        <Menu
          anchor={btnRef.current}
          items={visible}
          onClose={closeRef.current}
          onPick={(it) => {
            setOpen(false);
            // Focus the trigger first so a dialog opened by the item returns focus here when it closes.
            btnRef.current?.focus();
            it.onSelect();
          }}
        />
      )}
    </>
  );
};

export default OverflowMenu;
