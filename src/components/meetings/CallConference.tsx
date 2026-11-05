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
  useParticipants,
  usePinnedTracks,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import { Participant, RoomEvent, Track } from 'livekit-client';
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

const PeoplePanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const participants = useParticipants();
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
                <span data-off={!p.isMicrophoneEnabled} title={p.isMicrophoneEnabled ? 'Microphone on' : 'Microphone off'}>
                  {p.isMicrophoneEnabled ? <MicIcon /> : <MicDisabledIcon />}
                </span>
                <span data-off={!p.isCameraEnabled} title={p.isCameraEnabled ? 'Camera on' : 'Camera off'}>
                  {p.isCameraEnabled ? <CameraIcon /> : <CameraDisabledIcon />}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
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

const CallConference: React.FC = () => {
  const layout = useCreateLayoutContext();
  const [showChat, setShowChat] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const autoPinned = useRef<TrackReferenceOrPlaceholder | null>(null);

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
        {showPeople && <PeoplePanel onClose={() => setShowPeople(false)} />}
      </LayoutProvider>
      <AudioRenderer />
      <ConnectionToast />
    </div>
  );
};

export default CallConference;
