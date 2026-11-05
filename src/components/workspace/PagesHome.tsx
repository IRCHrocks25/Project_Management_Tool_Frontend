/**
 * My Space (/pages): start a page (blank or from a template), then My pages / Shared with me with
 * search. Rows open the page; the menu duplicates or deletes.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { hubErrorMessage } from '../../services/hub.service';
import { PageSummary, workspaceService } from '../../services/workspace.service';
import FormsTopbar from '../forms/FormsTopbar';
import { when } from '../hub/hubUtils';
import { Who } from '../hub/ui/Avatar';
import { Badge } from '../hub/ui/Badge';
import ConfirmDialog from '../hub/ui/ConfirmDialog';
import EmptyState from '../hub/ui/EmptyState';
import Icon from '../hub/ui/Icon';
import OverflowMenu from '../hub/ui/OverflowMenu';
import { Skeleton } from '../hub/ui/Skeleton';
import { useDeferredDelete, useHiddenIds, useToast } from '../hub/ui/Toast';
import { PAGE_TEMPLATES, PageTemplate } from './pageTemplates';
import { shareLabel } from './pageUtils';
import './workspace-pages.css';

type View = 'mine' | 'shared';
const VIEWS: { key: View; label: string }[] = [
  { key: 'mine', label: 'My pages' },
  { key: 'shared', label: 'Shared with me' },
];
const VIEW_KEY = 'ws-pages-view';

const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'shared' ? 'shared' : 'mine';
  } catch {
    return 'mine';
  }
};

const ShareBadge: React.FC<{ page: PageSummary }> = ({ page }) => {
  const label = shareLabel(page.sharedWith);
  return label === 'Private' ? <Badge plain>{label}</Badge> : <Badge tone="acc">{label}</Badge>;
};

const PagesHome: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const hidden = useHiddenIds();
  const deferredDelete = useDeferredDelete();
  const [view, setView] = useState<View>(readView);
  const [q, setQ] = useState('');
  const [pages, setPages] = useState<PageSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null); // 'blank' or a template key
  const [confirmDelete, setConfirmDelete] = useState<PageSummary | null>(null);
  const seq = useRef(0);
  const term = q.trim();

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const rows = await workspaceService.listPages(view, term);
      if (mine === seq.current) setPages(rows);
    } catch (err) {
      if (mine === seq.current) setError(hubErrorMessage(err, "Couldn't load your pages."));
    }
  }, [view, term]);

  useEffect(() => {
    const t = setTimeout(load, term ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, term]);

  const pickView = (next: View) => {
    if (next === view) return;
    setView(next);
    setPages(null);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* the choice just isn't remembered */
    }
  };

  const start = async (template?: PageTemplate) => {
    setCreating(template ? template.key : 'blank');
    try {
      const page = await workspaceService.createPage(template ? { title: template.title, content: template.content } : {});
      navigate(`/pages/${page.id}`);
    } catch (err) {
      toast.error(hubErrorMessage(err, "Couldn't create the page."));
      setCreating(null);
    }
  };

  const duplicate = async (page: PageSummary) => {
    try {
      const copy = await workspaceService.duplicatePage(page.id);
      navigate(`/pages/${copy.id}`);
    } catch (err) {
      toast.error(hubErrorMessage(err, "Couldn't duplicate the page."));
    }
  };

  const remove = (page: PageSummary) => {
    deferredDelete({
      message: 'Page deleted',
      hide: () => hidden.add(page.id),
      restore: () => hidden.remove(page.id),
      commit: () => workspaceService.deletePage(page.id),
      onCommitted: load,
      errorMessage: "Couldn't delete the page.",
    });
  };

  const shared = view === 'shared';
  const visible = pages ? pages.filter((p) => !hidden.has(p.id)) : null;

  return (
    <>
      <FormsTopbar crumbs={[{ label: 'My Space' }]} />
      <main className="hub-page" id="pages-main">
        <div className="hub-ph">
          <div className="hub-ph-text">
            <h1>My Space</h1>
            <p>Notes, checklists and to-do lists. Private until you share them.</p>
          </div>
        </div>

        <section className="hub-sec" aria-labelledby="ws-start-h">
          <div className="hub-sec-h">
            <h2 id="ws-start-h">Start something</h2>
          </div>
          <div className="ws-tpl-grid">
            <button type="button" className="ws-tpl ws-tpl-blank" onClick={() => start()} disabled={!!creating}>
              {creating === 'blank' ? <span className="hub-spin" /> : <Icon name="plus" size={22} />}
              <b>Blank page</b>
            </button>
            {PAGE_TEMPLATES.map((t) => (
              <button key={t.key} type="button" className="ws-tpl" onClick={() => start(t)} disabled={!!creating}>
                <b>
                  {creating === t.key ? <span className="hub-spin ws-tpl-spin" /> : null}
                  {t.title}
                </b>
                <span>{t.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="hub-sec" aria-labelledby="ws-list-h">
          <h2 id="ws-list-h" className="hub-sr">
            Your pages
          </h2>
          <div className="hub-sec-h">
            <div className="hub-seg" role="group" aria-label="Show">
              {VIEWS.map((v) => (
                <button key={v.key} type="button" aria-pressed={view === v.key} onClick={() => pickView(v.key)}>
                  {v.label}
                </button>
              ))}
            </div>
            <div className="hub-sp ws-search">
              <Icon name="search" />
              <input
                className="hub-inp"
                type="search"
                placeholder="Search pages"
                aria-label="Search pages by title or text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <div className="hub-card hub-tw">
            {error ? (
              <EmptyState icon="alert" title="Couldn't load your pages" text={error} actionLabel="Try again" actionIcon="refresh" onAction={load} />
            ) : !visible ? (
              <div aria-busy="true" aria-label="Loading">
                {[0, 1, 2].map((i) => (
                  <div className="hub-list-row" key={i}>
                    <div className="ws-sk-lines">
                      <Skeleton width={`${35 + i * 10}%`} />
                      <Skeleton width="60%" height={10} />
                    </div>
                    <Skeleton width={70} height={22} />
                  </div>
                ))}
              </div>
            ) : !visible.length ? (
              term ? (
                <EmptyState icon="search" title="No pages match" text={`Nothing found for "${term}". Try another word.`} />
              ) : shared ? (
                <EmptyState icon="users" title="Nothing shared with you yet" text="Pages your colleagues share with you will show up here." />
              ) : (
                <EmptyState
                  icon="file"
                  title="You don't have any pages yet"
                  text="Start with a blank page or a template. It stays private until you share it."
                  actionLabel="Blank page"
                  onAction={() => start()}
                />
              )
            ) : (
              <table className="hub-tbl hub-rt ws-pages-tbl">
                <thead>
                  <tr>
                    <th scope="col">Page</th>
                    {shared && <th scope="col">Owner</th>}
                    {shared && <th scope="col">Access</th>}
                    <th scope="col">Shared with</th>
                    <th scope="col">Updated</th>
                    <th scope="col" className="hub-act">
                      <span className="hub-sr">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((page) => {
                    const open = () => navigate(`/pages/${page.id}`);
                    return (
                      <tr
                        key={page.id}
                        className="hub-click"
                        tabIndex={0}
                        onClick={open}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target === e.currentTarget) open();
                        }}
                      >
                        <td>
                          <div className="ws-page-cell">
                            <Link className="hub-row-link" to={`/pages/${page.id}`} onClick={(e) => e.stopPropagation()} tabIndex={-1}>
                              {page.title}
                            </Link>
                            {page.excerpt ? <div className="hub-cell-sub ws-excerpt">{page.excerpt}</div> : null}
                            {page.checklist.total > 0 ? (
                              <div className="hub-cell-sub ws-progress">
                                <Icon name="check" size={13} />
                                {page.checklist.done} of {page.checklist.total} done
                              </div>
                            ) : null}
                          </div>
                        </td>
                        {shared && (
                          <td data-l="Owner">
                            <Who user={page.owner} fallback="Unknown" />
                          </td>
                        )}
                        {shared && <td data-l="Access">{page.myAccess === 'view' ? 'Can view' : 'Can edit'}</td>}
                        <td data-l="Shared with">
                          <ShareBadge page={page} />
                        </td>
                        <td data-l="Updated" className="ws-nowrap">
                          {when(page.updatedAt)}
                        </td>
                        <td className="hub-act" onClick={(e) => e.stopPropagation()}>
                          <OverflowMenu
                            label={`More actions for ${page.title}`}
                            items={[
                              { label: 'Duplicate', icon: 'copy', onSelect: () => duplicate(page) },
                              { label: 'Delete', icon: 'trash', danger: true, hidden: page.myAccess !== 'owner', onSelect: () => setConfirmDelete(page) },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${confirmDelete.title}"?`}
          body="The page is removed for you and everyone it's shared with. You can undo this for a few seconds afterwards."
          confirmLabel="Delete page"
          onConfirm={() => remove(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
};

export default PagesHome;
