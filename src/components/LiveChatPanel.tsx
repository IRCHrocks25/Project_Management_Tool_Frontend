import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTimes, FaPaperPlane, FaSearch, FaSpinner, FaLink } from 'react-icons/fa';
import { chatService, ChatRoom, ChatMessage } from '../services/chat.service';
import { authService } from '../services/auth.service';
import { taskService } from '../services/task.service';
import { projectService } from '../services/project.service';
import './LiveChatPanel.css';

// Format: [[TASK:taskId|projectId|title]] - title is optional for display
const TASK_LINK_REGEX = /\[\[TASK:([^|]+)\|([^|]+)(?:\|([^\]]*))?\]\]/g;

// Role -> task type for department filtering (PM & Founder see all tasks)
const ROLE_TO_TASK_TYPE: Record<string, string | null> = {
  'Copy Writing': 'Copy',
  'Designer': 'Design',
  'Developer': 'Dev',
  'AI Developer': 'AI',
  'Social Media': 'Social Media',
  'CRM': 'CRM',
  'SEO/GEO': 'SEO',
  'Project Manager': null,  // sees all
  'FOUNDER/CEO': null,      // sees all
};

function renderMessageContent(
  content: string,
  accentColor: string,
  onTaskClick?: (projectId: string, taskId: string) => void
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  const regex = new RegExp(TASK_LINK_REGEX);
  while ((match = regex.exec(content)) !== null) {
    const [full, taskId, projectId, title] = match;
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }
    parts.push(
      <a
        key={`${taskId}-${match.index}`}
        href={`/project/${projectId}?task=${taskId}`}
        onClick={(e) => {
          e.preventDefault();
          if (onTaskClick) {
            onTaskClick(projectId, taskId);
          } else {
            window.location.href = `/project/${projectId}?task=${taskId}`;
          }
        }}
        className="live-chat-task-link"
        style={{ color: accentColor, fontWeight: 600 }}
      >
        {title && title.trim() ? `📎 ${title.trim()}` : '📎 View task'}
      </a>
    );
    lastIndex = match.index + full.length;
  }
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }
  return parts.length > 0 ? <>{parts}</> : content;
}

interface LiveChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor?: string;
}

