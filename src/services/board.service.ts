import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://projectmanagementtoolbackend-production.up.railway.app';

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export interface BoardPerson {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export type BoardColumnType = 'text' | 'number' | 'status' | 'date' | 'people' | 'checkbox' | 'link';

export interface BoardColumn {
  id: string;
  projectId: string;
  name: string;
  type: BoardColumnType;
  labels: { label: string; color: string }[];
  position: number;
}

export interface BoardFile {
  id: string;
  filename: string | null;
  kind: 'file' | 'link';
  mimeType: string | null;
  url: string;
}

export interface BoardTaskRow {
  id: string;
  projectId: string;
  title: string;
  type: string;
  status: string;
  stageId: string;
  isCompleted: boolean;
  description: string | null;
  assignedToId: string | null;
  deliverableId: string | null;
  dueDate: string | null;
  startDate: string | null;
  priority: string | null;
  notes: string | null;
  customFields: Record<string, any>;
  owners: BoardPerson[];
  updatedAt: string;
  updatedBy: { id: string | null; name: string; avatarUrl: string | null } | null;
  updateCount: number;
  files: BoardFile[];
}

export interface BoardGroup {
  id: string;
  name: string;
  renamable: boolean;
}

export interface ProjectBoard {
  project: {
    id: string;
    name: string;
    priority: string;
    clientType: string | null;
    pm: BoardPerson | null;
  };
  groups: BoardGroup[];
  columns: BoardColumn[];
  tasks: BoardTaskRow[];
}

export interface BoardSummary {
  id: string;
  name: string;
  priority: string;
}

export interface TaskFieldsUpdate {
  priority?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  deliverableId?: string | null;
  customFields?: Record<string, unknown>;
}

export const boardService = {
  async list(): Promise<BoardSummary[]> {
    return (await axios.get(`${API_URL}/board-view/projects`, auth())).data;
  },
  async get(projectId: string): Promise<ProjectBoard> {
    return (await axios.get(`${API_URL}/board-view/projects/${projectId}`, auth())).data;
  },
  async updateFields(taskId: string, update: TaskFieldsUpdate): Promise<any> {
    return (await axios.patch(`${API_URL}/tasks/${taskId}/fields`, update, auth())).data;
  },
  async addColumn(projectId: string, input: { name: string; type: BoardColumnType; labels?: string[] }): Promise<BoardColumn> {
    return (await axios.post(`${API_URL}/board-view/projects/${projectId}/columns`, input, auth())).data;
  },
  async updateColumn(projectId: string, columnId: string, input: { name?: string; labels?: string[] }): Promise<BoardColumn> {
    return (await axios.patch(`${API_URL}/board-view/projects/${projectId}/columns/${columnId}`, input, auth())).data;
  },
  async deleteColumn(projectId: string, columnId: string): Promise<void> {
    await axios.delete(`${API_URL}/board-view/projects/${projectId}/columns/${columnId}`, auth());
  },
};
