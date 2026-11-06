/** One call's notes (/meetings/notes/:noteId): the summary, action items and transcript. This is where the email links to. */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { hubErrorMessage } from '../../services/hub.service';
import { MeetingNoteDetail, meetingsService, NoteItem } from '../../services/meetings.service';
import { projectService } from '../../services/project.service';
import FormsTopbar from '../forms/FormsTopbar';
import ConfirmDialog from '../hub/ui/ConfirmDialog';
import EmptyState from '../hub/ui/EmptyState';
import Icon from '../hub/ui/Icon';
import { Modal } from '../hub/ui/Modal';
import OverflowMenu from '../hub/ui/OverflowMenu';
import { Skeleton } from '../hub/ui/Skeleton';
import { useToast } from '../hub/ui/Toast';
import { callDuration, meetingTime, transcriptClock, summaryAsText } from './meetingUtils';
import { NoteStatusBadge } from './NotesList';
import PeoplePicker from './PeoplePicker';
import './meetings.css';

const POLL_MS = 10_000;

const ProjectPickerModal: React.FC<{ onPick: (projectId: string) => Promise<void>; onClose: () => void }> = ({ onPick, onClose }) => {
  const [projects, setProjects] = useState<{ id: string; clientName: string }[] | null>(null);
  const [projectId, setProjectId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    projectService.getAll().then(setProjects).catch(() => setProjects([]));
  }, []);

  return (
    <Modal
      title="Which project is this task for?"
      description="This meeting isn't linked to a project."
      size="sm"
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="hub-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="hub-btn hub-btn-primary"
            disabled={!projectId || busy}
            onClick={async () => {
              setBusy(true);
              await onPick(projectId);
              setBusy(false);
            }}
          >
            {busy ? 'Making task…' : 'Make task'}
          </button>
        </>
      }
    >
      <select className="hub-inp" aria-label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
        <option value="">{projects ? 'Choose a project' : 'Loading projects…'}</option>
        {(projects || []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.clientName}
          </option>
        ))}
      </select>
    </Modal>
  );
};

const ShareModal: React.FC<{ note: MeetingNoteDetail; onClose: () => void; onShared: () => void }> = ({ note, onClose, onShared }) => {
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Share these notes"
      description="They'll get the summary by email and can open the notes here. They won't get the recording unless they were on the meeting."
      size="md"
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="hub-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="hub-btn hub-btn-primary"
            disabled={!selected.length || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await meetingsService.shareNote(note.id, selected);
                toast.show('Notes shared');
                onShared();
              } catch (err) {
                toast.error(hubErrorMessage(err, "Couldn't share these notes."));
                setBusy(false);
              }
            }}
          >
            {busy ? 'Sharing…' : 'Share'}
          </button>
        </>
      }
    >
      <PeoplePicker selected={selected} onChange={setSelected} excludeIds={note.recipients.map((u) => u.id)} />
    </Modal>
  );
};

