/**
 * Demo accounts tab — every demo login, its purpose and its content status.
 *   Table (cards on phone): client + purpose, login email + copy, "Password in Vault" link or a
 *   "No password saved" badge, avatar / transcript status selects that save immediately
 *   (optimistic, revert + Retry on failure), owner, overflow Edit / Delete (confirm + Undo).
 *   A notice links to the SOP whose title mentions "demo", when there is one.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ContentStatus,
  Credential,
  DemoAccount,
  hubErrorMessage,
  hubService,
  ProductDetail,
  ProductSop,
} from '../../../services/hub.service';
import { usePrimaryAction } from '../primaryAction';
import { productPath } from '../hubUtils';
import { useVaultCopy } from '../VaultCopy';
import { Who } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import Icon from '../ui/Icon';
import OverflowMenu from '../ui/OverflowMenu';
import { SkeletonRows } from '../ui/Skeleton';
import { useDeferredDelete, useHiddenIds, useToast } from '../ui/Toast';
import DemoAccountWizard, { CONTENT_OPTIONS } from './DemoAccountWizard';
import '../hub-vault.css';

export interface DemoAccountsTabProps {
  product: ProductDetail;
  onChanged: () => void;
}

type StatusField = 'avatarStatus' | 'transcriptStatus';
const FIELD_LABEL: Record<StatusField, string> = { avatarStatus: 'Avatar', transcriptStatus: 'Transcript' };

const DemoAccountsTab: React.FC<DemoAccountsTabProps> = ({ product, onChanged }) => {
  const toast = useToast();
  const { copy, fallback } = useVaultCopy();
  const hidden = useHiddenIds();
  const deferredDelete = useDeferredDelete();
  const [demos, setDemos] = useState<DemoAccount[] | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [sop, setSop] = useState<ProductSop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, true | undefined>>({});
  const [wizard, setWizard] = useState<{ demo: DemoAccount | null } | null>(null);
  const [deleting, setDeleting] = useState<DemoAccount | null>(null);

  usePrimaryAction({ label: 'Add demo account', icon: 'plus', onClick: () => setWizard({ demo: null }) });

  const load = useCallback(async () => {
    setError(null);
    try {
      setDemos(await hubService.listDemoAccounts(product.id));
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't load the demo accounts."));
    }
  }, [product.id]);

  const loadCredentials = useCallback(async () => {
    try {
      setCredentials(await hubService.listCredentials(product.id));
    } catch {
      setCredentials([]);
    }
  }, [product.id]);

  useEffect(() => {
    load();
    loadCredentials();
    let alive = true;
    hubService
      .listSops(product.id)
      .then((list) => alive && setSop(list.find((s) => /demo/i.test(s.title)) || null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [load, loadCredentials, product.id]);

  const setStatus = async (d: DemoAccount, field: StatusField, value: ContentStatus) => {
    const prev = d[field];
    if (prev === value) return;
    const key = `${d.id}:${field}`;
    const patchLocal = (v: ContentStatus) => setDemos((list) => (list || []).map((x) => (x.id === d.id ? { ...x, [field]: v } : x)));
    patchLocal(value);
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      await hubService.updateDemoAccount(product.id, d.id, { [field]: value });
      toast.show(`${FIELD_LABEL[field]} status updated`, { duration: 2200 });
    } catch (err) {
      patchLocal(prev);
      toast.error(`Couldn't update the ${FIELD_LABEL[field].toLowerCase()} status for ${d.clientName}. ${hubErrorMessage(err)}`, {
        action: { label: 'Retry', onClick: () => setStatus({ ...d, [field]: prev }, field, value) },
      });
    } finally {
      setSaving((s) => ({ ...s, [key]: undefined }));
    }
  };

  const afterWrite = () => {
    load();
    loadCredentials();
    onChanged();
  };

  const list = (demos || []).filter((d) => !hidden.has(d.id));

  const statusSelect = (d: DemoAccount, field: StatusField) => {
    const id = `hub-d-${field}-${d.id}`;
    const busy = !!saving[`${d.id}:${field}`];
    return (
      <>
        <label className="hub-sr" htmlFor={id}>
          {FIELD_LABEL[field]} status for {d.clientName}
        </label>
        <select
          id={id}
          className={`hub-inp hub-dsel${busy ? ' hub-dsel-busy' : ''}`}
          value={d[field]}
          aria-busy={busy || undefined}
          onChange={(e) => setStatus(d, field, e.target.value as ContentStatus)}
        >
          {CONTENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </>
    );
  };

  return (
    <div className="hub-sec">
      {sop ? (
        <div className="hub-notice hub-info">
          <Icon name="book" />
          <div className="hub-grow">
            Setting up a new demo client? Follow{' '}
            <Link className="hub-link" to={productPath(product.slug, 'sops', `sop=${encodeURIComponent(sop.id)}`)}>
              {sop.title}
            </Link>
            . It covers the avatar, transcript and where the logins go.
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="hub-card">
          <EmptyState icon="alert" title="Couldn't load the demo accounts" text={error} actionLabel="Try again" actionIcon="refresh" onAction={load} />
        </div>
      ) : demos === null ? (
        <SkeletonRows rows={3} />
      ) : list.length ? (
        <div className="hub-card hub-tw">
          <table className="hub-tbl hub-rt">
            <thead>
              <tr>
                <th scope="col">Client</th>
                <th scope="col">Login</th>
                <th scope="col">Avatar</th>
                <th scope="col">Transcript</th>
                <th scope="col">Owner</th>
                <th scope="col" className="hub-act">
                  <span className="hub-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div>
                      <b>{d.clientName}</b>
                      {d.purpose ? <div className="hub-cell-sub">{d.purpose}</div> : null}
                    </div>
                  </td>
                  <td data-l="Login">
                    <div className="hub-dlogin">
                      <div className="hub-vfield">
                        <span className="hub-mono" title={d.loginEmail}>
                          {d.loginEmail}
                        </span>
                        <button
                          type="button"
                          className="hub-icon-btn hub-sm"
                          onClick={() => copy(d.loginEmail, 'Login email')}
                          aria-label={`Copy login email for ${d.clientName}`}
                        >
                          <Icon name="copy" size={14} />
                        </button>
                      </div>
                      <div>
                        {d.credential ? (
                          <Link
                            className="hub-link hub-small"
                            to={productPath(product.slug, 'vault', `credential=${encodeURIComponent(d.credential.id)}`)}
                            aria-label={`Password in Vault: ${d.credential.label}`}
                          >
                            <Icon name="key" size={13} />
                            Password in Vault
                          </Link>
                        ) : (
                          <Badge tone="warn">No password saved</Badge>
                        )}
                      </div>
                    </div>
                  </td>
                  <td data-l="Avatar">{statusSelect(d, 'avatarStatus')}</td>
                  <td data-l="Transcript">{statusSelect(d, 'transcriptStatus')}</td>
                  <td data-l="Owner">
                    <Who user={d.owner} fallback="No owner" />
                  </td>
                  <td className="hub-act">
                    <OverflowMenu
                      label={`More actions for the ${d.clientName} demo account`}
                      items={[
                        { label: 'Edit', icon: 'edit', onSelect: () => setWizard({ demo: d }) },
                        { label: 'Delete demo account', icon: 'trash', danger: true, onSelect: () => setDeleting(d) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="hub-card">
          <EmptyState
            icon="users"
            title="No demo accounts yet"
            text="Keep every demo login, its purpose and its content status in one place."
            actionLabel="Add demo account"
            onAction={() => setWizard({ demo: null })}
          />
        </div>
      )}

      {wizard && (
        <DemoAccountWizard
          product={product}
          demo={wizard.demo}
          credentials={credentials}
          onClose={() => setWizard(null)}
          onSaved={afterWrite}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete the ${deleting.clientName} demo account?`}
          body={
            <>
              It will be removed from this list.{' '}
              {deleting.credential ? 'The password stays in the Vault until you delete it there. ' : ''}You can undo this for a few seconds
              afterwards.
            </>
          }
          confirmLabel="Delete demo account"
          onConfirm={() => {
            const d = deleting;
            deferredDelete({
              message: `${d.clientName} demo account deleted`,
              hide: () => hidden.add(d.id),
              restore: () => hidden.remove(d.id),
              commit: () => hubService.deleteDemoAccount(product.id, d.id),
              onCommitted: afterWrite,
              errorMessage: `Couldn't delete the ${d.clientName} demo account.`,
            });
          }}
          onClose={() => setDeleting(null)}
        />
      )}
      {fallback}
    </div>
  );
};

export default DemoAccountsTab;
