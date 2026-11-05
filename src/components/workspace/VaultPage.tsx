/**
 * Vault page (/vault): company logins shared by audience, and personal logins only the owner can see.
 * Close sibling of hub/tabs/VaultTab.tsx: reveal hides after 30 s, secrets live only in component
 * state, copy is logged, search matches every word, and a 503 shows the vault-down banner.
 *   `?item=<id>` scrolls to and flashes a row, switching tab when the item is in the other one.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { hubErrorMessage, hubErrorStatus } from '../../services/hub.service';
import { VaultItem, VaultScope, workspaceService } from '../../services/workspace.service';
import FormsTopbar from '../forms/FormsTopbar';
import { fullDateTime, when } from '../hub/hubUtils';
import { useVaultCopy } from '../hub/VaultCopy';
import { Badge } from '../hub/ui/Badge';
import ConfirmDialog from '../hub/ui/ConfirmDialog';
import EmptyState from '../hub/ui/EmptyState';
import Icon from '../hub/ui/Icon';
import OverflowMenu from '../hub/ui/OverflowMenu';
import { SkeletonRows } from '../hub/ui/Skeleton';
import { useDeferredDelete, useHiddenIds, useToast } from '../hub/ui/Toast';
import { useHubUsers } from '../hub/ui/users';
import { firstName, VaultHistoryDrawer, VaultItemModal } from './VaultModals';
import '../hub/hub-vault.css';
import './workspace-vault.css';

const REVEAL_MS = 30000;
const MASK = '••••••••••••';
const TAB_KEY = 'vault-tab';

const TABS: { key: VaultScope; label: string }[] = [
  { key: 'company', label: 'Company' },
  { key: 'personal', label: 'My logins' },
];

const NOTICE: Record<VaultScope, string> = {
  company: 'Shared work logins. Everyone listed can see and update them, and every change is logged.',
  personal:
    "Only you can see these in the app, not even the CEO. They're encrypted, but someone with both the production database and the encryption key could technically decrypt them, so keep this to work logins, not personal banking.",
};

const readTab = (): VaultScope => {
  try {
    return localStorage.getItem(TAB_KEY) === 'personal' ? 'personal' : 'company';
  } catch {
    return 'company';
  }
};

/** True when every word of the query appears in the item's name, username or login page. */
export function vaultItemMatches(c: VaultItem, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = [c.label, c.username, c.loginUrl || ''].join(' ').toLowerCase();
  return words.every((w) => haystack.includes(w));
}

/** "just now", "3 h ago", "yesterday", "on 4 Nov". Reads well after "Password changed". */
const whenPhrase = (value: string) => {
  const w = when(value);
  if (w === 'Yesterday') return 'yesterday';
  return /ago$|now$/.test(w) ? w : `on ${w}`;
};

const changedLine = (c: VaultItem) => {
  const by = (user: VaultItem['createdBy']) => (user ? ` by ${firstName(user.name)}` : '');
  if (c.passwordChangedAt) return { text: `Password changed ${whenPhrase(c.passwordChangedAt)}${by(c.passwordChangedBy)}`, at: c.passwordChangedAt };
  return { text: `Added ${whenPhrase(c.createdAt)}${by(c.createdBy)}`, at: c.createdAt };
};