const ActionItems: React.FC<{ note: MeetingNoteDetail; onChange: (item: NoteItem) => void }> = ({ note, onChange }) => {
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const [picking, setPicking] = useState<NoteItem | null>(null);

  const make = async (item: NoteItem, projectId?: string) => {
    setPending(item.id);
    try {
      onChange(await meetingsService.makeNoteItemTask(note.id, item.id, projectId));
      toast.show('Task made and assigned to you');
      setPicking(null);
    } catch (err) {
      toast.error(hubErrorMessage(err, "Couldn't make that task."));
    }
    setPending(null);
  };

  return (
    <section aria-label="Action items">
      <h2>Action items</h2>
      {!note.items.length ? (
        <p className="hub-s">Nobody committed to anything specific on this call.</p>
      ) : (
        <div className="mt-note-items">
          {note.items.map((item) => (
            <div className="mt-note-item" key={item.id} data-done={item.done}>
              <input
                type="checkbox"
                aria-label={`Mark done: ${item.text}`}
                checked={item.done}
                onChange={async (e) => {
                  const done = e.target.checked;
                  onChange({ ...item, done });
                  try {
                    onChange(await meetingsService.setNoteItemDone(note.id, item.id, done));
                  } catch (err) {
                    onChange(item);
                    toast.error(hubErrorMessage(err, "Couldn't save that."));
                  }
                }}
              />
              <div className="mt-note-item-text">
                <span>{item.text}</span>
                {item.ownerName && <small className="mt-note-owner">{item.ownerName}</small>}
              </div>
              {item.taskId ? (
                <span className="hub-s">Task made</span>
              ) : (
                <button
                  type="button"
                  className="hub-btn hub-btn-sm"
                  disabled={pending === item.id}
                  onClick={() => (note.project ? make(item) : setPicking(item))}
                >
                  <Icon name="plus" />
                  Make task
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {picking && <ProjectPickerModal onPick={(projectId) => make(picking, projectId)} onClose={() => setPicking(null)} />}
    </section>
  );
};

const MeetingNotePage: React.FC = () => {
  const { noteId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [note, setNote] = useState<MeetingNoteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'summary' | 'transcript'>('summary');
  const [sharing, setSharing] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    try {
      setNote(await meetingsService.note(noteId));
      setError(null);
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't load these notes."));
    }
  }, [noteId]);

  useEffect(() => {
    load();
  }, [load]);

  const working = note?.status === 'capturing' || note?.status === 'processing';
  useEffect(() => {
    if (!working) return undefined;
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [working, load]);

  const copySummary = async () => {
    if (!note) return;
    try {
      await navigator.clipboard.writeText(summaryAsText(note));
      toast.show('Summary copied');
    } catch {
      toast.error("Couldn't copy it. Check your browser's permissions.");
    }
  };

  const retry = async () => {
    try {
      await meetingsService.retryNote(noteId);
      load();
    } catch (err) {
      toast.error(hubErrorMessage(err, "Couldn't try again."));
    }
  };

  return (
    <>
      <FormsTopbar crumbs={[{ label: 'Meetings', to: '/meetings' }, { label: 'Notes', to: '/meetings?tab=notes' }, { label: note?.title || 'Notes' }]} />
      <div className="hub-page mt-page mt-note-page">
        {error && !note ? (
          <EmptyState icon="alert" title="Couldn't open these notes" text={error} actionLabel="Try again" actionIcon="refresh" onAction={load} />
        ) : !note ? (
          <div aria-busy="true" aria-label="Loading" className="mt-sk">
            <Skeleton width="50%" height={24} />
            <Skeleton width="30%" />
            <Skeleton width="100%" height={200} />
          </div>
        ) : (
          <>
            <div className="hub-ph">
              <div className="hub-ph-text">
                <h1>{note.title}</h1>
                <p>
                  {meetingTime(note.startedAt, 0).split(' to ')[0]}
                  {note.durationSeconds ? ` · ${callDuration(note.durationSeconds * 1000)}` : ''}
                  {note.project ? ` · ${note.project.name}` : ''}
                </p>
              </div>
              <div className="hub-ph-actions">
                <NoteStatusBadge status={note.status} />
                {note.hasRecording && (
                  <Link to="/meetings?tab=recordings" className="hub-btn">
                    <Icon name="video" />
                    Recording
                  </Link>
                )}
                {note.status === 'ready' && (
                  <button type="button" className="hub-btn" onClick={() => setSharing(true)}>
                    <Icon name="share" />
                    Share
                  </button>
                )}
                <OverflowMenu
                  label="More actions for these notes"
                  items={[
                    ...(note.status === 'ready' ? [{ label: 'Copy summary', icon: 'copy' as const, onSelect: copySummary }] : []),
                    { label: 'Delete my copy', icon: 'trash' as const, danger: true, onSelect: () => setRemoving(true) },
                  ]}
                />
              </div>
            </div>

            {note.status === 'ready' ? (
              <>
                <div className="hub-seg mt-note-tabs" role="group" aria-label="Show">
                  <button type="button" aria-pressed={tab === 'summary'} onClick={() => setTab('summary')}>
                    Summary
                  </button>
                  <button type="button" aria-pressed={tab === 'transcript'} onClick={() => setTab('transcript')}>
                    Transcript
                  </button>
                </div>
                <div className="hub-card">
                  {tab === 'summary' ? (
                    <div className="mt-note-body">
                      <section aria-label="Overview">
                        <h2>Overview</h2>
                        <p>{note.overview}</p>
                      </section>
                      <ActionItems
                        note={note}
                        onChange={(item) => setNote((n) => (n ? { ...n, items: n.items.map((i) => (i.id === item.id ? item : i)) } : n))}
                      />
                      {!!note.topics.length && (
                        <section aria-label="Topics">
                          <h2>Topics</h2>
                          {note.topics.map((topic, i) => (
                            // eslint-disable-next-line react/no-array-index-key
                            <div className="mt-note-topic" key={i}>
                              <h3>{topic.title}</h3>
                              <ul>
                                {topic.points.map((point, j) => (
                                  // eslint-disable-next-line react/no-array-index-key
                                  <li key={j}>{point}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </section>
                      )}
                    </div>
                  ) : (
                    <div className="mt-note-body">
                      <div>
                        {note.transcript.map((line, i) => (
                          // eslint-disable-next-line react/no-array-index-key
                          <div className="mt-note-line" key={i}>
                            <time>{transcriptClock(line.start)}</time>
                            <div>
                              <b>{line.speaker}</b>
                              <p>{line.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="hub-card">
                {note.status === 'capturing' && <EmptyState icon="file" title="Taking notes" text="This call is still going. You'll get an email when the notes are ready." />}
                {note.status === 'processing' && <EmptyState icon="file" title="Writing your notes" text="This usually takes a few minutes. You'll get an email when they're ready." />}
                {note.status === 'empty' && <EmptyState icon="file" title="No speech was captured" text="The call had nothing to transcribe, so there are no notes." />}
                {note.status === 'failed' && (
                  <EmptyState icon="alert" title="These notes didn't finish" text="Something went wrong writing them. The audio is kept for 7 days." actionLabel="Try again" actionIcon="refresh" onAction={retry} />
                )}
              </div>
            )}
          </>
        )}
      </div>
      {note && sharing && (
        <ShareModal
          note={note}
          onClose={() => setSharing(false)}
          onShared={() => {
            setSharing(false);
            load();
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Delete your copy of these notes?"
          body="Anyone else who has them keeps theirs. Once nobody has them, they're gone for good."
          confirmLabel="Delete my copy"
          busyLabel="Deleting…"
          onConfirm={async () => {
            await meetingsService.removeNote(noteId);
            toast.show('Notes deleted');
            navigate('/meetings?tab=notes');
          }}
          onClose={() => setRemoving(false)}
        />
      )}
    </>
  );
};

export default MeetingNotePage;
