/**
 * Guest page (/m/:code): no sign-in, the code is the credential. Check camera and enter a name,
 * wait for the host to admit you, then join the call.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LocalUserChoices } from '@livekit/components-react';
import { DisconnectReason } from 'livekit-client';
import { hubErrorMessage } from '../../services/hub.service';
import { meetingsService, PublicMeeting } from '../../services/meetings.service';
import EmptyState from '../hub/ui/EmptyState';
import { Skeleton } from '../hub/ui/Skeleton';
import CallStage, { CallTimer } from './CallStage';
import Lobby from './Lobby';
import { meetingTime } from './meetingUtils';
import './meetings.css';

const POLL_MS = 3000;

type Phase = 'lobby' | 'waiting' | 'call' | 'denied' | 'removed' | 'left' | 'ended';

const GuestMeeting: React.FC = () => {
  const { code = '' } = useParams();
  const [info, setInfo] = useState<PublicMeeting | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [guest, setGuest] = useState<{ guestId: string; secret: string } | null>(null);
  const [connection, setConnection] = useState<{ url: string; token: string } | null>(null);
  const choicesRef = useRef<LocalUserChoices | null>(null);

  useEffect(() => {
    meetingsService
      .publicInfo(code)
      .then((m) => {
        setInfo(m);
        if (m.status === 'ended' || m.status === 'cancelled') setPhase('ended');
      })
      .catch((err) => setLoadError(hubErrorMessage(err, "This meeting link isn't working.")));
  }, [code]);

  useEffect(() => {
    if (phase !== 'waiting' || !guest) return undefined;
    let live = true;
    const check = async () => {
      try {
        const result = await meetingsService.guestStatus(code, guest.guestId, guest.secret);
        if (!live) return;
        if (result.status === 'admitted') {
          setConnection({ url: result.url, token: result.token });
          setPhase('call');
        } else if (result.status === 'denied') {
          setPhase('denied');
        } else if (result.status === 'ended') {
          setPhase('ended');
        }
      } catch {
        // A missed check is harmless; the next one catches up.
      }
    };
    check();
    const timer = window.setInterval(check, POLL_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [phase, guest, code]);

  const ask = async (choices: LocalUserChoices) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    choicesRef.current = choices;
    try {
      setGuest(await meetingsService.askToJoin(code, choices.username));
      setPhase('waiting');
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't ask to join. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const onLeft = useCallback((reason?: DisconnectReason) => {
    setConnection(null);
    if (reason === DisconnectReason.ROOM_DELETED) setPhase('ended');
    else if (reason === DisconnectReason.PARTICIPANT_REMOVED) setPhase('removed');
    else setPhase('left');
  }, []);

  const onFailed = useCallback((err: Error) => {
    setConnection(null);
    setPhase('lobby');
    setError(`Couldn't connect to the call. ${err.message}`);
  }, []);

  const message = (title: string, text: string, children?: React.ReactNode) => (
    <main className="mt-center">
      <EmptyState icon="video" title={title} text={text}>
        {children}
      </EmptyState>
    </main>
  );

  if (loadError) return message("This link isn't working", loadError);
  if (!info) {
    return (
      <main className="mt-center" aria-busy="true" aria-label="Loading">
        <Skeleton width={280} height={24} />
        <Skeleton width={420} height={240} />
      </main>
    );
  }
  if (phase === 'call' && connection && choicesRef.current) {
    return (
      <CallStage
        url={connection.url}
        token={connection.token}
        choices={choicesRef.current}
        onLeft={onLeft}
        onFailed={onFailed}
        header={
          <header className="mt-call-head">
            <div className="mt-call-title">
              <span className="mt-live-dot" aria-hidden="true" />
              <b>{info.title}</b>
              <CallTimer />
            </div>
          </header>
        }
      />
    );
  }
  if (phase === 'waiting') {
    return (
      <main className="mt-center" role="status" aria-live="polite">
        <span className="hub-spin mt-wait-spin" />
        <h1 className="mt-wait-title">Waiting for {info.hostName || 'the host'} to let you in</h1>
        <p className="mt-wait-text">{info.title}. Keep this page open, and you'll join automatically.</p>
      </main>
    );
  }
  if (phase === 'denied') return message("You weren't let in", 'Contact the person who invited you if you think this is a mistake.');
  if (phase === 'removed') return message('The host removed you from this call', 'Contact the person who invited you if you think this is a mistake.');
  if (phase === 'ended') return message('This meeting has ended', info.title);
  if (phase === 'left') {
    return message(
      'You left the call',
      info.title,
      <button type="button" className="hub-btn hub-btn-primary" onClick={() => setPhase('lobby')}>
        Rejoin
      </button>,
    );
  }
  return (
    <Lobby
      title={info.title}
      subtitle={`${meetingTime(info.startsAt, 0).split(' to ')[0]}${info.hostName ? ` · Hosted by ${info.hostName}` : ''}`}
      askName
      joinLabel="Ask to join"
      notice={
        !info.videoReady
          ? "Video calls aren't switched on yet. Please check back with your host."
          : info.isRecording
            ? `This call is being recorded${info.mayTakeNotes ? ' and may be transcribed into notes' : ''}. By joining, you agree to this.`
            : info.mayTakeNotes
              ? 'This call may be transcribed into notes for the people on it. By joining, you agree to this.'
              : null
      }
      error={error}
      busy={busy}
      onJoin={ask}
    />
  );
};

export default GuestMeeting;
