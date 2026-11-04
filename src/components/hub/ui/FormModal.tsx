/**
 * Forms in modals: useForm + FormModal + field components.
 *
 *   const form = useForm({ name: '', status: 'building', ownerId: me.id });
 *
 *   <FormModal
 *     form={form}
 *     title="Add product" description="…"
 *     submitLabel="Add product" busyLabel="Saving…"          // busyLabel defaults to "Saving…"
 *     failMessage="Couldn't add the product."                // banner heading when the request fails
 *     validate={(v) => ({ name: !v.name.trim() ? 'Enter the product name.' : undefined })}
 *     onSubmit={async (v) => { await hubService.createProduct(…); return `${v.name} added`; }}
 *     mapServerError={(msg) => /already exists/i.test(msg) ? { name: msg } : null}   // optional
 *     onClose={() => setOpen(false)}
 *   >
 *     <TextField form={form} name="name" label="Product name" required />
 *     <SelectField form={form} name="status" label="Status" options={[{ value: 'live', label: 'Live' }]} required />
 *     <UserField form={form} name="ownerId" label="Owner" required />
 *   </FormModal>
 *
 * Behaviour
 *   - validate() runs on submit; errors show under each field and focus moves to the first one.
 *     Editing a field clears its error.
 *   - While onSubmit runs, the button shows the busy label + spinner and is disabled; a second
 *     submit is ignored and the modal can't be closed.
 *   - If onSubmit throws, the modal stays open with everything entered, shows the server's message
 *     in a banner (or on a field via mapServerError) and the button reads "Try again".
 *   - If onSubmit returns a string it's shown as a success toast; then the modal closes.
 *   - Close attempts with unsaved changes ask "Discard your changes?".
 *   - Enter in a single-line field submits.
 *
 * Fields (all take form, name, label, and optional required, hint, width "sm" | "md" | "full"):
 *   TextField (type, placeholder, inputMode, autoComplete), TextAreaField (rows, placeholder),
 *   SelectField (options), ToggleField (hint), DateField, MentionField (rows, multiline),
 *   UserField (allowEmpty, emptyLabel, excludeIds), Field (wrapper for custom controls: pass `id`).
 * Use `form.fieldId(name)` for the id of a custom control so error focusing works.
 */
