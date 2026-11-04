/**
 * Wizard — a long create/edit form split into steps, ending with a Review step.
 *
 *   const form = useForm({ clientName: '', loginEmail: '', ownerId: me.id, … });
 *   <Wizard
 *     form={form}
 *     title="Add demo account" description="…"
 *     steps={[
 *       { title: 'Client', fields: ['clientName'], validate: (v) => ({ clientName: v.clientName ? undefined : 'Enter the client name.' }),
 *         render: () => <><TextField form={form} name="clientName" label="Client name" required /></> },
 *       { title: 'Login', validate: …, render: () => … },
 *     ]}
 *     review={(v) => <ReviewList rows={[['Client', v.clientName], …]} />}
 *     submitLabel="Add demo account" busyLabel="Saving…" failMessage="Couldn't add the demo account."
 *     onSubmit={async (v) => { …; return 'Demo account added'; }}     // string → success toast
 *     onClose={() => setOpen(false)}
 *   />
 *
 * Shows "Step x of y: <title>", a progress bar and the step list. Continue validates the current
 * step (focus moves to the first error); Back keeps what was entered. The Review step submits with
 * the same busy / failure / "Try again" behaviour as FormModal. Optional `startAt` (step index) and
 * `size` ("md" | "lg", default "lg").
 */
import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';
import { BusyLabel, cleanErrors, focusFirstError, FormErrors, SubmitBanner, UseFormResult, useSubmitter } from './FormModal';

export interface WizardStep<T> {
  title: string;
  /** Field names on this step; used to jump back to the right step when the server rejects a field. */
  fields?: (keyof T)[];
  validate?: (values: T) => FormErrors<T>;
  render: () => React.ReactNode;
}

export interface WizardProps<T extends Record<string, any>> {
  form: UseFormResult<T>;
  title: React.ReactNode;
  description?: React.ReactNode;
  steps: WizardStep<T>[];
  review: (values: T) => React.ReactNode;
  submitLabel: string;
  busyLabel?: string;
  failMessage?: string;
  onSubmit: (values: T) => Promise<void | string>;
  mapServerError?: (message: string, err: unknown) => FormErrors<T> | null;
  onClose: () => void;
  startAt?: number;
  size?: 'md' | 'lg';
}

let wizSeq = 0;

export function Wizard<T extends Record<string, any>>(props: WizardProps<T>) {
  const {
    form,
    title,
    description,
    steps,
    review,
    submitLabel,
    busyLabel = 'Saving…',
    failMessage,
    onSubmit,
    mapServerError,
    onClose,
    startAt = 0,
    size = 'lg',
  } = props;
  const [step, setStep] = useState(startAt);
  const [formId] = useState(() => `hub-wiz-${++wizSeq}`);
  const bodyRef = useRef<HTMLDivElement>(null);
  const names = [...steps.map((s) => s.title), 'Review'];
  const isReview = step === steps.length;

  const s = useSubmitter({
    form,
    onSubmit,
    onClose,
    failMessage,
    mapServerError: (msg, err) => {
      const mapped = mapServerError ? mapServerError(msg, err) : null;
      if (mapped) {
        // Jump back to the step that owns the first failing field.
        const firstKey = Object.keys(cleanErrors(mapped))[0];
        const idx = steps.findIndex((st) => (st.fields || []).some((f) => String(f) === firstKey));
        if (idx >= 0) setStep(idx);
      }
      return mapped;
    },
  });

  useEffect(() => {
    // Move focus to the first field of the new step (or the primary button on Review).
    const t = window.setTimeout(() => {
      const root = bodyRef.current?.closest('[role="dialog"]') as HTMLElement | null;
      const target =
        bodyRef.current?.querySelector<HTMLElement>('input:not([type="file"]):not([type="checkbox"]), select, textarea') ||
        root?.querySelector<HTMLElement>('button[type="submit"]');
      target?.focus();
    }, 20);
    return () => window.clearTimeout(t);
  }, [step]);

  const next = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (s.busy) return;
    if (!isReview) {
      const v = steps[step].validate;
      if (v) {
        const errs = cleanErrors(v(form.values));
        if (Object.keys(errs).length) {
          form.setErrors(errs);
          focusFirstError(form, errs);
          return;
        }
      }
      setStep(step + 1);
      return;
    }
    s.submit();
  };

  return (
    <Modal
      title={title}
      description={description}
      size={size}
      onClose={onClose}
      dirty={form.dirty}
      busy={s.busy}
      footer={({ requestClose }) => (
        <div className="hub-acts">
          {step > 0 ? (
            <button type="button" className="hub-btn hub-btn-ghost" onClick={() => setStep(step - 1)} disabled={s.busy}>
              Back
            </button>
          ) : null}
          <span className="hub-sp" />
          <button type="button" className="hub-btn" onClick={requestClose} disabled={s.busy}>
            Cancel
          </button>
          <button type="submit" form={formId} className="hub-btn hub-btn-primary" disabled={s.busy}>
            <BusyLabel busy={s.busy} busyLabel={busyLabel}>
              {isReview ? (s.failed ? 'Try again' : submitLabel) : 'Continue'}
            </BusyLabel>
          </button>
        </div>
      )}
    >
      <div className="hub-stepper">
        <div className="hub-stepper-t" aria-live="polite">
          Step {step + 1} of {names.length}: <b>{names[step]}</b>
        </div>
        <div
          className="hub-bar"
          role="progressbar"
          aria-label="Form progress"
          aria-valuemin={0}
          aria-valuemax={names.length}
          aria-valuenow={step + 1}
        >
          <i style={{ width: `${((step + 1) / names.length) * 100}%` }} />
        </div>
        <ol className="hub-steps-ind">
          {names.map((n, i) => (
            <li key={n} className={i < step ? 'hub-done' : i === step ? 'hub-cur' : undefined} aria-current={i === step ? 'step' : undefined}>
              <span>{i < step ? <Icon name="check" size={12} /> : i + 1}</span>
              {n}
            </li>
          ))}
        </ol>
      </div>
      <SubmitBanner heading={failMessage} message={s.banner} />
      <div ref={bodyRef}>
        <form id={formId} className="hub-fgrid" noValidate onSubmit={next}>
          {isReview ? review(form.values) : steps[step].render()}
        </form>
      </div>
    </Modal>
  );
}

export default Wizard;
