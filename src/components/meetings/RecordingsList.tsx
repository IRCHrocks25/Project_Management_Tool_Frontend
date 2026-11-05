/** The Recordings tab: recordings of meetings you hosted or were invited to, played on the page. */
import React, { useCallback, useEffect, useState } from 'react';
import { hubErrorMessage } from '../../services/hub.service';
import { MeetingRecording, meetingsService } from '../../services/meetings.service';
import { Badge } from '../hub/ui/Badge';
import ConfirmDialog from '../hub/ui/ConfirmDialog';
import EmptyState from '../hub/ui/EmptyState';
import Icon from '../hub/ui/Icon';
import { Modal } from '../hub/ui/Modal';
import OverflowMenu from '../hub/ui/OverflowMenu';
import { Skeleton } from '../hub/ui/Skeleton';
import { useToast } from '../hub/ui/Toast';
import { callDuration, fileSize, meetingTime } from './meetingUtils';
import './meetings.css';

const Player: React.FC<{ recording: MeetingRecording; onClose: () => void }> = ({ recording, onClose }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    meetingsService
      .recordingPlayback(recording.id)
      .then((link) => live && setUrl(link.embedUrl))
      .catch((err) => live && setError(hubErrorMessage(err, "Couldn't open this recording.")));
    return () => {
      live = false;
    };
  }, [recording.id]);

  return (
    <Modal title={recording.title} description={meetingTime(recording.startedAt, 0).split(' to ')[0]} size="lg" onClose={onClose}>
      {error ? (
        <EmptyState icon="alert" title="Couldn't play this recording" text={error} />
      ) : url ? (
        <div className="mt-player">
          <iframe src={url} title={`Recording of ${recording.title}`} allow="autoplay; fullscreen" allowFullScreen />
        </div>
      ) : (
        <Skeleton width="100%" height={320} />
      )}
    </Modal>
  );
};

const RecordingsList: React.FC = () => {
  const toast = useToast();
  const [recordings, setRecordings] = useState<MeetingRecording[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<MeetingRecording | null>(null);
  const [deleting, setDeleting] = useState<MeetingRecording | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRecordings(await meetingsService.recordings());
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't load your recordings."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <EmptyState icon="alert" title="Couldn't load your recordings" text={error} actionLabel="Try again" actionIcon="refresh" onAction={load} />;
  if (!recordings) {
    return (
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
    );
  }
  if (!recordings.length) {
    return <EmptyState icon="video" title="No recordings yet" text="When a host records a call you were part of, it shows up here." />;
  }
  return (
    <>
      {recordings.map((r) => (
        <div className="hub-list-row mt-row" key={r.id}>
          <div className="hub-grow">
            <div className="mt-row-title">
              <span className="hub-t">{r.title}</span>
              {r.status === 'uploading' && <Badge plain>Still saving</Badge>}
              {r.status === 'failed' && <Badge tone="crit">Didn't save</Badge>}
            </div>
            <div className="hub-s">
              {meetingTime(r.startedAt, 0).split(' to ')[0]}
              {r.durationSeconds ? ` · ${callDuration(r.durationSeconds * 1000)}` : ''}
              {r.sizeBytes ? ` · ${fileSize(r.sizeBytes)}` : ''}
              {r.projectName ? ` · ${r.projectName}` : ''}
            </div>
          </div>
          <div className="mt-row-actions">
            {r.status === 'ready' && (
              <button type="button" className="hub-btn hub-btn-sm hub-btn-primary" onClick={() => setPlaying(r)}>
                <Icon name="video" />
                Watch
              </button>
            )}
            {r.canManage && (
              <OverflowMenu label={`More actions for ${r.title}`} items={[{ label: 'Delete recording', icon: 'trash', danger: true, onSelect: () => setDeleting(r) }]} />
            )}
          </div>
        </div>
      ))}
      {playing && <Player recording={playing} onClose={() => setPlaying(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete this recording?"
          body={<>The recording of "{deleting.title}" will be removed for everyone.</>}
          confirmLabel="Delete recording"
          busyLabel="Deleting…"
          onConfirm={async () => {
            await meetingsService.deleteRecording(deleting.meetingId, deleting.id);
            toast.show('Recording deleted');
            setDeleting(null);
            load();
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
};

export default RecordingsList;
