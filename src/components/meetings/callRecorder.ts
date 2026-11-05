/**
 * Records a call in the host's browser: draws what's on the call stage onto a canvas 15 times a second,
 * mixes everyone's audio, and encodes both to a small WebM file as it goes.
 */
import fixWebmDuration from 'fix-webm-duration';
import { Room, Track } from 'livekit-client';

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 15;
const VIDEO_BITS_PER_SECOND = 900_000;
const AUDIO_BITS_PER_SECOND = 64_000;
/** Smallest first. Safari can't record WebM, so it falls back to MP4. */
const FORMATS = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];

export interface FinishedRecording {
  blob: Blob;
  contentType: string;
  durationSeconds: number;
}

const pickFormat = () => (typeof MediaRecorder === 'undefined' ? undefined : FORMATS.find((f) => MediaRecorder.isTypeSupported(f)));

export const canRecordCalls = (): boolean =>
  !!pickFormat() && typeof HTMLCanvasElement.prototype.captureStream === 'function' && typeof AudioContext !== 'undefined';

/** A worker's timer keeps running when the host switches tabs, which a page's own timers don't. */
const startTicker = (onTick: () => void): (() => void) => {
  try {
    const source = `setInterval(() => postMessage(0), ${Math.round(1000 / FPS)});`;
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const worker = new Worker(url);
    worker.onmessage = onTick;
    return () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    };
  } catch {
    const timer = window.setInterval(onTick, Math.round(1000 / FPS));
    return () => window.clearInterval(timer);
  }
};

export class CallRecorder {
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly audio = new AudioContext();
  private readonly mix = this.audio.createMediaStreamDestination();
  private readonly sources = new Map<string, MediaStreamAudioSourceNode>();
  private readonly chunks: Blob[] = [];
  private recorder: MediaRecorder | null = null;
  private stopTicker: (() => void) | null = null;
  private startedAt = 0;
  private ticks = 0;

  constructor(private readonly room: Room, private readonly stage: () => HTMLElement | null) {
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('This browser cannot record calls.');
    this.ctx = ctx;
  }

