import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://projectmanagementtoolbackend-production.up.railway.app';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

export const ticketService = {
  async create(data: { title: string; description?: string; type: 'bug' | 'improvement' }): Promise<any> {
    const response = await axios.post(
      `${API_URL}/tickets`,
      data,
      getAuthHeaders()
    );
    return response.data;
  },

  async getAll(): Promise<any[]> {
    const response = await axios.get(`${API_URL}/tickets`, getAuthHeaders());
    return response.data;
  },

  async getOne(id: string): Promise<any> {
    const response = await axios.get(`${API_URL}/tickets/${id}`, getAuthHeaders());
    return response.data;
  },

  async updateStatus(id: string, status: string): Promise<any> {
    const response = await axios.patch(
      `${API_URL}/tickets/${id}/status`,
      { status },
      getAuthHeaders()
    );
    return response.data;
  },
};
