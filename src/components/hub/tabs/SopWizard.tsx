/**
 * SopWizard — create or edit an SOP in three steps: Basics → Steps → Review.
 *
 *   <SopWizard product={product} onClose={…} onSaved={(sop) => …} />            create
 *   <SopWizard product={product} sop={sop} onClose={…} onSaved={(sop) => …} />  edit (prefilled)
 *
 * Steps: a dynamic list (add, remove, move up / down; at least one). Each step can carry links
 * shown as buttons in the checklist: a web address, another tab of this product, a Vault item or
 * a file. On edit, existing steps are sent back with their id so everyone's progress is kept.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Credential,
  hubService,
  HubTab,
  ProductDetail,
  ProductFile,
  ProductSop,
  SopLinkKind,
  SopStepLink,
} from '../../../services/hub.service';
import { FormErrors, ReviewList, TextField, useForm, UserField } from '../ui/FormModal';
import Icon, { IconName } from '../ui/Icon';
import MentionInput from '../ui/MentionInput';
import { Wizard } from '../ui/Wizard';
import { currentHubUser, useHubUsers } from '../ui/users';
import { HUB_TABS, isValidUrl, stripMentions } from '../hubUtils';
import '../hub-sops.css';

interface StepDraft {
  key: string;
  id?: string;
  text: string;
  links: SopStepLink[];
}

interface SopValues {
  title: string;
  audience: string;
  ownerId: string;
  steps: StepDraft[];
}

let draftSeq = 0;
const newDraft = (text = ''): StepDraft => ({ key: `d${++draftSeq}`, text, links: [] });

export const SOP_LINK_KIND: Record<SopLinkKind, { label: string; icon: IconName }> = {
  url: { label: 'Web address', icon: 'ext' },
  tab: { label: 'Tab in this product', icon: 'link' },
  credential: { label: 'Vault item', icon: 'key' },
  file: { label: 'File', icon: 'file' },
};

/* ------------------------------------------------------------------ */
/* Link mini-form                                                      */
/* ------------------------------------------------------------------ */

