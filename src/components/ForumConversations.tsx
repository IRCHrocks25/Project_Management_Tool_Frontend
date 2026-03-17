import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaSpinner, FaComment, FaFolder, FaHeart, FaReply, FaShare, FaEllipsisV, FaTrash, FaPlus, FaPaperPlane, FaCheck } from 'react-icons/fa';
import { taskService } from '../services/task.service';
import { projectService } from '../services/project.service';
import { authService } from '../services/auth.service';
import { clientUpdatesService } from '../services/client-updates.service';
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
    .fc-image-previews {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }
    .fc-attachment-img {
      max-width: 280px;
      max-height: 280px;
      width: auto;
      height: auto;
      object-fit: cover;
      border-radius: 10px;
      border: 1px solid ${T.border};
      cursor: pointer;
    }
    .fc-attachment-img:hover { opacity: 0.9; }

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

/** Split post content: strip "🖼️ Image: URL" lines into imageUrls, return rest for MentionText. */
function splitConversationContent(text: string): { textWithoutImageLines: string; imageUrls: string[] } {
  if (!text || !text.trim()) return { textWithoutImageLines: text || '', imageUrls: [] };
  const sep = '\n---\n';
  const idx = text.indexOf(sep);
  let before = text;
  let after = '';
  if (idx !== -1) {
    before = text.substring(0, idx).trimEnd();
    after = text.substring(idx + sep.length);
  }
  const imageUrls: string[] = [];
  const otherLines: string[] = [];
  // Match "🖼️ Image: url" or "Image: url" (any leading emoji/spaces)
  const imageLineRegex = /Image:\s*(https?:\/\/\S+)/;
  after.split(/\r?\n/).forEach((line) => {
    const m = line.match(imageLineRegex);
    if (m) {
      const url = (m[1] || '').replace(/[.,;:!?)]+$/, '').trim();
      if (url) imageUrls.push(url);
    } else if (line.trim()) otherLines.push(line);
  });
  const textWithoutImageLines =
    otherLines.length > 0 ? (before ? before + sep + otherLines.join('\n') : otherLines.join('\n')) : before;
  return { textWithoutImageLines, imageUrls };
}