const LiveChatPanel: React.FC<LiveChatPanelProps> = ({ isOpen, onClose, accentColor = '#667eea' }) => {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUser = authService.getUser();

  const loadRooms = useCallback(async () => {
    try {
      setLoadingRooms(true);
      const data = await chatService.getRooms();
      setRooms(data);
    } catch (err) {
      console.error('Failed to load chat rooms:', err);
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  const loadMessages = useCallback(
    async (roomId: string) => {
      if (!roomId) return;
      try {
        setLoadingMessages(true);
        const { messages: msgs, otherUserLastReadAt: readAt } = await chatService.getMessages(roomId);
        setMessages(msgs);
        setOtherUserLastReadAt(readAt);
        chatService.joinRoom(roomId);
        chatService.markRoomRead(roomId);
      } catch (err) {
        console.error('Failed to load messages:', err);
        setMessages([]);
        setOtherUserLastReadAt(null);
      } finally {
        setLoadingMessages(false);
      }
    },
    []
  );

  const loadUsers = useCallback(async () => {
    try {
      const data = await authService.getAllUsers();
      setUsers(data.filter((u: any) => u.id !== currentUser?.id));
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }, [currentUser?.id]);

  const loadTasksAndProjects = useCallback(async () => {
    try {
      setLoadingTasks(true);
      const userRole = currentUser?.role;
      const departmentTaskType = userRole ? ROLE_TO_TASK_TYPE[userRole] ?? null : null;

      const [tasksData, projectsData] = await Promise.all([
        taskService.getAll(undefined, undefined, { all: true, limit: 300 }),
        projectService.getAll(),
      ]);

      // Filter to department tasks only (PM & Founder see all)
      const allTasks = tasksData || [];
      const filtered =
        departmentTaskType !== null
          ? allTasks.filter((t: any) => t.type === departmentTaskType)
          : allTasks;

      setTasks(filtered);
      setProjects(projectsData || []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setTasks([]);
      setProjects([]);
    } finally {
      setLoadingTasks(false);
    }
  }, [currentUser?.role]);

  useEffect(() => {
    if (isOpen) {
      loadRooms();
      chatService.connectSocket();
    }
  }, [isOpen, loadRooms]);

  useEffect(() => {
    if (isOpen && showNewChat) {
      loadUsers();
    }
  }, [isOpen, showNewChat, loadUsers]);

  useEffect(() => {
    if (isOpen && showTaskPicker) {
      loadTasksAndProjects();
    }
  }, [isOpen, showTaskPicker, loadTasksAndProjects]);

  useEffect(() => {
    if (!selectedRoom) {
      setMessages([]);
      setOtherUserLastReadAt(null);
      return;
    }
    loadMessages(selectedRoom.id);

    const unsub = chatService.onNewMessage((msg: ChatMessage) => {
      if (msg.roomId === selectedRoom.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setRooms((prev) =>
          prev.map((r) =>
            r.id === selectedRoom.id
              ? {
                  ...r,
                  lastMessage: {
                    id: msg.id,
                    content: msg.content,
                    senderId: msg.senderId,
                    senderName: msg.senderName,
                    createdAt: msg.createdAt,
                  },
                  updatedAt: msg.createdAt,
                }
              : r
          )
        );
      }
    });

    const unsubRead = chatService.onRoomRead((data) => {
      if (data.roomId === selectedRoom.id && data.userId !== currentUser?.id) {
        setOtherUserLastReadAt(data.lastReadAt);
        setRooms((prev) =>
          prev.map((r) =>
            r.id === selectedRoom.id ? { ...r, otherUserLastReadAt: data.lastReadAt } : r
          )
        );
      }
    });

    return () => {
      chatService.leaveRoom(selectedRoom.id);
      if (typeof unsub === 'function') unsub();
      if (typeof unsubRead === 'function') unsubRead();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom?.id, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectRoom = (room: ChatRoom) => {
    setSelectedRoom(room);
    setShowNewChat(false);
    setAttachedTasks([]);
  };

  const handleStartNewChat = async (otherUser: any) => {
    try {
      const room = await chatService.getOrCreateRoom(otherUser.id);
      setRooms((prev) => {
        const exists = prev.some((r) => r.id === room.id);
        if (exists) return prev;
        return [room, ...prev];
      });
      setSelectedRoom(room);
      setShowNewChat(false);
      setUserSearch('');
    } catch (err) {
      console.error('Failed to start chat:', err);
      alert('Failed to start conversation.');
    }
  };

  const handleSendMessage = async () => {
    const textPart = newMessageText.trim();
    const taskLinks = attachedTasks
      .map((t) => `[[TASK:${t.taskId}|${t.projectId}|${t.title.replace(/\|/g, ' ')}]]`)
      .join(' ');
    const fullContent = [textPart, taskLinks].filter(Boolean).join(' ');
    if (!selectedRoom || !fullContent || sending) return;

    setSending(true);
    try {
      chatService.sendMessage(selectedRoom.id, fullContent);
      setNewMessageText('');
      setAttachedTasks([]);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const d = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const filteredUsers = users.filter((u) =>
    u.name?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const projectNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p: any) => {
      map[p.id] = p.clientName || 'Unknown Project';
    });
    return map;
  }, [projects]);

  const filteredTasks = useMemo(() => {
    const search = taskSearch.toLowerCase();
    return tasks.filter((t: any) => {
      const projName = projectNameMap[t.projectId] || '';
      return (
        (t.title || '').toLowerCase().includes(search) ||
        projName.toLowerCase().includes(search)
      );
    });
  }, [tasks, taskSearch, projectNameMap]);

  const handleInsertTask = (task: any) => {
    const title = (task.title || 'Task').replace(/\|/g, ' ');
    const newAttach = { taskId: task.id, projectId: task.projectId, title };
    setAttachedTasks((prev) => {
      if (prev.some((t) => t.taskId === task.id)) return prev;
      return [...prev, newAttach];
    });
    setShowTaskPicker(false);
    setTaskSearch('');
  };

  const removeAttachedTask = (taskId: string) => {
    setAttachedTasks((prev) => prev.filter((t) => t.taskId !== taskId));
  };

  const handleTaskLinkClick = (projectId: string, taskId: string) => {
    onClose();
    navigate(`/project/${projectId}?task=${taskId}`);
  };

  if (!isOpen) return null;

  return (
    <div className="live-chat-overlay" onClick={onClose}>
      <div className="live-chat-panel" onClick={(e) => e.stopPropagation()} style={{ '--accent': accentColor } as React.CSSProperties}>
        <div className="live-chat-header">
          <h2>Live Chat</h2>
          <button className="live-chat-close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="live-chat-body">
          <div className="live-chat-sidebar">
            <button
              className="live-chat-new-btn"
              onClick={() => setShowNewChat(true)}
              style={{ background: `${accentColor}20`, color: accentColor, borderColor: accentColor }}
            >
              + New Chat
            </button>

            {showNewChat ? (
              <div className="live-chat-new-section">
                <div className="live-chat-search-wrap">
                  <FaSearch className="live-chat-search-icon" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="live-chat-search-input"
                    autoFocus
                  />
                </div>
                <div className="live-chat-user-list">
                  {filteredUsers.slice(0, 10).map((u) => (
                    <div
                      key={u.id}
                      className="live-chat-user-item"
                      onClick={() => handleStartNewChat(u)}
                    >
                      <div
                        className="live-chat-avatar"
                        style={{ background: `${accentColor}40`, color: accentColor }}
                      >
                        {u.name?.charAt(0).toUpperCase()}
                      </div>
                      <span>{u.name}</span>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <p className="live-chat-empty">No users found</p>
                  )}
                </div>
                <button
                  className="live-chat-back-btn"
                  onClick={() => {
                    setShowNewChat(false);
                    setUserSearch('');
                  }}
                >
                  ← Back to conversations
                </button>
              </div>
            ) : loadingRooms ? (
              <div className="live-chat-loading">
                <FaSpinner className="spin" />
                <span>Loading...</span>
              </div>
            ) : rooms.length === 0 ? (
              <div className="live-chat-empty-state">
                <p>No conversations yet</p>
                <p className="live-chat-empty-hint">Start a new chat to message anyone!</p>
              </div>
            ) : (
              <div className="live-chat-room-list">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className={`live-chat-room-item ${selectedRoom?.id === room.id ? 'selected' : ''}`}
                    onClick={() => handleSelectRoom(room)}
                  >
                    <div
                      className="live-chat-avatar"
                      style={{ background: `${accentColor}40`, color: accentColor }}
                    >
                      {room.otherUser?.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="live-chat-room-info">
                      <div className="live-chat-room-name">{room.name}</div>
                      {room.lastMessage && (
                        <div className="live-chat-room-preview">
                          {room.lastMessage.content
                            .replace(/\[\[TASK:[^\]]+\]\]/g, '📎 Task')
                            .replace(/\s+/g, ' ')
                            .trim()
                            .substring(0, 40)}
                          {room.lastMessage.content.length > 40 ? '...' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="live-chat-main">
            {!selectedRoom ? (
              <div className="live-chat-select-prompt">
                <p>Select a conversation or start a new chat</p>
              </div>
            ) : (
              <>
                <div className="live-chat-main-header">
                  <div
                    className="live-chat-avatar"
                    style={{ background: `${accentColor}40`, color: accentColor }}
                  >
                    {selectedRoom.otherUser?.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="live-chat-main-name">{selectedRoom.name}</div>
                    {selectedRoom.otherUser?.role && (
                      <div className="live-chat-main-role">{selectedRoom.otherUser.role}</div>
                    )}
                  </div>
                </div>

                <div className="live-chat-messages">
                  {loadingMessages ? (
                    <div className="live-chat-loading">
                      <FaSpinner className="spin" />
                      <span>Loading messages...</span>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.senderId === currentUser?.id;
                      const lastMyMessage = [...messages]
                        .filter((m) => m.senderId === currentUser?.id)
                        .pop();
                      const isSeen =
                        isMe &&
                        msg.id === lastMyMessage?.id &&
                        otherUserLastReadAt &&
                        new Date(otherUserLastReadAt) >= new Date(msg.createdAt);
                      return (
                        <div
                          key={msg.id}
                          className={`live-chat-message ${isMe ? 'sent' : 'received'}`}
                        >
                          <div
                            className="live-chat-msg-bubble"
                            style={
                              isMe
                                ? { background: accentColor, color: 'white' }
                                : { background: '#f3f4f6', color: '#111827' }
                            }
                          >
                            {!isMe && (
                              <div className="live-chat-msg-sender">{msg.senderName}</div>
                            )}
                            <div className="live-chat-msg-content">
                              {renderMessageContent(
                                msg.content,
                                accentColor,
                                handleTaskLinkClick
                              )}
                            </div>
                            <div className="live-chat-msg-meta">
                              <span className="live-chat-msg-time">{formatTime(msg.createdAt)}</span>
                              {isSeen && (
                                <span className="live-chat-msg-seen" title="Seen">
                                  Seen
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="live-chat-input-area">
                  {attachedTasks.length > 0 && (
                    <div className="live-chat-attached-tasks">
                      {attachedTasks.map((t) => (
                        <span
                          key={t.taskId}
                          className="live-chat-task-chip"
                          style={{ borderColor: accentColor, color: accentColor }}
                        >
                          📎 {t.title}
                          <button
                            type="button"
                            className="live-chat-task-chip-remove"
                            onClick={() => removeAttachedTask(t.taskId)}
                            aria-label="Remove task"
                          >
                            <FaTimes />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="live-chat-input-wrap">
                    <button
                      type="button"
                      className="live-chat-insert-task-btn"
                      onClick={() => setShowTaskPicker(true)}
                      title="Link a task"
                      style={{ color: accentColor, borderColor: accentColor }}
                    >
                      <FaLink />
                    </button>
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={newMessageText}
                      onChange={(e) => setNewMessageText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="live-chat-input"
                      disabled={sending}
                    />
                    <button
                      className="live-chat-send-btn"
                      onClick={handleSendMessage}
                      disabled={(!newMessageText.trim() && attachedTasks.length === 0) || sending}
                    style={{
                      background: (newMessageText.trim() || attachedTasks.length > 0) && !sending ? accentColor : '#d1d5db',
                      cursor: (newMessageText.trim() || attachedTasks.length > 0) && !sending ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {sending ? <FaSpinner className="spin" /> : <FaPaperPlane />}
                  </button>
                </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Task Picker Modal */}
      {showTaskPicker && (
        <div className="live-chat-task-picker-overlay" onClick={() => setShowTaskPicker(false)}>
          <div className="live-chat-task-picker" onClick={(e) => e.stopPropagation()}>
            <div className="live-chat-task-picker-header">
              <h3>Insert task link</h3>
              <button className="live-chat-close-btn" onClick={() => setShowTaskPicker(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="live-chat-search-wrap">
              <FaSearch className="live-chat-search-icon" />
              <input
                type="text"
                placeholder="Search by task or project..."
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                className="live-chat-search-input"
                autoFocus
              />
            </div>
            <div className="live-chat-task-list">
              {loadingTasks ? (
                <div className="live-chat-loading">
                  <FaSpinner className="spin" />
                  <span>Loading tasks...</span>
                </div>
              ) : filteredTasks.length === 0 ? (
                <p className="live-chat-empty">No tasks found</p>
              ) : (
                filteredTasks.slice(0, 15).map((task: any) => (
                  <div
                    key={task.id}
                    className="live-chat-task-item"
                    onClick={() => handleInsertTask(task)}
                  >
                    <div className="live-chat-task-item-title">{task.title}</div>
                    <div className="live-chat-task-item-project">
                      {projectNameMap[task.projectId] || 'Unknown project'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveChatPanel;
