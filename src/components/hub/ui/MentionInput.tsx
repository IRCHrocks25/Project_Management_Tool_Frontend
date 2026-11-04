/**
 * MentionInput — textarea (or single-line input) with @mention autocomplete.
 *
 *   <MentionInput value={body} onChange={setBody} placeholder="Type @ to mention someone" rows={5} />
 *   <MentionInput multiline={false} value={reply} onChange={setReply} ariaLabel="Reply to this update" />
 *
 * `value` / `onChange` use the stored format `@Name[[USER_ID:uuid]]`; the field itself shows a
 * readable "@Name". Type @, then arrow keys + Enter/Tab (or click) to pick a person; Esc closes the
 * list. Editing a mention's text turns it back into plain text. People come from useHubUsers().
 * Other props: id, invalid, describedBy, disabled, autoFocus, inputRef, onKeyDown.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { HubUser } from '../../../services/hub.service';
import { MENTION_RE } from '../hubUtils';
import { Avatar } from './Avatar';
import { HubPortal } from './layers';
import { useHubUsers } from './users';

type Mention = { id: string; name: string };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function markupToDisplay(markup: string): { text: string; mentions: Mention[] } {
  const mentions: Mention[] = [];
  const text = String(markup || '').replace(new RegExp(MENTION_RE.source, 'g'), (_all, name: string, id: string) => {
    if (!mentions.some((x) => x.id === id && x.name === name)) mentions.push({ id, name });
    return `@${name}`;
  });
  return { text, mentions };
}

export function displayToMarkup(text: string, mentions: Mention[]): string {
  if (!mentions.length) return text;
  const byName: Record<string, string> = {};
  mentions.forEach((m) => {
    byName[m.name] = m.id;
  });
  const names = Object.keys(byName).sort((a, b) => b.length - a.length);
  const re = new RegExp(`@(${names.map(escapeRe).join('|')})(?![A-Za-z0-9\\u00C0-\\u024F_])`, 'g');
  return text.replace(re, (_all, name: string) => `@${name}[[USER_ID:${byName[name]}]]`);
}

let seq = 0;

export interface MentionInputProps {
  value: string;
  onChange: (markup: string) => void;
  multiline?: boolean;
  rows?: number;
  id?: string;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  ariaLabel?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement | HTMLInputElement>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
}

interface Query {
  start: number;
  end: number;
  q: string;
}

const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  multiline = true,
  rows = 4,
  id,
  placeholder,
  invalid,
  describedBy,
  ariaLabel,
  disabled,
  autoFocus,
  className,
  inputRef,
  onKeyDown,
}) => {
  const { users } = useHubUsers();
  const ownRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const ref = (inputRef || ownRef) as React.RefObject<HTMLTextAreaElement & HTMLInputElement>;
  const [uid] = useState(() => `hub-mi-${++seq}`);
  const initial = useMemo(() => markupToDisplay(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [text, setText] = useState(initial.text);
  const [mentions, setMentions] = useState<Mention[]>(initial.mentions);
  const lastEmitted = useRef(value);
  const [query, setQuery] = useState<Query | null>(null);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<React.CSSProperties>({});
  const caretAfter = useRef<number | null>(null);

  // Re-sync when the parent replaces the value (e.g. reset after posting).
  useEffect(() => {
    if (value !== lastEmitted.current) {
      const d = markupToDisplay(value);
      setText(d.text);
      setMentions(d.mentions);
      lastEmitted.current = value;
      setQuery(null);
    }
  }, [value]);

  useLayoutEffect(() => {
    if (caretAfter.current != null && ref.current) {
      const c = caretAfter.current;
      caretAfter.current = null;
      ref.current.focus();
      ref.current.setSelectionRange(c, c);
    }
  });

  const emit = (nextText: string, nextMentions: Mention[]) => {
    // Drop mentions whose "@Name" no longer appears in the text.
    const kept = nextMentions.filter((m) => nextText.indexOf(`@${m.name}`) >= 0);
    setText(nextText);
    setMentions(kept);
    const markup = displayToMarkup(nextText, kept);
    lastEmitted.current = markup;
    onChange(markup);
  };

  const matches: HubUser[] = useMemo(() => {
    if (!query) return [];
    const q = query.q.toLowerCase();
    return users
      .filter((u) => {
        const n = u.name.toLowerCase();
        return !q || n.startsWith(q) || n.split(/\s+/).some((w) => w.startsWith(q));
      })
      .slice(0, 8);
  }, [query, users]);

  const open = !!query && matches.length > 0;

  const detect = (el: HTMLTextAreaElement | HTMLInputElement) => {
    const caret = el.selectionStart ?? el.value.length;
    const before = el.value.slice(0, caret);
    const m = /(^|[\s(])@([^@\n[\]]{0,30})$/.exec(before);
    if (!m) {
      setQuery(null);
      return;
    }
    const start = caret - m[2].length - 1;
    setQuery({ start, end: caret, q: m[2] });
    setActive(0);
  };

  const place = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(360, Math.max(240, r.width));
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const below = window.innerHeight - r.bottom;
    setPos(
      below < 280 && r.top > below
        ? { position: 'fixed', left, width, bottom: window.innerHeight - r.top + 4, top: 'auto' }
        : { position: 'fixed', left, width, top: r.bottom + 4 },
    );
  };

  useEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (u: HubUser) => {
    if (!query) return;
    const insert = `@${u.name} `;
    const next = text.slice(0, query.start) + insert + text.slice(query.end);
    caretAfter.current = query.start + insert.length;
    setQuery(null);
    emit(next, mentions.some((m) => m.id === u.id && m.name === u.name) ? mentions : [...mentions, { id: u.id, name: u.name }]);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pick(matches[Math.min(active, matches.length - 1)]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setQuery(null);
        return;
      }
    }
    onKeyDown?.(e);
  };

  const common = {
    id,
    ref,
    value: text,
    placeholder,
    disabled,
    autoFocus,
    className: className || `hub-inp hub-w-full`,
    'aria-invalid': invalid ? ('true' as const) : ('false' as const),
    'aria-describedby': describedBy,
    'aria-label': ariaLabel,
    role: 'combobox',
    'aria-autocomplete': 'list' as const,
    'aria-expanded': open,
    'aria-controls': open ? `${uid}-list` : undefined,
    'aria-activedescendant': open ? `${uid}-opt-${active}` : undefined,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      emit(e.target.value, mentions);
      detect(e.target);
    },
    onKeyDown: handleKey,
    onClick: (e: React.MouseEvent<HTMLTextAreaElement | HTMLInputElement>) => detect(e.currentTarget),
    onBlur: () => window.setTimeout(() => setQuery(null), 150),
  };

  return (
    <div className="hub-mention-wrap">
      {multiline ? <textarea {...common} rows={rows} /> : <input {...common} type="text" autoComplete="off" />}
      {open && (
        <HubPortal>
          <div className="hub-mpop" style={pos} role="listbox" id={`${uid}-list`} aria-label="People you can mention">
            {matches.map((u, i) => (
              <div
                key={u.id}
                id={`${uid}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(u)}
              >
                <Avatar user={u} />
                <span>{u.name}</span>
                {u.role ? <small>{u.role}</small> : null}
              </div>
            ))}
          </div>
        </HubPortal>
      )}
    </div>
  );
};

export default MentionInput;