  async start(): Promise<void> {
    const mimeType = pickFormat();
    if (!mimeType) throw new Error('This browser cannot record calls.');
    await this.audio.resume();
    this.syncAudio();
    this.draw();
    const stream = new MediaStream([...this.canvas.captureStream(FPS).getVideoTracks(), ...this.mix.stream.getAudioTracks()]);
    this.recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });
    this.recorder.ondataavailable = (event) => {
      if (event.data.size) this.chunks.push(event.data);
    };
    this.recorder.start(5000);
    this.startedAt = Date.now();
    this.stopTicker = startTicker(() => {
      this.draw();
      this.ticks += 1;
      if (this.ticks % FPS === 0) this.syncAudio();
    });
  }

  stop(): Promise<FinishedRecording> {
    return new Promise((resolve, reject) => {
      const recorder = this.recorder;
      if (!recorder) {
        reject(new Error('Recording never started.'));
        return;
      }
      const finish = () => {
        this.stopTicker?.();
        this.sources.forEach((node) => node.disconnect());
        this.audio.close().catch(() => undefined);
        const contentType = (recorder.mimeType || 'video/webm').split(';')[0];
        const lengthMs = Math.max(1000, Date.now() - this.startedAt);
        const blob = new Blob(this.chunks, { type: contentType });
        const done = (file: Blob) => resolve({ blob: file, contentType, durationSeconds: Math.round(lengthMs / 1000) });
        // Browsers leave the length out of live WebM, and Iceberg rejects a video without one.
        if (contentType === 'video/webm' && blob.size) fixWebmDuration(blob, lengthMs, { logger: false }).then(done, reject);
        else done(blob);
      };
      if (recorder.state === 'inactive') finish();
      else {
        recorder.onstop = finish;
        recorder.stop();
      }
    });
  }

  /** Re-checked regularly, so it covers people joining, leaving and switching microphones without extra wiring. */
  private syncAudio() {
    const live = new Map<string, MediaStreamTrack>();
    const collect = (publications: Iterable<{ kind: Track.Kind; track?: { mediaStreamTrack: MediaStreamTrack } }>) => {
      for (const publication of Array.from(publications)) {
        const media = publication.kind === Track.Kind.Audio ? publication.track?.mediaStreamTrack : undefined;
        if (media && media.readyState === 'live') live.set(media.id, media);
      }
    };
    collect(this.room.localParticipant.trackPublications.values());
    this.room.remoteParticipants.forEach((p) => collect(p.trackPublications.values()));

    this.sources.forEach((node, id) => {
      if (!live.has(id)) {
        node.disconnect();
        this.sources.delete(id);
      }
    });
    live.forEach((media, id) => {
      if (this.sources.has(id)) return;
      const node = this.audio.createMediaStreamSource(new MediaStream([media]));
      node.connect(this.mix);
      this.sources.set(id, node);
    });
  }

  private draw() {
    const { ctx } = this;
    ctx.fillStyle = '#0c0c0f';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const stage = this.stage();
    if (!stage) return;
    const area = stage.getBoundingClientRect();
    if (!area.width || !area.height) return;
    const scale = Math.min(WIDTH / area.width, HEIGHT / area.height);
    const offsetX = (WIDTH - area.width * scale) / 2;
    const offsetY = (HEIGHT - area.height * scale) / 2;

    stage.querySelectorAll<HTMLElement>('.lk-participant-tile').forEach((tile) => {
      const rect = tile.getBoundingClientRect();
      if (rect.bottom <= area.top || rect.top >= area.bottom || rect.right <= area.left || rect.left >= area.right) return;
      this.drawTile(
        tile,
        offsetX + (rect.left - area.left) * scale,
        offsetY + (rect.top - area.top) * scale,
        rect.width * scale,
        rect.height * scale,
      );
    });
  }

  private drawTile(tile: HTMLElement, x: number, y: number, w: number, h: number) {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.clip();
    ctx.fillStyle = '#1a1a1f';
    ctx.fillRect(x, y, w, h);

    const video = tile.querySelector('video');
    const cameraOff = tile.getAttribute('data-lk-video-muted') === 'true';
    if (video && video.videoWidth && !cameraOff) {
      const contain = video.getAttribute('data-lk-source') === 'screen_share' || video.videoHeight > video.videoWidth;
      const ratio = (contain ? Math.min : Math.max)(w / video.videoWidth, h / video.videoHeight);
      const drawnW = video.videoWidth * ratio;
      const drawnH = video.videoHeight * ratio;
      if (contain) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(x, y, w, h);
      }
      ctx.drawImage(video, x + (w - drawnW) / 2, y + (h - drawnH) / 2, drawnW, drawnH);
    } else {
      this.drawAvatar(tile, x, y, w, h);
    }

    const name = (tile.querySelector('.lk-participant-metadata-item')?.textContent || '').trim();
    if (name) {
      ctx.font = '500 14px "DM Sans", system-ui, sans-serif';
      const labelW = ctx.measureText(name).width + 16;
      ctx.fillStyle = 'rgba(12,12,15,.7)';
      ctx.beginPath();
      ctx.roundRect(x + 8, y + h - 34, labelW, 26, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, x + 16, y + h - 21);
    }
    ctx.restore();
  }

  private drawAvatar(tile: HTMLElement, x: number, y: number, w: number, h: number) {
    const avatar = tile.querySelector<HTMLElement>('.mt-avatar');
    if (!avatar) return;
    const { ctx } = this;
    const radius = Math.min(w, h) * 0.16;
    const hue = avatar.style.getPropertyValue('--avatar-hue') || '172';
    ctx.fillStyle = `hsl(${hue} 70% 50%)`;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${Math.round(radius * 0.8)}px "DM Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(avatar.textContent || '', x + w / 2, y + h / 2);
  }
}
