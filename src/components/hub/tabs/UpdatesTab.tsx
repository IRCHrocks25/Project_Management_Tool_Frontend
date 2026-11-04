/**
 * Updates tab — the product's feed: post (header "Post update"), edit / delete via the overflow
 * menu, replies with @mentions, attachments. ?update=<id> scrolls to and highlights that update.
 * Also exports <UpdatePost compact /> used by the Overview tab.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { hubErrorMessage, hubService, ProductDetail, ProductUpdate, UpdateComment } from '../../../services/hub.service';
import { usePrimaryAction } from '../primaryAction';
import { UpdateTypeBadge } from '../ui/Badge';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import Icon from '../ui/Icon';
import MentionInput from '../ui/MentionInput';
import MentionText from '../ui/MentionText';
import OverflowMenu from '../ui/OverflowMenu';
import { SkeletonFeed } from '../ui/Skeleton';
import { useDeferredDelete, useHiddenIds, useToast } from '../ui/Toast';
import { Avatar, Who } from '../ui/Avatar';
import { currentHubUser, useHubUsers } from '../ui/users';
import { extractMentions, fullDateTime, listNames, when } from '../hubUtils';
import { EditUpdateModal, PostUpdateModal } from './UpdateModals';

export interface UpdatesTabProps {
  product: ProductDetail;
  onChanged: () => void;
}

/* ------------------------------------------------------------------ */

export const UpdatePost: React.FC<{
  update: ProductUpdate;
  compact?: boolean;
  /** Compact mode: where "Open" links to (the full update in the Updates tab). */
  openTo?: string;
  flash?: boolean;
  hiddenComments?: (id: string) => boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onReply?: (body: string) => Promise<void>;
  onDeleteComment?: (c: UpdateComment) => void;
}> = ({ update, compact, openTo, flash, hiddenComments, onEdit, onDelete, onReply, onDeleteComment }) => {
  const { byId } = useHubUsers();
  const me = currentHubUser();
  const author = update.author || byId(update.authorId);
  const comments = (update.comments || []).filter((c) => !hiddenComments || !hiddenComments(c.id));
  return (
    <article
      id={`hub-update-${update.id}`}
      className={`hub-card hub-post${flash ? ' hub-flash' : ''}`}
      aria-label={`Update from ${author?.name || 'someone'}`}
      tabIndex={-1}
    >
      <div className="hub-post-h">
        <Who user={author} fallback="Someone" />
        <UpdateTypeBadge type={update.type} />
        <span className="hub-muted hub-small" title={fullDateTime(update.createdAt)}>
          {when(update.createdAt)}
          {update.editedAt ? ' · edited' : ''}
        </span>
        {compact && openTo ? (
          <span className="hub-sp">
            <Link className="hub-link hub-small" to={openTo}>
              Open<span className="hub-sr"> this update</span>
            </Link>
          </span>
        ) : null}
        {!compact && (onEdit || onDelete) ? (
          <span className="hub-sp">
            <OverflowMenu
              label="More actions for this update"
              items={[
                { label: 'Edit', icon: 'edit', onSelect: () => onEdit?.(), hidden: !onEdit },
                { label: 'Delete update', icon: 'trash', danger: true, onSelect: () => onDelete?.(), hidden: !onDelete },
              ]}
            />
          </span>
        ) : null}
      </div>
      <div className="hub-post-b">
        <MentionText text={update.body} />
      </div>
      {update.files && update.files.length > 0 && (
        <div className="hub-attach">
          {update.files.map((f) => (
            <a key={f.id} className="hub-file-pill" href={f.url} target="_blank" rel="noopener noreferrer" title={`Open ${f.name}`}>
              <Icon name="clip" size={13} />
              <span>{f.name}</span>
            </a>
          ))}
        </div>
      )}
      {compact ? (
        comments.length ? (
          <span className="hub-muted hub-small">
            {comments.length} repl{comments.length > 1 ? 'ies' : 'y'}
          </span>
        ) : null
      ) : (
        <div className="hub-comments">
          {comments.map((c) => {
            const ca = c.author || byId(c.authorId);
            return (
              <div className="hub-cmt" key={c.id}>
                <Avatar user={ca} />
                <div>
                  <b>{ca?.name || 'Someone'}</b>{' '}
                  <span className="hub-muted hub-small" title={fullDateTime(c.createdAt)}>
                    {when(c.createdAt)}
                  </span>
                  <div>
                    <MentionText text={c.body} />
                  </div>
                </div>
                {onDeleteComment && me && c.authorId === me.id ? (
                  <button type="button" className="hub-icon-btn hub-sm" aria-label="Delete your reply" title="Delete your reply" onClick={() => onDeleteComment(c)}>
                    <Icon name="trash" size={14} />
                  </button>
                ) : null}
              </div>
            );
          })}
          {onReply ? <ReplyForm updateId={update.id} onReply={onReply} /> : null}
        </div>
      )}
    </article>
  );
};

