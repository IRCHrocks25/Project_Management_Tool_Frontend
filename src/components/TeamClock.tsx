import React, { useEffect, useRef, useState } from 'react';
import { FaChevronDown, FaRegClock } from 'react-icons/fa';
import './TeamClock.css';

const TEAM_TIME_ZONE = 'Europe/Zurich';

const timeIn = (date: Date, timeZone: string) =>
  date.toLocaleString('en-US', { timeZone, weekday: 'short', hour: 'numeric', minute: '2-digit' });

/** "CET" in winter and "CEST" in summer. */
const teamZoneLabel = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TEAM_TIME_ZONE, timeZoneName: 'short' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value || 'CET';

// "Europe/Kiev" is used on purpose: older browsers reject "Europe/Kyiv" and would crash the page.
const TEAM_LOCATIONS = [
  { label: 'Manila', timeZone: 'Asia/Manila' },
  { label: 'Istanbul', timeZone: 'Europe/Istanbul' },
  { label: 'Kyiv', timeZone: 'Europe/Kiev' },
];

const cityName = (timeZone: string) =>
  timeZone.split('/').pop()!.replace(/_/g, ' ').replace(/^Kiev$/, 'Kyiv');

/** Always shows the team's working time plus the viewer's own. Click it for everyone else's. */
const TeamClock: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const teamTime = timeIn(now, TEAM_TIME_ZONE);
  const localTime = timeIn(now, localZone);
  const zone = teamZoneLabel(now);

  return (
    <div className="team-clock" ref={rootRef}>
      <button
        type="button"
        className="team-clock-toggle"
        aria-expanded={open}
        aria-controls="team-clock-list"
        title="Show times for the whole team"
        onClick={() => setOpen((current) => !current)}
      >
        <FaRegClock aria-hidden="true" />
        <span className="team-clock-times">
          <span className="team-clock-team"><b>{teamTime}</b> {zone}</span>
          {localTime !== teamTime && <span className="team-clock-local">{cityName(localZone)} {localTime}</span>}
        </span>
        <FaChevronDown className={`team-clock-chevron${open ? ' open' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="team-clock-list" id="team-clock-list">
          {TEAM_LOCATIONS.map(({ label, timeZone }) => (
            <div key={label} className="team-clock-row"><span>{label}</span><span>{timeIn(now, timeZone)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamClock;
