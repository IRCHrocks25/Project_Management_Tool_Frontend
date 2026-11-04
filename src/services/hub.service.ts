/**
 * Katalyst Hub API client.
 *
 * Typed wrapper for every endpoint in the Hub contract
 * (Project_Management_Tool_Backend/docs/katalyst-hub.md):
 *   - Core: products, members, links, domains, updates, comments, files
 *   - Tickets, SOPs (+ steps and per-user progress), search
 *   - Vault: credentials, reveal/copy, events, share links
 *   - Public share page (no auth)
 *   - Demo accounts
 *
 * Conventions
 *   - `productId` / `:id` is always the product uuid. Only `getProductBySlug` takes a slug.
 *   - Every method returns the response body (`response.data`), typed.
 *   - Uploads accept an optional `onProgress(percent 0–100)` callback (axios onUploadProgress).
 *   - Errors are thrown as axios errors; turn them into a human message with `hubErrorMessage(err)`.
 *   - Uses the shared axios instance, so the 401 interceptor in services/apiSetup.ts applies.
 */
import axios, { AxiosError, AxiosProgressEvent } from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://projectmanagementtoolbackend-production.up.railway.app';

/* ------------------------------------------------------------------ */
/* Shared types                                                        */
/* ------------------------------------------------------------------ */

/** Safe user shape returned everywhere by the Hub API. */
export interface HubUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role?: string | null;
}

export type ProductStatus = 'live' | 'beta' | 'building' | 'paused';

/** Tab slugs used in routes (/products/:slug/:tab) and in Attention / search results. */
export type HubTab =
  | 'overview'
  | 'updates'
  | 'tickets'
  | 'sops'
  | 'demo-accounts'
  | 'vault'
  | 'files'
  | 'team';

export type AttentionLevel = 'critical' | 'warning' | 'info';

