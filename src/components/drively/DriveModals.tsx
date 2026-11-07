/** Share and Move dialogs for Drively items, plus the shared name prompt. */
import React, { useEffect, useMemo, useState } from 'react';
import { DriveItem, DrivePermission, DriveShare, drivelyService } from '../../services/drively.service';
import { hubErrorMessage } from '../../services/hub.service';
import { DEPARTMENTS } from '../../services/workspace.service';
import { Avatar } from '../hub/ui/Avatar';
import Icon from '../hub/ui/Icon';
import { Modal } from '../hub/ui/Modal';
import { Skeleton } from '../hub/ui/Skeleton';
import { useToast } from '../hub/ui/Toast';
import { useHubUsers } from '../hub/ui/users';
import DriveClientAccessSection from './DriveClientAccess';
import FileIcon from './FileIcon';

const Perm: React.FC<{ label: string; value: DrivePermission; onChange: (p: DrivePermission) => void }> = ({ label, value, onChange }) => (
  <select className="hub-inp drv-perm" aria-label={label} value={value} onChange={(e) => onChange(e.target.value as DrivePermission)}>
    <option value="view">Can view</option>
    <option value="comment">Can comment</option>
    <option value="edit">Can edit</option>
  </select>
);

export const ShareModal: React.FC<{ item: Pick<DriveItem, 'id' | 'name' | 'kind' | 'owner'>; onClose: () => void }> = ({ item, onClose }) => {
  const toast = useToast();
  const { users, me } = useHubUsers();
  const [rows, setRows] = useState<DriveShare[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    drivelyService
      .shares(item.id)
      .then(setRows)
      .catch((err) => setError(hubErrorMessage(err, "Couldn't load who has access.")));
  }, [item.id]);

  const change = (next: DriveShare[]) => {
    setRows(next);
    setDirty(true);
  };
  const everyone = rows?.find((r) => r.kind === 'everyone');
  const named = useMemo(() => (rows || []).filter((r) => r.kind !== 'everyone'), [rows]);
  const addable = users.filter((u) => u.id !== item.owner?.id && !named.some((r) => r.kind === 'user' && r.target === u.id));
  const addableDepartments = DEPARTMENTS.filter((d) => !named.some((r) => r.kind === 'department' && r.target === d));

  const add = (value: string) => {
    if (!value || !rows) return;
    const [kind, target] = [value.slice(0, 1) === 'u' ? 'user' : 'department', value.slice(2)] as ['user' | 'department', string];
    change([...rows, { kind, target, permission: 'view', user: kind === 'user' ? users.find((u) => u.id === target) : null }]);
  };

  const save = async (requestClose: () => void) => {
    if (!rows) return;
    setSaving(true);
    setError(null);
    try {
      await drivelyService.setShares(item.id, rows.map(({ kind, target, permission }) => ({ kind, target, permission })));
      setDirty(false);
      toast.show('Access updated');
      setTimeout(requestClose, 0);
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't update access."));
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    const link = `${window.location.origin}${item.kind === 'folder' ? `/drively/folders/${item.id}` : `/drively/d/${item.id}`}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.show('Link copied. It only works for people with access.');
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  return (
    <Modal
      title={`Share “${item.name}”`}
      description={item.kind === 'folder' ? 'People with access to a folder can reach everything inside it.' : 'Only the people you add can open this.'}
      onClose={onClose}
      dirty={dirty}
      busy={saving}
      footer={({ requestClose }) => (
        <>
          <button type="button" className="hub-btn hub-btn-ghost drv-foot-left" onClick={copyLink}>
            <Icon name="link" size={15} /> Copy link
          </button>
          <button type="button" className="hub-btn" onClick={requestClose}>Cancel</button>
          <button type="button" className="hub-btn hub-btn-primary" disabled={!rows || saving} onClick={() => save(requestClose)}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      )}
    >
      {error && <p className="hub-err" role="alert">{error}</p>}
      {!rows && !error && <Skeleton height={120} />}
      {rows && (
        <div className="drv-share">
          <select className="hub-inp" aria-label="Add a person or department" value="" onChange={(e) => add(e.target.value)}>
            <option value="">Add a person or department…</option>
            <optgroup label="People">
              {addable.map((u) => (
                <option key={u.id} value={`u:${u.id}`}>{u.name}</option>
              ))}
            </optgroup>
            <optgroup label="Departments">
              {addableDepartments.map((d) => (
                <option key={d} value={`d:${d}`}>{d}</option>
              ))}
            </optgroup>
          </select>
          <ul className="drv-share-list">
            <li>
              {item.owner ? <Avatar user={item.owner} size={28} /> : <Icon name="users" size={18} />}
              <div className="drv-grow"><b>{item.owner?.name || 'Owner'}{item.owner?.id === me?.id ? ' (you)' : ''}</b></div>
              <span className="drv-muted">Owner</span>
            </li>
            {named.map((r) => (
              <li key={`${r.kind}:${r.target}`}>
                {r.kind === 'user' && r.user ? <Avatar user={r.user} size={28} /> : <span className="drv-dept"><Icon name="users" size={15} /></span>}
                <div className="drv-grow"><b>{r.kind === 'user' ? r.user?.name || 'Someone' : r.target}</b>{r.kind === 'department' && <div className="drv-muted">Department</div>}</div>
                <Perm
                  label={`Permission for ${r.kind === 'user' ? r.user?.name : r.target}`}
                  value={r.permission}
                  onChange={(permission) => change(rows.map((x) => (x === r ? { ...x, permission } : x)))}
                />
                <button type="button" className="hub-btn hub-btn-ghost hub-btn-sm" aria-label={`Remove ${r.kind === 'user' ? r.user?.name : r.target}`} onClick={() => change(rows.filter((x) => x !== r))}>
                  <Icon name="x" size={15} />
                </button>
              </li>
            ))}
          </ul>
          <div className="drv-share-all">
            <span className="drv-dept"><Icon name="globe" size={15} /></span>
            <label className="drv-grow">
              <input type="checkbox" checked={!!everyone} onChange={(e) => change(e.target.checked ? [...rows, { kind: 'everyone', target: null, permission: 'view' }] : rows.filter((r) => r.kind !== 'everyone'))} />{' '}
              Everyone at the company
            </label>
            {everyone && <Perm label="Permission for everyone" value={everyone.permission} onChange={(permission) => change(rows.map((x) => (x === everyone ? { ...x, permission } : x)))} />}
          </div>
          <DriveClientAccessSection itemId={item.id} />
        </div>
      )}
    </Modal>
  );
};

export const MoveModal: React.FC<{ item: DriveItem; onClose: () => void; onMoved: () => void }> = ({ item, onClose, onMoved }) => {
  const [trail, setTrail] = useState<{ id: string; name: string }[]>([]);
  const [folders, setFolders] = useState<DriveItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const here = trail[trail.length - 1]?.id || null;

  useEffect(() => {
    setFolders(null);
    drivelyService
      .list({ view: 'mine', parentId: here || undefined })
      .then((list) => setFolders(list.filter((f) => f.kind === 'folder' && f.id !== item.id)))
      .catch((err) => setError(hubErrorMessage(err, "Couldn't load folders.")));
  }, [here, item.id]);

  const move = async () => {
    setSaving(true);
    setError(null);
    try {
      await drivelyService.update(item.id, { parentId: here });
      onMoved();
      onClose();
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't move it."));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Move “${item.name}”`}
      onClose={onClose}
      busy={saving}
      footer={({ requestClose }) => (
        <>
          <button type="button" className="hub-btn" onClick={requestClose}>Cancel</button>
          <button type="button" className="hub-btn hub-btn-primary" disabled={saving || here === item.parentId} onClick={move}>
            {saving ? 'Moving…' : `Move to ${trail[trail.length - 1]?.name || 'My Drive'}`}
          </button>
        </>
      )}
    >
      {error && <p className="hub-err" role="alert">{error}</p>}
      <nav className="drv-trail" aria-label="Folder path">
        <button type="button" onClick={() => setTrail([])}>My Drive</button>
        {trail.map((t, i) => (
          <React.Fragment key={t.id}>
            <Icon name="chev" size={13} />
            <button type="button" onClick={() => setTrail(trail.slice(0, i + 1))}>{t.name}</button>
          </React.Fragment>
        ))}
      </nav>
      {!folders && !error && <Skeleton height={120} />}
      {folders && folders.length === 0 && <p className="drv-muted drv-pad">No folders here. Move it here, or go back.</p>}
      {folders && folders.length > 0 && (
        <ul className="drv-folder-pick">
          {folders.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => setTrail([...trail, { id: f.id, name: f.name }])}>
                <FileIcon kind="folder" size={18} /> <span className="drv-grow">{f.name}</span> <Icon name="chev" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
};

export const NameModal: React.FC<{ title: string; label: string; initial: string; action: string; onSubmit: (name: string) => Promise<void>; onClose: () => void }> = ({
  title,
  label,
  initial,
  action,
  onSubmit,
  onClose,
}) => {
  const [name, setName] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!name.trim()) return setError('Give it a name.');
    setSaving(true);
    try {
      await onSubmit(name.trim());
      onClose();
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't save that."));
      setSaving(false);
    }
  };
  return (
    <Modal
      title={title}
      size="sm"
      onClose={onClose}
      busy={saving}
      footer={({ requestClose }) => (
        <>
          <button type="button" className="hub-btn" onClick={requestClose}>Cancel</button>
          <button type="button" className="hub-btn hub-btn-primary" disabled={saving} onClick={submit}>{action}</button>
        </>
      )}
    >
      <label className="drv-field">
        {label}
        <input
          className="hub-inp"
          autoFocus
          maxLength={255}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
      </label>
      {error && <p className="hub-err" role="alert">{error}</p>}
    </Modal>
  );
};
