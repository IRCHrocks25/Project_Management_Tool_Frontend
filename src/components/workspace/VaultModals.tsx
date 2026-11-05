/**
 * Company and personal Vault dialogs: add / edit login (with the access editor) and the history drawer.
 * Used by VaultPage. Sibling of hub/tabs/CredentialModals.tsx.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { hubErrorMessage, hubErrorStatus } from '../../services/hub.service';
import { Access, DEPARTMENTS, VaultEvent, VaultItem, VaultScope, VaultVersion, workspaceService } from '../../services/workspace.service';
import { fullDateTime, isValidUrl, when } from '../hub/hubUtils';
import { SecretField } from '../hub/tabs/CredentialModals';
import { Avatar } from '../hub/ui/Avatar';
import ConfirmDialog from '../hub/ui/ConfirmDialog';
import { Drawer } from '../hub/ui/Drawer';
import { FormModal, TextAreaField, TextField, useForm, UseFormResult } from '../hub/ui/FormModal';
import Icon from '../hub/ui/Icon';
import { Skeleton } from '../hub/ui/Skeleton';
import { useToast } from '../hub/ui/Toast';
import { currentHubUser, useHubUsers } from '../hub/ui/users';

const REVEAL_MS = 30000;
const NOTES_MAX = 4000;
const SECRET_MAX = 4000;

/** Text after the person's name. Anything else falls back to the event's own detail. */
const ACTION_TEXT: Record<string, string> = {
  created: 'added it',
  edited: 'edited it',
  updated: 'edited it',
  revealed: 'revealed the password',
  copied: 'copied the password',
  restored: 'restored a previous password',
  version_restored: 'restored a previous password',
  version_revealed: 'revealed a previous password',
  shared: 'created a share link',
  share_viewed: 'opened a share link',
  share_revoked: 'revoked a share link',
};

export const firstName = (name: string | null | undefined) => (name || '').trim().split(/\s+/)[0] || '';

/* ------------------------------------------------------------------ */
/* Access editor                                                       */
/* ------------------------------------------------------------------ */

type ItemForm = {
  label: string;
  loginUrl: string;
  username: string;
  secret: string;
  notes: string;
  mode: 'everyone' | 'specific';
  departments: string[];
  userIds: string[];
};

const toggled = (list: string[], value: string, on: boolean) => (on ? [...list.filter((x) => x !== value), value] : list.filter((x) => x !== value));

