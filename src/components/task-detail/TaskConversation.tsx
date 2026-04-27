import React, { useEffect, useState } from 'react';
import { FaRegCommentDots, FaSpinner, FaPaperPlane } from 'react-icons/fa';
import { taskService } from '../../services/task.service';
import UserAvatar from '../UserAvatar';
import MentionText from '../MentionText';

interface TaskConversationProps {
  isOpen: boolean;
  task: any;
  allUsers: any[];
  activeTab: 'details' | 'conversation';
}

const formatTimestamp = (iso: string): string => {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
};

const TAG_RE = /^\[([A-Z_]+)\]\s*/;
const LINKS_EMPTY_RE = /\n*Links:\s*-\s*$/i;
const LINKS_RE = /\n*Links:\s+(.+)/i;

const renderCommentBody = (raw: string): React.ReactNode => {
  const tagMatch = raw.match(TAG_RE);
  let body = tagMatch ? raw.replace(TAG_RE, '') : raw;
  // Strip empty links section; reformat non-empty links with middle dot
  body = body.replace(LINKS_EMPTY_RE, '').trimEnd();
  body = body.replace(LINKS_RE, '\n· $1');
  return (
    <>
      {tagMatch && (
        <span className="tdsm-update-tag">{tagMatch[1].replace(/_/g, ' ')}</span>
      )}
      <MentionText text={body} />
    </>
  );
};

