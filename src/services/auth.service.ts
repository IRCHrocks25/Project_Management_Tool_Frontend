import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://projectmanagementtoolbackend-production.up.railway.app';

// Create a clean axios instance for auth requests (no Authorization header)
const authAxios = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface SignupData {
  name: string;
  email: string;
  password: string;
  role: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
    updatedAt: string;
  };
  token: string;
}

export const authService = {
  async signup(data: SignupData): Promise<AuthResponse> {
    // Clear any existing tokens before signup to avoid 431 errors
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    try {
      // Use clean axios instance without any Authorization headers
      const response = await authAxios.post('/auth/signup', data);
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error: any) {
      // If 431 error, clear localStorage completely and retry
      if (error.response?.status === 431) {
        localStorage.clear();
        const retryResponse = await authAxios.post('/auth/signup', data);
        if (retryResponse.data.token) {
          localStorage.setItem('token', retryResponse.data.token);
          localStorage.setItem('user', JSON.stringify(retryResponse.data.user));
        }
        return retryResponse.data;
      }
      throw error;
    }
  },

  async login(data: LoginData): Promise<AuthResponse> {
    // Clear any existing tokens before login to avoid 431 errors
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    try {
      // Use clean axios instance without any Authorization headers
      const response = await authAxios.post('/auth/login', data);
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error: any) {
      // If 431 error, clear localStorage completely and retry
      if (error.response?.status === 431) {
        localStorage.clear();
        const retryResponse = await authAxios.post('/auth/login', data);
        if (retryResponse.data.token) {
          localStorage.setItem('token', retryResponse.data.token);
          localStorage.setItem('user', JSON.stringify(retryResponse.data.user));
        }
        return retryResponse.data;
      }
      throw error;
    }
  },

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Clear any other auth-related data
    localStorage.clear();
  },

  getToken(): string | null {
    return localStorage.getItem('token');
  },

  getUser(): any | null {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },

  async getAllUsers(): Promise<any[]> {
    const response = await axios.get(`${API_URL}/auth/users`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    return response.data;
  },

  async forgotPassword(email: string): Promise<{ message: string; resetLink?: string }> {
    const response = await authAxios.post('/auth/forgot-password', { email });
    return response.data;
  },

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const response = await authAxios.post('/auth/reset-password', { token, password });
    return response.data;
  },
};

