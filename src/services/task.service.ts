import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

export const taskService = {
  async getAll(projectId?: string, assignedToId?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (projectId) params.append('projectId', projectId);
    if (assignedToId) params.append('assignedToId', assignedToId);
    
    const response = await axios.get(`${API_URL}/tasks?${params.toString()}`, getAuthHeaders());
    return response.data;
  },

  async getByProject(projectId: string): Promise<any[]> {
    return this.getAll(projectId);
  },

  async updateStatus(id: string, status: string, isCompleted?: boolean, fileUrl?: string, deliverableType?: string): Promise<any> {
    const response = await axios.patch(
      `${API_URL}/tasks/${id}/status`,
      { status, isCompleted, fileUrl, deliverableType },
      getAuthHeaders()
    );
    return response.data;
  },

  async assign(id: string, assignedToId: string): Promise<any> {
    const response = await axios.patch(
      `${API_URL}/tasks/${id}/assign`,
      { assignedToId },
      getAuthHeaders()
    );
    return response.data;
  },

  async create(createTaskDto: any): Promise<any> {
    const response = await axios.post(
      `${API_URL}/tasks`,
      createTaskDto,
      getAuthHeaders()
    );
    return response.data;
  },

  async submitOnboardingData(id: string, submissionData: string, submissionType: 'url' | 'text'): Promise<any> {
    const response = await axios.patch(
      `${API_URL}/tasks/${id}/submit`,
      { submissionData, submissionType },
      getAuthHeaders()
    );
    return response.data;
  },

  async update(id: string, updateData: { title?: string; description?: string; dueDate?: Date; deliverableId?: string }): Promise<any> {
    const response = await axios.put(
      `${API_URL}/tasks/${id}`,
      updateData,
      getAuthHeaders()
    );
    return response.data;
  },

  async delete(id: string): Promise<any> {
    const response = await axios.delete(
      `${API_URL}/tasks/${id}`,
      getAuthHeaders()
    );
    return response.data;
  },
};

