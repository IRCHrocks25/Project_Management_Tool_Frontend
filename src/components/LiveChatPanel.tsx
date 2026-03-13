import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTimes, FaPaperPlane, FaSearch, FaSpinner, FaLink, FaPaperclip, FaImage, FaEllipsisV, FaPlus } from 'react-icons/fa';
import { chatService, ChatRoom, ChatMessage } from '../services/chat.service';
import { authService } from '../services/auth.service';
import { taskService } from '../services/task.service';
import { projectService } from '../services/project.service';
import { clientUpdatesService } from '../services/client-updates.service';

// ── Regex constants ──────────────────────────────────────────────────────────
const TASK_LINK_REGEX = /\[\[TASK:([^|]+)\|([^|]+)(?:\|([^\]]*))?\]\]/g;
const LINK_REGEX = /\[\[LINK:(https?:\/\/[^\]]+)\]\]/g;
const IMAGE_REGEX = /\[\[IMAGE:(https?:\/\/[^\]]+)\]\]/g;

const ROLE_TO_TASK_TYPE: Record<string, string | null> = {
  'Copy Writing': 'Copy', 'Designer': 'Design', 'Developer': 'Dev',
  'AI Developer': 'AI', 'Social Media': 'Social Media', 'CRM': 'CRM',
  'SEO/GEO': 'SEO', 'Project Manager': null, 'FOUNDER/CEO': null,
};

// ── Render helpers ───────────────────────────────────────────────────────────
function renderMessageContent(
  content: string, accentColor: string,
  onTaskClick?: (projectId: string, taskId: string) => void, isSent?: boolean
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const allPatterns = [
    { regex: TASK_LINK_REGEX, type: 'task' as const },
    { regex: IMAGE_REGEX, type: 'image' as const },
    { regex: LINK_REGEX, type: 'link' as const },
  ];
  const matches: Array<{ index: number; end: number; type: 'task' | 'image' | 'link'; data: RegExpExecArray }> = [];
  for (const { regex, type } of allPatterns) {
    const re = new RegExp(regex.source, 'g'); let m;
    while ((m = re.exec(content)) !== null) matches.push({ index: m.index, end: m.index + m[0].length, type, data: m });
  }
  matches.sort((a, b) => a.index - b.index);
  let lastIndex = 0;
  for (const { index, end, type, data } of matches) {
    if (index > lastIndex) parts.push(content.substring(lastIndex, index));
    if (type === 'task') {
      const [, taskId, projectId, title] = data;
      const linkColor = isSent ? 'rgba(255,255,255,0.95)' : accentColor;
      parts.push(
        <a key={`task-${taskId}-${index}`} href={`/project/${projectId}?task=${taskId}`}
          onClick={(e) => { e.preventDefault(); if (onTaskClick) onTaskClick(projectId, taskId); else window.location.href = `/project/${projectId}?task=${taskId}`; }}
          style={{ color: linkColor, fontWeight: 600, textDecoration: 'underline' }}>
          📎 {title && title.trim() ? title.trim() : 'View task'}
        </a>
      );
    } else if (type === 'image') {
      const url = data[1];
      parts.push(<a key={`img-${index}`} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="Shared" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, display: 'block', marginTop: 4 }} /></a>);
    } else if (type === 'link') {
      const url = data[1];
      const display = url.length > 50 ? url.substring(0, 47) + '...' : url;
      const linkColor = isSent ? 'rgba(255,255,255,0.95)' : accentColor;
      parts.push(<a key={`link-${index}`} href={url} target="_blank" rel="noopener noreferrer" style={{ color: linkColor, textDecoration: 'underline' }}>🔗 {display}</a>);
    }
    lastIndex = end;
  }
  if (lastIndex < content.length) parts.push(content.substring(lastIndex));
  return parts.length > 0 ? <>{parts}</> : content;
}

