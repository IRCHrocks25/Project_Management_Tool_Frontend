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