const TaskConversation: React.FC<TaskConversationProps> = ({
  isOpen,
  task,
  allUsers,
  activeTab,
}) => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newCommentTexts, setNewCommentTexts] = useState<Record<string, string>>({});
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [submittingComments, setSubmittingComments] = useState<Record<string, boolean>>({});
  const [showMentionDropdown, setShowMentionDropdown] = useState<{ questionId?: string; commentId?: string; position: number } | null>(null);

  // Loads on tab activation (activeTab dep). Does NOT re-fetch when tab is re-clicked while already
  // active — intentional delta from the original inline call on the tab button. Add explicit refresh
  // handler in a later chunk if re-click refetch is needed.
  useEffect(() => {
    const loadConversations = async () => {
      if (!isOpen || !task || activeTab !== 'conversation') return;
      try {
        setLoadingConversations(true);
        const data = await taskService.getConversations(task.id);
        setConversations(data);
      } catch {
        setConversations([]);
      } finally {
        setLoadingConversations(false);
      }
    };
    loadConversations();
  }, [isOpen, task, activeTab]);

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@[^[]+\[\[USER_ID:([^\]]+)\]\]/g;
    const matches = Array.from(text.matchAll(mentionRegex));
    if (!matches || matches.length === 0) return [];
    const mentionedUserIds: string[] = [];
    const foundIds = new Set<string>();
    matches.forEach(match => {
      const userId = match[1];
      if (userId && !foundIds.has(userId)) { foundIds.add(userId); mentionedUserIds.push(userId); }
    });
    return mentionedUserIds;
  };

  const renderTextWithMentions = (text: string) => {
    if (!text) return text;
    return text.replace(/@([^[]+)\[\[USER_ID:[^\]]+\]\]/g, '@$1');
  };

  const getDisplayText = (text: string): string => renderTextWithMentions(text);

  const updateTextWithMentions = (currentText: string, newDisplayText: string): string => {
    const mentionRegex = /@([^[]+)\[\[USER_ID:([^\]]+)\]\]/g;
    const existingMentions = new Map<string, string>();
    let match;
    const regex = new RegExp(mentionRegex);
    while ((match = regex.exec(currentText)) !== null) {
      existingMentions.set(match[1].trim(), match[2]);
    }
    const newMentionRegex = /@([^\s@\n]+(?:\s+[^\s@\n]+)*)/g;
    let result = newDisplayText;
    const matches = Array.from(newDisplayText.matchAll(newMentionRegex));
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      const name = m[1].trim();
      const userId = existingMentions.get(name);
      if (userId && m.index !== undefined) {
        const start = m.index;
        const end = start + m[0].length;
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
      await taskService.createQuestion(task.id, newQuestionText, mentionedUserIds);
      setNewQuestionText('');
      const data = await taskService.getConversations(task.id);
      setConversations(data);
    } catch (error: any) {
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
      await taskService.createComment(questionId, commentText, mentionedUserIds);
      setNewCommentTexts({ ...newCommentTexts, [questionId]: '' });
      const data = await taskService.getConversations(task.id);
      setConversations(data);
    } catch (error: any) {
      alert(`Failed to create comment: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
    } finally {
      setSubmittingComments({ ...submittingComments, [questionId]: false });
    }
  };

  const handleMentionInput = (text: string, questionId?: string, commentId?: string) => {
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const afterAt = text.substring(lastAtIndex + 1);
      if (afterAt.match(/^[^[]*$/) && !afterAt.includes('[[USER_ID:')) {
        setShowMentionDropdown({ questionId, commentId, position: lastAtIndex + 1 });
      } else {
        setShowMentionDropdown(null);
      }
    } else {
      setShowMentionDropdown(null);
    }
  };

  return (
    <div>
      {loadingConversations ? (
        <div className="tdsm-empty-state">
          <FaSpinner className="tdsm-spinner" style={{ fontSize: '22px', opacity: 0.4 }} />
          <p>Loading conversations…</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="tdsm-empty-state">
          <FaRegCommentDots />
          <p>No questions yet.<br />Be the first to ask something.</p>
        </div>
      ) : (
        conversations.map((question: any) => (
          <div key={question.id} className="tdsm-q-block">
            <div className="tdsm-user-meta">
              <UserAvatar name={question.user?.name} avatarUrl={question.user?.avatarUrl} size={28} color="#6366f1" />
              <div>
                <div className="tdsm-user-meta-name">{question.user?.name || 'Unknown'}</div>
                <div className="tdsm-user-meta-time">{formatTimestamp(question.createdAt)}</div>
              </div>
            </div>
            <div className="tdsm-q-text">{renderCommentBody(question.text || '')}</div>

            {question.comments && question.comments.length > 0 && (
              <div className="tdsm-comments-thread">
                {question.comments.map((comment: any) => (
                  <div key={comment.id} className="tdsm-comment">
                    <div className="tdsm-user-meta">
                      <UserAvatar name={comment.user?.name} avatarUrl={comment.user?.avatarUrl} size={24} color="#6366f1" />
                      <div>
                        <div className="tdsm-user-meta-name" style={{ fontSize: '12.5px' }}>{comment.user?.name || 'Unknown'}</div>
                        <div className="tdsm-user-meta-time">{formatTimestamp(comment.createdAt)}</div>
                      </div>
                    </div>
                    <div className="tdsm-comment-text">{renderCommentBody(comment.text || '')}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="tdsm-reply-area">
              <div style={{ position: 'relative' }}>
                <textarea
                  className="tdsm-textarea"
                  value={getDisplayText(newCommentTexts[question.id] || '')}
                  onChange={(e) => {
                    const displayValue = e.target.value;
                    const updatedText = updateTextWithMentions(newCommentTexts[question.id] || '', displayValue);
                    setNewCommentTexts({ ...newCommentTexts, [question.id]: updatedText });
                    handleMentionInput(updatedText, question.id);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCreateComment(question.id); }}
                  placeholder="Reply… use @ to mention"
                  rows={2}
                />
                {showMentionDropdown && showMentionDropdown.questionId === question.id && (
                  <div className="tdsm-mention-dropdown">
                    {allUsers.filter((u: any) => {
                      const commentText = newCommentTexts[question.id] || '';
                      const textAfterAt = commentText.substring(showMentionDropdown.position);
                      const searchTerm = textAfterAt.replace(/\[\[USER_ID:[^\]]+\]\]/g, '').toLowerCase();
                      return u.name.toLowerCase().includes(searchTerm);
                    }).slice(0, 5).map((u: any) => (
                      <div key={u.id} className="tdsm-mention-item"
                        onClick={() => {
                          const commentText = newCommentTexts[question.id] || '';
                          const beforeCursor = commentText.substring(0, showMentionDropdown.position - 1);
                          const afterCursor = commentText.substring(showMentionDropdown.position);
                          const newText = beforeCursor + `@${u.name}[[USER_ID:${u.id}]] ` + afterCursor.replace(/^@[^\s@]*/, '');
                          setNewCommentTexts({ ...newCommentTexts, [question.id]: newText });
                          setShowMentionDropdown(null);
                        }}
                      >{u.name}</div>
                    ))}
                  </div>
                )}
              </div>
              <button
                className="tdsm-post-btn"
                onClick={() => handleCreateComment(question.id)}
                disabled={!newCommentTexts[question.id]?.trim() || submittingComments[question.id]}
              >
                <FaPaperPlane style={{ fontSize: '10px' }} />
                {submittingComments[question.id] ? 'Posting…' : 'Post Reply'}
              </button>
            </div>
          </div>
        ))
      )}

      <div className="tdsm-ask-box">
        <div className="tdsm-ask-label">Ask a question</div>
        <div style={{ position: 'relative' }}>
          <textarea
            className="tdsm-textarea"
            value={getDisplayText(newQuestionText)}
            onChange={(e) => {
              const displayValue = e.target.value;
              const updatedText = updateTextWithMentions(newQuestionText, displayValue);
              setNewQuestionText(updatedText);
              handleMentionInput(updatedText);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCreateQuestion(); }}
            placeholder="Type your question… use @ to mention someone"
            rows={3}
          />
          {showMentionDropdown && !showMentionDropdown.questionId && !showMentionDropdown.commentId && (
            <div className="tdsm-mention-dropdown">
              {allUsers.filter((u: any) => {
                const textAfterAt = newQuestionText.substring(showMentionDropdown.position);
                const searchTerm = textAfterAt.replace(/\[\[USER_ID:[^\]]+\]\]/g, '').toLowerCase();
                return u.name.toLowerCase().includes(searchTerm);
              }).slice(0, 5).map((u: any) => (
                <div key={u.id} className="tdsm-mention-item"
                  onClick={() => {
                    const beforeCursor = newQuestionText.substring(0, showMentionDropdown.position - 1);
                    const afterCursor = newQuestionText.substring(showMentionDropdown.position);
                    const newText = beforeCursor + `@${u.name}[[USER_ID:${u.id}]] ` + afterCursor.replace(/^@[^\s@]*/, '');
                    setNewQuestionText(newText);
                    setShowMentionDropdown(null);
                  }}
                >{u.name}</div>
              ))}
            </div>
          )}
        </div>
        <button
          className="tdsm-post-btn"
          onClick={handleCreateQuestion}
          disabled={!newQuestionText.trim() || submittingQuestion}
        >
          <FaPaperPlane style={{ fontSize: '10px' }} />
          {submittingQuestion ? 'Posting…' : 'Post Question'}
        </button>
      </div>
    </div>
  );
};

export default TaskConversation;
