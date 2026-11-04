/**
 * Form editor (/forms/:id/:tab?): Questions | Responses | Settings.
 *
 * Edits autosave: changes are batched for ~0.8 s and sent as one PATCH. While a save is in
 * flight, newer edits wait for the next save, so the server never overwrites what you typed.
 * Publishing first flushes any pending save.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FormDetail, formsErrorMessage, formsService, FormUpdate, publicFormUrl } from '../../services/forms.service';
import { Badge } from '../hub/ui/Badge';
import ConfirmDialog from '../hub/ui/ConfirmDialog';
import EmptyState from '../hub/ui/EmptyState';
import Icon from '../hub/ui/Icon';
import OverflowMenu from '../hub/ui/OverflowMenu';
import { SkeletonPage } from '../hub/ui/Skeleton';
import { useToast } from '../hub/ui/Toast';
import FormsTopbar from './FormsTopbar';
import FormQuestions from './FormQuestions';
import FormResponses from './FormResponses';
import FormSettingsTab from './FormSettingsTab';
import { STATUS_BADGE } from './formsUtils';

type Tab = 'questions' | 'responses' | 'settings';
const TABS: { key: Tab; label: string }[] = [
  { key: 'questions', label: 'Questions' },
  { key: 'responses', label: 'Responses' },
  { key: 'settings', label: 'Settings' },
];

type SaveState = 'saved' | 'pending' | 'saving' | 'error';

const SAVED_FIELDS: (keyof FormUpdate)[] = ['title', 'description', 'projectId', 'items', 'settings'];

const FormEditor: React.FC = () => {
  const { id = '', tab: tabParam } = useParams();
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : 'questions';
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState<FormDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'close' | 'delete' | null>(null);

  // Unsaved changes, the timer that sends them, and whether a save is running.
  const pending = useRef<FormUpdate>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void> | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setForm(await formsService.get(id));
    } catch (err) {
      setLoadError(formsErrorMessage(err, "Couldn't load the form."));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const flush = useCallback(async (): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inflight.current) await inflight.current;
    const body = pending.current;
    if (!Object.keys(body).length) return;
    pending.current = {};
    setSave('saving');
    const run = (async () => {
      try {
        const saved = await formsService.update(id, body);
        setSaveError(null);
        setForm((cur) => {
          if (!cur) return saved;
          // Keep anything edited since this save started; take server values for the rest
          // (the server sets image URLs and fills defaults).
          const next = { ...saved };
          const newer = pending.current;
          (Object.keys(newer) as (keyof FormUpdate)[]).forEach((k) => {
            (next as any)[k] = (cur as any)[k];
          });
          return next;
        });
        setSave(Object.keys(pending.current).length ? 'pending' : 'saved');
      } catch (err) {
        // Put the failed changes back under anything newer, so Retry sends them again.
        pending.current = { ...body, ...pending.current };
        setSaveError(formsErrorMessage(err, "Couldn't save your changes."));
        setSave('error');
      }
    })();
    inflight.current = run;
    await run;
    inflight.current = null;
    if (Object.keys(pending.current).length && !timer.current) {
      timer.current = setTimeout(() => flush(), 800);
    }
  }, [id]);

  /**
   * Apply a change locally now and queue it for the server. Only API fields are sent;
   * display-only fields in the patch (e.g. the linked `project` name) just update the page.
   */
  const change = useCallback(
    (patch: FormUpdate & Partial<Pick<FormDetail, 'project'>>) => {
      setForm((cur) => (cur ? ({ ...cur, ...patch, settings: { ...cur.settings, ...(patch.settings || {}) } } as FormDetail) : cur));
      const sendable: FormUpdate = {};
      SAVED_FIELDS.forEach((k) => {
        if (patch[k] !== undefined) (sendable as any)[k] = patch[k];
      });
      pending.current = {
        ...pending.current,
        ...sendable,
        ...(patch.settings ? { settings: { ...(pending.current.settings || {}), ...patch.settings } } : {}),
      };
      setSave('pending');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => flush(), 800);
    },
    [flush],
  );

  // Send pending changes when leaving the page; warn if the browser tab closes with unsaved edits.
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) {
        flush();
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      flush();
    };
  }, [flush]);

  const run = async (label: string, fn: () => Promise<FormDetail | void>, done?: string) => {
    setBusy(label);
    try {
      await flush();
      const result = await fn();
      if (result) setForm((cur) => (cur ? { ...cur, ...result, items: cur.items, title: cur.title, description: cur.description } : result));
      if (done) toast.show(done);
      return result;
    } catch (err) {
      toast.error(formsErrorMessage(err, 'Something went wrong. Try again.'));
      return undefined;
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(publicFormUrl(token));
      toast.show('Link copied');
    } catch {
      toast.error("Couldn't copy. Select the link and copy it yourself.");
    }
  };

  const publish = async () => {
    const result = await run('publish', () => formsService.action(id, 'publish'));
    if (result && result.publicToken) {
      toast.show('Published. The link is copied, send it to your client.');
      navigator.clipboard?.writeText(publicFormUrl(result.publicToken)).catch(() => undefined);
    }
  };

  const goTab = (t: Tab) => navigate(t === 'questions' ? `/forms/${id}` : `/forms/${id}/${t}`);

  if (loadError) {
    return (
      <>
        <FormsTopbar crumbs={[{ label: 'Forms', to: '/forms' }, { label: 'Form' }]} />
        <main className="hub-page">
          <div className="hub-card">
            <EmptyState icon="alert" title="Couldn't open this form" text={loadError} actionLabel="Try again" actionIcon="refresh" onAction={load} />
          </div>
        </main>
      </>
    );
  }
  if (!form) {
    return (
      <>
        <FormsTopbar crumbs={[{ label: 'Forms', to: '/forms' }, { label: 'Loading…' }]} />
        <SkeletonPage />
      </>
    );
  }

  const status = STATUS_BADGE[form.status];
  const saveLabel =
    save === 'saving' || save === 'pending' ? (
      <span className="fm-save" role="status">
        <span className="hub-spin" /> Saving…
      </span>
    ) : save === 'error' ? (
      <span className="fm-save fm-save-err" role="alert">
        <Icon name="alert" /> Not saved{' '}
        <button type="button" className="hub-link" onClick={() => flush()}>
          Retry
        </button>
      </span>
    ) : (
      <span className="fm-save" role="status">
        <Icon name="check" /> Saved
      </span>
    );

  return (
    <>
      <FormsTopbar crumbs={[{ label: form.isTemplate ? 'Templates' : 'Forms', to: '/forms' }, { label: form.title || 'Untitled form' }]}>
        {saveLabel}
        {!form.isTemplate && form.publicToken && form.status === 'open' && (
          <a className="hub-btn hub-btn-ghost hub-btn-sm" href={publicFormUrl(form.publicToken)} target="_blank" rel="noopener noreferrer">
            <Icon name="eye" /> Preview
          </a>
        )}
        {!form.isTemplate && form.publicToken && (
          <button type="button" className="hub-btn hub-btn-sm" onClick={() => copyLink(form.publicToken!)}>
            <Icon name="link" /> Copy link
          </button>
        )}
        {!form.isTemplate && form.status === 'draft' && (
          <button type="button" className="hub-btn hub-btn-primary hub-btn-sm" onClick={publish} disabled={!!busy}>
            {busy === 'publish' ? <span className="hub-spin" /> : <Icon name="share" />} Publish
          </button>
        )}
        {!form.isTemplate && form.status === 'closed' && (
          <button
            type="button"
            className="hub-btn hub-btn-primary hub-btn-sm"
            onClick={() => run('reopen', () => formsService.action(id, 'reopen'), 'Accepting responses again')}
            disabled={!!busy}
          >
            {busy === 'reopen' ? <span className="hub-spin" /> : null} Reopen
          </button>
        )}
        <OverflowMenu
          label="More form actions"
          size="md"
          items={[
            { label: 'Stop accepting responses', icon: 'archive', hidden: form.status !== 'open', onSelect: () => setConfirm('close') },
            {
              label: 'Duplicate',
              icon: 'copy',
              onSelect: async () => {
                const copy = await run('duplicate', () => formsService.action(id, 'duplicate'));
                if (copy) navigate(`/forms/${copy.id}`);
              },
            },
            {
              label: 'Save as template',
              icon: 'file',
              hidden: form.isTemplate,
              onSelect: () => run('template', () => formsService.action(id, 'save-as-template').then(() => undefined), 'Saved as a template'),
            },
            { label: form.isTemplate ? 'Delete template' : 'Delete form', icon: 'trash', danger: true, onSelect: () => setConfirm('delete') },
          ]}
        />
      </FormsTopbar>

      <div className="fm-editor">
        <div className="hub-ph">
          <div className="hub-ph-meta">
            {form.isTemplate ? <Badge tone="acc">Template</Badge> : <Badge tone={status.tone}>{status.label}</Badge>}
            {form.project ? <Badge plain>{form.project.name}</Badge> : null}
          </div>
        </div>
        {saveError && save === 'error' && (
          <div className="hub-notice hub-crit" role="alert">
            <Icon name="alert" />
            <div className="hub-grow">{saveError}</div>
          </div>
        )}
        <div className="hub-tabs" role="tablist" aria-label="Form sections">
          {TABS.filter((t) => !(form.isTemplate && t.key === 'responses')).map((t) => (
            <button key={t.key} type="button" role="tab" className="hub-tab" aria-selected={tab === t.key} onClick={() => goTab(t.key)}>
              {t.label}
              {t.key === 'responses' && form.responseCount ? <span className="hub-n">{form.responseCount}</span> : null}
            </button>
          ))}
        </div>

        {tab === 'questions' && <FormQuestions form={form} onChange={change} onCopyLink={copyLink} />}
        {tab === 'responses' && <FormResponses form={form} />}
        {tab === 'settings' && (
          <FormSettingsTab
            form={form}
            onChange={change}
            onRegenerate={() => run('regen', () => formsService.action(id, 'regenerate-link'), 'New link created. The old link no longer works.')}
          />
        )}
      </div>

      {confirm === 'close' && (
        <ConfirmDialog
          title="Stop accepting responses?"
          body="People who open the link will see that the form is closed. You can reopen it at any time."
          confirmLabel="Close form"
          tone="primary"
          onConfirm={async () => {
            const result = await formsService.action(id, 'close');
            setForm((cur) => (cur ? { ...cur, status: result.status } : result));
            setConfirm(null);
            toast.show('Form closed');
          }}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'delete' && (
        <ConfirmDialog
          title={`Delete "${form.title}"?`}
          body={
            form.isTemplate
              ? 'The template is removed. Forms already made from it are not affected.'
              : 'The form is removed and its link stops working. Responses are kept on the server.'
          }
          confirmLabel={form.isTemplate ? 'Delete template' : 'Delete form'}
          busyLabel="Deleting…"
          onConfirm={async () => {
            pending.current = {};
            await formsService.remove(id);
            toast.show('Deleted');
            navigate('/forms');
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
};

export default FormEditor;
