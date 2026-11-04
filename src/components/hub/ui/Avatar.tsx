/**
 * Avatar and Who.
 *
 *   <Avatar user={user} size={26} />      initials on a soft tone (stable per user), or the photo
 *   <Who user={user} />                   avatar + name, e.g. in tables
 *   <Who user={null} fallback="Unassigned" />
 */
import React, { useState } from 'react';
import type { HubUser } from '../../../services/hub.service';
import { colorSlot, initials } from '../hubUtils';

export interface AvatarProps {
  user: Pick<HubUser, 'id' | 'name' | 'avatarUrl'> | null | undefined;
  size?: number;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ user, size = 26, className = '' }) => {
  const [broken, setBroken] = useState(false);
  const slot = colorSlot(user?.id);
  const style: React.CSSProperties = size === 26 ? {} : { width: size, height: size, fontSize: Math.round(size * 0.4) };
  return (
    <span className={`hub-av${slot ? ` hub-c${slot}` : ''} ${className}`.trim()} style={style} title={user?.name} aria-hidden="true">
      {user?.avatarUrl && !broken ? (
        <img src={user.avatarUrl} alt="" onError={() => setBroken(true)} />
      ) : (
        initials(user?.name)
      )}
    </span>
  );
};

export const Who: React.FC<{ user: AvatarProps['user']; fallback?: string; size?: number }> = ({ user, fallback = 'Nobody', size }) => (
  <span className="hub-who">
    <Avatar user={user} size={size} />
    <span className={user ? undefined : 'hub-muted'}>{user?.name || fallback}</span>
  </span>
);

export default Avatar;
