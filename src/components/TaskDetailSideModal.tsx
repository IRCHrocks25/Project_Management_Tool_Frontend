import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaTimes, FaUser, FaClock, FaStickyNote, FaLink, FaFileAlt,
  FaCheckCircle, FaExclamationCircle, FaSpinner,
  FaArrowRight, FaPaperPlane, FaRegCommentDots
} from 'react-icons/fa';
import { deliverableService } from '../services/deliverable.service';
import { taskService } from '../services/task.service';
import UserAvatar from './UserAvatar';
import MentionText from './MentionText';

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

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');

  .tdsm-root * {
    box-sizing: border-box;
    font-family: 'DM Sans', sans-serif;
  }

  .tdsm-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(8, 8, 14, 0.72);
    backdrop-filter: blur(4px);
    z-index: 1199;
    animation: tdsm-fadeIn 0.25s ease-out;
  }

  @keyframes tdsm-fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes tdsm-slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  @keyframes tdsm-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .tdsm-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 520px;
    background: #0d0f14;
    z-index: 1200;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: tdsm-slideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1);
    border-left: 1px solid rgba(255,255,255,0.07);
  }

  /* Subtle ambient glow top-left */
  .tdsm-panel::before {
    content: '';
    position: absolute;
    top: -120px;
    left: -80px;
    width: 340px;
    height: 340px;
    background: radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  .tdsm-header {
    position: relative;
    z-index: 2;
    padding: 28px 28px 0;
    flex-shrink: 0;
  }

  .tdsm-header-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 20px;
  }

  .tdsm-close-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.18s;
    font-size: 13px;
  }
  .tdsm-close-btn:hover {
    background: rgba(255,255,255,0.09);
    color: rgba(255,255,255,0.85);
    border-color: rgba(255,255,255,0.18);
  }

  .tdsm-task-title {
    font-size: 18px;
    font-weight: 600;
    color: #f0f2f7;
    line-height: 1.35;
    letter-spacing: -0.3px;
    margin: 0;
    flex: 1;
  }

  .tdsm-pm-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: rgba(255,255,255,0.35);
    margin-bottom: 20px;
    font-weight: 400;
    letter-spacing: 0.01em;
  }
  .tdsm-pm-row svg { font-size: 10px; }

  /* Tabs */
  .tdsm-tabs {
    display: flex;
    gap: 2px;
    padding: 0 28px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
    position: relative;
    z-index: 2;
  }

  .tdsm-tab {
    padding: 10px 16px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255,255,255,0.35);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all 0.2s;
    letter-spacing: 0.01em;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tdsm-tab:hover { color: rgba(255,255,255,0.6); }
  .tdsm-tab.active {
    color: #818cf8;
    border-bottom-color: #818cf8;
  }

  /* Scroll area */
  .tdsm-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px 28px 32px;
    position: relative;
    z-index: 1;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
  }
  .tdsm-body::-webkit-scrollbar { width: 4px; }
  .tdsm-body::-webkit-scrollbar-track { background: transparent; }
  .tdsm-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

  /* Status badge */
  .tdsm-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-bottom: 20px;
  }
  .tdsm-status-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .tdsm-status.completed { background: rgba(16,185,129,0.12); color: #34d399; border: 1px solid rgba(16,185,129,0.2); }
  .tdsm-status.completed .tdsm-status-dot { background: #34d399; box-shadow: 0 0 6px #34d399; }
  .tdsm-status.in-review { background: rgba(251,191,36,0.1); color: #fbbf24; border: 1px solid rgba(251,191,36,0.2); }
  .tdsm-status.in-review .tdsm-status-dot { background: #fbbf24; box-shadow: 0 0 6px #fbbf24; }
  .tdsm-status.in-progress { background: rgba(129,140,248,0.12); color: #818cf8; border: 1px solid rgba(129,140,248,0.2); }
  .tdsm-status.in-progress .tdsm-status-dot { background: #818cf8; box-shadow: 0 0 6px #818cf8; }
  .tdsm-status.default { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.08); }
  .tdsm-status.default .tdsm-status-dot { background: rgba(255,255,255,0.4); }

  /* Cards */
  .tdsm-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 12px;
    transition: border-color 0.2s;
  }
  .tdsm-card:hover { border-color: rgba(255,255,255,0.11); }

  .tdsm-card-label {
    font-size: 10.5px;
    font-weight: 600;
    color: rgba(255,255,255,0.28);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
  }
  .tdsm-card-label svg { font-size: 9px; }

  .tdsm-card-value {
    font-size: 14.5px;
    font-weight: 500;
    color: #e2e5ef;
    line-height: 1.5;
  }

  .tdsm-assignee-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
  }
  .tdsm-assignee-name {
    font-size: 14px;
    color: #d4d8e8;
    font-weight: 400;
  }

  /* Date input */
  .tdsm-date-input {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    font-size: 13.5px;
    font-family: 'DM Mono', monospace;
    color: #c8ccdc;
    background: rgba(255,255,255,0.04);
    transition: all 0.2s;
    outline: none;
    color-scheme: dark;
  }
  .tdsm-date-input:focus { border-color: rgba(129,140,248,0.5); box-shadow: 0 0 0 3px rgba(129,140,248,0.1); }

  /* Files/links card */
  .tdsm-file-link {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #818cf8;
    text-decoration: none;
    font-size: 13.5px;
    word-break: break-all;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(129,140,248,0.06);
    border: 1px solid rgba(129,140,248,0.15);
    transition: all 0.18s;
  }
  .tdsm-file-link:hover { background: rgba(129,140,248,0.12); border-color: rgba(129,140,248,0.3); }

  /* History */
  .tdsm-history-item {
    padding: 12px 14px;
    background: rgba(255,255,255,0.02);
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.06);
    margin-bottom: 8px;
  }
  .tdsm-history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .tdsm-history-action {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 600;
    color: #c8ccdc;
  }
  .tdsm-history-time {
    font-size: 11px;
    color: rgba(255,255,255,0.25);
    font-family: 'DM Mono', monospace;
  }
  .tdsm-history-notes {
    font-size: 12.5px;
    color: rgba(255,255,255,0.45);
    white-space: pre-wrap;
    line-height: 1.55;
  }

  /* Actions */
  .tdsm-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .tdsm-btn-outline {
    width: 100%;
    padding: 11px 16px;
    border: 1px solid rgba(129,140,248,0.3);
    border-radius: 10px;
    background: transparent;
    color: #818cf8;
    cursor: pointer;
    font-size: 13.5px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s;
    letter-spacing: 0.01em;
  }
  .tdsm-btn-outline:hover {
    background: rgba(129,140,248,0.08);
    border-color: rgba(129,140,248,0.5);
  }

  .tdsm-btn-primary {
    width: 100%;
    padding: 11px 16px;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
    color: white;
    cursor: pointer;
    font-size: 13.5px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s;
    letter-spacing: 0.01em;
    box-shadow: 0 4px 16px rgba(99,102,241,0.25);
  }
  .tdsm-btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(99,102,241,0.35);
  }
  .tdsm-btn-primary:active { transform: translateY(0); }

  /* ── Conversation Tab ────────────────────────────── */

  .tdsm-q-block {
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 14px;
    transition: border-color 0.2s;
  }
  .tdsm-q-block:hover { border-color: rgba(255,255,255,0.11); }

  .tdsm-user-meta {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-bottom: 8px;
  }
  .tdsm-user-meta-name {
    font-size: 13px;
    font-weight: 600;
    color: #d4d8e8;
  }
  .tdsm-user-meta-time {
    font-size: 11px;
    color: rgba(255,255,255,0.25);
    font-family: 'DM Mono', monospace;
    margin-top: 1px;
  }

  .tdsm-q-text {
    font-size: 13.5px;
    color: rgba(255,255,255,0.7);
    white-space: pre-wrap;
    line-height: 1.6;
    margin-left: 37px;
  }

  .tdsm-comments-thread {
    margin-left: 37px;
    padding-left: 14px;
    border-left: 1.5px solid rgba(255,255,255,0.08);
    margin-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .tdsm-comment {
    padding: 10px 12px;
    background: rgba(255,255,255,0.02);
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.05);
  }
  .tdsm-comment-text {
    font-size: 12.5px;
    color: rgba(255,255,255,0.6);
    white-space: pre-wrap;
    line-height: 1.55;
    margin-left: 33px;
  }

  /* Inputs */
  .tdsm-textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    color: #d0d4e4;
    background: rgba(255,255,255,0.04);
    resize: vertical;
    outline: none;
    transition: all 0.2s;
    line-height: 1.5;
  }
  .tdsm-textarea::placeholder { color: rgba(255,255,255,0.2); }
  .tdsm-textarea:focus { border-color: rgba(129,140,248,0.45); box-shadow: 0 0 0 3px rgba(129,140,248,0.09); }

  .tdsm-post-btn {
    padding: 7px 14px;
    border: none;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    transition: all 0.18s;
    letter-spacing: 0.01em;
    margin-top: 8px;
  }
  .tdsm-post-btn.active {
    background: linear-gradient(135deg, #6366f1, #818cf8);
    color: white;
    box-shadow: 0 2px 10px rgba(99,102,241,0.3);
  }
  .tdsm-post-btn.active:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(99,102,241,0.35); }
  .tdsm-post-btn.disabled {
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.25);
    cursor: not-allowed;
  }

  /* Mention dropdown */
  .tdsm-mention-dropdown {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    margin-bottom: 6px;
    background: #1a1d27;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    max-height: 180px;
    overflow-y: auto;
    z-index: 1000;
  }
  .tdsm-mention-item {
    padding: 9px 12px;
    cursor: pointer;
    font-size: 13px;
    color: #c8ccdc;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    transition: background 0.15s;
  }
  .tdsm-mention-item:last-child { border-bottom: none; }
  .tdsm-mention-item:hover { background: rgba(129,140,248,0.1); color: #818cf8; }

  /* New question box */
  .tdsm-ask-box {
    margin-top: 24px;
    padding: 18px;
    background: rgba(99,102,241,0.05);
    border: 1px solid rgba(99,102,241,0.15);
    border-radius: 14px;
  }
  .tdsm-ask-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(129,140,248,0.7);
    margin-bottom: 10px;
  }

  .tdsm-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    color: rgba(255,255,255,0.2);
    text-align: center;
    gap: 12px;
  }
  .tdsm-empty-state svg { font-size: 28px; opacity: 0.3; }
  .tdsm-empty-state p { font-size: 13.5px; margin: 0; line-height: 1.5; }

  .tdsm-spinner {
    animation: tdsm-spin 1s linear infinite;
  }

  .tdsm-section-divider {
    font-size: 10.5px;
    font-weight: 600;
    color: rgba(255,255,255,0.18);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 22px 0 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .tdsm-section-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(255,255,255,0.06);
  }
