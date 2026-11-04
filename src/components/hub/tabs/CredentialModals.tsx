/**
 * Vault dialogs: add / edit credential, share with the client, activity drawer.
 * Used by VaultTab.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  CreatedShare,
  Credential,
  CredentialAction,
  CredentialEnvironment,
  CredentialEvent,
  CredentialShare,
  hubErrorMessage,
  hubErrorStatus,
  hubService,
  ProductDetail,
  ShareExpiry,
} from '../../../services/hub.service';
import { CREDENTIAL_ENV, fullDateTime, isValidUrl, when } from '../hubUtils';
import { useVaultCopy } from '../VaultCopy';
import { Avatar } from '../ui/Avatar';
import ConfirmDialog from '../ui/ConfirmDialog';
import { BusyLabel, Field, FormModal, SelectField, SubmitBanner, TextField, useForm, UseFormResult } from '../ui/FormModal';
import Icon from '../ui/Icon';
import Modal, { Drawer } from '../ui/Modal';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';

export const ENV_OPTIONS = (Object.keys(CREDENTIAL_ENV) as CredentialEnvironment[]).map((k) => ({ value: k, label: CREDENTIAL_ENV[k] }));

/** "revealed the password" etc. — sentence after the person's name. */
export const CREDENTIAL_ACTION_TEXT: Record<CredentialAction, string> = {
  created: 'added it',
  edited: 'edited it',
  revealed: 'revealed the password',
  copied: 'copied the password',
  shared: 'created a share link',
  share_viewed: 'opened a share link',
  share_revoked: 'revoked a share link',
};

export const actorName = (user: { name: string } | null | undefined, action: CredentialAction) =>
  user?.name || (action === 'share_viewed' ? 'The client' : 'Someone');

const eventAt = (e: CredentialEvent): string => e.at;

const EXPIRY_LABEL: Record<ShareExpiry, string> = { '1h': '1 hour', '24h': '24 hours', '7d': '7 days' };

/* ------------------------------------------------------------------ */
/* Password input with show / hide                                     */
/* ------------------------------------------------------------------ */

export const SecretField: React.FC<{
  form: UseFormResult<any>;
  name: string;
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  placeholder?: string;
}> = ({ form, name, label, required, hint, placeholder }) => {
  const [show, setShow] = useState(false);
  const id = form.fieldId(name);
  const error = form.errors[name] as string | undefined;
  const described = [hint ? `${id}-h` : '', error ? `${id}-e` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <Field id={id} label={label} required={required} hint={hint} error={error}>
      <div className="hub-copyrow">
        <input
          id={id}
          className="hub-inp hub-w-full hub-mono"
          type={show ? 'text' : 'password'}
          value={form.values[name] ?? ''}
          onChange={(e) => form.set(name, e.target.value)}
          autoComplete="new-password"
          spellCheck={false}
          placeholder={placeholder}
          aria-invalid={error ? 'true' : 'false'}
          aria-required={required || undefined}
          aria-describedby={described}
        />
        <button
          type="button"
          className="hub-icon-btn"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
        >
          <Icon name={show ? 'eyeoff' : 'eye'} />
        </button>
      </div>
    </Field>
  );
};

/* ------------------------------------------------------------------ */
/* Add / edit credential                                               */
/* ------------------------------------------------------------------ */

