import { Meeting } from '../../services/meetings.service';

export const guestLink = (code: string, origin = window.location.origin) => `${origin}/m/${code}`;

/** "Thu 5 Nov, 14:30 to 15:00" in the viewer's own time zone. */
export function meetingTime(startsAt: string, durationMinutes: number, locale = 'en-GB'): string {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const day = start.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const clock = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${clock(start)} to ${clock(end)}`;
}

/** Value for <input type="datetime-local"> in the viewer's own time zone. */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The next quarter of an hour that is at least 15 minutes away. */
export function nextStart(now = new Date()): Date {
  const d = new Date(now.getTime() + 15 * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}

/** Live now, or starting within 15 minutes: the row's main button becomes Join. */
export function isJoinableSoon(m: Pick<Meeting, 'status' | 'startsAt'>, now = new Date()): boolean {
  if (m.status === 'live') return true;
  return m.status === 'scheduled' && new Date(m.startsAt).getTime() - now.getTime() <= 15 * 60_000;
}

export function attendanceLabel(m: Pick<Meeting, 'invitees'>): string {
  const total = m.invitees.length;
  if (!total) return 'No one else invited';
  const joined = m.invitees.filter((i) => i.joinedAt).length;
  return `${joined} of ${total} invited joined`;
}

/** A guest's call name carries " (guest)" so tiles show it; lists use a badge instead. */
export const plainName = (name: string): string => name.replace(/ \(guest\)$/, '').trim();

/** Up to two initials for a camera-off avatar. */
export const initials = (name: string): string => {
  const words = plainName(name).split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0]];
  return picked.map((w) => Array.from(w)[0]).join('').toUpperCase();
};

/** Teal, green, amber, orange, rose: the product avoids blues and purples. */
const AVATAR_HUES = [172, 145, 38, 20, 345];

/** A steady colour per person, so someone keeps the same avatar through a call. */
export const avatarHue = (name: string): number => {
  let hash = 0;
  for (const ch of plainName(name)) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
  return AVATAR_HUES[hash % AVATAR_HUES.length];
};

/** Call length as 4:07, or 1:04:07 past an hour. */
export const callDuration = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
};

/** A recording's size in the units people expect. */
export const fileSize = (bytes: number): string => {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
};

/** A transcript line's time from the start of the notes, like 4:05 or 1:02:05. */
export const transcriptClock = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  return hours ? `${hours}:${pad(minutes)}:${pad(total % 60)}` : `${minutes}:${pad(total % 60)}`;
};

/** The notes as plain text, for pasting somewhere else. */
export const summaryAsText = (note: {
  title: string;
  overview: string | null;
  items: { text: string; ownerName: string | null }[];
  topics: { title: string; points: string[] }[];
}): string =>
  [
    note.title,
    note.overview || '',
    note.items.length ? `Action items\n${note.items.map((i) => `- ${i.text}${i.ownerName ? ` (${i.ownerName})` : ''}`).join('\n')}` : '',
    ...note.topics.map((t) => `${t.title}\n${t.points.map((p) => `- ${p}`).join('\n')}`),
  ]
    .filter(Boolean)
    .join('\n\n');
