/**
 * Responses tab: Summary (counts per option, latest text answers, files) and a Table of every
 * response. Clicking a row opens it in a drawer, where it can be deleted. Exports to CSV or Excel.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FormAnswer, FormDetail, FormResponse, formsErrorMessage, formsService, OTHER_OPTION, QuestionItem } from '../../services/forms.service';
import ConfirmDialog from '../hub/ui/ConfirmDialog';
import { Drawer } from '../hub/ui/Modal';
import EmptyState from '../hub/ui/EmptyState';
import Icon from '../hub/ui/Icon';
import { SkeletonRows } from '../hub/ui/Skeleton';
import { useToast } from '../hub/ui/Toast';
import { fmtSize } from '../hub/hubUtils';
import { answerText, fmtDateTime, questionsOf, responseColumns } from './formsUtils';
import { exportCsv, exportXlsx } from './formsExport';

type View = 'summary' | 'table';

const FormResponses: React.FC<{ form: FormDetail }> = ({ form }) => {
  const toast = useToast();
  const [responses, setResponses] = useState<FormResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('summary');
  const [open, setOpen] = useState<FormResponse | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FormResponse | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setResponses(await formsService.responses(form.id));
    } catch (err) {
      setError(formsErrorMessage(err, "Couldn't load the responses."));
    }
  }, [form.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="hub-card">
        <EmptyState icon="alert" title="Couldn't load the responses" text={error} actionLabel="Try again" actionIcon="refresh" onAction={load} />
      </div>
    );
  }
  if (!responses) {
    return (
      <div className="hub-card">
        <SkeletonRows rows={4} />
      </div>
    );
  }
  if (!responses.length) {
    return (
      <div className="hub-card">
        <EmptyState
          icon="inbox"
          title="No responses yet"
          text={
            form.status === 'draft'
              ? 'Publish the form and send the link to your client. Their answers show up here.'
              : form.status === 'closed'
              ? 'This form is closed. Reopen it to accept responses.'
              : "Send the link to your client. You'll get a notification when they submit."
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="hub-sec-h">
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>
          {responses.length} response{responses.length === 1 ? '' : 's'}
        </h2>
        <div className="hub-sp">
          <div className="hub-seg" role="group" aria-label="View">
            <button type="button" aria-pressed={view === 'summary'} onClick={() => setView('summary')}>
              Summary
            </button>
            <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>
              Table
            </button>
          </div>
          <button type="button" className="hub-btn hub-btn-sm" onClick={() => exportCsv(form, responses)}>
            <Icon name="ext" /> CSV
          </button>
          <button type="button" className="hub-btn hub-btn-sm" onClick={() => exportXlsx(form, responses)}>
            <Icon name="ext" /> Excel
          </button>
        </div>
      </div>

      {view === 'summary' ? <Summary form={form} responses={responses} /> : <Table form={form} responses={responses} onOpen={setOpen} />}

      {open && (
        <Drawer
          eyebrow="Response"
          title={open.respondentName || open.respondentEmail || 'Anonymous'}
          description={fmtDateTime(open.submittedAt)}
          onClose={() => setOpen(null)}
          footer={
            <div className="hub-acts">
              <button type="button" className="hub-btn hub-btn-danger-text hub-sp" onClick={() => setConfirmDelete(open)}>
                <Icon name="trash" /> Delete response
              </button>
              <button type="button" className="hub-btn" onClick={() => setOpen(null)}>
                Close
              </button>
            </div>
          }
        >
          <ResponseDetail form={form} response={open} />
        </Drawer>
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this response?"
          body="The answers and any files the client uploaded with them are deleted for good."
          confirmLabel="Delete response"
          busyLabel="Deleting…"
          onConfirm={async () => {
            await formsService.deleteResponse(form.id, confirmDelete.id);
            setResponses((cur) => (cur || []).filter((r) => r.id !== confirmDelete.id));
            setConfirmDelete(null);
            setOpen(null);
            toast.show('Response deleted');
          }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
};

/* ------------------------------------------------------------------ */

