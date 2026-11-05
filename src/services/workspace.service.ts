/**
 * Workspace API client: Vault (company and personal logins), Pages and My Day.
 * Contract: Project_Management_Tool_Backend/docs/workspace.md.
 * Errors are axios errors; turn them into a message with `hubErrorMessage(err)`.
 */
import axios from 'axios';
import { HubUser } from './hub.service';

const API_URL = process.env.REACT_APP_API_URL || 'https://projectmanagementtoolbackend-production.up.railway.app';

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

/** Departments are the role values on a user. */
export const DEPARTMENTS = [
  'FOUNDER/CEO',
  'Project Manager',
  'Rapid Prospect',
  'Copy Writing',
  'Designer',
  'Developer',
  'AI Developer',
  'Social Media',
  'CRM',
  'SEO/GEO',
] as const;

export interface Access {
  everyone: boolean;
  departments: string[];
  userIds: string[];
}

/* ------------------------------ Vault ------------------------------ */

export type VaultScope = 'company' | 'personal';

export interface VaultItem {
  id: string;
  scope: VaultScope;
  label: string;
  loginUrl: string | null;
  username: string;
  notes: string | null;
  access: Access;
  createdBy: HubUser | null;
  updatedBy: HubUser | null;
  createdAt: string;
  updatedAt: string;
  passwordChangedAt: string | null;
  passwordChangedBy: HubUser | null;
  lastEvent: { action: string; user: HubUser | null; at: string } | null;
  canManage: boolean;
}

export interface CreateVaultItemInput {
  scope: VaultScope;
  label: string;
  loginUrl?: string | null;
  username: string;
  secret: string;
  notes?: string | null;
  access?: Access;
}

export type UpdateVaultItemInput = Partial<Omit<CreateVaultItemInput, 'scope'>>;

export interface VaultEvent {
  id: string;
  action: string;
  detail: string | null;
  user: HubUser | null;
  at: string;
}

export interface VaultVersion {
  id: string;
  changedBy: HubUser | null;
  createdAt: string;
  expiresAt: string;
}

/* ------------------------------ Pages ------------------------------ */

export type PagePermission = 'view' | 'edit';
export type PageShareKind = 'everyone' | 'department' | 'user';

export interface PageShare {
  kind: PageShareKind;
  target: string | null;
  permission: PagePermission;
  user?: HubUser | null;
}

export interface PageSummary {
  id: string;
  title: string;
  owner: HubUser | null;
  myAccess: 'owner' | PagePermission;
  sharedWith: { everyone: boolean; departments: string[]; userCount: number };
  checklist: { done: number; total: number };
  excerpt: string;
  updatedAt: string;
  updatedBy: HubUser | null;
}

export interface PageDetail extends PageSummary {
  content: any;
  revision: number;
  createdAt: string;
}

export interface TaskSearchResult {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
}

/* ------------------------------ My Day ----------------------------- */

export interface MyDayTask {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  status: string;
  dueDate: string | null;
  overdue: boolean;
}

export interface MyDay {
  date: string;
  tasks: MyDayTask[];
  focus: MyDayTask[];
  checklist: { pageId: string; pageTitle: string; index: number; text: string }[];
  mentions: {
    id: string;
    title: string;
    message: string;
    link: string | null;
    projectId: string | null;
    taskId: string | null;
    createdAt: string;
  }[];
  recentPages: { id: string; title: string; openedAt: string }[];
}

/* ------------------------------ Client ----------------------------- */

const data = <T,>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const workspaceService = {
  // Vault
  listVaultItems: (scope: VaultScope) => data<VaultItem[]>(axios.get(`${API_URL}/vault/items`, { ...auth(), params: { scope } })),
  createVaultItem: (body: CreateVaultItemInput) => data<VaultItem>(axios.post(`${API_URL}/vault/items`, body, auth())),
  updateVaultItem: (id: string, body: UpdateVaultItemInput) => data<VaultItem>(axios.patch(`${API_URL}/vault/items/${id}`, body, auth())),
  deleteVaultItem: (id: string) => data<{ success: boolean }>(axios.delete(`${API_URL}/vault/items/${id}`, auth())),
  revealVaultItem: (id: string, purpose: 'reveal' | 'copy') =>
    data<{ secret: string }>(axios.post(`${API_URL}/vault/items/${id}/reveal`, { purpose }, auth())),
  vaultItemEvents: (id: string) => data<VaultEvent[]>(axios.get(`${API_URL}/vault/items/${id}/events`, auth())),
  vaultItemVersions: (id: string) => data<VaultVersion[]>(axios.get(`${API_URL}/vault/items/${id}/versions`, auth())),
  revealVaultVersion: (id: string, versionId: string) =>
    data<{ secret: string }>(axios.post(`${API_URL}/vault/items/${id}/versions/${versionId}/reveal`, {}, auth())),
  restoreVaultVersion: (id: string, versionId: string) =>
    data<VaultItem>(axios.post(`${API_URL}/vault/items/${id}/versions/${versionId}/restore`, {}, auth())),

  // Pages
  listPages: (view: 'mine' | 'shared', q?: string) =>
    data<PageSummary[]>(axios.get(`${API_URL}/workspace/pages`, { ...auth(), params: { view, q: q || undefined } })),
  createPage: (body: { title?: string; content?: any } = {}) => data<PageDetail>(axios.post(`${API_URL}/workspace/pages`, body, auth())),
  getPage: (id: string) => data<PageDetail>(axios.get(`${API_URL}/workspace/pages/${id}`, auth())),
  updatePage: (id: string, body: { revision: number; title?: string; content?: any }) =>
    data<PageDetail>(axios.patch(`${API_URL}/workspace/pages/${id}`, body, auth())),
  deletePage: (id: string) => data<{ success: boolean }>(axios.delete(`${API_URL}/workspace/pages/${id}`, auth())),
  duplicatePage: (id: string) => data<PageDetail>(axios.post(`${API_URL}/workspace/pages/${id}/duplicate`, {}, auth())),
  getPageShares: (id: string) => data<PageShare[]>(axios.get(`${API_URL}/workspace/pages/${id}/shares`, auth())),
  setPageShares: (id: string, shares: Pick<PageShare, 'kind' | 'target' | 'permission'>[]) =>
    data<PageShare[]>(axios.put(`${API_URL}/workspace/pages/${id}/shares`, { shares }, auth())),
  toggleChecklistItem: (id: string, body: { index: number; text: string; checked: boolean }) =>
    data<PageDetail>(axios.patch(`${API_URL}/workspace/pages/${id}/checklist`, body, auth())),
  uploadPageImage: (id: string, file: File) => {
    const form = new FormData();
    form.append('files', file);
    return data<{ url: string }>(axios.post(`${API_URL}/workspace/pages/${id}/images`, form, auth()));
  },
  searchTasks: (q: string) => data<TaskSearchResult[]>(axios.get(`${API_URL}/workspace/task-search`, { ...auth(), params: { q } })),

  // My Day
  getMyDay: () => data<MyDay>(axios.get(`${API_URL}/workspace/my-day`, auth())),
};
