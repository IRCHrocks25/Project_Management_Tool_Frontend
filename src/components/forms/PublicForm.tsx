/**
 * Public form page (/f/:token): what the client sees. No sign-in; the token is the credential.
 * One page per section with Back/Next, required answers checked before moving on, file uploads
 * with progress, and answers kept in this browser until submitted so a refresh loses nothing.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AnswerInput,
  FORM_LIMITS,
  FormFileRef,
  formsErrorMessage,
  formsService,
  OTHER_OPTION,
  PublicForm as PublicFormData,
  QuestionItem,
  RESPONDENT_FILE_TYPES,
} from '../../services/forms.service';
import Icon from '../hub/ui/Icon';
import { Skeleton } from '../hub/ui/Skeleton';
import { fmtSize } from '../hub/hubUtils';
import { paginate, questionsOf } from './formsUtils';
import '../hub/hub.css';
import './forms.css';

interface Answer {
  value?: string | string[];
  other?: string;
  files?: FormFileRef[];
}
type Answers = Record<string, Answer>;
interface Upload {
  key: string;
  name: string;
  progress: number;
  error?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const draftKey = (token: string) => `form-draft:${token}`;

const isEmpty = (a: Answer | undefined) =>
  !a || ((Array.isArray(a.value) ? a.value.length === 0 : !a.value || !String(a.value).trim()) && !(a.files && a.files.length));

const PublicForm: React.FC = () => {
  const { token = '' } = useParams();
  const [form, setForm] = useState<PublicFormData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploads, setUploads] = useState<Record<string, Upload[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    formsService
      .getPublic(token)
      .then((f) => {
        if (!alive) return;
        setForm(f);
        document.title = f.title;
        try {
          const saved = JSON.parse(localStorage.getItem(draftKey(token)) || 'null');
          if (saved && f.items) {
            const ids = new Set(questionsOf(f.items).map((q) => q.id));
            setAnswers(Object.fromEntries(Object.entries(saved.answers || {}).filter(([id]) => ids.has(id))) as Answers);
            setName(saved.name || '');
            setEmail(saved.email || '');
          }
        } catch {
          /* ignore a broken draft */
        }
      })
      .catch((err) => alive && setLoadError(formsErrorMessage(err, "This form couldn't be loaded. Check the link and try again.")));
    return () => {
      alive = false;
    };
  }, [token]);

  // Keep a draft in this browser so a refresh or closed tab loses nothing.
  useEffect(() => {
    if (!form || done) return;
    try {
      localStorage.setItem(draftKey(token), JSON.stringify({ answers, name, email }));
    } catch {
      /* storage full or blocked */
    }
  }, [answers, name, email, form, token, done]);

  const pages = useMemo(() => paginate(form?.items || []), [form]);
  const settings = form?.settings || { collectName: false, collectEmail: false };
  const isLast = page === pages.length - 1;

  const setAnswer = (id: string, patch: Answer) => {
    setAnswers((cur) => ({ ...cur, [id]: { ...cur[id], ...patch } }));
    setErrors((cur) => {
      if (!cur[id]) return cur;
      const { [id]: _gone, ...rest } = cur;
      return rest;
    });
  };

  const validatePage = (index: number): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (index === 0) {
      if (settings.collectName && !name.trim()) errs.__name = 'Please enter your name.';
      if (settings.collectEmail && !email.trim()) errs.__email = 'Please enter your email.';
      else if (settings.collectEmail && !EMAIL.test(email.trim())) errs.__email = 'Please enter a valid email address.';
    }
    for (const item of pages[index]?.items || []) {
      if (item.type !== 'question') continue;
      const a = answers[item.id];
      if (item.required && isEmpty(a)) errs[item.id] = 'This question is required.';
      const values = Array.isArray(a?.value) ? a!.value : a?.value ? [a.value] : [];
      if (values.includes(OTHER_OPTION) && !a?.other?.trim()) errs[item.id] = 'Fill in "Other", or pick another option.';
      if ((uploads[item.id] || []).some((u) => !u.error)) errs[item.id] = 'Wait for your files to finish uploading.';
    }
    return errs;
  };

  const focusFirstError = (errs: Record<string, string>) => {
    const first = Object.keys(errs)[0];
    if (!first) return;
    setTimeout(() => {
      const card = document.querySelector<HTMLElement>(`[data-q="${first}"]`);
      card?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      card?.querySelector<HTMLElement>('input, textarea, select')?.focus({ preventScroll: true });
    }, 20);
  };

  const go = (next: number) => {
    if (next > page) {
      const errs = validatePage(page);
      setErrors(errs);
      if (Object.keys(errs).length) return focusFirstError(errs);
    }
    setPage(next);
    setSubmitError(null);
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const submit = async () => {
    // Check every page; jump to the first one with a problem.
    for (let i = 0; i < pages.length; i++) {
      const errs = validatePage(i);
      if (Object.keys(errs).length) {
        setPage(i);
        setErrors(errs);
        return focusFirstError(errs);
      }
    }
    const payload: AnswerInput[] = questionsOf(form?.items || [])
      .filter((q) => !isEmpty(answers[q.id]))
      .map((q) => {
        const a = answers[q.id];
        if (q.kind === 'file_upload') return { questionId: q.id, fileIds: (a.files || []).map((f) => f.id) };
        const values = Array.isArray(a.value) ? a.value : a.value ? [a.value] : [];
        return {
          questionId: q.id,
          value: q.kind === 'checkboxes' ? values : String(a.value ?? ''),
          ...(values.includes(OTHER_OPTION) ? { other: a.other || '' } : {}),
        };
      });
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await formsService.submit(token, {
        answers: payload,
        respondentName: settings.collectName ? name.trim() : undefined,
        respondentEmail: settings.collectEmail ? email.trim() : undefined,
      });
      try {
        localStorage.removeItem(draftKey(token));
      } catch {
        /* ignore */
      }
      setDone(result.confirmationMessage || 'Thank you! Your response has been recorded.');
      topRef.current?.scrollIntoView();
    } catch (err) {
      setSubmitError(formsErrorMessage(err, "Your answers couldn't be sent. Check your connection and try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const uploadFiles = async (q: QuestionItem, files: FileList | null) => {
    if (!files || !files.length) return;
    const already = (answers[q.id]?.files || []).length + (uploads[q.id] || []).filter((u) => !u.error).length;
    const list = Array.from(files).slice(0, Math.max(0, FORM_LIMITS.filesPerQuestion - already));
    if (!list.length) {
      setErrors((cur) => ({ ...cur, [q.id]: `You can add up to ${FORM_LIMITS.filesPerQuestion} files here.` }));
      return;
    }
    for (const file of list) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      const bad = !RESPONDENT_FILE_TYPES.includes(file.type)
        ? 'Only images (PNG, JPG, GIF, WebP) and PDFs can be uploaded.'
        : file.size > FORM_LIMITS.respondentFileBytes
        ? 'This file is larger than 10 MB.'
        : undefined;
      setUploads((cur) => ({ ...cur, [q.id]: [...(cur[q.id] || []), { key, name: file.name, progress: 0, error: bad }] }));
      if (bad) continue;
      const setProgress = (progress: number) =>
        setUploads((cur) => ({ ...cur, [q.id]: (cur[q.id] || []).map((u) => (u.key === key ? { ...u, progress } : u)) }));
      try {
        const saved = await formsService.uploadPublic(token, file, setProgress);
        setAnswers((cur) => ({ ...cur, [q.id]: { ...cur[q.id], files: [...(cur[q.id]?.files || []), saved] } }));
        setUploads((cur) => ({ ...cur, [q.id]: (cur[q.id] || []).filter((u) => u.key !== key) }));
        setErrors((cur) => {
          const { [q.id]: _gone, ...rest } = cur;
          return rest;
        });
      } catch (err) {
        const message = formsErrorMessage(err, "This file couldn't be uploaded. Try again.");
        setUploads((cur) => ({ ...cur, [q.id]: (cur[q.id] || []).map((u) => (u.key === key ? { ...u, error: message } : u)) }));
      }
    }
  };

  /* ---------- states ---------- */

  const shell = (children: React.ReactNode) => (
    <div className="hub fm-public">
      <div className="fm-public-col" ref={topRef}>
        {children}
        <p className="fm-foot">Never submit passwords through this form.</p>
      </div>
    </div>
  );

  if (loadError) {
    return shell(
      <div className="hub-card fm-center">
        <div className="fm-big fm-muted">
          <Icon name="alert" size={24} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Form not available</h1>
        <p className="hub-muted">{loadError}</p>
      </div>,
    );
  }
  if (!form) {
    return shell(
      <div className="hub-card fm-public-head" aria-busy="true" aria-label="Loading">
        <Skeleton width="60%" height={26} />
        <Skeleton width="90%" />
        <Skeleton width="75%" />
      </div>,
    );
  }
  if (form.status === 'closed') {
    return shell(
      <div className="hub-card fm-center">
        <div className="fm-big fm-muted">
          <Icon name="archive" size={24} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>{form.title}</h1>
        <p className="hub-muted">This form is closed and no longer accepts responses. Contact the person who sent it to you if you think this is a mistake.</p>
      </div>,
    );
  }
  if (done) {
    return shell(
      <div className="hub-card fm-center">
        <div className="fm-big">
          <Icon name="check" size={26} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{form.title}</h1>
        <p style={{ whiteSpace: 'pre-wrap', maxWidth: '52ch' }}>{done}</p>
      </div>,
    );
  }

  const current = pages[page];
  const requiredOnForm = questionsOf(form.items || []).some((q) => q.required) || settings.collectName || settings.collectEmail;

  return shell(
    <>
      {page === 0 ? (
        <header className="hub-card fm-public-head">
          <h1>{form.title}</h1>
          {form.description ? <p>{form.description}</p> : null}
          {requiredOnForm && (
            <p className="hub-small hub-muted">
              <span className="hub-req">*</span> Required
            </p>
          )}
        </header>
      ) : (
        <div className="hub-card fm-public-head" style={{ paddingBlock: 'var(--s4)' }}>
          <b>{form.title}</b>
        </div>
      )}

      {pages.length > 1 && (
        <div className="fm-progress" aria-live="polite">
          <span>
            Page {page + 1} of {pages.length}
          </span>
          <div className="hub-bar">
            <i style={{ width: `${((page + 1) / pages.length) * 100}%` }} />
          </div>
        </div>
      )}

      {current.section && current.section.type === 'section' && (current.section.title || current.section.description) && (
        <div className="fm-public-sec">
          {current.section.title ? <h2>{current.section.title}</h2> : null}
          {current.section.description ? <p>{current.section.description}</p> : null}
        </div>
      )}

      {page === 0 && (settings.collectName || settings.collectEmail) && (
        <div className="hub-card fm-public-card">
          {settings.collectName && (
            <div className={`hub-fld`} data-q="__name">
              <label htmlFor="fm-r-name">
                Your name<span className="hub-req">*</span>
              </label>
              <input
                id="fm-r-name"
                className="hub-inp"
                autoComplete="name"
                maxLength={200}
                value={name}
                aria-invalid={!!errors.__name || undefined}
                aria-describedby={errors.__name ? 'fm-r-name-err' : undefined}
                onChange={(e) => setName(e.target.value)}
              />
              {errors.__name && (
                <p className="hub-err" id="fm-r-name-err">
                  <Icon name="alert" /> {errors.__name}
                </p>
              )}
            </div>
          )}
          {settings.collectEmail && (
            <div className="hub-fld" data-q="__email">
              <label htmlFor="fm-r-email">
                Your email<span className="hub-req">*</span>
              </label>
              <input
                id="fm-r-email"
                className="hub-inp"
                type="email"
                autoComplete="email"
                maxLength={320}
                value={email}
                aria-invalid={!!errors.__email || undefined}
                aria-describedby={errors.__email ? 'fm-r-email-err' : undefined}
                onChange={(e) => setEmail(e.target.value)}
              />
              {errors.__email && (
                <p className="hub-err" id="fm-r-email-err">
                  <Icon name="alert" /> {errors.__email}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {current.items.map((item) => {
        if (item.type === 'text') {
          return (
            <div className="hub-card fm-public-card" key={item.id}>
              {item.title ? <h2>{item.title}</h2> : null}
              {item.body ? <p className="hub-rich">{item.body}</p> : null}
            </div>
          );
        }
        if (item.type === 'image') {
          if (!item.url) return null;
          return (
            <figure className="hub-card fm-public-card" key={item.id} style={{ margin: 0 }}>
              <a href={item.url} target="_blank" rel="noopener noreferrer" title="Open the full-size image">
                <img className="fm-img" src={item.url} alt={item.alt} style={{ width: '100%' }} />
              </a>
              {item.caption ? <figcaption className="hub-muted hub-small">{item.caption}</figcaption> : null}
            </figure>
          );
        }
        if (item.type !== 'question') return null;
        return (
          <Question
            key={item.id}
            q={item}
            answer={answers[item.id]}
            error={errors[item.id]}
            uploads={uploads[item.id] || []}
            onAnswer={(patch) => setAnswer(item.id, patch)}
            onFiles={(files) => uploadFiles(item, files)}
            onRemoveFile={(id) => setAnswer(item.id, { files: (answers[item.id]?.files || []).filter((f) => f.id !== id) })}
            onDismissUpload={(key) => setUploads((cur) => ({ ...cur, [item.id]: (cur[item.id] || []).filter((u) => u.key !== key) }))}
          />
        );
      })}

      {submitError && (
        <div className="hub-notice hub-crit" role="alert">
          <Icon name="alert" />
          <div className="hub-grow">{submitError}</div>
        </div>
      )}

      <div className="fm-nav">
        {page > 0 && (
          <button type="button" className="hub-btn" onClick={() => go(page - 1)} disabled={submitting}>
            Back
          </button>
        )}
        {isLast ? (
          <button type="button" className="hub-btn hub-btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? (
              <>
                <span className="hub-spin" /> Sending…
              </>
            ) : (
              'Submit'
            )}
          </button>
        ) : (
          <button type="button" className="hub-btn hub-btn-primary" onClick={() => go(page + 1)}>
            Next
          </button>
        )}
        <span className="fm-sp hub-small hub-muted">Your answers are kept in this browser until you submit.</span>
      </div>
    </>,
  );
};

/* ------------------------------------------------------------------ */

const Question: React.FC<{
  q: QuestionItem;
  answer: Answer | undefined;
  error?: string;
  uploads: Upload[];
  onAnswer: (patch: Answer) => void;
  onFiles: (files: FileList | null) => void;
  onRemoveFile: (id: string) => void;
  onDismissUpload: (key: string) => void;
}> = ({ q, answer, error, uploads, onAnswer, onFiles, onRemoveFile, onDismissUpload }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const id = `fm-q-${q.id}`;
  const errId = `${id}-err`;
  const describedBy = [q.description ? `${id}-desc` : '', error ? errId : ''].filter(Boolean).join(' ') || undefined;
  const values = Array.isArray(answer?.value) ? answer!.value : answer?.value ? [answer.value] : [];
  const isGroup = q.kind === 'multiple_choice' || q.kind === 'checkboxes';

  const title = (
    <>
      {q.title}
      {q.required ? <span className="hub-req" aria-hidden="true">*</span> : null}
    </>
  );

  return (
    <div className={`hub-card fm-public-card${error ? ' fm-invalid' : ''}`} data-q={q.id}>
      {isGroup ? (
        <h2 id={`${id}-label`}>{title}</h2>
      ) : (
        <h2>
          <label htmlFor={id}>{title}</label>
        </h2>
      )}
      {q.description ? (
        <p className="fm-q-desc" id={`${id}-desc`}>
          {q.description}
        </p>
      ) : null}

      {q.kind === 'short_text' && (
        <input
          id={id}
          className="hub-inp"
          maxLength={FORM_LIMITS.shortAnswer}
          value={(answer?.value as string) || ''}
          aria-required={q.required || undefined}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          placeholder="Your answer"
          onChange={(e) => onAnswer({ value: e.target.value })}
        />
      )}
      {q.kind === 'long_text' && (
        <textarea
          id={id}
          className="hub-inp"
          rows={4}
          maxLength={FORM_LIMITS.longAnswer}
          value={(answer?.value as string) || ''}
          aria-required={q.required || undefined}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          placeholder="Your answer"
          onChange={(e) => onAnswer({ value: e.target.value })}
        />
      )}
      {q.kind === 'dropdown' && (
        <select
          id={id}
          className="hub-inp hub-w-md"
          value={(answer?.value as string) || ''}
          aria-required={q.required || undefined}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          onChange={(e) => onAnswer({ value: e.target.value })}
        >
          <option value="">Choose</option>
          {q.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}
      {isGroup && (
        <div
          role={q.kind === 'multiple_choice' ? 'radiogroup' : 'group'}
          aria-labelledby={`${id}-label`}
          aria-describedby={describedBy}
          aria-required={q.required || undefined}
          aria-invalid={!!error || undefined}
        >
          {[...q.options, ...(q.allowOther ? [OTHER_OPTION] : [])].map((o) => {
            const checked = values.includes(o);
            const toggle = () => {
              if (q.kind === 'multiple_choice') onAnswer({ value: o });
              else onAnswer({ value: checked ? values.filter((v) => v !== o) : [...values, o] });
            };
            return (
              <label className="fm-choice" key={o}>
                <input type={q.kind === 'multiple_choice' ? 'radio' : 'checkbox'} name={id} checked={checked} onChange={toggle} />
                {o === OTHER_OPTION ? (
                  <>
                    <span>Other:</span>
                    <input
                      className="hub-inp"
                      aria-label="Other, your answer"
                      maxLength={500}
                      value={answer?.other || ''}
                      onChange={(e) => {
                        const text = e.target.value;
                        const next = q.kind === 'multiple_choice' ? OTHER_OPTION : values.includes(OTHER_OPTION) ? values : [...values, OTHER_OPTION];
                        onAnswer({ other: text, value: text ? next : answer?.value });
                      }}
                    />
                  </>
                ) : (
                  <span>{o}</span>
                )}
              </label>
            );
          })}
          {q.kind === 'multiple_choice' && values.length > 0 && !q.required && (
            <button type="button" className="hub-link hub-small" onClick={() => onAnswer({ value: '', other: '' })}>
              Clear selection
            </button>
          )}
        </div>
      )}
      {q.kind === 'file_upload' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <input
            ref={fileInput}
            id={id}
            type="file"
            multiple
            hidden
            accept={RESPONDENT_FILE_TYPES.join(',')}
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = '';
            }}
          />
          {(answer?.files || []).length > 0 || uploads.length > 0 ? (
            <div className="hub-uplist">
              {(answer?.files || []).map((f) => (
                <div className="hub-uprow" key={f.id}>
                  <Icon name="clip" />
                  <span className="hub-nm">
                    {f.name} <span className="hub-muted hub-small">{fmtSize(f.sizeBytes)}</span>
                  </span>
                  <button type="button" className="hub-icon-btn hub-sm" aria-label={`Remove ${f.name}`} onClick={() => onRemoveFile(f.id)}>
                    <Icon name="x" />
                  </button>
                </div>
              ))}
              {uploads.map((u) => (
                <div className="hub-uprow" key={u.key}>
                  <Icon name={u.error ? 'alert' : 'upload'} />
                  <span className="hub-nm">{u.name}</span>
                  {u.error ? (
                    <button type="button" className="hub-icon-btn hub-sm" aria-label={`Dismiss ${u.name}`} onClick={() => onDismissUpload(u.key)}>
                      <Icon name="x" />
                    </button>
                  ) : (
                    <span className="hub-small hub-muted">{u.progress}%</span>
                  )}
                  {u.error ? (
                    <p className="hub-err">{u.error}</p>
                  ) : (
                    <div className="hub-bar">
                      <i style={{ width: `${u.progress}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
          <div>
            <button type="button" className="hub-btn" onClick={() => fileInput.current?.click()} aria-describedby={describedBy}>
              <Icon name="upload" /> Add files
            </button>
          </div>
          <p className="hub-hint">Images (PNG, JPG, GIF, WebP) or PDFs, up to 10 MB each.</p>
        </div>
      )}

      {error && (
        <p className="hub-err" id={errId} role="alert">
          <Icon name="alert" /> {error}
        </p>
      )}
    </div>
  );
};

export default PublicForm;
