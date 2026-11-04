/**
 * HubSearch — the search field in the Hub top bar (All products and product pages).
 *
 *   <HubSearch />
 *
 * Debounced GET /product-search?q= (from 2 characters), results grouped as Products, Tickets,
 * SOPs, Updates, Vault in a popover. Arrow keys move, Enter opens, Esc closes (a second Esc
 * clears), "/" focuses the field when no other field has focus. A result opens the product on
 * the right tab with the item's query param (?ticket=<key>, ?sop=<id>, ?update=<id>,
 * ?credential=<id>).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hubErrorMessage, hubService, HubTab, SearchResult, SearchResultKind } from '../../services/hub.service';
import Icon, { IconName } from './ui/Icon';
import { productPath } from './hubUtils';
import './hub-search.css';

const GROUPS: { kind: SearchResultKind; label: string; icon: IconName; param?: string; tab: HubTab }[] = [
  { kind: 'product', label: 'Products', icon: 'grid', tab: 'overview' },
  { kind: 'ticket', label: 'Tickets', icon: 'ticket', param: 'ticket', tab: 'tickets' },
  { kind: 'sop', label: 'SOPs', icon: 'book', param: 'sop', tab: 'sops' },
  { kind: 'update', label: 'Updates', icon: 'msg', param: 'update', tab: 'updates' },
  { kind: 'credential', label: 'Vault', icon: 'key', param: 'credential', tab: 'vault' },
];

const DEBOUNCE_MS = 220;
const MIN_CHARS = 2;

export function searchResultPath(r: SearchResult): string {
  const g = GROUPS.find((x) => x.kind === r.kind);
  if (!g || r.kind === 'product') return productPath(r.productSlug);
  return productPath(r.productSlug, r.tab || g.tab, g.param && r.ref ? `${g.param}=${encodeURIComponent(r.ref)}` : undefined);
}

/** Bold the first match of `q` in `text`. */
const Highlight: React.FC<{ text: string; q: string }> = ({ text, q }) => {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
};

const isTypingTarget = (el: Element | null) =>
  !!el &&
  (el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el as HTMLElement).isContentEditable);

let seq = 0;