const ReplyForm: React.FC<{ updateId: string; onReply: (body: string) => Promise<void> }> = ({ updateId, onReply }) => {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const id = `hub-reply-${updateId}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busyRef.current) return;
    if (!body.trim()) {
      setError('Write a reply first.');
      inputRef.current?.focus();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await onReply(body.trim());
      setBody('');
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } catch (err) {
      setError(`Couldn't post your reply. ${hubErrorMessage(err)}`);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <form className="hub-reply" onSubmit={submit} noValidate>
      <label className="hub-sr" htmlFor={id}>
        Reply to this update
      </label>
      <div className="hub-mention-wrap" style={{ display: 'grid', gap: 6 }}>
        <MentionInput
          id={id}
          multiline={false}
          value={body}
          onChange={(v) => {
            setBody(v);
            if (error) setError(null);
          }}
          placeholder="Write a reply. Type @ to mention someone."
          invalid={!!error}
          describedBy={error ? `${id}-e` : undefined}
          inputRef={inputRef}
          disabled={busy}
        />
        {error ? (
          <p className="hub-err" id={`${id}-e`} role="alert">
            <Icon name="alert" size={14} />
            {error}
          </p>
        ) : null}
      </div>
      <button type="submit" className="hub-btn" disabled={busy}>
        {busy ? <span className="hub-spin" aria-hidden="true" /> : null}
        {busy ? 'Replying…' : 'Reply'}
      </button>
    </form>
  );
};

/* ------------------------------------------------------------------ */

