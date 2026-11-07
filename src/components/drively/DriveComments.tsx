/** Comments on a file: the data, the side panel, and the small button that appears over selected text. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CommentThread, DriveComment, DriveDetail, driveCommentsApi, DriveCommentsData } from '../../services/drively.service';
import { hubErrorMessage } from '../../services/hub.service';
import { isClientPortalPath } from '../../services/clientPortal.service';
import { Badge } from '../hub/ui/Badge';
import Icon from '../hub/ui/Icon';
import OverflowMenu from '../hub/ui/OverflowMenu';
import { useToast } from '../hub/ui/Toast';
import { CommentAnchor } from './commentAnchors';

const REFRESH_MS = 20000;

export interface CommentsController {
  /** False for a client who can only view: they don't see or join the conversation. */
  enabled: boolean;
  data: DriveCommentsData | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  draftAnchor: CommentAnchor | null;
  /** Opens the panel ready to comment on this place. */
  startDraft: (anchor: CommentAnchor | null) => void;
  clearDraft: () => void;
  /** Threads whose highlighted words can no longer be found. */
  missing: Set<string>;
  setMissing: (ids: Set<string>) => void;
  refresh: () => Promise<void>;
  loadError: string | null;
}

export function useDriveComments(item: Pick<DriveDetail, 'id' | 'myAccess'>): CommentsController {
  const enabled = !(isClientPortalPath() && item.myAccess === 'view');
  const [data, setData] = useState<DriveCommentsData | null>(null);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftAnchor, setDraftAnchor] = useState<CommentAnchor | null>(null);
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setData(await driveCommentsApi.list(item.id));
      setLoadError(null);
    } catch (err) {
      setLoadError(hubErrorMessage(err, "Couldn't load comments."));
    }
  }, [enabled, item.id]);

  useEffect(() => {
    refresh();
    // Other people's comments appear without a reload, and only hidden tabs skip the check.
    const timer = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, REFRESH_MS);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  const startDraft = useCallback((anchor: CommentAnchor | null) => {
    setDraftAnchor(anchor);
    setActiveId(null);
    setOpen(true);
  }, []);
  const clearDraft = useCallback(() => setDraftAnchor(null), []);

  return { enabled, data, open, setOpen, activeId, setActiveId, draftAnchor, startDraft, clearDraft, missing, setMissing, refresh, loadError };
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const Composer: React.FC<{ placeholder: string; action: string; initial?: string; autoFocus?: boolean; children?: React.ReactNode; onSubmit: (body: string) => Promise<void>; onCancel?: () => void }> = ({
  placeholder,
  action,
  initial = '',
  autoFocus,
  children,
  onSubmit,
  onCancel,
}) => {
  const [body, setBody] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(body);
      setBody('');
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't save your comment. Your text is still here, so try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="drv-cmt-composer">
      <textarea
        className="hub-inp"
        rows={3}
        maxLength={5000}
        aria-label={placeholder}
        placeholder={placeholder}
        autoFocus={autoFocus}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
      />
      {children}
      {error && <p className="hub-err" role="alert">{error}</p>}
      <div className="drv-cmt-actions">
        {onCancel && <button type="button" className="hub-btn hub-btn-sm" disabled={busy} onClick={onCancel}>Cancel</button>}
        <button type="button" className="hub-btn hub-btn-primary hub-btn-sm" disabled={busy || !body.trim()} onClick={submit}>{busy ? 'Saving…' : action}</button>
      </div>
    </div>
  );
};

