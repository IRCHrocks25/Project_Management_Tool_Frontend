import axios from 'axios';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'https://projectmanagementtoolbackend-production.up.railway.app';

let notificationSocket: Socket | null = null;

const getNotificationSocket = (): Socket | null => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  if (notificationSocket?.connected) return notificationSocket;
  notificationSocket = io(`${API_URL}/notifications`, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
  });
  return notificationSocket;
};

export interface Notification {
  id: string;
  type: 'task' | 'task_available' | 'email' | 'project_stage' | 'project_created' | 'task_completed' | 'alert' | 'revision' | 'mention' | 'task_update' | 'TASK_TRANSFER';
  title: string;
  message: string;
  projectId?: string;
  taskId?: string;
  userId?: string; // User ID this notification is for (if backend doesn't filter)
  assignedToId?: string; // For task notifications - the user assigned to the task
  task?: {
    type?: string;
  };
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

  /** Trigger a test notification webhook (sends to n8n with Webhook-Token header). For AI dashboard. */
  async testWebhook(email: string, userName?: string): Promise<{ success: boolean; message?: string }> {
    const response = await axios.post<{ success: boolean; message?: string }>(
      `${API_URL}/notifications/test-webhook`,
      { email: email.trim(), userName: userName?.trim() || undefined },
      { headers: this.getAuthHeaders() },
    );
    return response.data;
  }

  /** Connect to the notifications WebSocket so new notifications arrive in real time (like live chat). */
  connectSocket(): Socket | null {
    return getNotificationSocket();
  }

  /** Subscribe to new notifications. Returns unsubscribe function. */
  onNewNotification(callback: (notification: Notification) => void): () => void {
    const socket = getNotificationSocket();
    if (socket) {
      socket.on('new_notification', callback);
      return () => socket.off('new_notification', callback);
    }
    return () => {};
  }

  /** Subscribe to task:transferred broadcast events. Returns unsubscribe function. */
  onTaskTransferred(callback: (event: {
    taskId: string;
    fromDepartment: string;
    toDepartment: string;
    kind: 'forward' | 'return';
    transferredBy: { id: string; name: string };
    transferredAt: string;
  }) => void): () => void {
    const socket = getNotificationSocket();
    if (socket) {
      socket.on('task:transferred', callback);
      return () => socket.off('task:transferred', callback);
    }
    return () => {};
  }

  disconnectSocket(): void {
    if (notificationSocket) {
      notificationSocket.disconnect();
      notificationSocket = null;
    }
  }
}

export const notificationService = new NotificationService();