const HubSearch: React.FC = () => {
  const navigate = useNavigate();
  const [uid] = useState(() => `hub-search-${++seq}`);
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [resultsFor, setResultsFor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [retryTick, setRetryTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const reqSeq = useRef(0);

  const q = value.trim();

  // Debounced fetch.
  useEffect(() => {
    if (q.length < MIN_CHARS) {
      reqSeq.current++;
      setLoading(false);
      setError(null);
      setResults(null);
      setResultsFor('');
      return;
    }
    const mine = ++reqSeq.current;
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const data = await hubService.search(q);
        if (mine !== reqSeq.current) return;
        setResults(Array.isArray(data) ? data : []);
        setResultsFor(q);
        setError(null);
        setActive(0);
      } catch (err) {
        if (mine !== reqSeq.current) return;
        setError(hubErrorMessage(err, "Search isn't available right now."));
        setResults(null);
      } finally {
        if (mine === reqSeq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [q, retryTick]);

  // Results in display order (grouped), with their flat index for keyboard navigation.
  const grouped = useMemo(() => {
    const out: { g: (typeof GROUPS)[number]; items: { r: SearchResult; i: number }[] }[] = [];
    let i = 0;
    GROUPS.forEach((g) => {
      const items = (results || []).filter((r) => r.kind === g.kind).map((r) => ({ r, i: i++ }));
      if (items.length) out.push({ g, items });
    });
    return out;
  }, [results]);
  const flat = useMemo(() => grouped.flatMap((x) => x.items.map((it) => it.r)), [grouped]);

  const close = useCallback((clear = false) => {
    setOpen(false);
    if (clear) setValue('');
  }, []);

  const go = (r: SearchResult) => {
    close(true);
    inputRef.current?.blur();
    navigate(searchResultPath(r));
  };

  // "/" focuses the field when nothing else is being typed in and no dialog is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (isTypingTarget(document.activeElement)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const el = inputRef.current;
      if (!el || el.offsetParent === null) return;
      e.preventDefault();
      el.focus();
      el.select();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Close when clicking or tapping outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  // Keep the active option in view.
  useEffect(() => {
    if (!open) return;
    const el = document.getElementById(`${uid}-opt-${active}`);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  }, [active, open, uid]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        if (q) setOpen(true);
        return;
      }
      if (!flat.length) return;
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!open && q) {
        setOpen(true);
        return;
      }
      const r = flat[active];
      if (r && resultsFor === q) go(r);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (open) setOpen(false);
      else if (value) setValue('');
      else inputRef.current?.blur();
    }
  };

  const showList = open && q.length > 0;
  const stale = resultsFor !== q;
  const activeId = showList && !stale && flat[active] ? `${uid}-opt-${active}` : undefined;

  let content: React.ReactNode;
  if (q.length < MIN_CHARS) {
    content = (
      <div className="hub-spop-msg">
        <p>Keep typing. Search starts from {MIN_CHARS} characters.</p>
      </div>
    );
  } else if (error && !loading) {
    content = (
      <div className="hub-spop-msg">
        <h3>Couldn't search</h3>
        <p>{error}</p>
        <div>
          <button type="button" className="hub-btn hub-btn-sm" onClick={() => setRetryTick((n) => n + 1)}>
            <Icon name="refresh" size={14} />
            Try again
          </button>
        </div>
      </div>
    );
  } else if (!results || (stale && loading && !flat.length)) {
    content = (
      <div className="hub-spop-msg hub-row" role="status">
        <span className="hub-spin" aria-hidden="true" />
        Searching…
      </div>
    );
  } else if (!flat.length) {
    content = stale ? (
      <div className="hub-spop-msg hub-row" role="status">
        <span className="hub-spin" aria-hidden="true" />
        Searching…
      </div>
    ) : (
      <div className="hub-spop-msg">
        <h3>No results for "{resultsFor}"</h3>
        <p>Try a product name, a ticket number like CF-12, an SOP title or a Vault item's name. Archived products aren't searched.</p>
      </div>
    );
  } else {
    content = (
      <div className="hub-spop-list" ref={listRef} role="listbox" id={`${uid}-list`} aria-label="Search results" aria-busy={loading || undefined}>
        {grouped.map(({ g, items }) => (
          <div role="group" aria-labelledby={`${uid}-g-${g.kind}`} key={g.kind}>
            <div className="hub-res-group" id={`${uid}-g-${g.kind}`} role="presentation">
              {g.label}
            </div>
            {items.map(({ r, i }) => (
              <div
                key={`${r.kind}-${r.ref}-${i}`}
                id={`${uid}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                className="hub-res"
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={() => i !== active && setActive(i)}
                onClick={() => go(r)}
              >
                <Icon name={g.icon} size={16} />
                <span className="hub-res-t">
                  <div>
                    <Highlight text={r.title} q={resultsFor} />
                  </div>
                  {r.subtitle ? <div className="hub-res-s">{r.subtitle}</div> : null}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  const status =
    q.length < MIN_CHARS || !open
      ? ''
      : loading
      ? 'Searching'
      : error
      ? "Couldn't search"
      : results
      ? `${flat.length || 'No'} result${flat.length === 1 ? '' : 's'}`
      : '';

  return (
    <div className="hub-search" role="search" ref={rootRef}>
      <Icon name="search" />
      <label htmlFor={uid} className="hub-sr">
        Search products, tickets, SOPs, updates and the Vault
      </label>
      <input
        ref={inputRef}
        id={uid}
        type="search"
        placeholder="Search products, tickets, SOPs…"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={showList ? `${uid}-list` : undefined}
        aria-activedescendant={activeId}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setFocused(true);
          if (q) setOpen(true);
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
      />
      {loading && q.length >= MIN_CHARS ? (
        <span className="hub-spin hub-search-spin" aria-hidden="true" />
      ) : value ? (
        <button
          type="button"
          className="hub-icon-btn hub-search-x"
          aria-label="Clear search"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setValue('');
            setOpen(false);
            inputRef.current?.focus();
          }}
        >
          <Icon name="x" size={14} />
        </button>
      ) : !focused ? (
        <kbd aria-hidden="true">/</kbd>
      ) : null}
      <span className="hub-sr" role="status" aria-live="polite">
        {status}
      </span>
      {showList && (
        <div className="hub-spop">
          {content}
          {flat.length > 0 && !stale ? (
            <div className="hub-spop-foot" aria-hidden="true">
              <span>
                <kbd>↑</kbd> <kbd>↓</kbd> to move
              </span>
              <span>
                <kbd>Enter</kbd> to open
              </span>
              <span>
                <kbd>Esc</kbd> to close
              </span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default HubSearch;
