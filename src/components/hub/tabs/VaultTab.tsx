/**
 * Vault tab — encrypted logins and API keys for the product.
 *   Rows: name, environment, Team only / Shareable badges, last activity; username + copy;
 *   password masked with Reveal (hides after 30 s) and Copy (logged as a copy); Share on
 *   shareable items; overflow Edit / Activity / Delete (confirm + Undo).
 *   People without reveal rights see the item with the password masked and a short explanation.
 *   `?credential=<id>` scrolls to and highlights a row (filters are ignored while it does).
 *   Search matches name, username, login page and environment; every word must match.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Credential, CredentialEnvironment, hubErrorMessage, hubErrorStatus, hubService, ProductDetail } from '../../../services/hub.service';
import { usePrimaryAction } from '../primaryAction';
import { CREDENTIAL_ENV, fullDateTime, when } from '../hubUtils';
import { useVaultCopy } from '../VaultCopy';
import { Badge } from '../ui/Badge';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import Icon from '../ui/Icon';
import OverflowMenu from '../ui/OverflowMenu';
import { SkeletonRows } from '../ui/Skeleton';
import { useDeferredDelete, useHiddenIds, useToast } from '../ui/Toast';
import { actorName, CREDENTIAL_ACTION_TEXT, CredentialActivityDrawer, CredentialModal, ShareModal } from './CredentialModals';
import '../hub-vault.css';

export interface VaultTabProps {
  product: ProductDetail;
  onChanged: () => void;
}

const REVEAL_MS = 30000;
const MASK = '••••••••••••';

/** True when every word of the query appears in the credential's name, username, login page or environment. */
export function credentialMatches(c: Credential, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = [c.label, c.username, c.loginUrl || '', CREDENTIAL_ENV[c.environment] || c.environment]
    .join(' ')
    .toLowerCase();
  return words.every((w) => haystack.includes(w));
}

