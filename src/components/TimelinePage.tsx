import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FaArrowLeft,
  FaSpinner,
  FaEnvelope,
  FaCommentDots,
} from 'react-icons/fa';
import { authService } from '../services/auth.service';
import LiveChatPanel from './LiveChatPanel';
import { taskService } from '../services/task.service';
import { projectService } from '../services/project.service';
import UserAvatar from './UserAvatar';
import './Dashboard.css';

type TimelineItem =
  | { type: 'task'; date: Date; task: any; projectName: string }
  | { type: 'conversation'; date: Date; question: any };

// Group items by date label (Today / Yesterday / "Mar 14")
function groupByDate(items: TimelineItem[]): { label: string; items: TimelineItem[] }[] {
  const groups: Map<string, TimelineItem[]> = new Map();
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  items.forEach((item) => {
    const d = item.date.toDateString();
    let label: string;
    if (d === todayStr) label = 'Today';
    else if (d === yesterdayStr) label = 'Yesterday';
    else label = item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  });

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

const TimelinePage: React.FC = () => {
  const navigate = useNavigate();
  const { userId: viewUserId } = useParams<{ userId?: string }>();
  const user = authService.getUser();
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [viewedUser, setViewedUser] = useState<{ id: string; name: string; role?: string; email?: string; avatarUrl?: string } | null>(null);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatWithUserId, setChatWithUserId] = useState<string | null>(null);

  const targetUserId = viewUserId || user?.id;

  const loadData = useCallback(async () => {
    if (!user?.id || !targetUserId) return;
    try {
      setLoading(true);
      if (viewUserId) {
        const users = await authService.getAllUsers();
        const found = users.find((u: any) => u.id === viewUserId);
        setViewedUser(found ? { id: found.id, name: found.name, role: found.role, email: found.email, avatarUrl: found.avatarUrl } : null);
      } else {
        setViewedUser(null);
      }

      const [allConversations, myTasks, projectsData] = await Promise.all([
        taskService.getAllConversations(),
        taskService.getAll(undefined, targetUserId, { all: true }),
        projectService.getAll(),
      ]);

      const projectMap = new Map(projectsData.map((p: any) => [p.id, p]));

      const myConversations = allConversations.filter((q: any) => {
        if (q.user?.id === targetUserId) return true;
        return (q.comments || []).some((c: any) => c.user?.id === targetUserId);
      });

      const items: TimelineItem[] = [];

      myTasks.forEach((task: any) => {
        const projectName = projectMap.get(task.projectId)?.clientName || 'Unknown Project';
        const date = task.updatedAt ? new Date(task.updatedAt) : new Date(task.createdAt);
        items.push({ type: 'task', date, task, projectName });
      });

      myConversations.forEach((q: any) => {
        items.push({ type: 'conversation', date: new Date(q.createdAt), question: q });
      });

      items.sort((a, b) => b.date.getTime() - a.date.getTime());
      setTimeline(items);
    } catch (error) {
      console.error('Failed to load timeline:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, targetUserId, viewUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!user) return null;

  const displayUser = viewUserId && viewedUser ? viewedUser : user;
  const isViewingOther = Boolean(viewUserId && viewUserId !== user.id);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const groups = groupByDate(timeline);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page, #f8fafc)', fontFamily: "'DM Sans', 'Inter', sans-serif" }}>

      {/* ── Header ───────────────────────────────────────── */}
      <header style={{
        background: 'white',
        borderBottom: '0.5px solid #e2e8f0',
        padding: '0.875rem 2rem',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', maxWidth: '720px', margin: '0 auto' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              background: 'transparent', border: 'none',
              color: '#94a3b8', cursor: 'pointer',
              fontSize: '0.8125rem', fontWeight: 500, padding: '0.4rem 0',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#1e293b'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; }}
          >
            <FaArrowLeft style={{ fontSize: '11px' }} />
            Back
          </button>
          <div style={{ width: '1px', height: '18px', background: '#e2e8f0' }} />
          <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
            {isViewingOther ? (viewedUser ? `${viewedUser.name}'s Timeline` : 'Timeline') : 'My Timeline'}
          </h1>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────── */}
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 2rem 3rem' }}>

        {/* User identity strip */}
        {viewUserId && !viewedUser && !loading ? (
          <div style={{ color: '#94a3b8', fontSize: '0.875rem', padding: '2rem 0' }}>
            User not found.
          </div>
        ) : (
        <div style={{
          marginBottom: '1.75rem',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            marginBottom: isViewingOther && viewedUser ? '0.5rem' : 0,
          }}>
            <UserAvatar name={displayUser.name} avatarUrl={displayUser.avatarUrl} size={36} color="#6366f1" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#0f172a', lineHeight: 1.3 }}>
                {displayUser.name}
                {isViewingOther && <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400, marginLeft: '6px' }}>— viewing their timeline</span>}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{displayUser.role}</div>
            </div>
          </div>
          {isViewingOther && viewedUser && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem 1.25rem',
              background: 'white',
              borderRadius: '12px',
              border: '0.5px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}>
            <div style={{ fontSize: '0.8125rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {viewedUser.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FaEnvelope style={{ color: '#94a3b8', flexShrink: 0 }} />
                  <a href={`mailto:${viewedUser.email}`} style={{ color: '#6366f1', textDecoration: 'none' }}>{viewedUser.email}</a>
                </div>
              )}
              {viewedUser.role && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569' }}>
                  <span style={{ color: '#94a3b8' }}>Role:</span>
                  <span>{viewedUser.role}</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setChatWithUserId(viewedUser.id); setShowChatPanel(true); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'white',
                background: '#6366f1',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#4f46e5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#6366f1'; }}
            >
              <FaCommentDots />
              Message
            </button>
          </div>
          )}
        </div>
        )}

        {/* ── States ─ (only when viewing self or a found user) */}
        {(!viewUserId || viewedUser) && (
        loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: '#94a3b8', padding: '2rem 0' }}>
            <FaSpinner style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '0.875rem' }}>Loading…</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : timeline.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: '0.875rem', padding: '2rem 0' }}>
            No activity yet. Assigned tasks and conversations will show up here.
          </div>
        ) : (

          /* ── Thread feed ─ */
          <div>
            {groups.map((group) => (
              <div key={group.label}>

                {/* Date separator */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  margin: '1.5rem 0 0.875rem',
                }}>
                  <span style={{
                    fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: '#94a3b8', whiteSpace: 'nowrap',
                  }}>
                    {group.label}
                  </span>
                  <div style={{ flex: 1, height: '0.5px', background: '#e2e8f0' }} />
                </div>

                {/* Items */}
                {group.items.map((item, idx) => {
                  const isLast = idx === group.items.length - 1;

                  if (item.type === 'task') {
                    const { task, projectName, date } = item;
                    const isDone = task.isCompleted || task.status === 'Completed';
                    return (
                      <ThreadRow
                        key={`task-${task.id}-${idx}`}
                        dotStyle={isDone ? 'done' : 'task'}
                        isLast={isLast}
                        onClick={() => navigate(`/project/${task.projectId}?task=${task.id}`)}
                      >
                        <ThreadCard>
                          <IconDot type={isDone ? 'done' : 'task'} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={styles.title}>{task.title}</div>
                            <div style={styles.meta}>
                              <span>{projectName}</span>
                              <Dot />
                              <span>{formatTime(date)}</span>
                              <StatusBadge isDone={isDone} label={isDone ? 'Done' : (task.status || 'In progress')} />
                            </div>
                          </div>
                        </ThreadCard>
                      </ThreadRow>
                    );
                  }

                  /* ── Conversation ─ */
                  const { question, date } = item;
                  const isAuthor = question.user?.id === targetUserId;
                  const replies: any[] = question.comments || [];

                  return (
                    <ThreadRow
                      key={`conv-${question.id}-${idx}`}
                      dotStyle="conv"
                      isLast={isLast && replies.length === 0}
                      onClick={() => navigate(`/project/${question.projectId}?task=${question.taskId}&tab=conversation`)}
                    >
                      {/* Root message card */}
                      <ThreadCard>
                        <IconDot type="conv" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={styles.title}>
                            {question.taskTitle || 'Task conversation'}
                          </div>
                          <div style={styles.meta}>
                            <span style={{ fontWeight: 500, color: '#1e293b' }}>
                              {question.user?.name || 'Someone'}
                            </span>
                            {isAuthor && <YouBadge />}
                            <Dot />
                            <span>{question.projectName}</span>
                            <Dot />
                            <span>{formatTime(date)}</span>
                          </div>
                          {question.text && (
                            <div style={styles.snippet}>
                              {question.text.substring(0, 140)}
                              {question.text.length > 140 ? '…' : ''}
                            </div>
                          )}
                        </div>
                      </ThreadCard>

                      {/* Nested replies */}
                      {replies.length > 0 && (
                        <div style={{ marginLeft: '20px' }}>
                          {replies.map((reply: any, ri: number) => (
                            <ReplyRow key={reply.id || ri} isLast={ri === replies.length - 1}>
                              <ReplyCard onClick={() => navigate(`/project/${question.projectId}?task=${question.taskId}&tab=conversation`)}>
                                <div style={{ ...styles.title, fontSize: '12.5px' }}>
                                  <span style={{ fontWeight: 500 }}>{reply.user?.name || 'Someone'}</span>
                                  {reply.user?.id === user.id && <YouBadge />}
                                  <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: '6px' }}>
                                    {reply.createdAt ? formatTime(new Date(reply.createdAt)) : ''}
                                  </span>
                                </div>
                                {reply.text && (
                                  <div style={{ ...styles.snippet, fontSize: '12.5px', marginTop: '2px' }}>
                                    {reply.text.substring(0, 120)}
                                    {reply.text.length > 120 ? '…' : ''}
                                  </div>
                                )}
                              </ReplyCard>
                            </ReplyRow>
                          ))}
                        </div>
                      )}
                    </ThreadRow>
                  );
                })}

              </div>
            ))}
          </div>
        )
        )}
      </main>

      <LiveChatPanel
        isOpen={showChatPanel}
        onClose={() => { setShowChatPanel(false); setChatWithUserId(null); }}
        initialUserId={chatWithUserId}
        accentColor="#6366f1"
      />
    </div>
  );
};

