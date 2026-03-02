import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://projectmanagementtoolbackend-production.up.railway.app';

export interface Notification {
  id: string;
  type: 'task' | 'task_available' | 'email' | 'project_stage' | 'project_created' | 'task_completed' | 'alert' | 'revision';
  title: string;
  message: string;
  projectId?: string;
  taskId?: string;
  userId?: string; // User ID this notification is for (if backend doesn't filter)
  assignedToId?: string; // For task notifications - the user assigned to the task
  isRead: boolean;
  createdAt: string;
}

class NotificationService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  async getAll(): Promise<Notification[]> {
    const response = await axios.get(`${API_URL}/notifications`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getUnreadCount(): Promise<number> {
    const response = await axios.get(`${API_URL}/notifications/unread-count`, {
      headers: this.getAuthHeaders(),
    });
    return response.data.count || 0;
  }

  async markAsRead(id: string): Promise<void> {
    await axios.patch(`${API_URL}/notifications/${id}/read`, {}, {
      headers: this.getAuthHeaders(),
    });
  }

  async markAllAsRead(): Promise<void> {
    await axios.patch(`${API_URL}/notifications/read-all`, {}, {
      headers: this.getAuthHeaders(),
    });
  }
}

export const notificationService = new NotificationService();

