import React from 'react';
import { FaArrowRight, FaCheckCircle, FaExclamationCircle, FaSpinner, FaLink } from 'react-icons/fa';

interface StatusChange {
  by: string;
  column: string;
  at: string;
  notes?: string;
  index: number;
}

interface TaskActivityHistoryProps {
  parsedStatusChanges: StatusChange[];
  taskHistory: any[];
  loadingTaskHistory: boolean;
  taskTransfers: any[];
  loadingTaskTransfers: boolean;
  deliverableId?: string;
  renderTextWithLinks: (text: string) => React.ReactNode;
}

const TaskActivityHistory: React.FC<TaskActivityHistoryProps> = ({
  parsedStatusChanges,
  taskHistory,
  loadingTaskHistory,
  taskTransfers,
  loadingTaskTransfers,
  deliverableId,
  renderTextWithLinks,
}) => (
  <>
    <div className="tdsm-section-divider">Activity History</div>

    {parsedStatusChanges.length > 0 && (
      <>
        {parsedStatusChanges.map((sc) => (
          <div key={`status-${sc.index}`} className="tdsm-history-item">
            <div className="tdsm-history-header">
              <div className="tdsm-history-action">
                <FaArrowRight style={{ fontSize: '10px', color: 'var(--td-text-tertiary)' }} />
                <span style={{ color: 'var(--td-text-primary)' }}>{sc.by}</span>
                <span style={{ color: 'var(--td-text-tertiary)' }}> → </span>
                <span style={{ color: 'var(--td-accent-primary)', fontWeight: 600 }}>{sc.column}</span>
              </div>
              {sc.at && <span className="tdsm-history-time">{sc.at}</span>}
            </div>
            {sc.notes && <div className="tdsm-history-notes">{sc.notes}</div>}
          </div>
        ))}
      </>
    )}

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
        {parsedStatusChanges.length > 0 && (
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
            No deliverable activity yett
          </div>
        )}
      </>
    )}

    {!deliverableId && parsedStatusChanges.length === 0 && (
      <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--td-text-tertiary)', lineHeight: 1.5 }}>
        Activity (approvals, revisions) is tracked when this task is linked to a deliverable. Status changes (who moved this task to which column) will appear here when notes are added.
      </div>
    )}
  </>
);

export default TaskActivityHistory;
