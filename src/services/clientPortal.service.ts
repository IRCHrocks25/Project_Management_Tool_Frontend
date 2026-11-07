/**
 * API client for people outside the company. Contract: Project_Management_Tool_Backend/docs/drively.md.
 * A client's session is kept apart from a team member's, so one browser can hold both without either affecting the other.
 */
import axios from 'axios';
import type { DriveItem, DriveKind } from './drively.service';

const API_URL = process.env.REACT_APP_API_URL || 'https://projectmanagementtoolbackend-production.up.railway.app';
const url = (path: string) => `${API_URL}/client-portal${path}`;
const TOKEN_KEY = 'drivelyClientToken';

/** True on the client pages. Checked exactly, because `/clients` is a team page. */
export const isClientPortalPath = () => {
  const path = window.location.pathname;
  return path === '/client' || path.startsWith('/client/');
};

export const clientToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const saveClientSession = (token: string) => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* The session then lasts only as long as this page's requests, which is the best a locked-down browser allows. */
  }
};

export const clearClientSession = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nothing to clear */
  }
};

const auth = () => ({ headers: { Authorization: `Bearer ${clientToken()}` } });

export interface ClientSession {
  token: string;
  client: { id: string; name: string; hasEmail: boolean };
}

export interface ClientLinkInfo {
  type: 'invite' | 'new_code';
  itemName: string;
  itemKind: DriveKind;
  sharedBy: string | null;
  clientName: string | null;
}

export const clientPortal = {
  describeLink: (token: string) => axios.get<ClientLinkInfo>(url(`/links/${encodeURIComponent(token)}`)).then((r) => r.data),
  claim: (token: string, body: { name?: string; email?: string; code: string }) =>
    axios.post<ClientSession & { itemId: string; itemKind: DriveKind }>(url(`/links/${encodeURIComponent(token)}/claim`), body).then((r) => r.data),
  signIn: (body: { name: string; code: string }) => axios.post<ClientSession>(url('/sign-in'), body).then((r) => r.data),
  forgotCode: (email: string) => axios.post<{ message: string }>(url('/forgot-code'), { email }).then((r) => r.data),
  resetCode: (body: { email: string; resetCode: string; code: string }) => axios.post<ClientSession>(url('/reset-code'), body).then((r) => r.data),
  me: () => axios.get<{ id: string; name: string; hasEmail: boolean }>(url('/me'), auth()).then((r) => r.data),
  list: (parentId?: string) => axios.get<DriveItem[]>(url('/items'), { ...auth(), params: parentId ? { parentId } : {} }).then((r) => r.data),
};