const ACK_STORAGE_KEY = 'conversation_acknowledged';
const getAcknowledgedSet = (): Set<string> => {
  try {
    const raw = localStorage.getItem(ACK_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};
const setAcknowledged = (questionId: string, acknowledged: boolean) => {
  const set = getAcknowledgedSet();
  if (acknowledged) set.add(questionId);
  else set.delete(questionId);
  localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(Array.from(set)));
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
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(getAcknowledgedSet);
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [newPostProjectId, setNewPostProjectId] = useState('');
  const [newPostTaskId, setNewPostTaskId] = useState('');
  const [newPostText, setNewPostText] = useState('');
  const [newPostAttachProjectLink, setNewPostAttachProjectLink] = useState(true);
  const [newPostImageUrls, setNewPostImageUrls] = useState<string[]>([]);
  const [newPostLinks, setNewPostLinks] = useState<{ url: string; label: string }[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasksForNewPost, setTasksForNewPost] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [submittingNewPost, setSubmittingNewPost] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

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

  useEffect(() => {
    if (!showNewPostModal) return;
    setLoadingProjects(true);
    projectService
      .getAll()
      .then((p) => {
        const list = Array.isArray(p) ? p : (p && (p as any).data ? (p as any).data : []);
        setProjects(list || []);
      })
      .catch(() => setProjects([]))
      .finally(() => setLoadingProjects(false));
  }, [showNewPostModal]);

  useEffect(() => {
    if (!newPostProjectId) {
      setTasksForNewPost([]);
      setNewPostTaskId('');
      setLoadingTasks(false);
      return;
    }
    setLoadingTasks(true);
    setNewPostTaskId('');
    taskService
      .getAll(newPostProjectId, undefined, { all: true })
      .then((t) => {
        const list = Array.isArray(t) ? t : (t && (t as any).data ? (t as any).data : []);
        setTasksForNewPost(list || []);
      })
      .catch(() => setTasksForNewPost([]))
      .finally(() => setLoadingTasks(false));
  }, [newPostProjectId]);

  const handleAcknowledge = (convId: string) => {
    const next = new Set(acknowledgedIds);
    if (next.has(convId)) {
      next.delete(convId);
      setAcknowledged(convId, false);
    } else {
      next.add(convId);
      setAcknowledged(convId, true);
    }
    setAcknowledgedIds(next);
  };

  const buildNewPostText = useCallback(() => {
    let text = newPostText.trim();
    const parts: string[] = [];
    if (newPostAttachProjectLink && newPostProjectId) {
      const proj = projects.find((p: any) => p.id === newPostProjectId);
      const projectName = proj?.name || proj?.clientName || 'Project';
      const projectUrl = `${window.location.origin}/project/${newPostProjectId}`;
      parts.push(`📁 Project: [${projectName}](${projectUrl})`);
    }
    newPostImageUrls.forEach((url) => {
      if (url.trim()) parts.push(`🖼️ Image: ${url.trim()}`);
    });
    newPostLinks.forEach(({ url, label }) => {
      if (url.trim()) parts.push(`🔗 ${label.trim() || 'Link'}: ${url.trim()}`);
    });
    if (parts.length > 0) text += '\n\n---\n' + parts.join('\n');
    return text;
  }, [newPostText, newPostAttachProjectLink, newPostProjectId, projects, newPostImageUrls, newPostLinks]);

  const handleSubmitNewPost = async () => {
    if (!newPostTaskId?.trim()) {
      alert('Please select a task to attach the post to.');
      return;
    }
    const text = buildNewPostText();
    if (!text.trim()) {
      alert('Please enter some text for your post.');
      return;
    }
    setSubmittingNewPost(true);
    try {
      await taskService.createQuestion(newPostTaskId, text, extractMentions(text));
      setShowNewPostModal(false);
      setShowMentionDropdown(null);
      setNewPostProjectId('');
      setNewPostTaskId('');
      setNewPostText('');
      setNewPostImageUrls([]);
      setNewPostLinks([]);
      await loadConversations();
    } catch (err: any) {
      alert(`Failed to create post: ${err?.response?.data?.message || err?.message || 'Unknown error'}`);
    } finally {
      setSubmittingNewPost(false);
    }
  };

  const handleNewPostImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await clientUpdatesService.uploadImage(file);
      setNewPostImageUrls((prev) => [...prev, url]);
    } catch {
      alert('Failed to upload image.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

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

  const NEW_POST_MENTION_KEY = 'newpost';

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
            Conversation
          </div>
          <button className="fc-back-btn" onClick={() => navigate('/dashboard')}>
            <FaArrowLeft style={{ fontSize: '0.8rem' }} />
            Dashboard
          </button>
        </div>
      </nav>

      <div className="fc-body">
        {/* Header */}
        <div className="fc-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1>Conversations</h1>
            <p>All task discussions, in one place.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewPostModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: T.accent,
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'opacity 0.15s',
            }}
          >
            <FaPlus style={{ fontSize: '0.875rem' }} />
            Add post
          </button>
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

                      {/* Body text + image previews */}
                      <div className="fc-text" onClick={() => handleOpenTask(conv)}>
                        {(() => {
                          const { textWithoutImageLines, imageUrls } = splitConversationContent(conv.text || '');
                          return (
                            <>
                              <MentionText text={textWithoutImageLines} />
                              {imageUrls.length > 0 && (
                                <div className="fc-image-previews" onClick={(e) => e.stopPropagation()}>
                                  {imageUrls.map((url) => (
                                    <a
                                      key={url}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <img
                                        src={url}
                                        alt="Attachment"
                                        className="fc-attachment-img"
                                        loading="lazy"
                                      />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>

                      {/* Action bar */}
                      <div className="fc-actions">
                        <button
                          type="button"
                          className="fc-action-btn"
                          onClick={() => handleAcknowledge(conv.id)}
                          style={acknowledgedIds.has(conv.id) ? { color: T.accent, fontWeight: 600 } : undefined}
                          title={acknowledgedIds.has(conv.id) ? 'You acknowledged this' : 'Mark as seen'}
                        >
                          <FaCheck />
                        </button>
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
                            <div className="fc-reply-text">
                              {(() => {
                                const { textWithoutImageLines, imageUrls } = splitConversationContent(c.text || '');
                                return (
                                  <>
                                    <MentionText text={textWithoutImageLines} />
                                    {imageUrls.length > 0 && (
                                      <div className="fc-image-previews" style={{ marginTop: 6 }}>
                                        {imageUrls.map((url) => (
                                          <a
                                            key={url}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <img
                                              src={url}
                                              alt="Attachment"
                                              className="fc-attachment-img"
                                              style={{ maxWidth: 200, maxHeight: 200 }}
                                              loading="lazy"
                                            />
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
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

      {/* New Post modal */}
      {showNewPostModal && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => {
              if (!submittingNewPost) {
                setShowNewPostModal(false);
                setShowMentionDropdown(null);
              }
            }}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-post-title"
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100%',
              maxWidth: 480,
              maxHeight: '90vh',
              overflow: 'auto',
              background: T.surface,
              borderRadius: 16,
              boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
              zIndex: 1001,
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="new-post-title" style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 20, color: T.textPrimary }}>
              Add post
            </h2>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>
                Project
              </label>
              <select
                value={newPostProjectId}
                onChange={(e) => setNewPostProjectId(e.target.value)}
                disabled={loadingProjects}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  fontFamily: 'inherit',
                  fontSize: '0.9375rem',
                  color: T.textPrimary,
                  background: T.surface,
                }}
              >
                <option value="">
                  {loadingProjects ? 'Loading projects…' : 'Select project…'}
                </option>
                {!loadingProjects && projects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.clientName ?? p.name ?? p.id}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>
                Task
              </label>
              <select
                value={newPostTaskId}
                onChange={(e) => setNewPostTaskId(e.target.value)}
                disabled={!newPostProjectId || loadingTasks}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  fontFamily: 'inherit',
                  fontSize: '0.9375rem',
                  color: T.textPrimary,
                  background: T.surface,
                }}
              >
                <option value="">
                  {!newPostProjectId
                    ? 'Select a project first'
                    : loadingTasks
                      ? 'Loading tasks…'
                      : 'Select task…'}
                </option>
                {!loadingTasks && tasksForNewPost.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.title ?? t.name ?? t.id}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 14, position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>
                Message <span style={{ fontWeight: 400, color: T.textTertiary }}>(type @ to mention someone)</span>
              </label>
              <textarea
                value={getDisplayText(newPostText)}
                onChange={(e) => {
                  const displayVal = e.target.value;
                  const updated = updateTextWithMentions(newPostText, displayVal);
                  setNewPostText(updated);
                  handleMentionInput(updated, NEW_POST_MENTION_KEY);
                }}
                placeholder="Write your post… (use @ to mention)"
                rows={4}
                style={{
                  width: '100%',
                  padding: 12,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  fontFamily: 'inherit',
                  fontSize: '0.9375rem',
                  color: T.textPrimary,
                  resize: 'vertical',
                  minHeight: 80,
                }}
              />
              {showMentionDropdown?.convId === NEW_POST_MENTION_KEY && showMentionDropdown && (
                <div className="fc-mention-drop">
                  {allUsers
                    .filter((u: any) => {
                      const pos = showMentionDropdown.position;
                      const afterAt = newPostText.substring(pos).replace(/\[\[USER_ID:[^\]]+\]\]/g, '').toLowerCase();
                      return u.name.toLowerCase().includes(afterAt);
                    })
                    .slice(0, 5)
                    .map((u: any) => (
                      <div
                        key={u.id}
                        className="fc-mention-item"
                        onClick={() => {
                          const pos = showMentionDropdown.position;
                          const before = newPostText.substring(0, pos - 1);
                          const after = newPostText.substring(pos).replace(/^@[^\s@]*/, '');
                          const newText = `${before}@${u.name}[[USER_ID:${u.id}]] ${after}`;
                          setNewPostText(newText);
                          setShowMentionDropdown(null);
                        }}
                      >
                        {u.name}
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', color: T.textSecondary }}>
                <input
                  type="checkbox"
                  checked={newPostAttachProjectLink}
                  onChange={(e) => setNewPostAttachProjectLink(e.target.checked)}
                  disabled={!newPostProjectId}
                />
                Attach project link
              </label>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>
                Attach image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleNewPostImageUpload}
                disabled={uploadingImage}
                style={{ fontSize: '0.875rem' }}
              />
              {uploadingImage && <span style={{ marginLeft: 8, fontSize: '0.8125rem', color: T.textTertiary }}>Uploading…</span>}
              {newPostImageUrls.length > 0 && (
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  {newPostImageUrls.map((url, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: T.accent, fontSize: '0.8125rem' }}>{url.slice(0, 50)}…</a>
                      <button
                        type="button"
                        onClick={() => setNewPostImageUrls((prev) => prev.filter((_, j) => j !== i))}
                        style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: T.danger, fontSize: '0.75rem' }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: T.textSecondary }}>Attach link(s)</span>
                <button
                  type="button"
                  onClick={() => setNewPostLinks((prev) => [...prev, { url: '', label: '' }])}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: T.accent,
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    fontFamily: 'inherit',
                  }}
                >
                  + Add link
                </button>
              </div>
              {newPostLinks.map((link, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Label (optional)"
                    value={link.label}
                    onChange={(e) => setNewPostLinks((prev) => prev.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)))}
                    style={{
                      flex: '0 0 100px',
                      padding: '8px 10px',
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      fontFamily: 'inherit',
                      fontSize: '0.875rem',
                    }}
                  />
                  <input
                    type="url"
                    placeholder="URL"
                    value={link.url}
                    onChange={(e) => setNewPostLinks((prev) => prev.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)))}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      fontFamily: 'inherit',
                      fontSize: '0.875rem',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setNewPostLinks((prev) => prev.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.danger, padding: 4 }}
                    title="Remove link"
                  >
                    <FaTrash style={{ fontSize: '0.75rem' }} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="fc-back-btn"
                onClick={() => {
                  if (!submittingNewPost) {
                    setShowNewPostModal(false);
                    setShowMentionDropdown(null);
                  }
                }}
                disabled={submittingNewPost}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitNewPost}
                disabled={submittingNewPost || !newPostTaskId?.trim() || !newPostText.trim()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  background: submittingNewPost ? T.textTertiary : T.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: submittingNewPost ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {submittingNewPost ? (
                  <>
                    <FaSpinner className="fc-spin" style={{ fontSize: '0.875rem' }} />
                    Posting…
                  </>
                ) : (
                  <>
                    <FaPaperPlane style={{ fontSize: '0.875rem' }} />
                    Post
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}

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