const Entry: React.FC<{ comment: DriveComment; canEdit: boolean; onChanged: () => Promise<void> }> = ({ comment, canEdit, onChanged }) => {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const remove = async () => {
    try {
      await driveCommentsApi.remove(comment.id);
      await onChanged();
    } catch (err) {
      toast.error(hubErrorMessage(err, "Couldn't delete it."));
    }
  };
  const items = [
    { label: 'Edit', icon: 'edit' as const, hidden: !comment.mine || !canEdit, onSelect: () => setEditing(true) },
    { label: 'Delete', icon: 'trash' as const, danger: true, hidden: !comment.canDelete, onSelect: remove },
  ];
  return (
    <div className="drv-cmt-entry">
      <div className="drv-cmt-meta">
        <b>{comment.mine ? 'You' : comment.authorName}</b>
        {comment.authorIsClient && !isClientPortalPath() && <Badge tone="neutral">Client</Badge>}
        <span className="drv-muted">{when(comment.createdAt)}{comment.editedAt ? ' · edited' : ''}</span>
        {items.some((i) => !i.hidden) && <span className="drv-cmt-more" onClick={(e) => e.stopPropagation()}><OverflowMenu label="Comment actions" items={items} /></span>}
      </div>
      {editing ? (
        <div onClick={(e) => e.stopPropagation()}>
          <Composer
            placeholder="Edit your comment"
            action="Save"
            initial={comment.body}
            autoFocus
            onCancel={() => setEditing(false)}
            onSubmit={async (body) => {
              await driveCommentsApi.update(comment.id, body);
              setEditing(false);
              await onChanged();
            }}
          />
        </div>
      ) : (
        <p className="drv-cmt-body">{comment.body}</p>
      )}
    </div>
  );
};

const Thread: React.FC<{ thread: CommentThread & { itemId: string }; controller: CommentsController; canComment: boolean; showAudience: boolean }> = ({ thread, controller, canComment, showAudience }) => {
  const toast = useToast();
  const active = controller.activeId === thread.id;
  const anchorText = thread.anchor?.quote;
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [active]);

  const toggleResolved = async () => {
    try {
      await driveCommentsApi.resolve(thread.id, !thread.resolvedAt);
      if (!thread.resolvedAt && active) controller.setActiveId(null);
      await controller.refresh();
    } catch (err) {
      toast.error(hubErrorMessage(err, "Couldn't update it."));
    }
  };

  return (
    <article ref={ref} className={`drv-cmt-thread${active ? ' drv-cmt-thread-on' : ''}${thread.resolvedAt ? ' drv-cmt-thread-done' : ''}`} onClick={() => controller.setActiveId(thread.id)}>
      {thread.anchor && (controller.missing.has(thread.id) ? (
        <p className="drv-cmt-gone">The highlighted text has changed{anchorText ? `: “${anchorText}”` : ''}</p>
      ) : (
        <blockquote className="drv-cmt-quote">{anchorText || (thread.anchor.type === 'pdf' ? `An area on page ${thread.anchor.page + 1}` : '')}</blockquote>
      ))}
      <Entry comment={thread} canEdit={canComment} onChanged={controller.refresh} />
      {showAudience && (
        <div className="drv-cmt-audience">{thread.visibility === 'team' ? <Badge tone="neutral">Team only</Badge> : <span className="drv-muted">Clients can see this</span>}</div>
      )}
      {thread.replies.map((reply) => <Entry key={reply.id} comment={reply} canEdit={canComment} onChanged={controller.refresh} />)}
      {thread.resolvedAt && <p className="drv-muted drv-cmt-done">Resolved{thread.resolvedByName ? ` by ${thread.resolvedByName}` : ''}</p>}
      {active && (
        <div onClick={(e) => e.stopPropagation()}>
          {canComment && (
            <Composer
              placeholder="Reply"
              action="Reply"
              onSubmit={async (body) => {
                await driveCommentsApi.add(thread.itemId, { body, parentId: thread.id });
                await controller.refresh();
              }}
            />
          )}
          {thread.canResolve && <button type="button" className="hub-btn hub-btn-ghost hub-btn-sm" onClick={toggleResolved}><Icon name="check" size={14} /> {thread.resolvedAt ? 'Reopen' : 'Resolve'}</button>}
        </div>
      )}
    </article>
  );
};

