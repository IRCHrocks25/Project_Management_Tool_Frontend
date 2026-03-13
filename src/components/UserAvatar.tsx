import React, { useState } from 'react';

interface UserAvatarProps {
  name?: string;
  avatarUrl?: string | null;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  size = 36,
  color = '#8b5cf6',
  className = '',
  style = {},
}) => {
  const [imgError, setImgError] = useState(false);
  const showImage = avatarUrl && !imgError;

  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    overflow: 'hidden',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
    color: 'white',
    fontWeight: 600,
    fontSize: size * 0.4,
    ...style,
  };

  return (
    <div className={className} style={containerStyle}>
      {showImage ? (
        <img
          src={avatarUrl || ''}
          alt={name || 'Avatar'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onError={() => setImgError(true)}
        />
      ) : (
        name?.charAt(0).toUpperCase() || '?'
      )}
    </div>
  );
};

export default UserAvatar;
