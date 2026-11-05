/** One meeting for a teammate (/meetings/:id): lobby, then the call, then a "you left" screen. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LocalUserChoices } from '@livekit/components-react';
import { DisconnectReason } from 'livekit-client';
import { authService } from '../../services/auth.service';
import { hubErrorMessage } from '../../services/hub.service';
import { JoinDetails, Meeting, meetingsService, WaitingGuest } from '../../services/meetings.service';
import ConfirmDialog from '../hub/ui/ConfirmDialog';
import EmptyState from '../hub/ui/EmptyState';
import Icon from '../hub/ui/Icon';
import { Modal } from '../hub/ui/Modal';
import { Skeleton } from '../hub/ui/Skeleton';
import { useToast } from '../hub/ui/Toast';
import CallStage from './CallStage';
import Lobby from './Lobby';
import { guestLink, meetingTime } from './meetingUtils';
import PeoplePicker from './PeoplePicker';
import './meetings.css';

const WAITING_POLL_MS = 4000;

type Phase = 'lobby' | 'call' | 'left' | 'ended';

const InviteModal: React.FC<{ meeting: Meeting; onClose: () => void; onSaved: (m: Meeting) => void }> = ({ meeting, onClose, onSaved }) => {
  const toast = useToast();
  const existing = meeting.invitees.map((i) => i.user.id);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      onSaved(await meetingsService.update(meeting.id, { inviteeIds: [...existing, ...selected] }));
      toast.show(selected.length === 1 ? 'Invite sent' : 'Invites sent');
      onClose();
    } catch (err) {
      toast.error(hubErrorMessage(err, "Couldn't send the invites."));
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Invite teammates"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="hub-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="hub-btn hub-btn-primary" onClick={save} disabled={busy || !selected.length}>
            {busy ? 'Sending…' : 'Send invites'}
          </button>
        </>
      }
    >
      <PeoplePicker selected={selected} onChange={setSelected} excludeIds={[...existing, ...(meeting.host ? [meeting.host.id] : [])]} />
    </Modal>
  );
};

const CallHeader: React.FC<{
  meeting: Meeting;
  isHost: boolean;
  onMeetingChange: (m: Meeting) => void;
  onEnded: () => void;
}> = ({ meeting, isHost, onMeetingChange, onEnded }) => {
  const toast = useToast();
  const [waiting, setWaiting] = useState<WaitingGuest[]>([]);
  const [inviting, setInviting] = useState(false);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (!isHost) return undefined;
    let live = true;
    const check = () =>
      meetingsService
        .waitingGuests(meeting.id)
        .then((list) => live && setWaiting(list))
        // A missed check is harmless; the next one catches up.
        .catch(() => undefined);
    check();
    const timer = window.setInterval(check, WAITING_POLL_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [isHost, meeting.id]);

  const decide = async (guest: WaitingGuest, decision: 'admit' | 'deny') => {
    setWaiting((list) => list.filter((g) => g.id !== guest.id));
    try {
      await meetingsService.decideGuest(meeting.id, guest.id, decision);
    } catch (err) {
      toast.error(hubErrorMessage(err, "Couldn't update that guest."));
    }
  };

  const copyLink = async () => {
    if (!meeting.guestCode) return;
    try {
      await navigator.clipboard.writeText(guestLink(meeting.guestCode));
      toast.show('Guest link copied');
    } catch {
      toast.error("Couldn't copy the link. Check your browser's permissions.");
    }
  };

  return (
    <>
      <header className="mt-call-head">
        <div className="mt-call-title">
          <span className="mt-live-dot" aria-hidden="true" />
          <b>{meeting.title}</b>
        </div>
        {isHost && (
          <div className="mt-call-actions">
            <button type="button" className="hub-btn hub-btn-sm" onClick={() => setInviting(true)}>
              <Icon name="users" />
              Invite
            </button>
            {meeting.guestLinkEnabled && (
              <button type="button" className="hub-btn hub-btn-sm" onClick={copyLink}>
                <Icon name="link" />
                Copy guest link
              </button>
            )}
            <button type="button" className="hub-btn hub-btn-sm hub-btn-danger" onClick={() => setEnding(true)}>
              End for everyone
            </button>
          </div>
        )}
      </header>
      {waiting.length > 0 && (
        <div className="mt-waiting" role="status" aria-live="polite">
          {waiting.map((g) => (
            <div className="mt-waiting-row" key={g.id}>
              <span>
                <b>{g.name}</b> wants to join
              </span>
              <span className="mt-waiting-actions">
                <button type="button" className="hub-btn hub-btn-sm" onClick={() => decide(g, 'deny')}>
                  Deny
                </button>
                <button type="button" className="hub-btn hub-btn-sm hub-btn-primary" onClick={() => decide(g, 'admit')}>
                  Admit
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
      {inviting && <InviteModal meeting={meeting} onClose={() => setInviting(false)} onSaved={onMeetingChange} />}
      {ending && (
        <ConfirmDialog
          title="End this call for everyone?"
          body="Everyone will be disconnected and the meeting will close."
          confirmLabel="End for everyone"
          busyLabel="Ending…"
          onConfirm={async () => {
            await meetingsService.end(meeting.id);
            setEnding(false);
            onEnded();
          }}
          onClose={() => setEnding(false)}
        />
      )}
    </>
  );
};

const MeetingRoom: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [details, setDetails] = useState<JoinDetails | null>(null);
  const choicesRef = useRef<LocalUserChoices | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const m = await meetingsService.get(id);
      setMeeting(m);
      if (m.status === 'ended' || m.status === 'cancelled') setPhase('ended');
    } catch (err) {
      setLoadError(hubErrorMessage(err, "Couldn't load this meeting."));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const join = async (choices: LocalUserChoices) => {
    if (joining) return;
    setJoining(true);
    setJoinError(null);
    choicesRef.current = choices;
    try {
      setDetails(await meetingsService.join(id));
      setPhase('call');
    } catch (err) {
      setJoinError(hubErrorMessage(err, "Couldn't join the call."));
    } finally {
      setJoining(false);
    }
  };

  const onLeft = useCallback((reason?: DisconnectReason) => {
    setDetails(null);
    setPhase(reason === DisconnectReason.ROOM_DELETED ? 'ended' : 'left');
  }, []);

  const onFailed = useCallback((error: Error) => {
    setDetails(null);
    setPhase('lobby');
    setJoinError(`Couldn't connect to the call. ${error.message}`);
  }, []);

  if (loadError) {
    return (
      <main className="mt-center">
        <EmptyState icon="alert" title="Couldn't open this meeting" text={loadError} actionLabel="Back to meetings" actionIcon="video" onAction={() => navigate('/meetings')} />
      </main>
    );
  }
  if (!meeting) {
    return (
      <main className="mt-center" aria-busy="true" aria-label="Loading">
        <Skeleton width={280} height={24} />
        <Skeleton width={420} height={240} />
      </main>
    );
  }
  if (phase === 'call' && details && choicesRef.current) {
    return (
      <CallStage
        url={details.url}
        token={details.token}
        choices={choicesRef.current}
        onLeft={onLeft}
        onFailed={onFailed}
        header={
          <CallHeader
            meeting={meeting}
            isHost={details.isHost}
            onMeetingChange={setMeeting}
            onEnded={() => onLeft(DisconnectReason.ROOM_DELETED)}
          />
        }
      />
    );
  }
  if (phase === 'left' || phase === 'ended') {
    const closed = phase === 'ended';
    return (
      <main className="mt-center">
        <EmptyState
          icon="video"
          title={meeting.status === 'cancelled' ? 'This meeting was cancelled' : closed ? 'This meeting has ended' : 'You left the call'}
          text={closed ? meeting.title : 'The call keeps going for anyone still on it.'}
        >
          <div className="mt-after">
            {!closed && (
              <button type="button" className="hub-btn hub-btn-primary" onClick={() => setPhase('lobby')}>
                Rejoin
              </button>
            )}
            <Link to="/meetings" className="hub-btn">
              Back to meetings
            </Link>
          </div>
        </EmptyState>
      </main>
    );
  }
  return (
    <Lobby
      title={meeting.title}
      subtitle={`${meetingTime(meeting.startsAt, meeting.durationMinutes)}${meeting.project ? ` · ${meeting.project.name}` : ''}`}
      defaultName={authService.getUser()?.name || 'Teammate'}
      joinLabel={meeting.status === 'live' ? 'Join call' : 'Start call'}
      notice={meeting.videoReady === false && !joinError ? "Video calls aren't switched on yet. Joining will work once the LiveKit keys are added." : null}
      error={joinError}
      busy={joining}
      onJoin={join}
      footer={
        <Link to="/meetings" className="hub-btn hub-btn-ghost mt-lobby-back">
          Back to meetings
        </Link>
      }
    />
  );
};

export default MeetingRoom;
