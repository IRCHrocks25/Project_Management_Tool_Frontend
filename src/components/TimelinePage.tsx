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

/* ─── Types ────────────────────────────────────────── */

type TimelineItem =
  | { type: 'task'; date: Date; task: any; projectName: string }
  | { type: 'conversation'; date: Date; question: any };

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

/* ─── Design tokens ─────────────────────────────────── */
const T = {
  // Surfaces
  pageBg: '#f6f7f9',
  surface: '#ffffff',
  surfaceHover: '#fafbfc',
  // Borders
  border: '#eaecf0',
  borderHover: '#d0d5dd',
  // Text
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textTertiary: '#94a3b8',
  // Accent — indigo
  accent: '#5b5bd6',
  accentBg: '#eeeeff',
  accentText: '#3b3ba0',
  // Status
  doneBg: '#ecfdf5',
  doneText: '#166534',
  convBg: '#fffbeb',
  convText: '#92400e',
  // Spine
  spine: '#e2e8f0',
};

/* ─── Inline CSS injected once ──────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap');

  .tl-root { font-family: 'DM Sans', sans-serif; }

  .tl-card {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 11px 14px;
    background: ${T.surface};
    border: 0.75px solid ${T.border};
    border-radius: 12px;
    cursor: pointer;
    transition: border-color 0.14s, background 0.14s, box-shadow 0.14s;
    margin-bottom: 2px;
  }
  .tl-card:hover {
    border-color: ${T.borderHover};
    background: ${T.surfaceHover};
    box-shadow: 0 1px 4px rgba(0,0,0,0.05);
  }

  .tl-reply-card {
    flex: 1; padding: 7px 12px; margin-bottom: 1px;
    border-left: none;
    border-radius: 0 8px 8px 0;
    background: #fafbfc;
    cursor: pointer;
    transition: background 0.13s;
  }
  .tl-reply-card:hover { background: ${T.surface}; }

  .tl-btn-msg {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px;
    font-size: 13px; font-weight: 600;
    color: white;
    background: ${T.accent};
    border: none; border-radius: 8px; cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: background 0.15s, transform 0.1s;
    letter-spacing: 0.01em;
  }
  .tl-btn-msg:hover { background: #4a4ab8; transform: translateY(-1px); }
  .tl-btn-msg:active { transform: translateY(0); }

  .tl-back-btn {
    display: flex; align-items: center; gap: 5px;
    background: transparent; border: none;
    color: ${T.textTertiary}; cursor: pointer;
    font-size: 13px; font-weight: 500;
    padding: 5px 0;
    font-family: 'DM Sans', sans-serif;
    transition: color 0.14s;
    letter-spacing: 0.01em;
  }
  .tl-back-btn:hover { color: ${T.textPrimary}; }

  @keyframes tl-spin { to { transform: rotate(360deg); } }
  .tl-spin { animation: tl-spin 1s linear infinite; }

  @keyframes tl-fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .tl-fadein { animation: tl-fadein 0.22s ease-out both; }
`;

/* ─── Page ──────────────────────────────────────────── */

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

  useEffect(() => { loadData(); }, [loadData]);

  if (!user) return null;

  const displayUser = viewUserId && viewedUser ? viewedUser : user;
  const isViewingOther = Boolean(viewUserId && viewUserId !== user.id);
  const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const groups = groupByDate(timeline);

  return (
    <div className="tl-root" style={{ minHeight: '100vh', background: T.pageBg }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Header ── */}
      <header style={{
        background: T.surface,
        borderBottom: `0.75px solid ${T.border}`,
        padding: '0 2rem',
        height: '52px',
        display: 'flex',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: '680px', width: '100%', margin: '0 auto' }}>
          <button className="tl-back-btn" onClick={() => navigate('/dashboard')}>
            <FaArrowLeft style={{ fontSize: '10px' }} />
            Back
          </button>

          <div style={{ width: '1px', height: '16px', background: T.border }} />

          <span style={{ fontSize: '14px', fontWeight: 600, color: T.textPrimary, letterSpacing: '-0.1px' }}>
            {isViewingOther ? (viewedUser ? `${viewedUser.name}'s timeline` : 'Timeline') : 'My timeline'}
          </span>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 2rem 4rem' }}>

        {/* User strip */}
        {viewUserId && !viewedUser && !loading ? (
          <p style={{ color: T.textTertiary, fontSize: '14px' }}>User not found.</p>
        ) : (
          <div style={{ marginBottom: '2rem' }} className="tl-fadein">

            {/* Avatar + name row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: isViewingOther && viewedUser ? '14px' : 0 }}>
              <UserAvatar name={displayUser.name} avatarUrl={displayUser.avatarUrl} size={38} color={T.accent} />
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: T.textPrimary, lineHeight: 1.3, letterSpacing: '-0.1px' }}>
                  {displayUser.name}
                  {isViewingOther && (
                    <span style={{ fontSize: '12px', color: T.textTertiary, fontWeight: 400, marginLeft: '7px' }}>
                      viewing their timeline
                    </span>
                  )}
                </div>
                {displayUser.role && (
                  <div style={{ fontSize: '12.5px', color: T.textTertiary, marginTop: '1px' }}>{displayUser.role}</div>
                )}
              </div>
            </div>

            {/* Info card when viewing another user */}
            {isViewingOther && viewedUser && (
              <div style={{
                padding: '14px 16px',
                background: T.surface,
                borderRadius: '12px',
                border: `0.75px solid ${T.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {viewedUser.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px' }}>
                      <FaEnvelope style={{ color: T.textTertiary, fontSize: '11px' }} />
                      <a href={`mailto:${viewedUser.email}`} style={{ color: T.accent, textDecoration: 'none', fontWeight: 500 }}>
                        {viewedUser.email}
                      </a>
                    </div>
                  )}
                  {viewedUser.role && (
                    <div style={{ fontSize: '12.5px', color: T.textSecondary }}>
                      <span style={{ color: T.textTertiary }}>Role · </span>{viewedUser.role}
                    </div>
                  )}
                </div>
                <button
                  className="tl-btn-msg"
                  type="button"
                  onClick={() => { setChatWithUserId(viewedUser.id); setShowChatPanel(true); }}
                >
                  <FaCommentDots style={{ fontSize: '12px' }} />
                  Message
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Feed states ── */}
        {(!viewUserId || viewedUser) && (
          loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: T.textTertiary, paddingTop: '1rem' }}>
              <FaSpinner className="tl-spin" style={{ fontSize: '14px' }} />
              <span style={{ fontSize: '13.5px' }}>Loading…</span>
            </div>
          ) : timeline.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="tl-fadein">
              {groups.map((group) => (
                <section key={group.label}>

                  {/* Date separator */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    margin: '1.75rem 0 1rem',
                  }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: T.textTertiary, whiteSpace: 'nowrap',
                      fontFamily: "'DM Mono', monospace",
                    }}>
                      {group.label}
                    </span>
                    <div style={{ flex: 1, height: '0.75px', background: T.border }} />
                  </div>

                  {/* Items */}
                  {group.items.map((item, idx) => {
                    const isLast = idx === group.items.length - 1;

                    if (item.type === 'task') {
                      const { task, projectName, date } = item;
                      const isDone = task.isCompleted || task.status === 'Completed';
                      return (
                        <SpineRow
                          key={`task-${task.id}-${idx}`}
                          dotVariant={isDone ? 'done' : 'task'}
                          isLast={isLast}
                        >
                          <div className="tl-card" onClick={() => navigate(`/project/${task.projectId}?task=${task.id}`)}>
                            <TypeIcon variant={isDone ? 'done' : 'task'} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={TS.title}>{task.title}</div>
                              <div style={TS.meta}>
                                <span>{projectName}</span>
                                <MidDot />
                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px' }}>{formatTime(date)}</span>
                                <StatusPill isDone={isDone} label={isDone ? 'Done' : (task.status || 'In progress')} />
                              </div>
                            </div>
                          </div>
                        </SpineRow>
                      );
                    }

                    /* Conversation */
                    const { question, date } = item;
                    const isAuthor = question.user?.id === targetUserId;
                    const replies: any[] = question.comments || [];

                    return (
                      <SpineRow
                        key={`conv-${question.id}-${idx}`}
                        dotVariant="conv"
                        isLast={isLast && replies.length === 0}
                      >
                        <div className="tl-card" onClick={() => navigate(`/project/${question.projectId}?task=${question.taskId}&tab=conversation`)}>
                          <TypeIcon variant="conv" />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={TS.title}>{question.taskTitle || 'Task conversation'}</div>
                            <div style={TS.meta}>
                              <span style={{ fontWeight: 600, color: T.textPrimary }}>{question.user?.name || 'Someone'}</span>
                              {isAuthor && <YouPill />}
                              <MidDot />
                              <span>{question.projectName}</span>
                              <MidDot />
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px' }}>{formatTime(date)}</span>
                            </div>
                            {question.text && (
                              <div style={TS.snippet}>
                                {question.text.substring(0, 140)}{question.text.length > 140 ? '…' : ''}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Replies */}
                        {replies.length > 0 && (
                          <div style={{ marginLeft: '18px', marginTop: '1px' }}>
                            {replies.map((reply: any, ri: number) => (
                              <ReplySpineRow key={reply.id || ri} isLast={ri === replies.length - 1}>
                                <div
                                  className="tl-reply-card"
                                  onClick={() => navigate(`/project/${question.projectId}?task=${question.taskId}&tab=conversation`)}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: T.textPrimary }}>
                                      {reply.user?.name || 'Someone'}
                                    </span>
                                    {reply.user?.id === user.id && <YouPill />}
                                    <span style={{ fontSize: '11px', color: T.textTertiary, fontFamily: "'DM Mono', monospace" }}>
                                      {reply.createdAt ? formatTime(new Date(reply.createdAt)) : ''}
                                    </span>
                                  </div>
                                  {reply.text && (
                                    <div style={{ ...TS.snippet, fontSize: '12.5px' }}>
                                      {reply.text.substring(0, 120)}{reply.text.length > 120 ? '…' : ''}
                                    </div>
                                  )}
                                </div>
                              </ReplySpineRow>
                            ))}
                          </div>
                        )}
                      </SpineRow>
                    );
                  })}
                </section>
              ))}
            </div>
          )
        )}
      </main>

      <LiveChatPanel
        isOpen={showChatPanel}
        onClose={() => { setShowChatPanel(false); setChatWithUserId(null); }}
        initialUserId={chatWithUserId}
        accentColor={T.accent}
      />
    </div>
  );
};

/* ─── Sub-components ────────────────────────────────── */

const TS = {
  title: {
    fontSize: '13.5px',
    fontWeight: 500,
    color: '#0f172a',
    lineHeight: 1.4,
    letterSpacing: '-0.05px',
  } as React.CSSProperties,
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    flexWrap: 'wrap',
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '3px',
  } as React.CSSProperties,
  snippet: {
    fontSize: '13px',
    color: '#475569',
    marginTop: '6px',
    lineHeight: 1.55,
  } as React.CSSProperties,
};

const MidDot = () => (
  <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#cbd5e1', display: 'inline-block', flexShrink: 0 }} />
);

const YouPill = () => (
  <span style={{
    fontSize: '10.5px', fontWeight: 700, padding: '0 6px', lineHeight: '17px',
    borderRadius: '20px', background: T.accentBg, color: T.accentText,
    letterSpacing: '0.02em',
  }}>
    you
  </span>
);

const StatusPill = ({ isDone, label }: { isDone: boolean; label: string }) => (
  <span style={{
    fontSize: '10.5px', fontWeight: 700, padding: '0 7px', lineHeight: '17px',
    borderRadius: '20px',
    background: isDone ? T.doneBg : T.accentBg,
    color: isDone ? T.doneText : T.accentText,
    letterSpacing: '0.01em',
  }}>
    {label}
  </span>
);

/* Icon badges for each type */
const TYPE_ICON_MAP = {
  task: { bg: '#eeeeff', color: '#5b5bd6', path: 'M4 8h8M4 4h8M4 12h5' }, // lines
  conv: { bg: '#fffbeb', color: '#b45309', path: 'M2 3h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-4 4V4a1 1 0 0 1 1-1z' },
  done: { bg: '#ecfdf5', color: '#16a34a', path: 'M2 8l4 4 8-8' },
};

const TypeIcon = ({ variant }: { variant: 'task' | 'conv' | 'done' }) => {
  const s = TYPE_ICON_MAP[variant];
  return (
    <div style={{
      width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
      background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={s.color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d={s.path} />
      </svg>
    </div>
  );
};

/* Spine (vertical thread line) */
const DOT_COLORS: Record<string, { border: string; bg: string }> = {
  task: { border: '#5b5bd6', bg: '#eeeeff' },
  conv: { border: '#b45309', bg: '#fffbeb' },
  done: { border: '#16a34a', bg: '#ecfdf5' },
};

const SpineRow = ({
  children, dotVariant, isLast,
}: {
  children: React.ReactNode;
  dotVariant: 'task' | 'conv' | 'done';
  isLast: boolean;
}) => {
  const dc = DOT_COLORS[dotVariant];
  return (
    <div style={{ display: 'flex', gap: 0, marginBottom: '2px' }}>
      {/* Vertical spine */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '36px', flexShrink: 0 }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: '17px',
          border: `1.5px solid ${dc.border}`, background: dc.bg, zIndex: 1,
        }} />
        {!isLast && <div style={{ width: '1px', flex: 1, background: T.spine, minHeight: '10px', marginTop: '3px' }} />}
      </div>
      {/* Content */}
      <div style={{ flex: 1, paddingTop: '8px', paddingBottom: '4px' }}>
        {children}
      </div>
    </div>
  );
};

const ReplySpineRow = ({ children, isLast }: { children: React.ReactNode; isLast: boolean }) => (
  <div style={{ display: 'flex', gap: 0 }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '22px', flexShrink: 0 }}>
      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#cbd5e1', marginTop: '13px', flexShrink: 0 }} />
      {!isLast && <div style={{ width: '1px', flex: 1, background: T.spine }} />}
    </div>
    {children}
  </div>
);

const EmptyState = () => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    paddingTop: '4rem', gap: '10px', textAlign: 'center',
  }}>
    <div style={{
      width: '44px', height: '44px', borderRadius: '12px',
      background: T.accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round">
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5v3l2 2" />
      </svg>
    </div>
    <div style={{ fontSize: '14px', fontWeight: 600, color: T.textPrimary }}>No activity yet</div>
    <div style={{ fontSize: '13px', color: T.textTertiary, maxWidth: '260px', lineHeight: 1.5 }}>
      Assigned tasks and conversations will appear here as they happen.
    </div>
  </div>
);

export default TimelinePage;