import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://projectmanagementtoolbackend-production.up.railway.app';

export type AssistantAction =
  | { type: 'navigate'; path: string; label: string }
  | { type: 'vault_link'; label: string; url: string; expiresAt: string; oneTime: boolean };

export interface PendingAction {
  id: string;
  summary: string;
}

export interface AssistantReply {
  conversationId: string;
  text: string;
  actions: AssistantAction[];
  pending: PendingAction[];
}

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const headers = () => ({ headers: authHeaders() });

export const assistantService = {
  chat: async (input: { conversationId: string | null; message: string; fileIds: string[]; page: string }): Promise<AssistantReply> => {
    const body = { ...input, conversationId: input.conversationId || undefined, localTime: new Date().toString() };
    return (await axios.post(`${API_URL}/assistant/chat`, body, headers())).data;
  },
  decide: async (conversationId: string, decisions: Record<string, 'approve' | 'reject'>): Promise<AssistantReply> =>
    (await axios.post(`${API_URL}/assistant/conversations/${conversationId}/decide`, { decisions }, headers())).data,
  uploadFile: async (file: File): Promise<{ id: string; fileName: string; size: number }> => {
    const form = new FormData();
    form.append('file', file);
    return (await axios.post(`${API_URL}/assistant/files`, form, headers())).data;
  },
  listConversations: async (): Promise<{ id: string; title: string; updatedAt: string }[]> =>
    (await axios.get(`${API_URL}/assistant/conversations`, headers())).data,
  getConversation: async (
    id: string,
  ): Promise<{ id: string; title: string; messages: { id: string; role: 'user' | 'assistant'; text: string }[]; pending: PendingAction[] }> =>
    (await axios.get(`${API_URL}/assistant/conversations/${id}`, headers())).data,
};