export interface Attention {
  level: AttentionLevel;
  message: string;
  tab: HubTab;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  /** Ticket key prefix, e.g. "CF". */
  code: string;
  description: string | null;
  status: ProductStatus;
  version: string | null;
  ownerId: string | null;
  ticketSeq?: number;
  archivedAt: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductSummary extends Product {
  owner: HubUser | null;
  members: { userId: string; area: string }[];
  openTickets: number;
  highPriorityOpen: number;
  lastUpdate: { at: string; author: HubUser | null } | null;
  attention: Attention[];
}

export interface ProductMember {
  id: string;
  productId: string;
  userId: string;
  area: string;
  askAbout: string | null;
  createdAt: string;
  user: HubUser | null;
}

export type LinkKind = 'environment' | 'link';

export interface ProductLink {
  id: string;
  productId: string;
  kind: LinkKind;
  label: string;
  url: string;
  sortOrder: number;
  createdAt: string;
}

export interface ProductDomain {
  id: string;
  productId: string;
  domain: string;
  registrar: string | null;
  dnsProvider: string | null;
  /** ISO date (YYYY-MM-DD). */
  renewsOn: string | null;
  /** ISO date (YYYY-MM-DD). */
  sslExpiresOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCounts {
  updates: number;
  openTickets: number;
  sops: number;
  files: number;
  credentials: number;
  demoAccounts: number;
  members: number;
}

export interface ProductDetail extends Product {
  owner: HubUser | null;
  members: ProductMember[];
  links: ProductLink[];
  domains: ProductDomain[];
  attention: Attention[];
  counts: ProductCounts;
}

export interface CreateProductInput {
  name: string;
  code?: string;
  description?: string;
  status: ProductStatus;
  version?: string;
  ownerId: string;
  productionUrl?: string;
}

export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  status?: ProductStatus;
  version?: string | null;
  ownerId?: string;
}

export interface MemberInput {
  userId: string;
  area: string;
  askAbout?: string | null;
}

export interface LinkInput {
  kind: LinkKind;
  label: string;
  url: string;
}

export interface DomainInput {
  domain: string;
  registrar?: string | null;
  dnsProvider?: string | null;
  renewsOn: string;
  sslExpiresOn: string;
}

/* Updates, comments, files */

export type UpdateType = 'progress' | 'release' | 'heads_up' | 'blocker' | 'question';

export interface ProductFile {
  id: string;
  productId: string;
  updateId: string | null;
  name: string;
  folder: string;
  url: string;
  storageKey?: string;
  contentType: string | null;
  sizeBytes: number | null;
  uploadedById: string | null;
  /** Present when the backend joins it; otherwise look up `uploadedById`. */
  uploadedBy?: HubUser | null;
  createdAt: string;
}

export interface UpdateComment {
  id: string;
  updateId: string;
  authorId: string;
  author: HubUser | null;
  body: string;
  createdAt: string;
}

export interface ProductUpdate {
  id: string;
  productId: string;
  authorId: string;
  author: HubUser | null;
  type: UpdateType;
  body: string;
  editedAt: string | null;
  createdAt: string;
  /** Oldest first. */
  comments: UpdateComment[];
  files: ProductFile[];
}

export interface CreateUpdateInput {
  type: UpdateType;
  body: string;
  /** Up to 10 files, max 50 MB each. */
  files?: File[];
}

/* Tickets */

export type TicketType = 'bug' | 'feature' | 'request' | 'task';
export type TicketPriority = 'high' | 'medium' | 'low';
export type TicketStatus = 'todo' | 'in_progress' | 'in_review' | 'done';

export interface ProductTicket {
  id: string;
  productId: string;
  number: number;
  /** e.g. "CF-12" */
  key: string;
  title: string;
  type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  assigneeId: string | null;
  reporterId: string | null;
  assignee: HubUser | null;
  reporter: HubUser | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketFilters {
  assigneeId?: string;
  status?: TicketStatus;
  q?: string;
}

export interface CreateTicketInput {
  title: string;
  type: TicketType;
  priority: TicketPriority;
  assigneeId?: string | null;
  description?: string | null;
}

export interface UpdateTicketInput {
  title?: string;
  type?: TicketType;
  priority?: TicketPriority;
  status?: TicketStatus;
  /** null unassigns. */
  assigneeId?: string | null;
  description?: string | null;
}

/* SOPs */

export type SopLinkKind = 'url' | 'tab' | 'credential' | 'file';

export interface SopStepLink {
  kind: SopLinkKind;
  /** URL, tab slug, credential id or file id depending on `kind`. */
  ref: string;
  label: string;
}

export interface SopStep {
  id: string;
  sopId: string;
  position: number;
  text: string;
  links: SopStepLink[];
}

export interface ProductSop {
  id: string;
  productId: string;
  title: string;
  audience: string | null;
  ownerId: string | null;
  owner: HubUser | null;
  /** Ordered by position. */
  steps: SopStep[];
  /** Step ids the current user has checked off. */
  completedStepIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SopStepInput {
  /** Keep an existing step (and everyone's progress on it) by passing its id. */
  id?: string;
  text: string;
  links?: SopStepLink[];
}

export interface CreateSopInput {
  title: string;
  audience?: string | null;
  ownerId: string;
  /** At least one step. */
  steps: SopStepInput[];
}

export interface UpdateSopInput {
  title?: string;
  audience?: string | null;
  ownerId?: string;
  /** Replaces the whole list: steps with an existing id are kept, others created, missing ones deleted. */
  steps?: SopStepInput[];
}

/* Search */

export type SearchResultKind = 'product' | 'ticket' | 'sop' | 'update' | 'credential';

export interface SearchResult {
  kind: SearchResultKind;
  title: string;
  subtitle: string;
  productSlug: string;
  tab: HubTab;
  /** Item reference for the deep link (?ticket=<key>, ?sop=<id>, ?update=<id>, ?credential=<id>). */
  ref: string;
}

/* Vault */

export type CredentialEnvironment = 'production' | 'staging' | 'demo';
export type CredentialAction =
  | 'created'
  | 'edited'
  | 'revealed'
  | 'copied'
  | 'shared'
  | 'share_viewed'
  | 'share_revoked';

export interface Credential {
  id: string;
  label: string;
  environment: CredentialEnvironment;
  loginUrl: string | null;
  username: string;
  shareable: boolean;
  createdBy: HubUser | null;
  updatedAt: string;
  lastEvent: { action: CredentialAction; user: HubUser | null; at: string } | null;
  /** false: the user sees the item but cannot reveal, copy or share the secret. */
  canReveal: boolean;
}

export interface CreateCredentialInput {
  label: string;
  environment: CredentialEnvironment;
  loginUrl?: string | null;
  username: string;
  secret: string;
  shareable: boolean;
}

export interface UpdateCredentialInput {
  label?: string;
  environment?: CredentialEnvironment;
  loginUrl?: string | null;
  username?: string;
  /** Only re-encrypted when given. */
  secret?: string;
  shareable?: boolean;
}

export interface CredentialEvent {
  id: string;
  credentialId: string;
  /** null = the client, via a share link. */
  userId: string | null;
  user: HubUser | null;
  action: CredentialAction;
  detail: string | null;
  at: string;
}

export type ShareExpiry = '1h' | '24h' | '7d';

export interface CreatedShare {
  id: string;
  /** Full client URL: <FRONTEND_URL>/share/<token>. Only returned once. */
  url: string;
  expiresAt: string;
  oneTime: boolean;
}

export interface CredentialShare {
  id: string;
  credentialId: string;
  expiresAt: string;
  oneTime: boolean;
  viewedAt: string | null;
  revokedAt: string | null;
  createdById: string | null;
  createdBy?: HubUser | null;
  createdAt: string;
}

/* Public share page */

export interface PublicSharePreview {
  label: string;
  productName: string;
  expiresAt: string;
  oneTime: boolean;
}

export interface PublicShareSecret {
  label: string;
  productName: string;
  loginUrl: string | null;
  username: string;
  secret: string;
}

/* Demo accounts */

export type ContentStatus = 'not_started' | 'in_progress' | 'done' | 'not_needed';

export interface DemoAccount {
  id: string;
  productId: string;
  clientName: string;
  loginEmail: string;
  purpose: string | null;
  credentialId: string | null;
  credential: { id: string; label: string } | null;
  avatarStatus: ContentStatus;
  transcriptStatus: ContentStatus;
  ownerId: string | null;
  owner: HubUser | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDemoAccountInput {
  clientName: string;
  loginEmail: string;
  purpose?: string | null;
  ownerId: string;
  avatarStatus: ContentStatus;
  transcriptStatus: ContentStatus;
  /** With savePassword, the backend creates a "Demo login · <clientName>" credential and links it. */
  password?: string;
  savePassword?: boolean;
  credentialId?: string | null;
}

export interface UpdateDemoAccountInput {
  clientName?: string;
  loginEmail?: string;
  purpose?: string | null;
  ownerId?: string;
  avatarStatus?: ContentStatus;
  transcriptStatus?: ContentStatus;
  /** null unlinks the credential. */
  credentialId?: string | null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Max upload size per file, per the contract. */
export const HUB_MAX_FILE_BYTES = 50 * 1024 * 1024;
/** Max files attached to one update. */
export const HUB_MAX_UPDATE_FILES = 10;

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const url = (path: string) => `${API_URL}${path}`;
const enc = encodeURIComponent;

const progressHandler = (onProgress?: (percent: number) => void) =>
  onProgress
    ? (e: AxiosProgressEvent) => {
        if (e.total) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
      }
    : undefined;

async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const res = await axios.get<T>(url(path), { headers: auth(), params });
  return res.data;
}
async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await axios.post<T>(url(path), body ?? {}, { headers: auth() });
  return res.data;
}
async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await axios.patch<T>(url(path), body, { headers: auth() });
  return res.data;
}
async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await axios.put<T>(url(path), body, { headers: auth() });
  return res.data;
}
async function del<T = void>(path: string): Promise<T> {
  const res = await axios.delete<T>(url(path), { headers: auth() });
  return res.data;
}
async function postForm<T>(path: string, form: FormData, onProgress?: (percent: number) => void): Promise<T> {
  const res = await axios.post<T>(url(path), form, {
    headers: auth(),
    onUploadProgress: progressHandler(onProgress),
  });
  return res.data;
}

/** HTTP status of a failed request, if any. */
export function hubErrorStatus(err: unknown): number | undefined {
  return (err as AxiosError)?.response?.status;
}

/**
 * Human message for a failed request: the server's `message` when it sent one
 * (class-validator arrays are joined), otherwise a sensible fallback.
 */
export function hubErrorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  const ax = err as AxiosError<{ message?: string | string[] }>;
  if (ax && ax.isAxiosError) {
    if (!ax.response) return "Couldn't reach the server. Check your connection and try again.";
    const m = ax.response.data?.message;
    if (Array.isArray(m) && m.length) return m.join(' ');
    if (typeof m === 'string' && m.trim()) return m;
    if (ax.response.status === 403) return "You don't have access to do that.";
    if (ax.response.status === 404) return "This item doesn't exist any more. It may have been deleted.";
    if (ax.response.status === 413) return 'That file is too large. The limit is 50 MB per file.';
  }
  return fallback;
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export const hubService = {
  /* ---------- Core: products ---------- */
  listProducts: (opts: { archived?: boolean } = {}) =>
    get<ProductSummary[]>('/products', { archived: opts.archived ? 'true' : 'false' }),
  getProductBySlug: (slug: string) => get<ProductDetail>(`/products/by-slug/${enc(slug)}`),
  createProduct: (input: CreateProductInput) => post<Product>('/products', input),
  updateProduct: (id: string, input: UpdateProductInput) => patch<Product>(`/products/${id}`, input),
  archiveProduct: (id: string) => post<Product>(`/products/${id}/archive`),
  restoreProduct: (id: string) => post<Product>(`/products/${id}/restore`),

  /* ---------- Core: members ---------- */
  addMember: (productId: string, input: MemberInput) =>
    post<ProductMember>(`/products/${productId}/members`, input),
  updateMember: (productId: string, memberId: string, input: Partial<MemberInput>) =>
    patch<ProductMember>(`/products/${productId}/members/${memberId}`, input),
  removeMember: (productId: string, memberId: string) => del(`/products/${productId}/members/${memberId}`),

  /* ---------- Core: links ---------- */
  addLink: (productId: string, input: LinkInput) => post<ProductLink>(`/products/${productId}/links`, input),
  updateLink: (productId: string, linkId: string, input: Partial<LinkInput>) =>
    patch<ProductLink>(`/products/${productId}/links/${linkId}`, input),
  removeLink: (productId: string, linkId: string) => del(`/products/${productId}/links/${linkId}`),

  /* ---------- Core: domains ---------- */
  addDomain: (productId: string, input: DomainInput) =>
    post<ProductDomain>(`/products/${productId}/domains`, input),
  updateDomain: (productId: string, domainId: string, input: Partial<DomainInput>) =>
    patch<ProductDomain>(`/products/${productId}/domains/${domainId}`, input),
  removeDomain: (productId: string, domainId: string) => del(`/products/${productId}/domains/${domainId}`),

  /* ---------- Core: updates + comments ---------- */
  listUpdates: (productId: string) => get<ProductUpdate[]>(`/products/${productId}/updates`),
  /** multipart: type, body, files[] (field name `files`). */
  createUpdate: (productId: string, input: CreateUpdateInput, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append('type', input.type);
    form.append('body', input.body);
    (input.files || []).forEach((f) => form.append('files', f, f.name));
    return postForm<ProductUpdate>(`/products/${productId}/updates`, form, onProgress);
  },
  editUpdate: (productId: string, updateId: string, input: { type?: UpdateType; body?: string }) =>
    patch<ProductUpdate>(`/products/${productId}/updates/${updateId}`, input),
  deleteUpdate: (productId: string, updateId: string) => del(`/products/${productId}/updates/${updateId}`),
  addComment: (productId: string, updateId: string, body: string) =>
    post<UpdateComment>(`/products/${productId}/updates/${updateId}/comments`, { body }),
  deleteComment: (productId: string, updateId: string, commentId: string) =>
    del(`/products/${productId}/updates/${updateId}/comments/${commentId}`),

  /* ---------- Core: files ---------- */
  listFiles: (productId: string) => get<ProductFile[]>(`/products/${productId}/files`),
  /** Uploads several files in one request (one progress value for all of them). */
  uploadFiles: (productId: string, files: File[], folder = 'General', onProgress?: (percent: number) => void) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f, f.name));
    form.append('folder', folder);
    return postForm<ProductFile[]>(`/products/${productId}/files`, form, onProgress);
  },
  /** Uploads one file in its own request, so each file can show its own progress. */
  uploadFile: (productId: string, file: File, folder = 'General', onProgress?: (percent: number) => void) =>
    hubService.uploadFiles(productId, [file], folder, onProgress),
  deleteFile: (productId: string, fileId: string) => del(`/products/${productId}/files/${fileId}`),

  /* ---------- Tickets ---------- */
  listTickets: (productId: string, filters: TicketFilters = {}) =>
    get<ProductTicket[]>(`/products/${productId}/tickets`, {
      assigneeId: filters.assigneeId || undefined,
      status: filters.status || undefined,
      q: filters.q || undefined,
    }),
  getTicket: (productId: string, ticketId: string) =>
    get<ProductTicket>(`/products/${productId}/tickets/${ticketId}`),
  createTicket: (productId: string, input: CreateTicketInput) =>
    post<ProductTicket>(`/products/${productId}/tickets`, input),
  updateTicket: (productId: string, ticketId: string, input: UpdateTicketInput) =>
    patch<ProductTicket>(`/products/${productId}/tickets/${ticketId}`, input),
  deleteTicket: (productId: string, ticketId: string) => del(`/products/${productId}/tickets/${ticketId}`),

  /* ---------- SOPs ---------- */
  listSops: (productId: string) => get<ProductSop[]>(`/products/${productId}/sops`),
  createSop: (productId: string, input: CreateSopInput) => post<ProductSop>(`/products/${productId}/sops`, input),
  updateSop: (productId: string, sopId: string, input: UpdateSopInput) =>
    patch<ProductSop>(`/products/${productId}/sops/${sopId}`, input),
  deleteSop: (productId: string, sopId: string) => del(`/products/${productId}/sops/${sopId}`),
  addSopStep: (productId: string, sopId: string, input: { text: string; links?: SopStepLink[] }) =>
    post<ProductSop>(`/products/${productId}/sops/${sopId}/steps`, input),
  setSopStepProgress: (productId: string, sopId: string, stepId: string, done: boolean) =>
    put<{ stepId: string; done: boolean; completedStepIds: string[] }>(
      `/products/${productId}/sops/${sopId}/steps/${stepId}/progress`,
      { done },
    ),

  /* ---------- Search ---------- */
  /** Needs at least 2 characters; returns at most 20 results from non-archived products. */
  search: (q: string) => get<SearchResult[]>('/product-search', { q }),

  /* ---------- Vault ---------- */
  listCredentials: (productId: string) => get<Credential[]>(`/products/${productId}/credentials`),
  createCredential: (productId: string, input: CreateCredentialInput) =>
    post<Credential>(`/products/${productId}/credentials`, input),
  updateCredential: (productId: string, credId: string, input: UpdateCredentialInput) =>
    patch<Credential>(`/products/${productId}/credentials/${credId}`, input),
  deleteCredential: (productId: string, credId: string) => del(`/products/${productId}/credentials/${credId}`),
  /** 403 "Only people on this product can see this password." when not allowed. */
  revealCredential: (productId: string, credId: string, purpose: 'reveal' | 'copy' = 'reveal') =>
    post<{ secret: string }>(`/products/${productId}/credentials/${credId}/reveal`, { purpose }),
  listCredentialEvents: (productId: string, credId: string) =>
    get<CredentialEvent[]>(`/products/${productId}/credentials/${credId}/events`),

  /* ---------- Vault: share links ---------- */
  createShare: (productId: string, credId: string, input: { expiresIn: ShareExpiry; oneTime: boolean }) =>
    post<CreatedShare>(`/products/${productId}/credentials/${credId}/shares`, input),
  listShares: (productId: string, credId: string) =>
    get<CredentialShare[]>(`/products/${productId}/credentials/${credId}/shares`),
  revokeShare: (productId: string, credId: string, shareId: string) =>
    del(`/products/${productId}/credentials/${credId}/shares/${shareId}`),

  /* ---------- Public share page (no auth) ---------- */
  /** Doesn't consume the link. 410 when expired, used, revoked or unknown. */
  getPublicShare: async (token: string) => {
    const res = await axios.get<PublicSharePreview>(url(`/vault-shares/${enc(token)}`));
    return res.data;
  },
  /** Returns the secret; a one-time link is used up after this call. */
  openPublicShare: async (token: string) => {
    const res = await axios.post<PublicShareSecret>(url(`/vault-shares/${enc(token)}/open`), {});
    return res.data;
  },

  /* ---------- Demo accounts ---------- */
  listDemoAccounts: (productId: string) => get<DemoAccount[]>(`/products/${productId}/demo-accounts`),
  createDemoAccount: (productId: string, input: CreateDemoAccountInput) =>
    post<DemoAccount>(`/products/${productId}/demo-accounts`, input),
  updateDemoAccount: (productId: string, demoId: string, input: UpdateDemoAccountInput) =>
    patch<DemoAccount>(`/products/${productId}/demo-accounts/${demoId}`, input),
  deleteDemoAccount: (productId: string, demoId: string) =>
    del(`/products/${productId}/demo-accounts/${demoId}`),

  /* ---------- Users (existing endpoint) ---------- */
  /** GET /auth/users, mapped to the safe HubUser shape. */
  listUsers: async (): Promise<HubUser[]> => {
    const data = await get<Array<Record<string, unknown>>>('/auth/users');
    return (Array.isArray(data) ? data : [])
      .filter((u) => u && typeof u.id === 'string')
      .map((u) => ({
        id: u.id as string,
        name: (u.name as string) || (u.email as string) || 'Unnamed',
        avatarUrl: (u.avatarUrl as string | null) ?? null,
        role: (u.role as string | null) ?? null,
      }));
  },
};

export default hubService;
