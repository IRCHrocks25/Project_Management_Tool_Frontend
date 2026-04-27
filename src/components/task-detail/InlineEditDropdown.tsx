import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface DropdownOption {
  value: string;
  label: React.ReactNode;
}

interface InlineEditDropdownProps {
  trigger: React.ReactNode;
  options: DropdownOption[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  menuClass?: string;
}

const InlineEditDropdown: React.FC<InlineEditDropdownProps> = ({
  trigger, options, onSelect, disabled, menuClass,
}) => {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => { setOpen(false); setFocused(0); }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  const onKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (options[focused]) { onSelect(options[focused].value); close(); } }
    else if (e.key === 'Tab') { close(); }
  };

  return (
    <div
      ref={ref}
      className="tdsm-inline-dropdown"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={onKey}
    >
      <div
        role="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`tdsm-inline-trigger${disabled ? ' tdsm-inline-trigger--disabled' : ''}`}
        onClick={() => !disabled && setOpen(o => !o)}
      >
        {trigger}
        {!disabled && <span className="tdsm-inline-edit-icon" aria-hidden="true">✎</span>}
      </div>
      {open && (
        <div className={`tdsm-inline-menu${menuClass ? ` ${menuClass}` : ''}`} role="listbox">
          {options.map((opt, i) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={i === focused}
              className={`tdsm-inline-option${i === focused ? ' focused' : ''}`}
              onMouseEnter={() => setFocused(i)}
              onMouseDown={e => { e.preventDefault(); onSelect(opt.value); close(); }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InlineEditDropdown;
