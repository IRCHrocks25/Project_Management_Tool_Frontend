import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaSpinner, FaComment, FaFolder, FaHeart, FaReply, FaShare, FaEllipsisV, FaTrash } from 'react-icons/fa';
import { taskService } from '../services/task.service';
import { authService } from '../services/auth.service';
import TaskDetailSideModal from './TaskDetailSideModal';
import UserAvatar from './UserAvatar';
import MentionText from './MentionText';

/* ─── Threads-style colour tokens ─────────────────────────── */
const T = {
  bg: '#f9f9f9',
  surface: '#ffffff',
  border: '#ebebeb',
  threadLine: '#dbdbdb',
  textPrimary: '#0f0f0f',
  textSecondary: '#6b6b6b',
  textTertiary: '#a0a0a0',
  accent: '#0095f6',
  accentHover: '#0077cc',
  avatarGrad: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  danger: '#ed4956',
};

/* ─── Injected global styles ───────────────────────────────── */
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .fc-wrap {
      font-family: 'DM Sans', sans-serif;
      background: ${T.bg};
      min-height: 100vh;
      color: ${T.textPrimary};
    }

    /* ── top nav ── */
    .fc-nav {
      position: sticky;
      top: 0;
      z-index: 200;
      background: rgba(249,249,249,0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid ${T.border};
    }
    .fc-nav-inner {
      max-width: 640px;
      margin: 0 auto;
      padding: 0 16px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .fc-nav-logo {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 1.0625rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: ${T.textPrimary};
    }
    .fc-back-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      background: none;
      border: none;
      cursor: pointer;
      font-family: inherit;
      font-size: 0.875rem;
      font-weight: 500;
      color: ${T.textSecondary};
      padding: 6px 10px;
      border-radius: 8px;
      transition: background 0.15s, color 0.15s;
    }
    .fc-back-btn:hover { background: ${T.border}; color: ${T.textPrimary}; }

    /* ── body ── */
    .fc-body {
      max-width: 640px;
      margin: 0 auto;
      padding: 0 0 80px;
    }

    /* ── header block ── */
    .fc-header {
      padding: 24px 16px 12px;
    }
    .fc-header h1 {
      font-size: 1.375rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: ${T.textPrimary};
      margin-bottom: 4px;
    }
    .fc-header p {
      font-size: 0.875rem;
      color: ${T.textSecondary};
      line-height: 1.5;
    }

    /* ── search ── */
    .fc-search-wrap {
      padding: 0 16px 16px;
    }
    .fc-search {
      width: 100%;
      background: ${T.surface};
      border: 1px solid ${T.border};
      border-radius: 12px;
      padding: 11px 14px;
      font-family: inherit;
      font-size: 0.9375rem;
      color: ${T.textPrimary};
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .fc-search::placeholder { color: ${T.textTertiary}; }
    .fc-search:focus {
      border-color: ${T.textPrimary};
      box-shadow: none;
    }

    /* ── feed ── */
    .fc-feed { display: flex; flex-direction: column; }

    /* ── thread card ── */
    .fc-card {
      background: ${T.surface};
      border-bottom: 1px solid ${T.border};
      padding: 16px 16px 0;
      transition: background 0.15s;
    }

    /* ── two-col layout: avatar col | content col ── */
    .fc-thread-row {
      display: grid;
      grid-template-columns: 44px 1fr;
      gap: 10px;
    }

    /* ── avatar column ── */
    .fc-avatar-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
    }
    .fc-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: ${T.avatarGrad};
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 700;
      font-size: 0.9375rem;
      flex-shrink: 0;
      letter-spacing: 0;
      cursor: pointer;
      overflow: hidden;
    }
    .fc-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .fc-avatar.small {
      width: 32px;
      height: 32px;
      font-size: 0.8125rem;
    }
    .fc-thread-line {
      width: 2px;
      flex: 1;
      min-height: 12px;
      background: ${T.threadLine};
      border-radius: 2px;
      margin-top: 6px;
    }

    /* ── content column ── */
    .fc-content-col {
      min-width: 0;
      padding-bottom: 12px;
    }
    .fc-meta {
      display: flex;
      align-items: baseline;
      gap: 6px;
      margin-bottom: 4px;
      flex-wrap: wrap;
    }
    .fc-username {
      font-size: 0.9375rem;
      font-weight: 600;
      color: ${T.textPrimary};
      letter-spacing: -0.01em;
    }
    .fc-breadcrumb {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.75rem;
      color: ${T.textTertiary};
      flex-wrap: wrap;
    }
    .fc-breadcrumb-project {
      display: flex;
      align-items: center;
      gap: 3px;
      color: ${T.accent};
      font-weight: 500;
      cursor: pointer;
    }
    .fc-breadcrumb-project:hover { text-decoration: underline; }
    .fc-time {
      font-size: 0.8125rem;
      color: ${T.textTertiary};
      margin-left: auto;
    }
    .fc-text {
      font-size: 0.9375rem;
      line-height: 1.55;
      color: ${T.textPrimary};
      white-space: pre-wrap;
      margin-bottom: 10px;
      cursor: pointer;
    }
    .fc-text:hover { opacity: 0.85; }

    /* ── action bar ── */
    .fc-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      margin-bottom: 10px;
    }
    .fc-action-btn {
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 6px 8px;
      border-radius: 8px;
      font-family: inherit;
      font-size: 0.8125rem;
      color: ${T.textSecondary};
      font-weight: 500;
      transition: background 0.12s, color 0.12s;
    }
    .fc-action-btn:hover { background: ${T.bg}; color: ${T.textPrimary}; }
    .fc-action-btn svg { font-size: 1rem; }
    .fc-action-btn.like:hover { color: ${T.danger}; }

    /* ── replies ── */
    .fc-replies {
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .fc-reply-row {
      display: grid;
      grid-template-columns: 44px 1fr;
      gap: 10px;
      padding: 10px 0 0;
    }
    .fc-reply-content { min-width: 0; padding-bottom: 10px; }
    .fc-reply-text {
      font-size: 0.875rem;
      line-height: 1.5;
      color: ${T.textPrimary};
      white-space: pre-wrap;
    }

    /* ── reply input row ── */
    .fc-reply-input-row {
      display: grid;
      grid-template-columns: 44px 1fr;
      gap: 10px;
      padding: 10px 0 14px;
      border-top: 1px solid ${T.border};
      margin-top: 4px;
    }
    .fc-reply-input-col { min-width: 0; position: relative; }
    .fc-reply-textarea {
      width: 100%;
      background: none;
      border: none;
      outline: none;
      resize: none;
      font-family: inherit;
      font-size: 0.9375rem;
      color: ${T.textPrimary};
      line-height: 1.5;
      placeholder-color: ${T.textTertiary};
    }
    .fc-reply-textarea::placeholder { color: ${T.textTertiary}; }
    .fc-reply-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      margin-top: 6px;
    }
    .fc-post-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-family: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      color: ${T.accent};
      padding: 4px 8px;
      border-radius: 6px;
      transition: opacity 0.15s;
    }
    .fc-post-btn:disabled { opacity: 0.35; cursor: default; }
    .fc-post-btn:not(:disabled):hover { opacity: 0.75; }

    /* ── mention dropdown ── */
    .fc-mention-drop {
      position: absolute;
      bottom: 100%;
      left: 0;
      right: 0;
      margin-bottom: 4px;
      background: ${T.surface};
      border: 1px solid ${T.border};
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.10);
      max-height: 200px;
      overflow-y: auto;
      z-index: 500;
    }
    .fc-mention-item {
      padding: 10px 14px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      border-bottom: 1px solid ${T.border};
      transition: background 0.1s;
    }
    .fc-mention-item:last-child { border-bottom: none; }
    .fc-mention-item:hover { background: ${T.bg}; }

    /* ── empty / loading states ── */
    .fc-state {
      padding: 64px 16px;
      text-align: center;
      color: ${T.textTertiary};
    }
    .fc-state svg { font-size: 2.5rem; margin-bottom: 12px; opacity: 0.4; display: block; margin-left: auto; margin-right: auto; }
    .fc-state p { font-size: 0.9375rem; }

    @keyframes fc-spin { to { transform: rotate(360deg); } }
    .fc-spin { animation: fc-spin 0.9s linear infinite; }
  `}</style>
);

/* ─── helpers ──────────────────────────────────────────────── */
const getDisplayText = (text: string) =>
  text ? text.replace(/@([^[\]]+)\[\[USER_ID:[^\]]+\]\]/g, '@$1') : '';

const extractMentions = (text: string): string[] => {
  const regex = /@[^[\]]+\[\[USER_ID:([^\]]+)\]\]/g;
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) ids.push(m[1]);
  return Array.from(new Set(ids));
};

const timeAgo = (dateStr: string) => {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

const Avatar = ({
  name,
  avatarUrl,
  small,
  onClick,
}: {
  name: string;
  avatarUrl?: string | null;
  small?: boolean;
  onClick?: () => void;
}) => {
  const wrap = onClick ? (ch: React.ReactNode) => (
    <div onClick={onClick} style={{ cursor: 'pointer', display: 'inline-block' }} title={name}>
      {ch}
    </div>
  ) : (ch: React.ReactNode) => <>{ch}</>;
  return wrap(
    <UserAvatar
      name={name}
      avatarUrl={avatarUrl}
      size={small ? 32 : 40}
      color="#667eea"
      className={`fc-avatar${small ? ' small' : ''}`}
    />
  );
};

/* ─── Main component ───────────────────────────────────────── */
const ForumConversations: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = authService.getUser();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingTask, setLoadingTask] = useState(false);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState<Record<string, boolean>>({});
  const [showMentionDropdown, setShowMentionDropdown] = useState<{
    convId: string;
    position: number;
  } | null>(null);
  const [openMenuConvId, setOpenMenuConvId] = useState<string | null>(null);
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await taskService.getAllConversations();
      setConversations(data || []);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadConversations();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadConversations]);

  useEffect(() => {
    const t = setInterval(loadConversations, 30000);
    return () => clearInterval(t);
  }, [loadConversations]);

  useEffect(() => {
    authService.getAllUsers().then((u) => setAllUsers(u || [])).catch(() => {});
  }, []);

  const projectNameMap = React.useMemo(() => {
    const m: Record<string, string> = {};
    conversations.forEach((c) => { if (c.projectId && c.projectName) m[c.projectId] = c.projectName; });
    return m;
  }, [conversations]);

  const getProjectName = useCallback(
    (id: string) => projectNameMap[id] || 'Unknown Project',
    [projectNameMap]
  );

  const updateTextWithMentions = (currentText: string, newDisplay: string) => {
    const existing = new Map<string, string>();
    const curRegex = /@([^[\]]+)\[\[USER_ID:([^\]]+)\]\]/g;
    let cur: RegExpExecArray | null;
    while ((cur = curRegex.exec(currentText)) !== null) existing.set(cur[1].trim(), cur[2]);
    let result = newDisplay;
    const newRegex = /@([^\s@\n]+(?:\s+[^\s@\n]+)*)/g;
    const matches: RegExpExecArray[] = [];
    let mm: RegExpExecArray | null;
    while ((mm = newRegex.exec(newDisplay)) !== null) matches.push(mm);
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      const name = m[1].trim();
      const uid = existing.get(name);
      if (uid && m.index !== undefined) {
        result = result.substring(0, m.index) + `@${name}[[USER_ID:${uid}]]` + result.substring(m.index + m[0].length);
      }
    }
    return result;
  };

  const handleMentionInput = (text: string, convId: string) => {
    const idx = text.lastIndexOf('@');
    if (idx !== -1) {
      const after = text.substring(idx + 1);
      if (/^[^[\]]*$/.test(after) && !after.includes('[[USER_ID:')) {
        setShowMentionDropdown({ convId, position: idx + 1 });
        return;
      }
    }
    setShowMentionDropdown(null);
  };

  const filtered = conversations.filter(
    (c) =>
      !searchQuery.trim() ||
      [c.projectName, c.taskTitle, c.text, c.user?.name]
        .some((s) => s?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleOpenTask = async (conv: any) => {
    if (loadingTask) return;
    setLoadingTask(true);
    try {
      const task = await taskService.getOne(conv.taskId);
      setSelectedTask(task);
      setModalOpen(true);
    } catch { /* noop */ } finally {
      setLoadingTask(false);
    }
  };

  const handlePostReply = async (convId: string) => {
    const text = replyTexts[convId];
    if (!text?.trim()) return;
    setSubmittingReply((p) => ({ ...p, [convId]: true }));
    try {
      await taskService.createComment(convId, text, extractMentions(text));
      setReplyTexts((p) => ({ ...p, [convId]: '' }));
      setShowMentionDropdown(null);
      await loadConversations();
    } catch (err: any) {
      alert(`Failed to post reply: ${err?.response?.data?.message || err?.message || 'Unknown error'}`);
    } finally {
      setSubmittingReply((p) => ({ ...p, [convId]: false }));
    }
  };

  const handleDeleteQuestion = async (conv: any) => {
    if (!window.confirm('Delete this post and all its replies? This cannot be undone.')) return;
    setOpenMenuConvId(null);
    setDeletingConvId(conv.id);
    try {
      await taskService.deleteQuestion(conv.id);
      await loadConversations();
    } catch (err: any) {
      alert(`Failed to delete: ${err?.response?.data?.message || err?.message || 'Unknown error'}`);
    } finally {
      setDeletingConvId(null);
    }
  };

  return (
    <div className="fc-wrap">
      <GlobalStyles />

      {/* Nav */}
      <nav className="fc-nav">
        <div className="fc-nav-inner">
          <div className="fc-nav-logo">
            <FaComment style={{ color: T.accent }} />
            Forum
          </div>
          <button className="fc-back-btn" onClick={() => navigate('/dashboard')}>
            <FaArrowLeft style={{ fontSize: '0.8rem' }} />
            Dashboard
          </button>
        </div>
      </nav>

      <div className="fc-body">
        {/* Header */}
        <div className="fc-header">
          <h1>Conversations</h1>
          <p>All task discussions, in one place.</p>
        </div>

        {/* Search */}
        <div className="fc-search-wrap">
          <input
            className="fc-search"
            type="text"
            placeholder="Search by project, task, or message…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Feed */}
        {loading ? (
          <div className="fc-state">
            <FaSpinner className="fc-spin" />
            <p>Loading conversations…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="fc-state">
            <FaComment />
            <p>{searchQuery.trim() ? 'No conversations match your search.' : 'No conversations yet.'}</p>
          </div>
        ) : (
          <div className="fc-feed">
            {filtered.map((conv) => {
              const hasReplies = (conv.comments?.length || 0) > 0;
              const replyText = replyTexts[conv.id] || '';

              return (
                <div key={conv.id} className="fc-card" style={{ position: 'relative' }}>
                  {/* 3-dots menu at top-right */}
                  <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
                    <button
                      type="button"
                      className="fc-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuConvId((id) => (id === conv.id ? null : conv.id));
                      }}
                      disabled={!!deletingConvId}
                      style={{ padding: '6px 8px', background: 'transparent', border: 'none', cursor: deletingConvId ? 'not-allowed' : 'pointer', color: T.textTertiary, borderRadius: 8 }}
                      title="More options"
                    >
                      <FaEllipsisV style={{ fontSize: '1rem' }} />
                    </button>
                    {openMenuConvId === conv.id && (
                      <>
                        <div
                          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                          onClick={() => setOpenMenuConvId(null)}
                          aria-hidden
                        />
                        <div
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: '100%',
                            marginTop: 4,
                            background: T.surface,
                            border: `1px solid ${T.border}`,
                            borderRadius: 10,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                            minWidth: 140,
                            zIndex: 100,
                            overflow: 'hidden',
                          }}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteQuestion(conv);
                            }}
                            disabled={deletingConvId === conv.id}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '10px 14px',
                              border: 'none',
                              background: 'none',
                              cursor: deletingConvId === conv.id ? 'not-allowed' : 'pointer',
                              fontFamily: 'inherit',
                              fontSize: '0.875rem',
                              color: T.danger,
                              textAlign: 'left',
                            }}
                          >
                            <FaTrash style={{ fontSize: '0.8rem' }} />
                            {deletingConvId === conv.id ? 'Deleting…' : 'Delete post'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Main post row */}
                  <div className="fc-thread-row">
                    {/* Avatar col */}
                    <div className="fc-avatar-col">
                      <Avatar name={conv.user?.name} avatarUrl={conv.user?.avatarUrl} onClick={() => handleOpenTask(conv)} />
                      {(hasReplies || true) && <div className="fc-thread-line" />}
                    </div>

                    {/* Content col */}
                    <div className="fc-content-col">
                      {/* Meta row */}
                      <div className="fc-meta">
                        <span className="fc-username">{conv.user?.name || 'Unknown'}</span>
                        <div className="fc-breadcrumb">
                          <span
                            className="fc-breadcrumb-project"
                            onClick={() => handleOpenTask(conv)}
                          >
                            <FaFolder style={{ fontSize: '0.65rem' }} />
                            {conv.projectName || 'Unknown Project'}
                          </span>
                          <span>›</span>
                          <span>{conv.taskTitle || 'Untitled Task'}</span>
                        </div>
                        <span className="fc-time">{timeAgo(conv.createdAt)}</span>
                      </div>

                      {/* Body text */}
                      <div className="fc-text" onClick={() => handleOpenTask(conv)}>
                        <MentionText text={conv.text || ''} />
                      </div>

                      {/* Action bar */}
                      <div className="fc-actions">
                        <button className="fc-action-btn like">
                          <FaHeart />
                        </button>
                        <button className="fc-action-btn">
                          <FaReply />
                          {conv.comments?.length > 0 && conv.comments.length}
                        </button>
                        <button className="fc-action-btn" onClick={() => handleOpenTask(conv)}>
                          <FaShare />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Reply threads */}
                  {hasReplies && (
                    <div className="fc-replies">
                      {conv.comments.map((c: any, i: number) => (
                        <div key={c.id} className="fc-reply-row">
                          <div className="fc-avatar-col">
                            <Avatar name={c.user?.name} avatarUrl={c.user?.avatarUrl} small />
                            {i < conv.comments.length - 1 && <div className="fc-thread-line" />}
                          </div>
                          <div className="fc-reply-content">
                            <div className="fc-meta">
                              <span className="fc-username" style={{ fontSize: '0.875rem' }}>
                                {c.user?.name || 'Unknown'}
                              </span>
                              <span className="fc-time">{timeAgo(c.createdAt)}</span>
                            </div>
                            <div className="fc-reply-text"><MentionText text={c.text || ''} /></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inline reply input */}
                  <div
                    className="fc-reply-input-row"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="fc-avatar-col" style={{ paddingTop: 2 }}>
                      <UserAvatar
                        name={currentUser?.name}
                        avatarUrl={currentUser?.avatarUrl}
                        size={32}
                        color="#9ca3af"
                        className="fc-avatar small"
                      />
                    </div>
                    <div className="fc-reply-input-col">
                      <textarea
                        className="fc-reply-textarea"
                        rows={1}
                        value={getDisplayText(replyText)}
                        placeholder={`Reply to ${conv.user?.name || 'this thread'}…`}
                        onChange={(e) => {
                          const displayVal = e.target.value;
                          const updated = updateTextWithMentions(replyText, displayVal);
                          setReplyTexts((p) => ({ ...p, [conv.id]: updated }));
                          handleMentionInput(updated, conv.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            handlePostReply(conv.id);
                          }
                        }}
                      />
                      {showMentionDropdown?.convId === conv.id && showMentionDropdown && (
                        <div className="fc-mention-drop">
                          {allUsers
                            .filter((u: any) => {
                              const pos = showMentionDropdown.position;
                              const afterAt = replyText.substring(pos).replace(/\[\[USER_ID:[^\]]+\]\]/g, '').toLowerCase();
                              return u.name.toLowerCase().includes(afterAt);
                            })
                            .slice(0, 5)
                            .map((u: any) => (
                              <div
                                key={u.id}
                                className="fc-mention-item"
                                onClick={() => {
                                  const pos = showMentionDropdown.position;
                                  const before = replyText.substring(0, pos - 1);
                                  const after = replyText.substring(pos).replace(/^@[^\s@]*/, '');
                                  const newText = `${before}@${u.name}[[USER_ID:${u.id}]] ${after}`;
                                  setReplyTexts((p) => ({ ...p, [conv.id]: newText }));
                                  setShowMentionDropdown(null);
                                }}
                              >
                                {u.name}
                              </div>
                            ))}
                        </div>
                      )}
                      <div className="fc-reply-footer">
                        <button
                          className="fc-post-btn"
                          disabled={!replyText.trim() || submittingReply[conv.id]}
                          onClick={() => handlePostReply(conv.id)}
                        >
                          {submittingReply[conv.id] ? 'Posting…' : 'Post'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TaskDetailSideModal
        isOpen={modalOpen}
        task={selectedTask}
        onClose={() => {
          setModalOpen(false);
          setSelectedTask(null);
          loadConversations();
        }}
        allUsers={allUsers}
        getProjectName={getProjectName}
        initialTab="conversation"
        onTaskUpdate={() => loadConversations()}
      />
    </div>
  );
};

export default ForumConversations;