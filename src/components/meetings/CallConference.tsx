/**
 * Inside the call: video layout, floating controls, chat and the people panel.
 * Built from LiveKit's parts rather than its VideoConference prefab, because that prefab
 * has no people list and its control bar can't take extra buttons.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CameraDisabledIcon,
  CameraIcon,
  CarouselLayout,
  Chat,
  ChatIcon,
  ChatToggle,
  ConnectionQualityIndicator,
  ConnectionStateToast,
  DisconnectButton,
  FocusLayoutContainer,
  GridLayout,
  isTrackReference,
  LayoutContextProvider,
  LeaveIcon,
  MediaDeviceMenu,
  MicDisabledIcon,
  MicIcon,
  ParticipantName,
  ParticipantTile,
  RoomAudioRenderer,
  ScreenShareIcon,
  TrackMutedIndicator,
  TrackReferenceOrPlaceholder,
  TrackToggle,
  useCreateLayoutContext,
  useEnsureTrackRef,
  useLocalParticipant,
  useParticipants,
  usePinnedTracks,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import { LocalVideoTrack, Participant, RoomEvent, Track } from 'livekit-client';
import ConfirmDialog from '../hub/ui/ConfirmDialog';
import Icon from '../hub/ui/Icon';
import { avatarHue, initials, plainName } from './meetingUtils';

// LiveKit's types return ReactNode, which this project's older TypeScript won't accept as a component.
const fc = <P,>(component: unknown) => component as React.FC<P>;
type Children = { children?: React.ReactNode };
type Html = React.HTMLAttributes<HTMLElement> & Children;
const LayoutProvider = fc<Children & { value: ReturnType<typeof useCreateLayoutContext>; onWidgetChange?: (s: { showChat: boolean }) => void }>(LayoutContextProvider);
const Grid = fc<Children & { tracks: TrackReferenceOrPlaceholder[] }>(GridLayout);
const Carousel = fc<Children & { tracks: TrackReferenceOrPlaceholder[] }>(CarouselLayout);
const FocusContainer = fc<Children>(FocusLayoutContainer);
const Tile = fc<Html & { trackRef?: TrackReferenceOrPlaceholder }>(ParticipantTile);
const Video = fc<{ trackRef: TrackReferenceOrPlaceholder }>(VideoTrack);
const Name = fc<Html>(ParticipantName);
const MutedIndicator = fc<{ trackRef: TrackReferenceOrPlaceholder; show?: string }>(TrackMutedIndicator);
const Quality = fc<Html>(ConnectionQualityIndicator);
const Toggle = fc<Html & { source: Track.Source; showIcon?: boolean; title?: string; 'aria-label'?: string; captureOptions?: unknown; onDeviceError?: (e: Error) => void }>(TrackToggle);
const DeviceMenu = fc<{ kind: MediaDeviceKind }>(MediaDeviceMenu);
const ChatButton = fc<Html & { title?: string; 'aria-label'?: string }>(ChatToggle);
const Leave = fc<Html & { title?: string; 'aria-label'?: string }>(DisconnectButton);
const ChatPanel = fc<Html>(Chat);
const AudioRenderer = fc<object>(RoomAudioRenderer);
const ConnectionToast = fc<object>(ConnectionStateToast);

/** Only the host gets these. */
export interface HostControls {
  mute: (identity: string) => Promise<void>;
  remove: (identity: string) => Promise<void>;
}

const Avatar: React.FC<{ name: string; className?: string }> = ({ name, className = '' }) => (
  <span className={`mt-avatar ${className}`} style={{ '--avatar-hue': avatarHue(name) } as React.CSSProperties} aria-hidden="true">
    {initials(name)}
  </span>
);

const tileName = (p: Participant) => p.name || p.identity;

/** LiveKit's tile with a coloured initials avatar in place of its grey silhouette. */
const CallTile: React.FC<{ trackRef?: TrackReferenceOrPlaceholder }> = ({ trackRef }) => {
  const ref = useEnsureTrackRef(trackRef);
  const isScreen = ref.source === Track.Source.ScreenShare;
  return (
    <Tile trackRef={ref}>
      {isTrackReference(ref) ? <Video trackRef={ref} /> : null}
      <div className="lk-participant-placeholder">
        <Avatar name={tileName(ref.participant)} className="mt-avatar-lg" />
      </div>
      <div className="lk-participant-metadata">
        <div className="lk-participant-metadata-item">
          {isScreen ? (
            <>
              <ScreenShareIcon style={{ marginRight: '0.25rem' }} />
              <Name>&apos;s screen</Name>
            </>
          ) : (
            <>
              <MutedIndicator trackRef={{ participant: ref.participant, source: Track.Source.Microphone }} show="muted" />
              <Name />
            </>
          )}
        </div>
        <Quality className="lk-participant-metadata-item" />
      </div>
    </Tile>
  );
};

const isHostParticipant = (p: Participant) => {
  try {
    return !!JSON.parse(p.metadata || '{}').isHost;
  } catch {
    return false;
  }
};

const PeoplePanel: React.FC<{ onClose: () => void; host?: HostControls }> = ({ onClose, host }) => {
  const participants = useParticipants();
  const [removing, setRemoving] = useState<Participant | null>(null);
  const sorted = useMemo(
    () =>
      [...participants].sort(
        (a, b) =>
          Number(isHostParticipant(b)) - Number(isHostParticipant(a)) ||
          Number(b.isLocal) - Number(a.isLocal) ||
          tileName(a).localeCompare(tileName(b)),
      ),
    [participants],
  );
  return (
    <aside className="mt-people" aria-label="People in this call">
      <header className="mt-side-head">
        <b>People ({participants.length})</b>
        <button type="button" className="mt-side-close" onClick={onClose} aria-label="Close people">
          <Icon name="x" />
        </button>
      </header>
      <ul className="mt-people-list">
        {sorted.map((p) => {
          const name = tileName(p);
          return (
            <li key={p.identity} className="mt-person" data-speaking={p.isSpeaking}>
              <Avatar name={name} />
              <span className="mt-person-name">
                <span className="mt-person-text">{plainName(name)}</span>
                {p.isLocal && <span className="mt-person-you">You</span>}
                {isHostParticipant(p) && <span className="mt-chip">Host</span>}
                {p.identity.startsWith('guest:') && <span className="mt-chip">Guest</span>}
              </span>
              <span className="mt-person-state">
                {host && !p.isLocal && p.isMicrophoneEnabled ? (
                  <button type="button" className="mt-person-btn" title={`Mute ${plainName(name)}`} aria-label={`Mute ${plainName(name)}`} onClick={() => host.mute(p.identity)}>
                    <MicIcon />
                  </button>
                ) : (
                  <span data-off={!p.isMicrophoneEnabled} title={p.isMicrophoneEnabled ? 'Microphone on' : 'Microphone off'}>
                    {p.isMicrophoneEnabled ? <MicIcon /> : <MicDisabledIcon />}
                  </span>
                )}
                <span data-off={!p.isCameraEnabled} title={p.isCameraEnabled ? 'Camera on' : 'Camera off'}>
                  {p.isCameraEnabled ? <CameraIcon /> : <CameraDisabledIcon />}
                </span>
                {host && !p.isLocal && (
                  <button type="button" className="mt-person-btn mt-person-remove" title={`Remove ${plainName(name)}`} aria-label={`Remove ${plainName(name)}`} onClick={() => setRemoving(p)}>
                    <Icon name="x" />
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {host && removing && (
        <ConfirmDialog
          title={`Remove ${plainName(tileName(removing))} from this call?`}
          body={removing.identity.startsWith('guest:') ? 'They will have to ask to join again.' : 'They can rejoin from the meeting page.'}
          confirmLabel="Remove"
          busyLabel="Removing…"
          onConfirm={async () => {
            await host.remove(removing.identity);
            setRemoving(null);
          }}
          onClose={() => setRemoving(null)}
        />
      )}
    </aside>
  );
};

const PeopleButton: React.FC<{ open: boolean; onClick: () => void }> = ({ open, onClick }) => {
  const count = useParticipants().length;
  const label = `People, ${count} in this call`;
  return (
    <button type="button" className="lk-button mt-people-btn" aria-pressed={open} aria-label={label} title={label} onClick={onClick}>
      <Icon name="users" />
      {/* The key restarts the pop animation whenever someone joins or leaves. */}
      <span key={count} className="mt-count">
        {count}
      </span>
    </button>
  );
};

const BLUR_KEY = 'meetings.blurBackground';
const readBlurChoice = () => {
  try {
    return localStorage.getItem(BLUR_KEY) === 'on';
  } catch {
    return false;
  }
};
const saveBlurChoice = (on: boolean) => {
  try {
    localStorage.setItem(BLUR_KEY, on ? 'on' : 'off');
  } catch {
    // Without storage the choice just lasts for this call.
  }
};

/** Blurs what's behind you, on your own device. The library loads only once someone uses it. */
const BlurButton: React.FC<{ onProblem: (message: string) => void }> = ({ onProblem }) => {
  const { cameraTrack } = useLocalParticipant();
  const [on, setOn] = useState(readBlurChoice);
  const [busy, setBusy] = useState(false);
  const track = cameraTrack?.track as LocalVideoTrack | undefined;

  useEffect(() => {
    if (!track) return undefined;
    let current = true;
    const apply = async () => {
      if (on === !!track.getProcessor()) return;
      setBusy(true);
      try {
        if (on) {
          const { BackgroundBlur, supportsBackgroundProcessors } = await import('@livekit/track-processors');
          if (!supportsBackgroundProcessors()) throw new Error('unsupported');
          if (current) await track.setProcessor(BackgroundBlur(14));
        } else {
          await track.stopProcessor();
        }
      } catch {
        if (current) {
          setOn(false);
          saveBlurChoice(false);
          onProblem("Background blur isn't available on this device.");
        }
      } finally {
        if (current) setBusy(false);
      }
    };
    apply();
    return () => {
      current = false;
    };
  }, [on, track, onProblem]);

  const label = on ? 'Turn off background blur' : 'Blur background';
  return (
    <button
      type="button"
      className="lk-button mt-blur-btn"
      aria-pressed={on}
      aria-label={label}
      title={label}
      disabled={busy}
      onClick={() => {
        saveBlurChoice(!on);
        setOn(!on);
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="9" r="3.5" />
        <path d="M6 20c.6-3.6 3-5.5 6-5.5s5.400 1.900 6 5.500" />
        <path d="M3 5v.01M3 11v.01M3 17v.01M21 5v.01M21 11v.01M21 17v.01" strokeWidth="2.600" />
      </svg>
    </button>
  );
};

const CallConference: React.FC<{ host?: HostControls }> = ({ host }) => {
  const layout = useCreateLayoutContext();
  const [showChat, setShowChat] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const autoPinned = useRef<TrackReferenceOrPlaceholder | null>(null);

  useEffect(() => {
    if (!problem) return undefined;
    const timer = window.setTimeout(() => setProblem(null), 5000);
    return () => window.clearTimeout(timer);
  }, [problem]);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
  );
  const screenShares = tracks.filter(isTrackReference).filter((t) => t.publication.source === Track.Source.ScreenShare);
  const focused = usePinnedTracks(layout)?.[0];
  const others = tracks.filter(
    (t) => !focused || t.participant.identity !== focused.participant.identity || t.source !== focused.source,
  );
  const shareKey = screenShares.map((t) => `${t.publication.trackSid}_${t.publication.isSubscribed}`).join();

  // A new screen share takes the big tile, and the grid comes back when it stops.
  useEffect(() => {
    const pin = layout.pin.dispatch;
    if (!pin) return;
    if (screenShares.some((t) => t.publication.isSubscribed) && !autoPinned.current) {
      pin({ msg: 'set_pin', trackReference: screenShares[0] });
      [autoPinned.current] = screenShares;
    } else if (
      autoPinned.current &&
      isTrackReference(autoPinned.current) &&
      !screenShares.some((t) => t.publication.trackSid === (autoPinned.current as typeof screenShares[0]).publication.trackSid)
    ) {
      pin({ msg: 'clear_pin' });
      autoPinned.current = null;
    }
    // Only a change in the shares themselves should re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareKey]);

  const togglePeople = () => {
    if (!showPeople && showChat) layout.widget.dispatch?.({ msg: 'hide_chat' });
    setShowPeople(!showPeople);
  };

  return (
    <div className="lk-video-conference">
      <LayoutProvider
        value={layout}
        onWidgetChange={(state) => {
          setShowChat(state.showChat);
          if (state.showChat) setShowPeople(false);
        }}
      >
        <div className="lk-video-conference-inner">
          {focused ? (
            <div className="lk-focus-layout-wrapper">
              <FocusContainer>
                <Carousel tracks={others}>
                  <CallTile />
                </Carousel>
                <CallTile trackRef={focused} />
              </FocusContainer>
            </div>
          ) : (
            <div className="lk-grid-layout-wrapper">
              <Grid tracks={tracks}>
                <CallTile />
              </Grid>
            </div>
          )}
          {problem && (
            <div className="mt-call-note" role="status">
              {problem}
            </div>
          )}
          <div className="lk-control-bar mt-dock" role="toolbar" aria-label="Call controls">
            <div className="lk-button-group">
              <Toggle source={Track.Source.Microphone} title="Microphone" aria-label="Microphone" />
              <div className="lk-button-group-menu">
                <DeviceMenu kind="audioinput" />
              </div>
            </div>
            <div className="lk-button-group">
              <Toggle source={Track.Source.Camera} title="Camera" aria-label="Camera" />
              <div className="lk-button-group-menu">
                <DeviceMenu kind="videoinput" />
              </div>
            </div>
            <BlurButton onProblem={setProblem} />
            <Toggle
              source={Track.Source.ScreenShare}
              title={screenShares.some((t) => t.participant.isLocal) ? 'Stop sharing' : 'Share screen'}
              aria-label="Share screen"
              captureOptions={{ audio: true, selfBrowserSurface: 'include' }}
            />
            <PeopleButton open={showPeople} onClick={togglePeople} />
            <ChatButton title="Chat" aria-label="Chat">
              <ChatIcon />
            </ChatButton>
            <Leave className="lk-disconnect-button" title="Leave call" aria-label="Leave call">
              <LeaveIcon />
            </Leave>
          </div>
        </div>
        <ChatPanel style={{ display: showChat ? undefined : 'none' }} />
        {showPeople && <PeoplePanel host={host} onClose={() => setShowPeople(false)} />}
      </LayoutProvider>
      <AudioRenderer />
      <ConnectionToast />
    </div>
  );
};

export default CallConference;