export const DriveCommentsPanel: React.FC<{ itemId: string; controller: CommentsController }> = ({ itemId, controller }) => {
  const { data, draftAnchor } = controller;
  const [showResolved, setShowResolved] = useState(false);
  const [showToClients, setShowToClients] = useState(false);
  const threads = (data?.threads || []).map((t) => ({ ...t, itemId }));
  const openThreads = threads.filter((t) => !t.resolvedAt);
  const resolved = threads.filter((t) => t.resolvedAt);
  const shown = showResolved ? resolved : openThreads;
  const offerClients = !!data && !data.isClient && data.clientsCanComment;

  return (
    <aside className="drv-cmt-panel" aria-label="Comments">
      <header className="drv-cmt-head">
        <h2>Comments</h2>
        <button type="button" className="hub-btn hub-btn-ghost hub-btn-sm" aria-label="Close comments" onClick={() => controller.setOpen(false)}><Icon name="x" size={16} /></button>
      </header>

      {controller.loadError && <p className="hub-err" role="alert">{controller.loadError}</p>}

      {data?.canComment && (
        <div className="drv-cmt-new">
          {draftAnchor && (
            <blockquote className="drv-cmt-quote">
              {draftAnchor.quote || (draftAnchor.type === 'pdf' ? `An area on page ${draftAnchor.page + 1}` : '')}
              <button type="button" className="drv-client-inline drv-cmt-unquote" onClick={controller.clearDraft}>Comment on the whole file instead</button>
            </blockquote>
          )}
          <Composer
            key={draftAnchor ? 'anchored' : 'file'}
            placeholder={draftAnchor ? 'Add your comment' : data.isClient ? 'Comment on this file' : 'Comment on this file. To comment on one part, select it first.'}
            action="Comment"
            autoFocus={!!draftAnchor}
            onSubmit={async (body) => {
              await driveCommentsApi.add(itemId, { body, anchor: draftAnchor, showToClients: offerClients ? showToClients : undefined });
              controller.clearDraft();
              setShowToClients(false);
              setShowResolved(false);
              await controller.refresh();
            }}
          >
            {offerClients && (
              <label className="drv-cmt-show">
                <input type="checkbox" checked={showToClients} onChange={(e) => setShowToClients(e.target.checked)} /> Show to clients
              </label>
            )}
          </Composer>
        </div>
      )}
      {data && !data.canComment && <p className="drv-muted drv-cmt-readonly">You can read comments here, but you need comment access to add one.</p>}

      {resolved.length > 0 && (
        <div className="drv-seg drv-cmt-tabs" role="group" aria-label="Which comments">
          <button type="button" aria-pressed={!showResolved} onClick={() => setShowResolved(false)}>Open ({openThreads.length})</button>
          <button type="button" aria-pressed={showResolved} onClick={() => setShowResolved(true)}>Resolved ({resolved.length})</button>
        </div>
      )}

      <div className="drv-cmt-list">
        {data && shown.length === 0 && <p className="drv-muted drv-cmt-empty">{showResolved ? 'Nothing resolved yet.' : 'No comments yet.'}</p>}
        {shown.map((thread) => <Thread key={thread.id} thread={thread} controller={controller} canComment={data?.canComment ?? false} showAudience={offerClients} />)}
      </div>
    </aside>
  );
};

/**
 * A "Comment" button beside whatever is selected inside `container`. It reads the browser's selection directly, because
 * editors don't track selection for people who can't edit, and those are the people who most need this.
 */
export const SelectionCommentButton: React.FC<{ container: React.RefObject<HTMLElement>; build: (range: Range) => CommentAnchor | null; onComment: (anchor: CommentAnchor) => void }> = ({ container, build, onComment }) => {
  const [spot, setSpot] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const update = () => {
      const selection = window.getSelection();
      const host = container.current;
      if (!selection || selection.isCollapsed || !selection.rangeCount || !host) return setSpot(null);
      const range = selection.getRangeAt(0);
      if (!host.contains(range.commonAncestorContainer) || !selection.toString().trim()) return setSpot(null);
      const boxes = range.getClientRects();
      const last = boxes[boxes.length - 1];
      if (!last) return setSpot(null);
      return setSpot({ top: Math.min(window.innerHeight - 48, Math.max(8, last.bottom + 8)), left: Math.min(window.innerWidth - 130, Math.max(8, last.right - 40)) });
    };
    document.addEventListener('selectionchange', update);
    window.addEventListener('resize', update);
    return () => {
      document.removeEventListener('selectionchange', update);
      window.removeEventListener('resize', update);
    };
  }, [container]);

  if (!spot) return null;
  return (
    <button
      type="button"
      className="hub-btn hub-btn-primary hub-btn-sm drv-cmt-float"
      style={spot}
      // Keeps the selection alive while the button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        const selection = window.getSelection();
        const anchor = selection?.rangeCount ? build(selection.getRangeAt(0)) : null;
        if (anchor) {
          onComment(anchor);
          selection?.removeAllRanges();
          setSpot(null);
        }
      }}
    >
      <Icon name="edit" size={14} /> Comment
    </button>
  );
};
