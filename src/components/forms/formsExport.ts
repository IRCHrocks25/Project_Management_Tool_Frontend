import * as XLSX from 'xlsx';
import { FormDetail, FormResponse } from '../../services/forms.service';
import { answerText, responseColumns } from './formsUtils';

/** One row per response: submitted time, name, email, then one column per question. */
function rows(form: FormDetail, responses: FormResponse[]): string[][] {
  const cols = responseColumns(form.items, responses);
  const header = ['Submitted', 'Name', 'Email', ...cols.map((c) => c.title)];
  const body = responses.map((r) => {
    const byQ = new Map(r.answers.map((a) => [a.questionId, a]));
    return [
      new Date(r.submittedAt).toLocaleString(),
      r.respondentName || '',
      r.respondentEmail || '',
      ...cols.map((c) => {
        const a = byQ.get(c.id);
        // Exports carry file links, not just names, so files can be opened from the sheet.
        return a?.kind === 'file_upload' ? a.files.map((f) => f.url).join('\n') : answerText(a);
      }),
    ];
  });
  return [header, ...body];
}

const fileBase = (form: FormDetail) =>
  `${(form.title || 'form').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'form'}-responses`;

/** Spreadsheet apps treat a leading = + - @ as a formula; prefix those so answers stay text. */
const safe = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function exportCsv(form: FormDetail, responses: FormResponse[]) {
  const csv = rows(form, responses)
    .map((r) => r.map((v) => csvCell(safe(v))).join(','))
    .join('\r\n');
  // BOM so Excel opens UTF-8 (accents, emoji) correctly.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${fileBase(form)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function exportXlsx(form: FormDetail, responses: FormResponse[]) {
  const data = rows(form, responses).map((r) => r.map(safe));
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!cols'] = data[0].map((h, i) => ({ wch: i === 0 ? 20 : Math.min(60, Math.max(12, h.length + 2)) }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Responses');
  XLSX.writeFile(book, `${fileBase(form)}.xlsx`);
}