const LinkForm: React.FC<{
  uid: string;
  credentials: Credential[] | null;
  files: ProductFile[] | null;
  onAdd: (link: SopStepLink) => void;
  onCancel: () => void;
}> = ({ uid, credentials, files, onAdd, onCancel }) => {
  const [kind, setKind] = useState<SopLinkKind>('url');
  const [ref, setRef] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<{ ref?: string; label?: string }>({});
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const defaultLabel = (k: SopLinkKind, r: string) => {
    if (k === 'tab') return HUB_TABS.find((t) => t.key === r)?.label ? `Open ${HUB_TABS.find((t) => t.key === r)?.label}` : '';
    if (k === 'credential') return credentials?.find((c) => c.id === r)?.label || '';
    if (k === 'file') return files?.find((f) => f.id === r)?.name || '';
    return '';
  };

  const add = () => {
    const errs: { ref?: string; label?: string } = {};
    const r = ref.trim();
    const l = label.trim() || defaultLabel(kind, r);
    if (!r) errs.ref = kind === 'url' ? 'Enter the web address.' : 'Choose where the link goes.';
    else if (kind === 'url' && !isValidUrl(r)) errs.ref = 'Enter a full web address starting with https://';
    if (!l) errs.label = 'Give the link a short name.';
    setError(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`${uid}-${errs.ref ? 'ref' : 'label'}`)?.focus();
      return;
    }
    onAdd({ kind, ref: r, label: l });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault();
      add();
    }
  };

  const err = (k: 'ref' | 'label') =>
    error[k] ? (
      <p className="hub-err" id={`${uid}-${k}-e`} role="alert">
        <Icon name="alert" size={14} />
        {error[k]}
      </p>
    ) : null;

  let target: React.ReactNode;
  if (kind === 'url') {
    target = (
      <input
        id={`${uid}-ref`}
        className="hub-inp"
        type="url"
        inputMode="url"
        placeholder="https://"
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        onKeyDown={onKey}
        aria-invalid={error.ref ? 'true' : 'false'}
        aria-describedby={error.ref ? `${uid}-ref-e` : undefined}
      />
    );
  } else {
    const opts: { value: string; label: string }[] =
      kind === 'tab'
        ? HUB_TABS.map((t) => ({ value: t.key, label: t.label }))
        : kind === 'credential'
        ? (credentials || []).map((c) => ({ value: c.id, label: c.label }))
        : (files || []).map((f) => ({ value: f.id, label: `${f.name}${f.folder ? ` · ${f.folder}` : ''}` }));
    const loading = (kind === 'credential' && !credentials) || (kind === 'file' && !files);
    target = (
      <select
        id={`${uid}-ref`}
        className="hub-inp"
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        aria-invalid={error.ref ? 'true' : 'false'}
        aria-describedby={error.ref ? `${uid}-ref-e` : undefined}
      >
        <option value="">
          {loading ? 'Loading…' : opts.length ? 'Choose…' : kind === 'credential' ? 'No Vault items yet' : kind === 'file' ? 'No files yet' : 'Choose…'}
        </option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="hub-linkform" role="group" aria-label="Add a link to this step">
      <div className="hub-frow">
        <div className="hub-fld">
          <label htmlFor={`${uid}-kind`}>Link to</label>
          <select
            id={`${uid}-kind`}
            ref={firstRef}
            className="hub-inp"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as SopLinkKind);
              setRef('');
              setError({});
            }}
          >
            {(Object.keys(SOP_LINK_KIND) as SopLinkKind[]).map((k) => (
              <option key={k} value={k}>
                {SOP_LINK_KIND[k].label}
              </option>
            ))}
          </select>
        </div>
        <div className="hub-fld">
          <label htmlFor={`${uid}-ref`}>{kind === 'url' ? 'Web address' : kind === 'tab' ? 'Tab' : kind === 'credential' ? 'Vault item' : 'File'}</label>
          {target}
          {err('ref')}
        </div>
      </div>
      <div className="hub-fld">
        <label htmlFor={`${uid}-label`}>
          Button text<span className="hub-opt">Optional for tabs, Vault items and files</span>
        </label>
        <input
          id={`${uid}-label`}
          className="hub-inp"
          value={label}
          placeholder={defaultLabel(kind, ref) || 'e.g. Open the admin panel'}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={onKey}
          maxLength={80}
          aria-invalid={error.label ? 'true' : 'false'}
          aria-describedby={error.label ? `${uid}-label-e` : undefined}
        />
        {err('label')}
      </div>
      <div className="hub-acts">
        <button type="button" className="hub-btn hub-btn-sm hub-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="hub-btn hub-btn-sm" onClick={add}>
          <Icon name="plus" size={14} />
          Add link
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Steps editor                                                        */
/* ------------------------------------------------------------------ */

