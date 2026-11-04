/**
 * Forms API client (Google-Forms-style forms for clients).
 *
 * Team routes need a login (`/forms/...`); the public page uses `/public/forms/:token`
 * through a separate axios instance, so the 401 interceptor never logs a client out.
 * Item and answer shapes mirror Project_Management_Tool_Backend/src/forms/forms.types.ts.
 */
import axios, { AxiosProgressEvent } from 'axios';
import { HubUser, hubErrorMessage } from './hub.service';

const API_URL = process.env.REACT_APP_API_URL || 'https://projectmanagementtoolbackend-production.up.railway.app';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export const QUESTION_KINDS = ['short_text', 'long_text', 'multiple_choice', 'checkboxes', 'dropdown', 'file_upload'] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];
export const CHOICE_KINDS: QuestionKind[] = ['multiple_choice', 'checkboxes', 'dropdown'];
/** Value an answer uses for the "Other" option; its text goes in `other`. */
export const OTHER_OPTION = '__other__';

export const KIND_LABELS: Record<QuestionKind, string> = {
  short_text: 'Short answer',
  long_text: 'Paragraph',
  multiple_choice: 'Multiple choice',
  checkboxes: 'Checkboxes',
  dropdown: 'Dropdown',
  file_upload: 'File upload',
};

export interface SectionItem {
  id: string;
  type: 'section';
  title: string;
  description: string;
}
export interface TextItem {
  id: string;
  type: 'text';
  title: string;
  body: string;
}
export interface ImageItem {
  id: string;
  type: 'image';
  fileId: string | null;
  url: string | null;
  alt: string;
  caption: string;
}
export interface QuestionItem {
  id: string;
  type: 'question';
  kind: QuestionKind;
  title: string;
  description: string;
  required: boolean;
  options: string[];
  allowOther: boolean;
}
export type FormItem = SectionItem | TextItem | ImageItem | QuestionItem;

export interface FormSettings {
  collectName: boolean;
  collectEmail: boolean;
  confirmationMessage: string;
}

export type FormStatus = 'draft' | 'open' | 'closed';

export interface FormSummary {
  id: string;
  title: string;
  description: string | null;
  status: FormStatus;
  isTemplate: boolean;
  publicToken: string | null;
  owner: HubUser | null;
  project: { id: string; name: string } | null;
  questionCount: number;
  responseCount: number;
  lastResponseAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FormDetail extends FormSummary {
  items: FormItem[];
  settings: FormSettings;
}

export interface FormFileRef {
  id: string;
  name: string;
  url: string;
  contentType: string | null;
  sizeBytes: number | null;
}

export interface FormAnswer {
  questionId: string;
  title: string;
  kind: QuestionKind;
  value: string | string[] | null;
  other: string | null;
  files: FormFileRef[];
}

export interface FormResponse {
  id: string;
  formId: string;
  answers: FormAnswer[];
  respondentName: string | null;
  respondentEmail: string | null;
  submittedAt: string;
}

export type FormUpdate = Partial<{
  title: string;
  description: string;
  projectId: string | null;
  items: FormItem[];
  settings: Partial<FormSettings>;
}>;

export interface PublicForm {
  status: 'open' | 'closed';
  title: string;
  description?: string | null;
  items?: FormItem[];
  settings?: { collectName: boolean; collectEmail: boolean };
}

export interface AnswerInput {
  questionId: string;
  value?: string | string[];
  other?: string;
  fileIds?: string[];
}

/** Limits enforced by the server. */
export const FORM_LIMITS = {
  builderFileBytes: 15 * 1024 * 1024,
  respondentFileBytes: 10 * 1024 * 1024,
  filesPerQuestion: 10,
  shortAnswer: 1000,
  longAnswer: 10000,
};
export const BUILDER_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
export const RESPONDENT_FILE_TYPES = [...BUILDER_IMAGE_TYPES, 'application/pdf'];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const url = (path: string) => `${API_URL}${path}`;
const publicAxios = axios.create({ baseURL: API_URL });

const progressHandler = (onProgress?: (percent: number) => void) =>
  onProgress
    ? (e: AxiosProgressEvent) => {
        if (e.total) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
      }
    : undefined;

const filesForm = (files: File[]) => {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  return form;
};

/** Human message for a failed request; same rules as the Hub. */
export const formsErrorMessage = (err: unknown, fallback?: string) => {
  const status = (err as any)?.response?.status;
  if (status === 413) return 'That file is too large.';
  if (status === 429) return 'Too many tries in a short time. Wait a minute and try again.';
  return hubErrorMessage(err, fallback);
};

/** The link clients open. */
export const publicFormUrl = (token: string) => `${window.location.origin}/f/${token}`;

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export const formsService = {
  async list(scope: 'mine' | 'all' | 'templates', q?: string): Promise<FormSummary[]> {
    const res = await axios.get<FormSummary[]>(url('/forms'), { headers: auth(), params: { scope, q: q || undefined } });
    return res.data;
  },
  async get(id: string): Promise<FormDetail> {
    return (await axios.get<FormDetail>(url(`/forms/${id}`), { headers: auth() })).data;
  },
  async create(body: { title?: string; fromTemplateId?: string; projectId?: string }): Promise<FormDetail> {
    return (await axios.post<FormDetail>(url('/forms'), body, { headers: auth() })).data;
  },
  async update(id: string, body: FormUpdate): Promise<FormDetail> {
    return (await axios.patch<FormDetail>(url(`/forms/${id}`), body, { headers: auth() })).data;
  },
  async remove(id: string): Promise<void> {
    await axios.delete(url(`/forms/${id}`), { headers: auth() });
  },
  async action(
    id: string,
    action: 'duplicate' | 'save-as-template' | 'publish' | 'close' | 'reopen' | 'regenerate-link',
  ): Promise<FormDetail> {
    return (await axios.post<FormDetail>(url(`/forms/${id}/${action}`), {}, { headers: auth() })).data;
  },
  async uploadImage(id: string, file: File, onProgress?: (percent: number) => void): Promise<FormFileRef> {
    const res = await axios.post<FormFileRef[]>(url(`/forms/${id}/files`), filesForm([file]), {
      headers: auth(),
      onUploadProgress: progressHandler(onProgress),
    });
    return res.data[0];
  },
  async responses(id: string): Promise<FormResponse[]> {
    return (await axios.get<FormResponse[]>(url(`/forms/${id}/responses`), { headers: auth() })).data;
  },
  async deleteResponse(id: string, responseId: string): Promise<void> {
    await axios.delete(url(`/forms/${id}/responses/${responseId}`), { headers: auth() });
  },

  /* ---------- public, no login ---------- */
  async getPublic(token: string): Promise<PublicForm> {
    return (await publicAxios.get<PublicForm>(`/public/forms/${encodeURIComponent(token)}`)).data;
  },
  async uploadPublic(token: string, file: File, onProgress?: (percent: number) => void): Promise<FormFileRef> {
    const res = await publicAxios.post<FormFileRef[]>(`/public/forms/${encodeURIComponent(token)}/files`, filesForm([file]), {
      onUploadProgress: progressHandler(onProgress),
    });
    return res.data[0];
  },
  async submit(
    token: string,
    body: { answers: AnswerInput[]; respondentName?: string; respondentEmail?: string },
  ): Promise<{ confirmationMessage: string }> {
    return (await publicAxios.post(`/public/forms/${encodeURIComponent(token)}/responses`, body)).data;
  },
};
