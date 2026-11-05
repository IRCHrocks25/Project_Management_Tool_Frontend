import { attendanceLabel, avatarHue, callDuration, guestLink, initials, isJoinableSoon, meetingTime, nextStart, plainName, toLocalInput } from './meetingUtils';

describe('meetingUtils', () => {
  it('cleans up names for the people list and avatars', () => {
    expect(plainName('Sam Client (guest)')).toBe('Sam Client');
    expect(initials('Sam Client (guest)')).toBe('SC');
    expect(initials('Julia Marie Victorio')).toBe('JV');
    expect(initials('Cher')).toBe('C');
    expect(initials('')).toBe('?');
  });

  it('gives a person the same colour with or without the guest label', () => {
    expect(avatarHue('Sam Client (guest)')).toBe(avatarHue('Sam Client'));
  });

  it('formats how long a call has run', () => {
    expect(callDuration(247000)).toBe('4:07');
    expect(callDuration(3847000)).toBe('1:04:07');
    expect(callDuration(-5)).toBe('0:00');
  });

  it('builds the guest link', () => {
    expect(guestLink('abc', 'https://telos.katek-ai.com')).toBe('https://telos.katek-ai.com/m/abc');
  });

  it('shows the start and end time', () => {
    expect(meetingTime(new Date(2026, 10, 5, 14, 30).toISOString(), 30)).toBe('Thu 5 Nov, 14:30 to 15:00');
  });

  it('formats a date for a datetime-local input', () => {
    expect(toLocalInput(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05T09:07');
  });

  it('suggests the next quarter of an hour at least 15 minutes away', () => {
    expect(toLocalInput(nextStart(new Date(2026, 0, 5, 9, 7)))).toBe('2026-01-05T09:30');
    expect(toLocalInput(nextStart(new Date(2026, 0, 5, 9, 50)))).toBe('2026-01-05T10:15');
  });

  it('offers Join for live meetings and ones starting soon', () => {
    const now = new Date(2026, 0, 5, 9, 0);
    const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();
    expect(isJoinableSoon({ status: 'live', startsAt: at(120) }, now)).toBe(true);
    expect(isJoinableSoon({ status: 'scheduled', startsAt: at(10) }, now)).toBe(true);
    expect(isJoinableSoon({ status: 'scheduled', startsAt: at(60) }, now)).toBe(false);
    expect(isJoinableSoon({ status: 'ended', startsAt: at(0) }, now)).toBe(false);
  });

  it('describes attendance', () => {
    const user = { id: '1', name: 'A' } as any;
    expect(attendanceLabel({ invitees: [] })).toBe('No one else invited');
    expect(attendanceLabel({ invitees: [{ user, joinedAt: 'x' }, { user, joinedAt: null }] })).toBe('1 of 2 invited joined');
  });
});
