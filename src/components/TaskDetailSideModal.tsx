import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTimes, FaUser, FaClock, FaStickyNote, FaLink, FaFileAlt, FaHistory, FaCheckCircle, FaExclamationCircle, FaSpinner } from 'react-icons/fa';
import { deliverableService } from '../services/deliverable.service';
import { taskService } from '../services/task.service';

interface TaskDetailSideModalProps {
  isOpen: boolean;
  task: any | null;
  onClose: () => void;
  allUsers: any[];
  getProjectName: (projectId: string) => string;
  getProjectPmName?: (projectId: string) => string;
  onEditTask?: (task: any) => void;
  onTaskUpdate?: (updatedTask: any) => void;
  initialTab?: 'details' | 'conversation';
}

const TaskDetailSideModal: React.FC<TaskDetailSideModalProps> = ({
  isOpen,
  task,
  onClose,
  allUsers,
  getProjectName,
  getProjectPmName,
  onEditTask,
  onTaskUpdate,
  initialTab = 'details'
}) => {
  const navigate = useNavigate();
  const [taskHistory, setTaskHistory] = useState<any[]>([]);
  const [loadingTaskHistory, setLoadingTaskHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'conversation'>(initialTab);
  
  // Conversation state
  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newCommentTexts, setNewCommentTexts] = useState<Record<string, string>>({});
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [submittingComments, setSubmittingComments] = useState<Record<string, boolean>>({});
  const [showMentionDropdown, setShowMentionDropdown] = useState<{ questionId?: string; commentId?: string; position: number } | null>(null);
  const [updatingDueDate, setUpdatingDueDate] = useState(false);
  const [savedDueDate, setSavedDueDate] = useState<string | null>(null);

  const handleInternalClose = useCallback(() => {
    onClose();
    setTaskHistory([]);
    setSavedDueDate(null);
  }, [onClose]);

  // Reset saved due date when task changes
  useEffect(() => {
    setSavedDueDate(null);
  }, [task?.id]);

  // Apply initialTab when modal opens (e.g. from conversation notification)
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

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

  // Load conversations when modal opens and conversation tab is active
  useEffect(() => {
    const loadConversations = async () => {
      if (!isOpen || !task || activeTab !== 'conversation') return;
      
      try {
        setLoadingConversations(true);
        const data = await taskService.getConversations(task.id);
        setConversations(data);
      } catch (error) {
        console.error('Failed to load conversations:', error);
        setConversations([]);
      } finally {
        setLoadingConversations(false);
      }
    };

    loadConversations();
  }, [isOpen, task, activeTab]);

  const extractMentions = (text: string): string[] => {
    // Match @name[[USER_ID:uuid]] format - extract the ID directly
    // eslint-disable-next-line no-useless-escape
    const mentionRegex = /@[^\[]+\[\[USER_ID:([^\]]+)\]\]/g;
    const matches = Array.from(text.matchAll(mentionRegex));
    if (!matches || matches.length === 0) return [];
    
    const mentionedUserIds: string[] = [];
    const foundIds = new Set<string>(); // Prevent duplicates
    
    matches.forEach(match => {
      const userId = match[1]; // Extract the user ID from the pattern
      if (userId && !foundIds.has(userId)) {
        foundIds.add(userId);
        mentionedUserIds.push(userId);
      }
    });
    return mentionedUserIds;
  };

  // Render text with mentions - show name but hide the ID part
  const renderTextWithMentions = (text: string) => {
    if (!text) return text;
    // Replace @name[[USER_ID:uuid]] with just @name for display
    // eslint-disable-next-line no-useless-escape
    return text.replace(/@([^\[]+)\[\[USER_ID:[^\]]+\]\]/g, '@$1');
  };

  // Helper to get display text (without USER_ID patterns) for textarea
  const getDisplayText = (text: string): string => {
    return renderTextWithMentions(text);
  };

  // Helper to update text while preserving USER_ID patterns
  const updateTextWithMentions = (currentText: string, newDisplayText: string): string => {
    // Extract all existing mentions with IDs from current text
    // eslint-disable-next-line no-useless-escape
    const mentionRegex = /@([^\[]+)\[\[USER_ID:([^\]]+)\]\]/g;
    const existingMentions = new Map<string, string>(); // Map of name -> userId
    
    let match;
    const regex = new RegExp(mentionRegex);
    while ((match = regex.exec(currentText)) !== null) {
      const name = match[1].trim();
      const userId = match[2];
      existingMentions.set(name, userId);
    }
    
    // Find mentions in new display text and restore IDs
    const newMentionRegex = /@([^\s@\n]+(?:\s+[^\s@\n]+)*)/g;
    let result = newDisplayText;
    const matches = Array.from(newDisplayText.matchAll(newMentionRegex));
    
    // Process from end to start to maintain correct indices
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      const name = match[1].trim();
      const userId = existingMentions.get(name);
      
      if (userId && match.index !== undefined) {
        // Replace name-only mention with full mention including ID
        const start = match.index;
        const end = start + match[0].length;
        result = result.substring(0, start) + `@${name}[[USER_ID:${userId}]]` + result.substring(end);
      }
    }
    
    return result;
  };

  const handleCreateQuestion = async () => {
    if (!task?.id || !newQuestionText.trim()) return;
    
    try {
      setSubmittingQuestion(true);
      const mentionedUserIds = extractMentions(newQuestionText);
      console.log('Extracted mentions:', mentionedUserIds, 'from text:', newQuestionText);
      if (mentionedUserIds.length > 0) {
        console.log('Mentioned users:', mentionedUserIds.map(id => {
          const user = allUsers.find((u: any) => u.id === id);
          return user ? user.name : id;
        }));
      }
      await taskService.createQuestion(task.id, newQuestionText, mentionedUserIds);
      setNewQuestionText('');
      const data = await taskService.getConversations(task.id);
      setConversations(data);
    } catch (error: any) {
      console.error('Failed to create question:', error);
      alert(`Failed to create question: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
    } finally {
      setSubmittingQuestion(false);
    }
  };

  const handleCreateComment = async (questionId: string) => {
    const commentText = newCommentTexts[questionId];
    if (!commentText?.trim() || !task?.id) return;
    
    try {
      setSubmittingComments({ ...submittingComments, [questionId]: true });
      const mentionedUserIds = extractMentions(commentText);
      console.log('Extracted mentions from comment:', mentionedUserIds, 'from text:', commentText);
      if (mentionedUserIds.length > 0) {
        console.log('Mentioned users:', mentionedUserIds.map(id => {
          const user = allUsers.find((u: any) => u.id === id);
          return user ? user.name : id;
        }));
      }
      await taskService.createComment(questionId, commentText, mentionedUserIds);
      setNewCommentTexts({ ...newCommentTexts, [questionId]: '' });
      const data = await taskService.getConversations(task.id);
      setConversations(data);
    } catch (error: any) {
      console.error('Failed to create comment:', error);
      alert(`Failed to create comment: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
    } finally {
      setSubmittingComments({ ...submittingComments, [questionId]: false });
    }
  };

  const handleMentionInput = (text: string, questionId?: string, commentId?: string) => {
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const afterAt = text.substring(lastAtIndex + 1);
      // Check if we're typing a mention (not already completed with USER_ID)
      // Allow word characters and spaces, but not if it already has [[USER_ID:
      // eslint-disable-next-line no-useless-escape
      if (afterAt.match(/^[^\[]*$/) && !afterAt.includes('[[USER_ID:')) {
        setShowMentionDropdown({ questionId, commentId, position: lastAtIndex + 1 });
      } else {
        setShowMentionDropdown(null);
      }
    } else {
      setShowMentionDropdown(null);
    }
  };

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

        {/* PM - just before tabs */}
        {getProjectPmName?.(task.projectId) && (
          <div style={{
            padding: '0.5rem 2rem',
            background: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
            fontSize: '0.875rem',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem'
          }}>
            <FaUser style={{ fontSize: '0.75rem', flexShrink: 0 }} />
            <span>PM: {getProjectPmName(task.projectId)}</span>
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb',
          padding: '0 2rem'
        }}>
          <button
            onClick={() => setActiveTab('details')}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: activeTab === 'details' ? '#667eea' : '#6b7280',
              borderBottom: activeTab === 'details' ? '2px solid #667eea' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            Details
          </button>
          <button
            onClick={() => {
              setActiveTab('conversation');
              if (task?.id) {
                taskService.getConversations(task.id).then(data => setConversations(data)).catch(err => console.error(err));
              }
            }}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: activeTab === 'conversation' ? '#667eea' : '#6b7280',
              borderBottom: activeTab === 'conversation' ? '2px solid #667eea' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            Conversation
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
          {activeTab === 'details' ? (
            <>
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

          {/* Due Date - show date input when not set (editable inline), otherwise show date */}
          {(() => {
            const effectiveDueDate = task.dueDate || savedDueDate;
            return (
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
                {effectiveDueDate ? (
                  <div
                    style={{
                      fontSize: '0.875rem',
                      color: '#374151'
                    }}
                  >
                    {new Date(effectiveDueDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                ) : (
                  <input
                    type="date"
                    disabled={updatingDueDate}
                    onChange={async (e) => {
                      const value = e.target.value;
                      if (!value || !task?.id) return;
                      try {
                        setUpdatingDueDate(true);
                        const updated = await taskService.update(task.id, { dueDate: new Date(value) });
                        const updatedTask = { ...task, dueDate: updated?.dueDate ?? value };
                        setSavedDueDate(value);
                        onTaskUpdate?.(updatedTask);
                      } catch (err) {
                        console.error('Failed to update due date:', err);
                      } finally {
                        setUpdatingDueDate(false);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontFamily: 'inherit',
                      color: '#374151',
                      background: 'white'
                    }}
                  />
                )}
              </div>
            );
          })()}

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
            </>
          ) : (
            /* Conversation Tab */
            <div>
              {/* Conversations List */}
              {loadingConversations ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                  <FaSpinner className="spinner" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }} />
                  <div>Loading conversations...</div>
                </div>
              ) : conversations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                  No questions yet. Be the first to ask!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {conversations.map((question: any) => (
                    <div key={question.id} style={{
                      padding: '1rem',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      {/* Question */}
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginBottom: '0.5rem'
                        }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            flexShrink: 0
                          }}>
                            {question.user?.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              color: '#111827'
                            }}>
                              {question.user?.name || 'Unknown'}
                            </div>
                            <div style={{
                              fontSize: '0.75rem',
                              color: '#6b7280'
                            }}>
                              {new Date(question.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div style={{
                          fontSize: '0.875rem',
                          color: '#374151',
                          whiteSpace: 'pre-wrap',
                          lineHeight: '1.5',
                          marginLeft: '2.25rem'
                        }}>
                          {renderTextWithMentions(question.text)}
                        </div>
                      </div>

                      {/* Comments */}
                      {question.comments && question.comments.length > 0 && (
                        <div style={{
                          marginLeft: '2.25rem',
                          paddingLeft: '1rem',
                          borderLeft: '2px solid #e5e7eb',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem'
                        }}>
                          {question.comments.map((comment: any) => (
                            <div key={comment.id} style={{
                              padding: '0.75rem',
                              background: 'white',
                              borderRadius: '6px',
                              border: '1px solid #e5e7eb'
                            }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginBottom: '0.5rem'
                              }}>
                                <div style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  fontWeight: 600,
                                  fontSize: '0.625rem',
                                  flexShrink: 0
                                }}>
                                  {comment.user?.name?.charAt(0).toUpperCase() || '?'}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{
                                    fontSize: '0.8125rem',
                                    fontWeight: 600,
                                    color: '#111827'
                                  }}>
                                    {comment.user?.name || 'Unknown'}
                                  </div>
                                  <div style={{
                                    fontSize: '0.6875rem',
                                    color: '#6b7280'
                                  }}>
                                    {new Date(comment.createdAt).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              <div style={{
                                fontSize: '0.8125rem',
                                color: '#374151',
                                whiteSpace: 'pre-wrap',
                                lineHeight: '1.5',
                                marginLeft: '1.75rem'
                              }}>
                                {renderTextWithMentions(comment.text)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Comment Input */}
                      <div style={{
                        marginTop: '0.75rem',
                        marginLeft: '2.25rem',
                        paddingLeft: '1rem',
                        borderLeft: '2px solid #e5e7eb'
                      }}>
                        <div style={{ position: 'relative' }}>
                          <textarea
                            value={getDisplayText(newCommentTexts[question.id] || '')}
                            onChange={(e) => {
                              const displayValue = e.target.value;
                              const currentText = newCommentTexts[question.id] || '';
                              // Update text while preserving existing USER_ID patterns
                              const updatedText = updateTextWithMentions(currentText, displayValue);
                              setNewCommentTexts({ ...newCommentTexts, [question.id]: updatedText });
                              handleMentionInput(updatedText, question.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                handleCreateComment(question.id);
                              }
                            }}
                            placeholder="Add a comment... Use @ to mention someone"
                            rows={2}
                            style={{
                              width: '100%',
                              padding: '0.5rem 0.75rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '0.8125rem',
                              fontFamily: 'inherit',
                              resize: 'vertical'
                            }}
                          />
                          {showMentionDropdown && showMentionDropdown.questionId === question.id && (
                            <div style={{
                              position: 'absolute',
                              bottom: '100%',
                              left: 0,
                              right: 0,
                              marginBottom: '0.5rem',
                              background: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                              maxHeight: '200px',
                              overflowY: 'auto',
                              zIndex: 1000
                            }}>
                              {allUsers.filter((u: any) => {
                                const commentText = newCommentTexts[question.id] || '';
                                const textAfterAt = commentText.substring(showMentionDropdown.position);
                                // Remove any existing USER_ID pattern for matching
                                const searchTerm = textAfterAt.replace(/\[\[USER_ID:[^\]]+\]\]/g, '').toLowerCase();
                                return u.name.toLowerCase().includes(searchTerm);
                              }).slice(0, 5).map((u: any) => (
                                <div
                                  key={u.id}
                                  onClick={() => {
                                    const commentText = newCommentTexts[question.id] || '';
                                    const beforeCursor = commentText.substring(0, showMentionDropdown.position - 1);
                                    const afterCursor = commentText.substring(showMentionDropdown.position);
                                    // Insert mention with user ID: @Name[[USER_ID:uuid]]
                                    const newText = beforeCursor + `@${u.name}[[USER_ID:${u.id}]] ` + afterCursor.replace(/^@[^\s@]*/, '');
                                    setNewCommentTexts({ ...newCommentTexts, [question.id]: newText });
                                    setShowMentionDropdown(null);
                                  }}
                                  style={{
                                    padding: '0.5rem 0.75rem',
                                    cursor: 'pointer',
                                    fontSize: '0.8125rem',
                                    borderBottom: '1px solid #f3f4f6'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f9fafb';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'white';
                                  }}
                                >
                                  {u.name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleCreateComment(question.id)}
                          disabled={!newCommentTexts[question.id]?.trim() || submittingComments[question.id]}
                          style={{
                            marginTop: '0.5rem',
                            padding: '0.375rem 0.75rem',
                            border: 'none',
                            borderRadius: '6px',
                            background: (!newCommentTexts[question.id]?.trim() || submittingComments[question.id]) ? '#9ca3af' : '#667eea',
                            color: 'white',
                            cursor: (!newCommentTexts[question.id]?.trim() || submittingComments[question.id]) ? 'not-allowed' : 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}
                        >
                          {submittingComments[question.id] ? 'Posting...' : 'Post Comment'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* New Question Form - At the bottom */}
              <div style={{
                marginTop: '2rem',
                padding: '1rem',
                background: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Ask a Question
                </label>
                <div style={{ position: 'relative' }}>
                  <textarea
                    value={getDisplayText(newQuestionText)}
                    onChange={(e) => {
                      const displayValue = e.target.value;
                      // Update text while preserving existing USER_ID patterns
                      const updatedText = updateTextWithMentions(newQuestionText, displayValue);
                      setNewQuestionText(updatedText);
                      handleMentionInput(updatedText);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        handleCreateQuestion();
                      }
                    }}
                    placeholder="Type your question... Use @ to mention someone"
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                  {showMentionDropdown && !showMentionDropdown.questionId && !showMentionDropdown.commentId && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 0,
                      right: 0,
                      marginBottom: '0.5rem',
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000
                    }}>
                      {allUsers.filter((u: any) => {
                        const textAfterAt = newQuestionText.substring(showMentionDropdown.position);
                        // Remove any existing USER_ID pattern for matching
                        const searchTerm = textAfterAt.replace(/\[\[USER_ID:[^\]]+\]\]/g, '').toLowerCase();
                        return u.name.toLowerCase().includes(searchTerm);
                      }).slice(0, 5).map((u: any) => (
                        <div
                          key={u.id}
                          onClick={() => {
                            const beforeCursor = newQuestionText.substring(0, showMentionDropdown.position - 1);
                            const afterCursor = newQuestionText.substring(showMentionDropdown.position);
                            // Insert mention with user ID: @Name[[USER_ID:uuid]]
                            const newText = beforeCursor + `@${u.name}[[USER_ID:${u.id}]] ` + afterCursor.replace(/^@[^\s@]*/, '');
                            setNewQuestionText(newText);
                            setShowMentionDropdown(null);
                          }}
                          style={{
                            padding: '0.5rem 0.75rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            borderBottom: '1px solid #f3f4f6'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f9fafb';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'white';
                          }}
                        >
                          {u.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleCreateQuestion}
                  disabled={!newQuestionText.trim() || submittingQuestion}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem 1rem',
                    border: 'none',
                    borderRadius: '6px',
                    background: (!newQuestionText.trim() || submittingQuestion) ? '#9ca3af' : '#667eea',
                    color: 'white',
                    cursor: (!newQuestionText.trim() || submittingQuestion) ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600
                  }}
                >
                  {submittingQuestion ? 'Posting...' : 'Post Question'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TaskDetailSideModal;


