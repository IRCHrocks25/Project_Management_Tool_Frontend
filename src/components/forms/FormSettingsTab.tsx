/**
 * Settings tab: linked project (its PM is notified of new responses), what to ask the
 * respondent, the thank-you message, and the public link.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { FormDetail, FormUpdate, publicFormUrl } from '../../services/forms.service';
import { projectService } from '../../services/project.service';
import Icon from '../hub/ui/Icon';
import ConfirmDialog from '../hub/ui/ConfirmDialog';

interface Props {
  form: FormDetail;
  onChange: (patch: FormUpdate & { project?: { id: string; name: string } | null }) => void;
  onRegenerate: () => Promise<unknown>;
}

const FormSettingsTab: React.FC<Props> = ({ form, onChange, onRegenerate }) => {
  const [projects, setProjects] = useState<{ id: string; name: string }[] | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);

  useEffect(() => {
    projectService
      .getAll()
      .then((list) => setProjects(list.map((p: any) => ({ id: p.id, name: p.clientName || 'Unnamed project' }))))
      .catch(() => setProjects([]));
  }, []);

  // Keep the current project selectable even if it is archived and missing from the list.
  const options = useMemo(() => {
    const list = [...(projects || [])].sort((a, b) => a.name.localeCompare(b.name));
    if (form.project && !list.some((p) => p.id === form.project!.id)) list.unshift(form.project);
    return list;
  }, [projects, form.project]);

  const s = form.settings;

  return (
    <>
      <section className="hub-card" style={{ padding: 'var(--s5)' }} aria-labelledby="fm-set-project">
        <div className="hub-fgrid">
          <div className="hub-fld">
            <label id="fm-set-project" htmlFor="fm-project">
              Client project<span className="hub-opt">optional</span>
            </label>
            <select
              id="fm-project"
              className="hub-inp hub-w-md"
              value={form.project?.id || ''}
              disabled={projects === null}
              onChange={(e) => {
                const id = e.target.value || null;
                onChange({ projectId: id, project: id ? options.find((p) => p.id === id) || null : null });
              }}
            >
              <option value="">{projects === null ? 'Loading projects…' : 'No project'}</option>
              {options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="hub-hint">The project's PM gets a notification for every response, as well as you.</p>
          </div>
        </div>
      </section>

      <section className="hub-card" style={{ padding: 'var(--s5)' }} aria-labelledby="fm-set-resp">
        <div className="hub-fgrid">
          <h2 id="fm-set-resp" style={{ fontSize: 15, fontWeight: 600 }}>
            Responses
          </h2>
          <label className="hub-toggle" htmlFor="fm-name">
            <input id="fm-name" type="checkbox" checked={s.collectName} onChange={(e) => onChange({ settings: { collectName: e.target.checked } })} />
            <span className="hub-tg" aria-hidden="true" />
            <span>
              Ask for their name
              <br />
              <span className="hub-small hub-muted">Required when on. Shown on each response.</span>
            </span>
          </label>
          <label className="hub-toggle" htmlFor="fm-email">
            <input id="fm-email" type="checkbox" checked={s.collectEmail} onChange={(e) => onChange({ settings: { collectEmail: e.target.checked } })} />
            <span className="hub-tg" aria-hidden="true" />
            <span>
              Ask for their email
              <br />
              <span className="hub-small hub-muted">Required when on, and checked to be a valid address.</span>
            </span>
          </label>
          <div className="hub-fld">
            <label htmlFor="fm-confirm">Thank-you message</label>
            <textarea
              id="fm-confirm"
              className="hub-inp"
              rows={3}
              maxLength={1000}
              value={s.confirmationMessage}
              onChange={(e) => onChange({ settings: { confirmationMessage: e.target.value } })}
            />
            <p className="hub-hint">Shown after they submit.</p>
          </div>
        </div>
      </section>

      {!form.isTemplate && (
        <section className="hub-card" style={{ padding: 'var(--s5)' }} aria-labelledby="fm-set-link">
          <div className="hub-fgrid">
            <h2 id="fm-set-link" style={{ fontSize: 15, fontWeight: 600 }}>
              Link
            </h2>
            {form.publicToken ? (
              <>
                <input className="hub-inp hub-mono" readOnly value={publicFormUrl(form.publicToken)} aria-label="Public link" onFocus={(e) => e.currentTarget.select()} />
                <div className="hub-acts" style={{ justifyContent: 'flex-start' }}>
                  <button type="button" className="hub-btn hub-btn-sm" onClick={() => setConfirmRegen(true)}>
                    <Icon name="refresh" /> Create a new link
                  </button>
                </div>
                <p className="hub-hint">Use this if the link was sent to the wrong person. The old link stops working at once.</p>
              </>
            ) : (
              <p className="hub-muted">Publish the form to get a link for your client.</p>
            )}
          </div>
        </section>
      )}

      {confirmRegen && (
        <ConfirmDialog
          title="Create a new link?"
          body="Anyone with the current link won't be able to open the form any more. Send the new link to your client."
          confirmLabel="Create new link"
          tone="primary"
          busyLabel="Creating…"
          onConfirm={async () => {
            await onRegenerate();
            setConfirmRegen(false);
          }}
          onClose={() => setConfirmRegen(false)}
        />
      )}
    </>
  );
};

export default FormSettingsTab;