const UpdatesTab: React.FC<UpdatesTabProps> = ({ product, onChanged }) => {
  const toast = useToast();
  const deferredDelete = useDeferredDelete();
  const hidden = useHiddenIds();
  const hiddenComments = useHiddenIds();
  const [params, setParams] = useSearchParams();
  const [updates, setUpdates] = useState<ProductUpdate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState<ProductUpdate | null>(null);
  const [deleting, setDeleting] = useState<ProductUpdate | null>(null);
  const [deletingComment, setDeletingComment] = useState<{ update: ProductUpdate; comment: UpdateComment } | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const deepLink = params.get('update');

  usePrimaryAction({ label: 'Post update', icon: 'plus', onClick: () => setPosting(true) });

  const load = useCallback(async () => {
    setError(null);
    try {
      setUpdates(await hubService.listUpdates(product.id));
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't load the updates."));
    }
  }, [product.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Deep link: scroll to and highlight ?update=<id> once the feed has loaded.
  useEffect(() => {
    if (!deepLink || !updates) return;
    const el = document.getElementById(`hub-update-${deepLink}`);
    if (!el) {
      if (!updates.some((u) => u.id === deepLink)) toast.show("That update isn't here any more. It may have been deleted.", { kind: 'info' });
      return;
    }
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    el.focus({ preventScroll: true });
    setFlashId(deepLink);
    const t = window.setTimeout(() => {
      setFlashId(null);
      const next = new URLSearchParams(params);
      next.delete('update');
      setParams(next, { replace: true });
    }, 2600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink, updates]);

  const replaceUpdate = (u: ProductUpdate) => setUpdates((list) => (list || []).map((x) => (x.id === u.id ? { ...x, ...u, comments: u.comments || x.comments, files: u.files || x.files } : x)));

  const reply = async (u: ProductUpdate, body: string) => {
    const c = await hubService.addComment(product.id, u.id, body);
    const me = currentHubUser();
    const comment: UpdateComment = c && c.id ? { ...c, author: c.author || me } : { id: `tmp-${Date.now()}`, updateId: u.id, authorId: me?.id || '', author: me, body, createdAt: new Date().toISOString() };
    setUpdates((list) => (list || []).map((x) => (x.id === u.id ? { ...x, comments: [...(x.comments || []), comment] } : x)));
    const names = extractMentions(body)
      .filter((m) => m.id !== me?.id)
      .map((m) => m.name);
    toast.show(`Reply posted${names.length ? `. Notified ${listNames(names)}` : ''}`);
  };

  const visible = (updates || []).filter((u) => !hidden.has(u.id));

  return (
    <div className="hub-feed" style={{ maxWidth: 780 }}>
      {error ? (
        <div className="hub-card">
          <EmptyState icon="alert" title="Couldn't load the updates" text={error} actionLabel="Try again" actionIcon="refresh" onAction={load} />
        </div>
      ) : !updates ? (
        <SkeletonFeed count={3} />
      ) : !visible.length ? (
        <div className="hub-card">
          <EmptyState
            icon="msg"
            title="No updates yet"
            text="Post progress, releases, blockers or questions. Mention people with @ to notify them."
            actionLabel="Post update"
            onAction={() => setPosting(true)}
          />
        </div>
      ) : (
        visible.map((u) => (
          <UpdatePost
            key={u.id}
            update={u}
            flash={flashId === u.id}
            hiddenComments={hiddenComments.has}
            onEdit={() => setEditing(u)}
            onDelete={() => setDeleting(u)}
            onReply={(body) => reply(u, body)}
            onDeleteComment={(c) => setDeletingComment({ update: u, comment: c })}
          />
        ))
      )}

      {posting && (
        <PostUpdateModal
          product={product}
          onClose={() => setPosting(false)}
          onPosted={(u) => {
            if (u && u.id) setUpdates((list) => [{ ...u, comments: u.comments || [], files: u.files || [], author: u.author || currentHubUser() }, ...(list || [])]);
            else load();
            onChanged();
          }}
        />
      )}
      {editing && (
        <EditUpdateModal
          product={product}
          update={editing}
          onClose={() => setEditing(null)}
          onSaved={(u) => replaceUpdate(u)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this update?"
          body={(() => {
            const n = (deleting.comments || []).length;
            const who = deleting.author?.name || 'this person';
            return (
              <>
                The update from {who}
                {n ? ` and its ${n} repl${n === 1 ? 'y' : 'ies'}` : ''} will be removed for everyone. Attached files stay in Files & links. You can
                undo this for a few seconds afterwards.
              </>
            );
          })()}
          confirmLabel="Delete update"
          onConfirm={() => {
            const u = deleting;
            deferredDelete({
              message: 'Update deleted',
              hide: () => hidden.add(u.id),
              restore: () => hidden.remove(u.id),
              commit: () => hubService.deleteUpdate(product.id, u.id),
              onCommitted: () => {
                setUpdates((list) => (list || []).filter((x) => x.id !== u.id));
                hidden.remove(u.id);
                onChanged();
              },
              errorMessage: "Couldn't delete the update.",
            });
          }}
          onClose={() => setDeleting(null)}
        />
      )}
      {deletingComment && (
        <ConfirmDialog
          title="Delete your reply?"
          body="It will be removed for everyone. You can undo this for a few seconds afterwards."
          confirmLabel="Delete reply"
          onConfirm={() => {
            const { update: u, comment: c } = deletingComment;
            deferredDelete({
              message: 'Reply deleted',
              hide: () => hiddenComments.add(c.id),
              restore: () => hiddenComments.remove(c.id),
              commit: () => hubService.deleteComment(product.id, u.id, c.id),
              onCommitted: () => {
                setUpdates((list) => (list || []).map((x) => (x.id === u.id ? { ...x, comments: (x.comments || []).filter((y) => y.id !== c.id) } : x)));
                hiddenComments.remove(c.id);
              },
              errorMessage: "Couldn't delete your reply.",
            });
          }}
          onClose={() => setDeletingComment(null)}
        />
      )}
    </div>
  );
};

export default UpdatesTab;
