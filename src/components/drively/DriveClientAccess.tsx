/**
 * The Clients part of the Share dialog. Changes here apply straight away, apart from the dialog's Save,
 * because a client link has to exist before it can be sent.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { clientLinkUrl, clientSignInUrl, DriveClientAccess, DriveClientPermission, drivelyService } from '../../services/drively.service';
import { hubErrorMessage } from '../../services/hub.service';
import Icon from '../hub/ui/Icon';
import { useToast } from '../hub/ui/Toast';

const ClientPerm: React.FC<{ label: string; value: DriveClientPermission; disabled?: boolean; onChange: (p: DriveClientPermission) => void }> = ({ label, value, disabled, onChange }) => (
  <select className="hub-inp drv-perm" aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as DriveClientPermission)}>
    <option value="comment">Can comment</option>
    <option value="view">Can view</option>
  </select>
);

const DriveClientAccessSection: React.FC<{ itemId: string }> = ({ itemId }) => {
  const toast = useToast();
  const [access, setAccess] = useState<DriveClientAccess | null>(null);
  const [known, setKnown] = useState<{ id: string; name: string; email: string | null }[]>([]);
  const [fresh, setFresh] = useState<{ url: string; forClient: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkPermission, setLinkPermission] = useState<DriveClientPermission>('comment');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [next, clients] = await Promise.all([drivelyService.clientAccess(itemId), drivelyService.knownClients()]);
      setAccess(next);
      setKnown(clients);
      setError(null);
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't load client access."));
    }
  }, [itemId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (work: () => Promise<unknown>, fail: string) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      await load();
    } catch (err) {
      setError(hubErrorMessage(err, fail));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.show(done);
    } catch {
      toast.error("Couldn't copy it. Select the text and copy it yourself.");
    }
  };

  const createLink = () =>
    run(async () => {
      const link = await drivelyService.createClientLink(itemId, linkPermission);
      setFresh({ url: clientLinkUrl(link.token), forClient: null });
    }, "Couldn't create the link.");

  const newCodeLink = (clientId: string, name: string) =>
    run(async () => {
      const link = await drivelyService.newCodeLink(itemId, clientId);
      setFresh({ url: clientLinkUrl(link.token), forClient: name });
    }, "Couldn't create the link.");

  const addable = known.filter((c) => !access?.clients.some((a) => a.id === c.id));

  return (
    <section className="drv-client-access" aria-label="Clients">
      <div className="drv-client-head">
        <div className="drv-grow">
          <b>Clients</b>
          <div className="drv-muted">People outside the company. They can't change this file or see anything else in Telos.</div>
        </div>
        <div className="drv-client-create">
          <ClientPerm label="What a client link allows" value={linkPermission} disabled={busy} onChange={setLinkPermission} />
          <button type="button" className="hub-btn" disabled={busy} onClick={createLink}><Icon name="link" size={15} /> Create client link</button>
        </div>
      </div>

      {error && <p className="hub-err" role="alert">{error}</p>}

      {fresh && (
        <div className="drv-client-fresh">
          <b>{fresh.forClient ? `New code link for ${fresh.forClient}` : 'Send this link to your client'}</b>
          <div className="drv-client-url">
            <input className="hub-inp" readOnly aria-label="Client link" value={fresh.url} onFocus={(e) => e.target.select()} />
            <button type="button" className="hub-btn hub-btn-primary" onClick={() => copy(fresh.url, 'Link copied')}><Icon name="copy" size={15} /> Copy</button>
          </div>
          <div className="drv-muted">
            {fresh.forClient
              ? 'It works once. Their old code keeps working until they choose a new one here.'
              : 'It works once, then stops. They choose a name and 6-digit code, and come back any time at '}
            {!fresh.forClient && <button type="button" className="drv-client-inline" onClick={() => copy(clientSignInUrl(), 'Sign-in page copied')}>{clientSignInUrl()}</button>}
            {!fresh.forClient && '.'} You won't be able to see this link again.
          </div>
        </div>
      )}

      {addable.length > 0 && (
        <select
          className="hub-inp"
          aria-label="Share with an existing client"
          value=""
          disabled={busy}
          onChange={(e) => {
            const clientId = e.target.value;
            if (clientId) run(() => drivelyService.shareWithClient(itemId, clientId, linkPermission), "Couldn't share it with that client.");
          }}
        >
          <option value="">Share with an existing client…</option>
          {addable.map((c) => <option key={c.id} value={c.id}>{c.email ? `${c.name} (${c.email})` : c.name}</option>)}
        </select>
      )}

      {access && (access.clients.length > 0 || access.links.length > 0) && (
        <ul className="drv-share-list">
          {access.clients.map((c) => (
            <li key={c.id}>
              <span className="drv-dept"><Icon name="users" size={15} /></span>
              <div className="drv-grow">
                <b>{c.name}</b>
                <div className="drv-muted">{c.email || 'No email on file'}</div>
              </div>
              <ClientPerm label={`What ${c.name} can do`} value={c.permission} disabled={busy} onChange={(permission) => run(() => drivelyService.setClientPermission(itemId, c.id, permission), "Couldn't change their access.")} />
              <button type="button" className="hub-btn hub-btn-ghost hub-btn-sm" disabled={busy} title="For a client who forgot their code" onClick={() => newCodeLink(c.id, c.name)}>New code</button>
              <button type="button" className="hub-btn hub-btn-ghost hub-btn-sm" disabled={busy} aria-label={`Remove ${c.name}`} onClick={() => run(() => drivelyService.removeClient(itemId, c.id), "Couldn't remove them.")}>
                <Icon name="x" size={15} />
              </button>
            </li>
          ))}
          {access.links.map((l) => (
            <li key={l.id}>
              <span className="drv-dept"><Icon name="link" size={15} /></span>
              <div className="drv-grow">
                <b>{l.clientName ? `New code link for ${l.clientName}` : 'Unused client link'}</b>
                <div className="drv-muted">{l.clientName ? '' : `${l.permission === 'comment' ? 'Can comment' : 'Can view'} · `}Stops working {new Date(l.expiresAt).toLocaleDateString()}</div>
              </div>
              <button type="button" className="hub-btn hub-btn-ghost hub-btn-sm" disabled={busy} aria-label="Cancel this link" onClick={() => run(() => drivelyService.cancelClientLink(itemId, l.id), "Couldn't cancel the link.")}>
                <Icon name="x" size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default DriveClientAccessSection;
