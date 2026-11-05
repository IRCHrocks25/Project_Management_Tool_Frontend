import React from 'react';
import { FaArrowRight, FaCalendarAlt, FaCheckCircle, FaExclamationCircle, FaFileAlt, FaPen, FaRegCommentDots, FaSpinner, FaLink, FaTrash } from 'react-icons/fa';

interface StatusChange {
  by: string;
  column: string;
  at: string;
  notes?: string;
  index: number;
}

interface TaskActivityHistoryProps {
  parsedStatusChanges: StatusChange[];
  attachments: any[];
  conversations: any[];
  activityLogs: any[];
  taskHistory: any[];
  loadingTaskHistory: boolean;
  taskTransfers: any[];
  loadingTaskTransfers: boolean;
  deliverableId?: string;
  renderTextWithLinks: (text: string) => React.ReactNode;
}

const formatTime = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

const toTimestamp = (value?: string) => {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(time) ? 0 : time;
};

const actionStyles = {
  icon: { fontSize: '10px', color: 'var(--td-text-tertiary)' },
  person: { color: 'var(--td-text-primary)' },
  verb: { color: 'var(--td-text-tertiary)' },
};

// Mentions are stored as "@Name[[USER_ID:id]]"; people should only see the name.
const withoutMentionIds = (text?: string) => (text || '').replace(/\[\[USER_ID:[^\]]+\]\]/g, '');

const conversationEntries = (conversations: any[]) =>
  conversations.flatMap((question) => [
    { id: `question-${question.id}`, by: question.user?.name, verb: 'asked a question', text: withoutMentionIds(question.text), at: question.createdAt },
    ...(question.comments || []).map((comment: any) => ({
      id: `comment-${comment.id}`,
      by: comment.user?.name,
      verb: 'replied',
      text: withoutMentionIds(comment.text),
      at: comment.createdAt,
    })),
  ]);

const blockStyle: React.CSSProperties = { whiteSpace: 'pre-wrap', wordBreak: 'break-word' };

const formatDay = (day?: string | null) =>
  day
    ? new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : 'no date';

const LOG_ICONS: Record<string, React.ReactNode> = {
  attachment_removed: <FaTrash style={actionStyles.icon} />,
  question_deleted: <FaTrash style={actionStyles.icon} />,
  due_date_changed: <FaCalendarAlt style={actionStyles.icon} />,
};

const logVerb = (log: any) => {
  const details = log.details || {};
  switch (log.action) {
    case 'attachment_removed': return `removed a ${details.kind === 'link' ? 'link' : 'file'}`;
    case 'question_deleted': return 'deleted a question';
    case 'due_date_changed': return `changed the due date from ${formatDay(details.before)} to ${formatDay(details.after)}`;
    case 'title_changed': return 'renamed the task';
    case 'task_created': return 'created the task';
    case 'start_date_changed': return `changed the start date from ${formatDay(details.before)} to ${formatDay(details.after)}`;
    case 'priority_changed': return `changed the priority from ${details.before || 'none'} to ${details.after || 'none'}`;
    case 'notes_changed': return 'edited the notes';
    case 'owners_changed': return `changed the owners to ${(details.after || []).join(', ') || 'no one'}`;
    case 'group_changed': return `moved the task from ${details.before || 'General'} to ${details.after || 'General'}`;
    case 'field_changed': return `changed ${details.field}`;
    default: return 'edited the description';
  }
};

