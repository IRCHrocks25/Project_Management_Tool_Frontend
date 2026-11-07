/**
 * Drively API client. Contract: Project_Management_Tool_Backend/docs/drively.md.
 * Errors are axios errors; turn them into a message with `hubErrorMessage(err)`.
 */
import axios from 'axios';
import type { CommentAnchor } from '../components/drively/commentAnchors';
import { clientToken, isClientPortalPath } from './clientPortal.service';
import { HubUser } from './hub.service';

const API_URL = process.env.REACT_APP_API_URL || 'https://projectmanagementtoolbackend-production.up.railway.app';
/** The viewers are shared with the client pages, where the client's own session and read-only routes apply. */
export const driveToken = () => (isClientPortalPath() ? clientToken() : localStorage.getItem('token'));
const auth = () => ({ headers: { Authorization: `Bearer ${driveToken()}` } });
const url = (path: string) => `${API_URL}/drively${path}`;
const readUrl = (path: string) => `${API_URL}/${isClientPortalPath() ? 'client-portal' : 'drively'}${path}`;

export type DriveKind = 'folder' | 'doc' | 'grid' | 'slides' | 'pdf' | 'file';
export type DriveView = 'mine' | 'shared' | 'recent' | 'starred' | 'trash';
export type DriveAccess = 'owner' | 'edit' | 'comment' | 'view';
export type DrivePermission = 'view' | 'comment' | 'edit';
export type DriveClientPermission = 'view' | 'comment';

/** Only these change a file. Everyone else is read-only, however much else they can do. */
export const canEditLevel = (level: DriveAccess) => level === 'owner' || level === 'edit';

export interface DrivePreview {
  lines?: { t: string; h?: boolean }[];
  rows?: string[][];
  slide?: { bg?: string; els: { x: number; y: number; w: number; h: number; t?: string; c?: string; f?: string; s?: number; shape?: string }[] };
}

export interface DriveItem {
  id: string;
  kind: DriveKind;
  name: string;
  parentId: string | null;
  preview: DrivePreview | null;
  revision: number;
  contentType: string | null;
  sizeBytes: number;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner: HubUser | null;
  updatedBy: HubUser | null;
  isOwner: boolean;
  starred: boolean;
  lastOpenedAt: string | null;
}

export interface DriveDetail extends DriveItem {
  myAccess: DriveAccess;
  path: { id: string; name: string }[];
  /** Plain content for a file nobody has opened yet. After that it lives in the live session. */
  content: any;
  hasLiveState: boolean;
  /** Fresh links for this file's pictures, by asset id. */
  assetLinks: Record<string, string>;
}

export interface DriveShare {
  kind: 'everyone' | 'department' | 'user';
  target: string | null;
  permission: DrivePermission;
  user?: HubUser | null;
}

export interface DriveClientLink {
  id: string;
  token: string;
  expiresAt: string;
}

export interface DriveClientAccess {
  clients: { id: string; name: string; email: string | null; lastSeenAt: string | null; permission: DriveClientPermission; sharedAt: string }[];
  /** Links nobody has used yet. `clientName` set means it sets a new code for that client. */
  links: { id: string; expiresAt: string; createdAt: string; clientName: string | null; permission: DriveClientPermission }[];
}

