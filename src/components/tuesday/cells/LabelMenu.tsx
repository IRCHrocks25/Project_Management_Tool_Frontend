import React, { useRef, useState } from 'react';
import Popover from '../../boards/Popover';
import '../../boards/boards.css';

export interface LabelMenuOption {
  value: string;
  label: string;
  color: string;
  disabled?: boolean;
  hint?: string;
}

interface LabelMenuProps {
  className: string;
  style?: React.CSSProperties;
  ariaLabel: string;
  title?: string;
  options: LabelMenuOption[];
  width?: number;
  onSelect: (value: string) => void;
  children: React.ReactNode;
}

/** A coloured cell that opens the same label picker the Boards page uses. */
const LabelMenu: React.FC<LabelMenuProps> = ({ className, style, ariaLabel, title, options, width = 220, onSelect, children }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={ref} type="button" className={className} style={style} aria-label={ariaLabel} title={title} onClick={() => setOpen(!open)}>
        {children}
      </button>
      {open && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)} width={width} align="center">
          <div className="bv-label-list">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className="bv-label-option"
                style={{ background: option.color }}
                disabled={option.disabled}
                title={option.hint}
                onClick={() => {
                  setOpen(false);
                  onSelect(option.value);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </>
  );
};

export default LabelMenu;
