import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://projectmanagementtoolbackend-production.up.railway.app';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return { headers: { Authorization: `Bearer ${token}` } };
};

export interface BoardAssignee {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface BoardTask {
  id: string;
  title: string;
  type: string;
  status: string;
  kanbanColumnId: string;
  kanbanColumnLabel: string;
  isCompleted: boolean;
  dueDate: string | null;
  deliverableId: string | null;
  description: string | null;
  assignees: BoardAssignee[];
}

export interface BoardDeliverable {
  id: string;
  name: string;
  status: string | null;
  rollup: { total: number; done: number };
  minDueDate: string | null;
  maxDueDate: string | null;
  tasks: BoardTask[];
}

export interface BoardProject {
  id: string;
  name: string;
  priority: string;
  clientType: string | null;
  pm: { id: string; name: string; avatarUrl: string | null } | null;
  clientStartDate: string | null;
  targetCloseMonth: string;
  rollup: { total: number; done: number };
  deliverables: BoardDeliverable[];
}

export interface BoardViewSort {
  column: 'name' | 'priority' | 'timeline' | 'pm' | 'status';
  direction: 'asc' | 'desc';
}

export interface BoardViewQueryParams {
  page?: number;
  pageSize?: number;
  q?: string;
  dept?: string[];
  pm?: string[];
  status?: string[];
  priority?: string[];
  assignee?: string[];
  sort?: BoardViewSort;
  projectId?: string;
}

export interface BoardViewResponse {
  projects: BoardProject[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function buildQueryString(params: BoardViewQueryParams): string {
  const search = new URLSearchParams();
  if (params.page !== undefined) search.set('page', String(params.page));
  if (params.pageSize !== undefined) search.set('pageSize', String(params.pageSize));
  if (params.q && params.q.trim()) search.set('q', params.q.trim());
  if (params.dept && params.dept.length > 0) search.set('dept', params.dept.join(','));
  if (params.pm && params.pm.length > 0) search.set('pm', params.pm.join(','));
  if (params.status && params.status.length > 0) search.set('status', params.status.join(','));
  if (params.priority && params.priority.length > 0) search.set('priority', params.priority.join(','));
  if (params.assignee && params.assignee.length > 0) search.set('assignee', params.assignee.join(','));
  if (params.sort) search.set('sort', `${params.sort.column}:${params.sort.direction}`);
  if (params.projectId) search.set('projectId', params.projectId);
  return search.toString();
}

export const boardViewService = {
  async fetch(params: BoardViewQueryParams = {}): Promise<BoardViewResponse> {
    const qs = buildQueryString(params);
    const url = qs ? `${API_URL}/board-view?${qs}` : `${API_URL}/board-view`;
    const response = await axios.get(url, getAuthHeaders());
    return response.data;
  },
};