const AccessEditor: React.FC<{ form: UseFormResult<ItemForm>; canManage: boolean }> = ({ form, canManage }) => {
  const { users, loading, error, reload } = useHubUsers();
  const [filter, setFilter] = useState('');
  const { mode, departments, userIds } = form.values;
  const name = form.fieldId('mode');

  const deptOptions: string[] = [...DEPARTMENTS, ...departments.filter((d) => !(DEPARTMENTS as readonly string[]).includes(d))];
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
  const shownUsers = users.filter((u) => {
    const hay = `${u.name} ${u.role || ''}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  // People with access who aren't in the user list any more stay removable.
  const unlisted = loading || !users.length ? [] : userIds.filter((id) => !users.some((u) => u.id === id));
  const nobody = mode === 'specific' && !departments.length && !userIds.length;

  return (
    <fieldset className="ws-vaccess" disabled={!canManage}>
      <legend>Who can see it</legend>
      {!canManage ? <p className="hub-hint">Only the person who added it, founders and project managers can change who sees this login.</p> : null}
      <div className="ws-vchoices">
        <label className="ws-vchoice">
          <input type="radio" name={name} checked={mode === 'everyone'} onChange={() => form.set('mode', 'everyone')} />
          <span>Everyone</span>
        </label>
        <label className="ws-vchoice">
          <input type="radio" name={name} checked={mode === 'specific'} onChange={() => form.set('mode', 'specific')} />
          <span>Specific departments or people</span>
        </label>
      </div>

      {mode === 'specific' ? (
        <div className="ws-vaudience">
          <div role="group" aria-label="Departments">
            <div className="ws-vsub">Departments</div>
            <div className="ws-vdepts">
              {deptOptions.map((d) => (
                <label className="ws-vchoice" key={d}>
                  <input type="checkbox" checked={departments.includes(d)} onChange={(e) => form.set('departments', toggled(departments, d, e.target.checked))} />
                  <span>{d}</span>
                </label>
              ))}
            </div>
          </div>

          <div role="group" aria-label="People">
            <div className="ws-vsub">
              People{userIds.length ? <span className="hub-muted"> · {userIds.length} selected</span> : null}
            </div>
            {error && !users.length ? (
              <p className="hub-hint">
                Couldn't load the list of people.{' '}
                <button type="button" className="hub-link" onClick={() => reload().catch(() => undefined)}>
                  Try again
                </button>
              </p>
            ) : (
              <>
                <input
                  className="hub-inp hub-w-full"
                  type="search"
                  placeholder="Filter by name or department"
                  aria-label="Filter people"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter here shouldn't submit the whole form.
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                  autoComplete="off"
                />
                <div className="ws-vpeople">
                  {loading ? <div className="ws-vperson hub-muted">Loading people…</div> : null}
                  {unlisted.map((id) => (
                    <label className="ws-vperson" key={id}>
                      <input type="checkbox" checked onChange={() => form.set('userIds', toggled(userIds, id, false))} />
                      <span className="hub-muted">Someone no longer on the team list</span>
                    </label>
                  ))}
                  {shownUsers.map((u) => (
                    <label className="ws-vperson" key={u.id}>
                      <input type="checkbox" checked={userIds.includes(u.id)} onChange={(e) => form.set('userIds', toggled(userIds, u.id, e.target.checked))} />
                      <Avatar user={u} size={22} />
                      <span className="ws-vperson-name">
                        {u.name}
                        {u.role ? <small>{u.role}</small> : null}
                      </span>
                    </label>
                  ))}
                  {!loading && !shownUsers.length ? <div className="ws-vperson hub-muted">Nobody matches that.</div> : null}
                </div>
              </>
            )}
          </div>
          {nobody ? <p className="hub-hint">Nobody selected: only the person who added it, founders and project managers will see it.</p> : null}
        </div>
      ) : null}
    </fieldset>
  );
};

/* ------------------------------------------------------------------ */
/* Add / edit login                                                    */
/* ------------------------------------------------------------------ */

export const VaultItemModal: React.FC<{
  scope: VaultScope;
  item?: VaultItem | null;
  onClose: () => void;
  onSaved: (item: VaultItem) => void;
  onVaultDown: (message: string) => void;
}> = ({ scope, item, onClose, onSaved, onVaultDown }) => {
  const editing = !!item;
  const isCompany = scope === 'company';
  const canManage = item ? item.canManage : true;
  const form = useForm<ItemForm>({
    label: item?.label || '',
    loginUrl: item?.loginUrl || '',
    username: item?.username || '',
    secret: '',
    notes: item?.notes || '',
    mode: item?.access.everyone ? 'everyone' : 'specific',
    departments: item ? item.access.departments : (() => {
      const role = currentHubUser()?.role;
      return role && (DEPARTMENTS as readonly string[]).includes(role) ? [role] : [];
    })(),
    userIds: item ? item.access.userIds : [],
  });

  return (
    <FormModal
      form={form}
      title={editing ? 'Edit login' : 'Add login'}
      description={isCompany ? 'Encrypted. Everyone who can see it can also update it, and every change is logged.' : 'Encrypted. Only you can see it in the app.'}
      submitLabel={editing ? 'Save changes' : 'Save login'}
      failMessage={editing ? "Couldn't save the changes." : "Couldn't save the login."}
      validate={(v) => ({
        label: !v.label.trim() ? 'Enter a name, like "Gmail" or "Canva".' : undefined,
        loginUrl: v.loginUrl.trim() && !isValidUrl(v.loginUrl) ? 'Enter a full web address, like https://app.example.com/login.' : undefined,
        username: !v.username.trim() ? 'Enter the username or email used to sign in.' : undefined,
        secret: !editing && !v.secret ? 'Enter the password.' : v.secret.length > SECRET_MAX ? `Keep the password to ${SECRET_MAX} characters.` : undefined,
        notes: v.notes.length > NOTES_MAX ? `Keep notes to ${NOTES_MAX} characters.` : undefined,
      })}
      mapServerError={(msg) => {
        if (/login ?url/i.test(msg)) return { loginUrl: msg };
        if (/^(name|label)/i.test(msg)) return { label: msg };
        if (/username/i.test(msg)) return { username: msg };
        if (/^(password|secret)/i.test(msg)) return { secret: msg };
        if (/^notes/i.test(msg)) return { notes: msg };
        return null;
      }}
      onSubmit={async (v) => {
        const access: Access =
          v.mode === 'everyone' ? { everyone: true, departments: [], userIds: [] } : { everyone: false, departments: v.departments, userIds: v.userIds };
        const fields = {
          label: v.label.trim(),
          loginUrl: v.loginUrl.trim() || null,
          username: v.username.trim(),
          notes: v.notes.trim() || null,
          ...(isCompany && canManage ? { access } : {}),
        };
        try {
          const saved = item
            ? await workspaceService.updateVaultItem(item.id, v.secret ? { ...fields, secret: v.secret } : fields)
            : await workspaceService.createVaultItem({ ...fields, scope, secret: v.secret });
          onSaved(saved);
          return editing ? 'Changes saved' : `${fields.label} saved in the Vault`;
        } catch (err) {
          if (hubErrorStatus(err) === 503) onVaultDown(hubErrorMessage(err));
          throw err;
        }
      }}
      onClose={onClose}
    >
      <TextField form={form} name="label" label="Name" required width="full" placeholder="e.g. Gmail" maxLength={160} />
      <TextField form={form} name="loginUrl" label="Login page" width="full" type="url" inputMode="url" placeholder="https://" />
      <TextField form={form} name="username" label="Username or email" required width="full" mono maxLength={255} />
      <SecretField
        form={form}
        name="secret"
        label={editing ? 'New password' : 'Password'}
        required={!editing}
        hint={editing ? 'Leave empty to keep the current password.' : undefined}
      />
      <TextAreaField form={form} name="notes" label="Notes" rows={3} hint="Good to know, like the recovery email or who pays for it." />
      {isCompany ? <AccessEditor form={form} canManage={canManage} /> : null}
    </FormModal>
  );
};

/* ------------------------------------------------------------------ */
/* History drawer                                                      */
/* ------------------------------------------------------------------ */

export const VaultHistoryDrawer: React.FC<{
  item: VaultItem;
  onClose: () => void;
  onRestored: (item: VaultItem) => void;
  onVaultDown: (message: string) => void;
}> = ({ item, onClose, onRestored, onVaultDown }) => {
  const toast = useToast();
  const [events, setEvents] = useState<VaultEvent[] | null>(null);
  const [versions, setVersions] = useState<VaultVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<VaultVersion | null>(null);
  const timers = useRef<Record<string, number>>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ev, ver] = await Promise.all([workspaceService.vaultItemEvents(item.id), workspaceService.vaultItemVersions(item.id)]);
      setEvents(ev);
      setVersions(ver);
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't load the history."));
    }
  }, [item.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Clear every reveal timer when the drawer closes (secrets live only in this component's state).
  useEffect(
    () => () => {
      Object.values(timers.current).forEach((t) => window.clearTimeout(t));
    },
    [],
  );

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

  const reveal = async (v: VaultVersion) => {
    if (revealed[v.id] !== undefined) {
      hide(v.id);
      return;
    }
    if (revealing) return;
    setRevealing(v.id);
    try {
      const { secret } = await workspaceService.revealVaultVersion(item.id, v.id);
      setRevealed((r) => ({ ...r, [v.id]: secret }));
      window.clearTimeout(timers.current[v.id]);
      timers.current[v.id] = window.setTimeout(() => hide(v.id), REVEAL_MS);
      toast.show('Password shown. It hides again after 30 seconds.', { kind: 'info' });
      load(); // the reveal itself is logged
    } catch (err) {
      const msg = hubErrorMessage(err);
      if (hubErrorStatus(err) === 503) onVaultDown(msg);
      toast.error(`Couldn't reveal the password. ${msg}`);
    } finally {
      setRevealing(null);
    }
  };

  return (
    <Drawer
      eyebrow="History"
      title={item.label}
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
      ) : events === null || versions === null ? (
        <div className="ws-vloading" aria-busy="true" aria-label="Loading">
          <Skeleton width="70%" />
          <Skeleton width="55%" />
          <Skeleton width="62%" />
        </div>
      ) : (
        <div className="ws-vhistory">
          <section aria-labelledby="ws-vversions-t">
            <h3 className="hub-vsec-t" id="ws-vversions-t">
              Previous passwords (kept for 30 days)
            </h3>
            {versions.length ? (
              versions.map((v) => {
                const shown = revealed[v.id];
                return (
                  <div className="hub-vshare ws-vversion" key={v.id}>
                    <div className="hub-grow">
                      <div>{fullDateTime(v.createdAt)}</div>
                      <small>Changed by {v.changedBy?.name || 'someone'}</small>
                      {shown !== undefined ? <div className="hub-mono ws-vsecret">{shown}</div> : null}
                    </div>
                    <div className="ws-vversion-acts">
                      <button
                        type="button"
                        className="hub-btn hub-btn-sm"
                        onClick={() => reveal(v)}
                        disabled={revealing === v.id}
                        aria-label={`${shown !== undefined ? 'Hide' : 'Reveal'} the password from ${fullDateTime(v.createdAt)}`}
                      >
                        {revealing === v.id ? <span className="hub-spin" aria-hidden="true" /> : null}
                        {shown !== undefined ? 'Hide' : 'Reveal'}
                      </button>
                      <button
                        type="button"
                        className="hub-btn hub-btn-sm"
                        onClick={() => setRestoring(v)}
                        aria-label={`Restore the password from ${fullDateTime(v.createdAt)}`}
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="hub-muted">None yet. When the password changes, the old one stays here for 30 days.</p>
            )}
          </section>

          <section aria-labelledby="ws-vevents-t">
            <h3 className="hub-vsec-t" id="ws-vevents-t">
              Activity
            </h3>
            {events.length ? (
              <ul className="hub-vevents">
                {events.map((e) => {
                  const known = ACTION_TEXT[e.action];
                  return (
                    <li key={e.id}>
                      {e.user ? <Avatar user={e.user} size={24} /> : <span className="hub-av" aria-hidden="true"><Icon name="globe" size={13} /></span>}
                      <div className="hub-grow">
                        <div>
                          <b>{e.user?.name || 'Someone'}</b> {known || e.detail || e.action}
                        </div>
                        <small title={fullDateTime(e.at)}>
                          {when(e.at)}
                          {known && e.detail ? ` · ${e.detail}` : ''}
                        </small>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="hub-muted">No activity yet.</p>
            )}
            <p className="hub-hint ws-vfoot">Shows the last 20 events. Every reveal, copy and change is logged.</p>
          </section>
        </div>
      )}
      {restoring && (
        <ConfirmDialog
          title="Restore this password?"
          body={
            <>
              The password from <b>{fullDateTime(restoring.createdAt)}</b> becomes the current one for {item.label}. The current password moves to Previous passwords
              for 30 days.
            </>
          }
          tone="primary"
          confirmLabel="Restore password"
          busyLabel="Restoring…"
          onConfirm={async () => {
            try {
              const saved = await workspaceService.restoreVaultVersion(item.id, restoring.id);
              hide(restoring.id);
              toast.show('Password restored');
              onRestored(saved);
              await load();
            } catch (err) {
              if (hubErrorStatus(err) === 503) onVaultDown(hubErrorMessage(err));
              throw err;
            }
          }}
          onClose={() => setRestoring(null)}
        />
      )}
    </Drawer>
  );
};
