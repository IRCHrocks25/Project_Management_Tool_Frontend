/**
 * My Day (/my-day): today's focus, tasks due or overdue, unchecked checklist items, things waiting
 * on you and recent pages. All data comes from one call, GET /workspace/my-day.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { hubErrorMessage, hubErrorStatus } from '../../services/hub.service';
import { notificationService } from '../../services/notification.service';
import { MyDay as MyDayData, MyDayTask, workspaceService } from '../../services/workspace.service';
import FormsTopbar from '../forms/FormsTopbar';
import { parseDate, stripMentions, when } from '../hub/hubUtils';
import { Badge } from '../hub/ui/Badge';
import EmptyState from '../hub/ui/EmptyState';
import Icon from '../hub/ui/Icon';
import { SkeletonRows } from '../hub/ui/Skeleton';
import { useToast } from '../hub/ui/Toast';
import { currentHubUser } from '../hub/ui/users';
import './workspace-myday.css';

type ChecklistItem = MyDayData['checklist'][number];
type Mention = MyDayData['mentions'][number];

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

const itemKey = (c: ChecklistItem) => `${c.pageId}:${c.index}`;

const mentionTarget = (m: Mention): string | null => {
  if (m.link) return m.link;
  if (!m.projectId) return null;
  return `/project/${m.projectId}${m.taskId ? `?task=${m.taskId}&tab=details` : ''}`;
};

const Card: React.FC<{ id: string; title: string; count?: number; action?: React.ReactNode; children: React.ReactNode }> = ({ id, title, count, action, children }) => (
  <section className="hub-card ws-md-card" aria-labelledby={id}>
    <div className="ws-md-h">
      <h2 id={id}>{title}</h2>
      {count ? <span className="ws-md-count">{count}</span> : null}
      {action ? <span className="ws-md-act">{action}</span> : null}
    </div>
    {children}
  </section>
);

const TaskList: React.FC<{ tasks: MyDayTask[] }> = ({ tasks }) => (
  <ul className="ws-md-list">
    {tasks.map((t) => (
      <li key={t.id}>
        <Link className="hub-list-row ws-md-link ws-md-task" to={`/project/${t.projectId}?task=${t.id}&tab=details`}>
          <span className="hub-grow">
            <span className="hub-t">{t.title}</span>
            <span className="hub-s">{t.projectName}</span>
          </span>
          <span className="ws-md-tags">
            {t.overdue ? <Badge tone="crit">Overdue</Badge> : null}
            <Badge plain>{t.status}</Badge>
          </span>
        </Link>
      </li>
    ))}
  </ul>
);

const MyDay: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState<MyDayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hiddenItems, setHiddenItems] = useState<Record<string, true>>({});
  const [readIds, setReadIds] = useState<Record<string, true>>({});
  const [creating, setCreating] = useState(false);
  const loadSeq = useRef(0);
  const ticked = useRef(new Set<string>());
  const checklistRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const next = await workspaceService.getMyDay();
      if (seq !== loadSeq.current) return;
      setData(next);
      setError(null);
      // Only the latest response lands, and each tick refetches after it saved, so this data
      // already reflects every saved tick. Rows still being saved stay hidden.
      setHiddenItems((h) => {
        const out = { ...h };
        ticked.current.forEach((k) => delete out[k]);
        return out;
      });
      ticked.current.clear();
    } catch (err) {
      if (seq === loadSeq.current) setError(hubErrorMessage(err, "Couldn't load your day."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tick = async (item: ChecklistItem, input: HTMLInputElement) => {
    // The row is about to go: keep keyboard focus in the list.
    const boxes = Array.from(checklistRef.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') || []);
    const at = boxes.indexOf(input);
    (boxes[at + 1] || boxes[at - 1])?.focus();

    const key = itemKey(item);
    setHiddenItems((h) => ({ ...h, [key]: true }));
    try {
      await workspaceService.toggleChecklistItem(item.pageId, { index: item.index, text: item.text, checked: true });
      ticked.current.add(key);
      load();
    } catch (err) {
      setHiddenItems((h) => {
        const out = { ...h };
        delete out[key];
        return out;
      });
      toast.error(hubErrorMessage(err, "Couldn't tick that item."));
      if (hubErrorStatus(err) === 409) load(); // the page changed: get the current items
    }
  };

  const openMention = (m: Mention) => {
    setReadIds((r) => ({ ...r, [m.id]: true }));
    notificationService.markAsRead(m.id).catch(() => undefined); // still unread next time, nothing else depends on it
    const target = mentionTarget(m);
    if (!target) return;
    if (/^https?:/i.test(target)) window.open(target, '_blank', 'noopener,noreferrer');
    else navigate(target);
  };

  const newPage = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const page = await workspaceService.createPage();
      navigate(`/pages/${page.id}`);
    } catch (err) {
      toast.error(hubErrorMessage(err, "Couldn't create the page."));
      setCreating(false);
    }
  };

  const name = (currentHubUser()?.name || '').trim().split(/\s+/)[0];
  const dateLabel = (data ? parseDate(data.date) : new Date()).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const focusIds = new Set((data?.focus || []).map((t) => t.id));
  const dueTasks = (data?.tasks || []).filter((t) => !focusIds.has(t.id));
  const mentions = (data?.mentions || []).filter((m) => !readIds[m.id]);
  const openItems = (data?.checklist || []).filter((c) => !hiddenItems[itemKey(c)]);
  const pages: { pageId: string; pageTitle: string; items: ChecklistItem[] }[] = [];
  openItems.forEach((c) => {
    const group = pages.find((p) => p.pageId === c.pageId);
    if (group) group.items.push(c);
    else pages.push({ pageId: c.pageId, pageTitle: c.pageTitle, items: [c] });
  });

  return (
    <>
      <FormsTopbar crumbs={[{ label: 'My Day' }]} />
      <main className="hub-page ws-myday" id="my-day-main">
        <div className="hub-ph">
          <div className="hub-ph-text">
            <h1>
              {greeting()}
              {name ? `, ${name}` : ''}
            </h1>
            <p>{dateLabel}</p>
          </div>
        </div>

        {error && !data ? (
          <div className="hub-card">
            <EmptyState
              icon="alert"
              title="Couldn't load your day"
              text={error}
              actionLabel="Try again"
              actionIcon="refresh"
              onAction={() => {
                setError(null);
                load();
              }}
            />
          </div>
        ) : !data ? (
          <div className="hub-cols">
            <div className="hub-stack">
              <SkeletonRows rows={2} />
              <SkeletonRows rows={3} />
            </div>
            <div className="hub-stack">
              <SkeletonRows rows={3} />
              <SkeletonRows rows={2} />
            </div>
          </div>
        ) : (
          <div className="hub-cols">
            <div className="hub-stack">
              <Card id="ws-md-focus" title="Today's focus" count={data.focus.length}>
                {data.focus.length ? <TaskList tasks={data.focus} /> : <p className="ws-md-empty">Nothing picked as today's focus.</p>}
              </Card>

              <Card id="ws-md-due" title="Due today and overdue" count={dueTasks.length}>
                {dueTasks.length ? (
                  <TaskList tasks={dueTasks} />
                ) : (
                  <p className="ws-md-empty">{data.focus.length ? 'Nothing else is due today.' : 'Nothing due today and nothing overdue.'}</p>
                )}
              </Card>

              <Card id="ws-md-waiting" title="Waiting on you" count={mentions.length}>
                {mentions.length ? (
                  <ul className="ws-md-list">
                    {mentions.map((m) => (
                      <li key={m.id}>
                        <button type="button" className="hub-list-row ws-md-link ws-md-mention" onClick={() => openMention(m)}>
                          <span className="hub-grow">
                            <span className="hub-t">{m.title}</span>
                            <span className="hub-s ws-md-preview">{stripMentions(m.message)}</span>
                          </span>
                          <span className="hub-s ws-md-when">{when(m.createdAt)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ws-md-empty">Nobody is waiting on you. New mentions and replies show up here.</p>
                )}
              </Card>
            </div>

            <div className="hub-stack">
              <Card id="ws-md-check" title="My checklists" count={openItems.length}>
                {pages.length ? (
                  <div ref={checklistRef}>
                    {pages.map((p) => (
                      <div className="ws-md-group" key={p.pageId}>
                        <Link className="ws-md-page" to={`/pages/${p.pageId}`}>
                          {p.pageTitle}
                        </Link>
                        {p.items.map((c) => (
                          <label className="ws-md-item" key={itemKey(c)}>
                            <input type="checkbox" checked={false} onChange={(e) => tick(c, e.currentTarget)} />
                            <span>{c.text}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="ws-md-empty">No open items. Add a checklist to one of your pages and it shows up here.</p>
                )}
              </Card>

              <Card
                id="ws-md-pages"
                title="Recent pages"
                action={
                  <button type="button" className="hub-btn hub-btn-sm" onClick={newPage} disabled={creating}>
                    {creating ? <span className="hub-spin" aria-hidden="true" /> : <Icon name="plus" size={14} />}
                    New page
                  </button>
                }
              >
                {data.recentPages.length ? (
                  <ul className="ws-md-list">
                    {data.recentPages.map((p) => (
                      <li key={p.id}>
                        <Link className="hub-list-row ws-md-link" to={`/pages/${p.id}`}>
                          <Icon name="file" size={16} className="hub-muted" />
                          <span className="hub-grow">
                            <span className="hub-t">{p.title}</span>
                          </span>
                          <span className="hub-s ws-md-when">{when(p.openedAt)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ws-md-empty">Pages you open show up here.</p>
                )}
              </Card>
            </div>
          </div>
        )}
      </main>
    </>
  );
};

export default MyDay;
