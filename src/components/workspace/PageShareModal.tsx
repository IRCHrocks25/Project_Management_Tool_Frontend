/**
 * Share a page: everyone at the company, departments and people, each with view or edit.
 * Save replaces the whole list on the server.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hubErrorMessage } from '../../services/hub.service';
import { DEPARTMENTS, PageDetail, PagePermission, PageShare, workspaceService } from '../../services/workspace.service';
import { Avatar } from '../hub/ui/Avatar';
import EmptyState from '../hub/ui/EmptyState';
import Icon from '../hub/ui/Icon';
import { Modal } from '../hub/ui/Modal';
import { Skeleton } from '../hub/ui/Skeleton';
import { useToast } from '../hub/ui/Toast';
import { useHubUsers } from '../hub/ui/users';
import { sharedWithFrom } from './pageUtils';

interface Row {
  kind: 'department' | 'user';
  target: string;
  permission: PagePermission;
  user?: PageShare['user'];
}

interface Draft {
  everyone: boolean;
  everyonePermission: PagePermission;
  rows: Row[];
}

const draftFrom = (shares: PageShare[]): Draft => {
  const everyone = shares.find((s) => s.kind === 'everyone');
  return {
    everyone: !!everyone,
    everyonePermission: everyone ? everyone.permission : 'view',
    rows: shares
      .filter((s) => s.kind !== 'everyone' && !!s.target)
      .map((s) => ({ kind: s.kind as Row['kind'], target: s.target as string, permission: s.permission, user: s.user })),
  };
};

const toShares = (d: Draft): Pick<PageShare, 'kind' | 'target' | 'permission'>[] => [
  ...(d.everyone ? [{ kind: 'everyone' as const, target: null, permission: d.everyonePermission }] : []),
  ...d.rows.map((r) => ({ kind: r.kind, target: r.target, permission: r.permission })),
];

const PermissionSelect: React.FC<{ id?: string; label: string; value: PagePermission; disabled?: boolean; onChange: (p: PagePermission) => void }> = ({
  id,
  label,
  value,
  disabled,
  onChange,
}) => (
  <select id={id} className="hub-inp ws-perm" aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as PagePermission)}>
    <option value="view">Can view</option>
    <option value="edit">Can edit</option>
  </select>
);

const PageShareModal: React.FC<{
  page: Pick<PageDetail, 'id' | 'title' | 'owner'>;
  onSaved: (sharedWith: PageDetail['sharedWith']) => void;
  onClose: () => void;
}> = ({ page, onSaved, onClose }) => {
  const toast = useToast();
  const { users, byId, loading: usersLoading } = useHubUsers();
  const [draft, setDraft] = useState<Draft | null>(null);
  const initial = useRef('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pick, setPick] = useState('');
  const [pickPermission, setPickPermission] = useState<PagePermission>('view');

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const next = draftFrom(await workspaceService.getPageShares(page.id));
      initial.current = JSON.stringify(toShares(next));
      setDraft(next);
    } catch (err) {
      setLoadError(hubErrorMessage(err, "Couldn't load who this page is shared with."));
    }
  }, [page.id]);

  useEffect(() => {
    load();
  }, [load]);

  const taken = useMemo(() => {
    const set: Record<string, true> = {};
    (draft ? draft.rows : []).forEach((r) => {
      set[`${r.kind}:${r.target}`] = true;
    });
    return set;
  }, [draft]);
  const freeDepartments = DEPARTMENTS.filter((d) => !taken[`department:${d}`]);
  const ownerId = page.owner ? page.owner.id : null;
  const freeUsers = users.filter((u) => u.id !== ownerId && !taken[`user:${u.id}`]);

  const dirty = !!draft && JSON.stringify(toShares(draft)) !== initial.current;
  const isPrivate = !!draft && !draft.everyone && !draft.rows.length;

  const add = () => {
    if (!draft || !pick) return;
    const split = pick.indexOf(':');
    const kind = pick.slice(0, split) as Row['kind'];
    const target = pick.slice(split + 1);
    setDraft({ ...draft, rows: [...draft.rows, { kind, target, permission: pickPermission, user: kind === 'user' ? byId(target) : undefined }] });
    setPick('');
  };

  const setRow = (i: number, permission: PagePermission) => {
    if (draft) setDraft({ ...draft, rows: draft.rows.map((r, n) => (n === i ? { ...r, permission } : r)) });
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await workspaceService.setPageShares(page.id, toShares(draft));
      onSaved(sharedWithFrom(saved));
      toast.show(saved.length ? 'Sharing updated' : 'This page is private now');
      onClose();
    } catch (err) {
      setSaveError(hubErrorMessage(err, "Couldn't update sharing."));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Share this page"
      description={page.title}
      onClose={onClose}
      dirty={dirty}
      busy={saving}
      footer={({ requestClose }) => (
        <div className="hub-acts">
          <button type="button" className="hub-btn" onClick={requestClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="hub-btn hub-btn-primary" onClick={save} disabled={!draft || !dirty || saving}>
            {saving && <span className="hub-spin" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    >
      {loadError ? (
        <EmptyState icon="alert" title="Couldn't load sharing" text={loadError} actionLabel="Try again" actionIcon="refresh" onAction={load} />
      ) : !draft ? (
        <div className="ws-form" aria-busy="true" aria-label="Loading">
          <Skeleton width="70%" />
          <Skeleton />
          <Skeleton width="50%" />
        </div>
      ) : (
        <div className="ws-form">
          {saveError && (
            <div className="hub-banner hub-banner-err" role="alert">
              <Icon name="alert" />
              <div>{saveError}</div>
            </div>
          )}

          <div className={`hub-notice${isPrivate ? '' : ' hub-info'}`} role="status">
            <Icon name={isPrivate ? 'eyeoff' : 'users'} />
            <div className="hub-grow">
              {isPrivate ? 'This page is private. Only you can see it.' : 'People below can open this page from Shared with me.'}
            </div>
          </div>

          <div className="ws-share-row ws-share-everyone">
            <label className="hub-toggle ws-grow" htmlFor="ws-share-everyone">
              <input
                id="ws-share-everyone"
                type="checkbox"
                checked={draft.everyone}
                onChange={(e) => setDraft({ ...draft, everyone: e.target.checked })}
              />
              <span className="hub-tg" aria-hidden="true" />
              <span>Everyone at the company</span>
            </label>
            {draft.everyone && (
              <PermissionSelect
                label="What everyone at the company can do"
                value={draft.everyonePermission}
                onChange={(everyonePermission) => setDraft({ ...draft, everyonePermission })}
              />
            )}
          </div>

          <div className="hub-fld">
            <label htmlFor="ws-share-add">Add a department or person</label>
            <div className="ws-share-add">
              <select id="ws-share-add" className="hub-inp ws-grow" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">{usersLoading ? 'Loading people…' : 'Choose…'}</option>
                {freeDepartments.length ? (
                  <optgroup label="Departments">
                    {freeDepartments.map((d) => (
                      <option key={d} value={`department:${d}`}>
                        {d}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {freeUsers.length ? (
                  <optgroup label="People">
                    {freeUsers.map((u) => (
                      <option key={u.id} value={`user:${u.id}`}>
                        {u.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              <PermissionSelect label="What they can do" value={pickPermission} onChange={setPickPermission} />
              <button type="button" className="hub-btn" onClick={add} disabled={!pick}>
                <Icon name="plus" /> Add
              </button>
            </div>
          </div>

          {draft.rows.length ? (
            <ul className="ws-share-list" aria-label="Shared with">
              {draft.rows.map((row, i) => {
                const user = row.kind === 'user' ? byId(row.target) || row.user || null : null;
                const name = row.kind === 'department' ? row.target : user ? user.name : 'Unknown person';
                return (
                  <li key={`${row.kind}:${row.target}`} className="ws-share-row">
                    {row.kind === 'user' ? (
                      <Avatar user={user} />
                    ) : (
                      <span className="ws-share-dept" aria-hidden="true">
                        <Icon name="users" size={14} />
                      </span>
                    )}
                    <span className="ws-grow ws-share-name">
                      {name}
                      {row.kind === 'department' ? <small>Department</small> : null}
                    </span>
                    <PermissionSelect label={`What ${name} can do`} value={row.permission} onChange={(p) => setRow(i, p)} />
                    <button
                      type="button"
                      className="hub-icon-btn hub-sm"
                      aria-label={`Remove ${name}`}
                      onClick={() => setDraft({ ...draft, rows: draft.rows.filter((_, n) => n !== i) })}
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}
    </Modal>
  );
};

export default PageShareModal;
