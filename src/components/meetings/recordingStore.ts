/**
 * The one recording this browser is making. It lives outside React so the upload keeps going after the
 * call screen closes, including when the host clicks through to another page in the app.
 */
import { useSyncExternalStore } from 'react';
import { Room } from 'livekit-client';
import { hubErrorMessage } from '../../services/hub.service';
import { meetingsService, RecordingPart } from '../../services/meetings.service';
import { CallRecorder, FinishedRecording } from './callRecorder';

export type RecordingPhase = 'idle' | 'starting' | 'recording' | 'saving' | 'saved' | 'failed';

export interface RecordingState {
  phase: RecordingPhase;
  meetingId: string | null;
  /** 0 to 1 while saving. */
  progress: number;
  error: string | null;
  /** Lets the host keep their copy if saving fails. */
  downloadUrl: string | null;
}

const IDLE: RecordingState = { phase: 'idle', meetingId: null, progress: 0, error: null, downloadUrl: null };
const PART_ATTEMPTS = 3;
const CHECK_EVERY_MS = 5000;
const CHECK_LIMIT_MS = 10 * 60 * 1000;

let state = IDLE;
let recorder: CallRecorder | null = null;
let recordingId: string | null = null;
let finished: FinishedRecording | null = null;
const listeners = new Set<() => void>();

const warnBeforeClosing = (event: BeforeUnloadEvent) => {
  event.preventDefault();
  event.returnValue = '';
};

const set = (patch: Partial<RecordingState>) => {
  const wasBusy = state.phase === 'recording' || state.phase === 'saving';
  state = { ...state, ...patch };
  const isBusy = state.phase === 'recording' || state.phase === 'saving';
  if (isBusy && !wasBusy) window.addEventListener('beforeunload', warnBeforeClosing);
  if (!isBusy && wasBusy) window.removeEventListener('beforeunload', warnBeforeClosing);
  listeners.forEach((listener) => listener());
};

const upload = async () => {
  const meetingId = state.meetingId;
  if (!meetingId || !recordingId || !finished) return;
  const { blob, contentType } = finished;
  set({ phase: 'saving', progress: 0, error: null });
  try {
    if (!blob.size) throw new Error('The recording is empty.');
    const { partSize } = await meetingsService.beginRecordingUpload(meetingId, recordingId, { contentType, sizeBytes: blob.size });
    const parts: RecordingPart[] = [];
    for (let start = 0, partNumber = 1; start < blob.size; start += partSize, partNumber += 1) {
      const chunk = blob.slice(start, Math.min(start + partSize, blob.size));
      let etag = '';
      for (let attempt = 1; !etag; attempt += 1) {
        try {
          // eslint-disable-next-line no-await-in-loop
          etag = await meetingsService.uploadRecordingPart(meetingId, recordingId, partNumber, chunk, (sent) =>
            set({ progress: (start + sent) / blob.size }),
          );
        } catch (err) {
          if (attempt >= PART_ATTEMPTS) throw err;
        }
      }
      parts.push({ partNumber, etag, size: chunk.size });
    }
    // Iceberg checks the video before accepting it, which takes longer the bigger it is.
    let status = await meetingsService.completeRecording(meetingId, recordingId, parts);
    for (let waited = 0; status !== 'ready' && waited < CHECK_LIMIT_MS; waited += CHECK_EVERY_MS) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => window.setTimeout(resolve, CHECK_EVERY_MS));
      // eslint-disable-next-line no-await-in-loop
      status = await meetingsService.completeRecording(meetingId, recordingId, parts);
    }
    if (status !== 'ready') throw new Error('Iceberg is still checking the video.');
    set({ phase: 'saved', progress: 1 });
    finished = null;
  } catch (err) {
    set({
      phase: 'failed',
      error: hubErrorMessage(err, "Couldn't save the recording."),
      downloadUrl: state.downloadUrl || URL.createObjectURL(blob),
    });
  }
};

export const recordingStore = {
  getState: () => state,

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Throws with a message to show the host if it can't start. */
  async start(meetingId: string, room: Room, stage: () => HTMLElement | null) {
    if (state.phase === 'starting' || state.phase === 'recording' || state.phase === 'saving') return;
    if (state.downloadUrl) URL.revokeObjectURL(state.downloadUrl);
    set({ ...IDLE, phase: 'starting', meetingId });
    let id: string | null = null;
    try {
      const next = new CallRecorder(room, stage);
      id = (await meetingsService.startRecording(meetingId)).id;
      await next.start();
      recorder = next;
      recordingId = id;
      set({ phase: 'recording' });
    } catch (err) {
      if (id) meetingsService.failRecording(meetingId, id).catch(() => undefined);
      set(IDLE);
      throw new Error(hubErrorMessage(err, "Couldn't start recording."));
    }
  },

  /** Resolves once the call may safely end. The upload carries on in the background. */
  async stop() {
    const active = recorder;
    const meetingId = state.meetingId;
    if (state.phase !== 'recording' || !active || !meetingId || !recordingId) return;
    recorder = null;
    set({ phase: 'saving', progress: 0 });
    try {
      finished = await active.stop();
      await meetingsService.stopRecording(meetingId, recordingId, finished.durationSeconds);
    } catch (err) {
      set({
        phase: 'failed',
        error: hubErrorMessage(err, "Couldn't save the recording."),
        downloadUrl: finished ? URL.createObjectURL(finished.blob) : null,
      });
      return;
    }
    upload();
  },

  retry() {
    if (state.phase === 'failed' && finished) upload();
  },

  dismiss() {
    if (state.phase !== 'saved' && state.phase !== 'failed') return;
    if (state.downloadUrl) URL.revokeObjectURL(state.downloadUrl);
    finished = null;
    set(IDLE);
  },
};

export const useRecordingState = (): RecordingState => useSyncExternalStore(recordingStore.subscribe, recordingStore.getState);
