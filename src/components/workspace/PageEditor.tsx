/**
 * A page (/pages/:id): title, TipTap editor, autosave, sharing.
 *
 * PageEditor loads the page and handles "not found"; PageWorkspace only mounts once the page is
 * here, so the editor is created exactly once with its content, keyed by page id.
 * Autosave lives in pageAutosave.ts. Save responses never reach the editor, so the cursor stays put.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Editor, EditorContent, useEditor } from '@tiptap/react';
import { hubErrorMessage, hubErrorStatus } from '../../services/hub.service';
import { PageDetail, TaskSearchResult, workspaceService } from '../../services/workspace.service';
import FormsTopbar from '../forms/FormsTopbar';
import { Badge } from '../hub/ui/Badge';
import ConfirmDialog from '../hub/ui/ConfirmDialog';
import EmptyState from '../hub/ui/EmptyState';
import Icon from '../hub/ui/Icon';
import OverflowMenu from '../hub/ui/OverflowMenu';
import { Skeleton } from '../hub/ui/Skeleton';
import { useToast } from '../hub/ui/Toast';
import { usePageAutosave } from './pageAutosave';
import { buildPageExtensions } from './pageExtensions';
import { createSlashStore, SlashActions } from './pageSlash';
import { isAllowedPageHref, normalizeDoc, shareLabel, taskHref, titleForInput, UNTITLED } from './pageUtils';
import PageLinkModal from './PageLinkModal';
import PageShareModal from './PageShareModal';
import PageSlashMenu from './PageSlashMenu';
import PageTaskLinkModal from './PageTaskLinkModal';
import PageToolbar from './PageToolbar';
import './workspace-pages.css';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const TITLE_MAX = 200;

type Confirm = 'delete' | 'reload' | null;

const PageWorkspace: React.FC<{ initial: PageDetail }> = ({ initial }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const id = initial.id;

  const [meta, setMeta] = useState(initial);
  const [title, setTitle] = useState(() => titleForInput(initial.title));
  const [modal, setModal] = useState<'share' | 'link' | 'task' | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [uploads, setUploads] = useState(0);
  const [duplicating, setDuplicating] = useState(false);

  const canEdit = meta.myAccess !== 'view';
  const isOwner = meta.myAccess === 'owner';
  const ownerName = meta.owner ? meta.owner.name : 'the owner';

  const editorRef = useRef<Editor | null>(null);
  const titleRef = useRef(title);
  const fileInput = useRef<HTMLInputElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);

  const { status, error, autosave } = usePageAutosave({
    pageId: id,
    initialRevision: initial.revision,
    getTitle: () => titleRef.current.trim() || UNTITLED,
    getContent: () => (editorRef.current ? editorRef.current.getJSON() : undefined),
  });

  // Created once: the slash menu reaches the latest handlers through this ref.
  const actions = useRef<SlashActions>({ pickImage: () => undefined, linkTask: () => undefined });
  actions.current = {
    pickImage: () => fileInput.current?.click(),
    linkTask: () => setModal('task'),
  };
  const [slash] = useState(createSlashStore);
  const [setup] = useState(() => ({
    extensions: buildPageExtensions({
      canEdit: initial.myAccess !== 'view',
      slash,
      actions: {
        pickImage: () => actions.current.pickImage(),
        linkTask: () => actions.current.linkTask(),
      },
    }),
    content: normalizeDoc(initial.content),
    editable: initial.myAccess !== 'view',
    immediatelyRender: true as const,
    // The toolbar subscribes by itself; typing shouldn't re-render this whole screen.
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: 'ws-prose', 'aria-label': 'Page content' },
      handleClick: (_view: unknown, _pos: number, event: MouseEvent) => {
        if (!event.metaKey && !event.ctrlKey) return false;
        const target = event.target as HTMLElement | null;
        const anchor = target && target.closest ? target.closest('a') : null;
        const href = anchor ? anchor.getAttribute('href') : null;
        if (!href || !isAllowedPageHref(href)) return false;
        window.open(href, '_blank', 'noopener,noreferrer');
        return true;
      },
    },
  }));

  const editor = useEditor({ ...setup, onUpdate: () => autosave.markContentDirty() });
  editorRef.current = editor;

  useEffect(() => {
    editor.setEditable(canEdit, false);
    if (canEdit) return;
    // TipTap's checkboxes undo a click in read-only mode; also show them as disabled.
    editor.view.dom.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((box) => {
      box.disabled = true;
    });
  }, [editor, canEdit, meta.revision]);

  useEffect(() => {
    if (canEdit && !titleRef.current) titleInput.current?.focus();
    // Only when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTitle = (value: string) => {
    setTitle(value);
    titleRef.current = value;
    autosave.markTitleDirty();
  };

  const onPickFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = ''; // so the same file can be chosen again
      if (!file) return;
      if (file.type.indexOf('image/') !== 0) {
        toast.error('That file is not an image.');
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error('Images can be up to 10 MB.');
        return;
      }
      setUploads((n) => n + 1);
      try {
        const { url } = await workspaceService.uploadPageImage(id, file);
        if (!editor.isDestroyed) editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      } catch (err) {
        toast.error(hubErrorMessage(err, "Couldn't upload the image."));
      } finally {
        setUploads((n) => n - 1);
      }
    },
    [editor, id, toast],
  );

  const insertTaskLink = (task: TaskSearchResult) => {
    setModal(null);
    editor
      .chain()
      .focus()
      .insertContent([
        { type: 'text', text: task.title, marks: [{ type: 'link', attrs: { href: taskHref(task.projectId, task.id) } }] },
        // The plain space keeps whatever is typed next from joining the link.
        { type: 'text', text: ' ' },
      ])
      .run();
  };

  const duplicate = async () => {
    setDuplicating(true);
    try {
      if (canEdit) {
        await autosave.flush();
        if (autosave.hasUnsaved()) {
          toast.error("Your latest changes aren't saved, so a copy would miss them. Sort out the save first.");
          return;
        }
      }
      const copy = await workspaceService.duplicatePage(id);
      toast.show('Copied to My Space');
      navigate(`/pages/${copy.id}`);
    } catch (err) {
      toast.error(hubErrorMessage(err, "Couldn't duplicate the page."));
    } finally {
      setDuplicating(false);
    }
  };

  const copyMyText = async () => {
    try {
      await navigator.clipboard.writeText(editor.getText());
      toast.show('Your text is copied');
    } catch {
      toast.error("Couldn't copy. Select the text in the page and copy it yourself.");
    }
  };

  const reloadLatest = async () => {
    const fresh = await workspaceService.getPage(id);
    editor.commands.setContent(normalizeDoc(fresh.content), false);
    const nextTitle = titleForInput(fresh.title);
    titleRef.current = nextTitle;
    setTitle(nextTitle);
    setMeta(fresh);
    autosave.reset(fresh.revision);
    toast.show('Showing the latest version');
  };

  const deletePage = async () => {
    autosave.hold(true);
    try {
      await workspaceService.deletePage(id);
    } catch (err) {
      autosave.hold(false);
      throw err;
    }
    toast.show('Page deleted');
    navigate('/pages');
  };

  const conflict = status === 'conflict';
  const saveLabel = !canEdit ? null : status === 'saving' || status === 'pending' ? (
    <span className="ws-save" role="status">
      <span className="hub-spin" /> Saving…
    </span>
  ) : status === 'error' ? (
    <span className="ws-save ws-save-err" role="alert">
      <Icon name="alert" /> Couldn't save{' '}
      <button type="button" className="hub-link" onClick={() => autosave.flush()}>
        Retry
      </button>
    </span>
  ) : conflict ? (
    <span className="ws-save ws-save-err" role="status">
      <Icon name="alert" /> Not saved
    </span>
  ) : (
    <span className="ws-save" role="status">
      <Icon name="check" /> Saved
    </span>
  );

  const shared = shareLabel(meta.sharedWith);

  return (
    <>
      <FormsTopbar crumbs={[{ label: 'My Space', to: '/pages' }, { label: title.trim() || UNTITLED }]}>
        {saveLabel}
        {isOwner && (
          <button type="button" className="hub-btn hub-btn-sm" onClick={() => setModal('share')}>
            <Icon name="share" /> Share
          </button>
        )}
        <OverflowMenu
          label="More page actions"
          size="md"
          items={[
            { label: 'Duplicate', icon: 'copy', disabled: duplicating, onSelect: duplicate },
            { label: 'Delete', icon: 'trash', danger: true, hidden: !isOwner, onSelect: () => setConfirm('delete') },
          ]}
        />
      </FormsTopbar>

      <main className="ws-editor" id="page-main">
        {!canEdit && (
          <div className="hub-notice hub-info ws-notice">
            <Icon name="eye" />
            <div className="hub-grow">You can view this page. Ask {ownerName} for edit access.</div>
            <button type="button" className="hub-btn hub-btn-sm" onClick={duplicate} disabled={duplicating}>
              {duplicating ? <span className="hub-spin" /> : <Icon name="copy" />} Duplicate to My Space
            </button>
          </div>
        )}

        {conflict && (
          <div className="hub-notice hub-crit ws-notice" role="alert">
            <Icon name="alert" />
            <div className="hub-grow">
              {error} <span className="ws-notice-sub">Your recent edits are not saved. Saving has stopped.</span>
            </div>
            <div className="ws-notice-acts">
              <button type="button" className="hub-btn hub-btn-sm" onClick={copyMyText}>
                <Icon name="copy" /> Copy my text
              </button>
              <button type="button" className="hub-btn hub-btn-sm hub-btn-primary" onClick={() => setConfirm('reload')}>
                <Icon name="refresh" /> Reload latest
              </button>
            </div>
          </div>
        )}

        {status === 'error' && error && (
          <div className="hub-notice hub-crit ws-notice" role="alert">
            <Icon name="alert" />
            <div className="hub-grow">{error}</div>
          </div>
        )}

        <div className="ws-meta">
          {shared === 'Private' ? <Badge plain>{shared}</Badge> : <Badge tone="acc">{shared}</Badge>}
          {!isOwner && (
            <span className="ws-meta-text">
              {ownerName}'s page · {canEdit ? 'Can edit' : 'Can view'}
            </span>
          )}
        </div>

        <input
          ref={titleInput}
          className="ws-title"
          value={title}
          placeholder={UNTITLED}
          aria-label="Page title"
          maxLength={TITLE_MAX}
          disabled={!canEdit}
          onChange={(e) => changeTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              editor.commands.focus('start');
            }
          }}
        />

        {canEdit && <PageToolbar editor={editor} onLink={() => setModal('link')} />}

        {uploads > 0 && (
          <div className="ws-upload" role="status">
            <span className="hub-spin" /> Uploading image…
          </div>
        )}

        <div className="ws-editor-body">
          <EditorContent editor={editor} />
        </div>

        <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPickFile} aria-hidden="true" tabIndex={-1} />
      </main>

      <PageSlashMenu store={slash} />

      {modal === 'link' && <PageLinkModal editor={editor} onClose={() => setModal(null)} />}
      {modal === 'task' && <PageTaskLinkModal onPick={insertTaskLink} onClose={() => setModal(null)} />}
      {modal === 'share' && (
        <PageShareModal
          page={{ id, title: title.trim() || UNTITLED, owner: meta.owner }}
          onSaved={(sharedWith) => setMeta((m) => ({ ...m, sharedWith }))}
          onClose={() => setModal(null)}
        />
      )}
      {confirm === 'reload' && (
        <ConfirmDialog
          title="Reload the latest version?"
          body="Your unsaved edits on this page will be discarded. Use Copy my text first if you want to keep them."
          confirmLabel="Discard and reload"
          busyLabel="Reloading…"
          onConfirm={reloadLatest}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'delete' && (
        <ConfirmDialog
          title={`Delete "${title.trim() || UNTITLED}"?`}
          body="The page is removed for you and everyone it's shared with."
          confirmLabel="Delete page"
          busyLabel="Deleting…"
          onConfirm={deletePage}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
};

/** Shown for a missing page and for one you don't have access to: the API answers 404 for both. */
const PageEditorLoader: React.FC<{ id: string }> = ({ id }) => {
  const [page, setPage] = useState<PageDetail | null>(null);
  const [failure, setFailure] = useState<{ notFound: boolean; message: string } | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setFailure(null);
    try {
      const next = await workspaceService.getPage(id);
      if (mine === seq.current) setPage(next);
    } catch (err) {
      if (mine === seq.current) setFailure({ notFound: hubErrorStatus(err) === 404, message: hubErrorMessage(err, "Couldn't open this page.") });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (page) return <PageWorkspace initial={page} />;

  const crumbs = [{ label: 'My Space', to: '/pages' }, { label: failure ? 'Page' : 'Loading…' }];
  return (
    <>
      <FormsTopbar crumbs={crumbs} />
      <main className="ws-editor">
        {failure ? (
          <div className="hub-card">
            {failure.notFound ? (
              <EmptyState icon="file" title="This page doesn't exist or isn't shared with you.">
                <Link className="hub-btn" to="/pages">
                  Back to My Space
                </Link>
              </EmptyState>
            ) : (
              <EmptyState icon="alert" title="Couldn't open this page" text={failure.message} actionLabel="Try again" actionIcon="refresh" onAction={load} />
            )}
          </div>
        ) : (
          <div className="ws-loading" aria-busy="true" aria-label="Loading">
            <Skeleton width="55%" height={30} />
            <Skeleton />
            <Skeleton width="85%" />
            <Skeleton width="65%" />
          </div>
        )}
      </main>
    </>
  );
};

const PageEditor: React.FC = () => {
  const { id = '' } = useParams();
  // The key gives each page its own editor and autosave when moving between pages, e.g. after Duplicate.
  return <PageEditorLoader key={id} id={id} />;
};

export default PageEditor;