export const drivelyService = {
  list: (params: { view?: DriveView; parentId?: string; q?: string }) =>
    axios.get<DriveItem[]>(url('/items'), { ...auth(), params }).then((r) => r.data),
  storage: () => axios.get<{ usedBytes: number }>(url('/storage'), auth()).then((r) => r.data),
  get: (id: string) => axios.get<DriveDetail>(readUrl(`/items/${id}`), auth()).then((r) => r.data),
  create: (body: { kind: 'folder' | 'doc' | 'grid' | 'slides'; name?: string; parentId?: string | null; content?: unknown; preview?: unknown }) =>
    axios.post<DriveItem>(url('/items'), body, auth()).then((r) => r.data),
  update: (id: string, body: { name?: string; parentId?: string | null; content?: unknown; preview?: unknown; revision?: number }) =>
    axios.patch<DriveItem>(url(`/items/${id}`), body, auth()).then((r) => r.data),
  upload: (file: File, parentId: string | null, onProgress?: (fraction: number) => void) => {
    const form = new FormData();
    form.append('files', file);
    if (parentId) form.append('parentId', parentId);
    return axios
      .post<DriveItem[]>(url('/upload'), form, {
        ...auth(),
        onUploadProgress: (e) => e.total && onProgress?.(e.loaded / e.total),
      })
      .then((r) => r.data[0]);
  },
  replace: (id: string, file: File, revision: number) => {
    const form = new FormData();
    form.append('file', file);
    form.append('revision', String(revision));
    return axios.post<DriveItem>(url(`/items/${id}/replace`), form, auth()).then((r) => r.data);
  },
  link: (id: string) => axios.get<{ url: string; expiresAt: string }>(readUrl(`/items/${id}/link`), auth()).then((r) => r.data),
  addImage: (id: string, file: Blob, name = 'image.png') => {
    const form = new FormData();
    form.append('file', file, name);
    return axios.post<{ assetId: string; src: string }>(url(`/items/${id}/images`), form, auth()).then((r) => r.data);
  },
  duplicate: (id: string) => axios.post<DriveItem>(url(`/items/${id}/duplicate`), {}, auth()).then((r) => r.data),
  star: (id: string, starred: boolean) => axios.post(url(`/items/${id}/star`), { starred }, auth()).then((r) => r.data),
  trash: (id: string) => axios.post(url(`/items/${id}/trash`), {}, auth()).then((r) => r.data),
  restore: (id: string) => axios.post(url(`/items/${id}/restore`), {}, auth()).then((r) => r.data),
  remove: (id: string) => axios.delete(url(`/items/${id}`), auth()).then((r) => r.data),
  shares: (id: string) => axios.get<DriveShare[]>(url(`/items/${id}/shares`), auth()).then((r) => r.data),
  setShares: (id: string, shares: Pick<DriveShare, 'kind' | 'target' | 'permission'>[]) =>
    axios.put<DriveShare[]>(url(`/items/${id}/shares`), { shares }, auth()).then((r) => r.data),

  /* Clients outside the company. Only a file's owner can use these. */
  clientAccess: (id: string) => axios.get<DriveClientAccess>(url(`/items/${id}/client-access`), auth()).then((r) => r.data),
  knownClients: () => axios.get<{ id: string; name: string; email: string | null }[]>(url('/clients'), auth()).then((r) => r.data),
  createClientLink: (id: string, permission: DriveClientPermission) => axios.post<DriveClientLink>(url(`/items/${id}/client-links`), { permission }, auth()).then((r) => r.data),
  cancelClientLink: (id: string, linkId: string) => axios.delete(url(`/items/${id}/client-links/${linkId}`), auth()).then((r) => r.data),
  shareWithClient: (id: string, clientId: string, permission: DriveClientPermission) => axios.post(url(`/items/${id}/client-access`), { clientId, permission }, auth()).then((r) => r.data),
  setClientPermission: (id: string, clientId: string, permission: DriveClientPermission) => axios.patch(url(`/items/${id}/client-access/${clientId}`), { permission }, auth()).then((r) => r.data),
  removeClient: (id: string, clientId: string) => axios.delete(url(`/items/${id}/client-access/${clientId}`), auth()).then((r) => r.data),
  newCodeLink: (id: string, clientId: string) => axios.post<DriveClientLink>(url(`/items/${id}/client-access/${clientId}/new-code-link`), {}, auth()).then((r) => r.data),
};

export interface DriveComment {
  id: string;
  body: string;
  authorName: string;
  authorIsClient: boolean;
  mine: boolean;
  createdAt: string;
  editedAt: string | null;
  canDelete: boolean;
}

export interface CommentThread extends DriveComment {
  anchor: CommentAnchor | null;
  visibility: 'team' | 'everyone';
  resolvedAt: string | null;
  resolvedByName: string | null;
  canResolve: boolean;
  replies: DriveComment[];
}

export interface DriveCommentsData {
  canComment: boolean;
  isClient: boolean;
  /** A client could read a thread here if the team shows it to them. */
  clientsCanComment: boolean;
  threads: CommentThread[];
}

/** The same calls for team members and clients: the page decides which routes and session apply. */
export const driveCommentsApi = {
  list: (itemId: string) => axios.get<DriveCommentsData>(readUrl(`/items/${itemId}/comments`), auth()).then((r) => r.data),
  add: (itemId: string, body: { body: string; parentId?: string; anchor?: CommentAnchor | null; showToClients?: boolean }) =>
    axios.post<{ id: string }>(readUrl(`/items/${itemId}/comments`), body, auth()).then((r) => r.data),
  update: (id: string, body: string) => axios.patch(readUrl(`/comments/${id}`), { body }, auth()).then((r) => r.data),
  remove: (id: string) => axios.delete(readUrl(`/comments/${id}`), auth()).then((r) => r.data),
  resolve: (id: string, resolved: boolean) => axios.post(readUrl(`/comments/${id}/resolve`), { resolved }, auth()).then((r) => r.data),
};

/** The address a client opens. The token is only known at the moment the link is created. */
export const clientLinkUrl = (token: string) => `${window.location.origin}/client/link/${token}`;
export const clientSignInUrl = () => `${window.location.origin}/client`;

/** Fetches a private file's bytes through a short-lived link. */
export async function fetchDriveBytes(id: string): Promise<ArrayBuffer> {
  const { url: link } = await drivelyService.link(id);
  const response = await fetch(link);
  if (!response.ok) throw new Error('Could not open the file.');
  return response.arrayBuffer();
}

export function saveBlob(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