// ── Styles ───────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  .lcp-overlay {
    position: fixed;
    inset: 0;
    z-index: 999;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
    padding: 0 20px 20px 0;
    pointer-events: none;
  }

  .lcp-panel {
    --bg: #ffffff;
    --surface: #f8f9fb;
    --surface2: #f1f4f8;
    --border: #e8ecf0;
    --border-strong: #d0d7de;
    --text-primary: #0f1923;
    --text-secondary: #4a5568;
    --text-muted: #94a3b8;
    --sent-bg: var(--accent, #2563eb);
    --received-bg: #f1f4f8;

    pointer-events: all;
    font-family: 'Instrument Sans', sans-serif;
    width: 760px;
    height: 580px;
    background: var(--bg);
    border-radius: 16px;
    border: 1px solid var(--border);
    box-shadow: 0 24px 64px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: lcpIn 0.2s ease;
  }
  @keyframes lcpIn {
    from { opacity: 0; transform: translateY(12px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* ── Top header ── */
  .lcp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    flex-shrink: 0;
  }
  .lcp-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.01em;
  }
  .lcp-close {
    width: 28px; height: 28px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 11px;
    transition: all 0.12s;
  }
  .lcp-close:hover { background: #fff1f2; border-color: #fecdd3; color: #dc2626; }

  /* ── Body ── */
  .lcp-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* ── Sidebar ── */
  .lcp-sidebar {
    width: 220px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface);
  }
  .lcp-sidebar-top {
    padding: 12px;
    border-bottom: 1px solid var(--border);
  }
  .lcp-new-btn {
    width: 100%;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px dashed var(--border-strong);
    background: transparent;
    font-family: 'Instrument Sans', sans-serif;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.12s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .lcp-new-btn:hover {
    border-color: var(--accent, #2563eb);
    color: var(--accent, #2563eb);
    background: rgba(37,99,235,0.05);
  }

  /* Room list */
  .lcp-room-list { overflow-y: auto; flex: 1; }
  .lcp-room-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    cursor: pointer;
    transition: background 0.1s;
    border-bottom: 1px solid var(--border);
  }
  .lcp-room-item:last-child { border-bottom: none; }
  .lcp-room-item:hover { background: var(--surface2); }
  .lcp-room-item.selected { background: white; border-right: 2px solid var(--accent, #2563eb); }
  .lcp-room-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lcp-room-preview {
    font-size: 11.5px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 1px;
  }

  /* Avatar */
  .lcp-avatar {
    width: 32px; height: 32px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700;
    flex-shrink: 0;
    color: white;
  }
  .lcp-avatar-sm {
    width: 26px; height: 26px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700;
    flex-shrink: 0;
    color: white;
  }

  /* User search */
  .lcp-search-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: white;
  }
  .lcp-search-icon { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
  .lcp-search-input {
    flex: 1;
    border: none;
    outline: none;
    font-family: 'Instrument Sans', sans-serif;
    font-size: 13px;
    color: var(--text-primary);
    background: transparent;
  }
  .lcp-search-input::placeholder { color: var(--text-muted); }

  .lcp-user-list { overflow-y: auto; flex: 1; }
  .lcp-user-item {
    display: flex; align-items: center; gap: 9px;
    padding: 9px 12px;
    cursor: pointer; border-bottom: 1px solid var(--border);
    transition: background 0.1s;
    font-size: 13px; color: var(--text-secondary);
  }
  .lcp-user-item:hover { background: var(--surface2); }

  .lcp-back-btn {
    padding: 9px 12px;
    border: none; background: transparent;
    font-family: 'Instrument Sans', sans-serif;
    font-size: 12px; color: var(--text-muted);
    cursor: pointer; text-align: left;
    border-top: 1px solid var(--border);
    transition: color 0.12s;
  }
  .lcp-back-btn:hover { color: var(--text-secondary); }

  /* ── Main chat area ── */
  .lcp-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
  }

  .lcp-chat-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    background: var(--surface);
  }
  .lcp-chat-header-info { flex: 1; min-width: 0; }
  .lcp-chat-name {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lcp-chat-role {
    font-size: 11.5px;
    color: var(--text-muted);
    margin-top: 1px;
  }
  .lcp-files-btn {
    width: 30px; height: 30px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 12px;
    transition: all 0.12s;
    flex-shrink: 0;
  }
  .lcp-files-btn:hover { background: var(--surface2); border-color: var(--border-strong); color: var(--text-secondary); }

  /* Files panel */
  .lcp-files-panel {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    width: 280px;
    background: white;
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    z-index: 100;
    overflow: hidden;
  }
  .lcp-files-title {
    padding: 10px 14px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .lcp-files-list { max-height: 240px; overflow-y: auto; }
  .lcp-file-item {
    display: flex; align-items: center; gap: 9px;
    padding: 9px 14px;
    border-bottom: 1px solid var(--border);
    text-decoration: none;
    color: var(--text-secondary);
    font-size: 12.5px;
    transition: background 0.1s;
    cursor: pointer;
  }
  .lcp-file-item:hover { background: var(--surface); }
  .lcp-file-item:last-child { border-bottom: none; }
  .lcp-file-icon { font-size: 13px; flex-shrink: 0; }
  .lcp-file-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
  .lcp-file-thumb { width: 28px; height: 28px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
  .lcp-files-empty { padding: 20px 14px; font-size: 12.5px; color: var(--text-muted); text-align: center; }

  /* Messages */
  .lcp-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  .lcp-messages::-webkit-scrollbar { width: 4px; }
  .lcp-messages::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }

  .lcp-msg { display: flex; }
  .lcp-msg.sent  { justify-content: flex-end; }
  .lcp-msg.received { justify-content: flex-start; }

  .lcp-bubble {
    max-width: 72%;
    padding: 9px 13px;
    border-radius: 12px;
    font-size: 13.5px;
    line-height: 1.45;
    word-break: break-word;
  }
  .lcp-msg.sent .lcp-bubble {
    background: var(--sent-bg);
    color: white;
    border-bottom-right-radius: 4px;
  }
  .lcp-msg.received .lcp-bubble {
    background: var(--received-bg);
    color: var(--text-primary);
    border-bottom-left-radius: 4px;
  }
  .lcp-msg-sender {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 3px;
  }
  .lcp-msg-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  }
  .lcp-msg-time {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    opacity: 0.6;
  }
  .lcp-msg.sent .lcp-msg-time { color: rgba(255,255,255,0.8); }
  .lcp-msg.received .lcp-msg-time { color: var(--text-muted); }
  .lcp-msg-seen {
    font-size: 10px;
    font-weight: 600;
    color: rgba(255,255,255,0.75);
  }

  /* Input area */
  .lcp-input-area {
    padding: 10px 14px 12px;
    border-top: 1px solid var(--border);
    background: var(--bg);
    flex-shrink: 0;
  }
  .lcp-attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }
  .lcp-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px 3px 8px;
    border-radius: 20px;
    font-size: 11.5px;
    font-weight: 500;
    background: var(--accent-light, #eff6ff);
    border: 1px solid var(--accent-border, #bfdbfe);
    color: var(--accent, #2563eb);
  }
  .lcp-chip-remove {
    background: none; border: none;
    display: flex; align-items: center;
    color: inherit; cursor: pointer; opacity: 0.7;
    padding: 0; font-size: 9px;
    transition: opacity 0.12s;
  }
  .lcp-chip-remove:hover { opacity: 1; }
  .lcp-attach-img-wrap { position: relative; display: inline-block; }
  .lcp-attach-img { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border); display: block; }
  .lcp-attach-img-remove {
    position: absolute; top: -5px; right: -5px;
    width: 16px; height: 16px; border-radius: 50%;
    background: #dc2626; color: white; border: none;
    display: flex; align-items: center; justify-content: center;
    font-size: 8px; cursor: pointer;
  }

  .lcp-input-row {
    display: flex;
    align-items: center;
    gap: 7px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 6px 8px 6px 10px;
    transition: border-color 0.13s, box-shadow 0.13s;
  }
  .lcp-input-row:focus-within {
    border-color: var(--accent, #2563eb);
    box-shadow: 0 0 0 3px rgba(37,99,235,0.08);
  }
  .lcp-icon-btn {
    width: 28px; height: 28px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 12px;
    transition: all 0.12s;
    flex-shrink: 0;
  }
  .lcp-icon-btn:hover { background: var(--surface2); color: var(--text-secondary); }
  .lcp-text-input {
    flex: 1;
    border: none; outline: none;
    font-family: 'Instrument Sans', sans-serif;
    font-size: 13.5px;
    color: var(--text-primary);
    background: transparent;
    min-width: 0;
  }
  .lcp-text-input::placeholder { color: var(--text-muted); }
  .lcp-send-btn {
    width: 32px; height: 32px;
    border-radius: 8px;
    border: none;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; color: white;
    cursor: pointer;
    transition: opacity 0.12s, background 0.12s;
    flex-shrink: 0;
  }
  .lcp-send-btn:disabled { cursor: not-allowed; opacity: 0.5; }

  /* Attach menu */
  .lcp-attach-menu {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 0;
    background: white;
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    z-index: 100;
    width: 260px;
    overflow: hidden;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .lcp-attach-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 5px;
  }
  .lcp-link-row { display: flex; gap: 6px; }
  .lcp-link-input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 7px;
    font-family: 'Instrument Sans', sans-serif;
    font-size: 12.5px;
    outline: none;
    color: var(--text-primary);
    transition: border-color 0.12s;
  }
  .lcp-link-input:focus { border-color: var(--accent, #2563eb); }
  .lcp-link-add-btn {
    padding: 6px 12px;
    border-radius: 7px;
    border: none;
    color: white;
    font-family: 'Instrument Sans', sans-serif;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .lcp-file-input { font-size: 12px; color: var(--text-secondary); width: 100%; }
  .lcp-uploading { font-size: 11.5px; color: var(--text-muted); font-style: italic; }

  /* Empty / loading */
  .lcp-empty-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%; gap: 8px; padding: 24px;
    color: var(--text-muted); text-align: center;
    font-size: 13px;
  }
  .lcp-empty-icon {
    width: 40px; height: 40px; border-radius: 12px;
    background: var(--surface2); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; color: var(--text-muted); margin-bottom: 4px;
  }
  .lcp-loading {
    display: flex; align-items: center; justify-content: center;
    gap: 8px; padding: 24px;
    font-size: 13px; color: var(--text-muted);
  }
  .lcp-empty { padding: 16px; text-align: center; font-size: 12.5px; color: var(--text-muted); }

  /* Task picker overlay */
  .lcp-picker-overlay {
    position: fixed; inset: 0;
    background: rgba(15,25,35,0.35);
    backdrop-filter: blur(3px);
    z-index: 1100;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
  }
  .lcp-picker {
    font-family: 'Instrument Sans', sans-serif;
    background: white;
    border-radius: 14px;
    border: 1px solid var(--border, #e8ecf0);
    box-shadow: 0 24px 64px rgba(0,0,0,0.14);
    width: 420px;
    max-height: 500px;
    display: flex; flex-direction: column;
    overflow: hidden;
    animation: lcpIn 0.18s ease;
  }
  .lcp-picker-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border, #e8ecf0);
    flex-shrink: 0;
  }
  .lcp-picker-title {
    font-size: 14px; font-weight: 700;
    color: #0f1923; margin: 0;
  }
  .lcp-task-list { overflow-y: auto; flex: 1; }
  .lcp-task-item {
    padding: 10px 16px;
    cursor: pointer;
    border-bottom: 1px solid var(--border, #e8ecf0);
    transition: background 0.1s;
  }
  .lcp-task-item:hover { background: #f8f9fb; }
  .lcp-task-item:last-child { border-bottom: none; }
  .lcp-task-name { font-size: 13px; font-weight: 500; color: #0f1923; }
  .lcp-task-project { font-size: 11.5px; color: #94a3b8; margin-top: 2px; }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 0.8s linear infinite; }
`;

// ── Component ────────────────────────────────────────────────────────────────
interface LiveChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor?: string;
}

const LiveChatPanel: React.FC<LiveChatPanelProps> = ({ isOpen, onClose, accentColor = '#2563eb' }) => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [otherUserLastReadAt, setOtherUserLastReadAt] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessageText, setNewMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const [attachedTasks, setAttachedTasks] = useState<Array<{ taskId: string; projectId: string; title: string }>>([]);
  const [attachmentLinks, setAttachmentLinks] = useState<string[]>([]);
  const [attachmentImageUrls, setAttachmentImageUrls] = useState<string[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [linkInputValue, setLinkInputValue] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showFilesPanel, setShowFilesPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const filesMenuRef = useRef<HTMLDivElement>(null);
  const currentUser = authService.getUser();

  const collectedFiles = useMemo(() => {
    const links: { url: string; createdAt?: string }[] = [];
    const images: { url: string; createdAt?: string }[] = [];
    const taskRefs: { taskId: string; projectId: string; title: string; createdAt?: string }[] = [];
    const seenUrls = new Set<string>(); const seenTasks = new Set<string>();
    for (const msg of messages) {
      let m: RegExpExecArray | null;
      const taskRe = new RegExp(TASK_LINK_REGEX.source, 'g');
      while ((m = taskRe.exec(msg.content)) !== null) {
        const [, taskId, projectId, title] = m;
        const key = `${taskId}-${projectId}`;
        if (!seenTasks.has(key)) { seenTasks.add(key); taskRefs.push({ taskId, projectId, title: (title || '').trim(), createdAt: msg.createdAt }); }
      }
      const linkRe = new RegExp(LINK_REGEX.source, 'g');
      while ((m = linkRe.exec(msg.content)) !== null) { const url = m[1]; if (!seenUrls.has(url)) { seenUrls.add(url); links.push({ url, createdAt: msg.createdAt }); } }
      const imgRe = new RegExp(IMAGE_REGEX.source, 'g');
      while ((m = imgRe.exec(msg.content)) !== null) { const url = m[1]; if (!seenUrls.has(url)) { seenUrls.add(url); images.push({ url, createdAt: msg.createdAt }); } }
    }
    return { links, images, taskRefs };
  }, [messages]);

  const loadRooms = useCallback(async () => {
    try { setLoadingRooms(true); const data = await chatService.getRooms(); setRooms(data); }
    catch (err) { console.error('Failed to load chat rooms:', err); setRooms([]); }
    finally { setLoadingRooms(false); }
  }, []);

  const loadMessages = useCallback(async (roomId: string) => {
    if (!roomId) return;
    try {
      setLoadingMessages(true);
      const { messages: msgs, otherUserLastReadAt: readAt } = await chatService.getMessages(roomId);
      setMessages(msgs); setOtherUserLastReadAt(readAt);
      chatService.joinRoom(roomId); chatService.markRoomRead(roomId);
    } catch (err) { console.error('Failed to load messages:', err); setMessages([]); setOtherUserLastReadAt(null); }
    finally { setLoadingMessages(false); }
  }, []);

  const loadUsers = useCallback(async () => {
    try { const data = await authService.getAllUsers(); setUsers(data.filter((u: any) => u.id !== currentUser?.id)); }
    catch (err) { console.error('Failed to load users:', err); }
  }, [currentUser?.id]);

  const loadTasksAndProjects = useCallback(async () => {
    try {
      setLoadingTasks(true);
      const departmentTaskType = currentUser?.role ? ROLE_TO_TASK_TYPE[currentUser.role] ?? null : null;
      const [tasksData, projectsData] = await Promise.all([taskService.getAll(undefined, undefined, { all: true, limit: 300 }), projectService.getAll()]);
      const allTasks = tasksData || [];
      setTasks(departmentTaskType !== null ? allTasks.filter((t: any) => t.type === departmentTaskType) : allTasks);
      setProjects(projectsData || []);
    } catch (err) { console.error('Failed to load tasks:', err); setTasks([]); setProjects([]); }
    finally { setLoadingTasks(false); }
  }, [currentUser?.role]);

  useEffect(() => { if (isOpen) { loadRooms(); chatService.connectSocket(); } }, [isOpen, loadRooms]);
  useEffect(() => { if (isOpen && showNewChat) loadUsers(); }, [isOpen, showNewChat, loadUsers]);
  useEffect(() => { if (isOpen && showTaskPicker) loadTasksAndProjects(); }, [isOpen, showTaskPicker, loadTasksAndProjects]);

  useEffect(() => {
    if (!showAttachMenu) return;
    const h = (e: MouseEvent) => { if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) setShowAttachMenu(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [showAttachMenu]);

  useEffect(() => {
    if (!showFilesPanel) return;
    const h = (e: MouseEvent) => { if (filesMenuRef.current && !filesMenuRef.current.contains(e.target as Node)) setShowFilesPanel(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [showFilesPanel]);

  useEffect(() => {
    if (!selectedRoom) { setMessages([]); setOtherUserLastReadAt(null); return; }
    loadMessages(selectedRoom.id);
    const unsub = chatService.onNewMessage((msg: ChatMessage) => {
      if (msg.roomId === selectedRoom.id) {
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
        setRooms((prev) => prev.map((r) => r.id === selectedRoom.id ? { ...r, lastMessage: { id: msg.id, content: msg.content, senderId: msg.senderId, senderName: msg.senderName, createdAt: msg.createdAt }, updatedAt: msg.createdAt } : r));
      }
    });
    const unsubRead = chatService.onRoomRead((data) => {
      if (data.roomId === selectedRoom.id && data.userId !== currentUser?.id) {
        setOtherUserLastReadAt(data.lastReadAt);
        setRooms((prev) => prev.map((r) => r.id === selectedRoom.id ? { ...r, otherUserLastReadAt: data.lastReadAt } : r));
      }
    });
    return () => { chatService.leaveRoom(selectedRoom.id); if (typeof unsub === 'function') unsub(); if (typeof unsubRead === 'function') unsubRead(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom?.id, loadMessages]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSelectRoom = (room: ChatRoom) => {
    setSelectedRoom(room); setShowNewChat(false);
    setAttachedTasks([]); setAttachmentLinks([]); setAttachmentImageUrls([]);
    setShowAttachMenu(false); setShowFilesPanel(false);
  };

  const handleStartNewChat = async (otherUser: any) => {
    try {
      const room = await chatService.getOrCreateRoom(otherUser.id);
      setRooms((prev) => prev.some((r) => r.id === room.id) ? prev : [room, ...prev]);
      setSelectedRoom(room); setShowNewChat(false); setUserSearch('');
    } catch (err) { console.error('Failed to start chat:', err); alert('Failed to start conversation.'); }
  };

  const handleSendMessage = async () => {
    const textPart = newMessageText.trim();
    const taskLinks = attachedTasks.map((t) => `[[TASK:${t.taskId}|${t.projectId}|${t.title.replace(/\|/g, ' ')}]]`).join(' ');
    const linkParts = attachmentLinks.filter((u) => u.startsWith('http://') || u.startsWith('https://')).map((u) => `[[LINK:${u}]]`).join(' ');
    const imageParts = attachmentImageUrls.map((u) => `[[IMAGE:${u}]]`).join(' ');
    const fullContent = [textPart, taskLinks, linkParts, imageParts].filter(Boolean).join(' ');
    if (!selectedRoom || !fullContent || sending) return;
    setSending(true);
    try { chatService.sendMessage(selectedRoom.id, fullContent); setNewMessageText(''); setAttachedTasks([]); setAttachmentLinks([]); setAttachmentImageUrls([]); setShowAttachMenu(false); }
    catch (err) { console.error('Failed to send message:', err); }
    finally { setSending(false); }
  };

  const addLink = () => {
    const url = linkInputValue.trim();
    if (!url) return;
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    setAttachmentLinks((prev) => prev.includes(normalized) ? prev : [...prev, normalized]);
    setLinkInputValue(''); setShowAttachMenu(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploadingImage(true);
    try { const url = await clientUpdatesService.uploadImage(file); setAttachmentImageUrls((prev) => [...prev, url]); setShowAttachMenu(false); }
    catch (err) { console.error('Failed to upload image:', err); alert('Failed to upload image.'); }
    finally { setUploadingImage(false); e.target.value = ''; }
  };

  const formatTime = (d: string) => {
    const date = new Date(d); const now = new Date(); const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const filteredUsers = users.filter((u) => u.name?.toLowerCase().includes(userSearch.toLowerCase()));

  const projectNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p: any) => { map[p.id] = p.clientName || 'Unknown Project'; });
    return map;
  }, [projects]);

  const filteredTasks = useMemo(() => {
    const search = taskSearch.toLowerCase();
    return tasks.filter((t: any) => (t.title || '').toLowerCase().includes(search) || (projectNameMap[t.projectId] || '').toLowerCase().includes(search));
  }, [tasks, taskSearch, projectNameMap]);

  const handleInsertTask = (task: any) => {
    const title = (task.title || 'Task').replace(/\|/g, ' ');
    setAttachedTasks((prev) => prev.some((t) => t.taskId === task.id) ? prev : [...prev, { taskId: task.id, projectId: task.projectId, title }]);
    setShowTaskPicker(false); setTaskSearch('');
  };

  const handleTaskLinkClick = (projectId: string, taskId: string) => { onClose(); navigate(`/project/${projectId}?task=${taskId}`); };

  const hasContent = !!(newMessageText.trim() || attachedTasks.length || attachmentLinks.length || attachmentImageUrls.length);

  const getInitial = (name?: string) => name?.charAt(0).toUpperCase() || '?';

  // Avatar color from name hash
  const avatarColor = (name?: string) => {
    if (!name) return accentColor;
    const colors = ['#2563eb', '#7c3aed', '#db2777', '#d97706', '#16a34a', '#0891b2'];
    return colors[name.charCodeAt(0) % colors.length];
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{STYLES}</style>
      <div className="lcp-overlay" onClick={onClose}>
        <div
          className="lcp-panel"
          onClick={(e) => e.stopPropagation()}
          style={{ '--accent': accentColor } as React.CSSProperties}
        >
          {/* Header */}
          <div className="lcp-header">
            <h2 className="lcp-title">Live Chat</h2>
            <button className="lcp-close" onClick={onClose}><FaTimes /></button>
          </div>

          <div className="lcp-body">
            {/* Sidebar */}
            <div className="lcp-sidebar">
              <div className="lcp-sidebar-top">
                <button className="lcp-new-btn" onClick={() => setShowNewChat(true)}>
                  <FaPlus style={{ fontSize: 10 }} /> New Chat
                </button>
              </div>

              {showNewChat ? (
                <>
                  <div className="lcp-search-wrap">
                    <FaSearch className="lcp-search-icon" />
                    <input type="text" className="lcp-search-input" placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} autoFocus />
                  </div>
                  <div className="lcp-user-list">
                    {filteredUsers.slice(0, 10).map((u) => (
                      <div key={u.id} className="lcp-user-item" onClick={() => handleStartNewChat(u)}>
                        <div className="lcp-avatar-sm" style={{ background: avatarColor(u.name) }}>{getInitial(u.name)}</div>
                        <span>{u.name}</span>
                      </div>
                    ))}
                    {filteredUsers.length === 0 && <p className="lcp-empty">No users found</p>}
                  </div>
                  <button className="lcp-back-btn" onClick={() => { setShowNewChat(false); setUserSearch(''); }}>← Back</button>
                </>
              ) : loadingRooms ? (
                <div className="lcp-loading"><FaSpinner className="spin" /> Loading…</div>
              ) : rooms.length === 0 ? (
                <div className="lcp-empty-state">
                  <div className="lcp-empty-icon">💬</div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#4a5568' }}>No conversations yet</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Start a new chat above</p>
                </div>
              ) : (
                <div className="lcp-room-list">
                  {rooms.map((room) => (
                    <div key={room.id} className={`lcp-room-item${selectedRoom?.id === room.id ? ' selected' : ''}`} onClick={() => handleSelectRoom(room)}>
                      <div className="lcp-avatar" style={{ background: avatarColor(room.otherUser?.name) }}>{getInitial(room.otherUser?.name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="lcp-room-name">{room.name}</div>
                        {room.lastMessage && (
                          <div className="lcp-room-preview">
                            {room.lastMessage.content.replace(/\[\[TASK:[^\]]+\]\]/g, '📎 Task').replace(/\s+/g, ' ').trim().substring(0, 36)}{room.lastMessage.content.length > 36 ? '…' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Main */}
            <div className="lcp-main">
              {!selectedRoom ? (
                <div className="lcp-empty-state">
                  <div className="lcp-empty-icon">💬</div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#4a5568' }}>Select a conversation</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>or start a new chat</p>
                </div>
              ) : (
                <>
                  {/* Chat header */}
                  <div className="lcp-chat-header">
                    <div className="lcp-avatar" style={{ background: avatarColor(selectedRoom.otherUser?.name) }}>{getInitial(selectedRoom.otherUser?.name)}</div>
                    <div className="lcp-chat-header-info">
                      <div className="lcp-chat-name">{selectedRoom.name}</div>
                      {selectedRoom.otherUser?.role && <div className="lcp-chat-role">{selectedRoom.otherUser.role}</div>}
                    </div>
                    <div style={{ position: 'relative' }} ref={filesMenuRef}>
                      <button className="lcp-files-btn" onClick={() => setShowFilesPanel(!showFilesPanel)} title="Shared files & links">
                        <FaEllipsisV />
                      </button>
                      {showFilesPanel && (
                        <div className="lcp-files-panel">
                          <div className="lcp-files-title">Shared in this chat</div>
                          {collectedFiles.taskRefs.length === 0 && collectedFiles.links.length === 0 && collectedFiles.images.length === 0 ? (
                            <div className="lcp-files-empty">Nothing shared yet</div>
                          ) : (
                            <div className="lcp-files-list">
                              {collectedFiles.taskRefs.map((t) => (
                                <a key={`task-${t.taskId}`} href={`/project/${t.projectId}?task=${t.taskId}`} className="lcp-file-item"
                                  onClick={(e) => { e.preventDefault(); handleTaskLinkClick(t.projectId, t.taskId); setShowFilesPanel(false); }}>
                                  <span className="lcp-file-icon">📎</span>
                                  <span className="lcp-file-label">{t.title || 'View task'}</span>
                                </a>
                              ))}
                              {collectedFiles.links.map((l) => (
                                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="lcp-file-item" onClick={() => setShowFilesPanel(false)}>
                                  <span className="lcp-file-icon">🔗</span>
                                  <span className="lcp-file-label" title={l.url}>{l.url.length > 42 ? l.url.substring(0, 39) + '…' : l.url}</span>
                                </a>
                              ))}
                              {collectedFiles.images.map((img) => (
                                <a key={img.url} href={img.url} target="_blank" rel="noopener noreferrer" className="lcp-file-item" onClick={() => setShowFilesPanel(false)}>
                                  <img src={img.url} alt="Shared" className="lcp-file-thumb" />
                                  <span className="lcp-file-label">Image</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="lcp-messages">
                    {loadingMessages ? (
                      <div className="lcp-loading"><FaSpinner className="spin" /> Loading messages…</div>
                    ) : (
                      messages.map((msg) => {
                        const isMe = msg.senderId === currentUser?.id;
                        const lastMyMsg = [...messages].filter((m) => m.senderId === currentUser?.id).pop();
                        const isSeen = isMe && msg.id === lastMyMsg?.id && otherUserLastReadAt && new Date(otherUserLastReadAt) >= new Date(msg.createdAt);
                        return (
                          <div key={msg.id} className={`lcp-msg ${isMe ? 'sent' : 'received'}`}>
                            <div className="lcp-bubble">
                              {!isMe && <div className="lcp-msg-sender">{msg.senderName}</div>}
                              <div>{renderMessageContent(msg.content, accentColor, handleTaskLinkClick, isMe)}</div>
                              <div className="lcp-msg-meta">
                                <span className="lcp-msg-time">{formatTime(msg.createdAt)}</span>
                                {isSeen && <span className="lcp-msg-seen">Seen</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="lcp-input-area">
                    {(attachedTasks.length > 0 || attachmentLinks.length > 0 || attachmentImageUrls.length > 0) && (
                      <div className="lcp-attachments">
                        {attachedTasks.map((t) => (
                          <span key={t.taskId} className="lcp-chip">
                            📎 {t.title}
                            <button type="button" className="lcp-chip-remove" onClick={() => setAttachedTasks((p) => p.filter((x) => x.taskId !== t.taskId))}><FaTimes /></button>
                          </span>
                        ))}
                        {attachmentLinks.map((url) => (
                          <span key={url} className="lcp-chip">
                            🔗 {url.length > 36 ? url.substring(0, 33) + '…' : url}
                            <button type="button" className="lcp-chip-remove" onClick={() => setAttachmentLinks((p) => p.filter((u) => u !== url))}><FaTimes /></button>
                          </span>
                        ))}
                        {attachmentImageUrls.map((url) => (
                          <span key={url} className="lcp-attach-img-wrap">
                            <img src={url} alt="Attached" className="lcp-attach-img" />
                            <button type="button" className="lcp-attach-img-remove" onClick={() => setAttachmentImageUrls((p) => p.filter((u) => u !== url))}><FaTimes /></button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="lcp-input-row">
                      <button type="button" className="lcp-icon-btn" onClick={() => setShowTaskPicker(true)} title="Link a task"><FaLink /></button>
                      <div style={{ position: 'relative' }} ref={attachMenuRef}>
                        <button type="button" className="lcp-icon-btn" onClick={() => setShowAttachMenu(!showAttachMenu)} title="Attach"><FaPaperclip /></button>
                        {showAttachMenu && (
                          <div className="lcp-attach-menu">
                            <div>
                              <div className="lcp-attach-label"><FaLink /> Add link</div>
                              <div className="lcp-link-row">
                                <input type="url" className="lcp-link-input" placeholder="https://…" value={linkInputValue} onChange={(e) => setLinkInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLink())} />
                                <button type="button" className="lcp-link-add-btn" onClick={addLink} style={{ background: accentColor }}>Add</button>
                              </div>
                            </div>
                            <div>
                              <div className="lcp-attach-label"><FaImage /> Upload photo</div>
                              <input type="file" accept="image/*" className="lcp-file-input" onChange={handleImageUpload} disabled={uploadingImage} />
                              {uploadingImage && <span className="lcp-uploading">Uploading…</span>}
                            </div>
                          </div>
                        )}
                      </div>
                      <input type="text" className="lcp-text-input" placeholder="Type a message…" value={newMessageText}
                        onChange={(e) => setNewMessageText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                        disabled={sending}
                      />
                      <button className="lcp-send-btn" onClick={handleSendMessage} disabled={!hasContent || sending}
                        style={{ background: hasContent && !sending ? accentColor : '#d1d5db' }}>
                        {sending ? <FaSpinner className="spin" /> : <FaPaperPlane />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Task picker */}
      {showTaskPicker && (
        <div className="lcp-picker-overlay" onClick={() => setShowTaskPicker(false)}>
          <div className="lcp-picker" onClick={(e) => e.stopPropagation()}>
            <div className="lcp-picker-header">
              <h3 className="lcp-picker-title">Insert task link</h3>
              <button className="lcp-close" onClick={() => setShowTaskPicker(false)}><FaTimes /></button>
            </div>
            <div className="lcp-search-wrap">
              <FaSearch className="lcp-search-icon" />
              <input type="text" className="lcp-search-input" placeholder="Search tasks or projects…" value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} autoFocus />
            </div>
            <div className="lcp-task-list">
              {loadingTasks ? (
                <div className="lcp-loading"><FaSpinner className="spin" /> Loading…</div>
              ) : filteredTasks.length === 0 ? (
                <p className="lcp-empty">No tasks found</p>
              ) : (
                filteredTasks.slice(0, 15).map((task: any) => (
                  <div key={task.id} className="lcp-task-item" onClick={() => handleInsertTask(task)}>
                    <div className="lcp-task-name">{task.title}</div>
                    <div className="lcp-task-project">{projectNameMap[task.projectId] || 'Unknown project'}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LiveChatPanel;