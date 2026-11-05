/** Meetings (/meetings): start a call now, schedule one, and see upcoming and past meetings. */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { hubErrorMessage } from '../../services/hub.service';
import { Meeting, meetingsService, MeetingView } from '../../services/meetings.service';
import { authService } from '../../services/auth.service';
import FormsTopbar from '../forms/FormsTopbar';
import { Badge } from '../hub/ui/Badge';
import ConfirmDialog from '../hub/ui/ConfirmDialog';
import EmptyState from '../hub/ui/EmptyState';
import Icon from '../hub/ui/Icon';
import OverflowMenu from '../hub/ui/OverflowMenu';
import { Skeleton } from '../hub/ui/Skeleton';
import { useToast } from '../hub/ui/Toast';
import { attendanceLabel, guestLink, isJoinableSoon, meetingTime } from './meetingUtils';
import ScheduleMeetingModal from './ScheduleMeetingModal';
import './meetings.css';

const VIEWS: { key: MeetingView; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
];

const StatusBadge: React.FC<{ meeting: Meeting }> = ({ meeting }) => {
  if (meeting.status === 'live') return <Badge tone="ok">Live now</Badge>;
  if (meeting.status === 'cancelled') return <Badge plain>Cancelled</Badge>;
  return null;
};

const MeetingsHome: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [view, setView] = useState<MeetingView>('upcoming');
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [videoReady, setVideoReady] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [editing, setEditing] = useState<Meeting | 'new' | null>(null);
  const [cancelling, setCancelling] = useState<Meeting | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await meetingsService.list(view);
      setMeetings(result.meetings);
      setVideoReady(result.videoReady);
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't load your meetings."));
    }
  }, [view]);

  useEffect(() => {
    setMeetings(null);
    load();
  }, [load]);

  const startNow = async () => {
    setStarting(true);
    try {
      const firstName = (authService.getUser()?.name || '').trim().split(/\s+/)[0];
      const meeting = await meetingsService.create({ title: firstName ? `Call with ${firstName}` : 'Quick call' });
      navigate(`/meetings/${meeting.id}`);
    } catch (err) {
      toast.error(hubErrorMessage(err, "Couldn't start the call."));
      setStarting(false);
    }
  };

  const copyLink = async (meeting: Meeting) => {
    if (!meeting.guestCode) return;
    try {
      await navigator.clipboard.writeText(guestLink(meeting.guestCode));
      toast.show('Guest link copied');
    } catch {
      toast.error("Couldn't copy the link. Check your browser's permissions.");
    }
  };

  return (
    <>
      <FormsTopbar crumbs={[{ label: 'Meetings' }]} />
      <div className="hub-page mt-page">
        <div className="hub-ph">
          <div className="hub-ph-text">
            <h1>Meetings</h1>
            <p>Video calls with your team and clients, right here. No Zoom link needed.</p>
          </div>
          <div className="hub-ph-actions">
            <button type="button" className="hub-btn" onClick={() => setEditing('new')}>
              <Icon name="plus" />
              Schedule
            </button>
            <button type="button" className="hub-btn hub-btn-primary" onClick={startNow} disabled={starting}>
              {starting ? <span className="hub-spin" /> : <Icon name="video" />}
              Start a call now
            </button>
          </div>
        </div>

        {!videoReady && (
          <div className="mt-notice" role="status">
            <Icon name="info" />
            <span>Video calls aren't switched on yet. You can schedule meetings now, and joining will work once the LiveKit keys are added.</span>
          </div>
        )}

        <section className="hub-sec" aria-label="Your meetings">
          <div className="hub-sec-h">
            <div className="hub-seg" role="group" aria-label="Show">
              {VIEWS.map((v) => (
                <button key={v.key} type="button" aria-pressed={view === v.key} onClick={() => setView(v.key)}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <div className="hub-card">
            {error ? (
              <EmptyState icon="alert" title="Couldn't load your meetings" text={error} actionLabel="Try again" actionIcon="refresh" onAction={load} />
            ) : !meetings ? (
              <div aria-busy="true" aria-label="Loading">
                {[0, 1, 2].map((i) => (
                  <div className="hub-list-row" key={i}>
                    <div className="hub-grow mt-sk">
                      <Skeleton width={`${30 + i * 10}%`} />
                      <Skeleton width="45%" height={10} />
                    </div>
                    <Skeleton width={70} height={30} />
                  </div>
                ))}
              </div>
            ) : !meetings.length ? (
              view === 'upcoming' ? (
                <EmptyState
                  icon="video"
                  title="No meetings coming up"
                  text="Start a call now or schedule one. Clients can join from a link without an account."
                  actionLabel="Schedule a meeting"
                  onAction={() => setEditing('new')}
                />
              ) : (
                <EmptyState icon="video" title="No past meetings yet" text="Meetings you've finished will show up here." />
              )
            ) : (
              meetings.map((m) => {
                const joinable = view === 'upcoming' && isJoinableSoon(m);
                return (
                  <div className="hub-list-row mt-row" key={m.id}>
                    <div className="hub-grow">
                      <div className="mt-row-title">
                        <span className="hub-t">
                          {view === 'upcoming' ? <Link to={`/meetings/${m.id}`}>{m.title}</Link> : m.title}
                        </span>
                        <StatusBadge meeting={m} />
                      </div>
                      <div className="hub-s">
                        {meetingTime(m.startsAt, m.durationMinutes)}
                        {m.project ? ` · ${m.project.name}` : ''}
                        {view === 'past' ? ` · ${attendanceLabel(m)}` : m.isHost ? '' : ` · Host: ${m.host?.name ?? 'Unknown'}`}
                      </div>
                    </div>
                    {view === 'upcoming' && (
                      <div className="mt-row-actions">
                        {m.isHost && m.guestCode && m.guestLinkEnabled && (
                          <button type="button" className="hub-btn hub-btn-sm hub-btn-ghost" onClick={() => copyLink(m)}>
                            <Icon name="link" />
                            Copy guest link
                          </button>
                        )}
                        <Link to={`/meetings/${m.id}`} className={`hub-btn hub-btn-sm${joinable ? ' hub-btn-primary' : ''}`}>
                          {joinable ? 'Join' : 'Open'}
                        </Link>
                        {m.isHost && (
                          <OverflowMenu
                            label={`More actions for ${m.title}`}
                            items={[
                              { label: 'Edit', icon: 'edit', onSelect: () => setEditing(m) },
                              { label: 'Cancel meeting', icon: 'x', danger: true, onSelect: () => setCancelling(m) },
                            ]}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {editing && (
        <ScheduleMeetingModal
          meeting={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setView('upcoming');
            load();
          }}
        />
      )}
      {cancelling && (
        <ConfirmDialog
          title="Cancel this meeting?"
          body={<>"{cancelling.title}" will close and its links will stop working. This can't be undone.</>}
          confirmLabel="Cancel meeting"
          busyLabel="Cancelling…"
          onConfirm={async () => {
            await meetingsService.cancel(cancelling.id);
            toast.show('Meeting cancelled');
            setCancelling(null);
            load();
          }}
          onClose={() => setCancelling(null)}
        />
      )}
    </>
  );
};

export default MeetingsHome;
