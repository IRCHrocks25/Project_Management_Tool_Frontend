/**
 * Questions tab: the form's title and description, then one card per item (question, text,
 * image, section). New items go after the card you last worked in. Images upload to Iceberg
 * through the form's files endpoint and can be dropped onto the card.
 */
import React, { useRef, useState } from 'react';
import {
  BUILDER_IMAGE_TYPES,
  CHOICE_KINDS,
  FORM_LIMITS,
  FormDetail,
  FormItem,
  formsErrorMessage,
  formsService,
  FormUpdate,
  ImageItem,
  KIND_LABELS,
  publicFormUrl,
  QUESTION_KINDS,
  QuestionItem,
  QuestionKind,
} from '../../services/forms.service';
import Icon from '../hub/ui/Icon';
import { useToast } from '../hub/ui/Toast';
import { cloneItem, newItem } from './formsUtils';

interface Props {
  form: FormDetail;
  onChange: (patch: FormUpdate) => void;
  onCopyLink: (token: string) => void;
}

/** Textarea that grows with its content. */
const AutoText: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const el = ref.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  };
  React.useLayoutEffect(fit);
  return <textarea ref={ref} rows={1} {...props} onInput={fit} />;
};

const FormQuestions: React.FC<Props> = ({ form, onChange, onCopyLink }) => {
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const items = form.items;

  const setItems = (next: FormItem[]) => onChange({ items: next });
  const update = (index: number, patch: Partial<FormItem>) =>
    setItems(items.map((it, i) => (i === index ? ({ ...it, ...patch } as FormItem) : it)));
  const insert = (item: FormItem) => {
    const at = focusIdx === null ? items.length : Math.min(focusIdx + 1, items.length);
    setItems([...items.slice(0, at), item, ...items.slice(at)]);
    setFocusIdx(at);
    // Focus the new card's first field once it renders.
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-item="${item.id}"] input, [data-item="${item.id}"] textarea`);
      el?.focus();
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 30);
  };
  const move = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[index], next[to]] = [next[to], next[index]];
    setItems(next);
    setFocusIdx(to);
  };
  const remove = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    setFocusIdx(null);
  };
  const duplicate = (index: number) => {
    const copy = cloneItem(items[index]);
    setItems([...items.slice(0, index + 1), copy, ...items.slice(index + 1)]);
    setFocusIdx(index + 1);
  };

  let sectionNo = 1;

  return (
    <>
      <div className="hub-card fm-head">
        <input
          className="fm-title-inp"
          aria-label="Form title"
          value={form.title}
          maxLength={200}
          placeholder="Untitled form"
          onChange={(e) => onChange({ title: e.target.value })}
          onBlur={(e) => {
            if (!e.target.value.trim()) onChange({ title: 'Untitled form' });
          }}
        />
        <AutoText
          className="fm-desc-inp"
          aria-label="Form description"
          value={form.description || ''}
          maxLength={5000}
          placeholder="Form description: tell your client what this is for"
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>

      {!form.isTemplate && form.publicToken && (
        <div className="hub-card fm-linkbar">
          <Icon name="link" className="hub-muted" />
          <input className="hub-inp hub-mono" readOnly value={publicFormUrl(form.publicToken)} aria-label="Public link" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="hub-btn hub-btn-sm" onClick={() => onCopyLink(form.publicToken!)}>
            <Icon name="copy" /> Copy
          </button>
        </div>
      )}
      {!form.isTemplate && form.status === 'open' && (
        <p className="hub-hint">
          This form is live. Changes save straight away and clients see them the next time they open the link.
        </p>
      )}

      <div className="fm-items">
        {items.map((item, index) => {
          const common = {
            index,
            count: items.length,
            active: focusIdx === index,
            onFocus: () => setFocusIdx(index),
            onMove: (dir: -1 | 1) => move(index, dir),
            onRemove: () => remove(index),
            onDuplicate: () => duplicate(index),
          };
          if (item.type === 'section') {
            sectionNo += 1;
            return <SectionCard key={item.id} {...common} item={item} pageNo={sectionNo} onUpdate={(p) => update(index, p)} />;
          }
          if (item.type === 'text') return <TextCard key={item.id} {...common} item={item} onUpdate={(p) => update(index, p)} />;
          if (item.type === 'image') return <ImageCard key={item.id} {...common} formId={form.id} item={item} onUpdate={(p) => update(index, p)} />;
          return <QuestionCard key={item.id} {...common} item={item} onUpdate={(p) => update(index, p)} />;
        })}
      </div>

      <div className="hub-card fm-addbar" role="group" aria-label="Add to the form">
        <button type="button" className="hub-btn" onClick={() => insert(newItem('question'))}>
          <Icon name="plus" /> Question
        </button>
        <button type="button" className="hub-btn" onClick={() => insert(newItem('image'))}>
          <Icon name="upload" /> Image
        </button>
        <button type="button" className="hub-btn" onClick={() => insert(newItem('text'))}>
          <Icon name="msg" /> Text
        </button>
        <button type="button" className="hub-btn" onClick={() => insert(newItem('section'))}>
          <Icon name="book" /> Section
        </button>
      </div>
      <p className="hub-hint" style={{ textAlign: 'center' }}>
        New items go after the one you last clicked. A section starts a new page for your client.
      </p>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

interface CardProps<T extends FormItem> {
  item: T;
  index: number;
  count: number;
  active: boolean;
  onFocus: () => void;
  onUpdate: (patch: Partial<T>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

const CardShell: React.FC<
  Pick<CardProps<FormItem>, 'item' | 'index' | 'count' | 'active' | 'onFocus' | 'onMove' | 'onRemove' | 'onDuplicate'> & {
    className?: string;
    label: string;
    footerStart?: React.ReactNode;
    children: React.ReactNode;
  }
> = ({ item, index, count, active, onFocus, onMove, onRemove, onDuplicate, className = '', label, footerStart, children }) => (
  <div
    className={`hub-card fm-item ${className}${active ? ' fm-active' : ''}`}
    data-item={item.id}
    onFocusCapture={onFocus}
    onClick={onFocus}
    role="group"
    aria-label={label}
  >
    {children}
    <div className="fm-item-f">
      {footerStart}
      <div className="fm-sp">
        <button type="button" className="hub-icon-btn hub-sm" aria-label="Move up" title="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
          <Icon name="up" />
        </button>
        <button
          type="button"
          className="hub-icon-btn hub-sm"
          aria-label="Move down"
          title="Move down"
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          <Icon name="down" />
        </button>
        <button type="button" className="hub-icon-btn hub-sm" aria-label="Duplicate" title="Duplicate" onClick={onDuplicate}>
          <Icon name="copy" />
        </button>
        <button type="button" className="hub-icon-btn hub-sm" aria-label="Delete" title="Delete" onClick={onRemove}>
          <Icon name="trash" />
        </button>
      </div>
    </div>
  </div>
);

const QuestionCard: React.FC<CardProps<QuestionItem>> = (props) => {
  const { item, onUpdate } = props;
  const isChoice = CHOICE_KINDS.includes(item.kind);
  const canOther = item.kind === 'multiple_choice' || item.kind === 'checkboxes';

  const setKind = (kind: QuestionKind) => {
    const nowChoice = CHOICE_KINDS.includes(kind);
    onUpdate({
      kind,
      options: nowChoice ? (item.options.length ? item.options : ['Option 1']) : [],
      allowOther: kind === 'multiple_choice' || kind === 'checkboxes' ? item.allowOther : false,
    });
  };
  const setOption = (i: number, value: string) => onUpdate({ options: item.options.map((o, j) => (j === i ? value : o)) });
  const addOption = () => {
    let n = item.options.length + 1;
    while (item.options.includes(`Option ${n}`)) n++;
    onUpdate({ options: [...item.options, `Option ${n}`] });
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>(`[data-item="${item.id}"] .fm-opt input`);
      inputs[inputs.length - 1]?.select();
    }, 30);
  };
  const dupes = new Set(item.options.filter((o, i) => item.options.indexOf(o) !== i));

  return (
    <CardShell
      {...props}
      label={`Question ${props.index + 1}`}
      footerStart={
        <label className="hub-toggle" htmlFor={`req-${item.id}`}>
          <input id={`req-${item.id}`} type="checkbox" checked={item.required} onChange={(e) => onUpdate({ required: e.target.checked })} />
          <span className="hub-tg" aria-hidden="true" />
          <span>Required</span>
        </label>
      }
    >
      <div className="fm-item-h">
        <input
          className="hub-inp"
          aria-label="Question"
          placeholder="Question"
          value={item.title}
          maxLength={500}
          aria-invalid={!item.title.trim() || undefined}
          onChange={(e) => onUpdate({ title: e.target.value })}
        />
        <select className="hub-inp" aria-label="Answer type" value={item.kind} onChange={(e) => setKind(e.target.value as QuestionKind)}>
          {QUESTION_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <AutoText
        className="hub-inp"
        style={{ minHeight: 38 }}
        aria-label="Description (optional)"
        placeholder="Description or help text (optional)"
        value={item.description}
        maxLength={5000}
        onChange={(e) => onUpdate({ description: e.target.value })}
      />

      {isChoice ? (
        <div className="fm-opts">
          {item.options.map((o, i) => (
            <div className="fm-opt" key={i}>
              <span
                className={`fm-opt-mark${item.kind === 'checkboxes' ? ' fm-sq' : item.kind === 'dropdown' ? ' fm-num' : ''}`}
                aria-hidden="true"
              >
                {item.kind === 'dropdown' ? `${i + 1}.` : null}
              </span>
              <input
                className="hub-inp"
                aria-label={`Option ${i + 1}`}
                value={o}
                maxLength={200}
                aria-invalid={!o.trim() || dupes.has(o) || undefined}
                onChange={(e) => setOption(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addOption();
                  }
                }}
              />
              <button
                type="button"
                className="hub-icon-btn hub-sm"
                aria-label={`Remove option ${i + 1}`}
                disabled={item.options.length === 1}
                onClick={() => onUpdate({ options: item.options.filter((_, j) => j !== i) })}
              >
                <Icon name="x" />
              </button>
            </div>
          ))}
          {item.allowOther && (
            <div className="fm-opt">
              <span className={`fm-opt-mark${item.kind === 'checkboxes' ? ' fm-sq' : ''}`} aria-hidden="true" />
              <div className="fm-sample" style={{ flex: 1 }}>
                Other: client types their own answer
              </div>
              <button type="button" className="hub-icon-btn hub-sm" aria-label='Remove "Other"' onClick={() => onUpdate({ allowOther: false })}>
                <Icon name="x" />
              </button>
            </div>
          )}
          <div className="hub-acts" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="hub-link" onClick={addOption} disabled={item.options.length >= 50}>
              <Icon name="plus" /> Add option
            </button>
            {canOther && !item.allowOther && (
              <button type="button" className="hub-link" onClick={() => onUpdate({ allowOther: true })}>
                <Icon name="plus" /> Add "Other"
              </button>
            )}
          </div>
          {dupes.size > 0 && (
            <p className="hub-err">
              <Icon name="alert" /> Two options have the same text. Make each one different.
            </p>
          )}
        </div>
      ) : (
        <div className="fm-sample">
          {item.kind === 'short_text' && 'Short answer text'}
          {item.kind === 'long_text' && 'Long answer text'}
          {item.kind === 'file_upload' &&
            `Your client uploads up to ${FORM_LIMITS.filesPerQuestion} images or PDFs, ${FORM_LIMITS.respondentFileBytes / 1024 / 1024} MB each`}
        </div>
      )}
    </CardShell>
  );
};

const SectionCard: React.FC<CardProps<Extract<FormItem, { type: 'section' }>> & { pageNo: number }> = (props) => {
  const { item, onUpdate, pageNo } = props;
  return (
    <CardShell {...props} className="fm-section" label={`Section, page ${pageNo}`}>
      <span className="fm-tag">Section · page {pageNo}</span>
      <input
        className="hub-inp"
        aria-label="Section title"
        placeholder="Section title, e.g. Home page"
        value={item.title}
        maxLength={500}
        onChange={(e) => onUpdate({ title: e.target.value })}
      />
      <AutoText
        className="hub-inp"
        style={{ minHeight: 38 }}
        aria-label="Section description (optional)"
        placeholder="Description (optional)"
        value={item.description}
        maxLength={5000}
        onChange={(e) => onUpdate({ description: e.target.value })}
      />
    </CardShell>
  );
};

const TextCard: React.FC<CardProps<Extract<FormItem, { type: 'text' }>>> = (props) => {
  const { item, onUpdate } = props;
  return (
    <CardShell {...props} label="Text">
      <span className="fm-tag">Text</span>
      <input
        className="hub-inp"
        aria-label="Heading (optional)"
        placeholder="Heading (optional)"
        value={item.title}
        maxLength={500}
        onChange={(e) => onUpdate({ title: e.target.value })}
      />
      <AutoText
        className="hub-inp"
        aria-label="Text"
        placeholder="Instructions or information for your client"
        value={item.body}
        maxLength={5000}
        onChange={(e) => onUpdate({ body: e.target.value })}
      />
    </CardShell>
  );
};

const ImageCard: React.FC<CardProps<ImageItem> & { formId: string }> = (props) => {
  const { item, onUpdate, formId } = props;
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [over, setOver] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!BUILDER_IMAGE_TYPES.includes(file.type)) {
      toast.error('Use a PNG, JPG, GIF or WebP image.');
      return;
    }
    if (file.size > FORM_LIMITS.builderFileBytes) {
      toast.error('That image is larger than 15 MB.');
      return;
    }
    setProgress(0);
    try {
      const saved = await formsService.uploadImage(formId, file, setProgress);
      onUpdate({ fileId: saved.id, url: saved.url, alt: item.alt || file.name.replace(/\.[^.]+$/, '') });
    } catch (err) {
      toast.error(formsErrorMessage(err, "Couldn't upload the image."));
    } finally {
      setProgress(null);
    }
  };

  return (
    <CardShell {...props} label="Image">
      <span className="fm-tag">Image</span>
      <input
        ref={input}
        type="file"
        accept={BUILDER_IMAGE_TYPES.join(',')}
        hidden
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {progress !== null ? (
        <div className="hub-drop" aria-live="polite">
          <b>Uploading… {progress}%</b>
          <div className="hub-bar" style={{ width: '60%' }}>
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : item.url ? (
        <div className="fm-img-wrap">
          <img className="fm-img" src={item.url} alt={item.alt} />
          <div className="hub-acts" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="hub-btn hub-btn-sm" onClick={() => input.current?.click()}>
              <Icon name="upload" /> Replace
            </button>
            <button type="button" className="hub-btn hub-btn-ghost hub-btn-sm" onClick={() => onUpdate({ fileId: null, url: null })}>
              Remove image
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`hub-drop${over ? ' hub-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            upload(e.dataTransfer.files?.[0]);
          }}
        >
          <Icon name="upload" size={22} />
          <b>Drop a screenshot here</b>
          <span className="hub-small">PNG, JPG, GIF or WebP, up to 15 MB</span>
          <button type="button" className="hub-btn hub-btn-sm" onClick={() => input.current?.click()}>
            Choose image
          </button>
        </div>
      )}
      <div className="hub-frow">
        <div className="hub-fld">
          <label htmlFor={`alt-${item.id}`}>
            Image description<span className="hub-opt">for screen readers</span>
          </label>
          <input
            id={`alt-${item.id}`}
            className="hub-inp"
            value={item.alt}
            maxLength={500}
            placeholder="e.g. Home page with the buttons highlighted"
            onChange={(e) => onUpdate({ alt: e.target.value })}
          />
        </div>
        <div className="hub-fld">
          <label htmlFor={`cap-${item.id}`}>
            Caption<span className="hub-opt">optional</span>
          </label>
          <input id={`cap-${item.id}`} className="hub-inp" value={item.caption} maxLength={5000} onChange={(e) => onUpdate({ caption: e.target.value })} />
        </div>
      </div>
    </CardShell>
  );
};

export default FormQuestions;
