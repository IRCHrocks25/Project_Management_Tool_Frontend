/**
 * The live call: LiveKit's room with video grid, screen share, chat and device controls.
 * `header` sits above it. Used by teammates (MeetingRoom) and guests (GuestMeeting).
 */
import React from 'react';
import { LiveKitRoom, LiveKitRoomProps, VideoConference, LocalUserChoices } from '@livekit/components-react';
import { DisconnectReason, RoomOptions, VideoPresets } from 'livekit-client';
import '@livekit/components-styles';
import './meetings.css';

// LiveKit's types return ReactNode, which this project's older TypeScript won't accept as a component.
const Room = LiveKitRoom as unknown as React.FC<LiveKitRoomProps & { children?: React.ReactNode; 'data-lk-theme'?: string }>;
const Conference = VideoConference as unknown as React.FC;

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
        <Conference />
      </Room>
    </div>
  );
};

export default CallStage;