const VaultPage: React.FC = () => {
  const toast = useToast();
  const { copy, fallback } = useVaultCopy();
  const hidden = useHiddenIds();
  const deferredDelete = useDeferredDelete();
  const { byId, me } = useHubUsers();
  const [params, setParams] = useSearchParams();
  const deepLink = params.get('item');

  const [tab, setTab] = useState<VaultScope>(readTab);
  const [items, setItems] = useState<VaultItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vaultDown, setVaultDown] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<Record<string, 'reveal' | 'copy' | undefined>>({});
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [flashId, setFlashId] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const [modal, setModal] = useState<{ item: VaultItem | null } | null>(null);
  const [history, setHistory] = useState<VaultItem | null>(null);
  const [deleting, setDeleting] = useState<VaultItem | null>(null);

  const timers = useRef<Record<string, number>>({});
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const loadSeq = useRef(0);
  const lookup = useRef<{ id: string; done: boolean } | null>(null);
  const mounted = useRef(true);

  // Reads the tab from a ref: a delete can commit seconds later, after someone switched tab.
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setError(null);
    try {
      const list = await workspaceService.listVaultItems(tabRef.current);
      if (seq === loadSeq.current) setItems(list);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      const msg = hubErrorMessage(err, "Couldn't load the vault.");
      if (hubErrorStatus(err) === 503) setVaultDown(msg);
      setError(msg);
    }
  }, []);

  useEffect(() => {
    load();
  }, [tab, load]);

  // Clear every reveal timer when leaving the page (secrets live only in this component's state).
  useEffect(() => {
    mounted.current = true;
    const live = timers.current;
    return () => {
      mounted.current = false;
      Object.values(live).forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const hide = (id: string) => {
    window.clearTimeout(timers.current[id]);
    delete timers.current[id];
    setRevealed((r) => {
      if (!(id in r)) return r;
      const next = { ...r };
      delete next[id];
      return next;
    });
  };

  const switchTab = (next: VaultScope) => {
    Object.values(timers.current).forEach((t) => window.clearTimeout(t));
    timers.current = {};
    loadSeq.current++; // drop any response still coming for the old tab
    setRevealed({});
    setItems(null);
    setError(null);
    setQ('');
    setTab(next);
  };

  const pickTab = (next: VaultScope) => {
    if (next === tab) return;
    switchTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const clearDeepLink = () => {
    const next = new URLSearchParams(window.location.search);
    next.delete('item');
    setParams(next, { replace: true });
  };

  // Deep link: ?item=<id>
  useEffect(() => {
    if (!deepLink || !items) return;
    const notFound = () => {
      toast.show("That login isn't here any more. It may have been deleted, or you may not have access.", { kind: 'info' });
      clearDeepLink();
    };
    if (!items.some((c) => c.id === deepLink)) {
      if (lookup.current?.id === deepLink) {
        if (lookup.current.done) notFound();
        return;
      }
      // Not on this tab: look on the other one before giving up.
      const state = { id: deepLink, done: false };
      lookup.current = state;
      const other: VaultScope = tab === 'company' ? 'personal' : 'company';
      workspaceService
        .listVaultItems(other)
        .then((list) => {
          state.done = true;
          if (!mounted.current) return;
          if (list.some((c) => c.id === deepLink)) switchTab(other);
          else notFound();
        })
        .catch(() => {
          state.done = true;
          if (mounted.current) notFound();
        });
      return;
    }
    const el = document.getElementById(`ws-vitem-${deepLink}`);
    if (!el) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    el.focus({ preventScroll: true });
    setFlashId(deepLink);
    const t = window.setTimeout(() => {
      setFlashId(null);
      clearDeepLink();
    }, 2600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink, items]);

  const failToast = (err: unknown, base: string) => {
    const msg = hubErrorMessage(err);
    const status = hubErrorStatus(err);
    if (status === 503) {
      setVaultDown(msg);
      toast.error(msg);
    } else if (status === 403) {
      toast.error(msg);
    } else {
      toast.error(`${base} ${msg}`);
      if (status === 404) load(); // access was removed or it was deleted: drop the stale row
    }
  };

  const reveal = async (c: VaultItem) => {
    if (revealed[c.id] !== undefined) {
      hide(c.id);
      return;
    }
    if (working[c.id]) return;
    setWorking((w) => ({ ...w, [c.id]: 'reveal' }));
    try {
      const { secret } = await workspaceService.revealVaultItem(c.id, 'reveal');
      if (!mounted.current) return;
      setRevealed((r) => ({ ...r, [c.id]: secret }));
      window.clearTimeout(timers.current[c.id]);
      timers.current[c.id] = window.setTimeout(() => hide(c.id), REVEAL_MS);
      setVaultDown(null);
      toast.show('Password shown. It hides again after 30 seconds.', { kind: 'info' });
    } catch (err) {
      failToast(err, "Couldn't reveal the password.");
    } finally {
      setWorking((w) => ({ ...w, [c.id]: undefined }));
    }
  };

  const copySecret = async (c: VaultItem) => {
    if (working[c.id]) return;
    setWorking((w) => ({ ...w, [c.id]: 'copy' }));
    try {
      const { secret } = await workspaceService.revealVaultItem(c.id, 'copy');
      setVaultDown(null);
      await copy(secret, 'Password');
    } catch (err) {
      failToast(err, "Couldn't copy the password.");
    } finally {
      setWorking((w) => ({ ...w, [c.id]: undefined }));
    }
  };

  /** "Everyone", "Designer, Developer", "3 people", "Just you and admins". */
  const accessBadge = (c: VaultItem) => {
    const { everyone, departments, userIds } = c.access;
    if (everyone) return { text: 'Everyone', title: 'Everyone in the company' };
    if (!departments.length && !userIds.length) {
      const text =
        c.createdBy?.id === me?.id
          ? 'Just you and admins'
          : c.createdBy
            ? `Just ${firstName(c.createdBy.name)} and admins`
            : 'Just the owner and admins';
      return { text, title: 'Only the person who added it, founders and project managers' };
    }
    const parts: string[] = [];
    if (departments.length) parts.push(departments.length > 2 ? `${departments.slice(0, 2).join(', ')} +${departments.length - 2}` : departments.join(', '));
    if (userIds.length) parts.push(`${userIds.length} ${userIds.length === 1 ? 'person' : 'people'}`);
    const names = userIds.map((id) => byId(id)?.name).filter(Boolean);
    return { text: parts.join(', '), title: [...departments, ...names].join(', ') };
  };

  const all = (items || []).filter((c) => !hidden.has(c.id));
  const filtering = !deepLink && q.trim() !== '';
  const list = filtering ? all.filter((c) => vaultItemMatches(c, q)) : all;
  const isCompany = tab === 'company';
  const addLogin = () => setModal({ item: null });
  const retry = () => {
    setVaultDown(null);
    load();
  };

  return (
    <>
      <FormsTopbar crumbs={[{ label: 'Vault' }]} />
      <main className="hub-page ws-vault" id="vault-main">
        <div className="hub-ph">
          <div className="hub-ph-text">
            <h1>Vault</h1>
          </div>
          <div className="hub-ph-actions">
            <button type="button" className="hub-btn hub-btn-primary" onClick={addLogin}>
              <Icon name="plus" />
              Add login
            </button>
          </div>
        </div>

        <div className="hub-sec">
          <div className="hub-vbar">
            <div className="hub-seg" role="group" aria-label="Which logins to show">
              {TABS.map((t) => (
                <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => pickTab(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>
            {!error && all.length > 0 && (
              <>
                <div className="hub-vq">
                  <Icon name="search" />
                  <label className="hub-sr" htmlFor="ws-vault-q">
                    Search the vault
                  </label>
                  <input
                    id="ws-vault-q"
                    className="hub-inp"
                    type="search"
                    placeholder="Search by name, username or login page"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' && q) {
                        e.stopPropagation();
                        setQ('');
                      }
                    }}
                    autoComplete="off"
                  />
                </div>
                <span className="hub-vcount" role="status">
                  {filtering ? `${list.length} of ${all.length} shown` : `${all.length} saved`}
                </span>
              </>
            )}
          </div>

          <div className="hub-notice hub-info">
            <Icon name="key" />
            <div className="hub-grow">{NOTICE[tab]}</div>
          </div>

          {vaultDown ? (
            <div className="hub-notice hub-crit" role="alert">
              <Icon name="alert" />
              <div className="hub-grow">
                <b>The vault isn't available.</b> {vaultDown}{' '}
                {error ? (
                  <button type="button" className="hub-link" onClick={retry}>
                    Try again
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {error ? (
            vaultDown ? null : (
              <div className="hub-card">
                <EmptyState icon="alert" title="Couldn't load the vault" text={error} actionLabel="Try again" actionIcon="refresh" onAction={retry} />
              </div>
            )
          ) : items === null ? (
            <SkeletonRows rows={3} />
          ) : list.length ? (
            <div className="hub-card">
              {list.map((c) => {
                const shown = revealed[c.id];
                const busy = working[c.id];
                const line = changedLine(c);
                const badge = isCompany ? accessBadge(c) : null;
                const notesOpen = !!openNotes[c.id];
                return (
                  <div key={c.id} id={`ws-vitem-${c.id}`} tabIndex={-1} className={`hub-vrow ws-vrow${flashId === c.id ? ' hub-vflash' : ''}`}>
                    <div className="hub-vname">
                      <b>{c.label}</b>
                      {badge ? (
                        <span className="hub-vtags">
                          <Badge plain className="ws-vbadge" title={badge.title}>
                            {badge.text}
                          </Badge>
                        </span>
                      ) : null}
                      <span className="hub-vlog" title={fullDateTime(line.at)}>
                        {line.text}
                      </span>
                      {c.notes ? (
                        <button
                          type="button"
                          className="hub-link ws-vnotes-btn"
                          aria-expanded={notesOpen}
                          aria-controls={`ws-vnotes-${c.id}`}
                          onClick={() => setOpenNotes((n) => ({ ...n, [c.id]: !notesOpen }))}
                        >
                          {notesOpen ? 'Hide notes' : 'Show notes'}
                        </button>
                      ) : null}
                    </div>

                    <div className="hub-vfield">
                      <span className="hub-vlabel">Username</span>
                      <span className="hub-mono" title={c.username}>
                        {c.username}
                      </span>
                      <button type="button" className="hub-icon-btn hub-sm" onClick={() => copy(c.username, 'Username')} aria-label={`Copy username for ${c.label}`}>
                        <Icon name="copy" size={14} />
                      </button>
                    </div>

                    <div className="hub-vfield">
                      <span className="hub-vlabel">Password</span>
                      <span className={`hub-mono${shown !== undefined ? ' hub-vsecret' : ''}`} aria-live="polite">
                        {shown !== undefined ? shown : <span aria-label="Password hidden">{MASK}</span>}
                      </span>
                      <button
                        type="button"
                        className="hub-icon-btn hub-sm"
                        onClick={() => reveal(c)}
                        disabled={busy === 'reveal'}
                        aria-label={`${shown !== undefined ? 'Hide' : 'Reveal'} password for ${c.label}`}
                        title={shown !== undefined ? 'Hide' : 'Reveal'}
                      >
                        {busy === 'reveal' ? <span className="hub-spin" aria-hidden="true" /> : <Icon name={shown !== undefined ? 'eyeoff' : 'eye'} size={15} />}
                      </button>
                      <button
                        type="button"
                        className="hub-icon-btn hub-sm"
                        onClick={() => copySecret(c)}
                        disabled={busy === 'copy'}
                        aria-label={`Copy password for ${c.label}`}
                        title="Copy"
                      >
                        {busy === 'copy' ? <span className="hub-spin" aria-hidden="true" /> : <Icon name="copy" size={14} />}
                      </button>
                    </div>

                    <div className="hub-vact">
                      <span className="hub-vmore">
                        <OverflowMenu
                          label={`More actions for ${c.label}`}
                          items={[
                            {
                              label: 'Open login page',
                              icon: 'ext',
                              hidden: !c.loginUrl,
                              onSelect: () => c.loginUrl && window.open(c.loginUrl, '_blank', 'noopener,noreferrer'),
                            },
                            { label: 'Edit', icon: 'edit', onSelect: () => setModal({ item: c }) },
                            { label: 'History', icon: 'info', onSelect: () => setHistory(c) },
                            { label: 'Delete login', icon: 'trash', danger: true, hidden: !c.canManage, onSelect: () => setDeleting(c) },
                          ]}
                        />
                      </span>
                    </div>

                    {c.notes && notesOpen ? (
                      <div className="ws-vnotes" id={`ws-vnotes-${c.id}`}>
                        {c.notes}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : filtering ? (
            <div className="hub-card">
              <EmptyState
                icon="search"
                title="Nothing matches"
                text={`No saved logins match "${q.trim()}". Try another word.`}
                actionLabel="Clear search"
                actionIcon="x"
                onAction={() => setQ('')}
              />
            </div>
          ) : (
            <div className="hub-card">
              {isCompany ? (
                <EmptyState
                  icon="key"
                  title="No company logins yet"
                  text="Add one, like Gmail or Canva, so nobody has to ask the CEO."
                  actionLabel="Add login"
                  onAction={addLogin}
                />
              ) : (
                <EmptyState icon="key" title="Keep your own work logins here" text="Only you can see them." actionLabel="Add login" onAction={addLogin} />
              )}
            </div>
          )}
        </div>
      </main>

      {modal && (
        <VaultItemModal
          scope={tab}
          item={modal.item}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            if (modal.item) hide(saved.id);
            load();
          }}
          onVaultDown={setVaultDown}
        />
      )}
      {history && (
        <VaultHistoryDrawer
          item={history}
          onClose={() => setHistory(null)}
          onRestored={(saved) => {
            hide(saved.id);
            load();
          }}
          onVaultDown={setVaultDown}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this login?"
          body={
            <>
              <b>{deleting.label}</b> will be removed from the Vault{isCompany ? ' for everyone who can see it' : ''}. You can undo this for a few seconds afterwards.
            </>
          }
          confirmLabel="Delete login"
          onConfirm={() => {
            const c = deleting;
            hide(c.id);
            deferredDelete({
              message: `${c.label} deleted`,
              hide: () => hidden.add(c.id),
              restore: () => hidden.remove(c.id),
              commit: () => workspaceService.deleteVaultItem(c.id),
              onCommitted: load,
              errorMessage: `Couldn't delete ${c.label}.`,
            });
          }}
          onClose={() => setDeleting(null)}
        />
      )}
      {fallback}
    </>
  );
};

export default VaultPage;
