import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTimes, FaUser, FaClock, FaStickyNote, FaLink, FaFileAlt, FaHistory, FaCheckCircle, FaExclamationCircle, FaSpinner } from 'react-icons/fa';
import { deliverableService } from '../services/deliverable.service';

interface TaskDetailSideModalProps {
  isOpen: boolean;
  task: any | null;
  onClose: () => void;
  allUsers: any[];
  getProjectName: (projectId: string) => string;
  onEditTask?: (task: any) => void;
}

const TaskDetailSideModal: React.FC<TaskDetailSideModalProps> = ({
  isOpen,
  task,
  onClose,
  allUsers,
  getProjectName,
  onEditTask
}) => {
  const navigate = useNavigate();
  const [taskHistory, setTaskHistory] = useState<any[]>([]);
  const [loadingTaskHistory, setLoadingTaskHistory] = useState(false);

  const handleInternalClose = useCallback(() => {
    onClose();
    setTaskHistory([]);
  }, [onClose]);

  // Load deliverable history when modal opens
  useEffect(() => {
    const loadHistory = async () => {
      if (!isOpen || !task) return;
      if (!task.deliverableId) {
        setTaskHistory([]);
        return;
      }

      setLoadingTaskHistory(true);
      setTaskHistory([]);
      try {
        const history = await deliverableService.getHistory(task.deliverableId);
        setTaskHistory(history || []);
      } catch (error) {
        console.error('Failed to load task history:', error);
        setTaskHistory([]);
      } finally {
        setLoadingTaskHistory(false);
      }
    };

    loadHistory();
  }, [isOpen, task]);

  // Escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleInternalClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleInternalClose]);

  const getUserName = useCallback(
    (userId: string): string => {
      if (!userId) return 'Unassigned';
      const user = allUsers.find((u: any) => u.id === userId);
      return user?.name || 'Unassigned';
    },
    [allUsers]
  );

  // Render plain text with clickable links
  const renderTextWithLinks = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        // Reset regex state because of lastIndex side effect
        urlRegex.lastIndex = 0;
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#2563eb', textDecoration: 'underline', wordBreak: 'break-all' }}
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const assigneeIds: string[] = useMemo(() => {
    if (!task) return [];
    const assignees = task.assignees || [];
    if (assignees.length > 0) {
      return assignees.map((a: any) => a.userId || a.user?.id).filter(Boolean);
    }
    return task.assignedToId ? [task.assignedToId] : [];
  }, [task]);

  if (!isOpen || !task) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleInternalClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1199,
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
      </div>

      {/* Side Modal */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '500px',
          background: 'white',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
          zIndex: 1200,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideInRight 0.3s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
            }
            to {
              transform: translateX(0);
            }
          }
        `}</style>

        {/* Header */}
        <div
          style={{
            padding: '1.5rem 2rem',
            borderBottom: '1px solid #e5e7eb',
            background: '#f9fafb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}
        >
          <div style={{ flex: 1 }}>
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#111827',
                margin: '0 0 0.25rem 0'
              }}
            >
              Task Details
            </h2>
            <p
              style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {task.title}
            </p>
          </div>
          <button
            onClick={handleInternalClose}
            style={{
              padding: '0.5rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: '8px',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e5e7eb';
              e.currentTarget.style.color = '#111827';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem 2rem'
          }}
        >
          {/* Status */}
          <div style={{ marginBottom: '1.5rem' }}>
            <span
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 600,
                background: task.isCompleted
                  ? '#d1fae5'
                  : task.status === 'In Review'
                  ? '#fef3c7'
                  : task.status === 'In Progress'
                  ? '#dbeafe'
                  : '#f3f4f6',
                color: task.isCompleted
                  ? '#065f46'
                  : task.status === 'In Review'
                  ? '#92400e'
                  : task.status === 'In Progress'
                  ? '#1e40af'
                  : '#374151',
                display: 'inline-block'
              }}
            >
              {task.isCompleted ? 'Completed' : task.status}
            </span>
          </div>

          {/* Project */}
          <div
            style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              background: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.5rem'
              }}
            >
              Project
            </div>
            <div
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: '#111827'
              }}
            >
              {getProjectName(task.projectId)}
            </div>
          </div>

          {/* Assignees */}
          <div
            style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              background: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <FaUser style={{ fontSize: '0.75rem' }} />
              Assigned To
            </div>
            {assigneeIds.length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Unassigned</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {assigneeIds.map((id) => (
                  <div
                    key={id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.875rem',
                      color: '#374151'
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        flexShrink: 0
                      }}
                    >
                      {getUserName(id).charAt(0).toUpperCase()}
                    </div>
                    <span>{getUserName(id)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Due Date */}
          {task.dueDate && (
            <div
              style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                background: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <FaClock style={{ fontSize: '0.75rem' }} />
                Due Date
              </div>
              <div
                style={{
                  fontSize: '0.875rem',
                  color: '#374151'
                }}
              >
                {new Date(task.dueDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div
              style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                background: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <FaStickyNote style={{ fontSize: '0.75rem' }} />
                Description
              </div>
              <div
                style={{
                  fontSize: '0.875rem',
                  color: '#374151',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.6',
                  wordBreak: 'break-word'
                }}
              >
                {renderTextWithLinks(task.description)}
              </div>
            </div>
          )}

          {/* Files/Links */}
          {task.fileUrl && (
            <div
              style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                background: '#eff6ff',
                borderRadius: '8px',
                border: '1px solid #bfdbfe'
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#1d4ed8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <FaLink style={{ fontSize: '0.75rem' }} />
                Files & Links
              </div>
              <a
                href={task.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#2563eb',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  wordBreak: 'break-all'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                <FaFileAlt style={{ fontSize: '0.875rem', flexShrink: 0 }} />
                <span>{task.fileUrl}</span>
              </a>
            </div>
          )}

          {/* Task History */}
          <div
            style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              background: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <FaHistory style={{ fontSize: '0.75rem' }} />
              Activity History
            </div>

            {loadingTaskHistory ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2rem',
                  color: '#9ca3af'
                }}
              >
                <FaSpinner className="spinner" style={{ marginRight: '0.5rem' }} />
                Loading history...
              </div>
            ) : taskHistory.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {taskHistory.map((historyItem: any, index: number) => (
                  <div
                    key={index}
                    style={{
                      padding: '0.75rem',
                      background: 'white',
                      borderRadius: '6px',
                      border: '1px solid #e5e7eb',
                      fontSize: '0.875rem'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0.5rem'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        {historyItem.action === 'Approved' && (
                          <FaCheckCircle style={{ color: '#10b981', fontSize: '0.875rem' }} />
                        )}
                        {historyItem.action === 'Revision Requested' && (
                          <FaExclamationCircle style={{ color: '#ef4444', fontSize: '0.875rem' }} />
                        )}
                        <span
                          style={{
                            fontWeight: 600,
                            color: '#111827'
                          }}
                        >
                          {historyItem.action || 'Updated'}
                        </span>
                      </div>
                      {historyItem.createdAt && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: '#9ca3af'
                          }}
                        >
                          {new Date(historyItem.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                    {historyItem.notes && (
                      <div
                        style={{
                          color: '#6b7280',
                          marginTop: '0.5rem',
                          whiteSpace: 'pre-wrap',
                          fontSize: '0.8125rem',
                          lineHeight: '1.5'
                        }}
                      >
                        {renderTextWithLinks(historyItem.notes)}
                      </div>
                    )}
                    {historyItem.fileUrl && (
                      <a
                        href={historyItem.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          color: '#2563eb',
                          textDecoration: 'none',
                          fontSize: '0.8125rem',
                          marginTop: '0.5rem',
                          wordBreak: 'break-all'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.textDecoration = 'underline';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = 'none';
                        }}
                      >
                        <FaLink style={{ fontSize: '0.75rem', flexShrink: 0 }} />
                        <span>{historyItem.fileUrl}</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: '1rem',
                  textAlign: 'center',
                  color: '#9ca3af',
                  fontSize: '0.875rem'
                }}
              >
                No activity history available
              </div>
            )}
          </div>

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              marginTop: '2rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid #e5e7eb'
            }}
          >
            <button
              onClick={() => {
                handleInternalClose();
                navigate(`/project/${task.projectId}`);
              }}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '1px solid #667eea',
                borderRadius: '8px',
                background: 'transparent',
                color: '#667eea',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#667eea15';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              View Full Project
            </button>
            {onEditTask && (
              <button
                onClick={() => {
                  handleInternalClose();
                  onEditTask(task);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#667eea',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Edit Task
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default TaskDetailSideModal;