/* ─── Sub-components ───────────────────────────────── */

const styles = {
  title: {
    fontSize: '13.5px',
    fontWeight: 500,
    color: '#1e293b',
    lineHeight: 1.4,
  } as React.CSSProperties,
  meta: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '6px',
    flexWrap: 'wrap' as const,
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '2px',
  } as React.CSSProperties,
  snippet: {
    fontSize: '13px',
    color: '#475569',
    marginTop: '5px',
    lineHeight: 1.5,
  } as React.CSSProperties,
};

const Dot = () => (
  <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#cbd5e1', display: 'inline-block', flexShrink: 0 }} />
);

const YouBadge = () => (
  <span style={{
    fontSize: '10.5px', fontWeight: 600, padding: '0 5px',
    borderRadius: '20px', background: '#e0e7ff', color: '#4f46e5',
    letterSpacing: '0.02em', lineHeight: '18px',
  }}>
    You
  </span>
);

const StatusBadge = ({ isDone, label }: { isDone: boolean; label: string }) => (
  <span style={{
    fontSize: '10.5px', fontWeight: 600, padding: '0 7px', lineHeight: '18px',
    borderRadius: '20px',
    background: isDone ? '#dcfce7' : '#e0e7ff',
    color: isDone ? '#16a34a' : '#4f46e5',
  }}>
    {label}
  </span>
);