export const CredentialModal: React.FC<{
  product: ProductDetail;
  credential?: Credential | null;
  onClose: () => void;
  onSaved: (c: Credential) => void;
  onVaultDown: (message: string) => void;
}> = ({ product, credential, onClose, onSaved, onVaultDown }) => {
  const editing = !!credential;
  const form = useForm({
    label: credential?.label || '',
    environment: (credential?.environment || 'production') as string,
    loginUrl: credential?.loginUrl || '',
    username: credential?.username || '',
    secret: '',
    scope: credential ? (credential.shareable ? 'client' : 'team') : 'team',
  });
  return (
    <FormModal
      form={form}
      title={editing ? 'Edit credential' : 'Add credential'}
      description={`Encrypted. Only people on ${product.name} can reveal it.`}
      submitLabel={editing ? 'Save changes' : 'Save credential'}
      failMessage={editing ? "Couldn't save the changes." : "Couldn't save the credential."}
      validate={(v) => ({
        label: !v.label.trim() ? 'Enter a name, like "Admin panel" or "Demo login · Acme".' : undefined,
        loginUrl: v.loginUrl.trim() && !isValidUrl(v.loginUrl) ? 'Enter a full web address, like https://app.example.com/login.' : undefined,
        username: !v.username.trim() ? 'Enter the username or email used to sign in.' : undefined,
        secret: !editing && !v.secret ? 'Enter the password or key.' : undefined,
      })}
      mapServerError={(msg) => {
        if (/login url/i.test(msg)) return { loginUrl: msg };
        if (/^name/i.test(msg)) return { label: msg };
        if (/username/i.test(msg)) return { username: msg };
        if (/^password/i.test(msg)) return { secret: msg };
        return null;
      }}
      onSubmit={async (v) => {
        const body = {
          label: v.label.trim(),
          environment: v.environment as CredentialEnvironment,
          loginUrl: v.loginUrl.trim() || null,
          username: v.username.trim(),
          shareable: v.scope === 'client',
        };
        try {
          const saved = editing
            ? await hubService.updateCredential(product.id, credential!.id, v.secret ? { ...body, secret: v.secret } : body)
            : await hubService.createCredential(product.id, { ...body, secret: v.secret });
          onSaved(saved);
          return editing ? 'Changes saved' : `${body.label} saved in the Vault`;
        } catch (err) {
          if (hubErrorStatus(err) === 503) onVaultDown(hubErrorMessage(err));
          throw err;
        }
      }}
      onClose={onClose}
    >
      <TextField form={form} name="label" label="Name" required width="full" placeholder="e.g. Admin panel" maxLength={160} />
      <SelectField form={form} name="environment" label="Environment" required options={ENV_OPTIONS} />
      <TextField form={form} name="loginUrl" label="Login page" width="full" type="url" inputMode="url" placeholder="https://" />
      <TextField form={form} name="username" label="Username or email" required width="full" mono maxLength={255} />
      <SecretField
        form={form}
        name="secret"
        label={editing ? 'New password or key' : 'Password or key'}
        required={!editing}
        hint={editing ? 'Leave empty to keep the current password.' : undefined}
      />
      <SelectField
        form={form}
        name="scope"
        label="Who can see it"
        required
        width="full"
        options={[
          { value: 'team', label: 'Team only' },
          { value: 'client', label: 'Team, and can be shared with the client' },
        ]}
      />
    </FormModal>
  );
};

/* ------------------------------------------------------------------ */
/* Share with the client                                               */
/* ------------------------------------------------------------------ */

