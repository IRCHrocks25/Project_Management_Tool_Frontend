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

export const projectService = {
  async getAll(includeArchived: boolean = false): Promise<any[]> {
    const url = includeArchived 
      ? `${API_URL}/projects?includeArchived=true`
      : `${API_URL}/projects`;
    const response = await axios.get(url, getAuthHeaders());
    return response.data;
  },

  async getAllArchived(): Promise<any[]> {
    const response = await axios.get(`${API_URL}/projects?includeArchived=true`, getAuthHeaders());
    return response.data.filter((p: any) => p.isArchived);
  },

  async getOne(id: string): Promise<any> {
    try {
      const response = await axios.get(`${API_URL}/projects/${id}`, getAuthHeaders());
      return response.data;
    } catch (error: any) {
      console.error(`[ProjectService] Error fetching project ${id}:`, error);
      if (error.response) {
        // Server responded with error status
        throw new Error(error.response.data?.message || `Failed to load project: ${error.response.status}`);
      } else if (error.request) {
        // Request was made but no response received
        throw new Error('No response from server. Is the backend running?');
      } else {
        // Something else happened
        throw new Error(error.message || 'Failed to load project');
      }
    }
  },

  async create(data: any): Promise<any> {
    const response = await axios.post(`${API_URL}/projects`, data, getAuthHeaders());
    return response.data;
  },

  async updateStage(id: string, stage: string): Promise<any> {
    const response = await axios.patch(`${API_URL}/projects/${id}/stage`, { stage }, getAuthHeaders());
    return response.data;
  },

  async close(id: string): Promise<any> {
    const response = await axios.patch(`${API_URL}/projects/${id}/close`, {}, getAuthHeaders());
    return response.data;
  },

  async archive(id: string): Promise<any> {
    const response = await axios.patch(`${API_URL}/projects/${id}/archive`, {}, getAuthHeaders());
    return response.data;
  },

  async complete(id: string): Promise<any> {
    const response = await axios.patch(`${API_URL}/projects/${id}/complete`, {}, getAuthHeaders());
    return response.data;
  },

  async getCompleted(): Promise<any[]> {
    const response = await axios.get(`${API_URL}/projects/completed`, getAuthHeaders());
    return response.data;
  },

  async getStats(): Promise<any> {
    const response = await axios.get(`${API_URL}/projects/stats`, getAuthHeaders());
    return response.data;
  },

  async generateOnboardingTasks(id: string): Promise<any> {
    const response = await axios.post(`${API_URL}/projects/${id}/generate-onboarding-tasks`, {}, getAuthHeaders());
    return response.data;
  },

  async getTeamMembers(projectId: string): Promise<any[]> {
    const response = await axios.get(`${API_URL}/projects/${projectId}/team-members`, getAuthHeaders());
    return response.data;
  },

  async addTeamMember(projectId: string, userId: string): Promise<any> {
    const response = await axios.post(`${API_URL}/projects/${projectId}/team-members`, { userId }, getAuthHeaders());
    return response.data;
  },

  async removeTeamMember(projectId: string, userId: string): Promise<void> {
    await axios.delete(`${API_URL}/projects/${projectId}/team-members/${userId}`, getAuthHeaders());
  },

  async getActivity(projectId: string): Promise<any[]> {
    const response = await axios.get(`${API_URL}/projects/${projectId}/activity`, getAuthHeaders());
    return response.data;
  },

  async update(id: string, data: { clientName?: string; clientType?: string; secondaryClientTypes?: string[] }): Promise<any> {
    const response = await axios.patch(`${API_URL}/projects/${id}`, data, getAuthHeaders());
    return response.data;
  },
};

