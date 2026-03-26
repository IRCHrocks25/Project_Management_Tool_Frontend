import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://projectmanagementtoolbackend-production.up.railway.app';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
};

export interface DailyFocusRow {
  id: string;
  focusDate: string;
  departmentKey: string;
  rank: number;
  taskId: string;
  taskTitle: string;
  projectId: string | null;
  projectName: string;
  assigneeName: string;
  taskStatus?: string;
  isCompleted?: boolean;
}

export interface EodCompletedRow {
  taskId: string;
  taskTitle: string;
  departmentKey: string;
  projectId: string;
  projectName: string;
  assigneeName: string;
  completedAt: string;
  status: string;
  isCompleted: boolean;
}

export interface EndOfDayReport {
  date: string;
  timezone: string;
  planned: Array<DailyFocusRow & { planned: boolean }>;
  completed: EodCompletedRow[];
  notDone: Array<
    DailyFocusRow & {
      planned: boolean;
      progressUpdates?: Array<{
        id: string;
        text: string;
        createdAt: string;
        authorName: string;
      }>;
      latestProgressUpdate?: {
        id: string;
        text: string;
        createdAt: string;
        authorName: string;
      } | null;
    }
  >;
}

export interface EndOfDaySnapshotMeta {
  id: string;
  reportDate: string;
  timezone: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface EndOfDaySnapshotDetails extends EndOfDaySnapshotMeta {
  snapshot: EndOfDayReport;
}

export const dailyFocusService = {
  async getMeta(): Promise<{ maxRankPerDepartment: number }> {
    const res = await axios.get(`${API_URL}/daily-focus/meta`, getAuthHeaders());
    return res.data;
  },

  async getByDate(date: string): Promise<DailyFocusRow[]> {
    const res = await axios.get(`${API_URL}/daily-focus?date=${encodeURIComponent(date)}`, getAuthHeaders());
    return res.data;
  },

  async save(
    date: string,
    items: Array<{ departmentKey: string; taskId: string; rank: number }>
  ): Promise<DailyFocusRow[]> {
    const res = await axios.put(`${API_URL}/daily-focus`, { date, items }, getAuthHeaders());
    return res.data;
  },

  async getEndOfDay(date: string): Promise<EndOfDayReport> {
    const res = await axios.get(`${API_URL}/reports/end-of-day?date=${encodeURIComponent(date)}`, getAuthHeaders());
    return res.data;
  },

  async saveEndOfDaySnapshot(date: string): Promise<EndOfDaySnapshotMeta> {
    const res = await axios.post(`${API_URL}/reports/end-of-day/archive`, { date }, getAuthHeaders());
    return res.data;
  },

  async listEndOfDaySnapshots(): Promise<EndOfDaySnapshotMeta[]> {
    const res = await axios.get(`${API_URL}/reports/end-of-day/archive`, getAuthHeaders());
    return res.data;
  },

  async getEndOfDaySnapshot(id: string): Promise<EndOfDaySnapshotDetails> {
    const res = await axios.get(`${API_URL}/reports/end-of-day/archive/${id}`, getAuthHeaders());
    return res.data;
  },
};