const LogBody: React.FC<{ log: any }> = ({ log }) => {
  const details = log.details || {};
  switch (log.action) {
    case 'due_date_changed':
    case 'start_date_changed':
    case 'priority_changed':
    case 'owners_changed':
    case 'group_changed':
    case 'task_created':
      return null;
    case 'notes_changed':
    case 'field_changed':
      return (
        <div className="tdsm-history-notes" style={blockStyle}>
          {`From: ${details.before ?? '(empty)'}\nTo: ${details.after ?? '(empty)'}`}
        </div>
      );
    case 'attachment_removed':
      return (
        <div className="tdsm-history-notes" style={blockStyle}>
          {details.filename || details.url}
          {details.note ? `\nNote: ${details.note}` : ''}
          {details.addedBy ? `\nAdded by ${details.addedBy}${details.addedAt ? ` on ${formatTime(details.addedAt)}` : ''}` : ''}
        </div>
      );
    case 'question_deleted':
      return (
        <div className="tdsm-history-notes" style={blockStyle}>
          {`${details.by || 'Unknown'} asked: ${withoutMentionIds(details.text)}`}
          {(details.replies || []).map((reply: any) => `\n${reply.by || 'Unknown'} replied: ${withoutMentionIds(reply.text)}`).join('')}
        </div>
      );
    case 'title_changed':
      return (
        <div className="tdsm-history-notes" style={blockStyle}>
          {`From: ${details.before || '(empty)'}\nTo: ${details.after || '(empty)'}`}
        </div>
      );
    default:
      return (
        <details className="tdsm-history-notes">
          <summary style={{ cursor: 'pointer' }}>See what changed</summary>
          <div style={{ ...blockStyle, marginTop: '6px' }}><strong>Before:</strong> {details.before || '(empty)'}</div>
          <div style={{ ...blockStyle, marginTop: '6px' }}><strong>After:</strong> {details.after || '(empty)'}</div>
        </details>
      );
  }
};

const ActivityLogEntry: React.FC<{ log: any }> = ({ log }) => (
  <>
    <div className="tdsm-history-header">
      <div className="tdsm-history-action">
        {LOG_ICONS[log.action] || <FaPen style={actionStyles.icon} />}
        <span style={actionStyles.person}>{log.actorName || 'Unknown'}</span>
        <span style={actionStyles.verb}> {logVerb(log)}</span>
      </div>
      <span className="tdsm-history-time">{formatTime(log.createdAt)}</span>
    </div>
    <LogBody log={log} />
  </>
);