import React, { useCallback, useRef, useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';
import MentionInput from './MentionInput';
import UserPicker from './UserPicker';
import { useToast } from './Toast';
import { hubErrorMessage } from '../../../services/hub.service';

/* ------------------------------------------------------------------ */
/* useForm                                                             */
/* ------------------------------------------------------------------ */

export type FormErrors<T> = Partial<Record<keyof T, string | undefined>>;

export interface UseFormResult<T extends Record<string, any>> {
  values: T;
  set: <K extends keyof T>(name: K, value: T[K]) => void;
  setMany: (patch: Partial<T>) => void;
  errors: FormErrors<T>;
  setErrors: (errors: FormErrors<T>) => void;
  /** true once anything was changed. */
  dirty: boolean;
  reset: (values?: T) => void;
  fieldId: (name: keyof T) => string;
}

let formSeq = 0;

export function useForm<T extends Record<string, any>>(initial: T): UseFormResult<T> {
  const [prefix] = useState(() => `hub-f${++formSeq}`);
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrorsState] = useState<FormErrors<T>>({});
  const [dirty, setDirty] = useState(false);

  const set = useCallback(<K extends keyof T>(name: K, value: T[K]) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrorsState((e) => (e[name] ? { ...e, [name]: undefined } : e));
    setDirty(true);
  }, []);
  const setMany = useCallback((patch: Partial<T>) => {
    setValues((v) => ({ ...v, ...patch }));
    setDirty(true);
  }, []);
  const setErrors = useCallback((e: FormErrors<T>) => setErrorsState(e), []);
  const reset = useCallback(
    (next?: T) => {
      setValues(next || initial);
      setErrorsState({});
      setDirty(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const fieldId = useCallback((name: keyof T) => `${prefix}-${String(name)}`, [prefix]);

  return { values, set, setMany, errors, setErrors, dirty, reset, fieldId };
}

/** Keeps only the keys that have a message. */
export function cleanErrors<T>(errors: FormErrors<T>): FormErrors<T> {
  const out: FormErrors<T> = {};
  (Object.keys(errors) as (keyof T)[]).forEach((k) => {
    if (errors[k]) out[k] = errors[k];
  });
  return out;
}

export function focusFirstError<T extends Record<string, any>>(form: UseFormResult<T>, errors: FormErrors<T>) {
  const first = (Object.keys(errors) as (keyof T)[]).find((k) => errors[k]);
  if (!first) return;
  window.setTimeout(() => {
    const el = document.getElementById(form.fieldId(first));
    if (el) {
      const target = el.matches('input,select,textarea,button') ? el : el.querySelector<HTMLElement>('input,select,textarea,button');
      (target || el).focus();
    }
  }, 0);
}

/* ------------------------------------------------------------------ */
/* Submit plumbing shared with Wizard                                  */
/* ------------------------------------------------------------------ */

export interface SubmitState {
  busy: boolean;
  failed: boolean;
  banner: string | null;
}

export function useSubmitter<T extends Record<string, any>>(opts: {
  form: UseFormResult<T>;
  onSubmit: (values: T) => Promise<void | string>;
  onClose: () => void;
  failMessage?: string;
  mapServerError?: (message: string, err: unknown) => FormErrors<T> | null;
}) {
  const toast = useToast();
  const busyRef = useRef(false);
  const [state, setState] = useState<SubmitState>({ busy: false, failed: false, banner: null });
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const submit = useCallback(async () => {
    if (busyRef.current) return;
    const { form, onSubmit, onClose, mapServerError } = optsRef.current;
    busyRef.current = true;
    setState({ busy: true, failed: false, banner: null });
    try {
      const msg = await onSubmit(form.values);
      busyRef.current = false;
      setState({ busy: false, failed: false, banner: null });
      if (typeof msg === 'string' && msg) toast.show(msg);
      onClose();
    } catch (err) {
      busyRef.current = false;
      const message = hubErrorMessage(err);
      const fieldErrors = mapServerError ? mapServerError(message, err) : null;
      if (fieldErrors && Object.keys(cleanErrors(fieldErrors)).length) {
        form.setErrors(cleanErrors(fieldErrors));
        focusFirstError(form, fieldErrors);
        setState({ busy: false, failed: true, banner: null });
      } else {
        setState({ busy: false, failed: true, banner: message });
      }
    }
  }, [toast]);

  return { ...state, submit };
}

export const SubmitBanner: React.FC<{ heading?: string; message: string | null }> = ({ heading = "Couldn't save.", message }) =>
  message ? (
    <div className="hub-banner hub-banner-err" role="alert">
      <Icon name="alert" />
      <div>
        <b>{heading}</b> {message} Everything you entered is still here.
      </div>
    </div>
  ) : null;

export const BusyLabel: React.FC<{ busy: boolean; busyLabel: string; children: React.ReactNode }> = ({ busy, busyLabel, children }) =>
  busy ? (
    <>
      <span className="hub-spin" aria-hidden="true" />
      {busyLabel}
    </>
  ) : (
    <>{children}</>
  );

/* ------------------------------------------------------------------ */
/* FormModal                                                           */
/* ------------------------------------------------------------------ */

export interface FormModalProps<T extends Record<string, any>> {
  form: UseFormResult<T>;
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  submitLabel: string;
  busyLabel?: string;
  failMessage?: string;
  validate?: (values: T) => FormErrors<T>;
  onSubmit: (values: T) => Promise<void | string>;
  mapServerError?: (message: string, err: unknown) => FormErrors<T> | null;
  onClose: () => void;
  /** Disable the submit button (e.g. nothing chosen yet). */
  submitDisabled?: boolean;
  /** Extra footer content on the left (e.g. a secondary action). */
  footerStart?: React.ReactNode;
  children: React.ReactNode;
}

export function FormModal<T extends Record<string, any>>(props: FormModalProps<T>) {
  const {
    form,
    title,
    description,
    size,
    submitLabel,
    busyLabel = 'Saving…',
    failMessage,
    validate,
    onSubmit,
    mapServerError,
    onClose,
    submitDisabled,
    footerStart,
    children,
  } = props;
  const [formId] = useState(() => `hub-form-${++formSeq}`);
  const s = useSubmitter({ form, onSubmit, onClose, failMessage, mapServerError });

  const handle = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (s.busy) return;
    if (validate) {
      const errs = cleanErrors(validate(form.values));
      if (Object.keys(errs).length) {
        form.setErrors(errs);
        focusFirstError(form, errs);
        return;
      }
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
          {footerStart ? <span className="hub-sp">{footerStart}</span> : null}
          <button type="button" className="hub-btn" onClick={requestClose} disabled={s.busy}>
            Cancel
          </button>
          <button type="submit" form={formId} className="hub-btn hub-btn-primary" disabled={s.busy || submitDisabled}>
            <BusyLabel busy={s.busy} busyLabel={busyLabel}>
              {s.failed ? 'Try again' : submitLabel}
            </BusyLabel>
          </button>
        </div>
      )}
    >
      <SubmitBanner heading={failMessage} message={s.banner} />
      <form id={formId} className="hub-fgrid" noValidate onSubmit={handle}>
        {children}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Fields                                                              */
/* ------------------------------------------------------------------ */

type AnyForm = UseFormResult<any>;
type Width = 'sm' | 'md' | 'full';

export interface FieldProps {
  id: string;
  label: React.ReactNode;
  required?: boolean;
  /** Show "Optional" next to the label when not required (default true). */
  showOptional?: boolean;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}

/** Label + control + hint + error. ids: hint `${id}-h`, error `${id}-e`. */
export const Field: React.FC<FieldProps> = ({ id, label, required, showOptional = true, hint, error, children }) => (
  <div className="hub-fld">
    <label htmlFor={id}>
      {label}
      {required ? (
        <span className="hub-req" aria-hidden="true">
          *
        </span>
      ) : showOptional ? (
        <span className="hub-opt">Optional</span>
      ) : null}
    </label>
    {children}
    {hint ? (
      <p className="hub-hint" id={`${id}-h`}>
        {hint}
      </p>
    ) : null}
    {error ? (
      <p className="hub-err" id={`${id}-e`} role="alert">
        <Icon name="alert" size={14} />
        {error}
      </p>
    ) : null}
  </div>
);

const describedBy = (id: string, hint?: React.ReactNode, error?: string) =>
  [hint ? `${id}-h` : '', error ? `${id}-e` : ''].filter(Boolean).join(' ') || undefined;

interface BaseFieldProps {
  form: AnyForm;
  name: string;
  label: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  width?: Width;
  disabled?: boolean;
}

export const TextField: React.FC<
  BaseFieldProps & {
    type?: string;
    placeholder?: string;
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
    autoComplete?: string;
    mono?: boolean;
    maxLength?: number;
  }
> = ({ form, name, label, required, hint, width = 'md', type = 'text', placeholder, inputMode, autoComplete, disabled, mono, maxLength }) => {
  const id = form.fieldId(name);
  const error = form.errors[name];
  return (
    <Field id={id} label={label} required={required} hint={hint} error={error}>
      <input
        id={id}
        className={`hub-inp hub-w-${width}${mono ? ' hub-mono' : ''}`}
        type={type}
        value={form.values[name] ?? ''}
        onChange={(e) => form.set(name, e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete ?? 'off'}
        aria-invalid={error ? 'true' : 'false'}
        aria-required={required || undefined}
        aria-describedby={describedBy(id, hint, error)}
        disabled={disabled}
        maxLength={maxLength}
      />
    </Field>
  );
};

export const DateField: React.FC<BaseFieldProps> = (p) => <TextField {...p} type="date" width={p.width || 'sm'} />;

export const TextAreaField: React.FC<BaseFieldProps & { rows?: number; placeholder?: string }> = ({
  form,
  name,
  label,
  required,
  hint,
  rows = 4,
  placeholder,
  disabled,
}) => {
  const id = form.fieldId(name);
  const error = form.errors[name];
  return (
    <Field id={id} label={label} required={required} hint={hint} error={error}>
      <textarea
        id={id}
        className="hub-inp hub-w-full"
        rows={rows}
        value={form.values[name] ?? ''}
        onChange={(e) => form.set(name, e.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={describedBy(id, hint, error)}
        disabled={disabled}
      />
    </Field>
  );
};

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export const SelectField: React.FC<BaseFieldProps & { options: SelectOption[]; placeholder?: string }> = ({
  form,
  name,
  label,
  required,
  hint,
  width = 'sm',
  options,
  placeholder,
  disabled,
}) => {
  const id = form.fieldId(name);
  const error = form.errors[name];
  return (
    <Field id={id} label={label} required={required} hint={hint} error={error}>
      <select
        id={id}
        className={`hub-inp hub-w-${width}`}
        value={form.values[name] ?? ''}
        onChange={(e) => form.set(name, e.target.value)}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={describedBy(id, hint, error)}
        disabled={disabled}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
};

export const ToggleField: React.FC<Omit<BaseFieldProps, 'required' | 'width'>> = ({ form, name, label, hint, disabled }) => {
  const id = form.fieldId(name);
  return (
    <div className="hub-fld">
      <label className="hub-toggle" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={!!form.values[name]}
          onChange={(e) => form.set(name, e.target.checked)}
          disabled={disabled}
        />
        <span className="hub-tg" aria-hidden="true" />
        <span>
          <b>{label}</b>
          {hint ? (
            <>
              <br />
              <span className="hub-hint">{hint}</span>
            </>
          ) : null}
        </span>
      </label>
    </div>
  );
};

export const MentionField: React.FC<BaseFieldProps & { rows?: number; placeholder?: string; multiline?: boolean }> = ({
  form,
  name,
  label,
  required,
  hint,
  rows = 5,
  placeholder,
  multiline = true,
  disabled,
}) => {
  const id = form.fieldId(name);
  const error = form.errors[name];
  return (
    <Field id={id} label={label} required={required} hint={hint} error={error}>
      <MentionInput
        id={id}
        value={form.values[name] ?? ''}
        onChange={(v) => form.set(name, v)}
        rows={rows}
        multiline={multiline}
        placeholder={placeholder}
        invalid={!!error}
        describedBy={describedBy(id, hint, error)}
        disabled={disabled}
      />
    </Field>
  );
};

export const UserField: React.FC<BaseFieldProps & { allowEmpty?: boolean; emptyLabel?: string; excludeIds?: string[] }> = ({
  form,
  name,
  label,
  required,
  hint,
  width = 'md',
  allowEmpty,
  emptyLabel,
  excludeIds,
  disabled,
}) => {
  const id = form.fieldId(name);
  const error = form.errors[name];
  return (
    <Field id={id} label={label} required={required} hint={hint} error={error}>
      <UserPicker
        id={id}
        value={form.values[name] ?? ''}
        onChange={(v) => form.set(name, v)}
        allowEmpty={allowEmpty}
        emptyLabel={emptyLabel}
        excludeIds={excludeIds}
        invalid={!!error}
        describedBy={describedBy(id, hint, error)}
        className={`hub-inp hub-w-${width}`}
        disabled={disabled}
      />
    </Field>
  );
};

/** Two or more fields side by side (wraps on narrow screens). */
export const FieldRow: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="hub-frow">{children}</div>;

/** Review list for the last step of a wizard: rows of [label, value]. */
export const ReviewList: React.FC<{ rows: [React.ReactNode, React.ReactNode][] }> = ({ rows }) => {
  return (
    <dl className="hub-review">
      {rows.map(([k, v], i) => (
        <div key={i}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
};

export default FormModal;
