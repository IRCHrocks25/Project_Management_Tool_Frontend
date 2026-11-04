/**
 * SharePage — public client page at /share/:token (no sign-in, outside DashboardLayout).
 *   Shows what was shared, when the link expires and whether it opens once. "Show password"
 *   (one-time links ask first) opens the link and shows the login page, username and password
 *   with Copy buttons. Expired / used / revoked links show the server's message.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { hubErrorMessage, hubErrorStatus, hubService, PublicSharePreview, PublicShareSecret } from '../../services/hub.service';
import { fullDateTime } from './hubUtils';
import { useVaultCopy } from './VaultCopy';
import { Badge } from './ui/Badge';
import ConfirmDialog from './ui/ConfirmDialog';
import Icon from './ui/Icon';
import { Skeleton } from './ui/Skeleton';
import { ToastProvider } from './ui/Toast';
import './hub.css';
import './hub-vault.css';

const GONE_FALLBACK = 'This link has expired or was already used. Ask the person who sent it for a new one.';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; preview: PublicSharePreview }
  | { kind: 'open'; preview: PublicSharePreview; secret: PublicShareSecret }
  | { kind: 'gone'; message: string }
  | { kind: 'error'; message: string };

function expiresText(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (isNaN(ms)) return '';
  if (ms <= 0) return 'Expired';
  const mins = Math.max(1, Math.round(ms / 6e4));
  if (mins < 60) return `Expires in ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 48) return `Expires in ${h} hour${h === 1 ? '' : 's'}`;
  return `Expires in ${Math.round(h / 24)} days`;
}

const CopyValue: React.FC<{ id: string; label: string; value: string; mono?: boolean; onCopy: (v: string, l: string) => void }> = ({
  id,
  label,
  value,
  mono = true,
  onCopy,
}) => (
  <div className="hub-fld">
    <label htmlFor={id}>{label}</label>
    <div className="hub-copyrow">
      <input id={id} className={`hub-inp hub-w-full${mono ? ' hub-mono' : ''}`} readOnly value={value} onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="hub-btn" onClick={() => onCopy(value, label)} aria-label={`Copy ${label.toLowerCase()}`}>
        <Icon name="copy" />
        Copy
      </button>
    </div>
  </div>
);

const ShareContent: React.FC<{ token: string }> = ({ token }) => {
  const { copy, fallback } = useVaultCopy();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [confirming, setConfirming] = useState(false);
  const [opening, setOpening] = useState(false);

  const handleError = useCallback((err: unknown) => {
    const status = hubErrorStatus(err);
    if (status === 410 || status === 404) setState({ kind: 'gone', message: hubErrorMessage(err, GONE_FALLBACK) });
    else setState({ kind: 'error', message: hubErrorMessage(err, "Couldn't load this link. Try again in a moment.") });
  }, []);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'ready', preview: await hubService.getPublicShare(token) });
    } catch (err) {
      handleError(err);
    }
  }, [token, handleError]);

  useEffect(() => {
    load();
  }, [load]);

  const open = async () => {
    if (state.kind !== 'ready' || opening) return;
    const preview = state.preview;
    setOpening(true);
    try {
      const secret = await hubService.openPublicShare(token);
      setState({ kind: 'open', preview, secret });
      window.setTimeout(() => document.getElementById('hub-share-pw')?.focus(), 30);
    } catch (err) {
      const status = hubErrorStatus(err);
      if (status === 410 || status === 404) setState({ kind: 'gone', message: hubErrorMessage(err, GONE_FALLBACK) });
      else setState({ kind: 'error', message: hubErrorMessage(err, "Couldn't open this link. Try again in a moment.") });
    } finally {
      setOpening(false);
    }
  };

  const header = (title: string, sub?: string, icon: 'key' | 'alert' = 'key') => (
    <div className="hub-share-h">
      <span className="hub-share-ic" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <div>
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
    </div>
  );

  let body: React.ReactNode;
  if (state.kind === 'loading') {
    body = (
      <div style={{ display: 'grid', gap: 12 }} aria-busy="true" aria-label="Loading">
        <Skeleton width="60%" height={18} />
        <Skeleton width="40%" />
        <Skeleton height={36} />
      </div>
    );
  } else if (state.kind === 'gone') {
    body = (
      <>
        {header('This link is no longer available', undefined, 'alert')}
        <div className="hub-notice hub-warn" role="alert">
          <Icon name="info" />
          <div className="hub-grow">{state.message}</div>
        </div>
      </>
    );
  } else if (state.kind === 'error') {
    body = (
      <>
        {header("Couldn't load this link", undefined, 'alert')}
        <div className="hub-notice hub-crit" role="alert">
          <Icon name="alert" />
          <div className="hub-grow">{state.message}</div>
        </div>
        <div>
          <button type="button" className="hub-btn" onClick={load}>
            <Icon name="refresh" />
            Try again
          </button>
        </div>
      </>
    );
  } else {
    const p = state.preview;
    body = (
      <>
        {header(p.label, `Login details for ${p.productName}, shared with you.`)}
        <div className="hub-share-meta">
          <Badge tone="info" title={fullDateTime(p.expiresAt)}>
            {expiresText(p.expiresAt)}
          </Badge>
          {p.oneTime ? <Badge tone="warn">Opens only once</Badge> : null}
        </div>
        {state.kind === 'ready' ? (
          <>
            <p className="hub-muted">
              This link works until {fullDateTime(p.expiresAt)}.
              {p.oneTime ? ' It can only be viewed once, so have somewhere safe ready to save the password.' : ''}
            </p>
            <div>
              <button
                type="button"
                className="hub-btn hub-btn-primary"
                onClick={() => (p.oneTime ? setConfirming(true) : open())}
                disabled={opening}
              >
                {opening ? <span className="hub-spin" aria-hidden="true" /> : <Icon name="eye" />}
                {opening ? 'Opening…' : 'Show password'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="hub-share-vals" aria-live="polite">
              {state.secret.loginUrl ? (
                <div className="hub-fld">
                  <label>Login page</label>
                  <a className="hub-link" href={state.secret.loginUrl} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: 'anywhere' }}>
                    <Icon name="ext" size={14} />
                    {state.secret.loginUrl}
                  </a>
                </div>
              ) : null}
              <CopyValue id="hub-share-user" label="Username" value={state.secret.username} onCopy={copy} />
              <CopyValue id="hub-share-pw" label="Password" value={state.secret.secret} onCopy={copy} />
            </div>
            <div className="hub-notice hub-info">
              <Icon name="info" />
              <div className="hub-grow">
                {p.oneTime
                  ? "This link can't be opened again. Save the password in your password manager before closing this page."
                  : `You can open this link again until ${fullDateTime(p.expiresAt)}. Save the password in your password manager.`}
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <main className="hub-share">
      <div className="hub-card hub-share-card">{body}</div>
      <p className="hub-share-foot">Keep these details private. Don't forward this page.</p>
      {confirming && (
        <ConfirmDialog
          title="View the password now?"
          body={<>This link can only be opened once. After you view it, it stops working, so save the password somewhere safe straight away.</>}
          confirmLabel="Show password"
          tone="primary"
          onConfirm={() => {
            setConfirming(false);
            open();
          }}
          onClose={() => setConfirming(false)}
        />
      )}
      {fallback}
    </main>
  );
};

const SharePage: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Shared login';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const ref = document.createElement('meta');
    ref.name = 'referrer';
    ref.content = 'no-referrer';
    document.head.appendChild(ref);
    return () => {
      document.title = prevTitle;
      meta.remove();
      ref.remove();
    };
  }, []);

  return (
    <div className="hub hub-app">
      <ToastProvider>
        <ShareContent token={token} />
      </ToastProvider>
    </div>
  );
};

export default SharePage;
