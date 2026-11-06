/** The Notes tab: the Auto notes switch, and notes from calls you had them on for or that were shared with you. */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { hubErrorMessage } from '../../services/hub.service';
import { MeetingNoteRow, meetingsService, NotePreferences } from '../../services/meetings.service';
import { Badge } from '../hub/ui/Badge';
import EmptyState from '../hub/ui/EmptyState';
import { Skeleton } from '../hub/ui/Skeleton';
import { useToast } from '../hub/ui/Toast';
import { callDuration, meetingTime } from './meetingUtils';
import './meetings.css';

const POLL_MS = 15_000;

export const NoteStatusBadge: React.FC<{ status: MeetingNoteRow['status'] }> = ({ status }) => {
  if (status === 'capturing') return <Badge tone="ok">Taking notes</Badge>;
  if (status === 'processing') return <Badge plain>Writing notes</Badge>;
  if (status === 'empty') return <Badge plain>No speech</Badge>;
  if (status === 'failed') return <Badge tone="crit">Didn't finish</Badge>;
  return null;
};

const AutoNotesSwitch: React.FC = () => {
  const toast = useToast();
  const [prefs, setPrefs] = useState<NotePreferences | null>(null);

  useEffect(() => {
    meetingsService.notePreferences().then(setPrefs).catch(() => setPrefs({ autoNotes: false, available: false }));
  }, []);

  if (!prefs) return null;
  const toggle = async (autoNotes: boolean) => {
    setPrefs({ ...prefs, autoNotes });
    try {
      setPrefs(await meetingsService.setNotePreferences(autoNotes));
      toast.show(autoNotes ? 'Auto notes on' : 'Auto notes off');
    } catch (err) {
      setPrefs(prefs);
      toast.error(hubErrorMessage(err, "Couldn't save that."));
    }
  };
  return (
    <label className="mt-notes-switch" data-off={!prefs.available}>
      <input type="checkbox" role="switch" checked={prefs.autoNotes} disabled={!prefs.available} onChange={(e) => toggle(e.target.checked)} />
      <div>
        <b>Auto notes</b>
        <span>
          {prefs.available
            ? "Takes notes on every call you join here. Everyone on the call sees a notice, and you get the summary and action items by email afterwards. Calls on Zoom or Meet aren't covered."
            : "Not switched on yet. Notes will work once the transcription key is added to the server."}
        </span>
      </div>
    </label>
  );
};

const NotesList: React.FC = () => {
  const [notes, setNotes] = useState<MeetingNoteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setNotes(await meetingsService.notes());
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't load your notes."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const working = !!notes?.some((n) => n.status === 'capturing' || n.status === 'processing');
  useEffect(() => {
    if (!working) return undefined;
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [working, load]);

  return (
    <>
      <AutoNotesSwitch />
      {error ? (
        <EmptyState icon="alert" title="Couldn't load your notes" text={error} actionLabel="Try again" actionIcon="refresh" onAction={load} />
      ) : !notes ? (
        <div aria-busy="true" aria-label="Loading">
          {[0, 1, 2].map((i) => (
            <div className="hub-list-row" key={i}>
              <div className="hub-grow mt-sk">
                <Skeleton width={`${30 + i * 10}%`} />
                <Skeleton width="60%" height={10} />
              </div>
            </div>
          ))}
        </div>
      ) : !notes.length ? (
        <EmptyState icon="file" title="No notes yet" text="Turn on Auto notes, or press the notes button during a call. Your summary and action items will show up here." />
      ) : (
        notes.map((n) => (
          <div className="hub-list-row mt-row" key={n.id}>
            <div className="hub-grow">
              <div className="mt-row-title">
                <span className="hub-t">
                  <Link to={`/meetings/notes/${n.id}`}>{n.title}</Link>
                </span>
                <NoteStatusBadge status={n.status} />
              </div>
              <div className="hub-s">
                {meetingTime(n.startedAt, 0).split(' to ')[0]}
                {n.durationSeconds ? ` · ${callDuration(n.durationSeconds * 1000)}` : ''}
              </div>
              {n.overview && <div className="mt-note-preview">{n.overview}</div>}
            </div>
          </div>
        ))
      )}
    </>
  );
};

export default NotesList;