const VaultTab: React.FC<VaultTabProps> = ({ product, onChanged }) => {
  const toast = useToast();
  const { copy, fallback } = useVaultCopy();
  const hidden = useHiddenIds();
  const deferredDelete = useDeferredDelete();
  const [params, setParams] = useSearchParams();
  const deepLink = params.get('credential');

  const [creds, setCreds] = useState<Credential[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vaultDown, setVaultDown] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<Record<string, 'reveal' | 'copy' | undefined>>({});
  const timers = useRef<Record<string, number>>({});
  const [flashId, setFlashId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [env, setEnv] = useState<CredentialEnvironment | ''>('');

  const [modal, setModal] = useState<{ credential: Credential | null } | null>(null);
  const [sharing, setSharing] = useState<Credential | null>(null);
  const [activity, setActivity] = useState<Credential | null>(null);
  const [deleting, setDeleting] = useState<Credential | null>(null);

  usePrimaryAction({ label: 'Add credential', icon: 'plus', onClick: () => setModal({ credential: null }) });

  const load = useCallback(async () => {
    setError(null);
    try {
      setCreds(await hubService.listCredentials(product.id));
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't load the vault."));
    }
  }, [product.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Clear every reveal timer when leaving the tab (secrets live only in this component's state).
  useEffect(
    () => () => {
      Object.values(timers.current).forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  // Deep link: ?credential=<id>
  useEffect(() => {
    if (!deepLink || !creds) return;
    const el = document.getElementById(`hub-cred-${deepLink}`);
    if (!el) {
      toast.show("That credential isn't here any more. It may have been deleted.", { kind: 'info' });
      const next = new URLSearchParams(params);
      next.delete('credential');
      setParams(next, { replace: true });
      return;
    }
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    el.focus({ preventScroll: true });
    setFlashId(deepLink);
    const t = window.setTimeout(() => {
      setFlashId(null);
      const next = new URLSearchParams(params);
      next.delete('credential');
      setParams(next, { replace: true });
    }, 2600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink, creds]);

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

  const failToast = (err: unknown, base: string) => {
    const msg = hubErrorMessage(err);
    if (hubErrorStatus(err) === 503) {
      setVaultDown(msg);
      toast.error(msg);
    } else if (hubErrorStatus(err) === 403) {
      toast.error(msg);
    } else {
      toast.error(`${base} ${msg}`);
    }
  };

  const reveal = async (c: Credential) => {
    if (revealed[c.id] !== undefined) {
      hide(c.id);
      return;
    }
    if (working[c.id]) return;
    setWorking((w) => ({ ...w, [c.id]: 'reveal' }));
    try {
      const { secret } = await hubService.revealCredential(product.id, c.id, 'reveal');
      setRevealed((r) => ({ ...r, [c.id]: secret }));
      window.clearTimeout(timers.current[c.id]);
      timers.current[c.id] = window.setTimeout(() => hide(c.id), REVEAL_MS);
      toast.show('Password shown. It hides again after 30 seconds.', { kind: 'info' });
      load();
    } catch (err) {
      failToast(err, "Couldn't reveal the password.");
    } finally {
      setWorking((w) => ({ ...w, [c.id]: undefined }));
    }
  };

  const copySecret = async (c: Credential) => {
    if (working[c.id]) return;
    setWorking((w) => ({ ...w, [c.id]: 'copy' }));
    try {
      const { secret } = await hubService.revealCredential(product.id, c.id, 'copy');
      await copy(secret, 'Password');
      load();
    } catch (err) {
      failToast(err, "Couldn't copy the password.");
    } finally {
      setWorking((w) => ({ ...w, [c.id]: undefined }));
    }
  };

  const afterWrite = () => {
    load();
    onChanged();
  };

  const all = (creds || []).filter((c) => !hidden.has(c.id));
  const filtering = !deepLink && (q.trim() !== '' || env !== '');
  const list = filtering ? all.filter((c) => (!env || c.environment === env) && credentialMatches(c, q)) : all;
  const clearFilters = () => {
    setQ('');
    setEnv('');
  };

  const lastActivity = (c: Credential) =>
    c.lastEvent ? (
      <span className="hub-vlog" title={fullDateTime(c.lastEvent.at)}>
        {actorName(c.lastEvent.user, c.lastEvent.action)} {CREDENTIAL_ACTION_TEXT[c.lastEvent.action] || c.lastEvent.action} · {when(c.lastEvent.at)}
      </span>
    ) : c.canReveal ? (
      <span className="hub-vlog">No activity yet</span>
    ) : null;

  return (
    <div className="hub-sec">
      <div className="hub-notice hub-info">
        <Icon name="key" />
        <div className="hub-grow">
          Every password here is encrypted. Only people on {product.name}, founders and project managers can reveal it, and every reveal,
          copy and share is logged.
        </div>
      </div>

      {vaultDown ? (
        <div className="hub-notice hub-crit" role="alert">
          <Icon name="alert" />
          <div className="hub-grow">
            <b>The vault isn't available.</b> {vaultDown}
          </div>
        </div>
      ) : null}

      {!error && all.length > 0 && (
        <div className="hub-vbar">
          <div className="hub-vq">
            <Icon name="search" />
            <label className="hub-sr" htmlFor="hub-vault-q">
              Search the vault
            </label>
            <input
              id="hub-vault-q"
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
          <div className="hub-venv">
            <label className="hub-sr" htmlFor="hub-vault-env">
              Filter by environment
            </label>
            <select id="hub-vault-env" className="hub-inp" value={env} onChange={(e) => setEnv(e.target.value as CredentialEnvironment | '')}>
              <option value="">All environments</option>
              {(Object.keys(CREDENTIAL_ENV) as CredentialEnvironment[]).map((k) => (
                <option key={k} value={k}>
                  {CREDENTIAL_ENV[k]}
                </option>
              ))}
            </select>
          </div>
          <span className="hub-vcount" role="status">
            {filtering ? `${list.length} of ${all.length} shown` : `${all.length} saved`}
          </span>
        </div>
      )}

      {error ? (
        <div className="hub-card">
          <EmptyState icon="alert" title="Couldn't load the vault" text={error} actionLabel="Try again" actionIcon="refresh" onAction={load} />
        </div>
      ) : creds === null ? (
        <SkeletonRows rows={3} />
      ) : list.length ? (
        <div className="hub-card">
          {list.map((c) => {
            const shown = revealed[c.id];
            const busy = working[c.id];
            return (
              <div key={c.id} id={`hub-cred-${c.id}`} tabIndex={-1} className={`hub-vrow${flashId === c.id ? ' hub-vflash' : ''}`}>
                <div className="hub-vname">
                  <b>{c.label}</b>
                  <span className="hub-vtags">
                    <Badge plain>{CREDENTIAL_ENV[c.environment] || c.environment}</Badge>
                    {c.shareable ? <Badge tone="acc">Shareable with client</Badge> : <Badge plain>Team only</Badge>}
                  </span>
                  {lastActivity(c)}
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

                {c.canReveal ? (
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
                ) : (
                  <div className="hub-vfield">
                    <span className="hub-vlabel">Password</span>
                    <span className="hub-vlocked">
                      <span className="hub-mono" aria-label="Password hidden">
                        {MASK}
                      </span>
                      <small>Only people on this product can see this password.</small>
                    </span>
                  </div>
                )}

                <div className="hub-vact">
                  {c.shareable && c.canReveal ? (
                    <button type="button" className="hub-btn hub-btn-sm" onClick={() => setSharing(c)} aria-label={`Share ${c.label} with the client`}>
                      <Icon name="share" size={14} />
                      Share
                    </button>
                  ) : null}
                  <span className="hub-vmore">
                    <OverflowMenu
                      label={`More actions for ${c.label}`}
                      items={[
                        { label: 'Edit', icon: 'edit', hidden: !c.canReveal, onSelect: () => setModal({ credential: c }) },
                        { label: 'Activity', icon: 'info', hidden: !c.canReveal, onSelect: () => setActivity(c) },
                        {
                          label: 'Open login page',
                          icon: 'ext',
                          hidden: !c.loginUrl,
                          onSelect: () => c.loginUrl && window.open(c.loginUrl, '_blank', 'noopener,noreferrer'),
                        },
                        { label: 'Delete credential', icon: 'trash', danger: true, hidden: !c.canReveal, onSelect: () => setDeleting(c) },
                      ]}
                    />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : filtering ? (
        <div className="hub-card">
          <EmptyState
            icon="search"
            title="Nothing matches"
            text={`No saved logins match${q.trim() ? ` "${q.trim()}"` : ''}${env ? ` in ${CREDENTIAL_ENV[env]}` : ''}. Try another word, or look in all environments.`}
            actionLabel="Clear search"
            actionIcon="x"
            onAction={clearFilters}
          />
        </div>
      ) : (
        <div className="hub-card">
          <EmptyState
            icon="key"
            title="No credentials saved"
            text="Store logins and API keys for this product so the team stops asking for them in chat."
            actionLabel="Add credential"
            onAction={() => setModal({ credential: null })}
          />
        </div>
      )}

      {modal && (
        <CredentialModal
          product={product}
          credential={modal.credential}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            if (modal.credential) hide(saved.id);
            afterWrite();
          }}
          onVaultDown={setVaultDown}
        />
      )}
      {sharing && (
        <ShareModal product={product} credential={sharing} onClose={() => setSharing(null)} onShared={load} onVaultDown={setVaultDown} />
      )}
      {activity && (
        <CredentialActivityDrawer product={product} credential={activity} onClose={() => setActivity(null)} onChanged={load} />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this credential?"
          body={
            <>
              <b>{deleting.label}</b> will be removed from the Vault, along with its share links. Demo accounts linked to it will show "No password
              saved". You can undo this for a few seconds afterwards.
            </>
          }
          confirmLabel="Delete credential"
          onConfirm={() => {
            const c = deleting;
            hide(c.id);
            deferredDelete({
              message: `${c.label} deleted`,
              hide: () => hidden.add(c.id),
              restore: () => hidden.remove(c.id),
              commit: () => hubService.deleteCredential(product.id, c.id),
              onCommitted: afterWrite,
              errorMessage: `Couldn't delete ${c.label}.`,
            });
          }}
          onClose={() => setDeleting(null)}
        />
      )}
      {fallback}
    </div>
  );
};

export default VaultTab;
