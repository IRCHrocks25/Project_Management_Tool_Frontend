/** The top bar every Drively editor shares: back, name, star, save state, actions and Share. */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { isClientPortalPath } from '../../services/clientPortal.service';
import { DriveDetail, drivelyService } from '../../services/drively.service';
import { hubErrorMessage } from '../../services/hub.service';
import { Avatar } from '../hub/ui/Avatar';
import { Badge } from '../hub/ui/Badge';
import Icon from '../hub/ui/Icon';
import { useToast } from '../hub/ui/Toast';
import { ShareModal } from './DriveModals';
import FileIcon from './FileIcon';
import { LiveUser, SaveStatus } from './driveLive';

const SAVE_TEXT: Record<SaveStatus, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  error: "Couldn't save yet. Keep this open, it will try again.",
  offline: 'Offline. Your changes will sync when you reconnect.',
};

const EditorShell: React.FC<{
  item: DriveDetail;
  status?: SaveStatus;
  peers?: LiveUser[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ item, status, peers, actions, children }) => {
  const toast = useToast();
  const [name, setName] = useState(item.name);
  const [starred, setStarred] = useState(item.starred);
  const [sharing, setSharing] = useState(false);
  const saved = useRef(item.name);
  const canEdit = item.myAccess !== 'view';
  const portal = isClientPortalPath();
  const parent = item.path[item.path.length - 1]?.id;
  const back = portal
    ? parent ? `/client/folders/${parent}` : '/client/files'
    : parent ? `/drively/folders/${parent}` : item.isOwner ? '/drively/my-drive' : '/drively/shared';

  useEffect(() => {
    document.title = `${name} - Drively`;
    return () => {
      document.title = 'Telos';
    };
  }, [name]);

  const commitName = async () => {
    const next = name.trim();
    if (!next) return setName(saved.current);
    if (next === saved.current) return undefined;
    try {
      await drivelyService.update(item.id, { name: next });
      saved.current = next;
    } catch (err) {
      setName(saved.current);
      toast.error(hubErrorMessage(err, "Couldn't rename it."));
    }
    return undefined;
  };

  const toggleStar = async () => {
    const next = !starred;
    setStarred(next);
    try {
      await drivelyService.star(item.id, next);
    } catch {
      setStarred(!next);
      toast.error("Couldn't change the star.");
    }
  };

  return (
    <div className="drv-editor">
      <header className="drv-etop">
        <Link to={back} className="hub-btn hub-btn-ghost drv-eback" aria-label="Back to Drively" title="Back to Drively"><FileIcon kind={item.kind} size={26} /></Link>
        <input
          className="drv-ename"
          aria-label="File name"
          value={name}
          maxLength={255}
          readOnly={!canEdit}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        {!portal && <button type="button" className={`drv-estar${starred ? ' drv-estar-on' : ''}`} aria-label={starred ? 'Remove star' : 'Add star'} aria-pressed={starred} onClick={toggleStar}>{starred ? '★' : '☆'}</button>}
        {status && (
          <span className={`drv-save${status === 'error' || status === 'offline' ? ' drv-save-err' : ''}`} role="status">
            {SAVE_TEXT[status]}
          </span>
        )}
        {!canEdit && <Badge tone="neutral">View only</Badge>}
        <div className="drv-eact">
          {!!peers?.length && (
            <ul className="drv-peers" aria-label="Also in this file">
              {peers.slice(0, 5).map((p) => (
                <li key={p.id} title={`${p.name} is here`} style={{ boxShadow: `0 0 0 2px ${p.color}` }}><Avatar user={p} size={28} /></li>
              ))}
              {peers.length > 5 && <li className="drv-peers-more">+{peers.length - 5}</li>}
            </ul>
          )}
          {actions}
          {item.myAccess === 'owner' && (
            <button type="button" className="hub-btn hub-btn-primary" onClick={() => setSharing(true)}><Icon name="share" size={16} /> Share</button>
          )}
        </div>
      </header>
      <div className="drv-ebody">{children}</div>
      {sharing && <ShareModal item={item} onClose={() => setSharing(false)} />}
    </div>
  );
};

export default EditorShell;
