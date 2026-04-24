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

export interface MonthlyReminder {
  id: string;
  projectId: string | null;
  clientName: string;
  reminderDay: number;
  note: string;
  reminderLink?: string | null;
  currentMonthKey?: string | null; // YYYY-MM
  currentMonthStatus?: 'pending' | 'done' | 'no';
  nextMonthStatus?: 'pending' | 'done' | 'no' | null;
  createdAt: string;
  updatedAt: string;
}

type UpsertMonthlyReminderPayload = {
  projectId?: string | null;
  clientName?: string;
  reminderDay: number;
  note: string;
  reminderLink?: string | null;
  currentMonthKey?: string | null;
  currentMonthStatus?: 'pending' | 'done' | 'no';
  nextMonthStatus?: 'pending' | 'done' | 'no' | null;
};

export const monthlyRemindersService = {
  async getAll(): Promise<MonthlyReminder[]> {
    const res = await axios.get(`${API_URL}/monthly-reminders`, getAuthHeaders());
    return res.data;
  },

  async getByProject(projectId: string): Promise<MonthlyReminder[]> {
    const res = await axios.get(`${API_URL}/monthly-reminders/project/${projectId}`, getAuthHeaders());
    return res.data;
  },

  async create(payload: UpsertMonthlyReminderPayload): Promise<MonthlyReminder> {
    const res = await axios.post(`${API_URL}/monthly-reminders`, payload, getAuthHeaders());
    return res.data;
  },

  async update(id: string, payload: Partial<UpsertMonthlyReminderPayload>): Promise<MonthlyReminder> {
    const res = await axios.patch(`${API_URL}/monthly-reminders/${id}`, payload, getAuthHeaders());
    return res.data;
  },

  async remove(id: string): Promise<void> {
    await axios.delete(`${API_URL}/monthly-reminders/${id}`, getAuthHeaders());
  },
};

