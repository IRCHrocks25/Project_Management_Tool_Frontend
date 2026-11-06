/**
 * Takes notes on a call from this browser: checks in with the server, and if this browser is the one chosen to
 * capture, mixes the call's audio and sends it up a few seconds at a time. Only one browser in a call captures,
 * and another takes over if it drops. Also remembers who was speaking, so the transcript can use real names.
 */
import axios from 'axios';
import { ConnectionState, Participant, Room, RoomEvent } from 'livekit-client';
import { hubErrorMessage } from '../../services/hub.service';
import { meetingsService, SpeakerSpan } from '../../services/meetings.service';
import { CallAudioMix } from './callRecorder';
import { plainName } from './meetingUtils';

const HEARTBEAT_MS = 15_000;
const CHUNK_MS = 15_000;
const CHUNK_ATTEMPTS = 5;
const RETRY_DELAY_MS = 2000;
const AUDIO_BITS_PER_SECOND = 32_000;
const FORMATS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

const pickFormat = () => (typeof MediaRecorder === 'undefined' ? undefined : FORMATS.find((f) => MediaRecorder.isTypeSupported(f)));

export const canTakeNotes = (): boolean => !!pickFormat() && typeof AudioContext !== 'undefined';

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export class NotesCapture {
  private timer: number | null = null;
  private noteId: string | null = null;
  private segment: number | null = null;
  private seq = 0;
  private recorder: MediaRecorder | null = null;
  private mix: CallAudioMix | null = null;
  private mixTimer: number | null = null;
  private recorderStartedAt = 0;
  private uploads: Promise<unknown> = Promise.resolve();
  private spans: SpeakerSpan[] = [];
  private speaking = new Map<string, number>();
  private busy = false;
  private stopped = false;

  constructor(
    private readonly meetingId: string,
    private readonly room: Room,
    private readonly onProblem: (message: string) => void,
  ) {}

  async start() {
    // The notice everyone sees lives on the room, so nothing starts until the room exists.
    if (this.room.state !== ConnectionState.Connected) {
      await new Promise<void>((resolve) => this.room.once(RoomEvent.Connected, () => resolve()));
    }
    if (this.stopped) return;
    await this.checkIn();
    if (!this.stopped) this.timer = window.setInterval(() => this.checkIn(), HEARTBEAT_MS);
  }

  /** Sends what's left, then tells the server this person has gone. */
  async stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer !== null) window.clearInterval(this.timer);
    await this.stopRecorder();
    await this.sendLastSpans();
    await meetingsService.leaveNotes(this.meetingId).catch(() => undefined);
  }

  private async checkIn() {
    if (this.busy || this.stopped) return;
    this.busy = true;
    const speakers = this.takeSpans();
    try {
      const result = await meetingsService.listenForNotes(this.meetingId, {
        segment: this.segment,
        contentType: pickFormat()?.split(';')[0],
        speakers,
      });
      if (this.stopped) return;
      this.noteId = result.noteId;
      if (result.capturing && result.segment !== null) {
        if (this.segment !== result.segment || !this.recorder) await this.startRecorder(result.segment);
      } else {
        await this.stopRecorder();
        // Starting again later has to be a fresh segment: the audio only makes sense as one continuous file.
        this.segment = null;
      }
    } catch (err) {
      this.spans = [...speakers, ...this.spans];
      const status = (err as { response?: { status?: number } })?.response?.status;
      // A dropped connection just waits for the next check-in. These won't get better on their own.
      if (status === 503 || status === 410 || status === 404) {
        this.onProblem(hubErrorMessage(err, "Notes stopped for this call."));
        this.stop();
      }
    } finally {
      this.busy = false;
    }
  }

  private async startRecorder(segment: number) {
    await this.stopRecorder();
    const mimeType = pickFormat();
    if (!mimeType) return;
    const mix = new CallAudioMix(this.room);
    await mix.start();
    const noteId = this.noteId as string;
    const recorder = new MediaRecorder(mix.stream, { mimeType, audioBitsPerSecond: AUDIO_BITS_PER_SECOND });
    this.seq = 0;
    this.segment = segment;
    recorder.ondataavailable = (event) => {
      if (!event.data.size) return;
      const seq = this.seq;
      this.seq += 1;
      // One at a time and in order, because the chunks only make sense as one continuous file.
      this.uploads = this.uploads.then(() => this.send(noteId, segment, seq, event.data));
    };
    recorder.start(CHUNK_MS);
    this.recorder = recorder;
    this.mix = mix;
    this.mixTimer = window.setInterval(() => mix.sync(), 2000);
    this.recorderStartedAt = Date.now();
    this.room.on(RoomEvent.ActiveSpeakersChanged, this.onSpeakers);
    this.onSpeakers(this.room.activeSpeakers);
  }

  private async stopRecorder() {
    const recorder = this.recorder;
    if (!recorder) return;
    this.recorder = null;
    this.room.off(RoomEvent.ActiveSpeakersChanged, this.onSpeakers);
    if (this.mixTimer !== null) window.clearInterval(this.mixTimer);
    await new Promise<void>((resolve) => {
      if (recorder.state === 'inactive') resolve();
      else {
        recorder.onstop = () => resolve();
        recorder.stop();
      }
    });
    this.closeSpeaking();
    this.mix?.close();
    this.mix = null;
    await this.uploads;
  }

  private async send(noteId: string, segment: number, seq: number, chunk: Blob) {
    for (let attempt = 1; attempt <= CHUNK_ATTEMPTS; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await meetingsService.uploadNoteChunk(this.meetingId, noteId, segment, seq, chunk);
        return;
      } catch (err) {
        // The notes have finished or it's been refused, so trying again can't help.
        if (axios.isAxiosError(err) && err.response && err.response.status < 500) return;
        // eslint-disable-next-line no-await-in-loop
        if (attempt < CHUNK_ATTEMPTS) await wait(RETRY_DELAY_MS * attempt);
      }
    }
  }

  private readonly onSpeakers = (speakers: Participant[]) => {
    const now = Date.now() - this.recorderStartedAt;
    const names = new Set(speakers.map((p) => plainName(p.name || p.identity).slice(0, 80)));
    this.speaking.forEach((startMs, name) => {
      if (!names.has(name)) {
        this.addSpan(name, startMs, now);
        this.speaking.delete(name);
      }
    });
    names.forEach((name) => {
      if (!this.speaking.has(name)) this.speaking.set(name, now);
    });
  };

  private addSpan(name: string, startMs: number, endMs: number) {
    if (this.segment !== null && endMs > startMs) {
      this.spans.push({ segment: this.segment, name, startMs: Math.round(startMs), endMs: Math.round(endMs) });
    }
  }

  private closeSpeaking() {
    const now = Date.now() - this.recorderStartedAt;
    this.speaking.forEach((startMs, name) => this.addSpan(name, startMs, now));
    this.speaking.clear();
  }

  /** Long speeches are split, so a tab that dies only loses the last few seconds of who was talking. */
  private takeSpans(): SpeakerSpan[] {
    if (this.recorder) {
      const now = Date.now() - this.recorderStartedAt;
      this.speaking.forEach((startMs, name) => {
        this.addSpan(name, startMs, now);
        this.speaking.set(name, now);
      });
    }
    return this.spans.splice(0, 500);
  }

  private async sendLastSpans() {
    if (this.segment === null || !this.spans.length) return;
    await meetingsService
      .listenForNotes(this.meetingId, { segment: this.segment, speakers: this.spans.splice(0, 500) })
      .catch(() => undefined);
  }
}
