/** Before joining: camera and microphone check, shared by teammates and guests. */
import React from 'react';
import { LocalUserChoices, PreJoin } from '@livekit/components-react';
import '@livekit/components-styles';
import Icon from '../hub/ui/Icon';
import './meetings.css';

const Lobby: React.FC<{
  title: string;
  subtitle?: string;
  /** Teammates join under their account name, so only guests are asked for one. */
  askName?: boolean;
  defaultName?: string;
  joinLabel: string;
  notice?: string | null;
  error?: string | null;
  busy?: boolean;
  onJoin: (choices: LocalUserChoices) => void;
  footer?: React.ReactNode;
}> = ({ title, subtitle, askName, defaultName = '', joinLabel, notice, error, busy, onJoin, footer }) => (
  <main className="mt-lobby">
    <div className="mt-lobby-head">
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
    {notice ? (
      <div className="mt-notice" role="status">
        <Icon name="info" />
        <span>{notice}</span>
      </div>
    ) : null}
    {error ? (
      <div className="mt-notice mt-notice-crit" role="alert">
        <Icon name="alert" />
        <span>{error}</span>
      </div>
    ) : null}
    <div className={`mt-prejoin${askName ? '' : ' mt-prejoin-named'}${busy ? ' mt-prejoin-busy' : ''}`} data-lk-theme="default">
      <PreJoin
        defaults={{ username: defaultName, videoEnabled: true, audioEnabled: true }}
        joinLabel={busy ? 'Joining…' : joinLabel}
        userLabel="Your name"
        persistUserChoices={false}
        onValidate={(values) => !!values.username.trim()}
        onSubmit={onJoin}
        onError={() => undefined}
      />
    </div>
    {footer}
  </main>
);

export default Lobby;