export const ShareModal: React.FC<{
  product: ProductDetail;
  credential: Credential;
  onClose: () => void;
  onShared: () => void;
  onVaultDown: (message: string) => void;
}> = ({ product, credential, onClose, onShared, onVaultDown }) => {
  const { copy, fallback } = useVaultCopy();
  const [expiresIn, setExpiresIn] = useState<ShareExpiry>('24h');
  const [oneTime, setOneTime] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [result, setResult] = useState<CreatedShare | null>(null);

  const create = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setFailed(null);
    try {
      const share = await hubService.createShare(product.id, credential.id, { expiresIn, oneTime });
      setResult(share);
      onShared();
      window.setTimeout(() => document.getElementById('hub-share-copy')?.focus(), 30);
    } catch (err) {
      if (hubErrorStatus(err) === 503) onVaultDown(hubErrorMessage(err));
      setFailed(hubErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Share with the client"
      description={credential.label}
      size="sm"
      onClose={onClose}
      busy={busy}
      footer={({ requestClose }) =>
        result ? (
          <div className="hub-acts">
            <button type="button" className="hub-btn hub-btn-primary" onClick={requestClose}>
              Done
            </button>
          </div>
        ) : (
          <div className="hub-acts">
            <button type="button" className="hub-btn" onClick={requestClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" form="hub-share-form" className="hub-btn hub-btn-primary" disabled={busy}>
              <BusyLabel busy={busy} busyLabel="Creating link…">
                {failed ? 'Try again' : 'Create link'}
              </BusyLabel>
            </button>
          </div>
        )
      }
    >
      {result ? (
        <div className="hub-fgrid">
          <div className="hub-notice hub-info" role="status">
            <Icon name="check" />
            <div className="hub-grow">
              <b>Link created.</b> It expires on {fullDateTime(result.expiresAt)}
              {result.oneTime ? ' and opens only once' : ''}. The share is logged on this credential.
            </div>
          </div>
          <div className="hub-fld">
            <label htmlFor="hub-share-link">Share link</label>
            <div className="hub-copyrow">
              <input
                id="hub-share-link"
                className="hub-inp hub-w-full hub-mono"
                readOnly
                value={result.url}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button type="button" id="hub-share-copy" className="hub-btn" onClick={() => copy(result.url, 'Link')}>
                <Icon name="copy" />
                Copy
              </button>
            </div>
            <p className="hub-hint">
              This is the only time the link is shown. Send it to the client directly. You can revoke it from Activity on this credential.
            </p>
          </div>
        </div>
      ) : (
        <>
          <SubmitBanner heading="Couldn't create the link." message={failed} />
          <form id="hub-share-form" className="hub-fgrid" noValidate onSubmit={create}>
            <div className="hub-fld">
              <label htmlFor="hub-share-exp">
                Link expires after<span className="hub-req" aria-hidden="true">*</span>
              </label>
              <select
                id="hub-share-exp"
                className="hub-inp hub-w-sm"
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value as ShareExpiry)}
                disabled={busy}
              >
                {(Object.keys(EXPIRY_LABEL) as ShareExpiry[]).map((k) => (
                  <option key={k} value={k}>
                    {EXPIRY_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="hub-fld">
              <label className="hub-toggle" htmlFor="hub-share-once">
                <input id="hub-share-once" type="checkbox" checked={oneTime} onChange={(e) => setOneTime(e.target.checked)} disabled={busy} />
                <span className="hub-tg" aria-hidden="true" />
                <span>
                  <b>Can only be opened once</b>
                  <br />
                  <span className="hub-hint">The password disappears after the client views it.</span>
                </span>
              </label>
            </div>
          </form>
        </>
      )}
      {fallback}
    </Modal>
  );
};

/* ------------------------------------------------------------------ */
/* Activity drawer                                                     */
/* ------------------------------------------------------------------ */

export const CredentialActivityDrawer: React.FC<{
  product: ProductDetail;
  credential: Credential;
  onClose: () => void;
  onChanged: () => void;
}> = ({ product, credential, onClose, onChanged }) => {
  const toast = useToast();
  const [events, setEvents] = useState<CredentialEvent[] | null>(null);
  const [shares, setShares] = useState<CredentialShare[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<CredentialShare | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ev, sh] = await Promise.all([
        hubService.listCredentialEvents(product.id, credential.id),
        credential.canReveal ? hubService.listShares(product.id, credential.id) : Promise.resolve([] as CredentialShare[]),
      ]);
      setEvents(ev);
      setShares(sh);
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't load the activity."));
    }
  }, [product.id, credential.id, credential.canReveal]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Drawer
      eyebrow="Activity"
      title={credential.label}
      description={`${CREDENTIAL_ENV[credential.environment]} · ${credential.shareable ? 'Shareable with client' : 'Team only'}`}
      onClose={onClose}
      footer={
        <div className="hub-acts">
          <button type="button" className="hub-btn" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      {error ? (
        <div className="hub-banner hub-banner-err" role="alert">
          <Icon name="alert" />
          <div>
            {error}{' '}
            <button type="button" className="hub-link" onClick={load}>
              Try again
            </button>
          </div>
        </div>
      ) : events === null ? (
        <div style={{ display: 'grid', gap: 10 }} aria-busy="true" aria-label="Loading">
          <Skeleton width="70%" />
          <Skeleton width="55%" />
          <Skeleton width="62%" />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 24 }}>
          {credential.canReveal && credential.shareable ? (
            <section aria-labelledby="hub-vshares-t">
              <h3 className="hub-vsec-t" id="hub-vshares-t">
                Active share links
              </h3>
              {shares && shares.length ? (
                shares.map((s) => (
                  <div className="hub-vshare" key={s.id}>
                    <Icon name="link" className="hub-muted" />
                    <div className="hub-grow">
                      <div>
                        Expires {fullDateTime(s.expiresAt)}
                        {s.oneTime ? ' · Opens once' : ''}
                      </div>
                      <small>
                        Created by {s.createdBy?.name || 'someone'} {when(s.createdAt)}
                        {s.viewedAt ? ` · Opened ${when(s.viewedAt)}` : ' · Not opened yet'}
                      </small>
                    </div>
                    <button type="button" className="hub-btn hub-btn-sm hub-btn-danger-text" onClick={() => setRevoking(s)}>
                      Revoke
                    </button>
                  </div>
                ))
              ) : (
                <p className="hub-muted">No active links. Use Share on this credential to send it to a client.</p>
              )}
            </section>
          ) : null}
          <section aria-labelledby="hub-vevents-t">
            <h3 className="hub-vsec-t" id="hub-vevents-t">
              Recent activity
            </h3>
            {events.length ? (
              <ul className="hub-vevents">
                {events.map((e) => (
                  <li key={e.id}>
                    {e.user ? <Avatar user={e.user} size={24} /> : <span className="hub-av" aria-hidden="true"><Icon name="globe" size={13} /></span>}
                    <div className="hub-grow">
                      <div>
                        <b>{actorName(e.user, e.action)}</b> {CREDENTIAL_ACTION_TEXT[e.action] || e.action}
                      </div>
                      <small title={fullDateTime(eventAt(e))}>
                        {when(eventAt(e))}
                        {e.detail ? ` · ${e.detail}` : ''}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hub-muted">No activity yet.</p>
            )}
            <p className="hub-hint" style={{ marginTop: 8 }}>
              Shows the last 20 events. Every reveal, copy and share is logged.
            </p>
          </section>
        </div>
      )}
      {revoking && (
        <ConfirmDialog
          title="Revoke this share link?"
          body={
            <>
              The client won't be able to open it any more. This can't be undone, but you can create a new link at any time.
            </>
          }
          confirmLabel="Revoke link"
          busyLabel="Revoking…"
          onConfirm={async () => {
            await hubService.revokeShare(product.id, credential.id, revoking.id);
            toast.show('Link revoked');
            await load();
            onChanged();
          }}
          onClose={() => setRevoking(null)}
        />
      )}
    </Drawer>
  );
};

