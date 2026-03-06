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

export const deliverableService = {
  async create(projectId: string, type: string, customType?: string): Promise<any> {
    const response = await axios.post(
      `${API_URL}/deliverables`,
      { projectId, type, customType },
      getAuthHeaders()
    );
    return response.data;
  },

  async getAll(projectId?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (projectId) params.append('projectId', projectId);
    
    const response = await axios.get(`${API_URL}/deliverables?${params.toString()}`, getAuthHeaders());
    return response.data;
  },

  async getOne(id: string): Promise<any> {
    const response = await axios.get(`${API_URL}/deliverables/${id}`, getAuthHeaders());
    return response.data;
  },

  async updateStatus(id: string, status: string, notes?: string, fileUrl?: string): Promise<any> {
    const url = `${API_URL}/deliverables/${id}/status`;
    console.log('Updating deliverable status:', { id, status, notes, fileUrl, url });
    try {
      const response = await axios.patch(
        url,
        { status, notes, fileUrl },
        getAuthHeaders()
      );
      console.log('Deliverable status updated successfully:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error updating deliverable status:', error);
      console.error('Request URL was:', url);
      console.error('Full URL:', error?.config?.url || url);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        console.error('Response headers:', error.response.headers);
      }
      throw error;
    }
  },

  async getHistory(id: string, fileUrl?: string): Promise<any[]> {
    const params = fileUrl ? `?fileUrl=${encodeURIComponent(fileUrl)}` : '';
    const response = await axios.get(`${API_URL}/deliverables/${id}/history${params}`, getAuthHeaders());
    return response.data;
  },

  async getTeamMembers(deliverableId: string): Promise<any[]> {
    const response = await axios.get(`${API_URL}/deliverables/${deliverableId}/team-members`, getAuthHeaders());
    return response.data;
  },

  async addTeamMember(deliverableId: string, userId: string): Promise<any> {
    const response = await axios.post(`${API_URL}/deliverables/${deliverableId}/team-members`, { userId }, getAuthHeaders());
    return response.data;
  },

  async removeTeamMember(deliverableId: string, userId: string): Promise<void> {
    await axios.delete(`${API_URL}/deliverables/${deliverableId}/team-members/${userId}`, getAuthHeaders());
  },

  async update(id: string, data: { customType?: string }): Promise<any> {
    const response = await axios.patch(
      `${API_URL}/deliverables/${id}`,
      data,
      getAuthHeaders()
    );
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await axios.delete(`${API_URL}/deliverables/${id}`, getAuthHeaders());
  },
};