const TaskActivityHistory: React.FC<TaskActivityHistoryProps> = ({
  parsedStatusChanges,
  attachments,
  conversations,
  activityLogs,
  taskHistory,
  loadingTaskHistory,
  taskTransfers,
  loadingTaskTransfers,
  deliverableId,
  renderTextWithLinks,
}) => {
  // One timeline, newest first. Entries with a date that can't be read go last.
  const timeline = [
    ...parsedStatusChanges.map((sc) => ({
      key: `status-${sc.index}`,
      time: toTimestamp(sc.at),
      node: (
        <>
          <div className="tdsm-history-header">
            <div className="tdsm-history-action">
              <FaArrowRight style={actionStyles.icon} />
              <span style={actionStyles.person}>{sc.by}</span>
              <span style={actionStyles.verb}> → </span>
              <span style={{ color: 'var(--td-accent-primary)', fontWeight: 600 }}>{sc.column}</span>
            </div>
            {sc.at && <span className="tdsm-history-time">{sc.at}</span>}
          </div>
          {sc.notes && <div className="tdsm-history-notes">{sc.notes}</div>}
        </>
      ),
    })),
    ...attachments.map((attachment) => ({
      key: `attachment-${attachment.id}`,
      time: toTimestamp(attachment.uploadedAt),
      node: (
        <>
          <div className="tdsm-history-header">
            <div className="tdsm-history-action">
              {attachment.kind === 'link' ? <FaLink style={actionStyles.icon} /> : <FaFileAlt style={actionStyles.icon} />}
              <span style={actionStyles.person}>{attachment.uploadedBy?.name || 'Unknown'}</span>
              <span style={actionStyles.verb}> added a {attachment.kind === 'link' ? 'link' : 'file'}</span>
            </div>
            <span className="tdsm-history-time">{formatTime(attachment.uploadedAt)}</span>
          </div>
          {attachment.note && <div className="tdsm-history-notes">{attachment.note}</div>}
          {/^https?:\/\//i.test(attachment.url || '') ? (
            <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="tdsm-file-link" style={{ marginTop: '6px' }}>
              <span>{attachment.filename || attachment.url}</span>
            </a>
          ) : (
            <div className="tdsm-history-notes">{attachment.filename || attachment.url}</div>
          )}
        </>
      ),
    })),
    ...conversationEntries(conversations).map((entry) => ({
      key: entry.id,
      time: toTimestamp(entry.at),
      node: (
        <>
          <div className="tdsm-history-header">
            <div className="tdsm-history-action">
              <FaRegCommentDots style={actionStyles.icon} />
              <span style={actionStyles.person}>{entry.by || 'Unknown'}</span>
              <span style={actionStyles.verb}> {entry.verb}</span>
            </div>
            <span className="tdsm-history-time">{formatTime(entry.at)}</span>
          </div>
          {entry.text && <div className="tdsm-history-notes">{renderTextWithLinks(entry.text)}</div>}
        </>
      ),
    })),
    ...activityLogs.map((log) => ({
      key: `log-${log.id}`,
      time: toTimestamp(log.createdAt),
      node: <ActivityLogEntry log={log} />,
    })),
  ].sort((a, b) => b.time - a.time);

  return (
  <>
    <div className="tdsm-section-divider">Activity History</div>

    {timeline.map((entry) => (
      <div key={entry.key} className="tdsm-history-item">{entry.node}</div>
    ))}

    {(taskTransfers.length > 0 || loadingTaskTransfers) && (
      <>
        <div className="tdsm-section-divider" style={{ marginTop: '16px' }}>Transfer history</div>
        {loadingTaskTransfers ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', color: 'var(--td-text-tertiary)', gap: '10px', fontSize: '13px' }}>
            <FaSpinner className="tdsm-spinner" />
            Loading…
          </div>
        ) : (
          taskTransfers.map((transfer: any) => {
            const actorName = transfer.transferredBy?.name || transfer.transferredBy?.email || 'Unknown';
            const kindLabel = transfer.kind === 'return' ? 'returned' : 'forwarded';
            return (
              <div key={transfer.id} className="tdsm-history-item">
                <div className="tdsm-history-header">
                  <div className="tdsm-history-action">
                    <FaArrowRight style={{ fontSize: '10px', color: 'var(--td-text-tertiary)' }} />
                    <span style={{ color: 'var(--td-text-primary)' }}>{actorName}</span>
                    <span style={{ color: 'var(--td-text-tertiary)' }}> {kindLabel} from </span>
                    <span style={{ color: 'var(--td-text-secondary)' }}>{transfer.fromDepartment}</span>
                    <span style={{ color: 'var(--td-text-tertiary)' }}> to </span>
                    <span style={{ color: 'var(--td-accent-primary)', fontWeight: 600 }}>{transfer.toDepartment}</span>
                  </div>
                  {transfer.transferredAt && (
                    <span className="tdsm-history-time">
                      {new Date(transfer.transferredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                {transfer.note && (
                  <div className="tdsm-history-notes">{transfer.note}</div>
                )}
              </div>
            );
          })
        )}
      </>
    )}

    {deliverableId && (
      <>
        {timeline.length > 0 && (
          <div className="tdsm-section-divider" style={{ marginTop: '16px' }}>Deliverable activity</div>
        )}
        {loadingTaskHistory ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', color: 'var(--td-text-tertiary)', gap: '10px', fontSize: '13px' }}>
            <FaSpinner className="tdsm-spinner" />
            Loading…
          </div>
        ) : taskHistory.length > 0 ? (
          taskHistory.map((historyItem: any, index: number) => (
            <div key={historyItem.id || index} className="tdsm-history-item">
              <div className="tdsm-history-header">
                <div className="tdsm-history-action">
                  {historyItem.action === 'Approved' && <FaCheckCircle style={{ color: 'var(--td-accent-completed)', fontSize: '12px' }} />}
                  {historyItem.action === 'Revision Requested' && <FaExclamationCircle style={{ color: 'var(--td-accent-blocked)', fontSize: '12px' }} />}
                  {String(historyItem.action || 'Updated')}
                </div>
                {historyItem.createdAt && (
                  <span className="tdsm-history-time">
                    {new Date(historyItem.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              {historyItem.notes && (
                <div className="tdsm-history-notes">{renderTextWithLinks(historyItem.notes)}</div>
              )}
              {historyItem.fileUrl && (
                <a href={historyItem.fileUrl} target="_blank" rel="noopener noreferrer" className="tdsm-file-link" style={{ marginTop: '8px' }}>
                  <FaLink style={{ fontSize: '11px', flexShrink: 0 }} />
                  <span>{historyItem.fileUrl}</span>
                </a>
              )}
            </div>
          ))
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--td-text-tertiary)' }}>
            No deliverable activity yet
          </div>
        )}
      </>
    )}

    {!deliverableId && timeline.length === 0 && (
      <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--td-text-tertiary)', lineHeight: 1.5 }}>
        Activity (approvals, revisions) is tracked when this task is linked to a deliverable. Status changes (who moved this task to which column) will appear here when notes are added.
      </div>
    )}
  </>
  );
};

export default TaskActivityHistory;
