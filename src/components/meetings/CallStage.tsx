/**
 * The live call: connects to LiveKit's room and shows CallConference.
 * `header` sits above it. Used by teammates (MeetingRoom) and guests (GuestMeeting).
 */
import React, { useEffect, useState } from 'react';
import { LiveKitRoom, LiveKitRoomProps, LocalUserChoices } from '@livekit/components-react';
import { DisconnectReason, RoomOptions, VideoPresets } from 'livekit-client';
import '@livekit/components-styles';
import CallConference from './CallConference';
import { callDuration } from './meetingUtils';
import './meetings.css';

// LiveKit's types return ReactNode, which this project's older TypeScript won't accept as a component.
const Room = LiveKitRoom as unknown as React.FC<LiveKitRoomProps & { children?: React.ReactNode; 'data-lk-theme'?: string }>;

/** Running call length. `since` is when the call started, or the moment you joined if unknown. */
export const CallTimer: React.FC<{ since?: string | null }> = ({ since }) => {
  const [start] = useState(() => (since ? new Date(since).getTime() : Date.now()));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <span className="mt-timer">{callDuration(now - start)}</span>;
};

const CallStage: React.FC<{
  url: string;
  token: string;
  choices: LocalUserChoices;
  header: React.ReactNode;
  onLeft: (reason?: DisconnectReason) => void;
  onFailed: (error: Error) => void;
}> = ({ url, token, choices, header, onLeft, onFailed }) => {
  const options: RoomOptions = {
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: { deviceId: choices.videoDeviceId || undefined, resolution: VideoPresets.h720.resolution },
    audioCaptureDefaults: { deviceId: choices.audioDeviceId || undefined },
    publishDefaults: { simulcast: true },
  };
  return (
    <div className="mt-call">
      {header}
      <Room
        className="mt-call-room"
        data-lk-theme="default"
        serverUrl={url}
        token={token}
        connect
        audio={choices.audioEnabled}
        video={choices.videoEnabled}
        options={options}
        onDisconnected={onLeft}
        onError={onFailed}
      >
        <CallConference />
      </Room>
    </div>
  );
};

export default CallStage;