`;

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
  const [resolvedTask, setResolvedTask] = useState<any | null>(null);
  const [loadingTask, setLoadingTask] = useState(false);
  const [taskHistory, setTaskHistory] = useState<any[]>([]);
  const [loadingTaskHistory, setLoadingTaskHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'conversation'>(initialTab);

  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newCommentTexts, setNewCommentTexts] = useState<Record<string, string>>({});
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [submittingComments, setSubmittingComments] = useState<Record<string, boolean>>({});
  const [showMentionDropdown, setShowMentionDropdown] = useState<{ questionId?: string; commentId?: string; position: number } | null>(null);
  const [updatingDueDate, setUpdatingDueDate] = useState(false);
  const [savedDueDate, setSavedDueDate] = useState<string | null>(null);

  const displayTask = resolvedTask || task;

  const handleInternalClose = useCallback(() => {
    onClose();
    setResolvedTask(null);
    setTaskHistory([]);
    setSavedDueDate(null);
  }, [onClose]);

  useEffect(() => { setSavedDueDate(null); }, [task?.id]);

  useEffect(() => { if (isOpen) setActiveTab(initialTab); }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen || !task?.id) {
      setResolvedTask(null);
      return;
    }
    setLoadingTask(true);
    setResolvedTask(null);
    taskService
      .getOne(task.id)
      .then((full) => setResolvedTask(full))
      .catch(() => setResolvedTask(null))
      .finally(() => setLoadingTask(false));
  }, [isOpen, task?.id]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!isOpen || !displayTask) return;
      const deliverableId = displayTask.deliverableId;
      if (!deliverableId) {
        setTaskHistory([]);
        setLoadingTaskHistory(false);
        return;
      }
      setLoadingTaskHistory(true);
      setTaskHistory([]);
      try {
        const history = await deliverableService.getHistory(deliverableId);
        setTaskHistory(Array.isArray(history) ? history : []);
      } catch (error) {
        setTaskHistory([]);
      } finally {
        setLoadingTaskHistory(false);
      }
    };
    loadHistory();
  }, [isOpen, displayTask?.id, displayTask?.deliverableId]);

  useEffect(() => {
    const loadConversations = async () => {
      if (!isOpen || !task || activeTab !== 'conversation') return;
      try {
        setLoadingConversations(true);
        const data = await taskService.getConversations(task.id);
        setConversations(data);
      } catch (error) {
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
    const mentionRegex = /@([^\[]+)\[\[USER_ID:([^\]]+)\]\]/g;
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

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleInternalClose();
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

  const renderTextWithLinks = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        urlRegex.lastIndex = 0;
        return (
          <a key={index} href={part} target="_blank" rel="noopener noreferrer"
            style={{ color: '#818cf8', textDecoration: 'underline', wordBreak: 'break-all' }}>
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  /** Parse "--- Status Change ---" blocks from task description (who moved what column). */
  const parsedStatusChanges = useMemo(() => {
    const desc = displayTask?.description ?? task?.description ?? '';
    if (!desc.includes('--- Status Change ---')) return [];
    const blocks = desc.split(/\n\n--- Status Change ---/);
    const out: { by: string; column: string; at: string; notes?: string; index: number }[] = [];
    blocks.forEach((block: string, i: number) => {
      if (i === 0) return;
      const newCol = block.match(/\nNew Column:\s*(.+?)(?:\n|$)/);
      const by = block.match(/\nBy:\s*(.+?)(?:\n|$)/);
      const at = block.match(/\nAt:\s*(.+?)(?:\n|$)/);
      const notesMatch = block.match(/\nNotes:\s*([\s\S]+?)(?=\nAttachments:|\n\n|$)/);
      out.push({
        column: (newCol?.[1] ?? '').trim(),
        by: (by?.[1] ?? 'Unknown').trim(),
        at: (at?.[1] ?? '').trim(),
        notes: notesMatch?.[1]?.trim() || undefined,
        index: i,
      });
    });
    return out.reverse();
  }, [displayTask?.description, task?.description]);

  const assigneeIds: string[] = useMemo(() => {
    if (!displayTask) return [];
    const assignees = displayTask.assignees || [];
    if (assignees.length > 0) return assignees.map((a: any) => a.userId || a.user?.id).filter(Boolean);
    return displayTask.assignedToId ? [displayTask.assignedToId] : [];
  }, [displayTask]);

  const getStatusClass = () => {
    if (!displayTask) return 'default';
    if (displayTask.isCompleted) return 'completed';
    if (displayTask.status === 'In Review') return 'in-review';
    if (displayTask.status === 'In Progress') return 'in-progress';
    return 'default';
  };

  const getStatusLabel = () => (displayTask?.isCompleted ? 'Completed' : (displayTask?.status || 'Pending'));

  if (!isOpen || !task) return null;

  return (
    <div className="tdsm-root">
      <style>{styles}</style>

      {/* Backdrop */}
      <div className="tdsm-backdrop" onClick={handleInternalClose} />

      {/* Panel */}
      <div className="tdsm-panel" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="tdsm-header">
          <div className="tdsm-header-top">
            <h2 className="tdsm-task-title">
              {loadingTask ? 'Loading…' : (displayTask?.title ?? task?.title ?? '')}
            </h2>
            <button className="tdsm-close-btn" onClick={handleInternalClose}>
              <FaTimes />
            </button>
          </div>

          {getProjectPmName?.(displayTask?.projectId ?? task?.projectId) && (
            <div className="tdsm-pm-row">
              <FaUser />
              PM: {getProjectPmName(displayTask?.projectId ?? task?.projectId)}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="tdsm-tabs">
          <button className={`tdsm-tab ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>
            Details
          </button>
          <button
            className={`tdsm-tab ${activeTab === 'conversation' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('conversation');
              const tid = displayTask?.id ?? task?.id;
              if (tid) {
                taskService.getConversations(tid).then(data => setConversations(data)).catch(console.error);
              }
            }}
          >
            <FaRegCommentDots style={{ fontSize: '12px' }} />
            Conversation
          </button>
        </div>

        {/* Body */}
        <div className="tdsm-body">
          {activeTab === 'details' ? (
            <>
              {/* Status */}
              <span className={`tdsm-status ${getStatusClass()}`}>
                <span className="tdsm-status-dot" />
                {getStatusLabel()}
              </span>

              {/* Project */}
              <div className="tdsm-card">
                <div className="tdsm-card-label">Project</div>
                <div className="tdsm-card-value">{getProjectName(displayTask?.projectId ?? task?.projectId)}</div>
              </div>

              {/* Assignees */}
              <div className="tdsm-card">
                <div className="tdsm-card-label"><FaUser /> Assigned To</div>
                {assigneeIds.length === 0 ? (
                  <div style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.25)' }}>Unassigned</div>
                ) : (
                  assigneeIds.map((id) => {
                    const assigneeUser = allUsers.find((u: any) => u.id === id);
                    return (
                      <div key={id} className="tdsm-assignee-row">
                        <UserAvatar name={assigneeUser?.name || getUserName(id)} avatarUrl={assigneeUser?.avatarUrl} size={30} color="#6366f1" />
                        <span className="tdsm-assignee-name">{getUserName(id)}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Due Date */}
              {(() => {
                const effectiveDueDate = displayTask?.dueDate || savedDueDate;
                const taskId = displayTask?.id ?? task?.id;
                return (
                  <div className="tdsm-card">
                    <div className="tdsm-card-label"><FaClock /> Due Date</div>
                    {effectiveDueDate ? (
                      <div className="tdsm-card-value" style={{ fontFamily: "'DM Mono', monospace", fontSize: '13.5px' }}>
                        {new Date(effectiveDueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                    ) : (
                      <input
                        type="date"
                        className="tdsm-date-input"
                        disabled={updatingDueDate}
                        onChange={async (e) => {
                          const value = e.target.value;
                          if (!value || !taskId) return;
                          try {
                            setUpdatingDueDate(true);
                            const updated = await taskService.update(taskId, { dueDate: new Date(value) });
                            setSavedDueDate(value);
                            const merged = { ...(displayTask || task), dueDate: updated?.dueDate ?? value };
                            onTaskUpdate?.(merged);
                            setResolvedTask(merged);
                          } catch (err) {
                            console.error('Failed to update due date:', err);
                          } finally {
                            setUpdatingDueDate(false);
                          }
                        }}
                      />
                    )}
                  </div>
                );
              })()}

              {/* Description - always show so it's not "missing" */}
              <div className="tdsm-card">
                <div className="tdsm-card-label"><FaStickyNote /> Description</div>
                <div style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.6)', whiteSpace: 'pre-wrap', lineHeight: '1.65', wordBreak: 'break-word' }}>
                  {displayTask?.description ? renderTextWithLinks(displayTask.description) : <span style={{ color: 'rgba(255,255,255,0.25)' }}>No description</span>}
                </div>
              </div>

              {/* Files */}
              {(displayTask?.fileUrl ?? task?.fileUrl) && (
                <div className="tdsm-card" style={{ borderColor: 'rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.04)' }}>
                  <div className="tdsm-card-label" style={{ color: 'rgba(129,140,248,0.6)' }}><FaLink /> Files & Links</div>
                  <a href={displayTask?.fileUrl ?? task?.fileUrl} target="_blank" rel="noopener noreferrer" className="tdsm-file-link">
                    <FaFileAlt style={{ fontSize: '13px', flexShrink: 0 }} />
                    <span>{displayTask?.fileUrl ?? task?.fileUrl}</span>
                  </a>
                </div>
              )}

              {/* Activity History: status changes (from description) + deliverable approvals/revisions */}
              <div className="tdsm-section-divider">Activity History</div>

              {/* Status changes parsed from task description (who moved what column) */}
              {parsedStatusChanges.length > 0 && (
                <>
                  {parsedStatusChanges.map((sc) => (
                    <div key={`status-${sc.index}`} className="tdsm-history-item">
                      <div className="tdsm-history-header">
                        <div className="tdsm-history-action">
                          <FaArrowRight style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }} />
                          <span style={{ color: '#c8ccdc' }}>{sc.by}</span>
                          <span style={{ color: 'rgba(255,255,255,0.4)' }}> → </span>
                          <span style={{ color: '#818cf8', fontWeight: 600 }}>{sc.column}</span>
                        </div>
                        {sc.at && <span className="tdsm-history-time">{sc.at}</span>}
                      </div>
                      {sc.notes && <div className="tdsm-history-notes">{sc.notes}</div>}
                    </div>
                  ))}
                </>
              )}

              {/* Deliverable history (approvals, revisions) when task is linked to a deliverable */}
              {displayTask?.deliverableId && (
                <>
                  {parsedStatusChanges.length > 0 && (
                    <div className="tdsm-section-divider" style={{ marginTop: '16px' }}>Deliverable activity</div>
                  )}
                  {loadingTaskHistory ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', color: 'rgba(255,255,255,0.25)', gap: '10px', fontSize: '13px' }}>
                      <FaSpinner className="tdsm-spinner" />
                      Loading…
                    </div>
                  ) : taskHistory.length > 0 ? (
                    taskHistory.map((historyItem: any, index: number) => (
                      <div key={historyItem.id || index} className="tdsm-history-item">
                        <div className="tdsm-history-header">
                          <div className="tdsm-history-action">
                            {historyItem.action === 'Approved' && <FaCheckCircle style={{ color: '#34d399', fontSize: '12px' }} />}
                            {historyItem.action === 'Revision Requested' && <FaExclamationCircle style={{ color: '#f87171', fontSize: '12px' }} />}
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
                    <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.2)' }}>
                      No deliverable activity yet
                    </div>
                  )}
                </>
              )}

              {!displayTask?.deliverableId && parsedStatusChanges.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                  Activity (approvals, revisions) is tracked when this task is linked to a deliverable. Status changes (who moved this task to which column) will appear here when notes are added.
                </div>
              )}

              {/* Actions */}
              <div className="tdsm-actions">
                <button
                  className="tdsm-btn-outline"
                  onClick={() => { handleInternalClose(); navigate(`/project/${displayTask?.projectId ?? task?.projectId}`); }}
                >
                  View Full Project <FaArrowRight style={{ fontSize: '11px' }} />
                </button>
                {onEditTask && (
                  <button
                    className="tdsm-btn-primary"
                    onClick={() => { handleInternalClose(); onEditTask(displayTask || task); }}
                  >
                    Edit Task
                  </button>
                )}
              </div>
            </>
          ) : (
            /* ── Conversation Tab ─────────────────────── */
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
                    {/* Question header */}
                    <div className="tdsm-user-meta">
                      <UserAvatar name={question.user?.name} avatarUrl={question.user?.avatarUrl} size={28} color="#6366f1" />
                      <div>
                        <div className="tdsm-user-meta-name">{question.user?.name || 'Unknown'}</div>
                        <div className="tdsm-user-meta-time">{new Date(question.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="tdsm-q-text"><MentionText text={question.text || ''} /></div>

                    {/* Comments thread */}
                    {question.comments && question.comments.length > 0 && (
                      <div className="tdsm-comments-thread">
                        {question.comments.map((comment: any) => (
                          <div key={comment.id} className="tdsm-comment">
                            <div className="tdsm-user-meta">
                              <UserAvatar name={comment.user?.name} avatarUrl={comment.user?.avatarUrl} size={24} color="#6366f1" />
                              <div>
                                <div className="tdsm-user-meta-name" style={{ fontSize: '12.5px' }}>{comment.user?.name || 'Unknown'}</div>
                                <div className="tdsm-user-meta-time">{new Date(comment.createdAt).toLocaleString()}</div>
                              </div>
                            </div>
                            <div className="tdsm-comment-text"><MentionText text={comment.text || ''} /></div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Comment input */}
                    <div style={{ marginTop: '12px', marginLeft: '37px', paddingLeft: '14px', borderLeft: '1.5px solid rgba(255,255,255,0.08)' }}>
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
                        className={`tdsm-post-btn ${(!newCommentTexts[question.id]?.trim() || submittingComments[question.id]) ? 'disabled' : 'active'}`}
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

              {/* Ask a question box */}
              <div className="tdsm-ask-box">
                <div className="tdsm-ask-label">Ask a Question</div>
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
                  className={`tdsm-post-btn ${(!newQuestionText.trim() || submittingQuestion) ? 'disabled' : 'active'}`}
                  onClick={handleCreateQuestion}
                  disabled={!newQuestionText.trim() || submittingQuestion}
                >
                  <FaPaperPlane style={{ fontSize: '10px' }} />
                  {submittingQuestion ? 'Posting…' : 'Post Question'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetailSideModal;