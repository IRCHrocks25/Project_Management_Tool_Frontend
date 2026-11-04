/**
 * SOPs tab — list of SOPs on the left, the selected one as a checklist on the right (stacked on
 * narrow screens).
 *
 *   - Header primary action "Create SOP" (SopWizard).
 *   - The selected SOP lives in the URL (?sop=<id>); without it the first SOP is shown.
 *   - Ticking a step tracks the signed-in person's own progress (optimistic, reverts with an
 *     error toast + Retry). Step links are buttons: a tab of this product, a web address (new
 *     browser tab), a Vault item (vault tab ?credential=<id>) or a file (files tab ?file=<id>).
 *   - "Add a step" at the bottom appends one. The overflow menu edits (wizard, prefilled) or
 *     deletes (confirm, then Undo for a few seconds).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { hubErrorMessage, hubService, HubTab, ProductDetail, ProductSop, SopStep, SopStepLink } from '../../../services/hub.service';
import { usePrimaryAction } from '../primaryAction';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import Icon from '../ui/Icon';
import MentionInput from '../ui/MentionInput';
import MentionText from '../ui/MentionText';
import OverflowMenu from '../ui/OverflowMenu';
import { Skeleton } from '../ui/Skeleton';
import { useDeferredDelete, useHiddenIds, useToast } from '../ui/Toast';
import { useHubUsers } from '../ui/users';
import { fmtDate, HUB_TABS, productPath } from '../hubUtils';
import SopWizard, { SOP_LINK_KIND } from './SopWizard';
import '../hub-sops.css';

export interface SopsTabProps {
  product: ProductDetail;
  onChanged: () => void;
}

const stepCount = (n: number) => `${n} step${n === 1 ? '' : 's'}`;

/* ------------------------------------------------------------------ */

const AddStepForm: React.FC<{ sop: ProductSop; onAdd: (text: string) => Promise<void> }> = ({ sop, onAdd }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const id = `hub-addstep-${sop.id}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busyRef.current) return;
    if (!text.trim()) {
      setError('Write the step first.');
      inputRef.current?.focus();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await onAdd(text.trim());
      setText('');
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } catch (err) {
      setError(`Couldn't add the step. ${hubErrorMessage(err)}`);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <form className="hub-addstep" onSubmit={submit} noValidate>
      <div className="hub-addstep-f">
        <label className="hub-sr" htmlFor={id}>
          Add a step to {sop.title}
        </label>
        <MentionInput
          id={id}
          multiline={false}
          value={text}
          onChange={(v) => {
            setText(v);
            if (error) setError(null);
          }}
          placeholder="Add a step. Type @ to mention someone."
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
        {busy ? <span className="hub-spin" aria-hidden="true" /> : <Icon name="plus" />}
        {busy ? 'Adding…' : 'Add step'}
      </button>
    </form>
  );
};

const SopSkeleton: React.FC = () => (
  <div className="hub-sop" aria-busy="true" aria-label="Loading SOPs">
    <div className="hub-soplist" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="hub-card" style={{ padding: 16, display: 'grid', gap: 8 }}>
          <Skeleton width="70%" />
          <Skeleton width="45%" height={10} />
        </div>
      ))}
    </div>
    <div className="hub-card" aria-hidden="true">
      <div className="hub-sop-h">
        <Skeleton width="50%" height={18} />
        <Skeleton width="35%" height={10} />
        <Skeleton height={6} />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="hub-sk-row" style={{ padding: '12px 24px', borderTop: i ? '1px solid var(--line)' : undefined }}>
          <Skeleton circle size={32} />
          <Skeleton width={`${70 - i * 10}%`} />
        </div>
      ))}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */

const SopsTab: React.FC<SopsTabProps> = ({ product, onChanged }) => {
  const toast = useToast();
  const navigate = useNavigate();
  const deferredDelete = useDeferredDelete();
  const hidden = useHiddenIds();
  const { byId } = useHubUsers();
  const [params, setParams] = useSearchParams();
  const [sops, setSops] = useState<ProductSop[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wizard, setWizard] = useState<{ sop: ProductSop | null } | null>(null);
  const [deleting, setDeleting] = useState<ProductSop | null>(null);
  const sopsRef = useRef<ProductSop[] | null>(null);
  sopsRef.current = sops;
  const selectedParam = params.get('sop');

  usePrimaryAction({ label: 'Create SOP', icon: 'plus', onClick: () => setWizard({ sop: null }) });

  const load = useCallback(async () => {
    setError(null);
    try {
      setSops(await hubService.listSops(product.id));
    } catch (err) {
      setError(hubErrorMessage(err, "Couldn't load the SOPs."));
    }
  }, [product.id]);

  useEffect(() => {
    load();
  }, [load]);

  const select = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(params);
      if (id) next.set('sop', id);
      else next.delete('sop');
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const visible = useMemo(() => (sops || []).filter((s) => !hidden.has(s.id)), [sops, hidden]);
  const selected = visible.find((s) => s.id === selectedParam) || visible[0] || null;

  useEffect(() => {
    if (!selectedParam || !sops) return;
    if (!sops.some((s) => s.id === selectedParam)) {
      toast.show("That SOP isn't here any more. It may have been deleted.", { kind: 'info' });
      select(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParam, sops]);

  const patchSop = (id: string, fn: (s: ProductSop) => ProductSop) => setSops((list) => (list || []).map((s) => (s.id === id ? fn(s) : s)));

  const toggle = async (sop: ProductSop, step: SopStep, done: boolean) => {
    const apply = (on: boolean) => (s: ProductSop) => {
      const ids = (s.completedStepIds || []).filter((x) => x !== step.id);
      return { ...s, completedStepIds: on ? [...ids, step.id] : ids };
    };
    patchSop(sop.id, apply(done));
    try {
      const res = (await hubService.setSopStepProgress(product.id, sop.id, step.id, done)) as { completedStepIds?: string[] } | null;
      const cur = (sopsRef.current || []).find((s) => s.id === sop.id);
      const stillSame = cur && (cur.completedStepIds || []).includes(step.id) === done;
      if (res && Array.isArray(res.completedStepIds) && stillSame) {
        const ids = res.completedStepIds;
        patchSop(sop.id, (s) => ({ ...s, completedStepIds: ids }));
      }
      const total = sop.steps.length;
      const n = apply(done)(sop).completedStepIds.filter((x) => sop.steps.some((st) => st.id === x)).length;
      if (done && n === total && total > 0) toast.show(`All ${total} steps done. Nice work.`);
    } catch (err) {
      const cur = (sopsRef.current || []).find((s) => s.id === sop.id);
      if (cur && (cur.completedStepIds || []).includes(step.id) === done) patchSop(sop.id, apply(!done));
      toast.error(`Couldn't save your progress. ${hubErrorMessage(err, '')}`.trim(), {
        action: {
          label: 'Retry',
          onClick: () => {
            const latest = (sopsRef.current || []).find((s) => s.id === sop.id);
            if (latest) toggle(latest, step, done);
          },
        },
      });
    }
  };

  const openLink = (l: SopStepLink) => {
    if (l.kind === 'url') {
      window.open(l.ref, '_blank', 'noopener,noreferrer');
      return;
    }
    if (l.kind === 'tab') {
      const tab = HUB_TABS.find((t) => t.key === l.ref)?.key as HubTab | undefined;
      navigate(productPath(product.slug, tab || 'overview'));
      return;
    }
    if (l.kind === 'credential') {
      navigate(productPath(product.slug, 'vault', `credential=${encodeURIComponent(l.ref)}`));
      return;
    }
    navigate(productPath(product.slug, 'files', l.ref ? `file=${encodeURIComponent(l.ref)}` : undefined));
  };

  const addStep = async (sop: ProductSop, text: string) => {
    // The API returns the whole SOP (typed as SopStep in hub.service); accept either shape.
    const res = (await hubService.addSopStep(product.id, sop.id, { text })) as unknown as Partial<ProductSop> & Partial<SopStep>;
    const step = res as SopStep;
    if (res && Array.isArray(res.steps)) {
      const steps = res.steps.map((x) => ({ ...x, links: x.links || [] }));
      patchSop(sop.id, (s) => ({
        ...s,
        steps,
        completedStepIds: res.completedStepIds || s.completedStepIds,
        updatedAt: res.updatedAt || new Date().toISOString(),
      }));
    } else if (res && res.id && typeof res.text === 'string') {
      patchSop(sop.id, (s) => ({ ...s, steps: [...s.steps, { ...step, links: step.links || [] }], updatedAt: new Date().toISOString() }));
    } else {
      await load();
    }
    toast.show('Step added');
  };

  let body: React.ReactNode;
  if (error) {
    body = (
      <div className="hub-card">
        <EmptyState icon="alert" title="Couldn't load the SOPs" text={error} actionLabel="Try again" actionIcon="refresh" onAction={load} />
      </div>
    );
  } else if (!sops) {
    body = <SopSkeleton />;
  } else if (!selected) {
    body = (
      <div className="hub-card">
        <EmptyState
          icon="book"
          title="No SOPs yet"
          text={`Write down how things work in ${product.name} so new people can follow the steps on their own.`}
          actionLabel="Create SOP"
          onAction={() => setWizard({ sop: null })}
        />
      </div>
    );
  } else {
    const s = selected;
    const done = (s.completedStepIds || []).filter((id) => s.steps.some((st) => st.id === id));
    const pct = Math.round((done.length / Math.max(1, s.steps.length)) * 100);
    const owner = s.owner || byId(s.ownerId);
    body = (
      <div className="hub-sop">
        <nav className="hub-soplist" aria-label="SOPs">
          {visible.map((x) => (
            <button key={x.id} type="button" className="hub-sopbtn" aria-current={x.id === s.id ? 'true' : undefined} onClick={() => select(x.id)}>
              <b>{x.title}</b>
              <small>
                For {x.audience || 'everyone'} · {stepCount(x.steps.length)}
              </small>
            </button>
          ))}
        </nav>
        <article className="hub-card hub-sop-card" aria-labelledby={`hub-sop-t-${s.id}`}>
          <div className="hub-sop-h">
            <div className="hub-sec-h">
              <h2 id={`hub-sop-t-${s.id}`}>{s.title}</h2>
              <div className="hub-sp">
                <OverflowMenu
                  label={`More actions for ${s.title}`}
                  items={[
                    { label: 'Edit', icon: 'edit', onSelect: () => setWizard({ sop: s }) },
                    { label: 'Delete SOP', icon: 'trash', danger: true, onSelect: () => setDeleting(s) },
                  ]}
                />
              </div>
            </div>
            <div className="hub-muted hub-small">
              For {s.audience || 'everyone'} · Owner {owner?.name || 'not set'} · Updated {fmtDate(s.updatedAt)}
            </div>
            <div className="hub-prog">
              <div
                className="hub-bar"
                role="progressbar"
                aria-label="Your progress"
                aria-valuemin={0}
                aria-valuemax={s.steps.length}
                aria-valuenow={done.length}
                aria-valuetext={`${done.length} of ${s.steps.length} done`}
              >
                <i style={{ width: `${pct}%` }} />
              </div>
              <span className="hub-small hub-muted">
                {done.length} of {s.steps.length} done
              </span>
            </div>
            <span className="hub-hint">Checking off steps tracks your own progress. Everyone sees the same steps.</span>
          </div>
          {s.steps.length ? (
            <ol className="hub-steps">
              {s.steps.map((st, i) => {
                const d = done.includes(st.id);
                return (
                  <li key={st.id} className={d ? 'hub-done' : undefined}>
                    <button
                      type="button"
                      className="hub-chk"
                      aria-pressed={d}
                      aria-label={`Step ${i + 1}: ${d ? 'done' : 'not done'}`}
                      onClick={() => toggle(s, st, !d)}
                    >
                      {d ? <Icon name="check" size={14} /> : i + 1}
                    </button>
                    <div>
                      <div className="hub-st">
                        <MentionText text={st.text} />
                      </div>
                      {st.links && st.links.length ? (
                        <div className="hub-where">
                          {st.links.map((l, li) => (
                            <button
                              key={`${l.kind}-${l.ref}-${li}`}
                              type="button"
                              className="hub-wbtn"
                              onClick={() => openLink(l)}
                              title={l.kind === 'url' ? `${l.ref} (opens in a new tab)` : undefined}
                            >
                              <Icon name={SOP_LINK_KIND[l.kind]?.icon || 'link'} size={13} />
                              <span>{l.label}</span>
                              {l.kind === 'url' ? <span className="hub-sr"> (opens in a new tab)</span> : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="hub-muted" style={{ padding: '12px 24px' }}>
              This SOP has no steps yet. Add the first one below.
            </p>
          )}
          <AddStepForm key={s.id} sop={s} onAdd={(text) => addStep(s, text)} />
        </article>
      </div>
    );
  }

  return (
    <>
      {body}
      {wizard && (
        <SopWizard
          product={product}
          sop={wizard.sop}
          onClose={() => setWizard(null)}
          onSaved={(saved) => {
            if (saved && saved.id) {
              const full: ProductSop = {
                ...saved,
                steps: (saved.steps || []).map((x) => ({ ...x, links: x.links || [] })),
                completedStepIds: saved.completedStepIds || wizard.sop?.completedStepIds || [],
                owner: saved.owner || byId(saved.ownerId),
              };
              setSops((list) => (wizard.sop ? (list || []).map((x) => (x.id === full.id ? full : x)) : [...(list || []), full]));
              select(full.id);
            } else load();
            onChanged();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this SOP?"
          body={
            <>
              <b>{deleting.title}</b> and its {stepCount(deleting.steps.length)} will be removed for everyone. You can undo this for a few seconds
              afterwards.
            </>
          }
          confirmLabel="Delete SOP"
          onConfirm={() => {
            const s = deleting;
            if (selectedParam === s.id) select(null);
            deferredDelete({
              message: 'SOP deleted',
              hide: () => hidden.add(s.id),
              restore: () => hidden.remove(s.id),
              commit: () => hubService.deleteSop(product.id, s.id),
              onCommitted: () => {
                setSops((list) => (list || []).filter((x) => x.id !== s.id));
                hidden.remove(s.id);
                onChanged();
              },
              errorMessage: "Couldn't delete the SOP.",
            });
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
};

export default SopsTab;
