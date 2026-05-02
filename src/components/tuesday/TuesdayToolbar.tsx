import React, { useEffect, useRef, useState } from 'react';
import { FaSearch, FaChevronDown } from 'react-icons/fa';
import { TuesdayFilterControls, TuesdayFilterState } from './hooks/useTuesdayFilters';

/*
 * Tuesday toolbar — search, filter chips, expand/collapse buttons.
 *
 * State + URL persistence live in `useTuesdayFilters`. This component
 * is pure UI: it reads state via the controls object, fires callbacks
 * on change, and otherwise carries no internal state besides which
 * dropdown is currently open.
 *
 * Filter chip dropdowns mirror InlineEditDropdown's visual treatment
 * (absolute-positioned menu, surface base, var(--td-shadow-panel),
 * z-index 200). Search input + chips share the --td-* token palette.
 *
 * Filtering logic is NOT wired in this component — that's Step 2.
 */

export interface FilterOption {
  value: string;
  label: React.ReactNode;
  hint?: string;        // e.g. role on a PM, color dot color on a status
}

export interface ToolbarOptions {
  department: FilterOption[];
  pm: FilterOption[];
  status: FilterOption[];
  priority: FilterOption[];
  assignee: FilterOption[];
}

interface Props {
  controls: TuesdayFilterControls;
  options: ToolbarOptions;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

const SEARCH_DEBOUNCE_MS = 200;

const TuesdayToolbar: React.FC<Props> = ({ controls, options, onExpandAll, onCollapseAll, }) => {
  const { state, setSearch, toggleFilter, clearAll, anyActive } = controls;

  // Debounced search input — local state mirrors URL-backed state, but
  // commits with a 200ms delay so URL writes don't fire on every keystroke.
  const [searchDraft, setSearchDraft] = useState(state.search);
  useEffect(() => { setSearchDraft(state.search); }, [state.search]);
  useEffect(() => {
    if (searchDraft === state.search) return;
    const timer = setTimeout(() => setSearch(searchDraft), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchDraft, state.search, setSearch]);

  return (
    <div className="tuesday-toolbar">
      <div className="tuesday-toolbar-left">
        <div className="tuesday-search">
          <FaSearch className="tuesday-search-icon" size={11} />
          <input
            className="tuesday-search-input"
            placeholder="Search tasks…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setSearchDraft(''); setSearch(''); }
            }}
          />
        </div>

        <FilterChip
          label="Department"
          filterKey="department"
          options={options.department}
          selected={state.department}
          onToggle={toggleFilter}
        />
        <FilterChip
          label="PM"
          filterKey="pm"
          options={options.pm}
          selected={state.pm}
          onToggle={toggleFilter}
        />
        <FilterChip
          label="Status"
          filterKey="status"
          options={options.status}
          selected={state.status}
          onToggle={toggleFilter}
        />
        <FilterChip
          label="Priority"
          filterKey="priority"
          options={options.priority}
          selected={state.priority}
          onToggle={toggleFilter}
        />
        <FilterChip
          label="Assignee"
          filterKey="assignee"
          options={options.assignee}
          selected={state.assignee}
          onToggle={toggleFilter}
        />

        {anyActive && (
          <button type="button" className="tuesday-clear-filters" onClick={clearAll}>
            Clear filters
          </button>
        )}
      </div>

      <div className="tuesday-toolbar-right">
        <button type="button" className="tuesday-expand-btn-small" onClick={onExpandAll}>
          Expand all
        </button>
        <span className="tuesday-toolbar-divider">|</span>
        <button type="button" className="tuesday-expand-btn-small" onClick={onCollapseAll}>
          Collapse all
        </button>
      </div>
    </div>
  );
};

interface ChipProps {
  label: string;
  filterKey: keyof TuesdayFilterState;
  options: FilterOption[];
  selected: Set<string>;
  onToggle: (key: keyof TuesdayFilterState, value: string) => void;
}

const FilterChip: React.FC<ChipProps> = ({ label, filterKey, options, selected, onToggle }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const count = selected.size;

  return (
    <div ref={ref} className="tuesday-chip-host">
      <button
        type="button"
        className={`tuesday-chip ${count > 0 ? 'tuesday-chip--active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {label}{count > 0 ? ` (${count})` : ''}
        <FaChevronDown size={9} className="tuesday-chip-caret" />
      </button>
      {open && (
        <div className="tuesday-chip-menu">
          {options.length === 0 ? (
            <div className="tuesday-chip-empty">No options</div>
          ) : (
            options.map((opt) => {
              const checked = selected.has(opt.value);
              return (
                <label key={opt.value} className="tuesday-chip-option">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(filterKey, opt.value)}
                  />
                  <span className="tuesday-chip-option-label">{opt.label}</span>
                  {opt.hint && <span className="tuesday-chip-option-hint">{opt.hint}</span>}
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default TuesdayToolbar;
