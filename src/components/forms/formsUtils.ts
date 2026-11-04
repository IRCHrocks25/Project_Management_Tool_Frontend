import { FormAnswer, FormItem, FormResponse, FormStatus, OTHER_OPTION, QuestionItem, QuestionKind } from '../../services/forms.service';
import { BadgeTone } from '../hub/ui/Badge';

export const STATUS_BADGE: Record<FormStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  open: { label: 'Accepting responses', tone: 'ok' },
  closed: { label: 'Closed', tone: 'warn' },
};

/** Short random id for a new item; unique within one form. */
export const newItemId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export function newQuestion(kind: QuestionKind = 'short_text'): QuestionItem {
  return {
    id: newItemId('q'),
    type: 'question',
    kind,
    title: '',
    description: '',
    required: false,
    options: ['multiple_choice', 'checkboxes', 'dropdown'].includes(kind) ? ['Option 1'] : [],
    allowOther: false,
  };
}

export function newItem(type: FormItem['type']): FormItem {
  switch (type) {
    case 'section':
      return { id: newItemId('s'), type: 'section', title: '', description: '' };
    case 'text':
      return { id: newItemId('t'), type: 'text', title: '', body: '' };
    case 'image':
      return { id: newItemId('i'), type: 'image', fileId: null, url: null, alt: '', caption: '' };
    default:
      return newQuestion();
  }
}

/** A copy of an item with a new id (and a new id per question, so answers stay apart). */
export function cloneItem(item: FormItem): FormItem {
  return { ...item, id: newItemId(item.type[0]) } as FormItem;
}

export const questionsOf = (items: FormItem[]) => items.filter((i): i is QuestionItem => i.type === 'question');

/** A readable version of an answer for tables, exports and the single-response view. */
export function answerText(answer: FormAnswer | undefined): string {
  if (!answer) return '';
  if (answer.kind === 'file_upload') return answer.files.map((f) => f.name).join(', ');
  const label = (v: string) => (v === OTHER_OPTION ? `Other: ${answer.other || ''}` : v);
  if (Array.isArray(answer.value)) return answer.value.map(label).join(', ');
  return answer.value ? label(answer.value) : '';
}

/**
 * Columns for the table and exports: the form's current questions in order, then any
 * question that only exists in older responses (removed or replaced since).
 */
export function responseColumns(items: FormItem[], responses: FormResponse[]): { id: string; title: string }[] {
  const cols = questionsOf(items).map((q) => ({ id: q.id, title: q.title || 'Untitled question' }));
  const known = new Set(cols.map((c) => c.id));
  for (const r of responses) {
    for (const a of r.answers) {
      if (!known.has(a.questionId)) {
        known.add(a.questionId);
        cols.push({ id: a.questionId, title: `${a.title || 'Untitled question'} (removed)` });
      }
    }
  }
  return cols;
}

export const fmtDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Groups items into pages: a section starts a new page; anything before the first section is page 1. */
export function paginate(items: FormItem[]): { section: FormItem | null; items: FormItem[] }[] {
  const pages: { section: FormItem | null; items: FormItem[] }[] = [];
  let current: { section: FormItem | null; items: FormItem[] } = { section: null, items: [] };
  for (const item of items) {
    if (item.type === 'section') {
      if (current.section || current.items.length) pages.push(current);
      current = { section: item, items: [] };
    } else {
      current.items.push(item);
    }
  }
  if (current.section || current.items.length || pages.length === 0) pages.push(current);
  return pages;
}
