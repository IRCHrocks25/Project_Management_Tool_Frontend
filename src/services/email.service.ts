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

export const emailService = {
  async send(data: { subject: string; body: string; recipientEmail: string; projectId: string }): Promise<any> {
    const response = await axios.post(`${API_URL}/emails`, data, getAuthHeaders());
    return response.data;
  },

  async getByProject(projectId: string): Promise<any[]> {
    const response = await axios.get(`${API_URL}/emails/project/${projectId}`, getAuthHeaders());
    return response.data;
  },
};