const StepsEditor: React.FC<{
  id: string;
  steps: StepDraft[];
  error?: string;
  credentials: Credential[] | null;
  files: ProductFile[] | null;
  onChange: (steps: StepDraft[]) => void;
}> = ({ id, steps, error, credentials, files, onChange }) => {
  const [linking, setLinking] = useState<string | null>(null);
  const focusKey = useRef<string | null>(null);

  useEffect(() => {
    if (!focusKey.current) return;
    const el = document.getElementById(`${id}-${focusKey.current}`);
    focusKey.current = null;
    el?.focus();
  });

  const update = (key: string, patch: Partial<StepDraft>) => onChange(steps.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const addAfter = (index: number) => {
    const d = newDraft();
    const next = steps.slice();
    next.splice(index + 1, 0, d);
    focusKey.current = d.key;
    onChange(next);
  };
  const remove = (index: number) => {
    const next = steps.filter((_, i) => i !== index);
    const neighbour = next[Math.min(index, next.length - 1)];
    if (neighbour) focusKey.current = neighbour.key;
    onChange(next.length ? next : [newDraft()]);
  };
  const move = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= steps.length) return;
    const next = steps.slice();
    const [s] = next.splice(index, 1);
    next.splice(to, 0, s);
    onChange(next);
    // Keep focus on the same arrow if it still makes sense, else on the other one.
    window.setTimeout(() => {
      const btn =
        document.getElementById(`${id}-${s.key}-${dir < 0 ? 'up' : 'down'}`) || document.getElementById(`${id}-${s.key}-${dir < 0 ? 'down' : 'up'}`);
      if (btn && !(btn as HTMLButtonElement).disabled) btn.focus();
      else document.getElementById(`${id}-${s.key}`)?.focus();
    }, 0);
  };

  return (
    <div className="hub-fld">
      <span className="hub-label" id={`${id}-l`}>
        Steps<span className="hub-req" aria-hidden="true">*</span>
      </span>
      <p className="hub-hint" id={`${id}-h`}>
        One action per step. Type @ to mention someone. Press Enter to add the next step.
      </p>
      <div className="hub-lst" id={id} role="group" aria-labelledby={`${id}-l`} aria-describedby={`${id}-h${error ? ` ${id}-e` : ''}`}>
        {steps.map((s, i) => (
          <div className="hub-lrow" key={s.key}>
            <div className="hub-lrow-main">
              <span className="hub-lnum" aria-hidden="true">
                {i + 1}
              </span>
              <MentionInput
                id={`${id}-${s.key}`}
                multiline={false}
                value={s.text}
                onChange={(v) => update(s.key, { text: v })}
                ariaLabel={`Step ${i + 1}`}
                placeholder="Describe this step"
                invalid={!!error && !s.text.trim()}
                onKeyDown={(e) => {
                  // Enter on a filled step adds the next one; on an empty step it continues (and validates).
                  if (e.key === 'Enter' && s.text.trim()) {
                    e.preventDefault();
                    addAfter(i);
                  }
                }}
              />
              <span className="hub-lrow-acts">
                <button
                  type="button"
                  id={`${id}-${s.key}-up`}
                  className="hub-icon-btn hub-sm"
                  aria-label={`Move step ${i + 1} up`}
                  title="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <Icon name="up" size={15} />
                </button>
                <button
                  type="button"
                  id={`${id}-${s.key}-down`}
                  className="hub-icon-btn hub-sm"
                  aria-label={`Move step ${i + 1} down`}
                  title="Move down"
                  disabled={i === steps.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <Icon name="down" size={15} />
                </button>
                <button
                  type="button"
                  className="hub-icon-btn hub-sm"
                  aria-label={`Remove step ${i + 1}`}
                  title="Remove step"
                  onClick={() => remove(i)}
                  disabled={steps.length === 1 && !s.text && !s.links.length}
                >
                  <Icon name="x" size={15} />
                </button>
              </span>
            </div>
            {(s.links.length > 0 || linking !== s.key) && (
              <div className="hub-lrow-links">
                {s.links.map((l, li) => (
                  <span className="hub-lchip" key={`${l.kind}-${l.ref}-${li}`}>
                    <Icon name={SOP_LINK_KIND[l.kind]?.icon || 'link'} size={13} className="hub-muted" />
                    <span>{l.label}</span>
                    <button
                      type="button"
                      className="hub-icon-btn hub-sm"
                      aria-label={`Remove link ${l.label} from step ${i + 1}`}
                      onClick={() => update(s.key, { links: s.links.filter((_, j) => j !== li) })}
                    >
                      <Icon name="x" size={13} />
                    </button>
                  </span>
                ))}
                {linking !== s.key && (
                  <button type="button" className="hub-btn hub-btn-ghost hub-btn-sm" onClick={() => setLinking(s.key)}>
                    <Icon name="link" size={14} />
                    Add link<span className="hub-sr"> to step {i + 1}</span>
                  </button>
                )}
              </div>
            )}
            {linking === s.key && (
              <LinkForm
                uid={`${id}-${s.key}-lf`}
                credentials={credentials}
                files={files}
                onCancel={() => {
                  setLinking(null);
                  focusKey.current = s.key;
                }}
                onAdd={(link) => {
                  update(s.key, { links: [...s.links, link] });
                  setLinking(null);
                  focusKey.current = s.key;
                }}
              />
            )}
          </div>
        ))}
      </div>
      {error ? (
        <p className="hub-err" id={`${id}-e`} role="alert">
          <Icon name="alert" size={14} />
          {error}
        </p>
      ) : null}
      <div>
        <button type="button" className="hub-btn hub-btn-ghost hub-btn-sm" onClick={() => addAfter(steps.length - 1)}>
          <Icon name="plus" size={14} />
          Add step
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */

const SopWizard: React.FC<{
  product: ProductDetail;
  sop?: ProductSop | null;
  onClose: () => void;
  onSaved: (sop: ProductSop) => void;
}> = ({ product, sop, onClose, onSaved }) => {
  const me = currentHubUser();
  const { byId } = useHubUsers();
  const [credentials, setCredentials] = useState<Credential[] | null>(null);
  const [files, setFiles] = useState<ProductFile[] | null>(null);
  const form = useForm<SopValues>({
    title: sop?.title || '',
    audience: sop?.audience || '',
    ownerId: sop?.ownerId || me?.id || '',
    steps: sop && sop.steps.length ? sop.steps.map((s) => ({ key: s.id, id: s.id, text: s.text, links: s.links || [] })) : [newDraft(), newDraft()],
  });

  useEffect(() => {
    let alive = true;
    hubService
      .listCredentials(product.id)
      .then((c) => alive && setCredentials(c || []))
      .catch(() => alive && setCredentials([]));
    hubService
      .listFiles(product.id)
      .then((f) => alive && setFiles(f || []))
      .catch(() => alive && setFiles([]));
    return () => {
      alive = false;
    };
  }, [product.id]);

  const validateSteps = (v: SopValues): FormErrors<SopValues> => {
    const filled = v.steps.filter((s) => s.text.trim());
    if (!filled.length) return { steps: 'Add at least one step.' };
    const orphan = v.steps.findIndex((s) => !s.text.trim() && s.links.length);
    if (orphan >= 0) return { steps: `Step ${orphan + 1} has a link but no text. Describe the step or remove it.` };
    return {};
  };

  const linkTarget = (l: SopStepLink) => {
    if (l.kind === 'tab') return HUB_TABS.find((t) => t.key === (l.ref as HubTab))?.label || l.ref;
    if (l.kind === 'credential') return 'Vault';
    if (l.kind === 'file') return 'Files';
    return l.ref;
  };

  return (
    <Wizard
      form={form}
      title={sop ? 'Edit SOP' : 'Create SOP'}
      description="Write the steps so someone new can follow them without asking."
      steps={[
        {
          title: 'Basics',
          fields: ['title', 'audience', 'ownerId'],
          validate: (v) => ({
            title: !v.title.trim()
              ? 'Enter a title, like "Create a transcript for a demo client".'
              : v.title.trim().length > 200
              ? 'Keep the title under 200 characters.'
              : undefined,
            ownerId: !v.ownerId ? 'Choose who keeps this SOP up to date.' : undefined,
          }),
          render: () => (
            <>
              <TextField form={form} name="title" label="Title" required width="full" placeholder="e.g. Create a transcript for a demo client" />
              <TextField form={form} name="audience" label="Who is it for" placeholder="e.g. New team members" hint="Leave empty if it's for everyone." />
              <UserField form={form} name="ownerId" label="Owner" required hint="The person who keeps this SOP up to date." />
            </>
          ),
        },
        {
          title: 'Steps',
          fields: ['steps'],
          validate: validateSteps,
          render: () => (
            <StepsEditor
              id={form.fieldId('steps')}
              steps={form.values.steps}
              error={form.errors.steps}
              credentials={credentials}
              files={files}
              onChange={(steps) => form.set('steps', steps)}
            />
          ),
        },
      ]}
      review={(v) => {
        const steps = v.steps.filter((s) => s.text.trim());
        return (
          <ReviewList
            rows={[
              ['Title', v.title.trim()],
              ['For', v.audience.trim() || 'Everyone'],
              ['Owner', byId(v.ownerId)?.name || (me && me.id === v.ownerId ? me.name : 'Not set')],
              [
                `Steps (${steps.length})`,
                <ol key="s">
                  {steps.map((s) => (
                    <li key={s.key}>
                      {stripMentions(s.text)}
                      {s.links.length ? (
                        <span className="hub-muted hub-small"> · {s.links.map((l) => `${l.label} (${linkTarget(l)})`).join(', ')}</span>
                      ) : null}
                    </li>
                  ))}
                </ol>,
              ],
            ]}
          />
        );
      }}
      submitLabel={sop ? 'Save changes' : 'Create SOP'}
      failMessage={sop ? "Couldn't save the SOP." : "Couldn't create the SOP."}
      mapServerError={(msg) => (/title/i.test(msg) ? { title: msg } : /step/i.test(msg) ? { steps: msg } : null)}
      onSubmit={async (v) => {
        const steps = v.steps
          .filter((s) => s.text.trim())
          .map((s) => ({ ...(s.id ? { id: s.id } : {}), text: s.text.trim(), links: s.links }));
        const input = { title: v.title.trim(), audience: v.audience.trim() || null, ownerId: v.ownerId, steps };
        const saved = sop ? await hubService.updateSop(product.id, sop.id, input) : await hubService.createSop(product.id, input);
        onSaved(saved);
        return sop ? 'Changes saved' : `"${input.title}" created`;
      }}
      onClose={onClose}
    />
  );
};

export default SopWizard;
