/** Shows how saving a recording is going. It floats, so it stays visible on any screen while the file uploads. */
import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../hub/ui/Icon';
import { recordingStore, useRecordingState } from './recordingStore';
import './meetings.css';

const RecordingStatus: React.FC = () => {
  const { phase, progress, error, downloadUrl } = useRecordingState();
  if (phase !== 'saving' && phase !== 'saved' && phase !== 'failed') return null;
  const percent = Math.round(progress * 100);
  return (
    <div className="mt-rec-status" role={phase === 'failed' ? 'alert' : 'status'}>
      {phase === 'saving' && (
        <>
          <b>Saving recording… {percent}%</b>
          <span>Keep this page open until it finishes.</span>
          <div className="mt-rec-bar" aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </div>
        </>
      )}
      {phase === 'saved' && (
        <>
          <b>Recording saved</b>
          <span>Only the host and invited teammates can watch it.</span>
          <div className="mt-rec-actions">
            <Link to="/meetings?tab=recordings" className="hub-btn hub-btn-sm" onClick={() => recordingStore.dismiss()}>
              View recordings
            </Link>
            <button type="button" className="hub-btn hub-btn-sm hub-btn-ghost" onClick={() => recordingStore.dismiss()}>
              Close
            </button>
          </div>
        </>
      )}
      {phase === 'failed' && (
        <>
          <b>The recording didn't save</b>
          <span>{error} Download your copy before leaving this page.</span>
          <div className="mt-rec-actions">
            <button type="button" className="hub-btn hub-btn-sm" onClick={() => recordingStore.retry()}>
              <Icon name="refresh" />
              Try again
            </button>
            {downloadUrl && (
              <a className="hub-btn hub-btn-sm" href={downloadUrl} download="meeting-recording">
                Download
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default RecordingStatus;
