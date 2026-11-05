/**
 * Meetings API client. Contract: Project_Management_Tool_Backend/docs/meetings.md.
 * Errors are axios errors; turn them into a message with `hubErrorMessage(err)`.
 */
import axios from 'axios';
import { HubUser } from './hub.service';

const API_URL = process.env.REACT_APP_API_URL || 'https://projectmanagementtoolbackend-production.up.railway.app';

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export type MeetingStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';
export type MeetingView = 'upcoming' | 'past';

export interface Meeting {
  id: string;
  title: string;
  notes: string | null;
  startsAt: string;
  durationMinutes: number;
  status: MeetingStatus;
  startedAt: string | null;
  endedAt: string | null;
  host: HubUser | null;
  isHost: boolean;
  project: { id: string; name: string } | null;
  invitees: { user: HubUser; joinedAt: string | null }[];
  /** Only the host gets these two. */
  guestCode: string | null;
  guestLinkEnabled: boolean | null;
  videoReady?: boolean;
  isRecording?: boolean;
}

export interface MeetingInput {
  title: string;
  notes?: string | null;
  startsAt?: string;
  durationMinutes?: number;
  projectId?: string | null;
  inviteeIds?: string[];
}

export interface JoinDetails {
  url: string;
  token: string;
  isHost: boolean;
}

export interface WaitingGuest {
  id: string;
  name: string;
  createdAt: string;
}

export interface PublicMeeting {
  title: string;
  hostName: string | null;
  startsAt: string;
  status: MeetingStatus;
  videoReady: boolean;
  isRecording?: boolean;
}

export interface MeetingRecording {
  id: string;
  meetingId: string;
  status: 'uploading' | 'ready' | 'failed';
  startedAt: string;
  durationSeconds: number | null;
  sizeBytes: number | null;
  title: string;
  projectName: string | null;
  canManage: boolean;
}

export interface RecordingPart {
  partNumber: number;
  etag: string;
  size: number;
}

export type GuestStatus =
  | { status: 'waiting' | 'denied' | 'ended' }
  | { status: 'admitted'; url: string; token: string };

const data = <T,>(p: Promise<{ data: T }>) => p.then((r) => r.data);

const recordingUrl = (meetingId: string, id: string) => `${API_URL}/meetings/${meetingId}/recordings/${id}`;

export const meetingsService = {
  recordings: () => data<{ recordings: MeetingRecording[] }>(axios.get(`${API_URL}/meetings/recordings`, auth())).then((r) => r.recordings),
  recordingPlayback: (id: string) =>
    data<{ deliveryUrl: string; embedUrl: string; expiresAt: string }>(axios.post(`${API_URL}/meetings/recordings/${id}/playback`, {}, auth())),
  deleteRecording: (meetingId: string, id: string) => data<{ deleted: boolean }>(axios.delete(recordingUrl(meetingId, id), auth())),
  startRecording: (meetingId: string) => data<{ id: string }>(axios.post(`${API_URL}/meetings/${meetingId}/recordings`, {}, auth())),
  stopRecording: (meetingId: string, id: string, durationSeconds: number) =>
    data<{ status: string }>(axios.post(`${recordingUrl(meetingId, id)}/stop`, { durationSeconds }, auth())),
  failRecording: (meetingId: string, id: string) => data<{ status: string }>(axios.post(`${recordingUrl(meetingId, id)}/fail`, {}, auth())),
  beginRecordingUpload: (meetingId: string, id: string, input: { contentType: string; sizeBytes: number }) =>
    data<{ partSize: number }>(axios.post(`${recordingUrl(meetingId, id)}/upload`, input, auth())),
  uploadRecordingPart: (meetingId: string, id: string, partNumber: number, chunk: Blob, onSent: (bytes: number) => void) =>
    data<{ etag: string }>(
      axios.put(`${recordingUrl(meetingId, id)}/parts/${partNumber}`, chunk, {
        headers: { ...auth().headers, 'Content-Type': 'application/octet-stream' },
        onUploadProgress: (event) => onSent(event.loaded),
      }),
    ).then((r) => r.etag),
  completeRecording: (meetingId: string, id: string, parts: RecordingPart[]) =>
    data<{ status: string }>(axios.post(`${recordingUrl(meetingId, id)}/complete`, { parts }, auth())).then((r) => r.status),
  muteParticipant: (id: string, identity: string) =>
    data<{ muted: boolean }>(axios.post(`${API_URL}/meetings/${id}/participants/mute`, { identity }, auth())),
  removeParticipant: (id: string, identity: string) =>
    data<{ removed: boolean }>(axios.post(`${API_URL}/meetings/${id}/participants/remove`, { identity }, auth())),
  list: (view: MeetingView) =>
    data<{ meetings: Meeting[]; videoReady: boolean }>(axios.get(`${API_URL}/meetings`, { ...auth(), params: { view } })),
  get: (id: string) => data<Meeting>(axios.get(`${API_URL}/meetings/${id}`, auth())),
  create: (input: MeetingInput) => data<Meeting>(axios.post(`${API_URL}/meetings`, input, auth())),
  update: (id: string, input: Partial<MeetingInput>) => data<Meeting>(axios.patch(`${API_URL}/meetings/${id}`, input, auth())),
  join: (id: string) => data<JoinDetails>(axios.post(`${API_URL}/meetings/${id}/join`, {}, auth())),
  end: (id: string) => data<{ status: MeetingStatus }>(axios.post(`${API_URL}/meetings/${id}/end`, {}, auth())),
  cancel: (id: string) => data<{ status: MeetingStatus }>(axios.post(`${API_URL}/meetings/${id}/cancel`, {}, auth())),
  setGuestLink: (id: string, input: { enabled?: boolean; regenerate?: boolean }) =>
    data<{ guestCode: string; guestLinkEnabled: boolean }>(axios.post(`${API_URL}/meetings/${id}/guest-link`, input, auth())),
  waitingGuests: (id: string) => data<WaitingGuest[]>(axios.get(`${API_URL}/meetings/${id}/guests`, auth())),
  decideGuest: (id: string, guestId: string, decision: 'admit' | 'deny') =>
    data<{ id: string; status: string }>(axios.post(`${API_URL}/meetings/${id}/guests/${guestId}`, { decision }, auth())),

  publicInfo: (code: string) => data<PublicMeeting>(axios.get(`${API_URL}/public/meetings/${code}`)),
  askToJoin: (code: string, name: string) =>
    data<{ guestId: string; secret: string }>(axios.post(`${API_URL}/public/meetings/${code}/guests`, { name })),
  guestStatus: (code: string, guestId: string, secret: string) =>
    data<GuestStatus>(axios.post(`${API_URL}/public/meetings/${code}/guests/${guestId}/status`, { secret })),
};
