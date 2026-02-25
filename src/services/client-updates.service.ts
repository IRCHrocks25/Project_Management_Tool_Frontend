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

// Public axios instance for endpoints that don't require authentication
const publicAxios = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface FormBlock {
  id: string;
  type: 'paragraph' | 'heading' | 'image' | 'text_with_image' | 'layout';
  content?: string;
  imageUrl?: string;
  imageAlt?: string;
  text?: string;
  bold?: boolean;
  layout?: {
    columns: number;
    blocks: FormBlock[];
  };
}

export interface ClientUpdate {
  id: string;
  projectId: string;
  pmId: string;
  pm?: { name: string };
  emailSentAt: string;
  status: 'draft' | 'published' | 'responded';
  notes?: string;
  links?: string[];
  forms?: ClientUpdateForm[];
  createdAt: string;
  updatedAt: string;
}

export interface ClientUpdateForm {
  id: string;
  updateId: string;
  publicToken: string;
  isPublished: boolean;
  blocks: FormBlock[];
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionResponse {
  blockId: string;
  type: string;
  text?: string;
  imageUrls?: string[];
}

export interface FormSubmission {
  id: string;
  formId: string;
  responses: SubmissionResponse[];
  clientName?: string;
  clientEmail?: string;
  submittedAt: string;
}

export interface ClientUpdateComment {
  id: string;
  updateId: string;
  userId: string;
  user?: { name: string; role?: string };
  text: string;
  mentionedUserIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export const clientUpdatesService = {
  async create(projectId: string, notes?: string, links?: string[]): Promise<ClientUpdate> {
    // Build payload - only include fields that are provided
    const payload: any = { projectId };
    if (notes) {
      payload.notes = notes;
    }
    if (links && links.length > 0) {
      payload.links = links;
    }
    
    const response = await axios.post(
      `${API_URL}/client-updates`,
      payload,
      getAuthHeaders()
    );
    return response.data;
  },

  async getAllByProject(projectId: string): Promise<ClientUpdate[]> {
    const response = await axios.get(
      `${API_URL}/client-updates/project/${projectId}`,
      getAuthHeaders()
    );
    return response.data;
  },

  async getOne(id: string): Promise<ClientUpdate> {
    const response = await axios.get(
      `${API_URL}/client-updates/${id}`,
      getAuthHeaders()
    );
    return response.data;
  },

  async createForm(updateId: string, blocks: FormBlock[]): Promise<ClientUpdateForm> {
    const response = await axios.post(
      `${API_URL}/client-updates/forms`,
      { updateId, blocks },
      getAuthHeaders()
    );
    return response.data;
  },

  async updateForm(formId: string, blocks: FormBlock[]): Promise<ClientUpdateForm> {
    const response = await axios.post(
      `${API_URL}/client-updates/forms/${formId}`,
      { blocks },
      getAuthHeaders()
    );
    return response.data;
  },

  async publishForm(formId: string): Promise<ClientUpdateForm> {
    const response = await axios.post(
      `${API_URL}/client-updates/forms/${formId}/publish`,
      {},
      getAuthHeaders()
    );
    return response.data;
  },

  async getFormByToken(publicToken: string): Promise<ClientUpdateForm & { update?: { project?: { clientName: string } } }> {
    const response = await publicAxios.get(
      `/client-updates/forms/token/${publicToken}`
    );
    return response.data;
  },

  async submitForm(formId: string, responses: SubmissionResponse[], clientName?: string, clientEmail?: string): Promise<FormSubmission> {
    const response = await publicAxios.post(
      `/client-updates/forms/submit`,
      { formId, responses, clientName, clientEmail }
    );
    return response.data;
  },

  async getFormSubmissions(formId: string): Promise<FormSubmission[]> {
    const response = await axios.get(
      `${API_URL}/client-updates/forms/${formId}/submissions`,
      getAuthHeaders()
    );
    return response.data;
  },

  async uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    const response = await axios.post(
      `${API_URL}/client-updates/upload-image`,
      formData,
      {
        ...getAuthHeaders(),
        headers: {
          ...getAuthHeaders().headers,
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.url;
  },

  async uploadImagePublic(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    const response = await publicAxios.post(
      `/client-updates/upload-image-public`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.url;
  },

  async createComment(updateId: string, text: string, mentionedUserIds?: string[]): Promise<ClientUpdateComment> {
    const response = await axios.post(
      `${API_URL}/client-updates/${updateId}/comments`,
      { text, mentionedUserIds },
      getAuthHeaders()
    );
    return response.data;
  },

  async getComments(updateId: string): Promise<ClientUpdateComment[]> {
    const response = await axios.get(
      `${API_URL}/client-updates/${updateId}/comments`,
      getAuthHeaders()
    );
    return response.data;
  },
};