const IconDot = ({ type }: { type: 'task' | 'conv' | 'done' }) => {
  const map = {
    task: { bg: '#e0e7ff', color: '#4f46e5', symbol: '✦' },
    conv: { bg: '#fef3c7', color: '#d97706', symbol: '💬' },
    done: { bg: '#dcfce7', color: '#16a34a', symbol: '✓' },
  };
  const s = map[type];
  return (
    <div style={{
      width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: s.bg, color: s.color, fontSize: '12px', fontWeight: 700,
    }}>
      {s.symbol}
    </div>
  );
};

const ThreadRow = ({
  children, dotStyle, isLast, onClick,
}: {
  children: React.ReactNode;
  dotStyle: 'task' | 'conv' | 'done';
  isLast: boolean;
  onClick: () => void;
}) => {
  const dotColors: Record<string, { border: string; bg: string }> = {
    task: { border: '#6366f1', bg: '#e0e7ff' },
    conv: { border: '#d97706', bg: '#fef3c7' },
    done: { border: '#16a34a', bg: '#dcfce7' },
  };
  const dc = dotColors[dotStyle];
  return (
    <div style={{ display: 'flex', gap: 0, marginBottom: '2px' }}>
      {/* Spine */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40px', flexShrink: 0 }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
          marginTop: '16px', border: `1.5px solid ${dc.border}`, background: dc.bg, zIndex: 1,
        }} />
        {!isLast && <div style={{ width: '1px', flex: 1, background: '#e2e8f0', minHeight: '12px', marginTop: '2px' }} />}
      </div>
      {/* Content — clickable only on the card itself */}
      <div style={{ flex: 1, paddingTop: '8px', paddingBottom: '4px' }} onClick={onClick}>
        {children}
      </div>
    </div>
  );
};

const ThreadCard = ({ children }: { children: React.ReactNode }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '10px 14px',
        border: `0.5px solid ${hovered ? '#cbd5e1' : '#e2e8f0'}`,
        borderRadius: '12px',
        background: hovered ? '#f8fafc' : 'white',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
        marginBottom: '2px',
      }}
    >
      {children}
    </div>
  );
};

const ReplyRow = ({ children, isLast }: { children: React.ReactNode; isLast: boolean }) => (
  <div style={{ display: 'flex', gap: 0 }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '24px', flexShrink: 0 }}>
      <div style={{
        width: '5px', height: '5px', borderRadius: '50%',
        background: '#cbd5e1', marginTop: '13px', flexShrink: 0,
      }} />
      {!isLast && <div style={{ width: '1px', flex: 1, background: '#e2e8f0' }} />}
    </div>
    {children}
  </div>
);

const ReplyCard = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, padding: '7px 12px', marginBottom: '1px',
        borderLeft: '0.5px solid #e2e8f0',
        borderRadius: '0 8px 8px 0',
        background: hovered ? 'white' : '#f8fafc',
        cursor: 'pointer', transition: 'background 0.15s',
      }}
    >
      {children}
    </div>
  );
};

export default TimelinePage;