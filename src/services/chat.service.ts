import axios from 'axios';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'https://projectmanagementtoolbackend-production.up.railway.app';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

export interface ChatRoom {
  id: string;
  type: string;
  name: string;
  otherUser: { id: string; name: string; email: string; role: string } | null;
  otherUserLastReadAt?: string | null;
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    senderName?: string;
    createdAt: string;
  } | null;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName?: string;
  content: string;
  createdAt: string;
}

let socketInstance: Socket | null = null;

const getSocket = (): Socket | null => {
  const token = localStorage.getItem('token');
  if (!token) return null;

  if (socketInstance?.connected) {
    return socketInstance;
  }

  socketInstance = io(`${API_URL}/chat`, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  return socketInstance;
};

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};

export const chatService = {
  async getRooms(): Promise<ChatRoom[]> {
    const response = await axios.get(`${API_URL}/chat/rooms`, getAuthHeaders());
    return response.data;
  },

  async getUnreadCount(): Promise<number> {
    const response = await axios.get(`${API_URL}/chat/unread-count`, getAuthHeaders());
    return response.data?.count ?? 0;
  },

  async getOrCreateRoom(otherUserId: string): Promise<ChatRoom> {
    const response = await axios.post(
      `${API_URL}/chat/rooms`,
      { otherUserId },
      getAuthHeaders()
    );
    return response.data;
  },

  async getMessages(
    roomId: string,
    limit = 50,
    before?: string
  ): Promise<{ messages: ChatMessage[]; otherUserLastReadAt: string | null }> {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    if (before) params.append('before', before);
    const response = await axios.get(
      `${API_URL}/chat/rooms/${roomId}/messages?${params}`,
      getAuthHeaders()
    );
    return response.data;
  },

  async markRoomAsRead(roomId: string): Promise<{ lastReadAt: string }> {
    const response = await axios.patch(
      `${API_URL}/chat/rooms/${roomId}/read`,
      {},
      getAuthHeaders()
    );
    return response.data;
  },

  connectSocket(): Socket | null {
    return getSocket();
  },

  joinRoom(roomId: string) {
    const socket = getSocket();
    if (socket) {
      socket.emit('join_room', roomId);
    }
  },

  leaveRoom(roomId: string) {
    const socket = getSocket();
    if (socket) {
      socket.emit('leave_room', roomId);
    }
  },

  markRoomRead(roomId: string) {
    const socket = getSocket();
    if (socket) {
      socket.emit('mark_room_read', roomId);
    }
  },

  sendMessage(roomId: string, content: string) {
    const socket = getSocket();
    if (socket) {
      socket.emit('send_message', { roomId, content });
    }
  },

  onNewMessage(callback: (message: ChatMessage) => void) {
    const socket = getSocket();
    if (socket) {
      socket.on('new_message', callback);
      return () => socket.off('new_message', callback);
    }
    return () => {};
  },

  onRoomRead(callback: (data: { roomId: string; userId: string; lastReadAt: string }) => void) {
    const socket = getSocket();
    if (socket) {
      socket.on('room_read', callback);
      return () => socket.off('room_read', callback);
    }
    return () => {};
  },

  onConnect(callback: () => void) {
    const socket = getSocket();
    if (socket) {
      socket.on('connect', callback);
      return () => socket.off('connect', callback);
    }
    return () => {};
  },

  onDisconnect(callback: () => void) {
    const socket = getSocket();
    if (socket) {
      socket.on('disconnect', callback);
      return () => socket.off('disconnect', callback);
    }
    return () => {};
  },
};
