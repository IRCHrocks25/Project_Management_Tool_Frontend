/**
 * Forms list (/forms): start a form (blank or from a template), then All / My forms / Templates
 * with search. Rows open the builder; the menu copies the link, duplicates or deletes.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formsErrorMessage, formsService, FormSummary, publicFormUrl } from '../../services/forms.service';
import { Badge } from '../hub/ui/Badge';
import ConfirmDialog from '../hub/ui/ConfirmDialog';
import EmptyState from '../hub/ui/EmptyState';
import Icon from '../hub/ui/Icon';
import OverflowMenu from '../hub/ui/OverflowMenu';
import { Skeleton } from '../hub/ui/Skeleton';
import { useToast } from '../hub/ui/Toast';
import { Who } from '../hub/ui/Avatar';
import { when } from '../hub/hubUtils';
import FormsTopbar from './FormsTopbar';
import { STATUS_BADGE } from './formsUtils';

type Scope = 'all' | 'mine' | 'templates';
const SCOPES: { key: Scope; label: string }[] = [
  { key: 'all', label: 'All forms' },
  { key: 'mine', label: 'My forms' },
  { key: 'templates', label: 'Templates' },
];
const SCOPE_KEY = 'forms-scope';

const readScope = (): Scope => {
  try {
    const s = localStorage.getItem(SCOPE_KEY) as Scope | null;
    return s && SCOPES.some((x) => x.key === s) ? s : 'all';
  } catch {
    return 'all';
  }
};

const FormsHome: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [scope, setScope] = useState<Scope>(readScope);
  const [q, setQ] = useState('');
  const [forms, setForms] = useState<FormSummary[] | null>(null);
  const [templates, setTemplates] = useState<FormSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null); // 'blank' or a template id
  const [confirmDelete, setConfirmDelete] = useState<FormSummary | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setForms(await formsService.list(scope, q));
    } catch (err) {
      setError(formsErrorMessage(err, "Couldn't load the forms."));
    }
  }, [scope, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    formsService.list('templates').then(setTemplates).catch(() => setTemplates([]));
  }, []);

  const pickScope = (s: Scope) => {
    setScope(s);
    setForms(null);
    try {
      localStorage.setItem(SCOPE_KEY, s);
    } catch {
      /* ignore */
    }
  };

  const start = async (templateId?: string) => {
    setCreating(templateId || 'blank');
    try {
      const form = await formsService.create(templateId ? { fromTemplateId: templateId } : {});
      navigate(`/forms/${form.id}`);
    } catch (err) {
      toast.error(formsErrorMessage(err, "Couldn't create the form."));
      setCreating(null);
    }
  };

  const copyLink = async (f: FormSummary) => {
    if (!f.publicToken) return;
    try {
      await navigator.clipboard.writeText(publicFormUrl(f.publicToken));
      toast.show('Link copied');
    } catch {
      toast.error("Couldn't copy. Open the form and copy the link from there.");
    }
  };

  const duplicate = async (f: FormSummary) => {
    try {
      const copy = await formsService.action(f.id, 'duplicate');
      navigate(`/forms/${copy.id}`);
    } catch (err) {
      toast.error(formsErrorMessage(err, "Couldn't duplicate the form."));
    }
  };

  const isTemplates = scope === 'templates';

  return (
    <>
      <FormsTopbar crumbs={[{ label: 'Forms' }]} />
      <main className="hub-page" id="forms-main">
        <div className="hub-ph">
          <div className="hub-ph-text">
            <h1>Forms</h1>
            <p>Build forms for clients, share a link, and read every answer here. Files go straight to Iceberg.</p>
          </div>
        </div>

        <section className="hub-sec" aria-labelledby="fm-start-h">
          <div className="hub-sec-h">
            <h2 id="fm-start-h">Start a new form</h2>
          </div>
          <div className="fm-tpl-grid">
            <button type="button" className="fm-tpl fm-blank" onClick={() => start()} disabled={!!creating}>
              {creating === 'blank' ? <span className="hub-spin" /> : <Icon name="plus" size={22} />}
              <b>Blank form</b>
            </button>
            {templates === null
              ? [0, 1].map((i) => (
                  <div className="fm-tpl" key={i} aria-hidden="true">
                    <Skeleton width="60%" />
                    <Skeleton width="90%" height={10} />
                  </div>
                ))
              : templates.map((t) => (
                  <button key={t.id} type="button" className="fm-tpl" onClick={() => start(t.id)} disabled={!!creating}>
                    <b>
                      {creating === t.id ? <span className="hub-spin" style={{ display: 'inline-block', marginRight: 6 }} /> : null}
                      {t.title}
                    </b>
                    <span>{t.description || `${t.questionCount} question${t.questionCount === 1 ? '' : 's'}`}</span>
                  </button>
                ))}
          </div>
        </section>

        <section className="hub-sec" aria-labelledby="fm-list-h">
          <h2 id="fm-list-h" className="hub-sr">
            Your forms
          </h2>
          <div className="hub-sec-h">
            <div className="hub-seg fm-scope" role="group" aria-label="Show">
              {SCOPES.map((s) => (
                <button key={s.key} type="button" aria-pressed={scope === s.key} onClick={() => pickScope(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="hub-sp fm-search">
              <Icon name="search" />
              <input
                className="hub-inp"
                type="search"
                placeholder="Search by title"
                aria-label="Search forms by title"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <div className="hub-card hub-tw">
            {error ? (
              <EmptyState icon="alert" title="Couldn't load the forms" text={error} actionLabel="Try again" actionIcon="refresh" onAction={load} />
            ) : !forms ? (
              <div aria-busy="true" aria-label="Loading">
                {[0, 1, 2].map((i) => (
                  <div className="hub-list-row" key={i}>
                    <div style={{ flex: 1, display: 'grid', gap: 6 }}>
                      <Skeleton width={`${35 + i * 10}%`} />
                      <Skeleton width="25%" height={10} />
                    </div>
                    <Skeleton width={90} height={22} />
                  </div>
                ))}
              </div>
            ) : !forms.length ? (
              q ? (
                <EmptyState icon="search" title="No forms match" text={`Nothing called "${q}". Try another word.`} />
              ) : isTemplates ? (
                <EmptyState
                  icon="file"
                  title="No templates yet"
                  text='Open any form and choose "Save as template" to reuse it for other clients.'
                />
              ) : (
                <EmptyState
                  icon="file"
                  title={scope === 'mine' ? "You haven't made a form yet" : 'No forms yet'}
                  text="Start from a blank form or a template above, add your questions, then publish to get a link for your client."
                  actionLabel="Blank form"
                  onAction={() => start()}
                />
              )
            ) : (
              <table className="hub-tbl hub-rt">
                <thead>
                  <tr>
                    <th scope="col">{isTemplates ? 'Template' : 'Form'}</th>
                    {!isTemplates && <th scope="col">Status</th>}
                    {!isTemplates && <th scope="col">Responses</th>}
                    <th scope="col">Owner</th>
                    <th scope="col">Edited</th>
                    <th scope="col" className="hub-act">
                      <span className="hub-sr">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {forms.map((f) => {
                    const open = () => navigate(`/forms/${f.id}`);
                    return (
                      <tr
                        key={f.id}
                        className="hub-click"
                        tabIndex={0}
                        onClick={open}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target === e.currentTarget) open();
                        }}
                      >
                        <td>
                          <Link className="hub-row-link" to={`/forms/${f.id}`} onClick={(e) => e.stopPropagation()} tabIndex={-1}>
                            {f.title}
                          </Link>
                          <div className="hub-cell-sub">
                            {f.project ? `${f.project.name} · ` : ''}
                            {f.questionCount} question{f.questionCount === 1 ? '' : 's'}
                          </div>
                        </td>
                        {!isTemplates && (
                          <td data-l="Status">
                            <Badge tone={STATUS_BADGE[f.status].tone}>{STATUS_BADGE[f.status].label}</Badge>
                          </td>
                        )}
                        {!isTemplates && (
                          <td data-l="Responses">
                            {f.responseCount ? (
                              <Link to={`/forms/${f.id}/responses`} onClick={(e) => e.stopPropagation()}>
                                {f.responseCount}
                              </Link>
                            ) : (
                              <span className="hub-muted">0</span>
                            )}
                            {f.lastResponseAt ? <span className="hub-cell-sub"> · last {when(f.lastResponseAt)}</span> : null}
                          </td>
                        )}
                        <td data-l="Owner">
                          <Who user={f.owner} fallback="No owner" />
                        </td>
                        <td data-l="Edited">{when(f.updatedAt)}</td>
                        <td className="hub-act" onClick={(e) => e.stopPropagation()}>
                          <OverflowMenu
                            label={`More actions for ${f.title}`}
                            items={[
                              { label: isTemplates ? 'Use template' : 'Open', icon: 'edit', onSelect: () => (isTemplates ? start(f.id) : open()) },
                              { label: 'Edit template', icon: 'edit', hidden: !isTemplates, onSelect: open },
                              { label: 'Copy link', icon: 'link', hidden: !f.publicToken, onSelect: () => copyLink(f) },
                              { label: 'Duplicate', icon: 'copy', onSelect: () => duplicate(f) },
                              { label: isTemplates ? 'Delete template' : 'Delete form', icon: 'trash', danger: true, onSelect: () => setConfirmDelete(f) },
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
          body={
            confirmDelete.isTemplate ? (
              <>The template is removed. Forms already made from it are not affected.</>
            ) : (
              <>
                The form is removed and its link stops working.
                {confirmDelete.responseCount ? ` Its ${confirmDelete.responseCount} response${confirmDelete.responseCount === 1 ? ' is' : 's are'} kept on the server.` : ''}
              </>
            )
          }
          confirmLabel={confirmDelete.isTemplate ? 'Delete template' : 'Delete form'}
          busyLabel="Deleting…"
          onConfirm={async () => {
            await formsService.remove(confirmDelete.id);
            toast.show('Deleted');
            setConfirmDelete(null);
            load();
            if (confirmDelete.isTemplate) formsService.list('templates').then(setTemplates).catch(() => undefined);
          }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
};

export default FormsHome;