const Summary: React.FC<{ form: FormDetail; responses: FormResponse[] }> = ({ form, responses }) => {
  const questions = questionsOf(form.items);
  const answersFor = (q: QuestionItem) =>
    responses.map((r) => r.answers.find((a) => a.questionId === q.id)).filter((a): a is FormAnswer => !!a);

  return (
    <div className="fm-summary">
      {questions.map((q) => {
        const answers = answersFor(q);
        const answered = answers.filter((a) => (Array.isArray(a.value) ? a.value.length : a.value) || a.files.length);
        return (
          <section className="hub-card fm-q-sum" key={q.id} aria-label={q.title}>
            <h3>{q.title || 'Untitled question'}</h3>
            <p className="hub-small hub-muted">
              {answered.length} of {responses.length} answered
            </p>
            {['multiple_choice', 'checkboxes', 'dropdown'].includes(q.kind) ? (
              <ChoiceBars q={q} answers={answers} total={responses.length} />
            ) : q.kind === 'file_upload' ? (
              <div className="hub-attach">
                {answered.flatMap((a) => a.files).map((f) => (
                  <a key={f.id} className="hub-file-pill" href={f.url} target="_blank" rel="noopener noreferrer">
                    <Icon name="clip" /> <span>{f.name}</span>
                  </a>
                ))}
                {!answered.length && <span className="hub-muted">No files yet</span>}
              </div>
            ) : (
              <div className="fm-texts">
                {answered.slice(0, 50).map((a, i) => (
                  <div key={i}>{String(a.value)}</div>
                ))}
                {!answered.length && <span className="hub-muted">No answers yet</span>}
                {answered.length > 50 && <span className="hub-small hub-muted">Showing the latest 50. See all in the Table view.</span>}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

const ChoiceBars: React.FC<{ q: QuestionItem; answers: FormAnswer[]; total: number }> = ({ q, answers, total }) => {
  const counts = useMemo(() => {
    const map = new Map<string, number>(q.options.map((o) => [o, 0]));
    let other = 0;
    for (const a of answers) {
      const values = Array.isArray(a.value) ? a.value : a.value ? [a.value] : [];
      for (const v of values) {
        if (v === OTHER_OPTION) other++;
        // Options renamed or removed since keep their old label.
        else map.set(v, (map.get(v) || 0) + 1);
      }
    }
    const rows = Array.from(map.entries());
    if (q.allowOther || other) rows.push(['Other', other]);
    return rows;
  }, [q, answers]);

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {counts.map(([label, n]) => {
        const pct = total ? Math.round((n / total) * 100) : 0;
        return (
          <div className="fm-barrow" key={label}>
            <span title={label}>{label}</span>
            <div className="hub-bar">
              <i style={{ width: `${pct}%` }} />
            </div>
            <span>
              {n} · {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
};

const Table: React.FC<{ form: FormDetail; responses: FormResponse[]; onOpen: (r: FormResponse) => void }> = ({ form, responses, onOpen }) => {
  const cols = responseColumns(form.items, responses);
  const withName = responses.some((r) => r.respondentName);
  const withEmail = responses.some((r) => r.respondentEmail);
  return (
    <div className="hub-card hub-tw">
      <table className="hub-tbl">
        <thead>
          <tr>
            <th scope="col">Submitted</th>
            {withName && <th scope="col">Name</th>}
            {withEmail && <th scope="col">Email</th>}
            {cols.map((c) => (
              <th scope="col" key={c.id} title={c.title}>
                <span className="fm-cell" style={{ display: 'inline-block', maxWidth: 220 }}>
                  {c.title}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {responses.map((r) => {
            const byQ = new Map(r.answers.map((a) => [a.questionId, a]));
            return (
              <tr
                key={r.id}
                className="hub-click"
                tabIndex={0}
                onClick={() => onOpen(r)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onOpen(r);
                }}
              >
                <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r.submittedAt)}</td>
                {withName && <td>{r.respondentName}</td>}
                {withEmail && <td>{r.respondentEmail}</td>}
                {cols.map((c) => (
                  <td key={c.id}>
                    <div className="fm-cell">{answerText(byQ.get(c.id))}</div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const ResponseDetail: React.FC<{ form: FormDetail; response: FormResponse }> = ({ form, response }) => {
  const cols = responseColumns(form.items, [response]);
  const byQ = new Map(response.answers.map((a) => [a.questionId, a]));
  return (
    <dl style={{ margin: 0 }}>
      {response.respondentEmail && (
        <div className="fm-answer">
          <dt>Email</dt>
          <dd>
            <a href={`mailto:${response.respondentEmail}`}>{response.respondentEmail}</a>
          </dd>
        </div>
      )}
      {cols.map((c) => {
        const a = byQ.get(c.id);
        return (
          <div className="fm-answer" key={c.id}>
            <dt>{c.title}</dt>
            <dd>
              {a?.kind === 'file_upload' && a.files.length ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div className="fm-thumbs">
                    {a.files
                      .filter((f) => f.contentType?.startsWith('image/'))
                      .map((f) => (
                        <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" title={f.name}>
                          <img src={f.url} alt={f.name} />
                        </a>
                      ))}
                  </div>
                  <div className="hub-attach">
                    {a.files.map((f) => (
                      <a key={f.id} className="hub-file-pill" href={f.url} target="_blank" rel="noopener noreferrer">
                        <Icon name="clip" /> <span>{f.name}</span> <span className="hub-muted">{fmtSize(f.sizeBytes)}</span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : answerText(a) ? (
                answerText(a)
              ) : (
                <span className="hub-muted">No answer</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
};

export default FormResponses;
