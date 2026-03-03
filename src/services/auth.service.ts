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
    isTeamLead?: boolean;
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

  async setTeamLead(userId: string, isTeamLead: boolean): Promise<any> {
    const response = await axios.post(
      `${API_URL}/auth/users/${userId}/team-lead`,
      { isTeamLead },
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );
    // If current user was updated, refresh localStorage copy
    const currentUser = this.getUser();
    if (currentUser && currentUser.id === userId) {
      localStorage.setItem('user', JSON.stringify(response.data));
    }
    return response.data;
  },

  async forgotPassword(email: string): Promise<{ 
    message: string; 
    resetLink?: string;
    webhookStatus?: {
      success: boolean;
      status?: number;
      message?: string;
      error?: string;
      emailSent?: boolean;
    };
  }> {
    console.log('[FRONTEND] Calling forgotPassword with email:', email);
    console.log('[FRONTEND] API URL:', API_URL);
    console.log('[FRONTEND] Full endpoint:', `${API_URL}/auth/forgot-password`);
    console.log('[FRONTEND] Request payload:', { email });
    
    try {
      const response = await authAxios.post('/auth/forgot-password', { email });
      console.log('[FRONTEND] Response received:', response.data);
      
      // Log webhook status if available
      if (response.data.webhookStatus) {
        console.log('[FRONTEND] 📤 WEBHOOK STATUS:', response.data.webhookStatus);
        if (response.data.webhookStatus.success) {
          console.log('[FRONTEND] ✅ Webhook triggered successfully!');
          console.log('[FRONTEND] ✅ Webhook response status:', response.data.webhookStatus.status);
          console.log('[FRONTEND] ✅ Webhook message:', response.data.webhookStatus.message);
        } else {
          console.error('[FRONTEND] ❌ Webhook failed!');
          console.error('[FRONTEND] ❌ Webhook error:', response.data.webhookStatus.error);
          console.error('[FRONTEND] ❌ Webhook status code:', response.data.webhookStatus.status);
          console.error('[FRONTEND] ❌ Webhook message:', response.data.webhookStatus.message);
        }
      } else {
        console.log('[FRONTEND] ⚠️ Webhook status not included in response (production mode)');
        console.log('[FRONTEND] 💡 Check backend logs (Railway) to see webhook details');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('[FRONTEND] Error in forgotPassword:', error);
      console.error('[FRONTEND] Error response:', error.response?.data);
      console.error('[FRONTEND] Error status:', error.response?.status);
      throw error;
    }
  },

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const response = await authAxios.post('/auth/reset-password', { token, password });
    return response.data;
  },

  async verifyOtp(email: string, otp: string): Promise<{ message: string; verified: boolean }> {
    console.log('[FRONTEND] Calling verifyOtp with email:', email, 'OTP:', otp);
    console.log('[FRONTEND] Full endpoint:', `${API_URL}/auth/verify-otp`);
    console.log('[FRONTEND] Request payload:', { email, otp });
    
    try {
      const response = await authAxios.post('/auth/verify-otp', { email, otp });
      console.log('[FRONTEND] OTP verification response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[FRONTEND] Error in verifyOtp:', error);
      console.error('[FRONTEND] Error response:', error.response?.data);
      console.error('[FRONTEND] Error status:', error.response?.status);
      throw error;
    }
  },

  async resetPasswordWithOtp(email: string, password: string): Promise<{ message: string }> {
    console.log('[FRONTEND] Calling resetPasswordWithOtp with email:', email);
    console.log('[FRONTEND] Full endpoint:', `${API_URL}/auth/reset-password-otp`);
    console.log('[FRONTEND] Request payload:', { email, password: '***' });
    
    try {
      const response = await authAxios.post('/auth/reset-password-otp', { email, password });
      console.log('[FRONTEND] Password reset response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[FRONTEND] Error in resetPasswordWithOtp:', error);
      console.error('[FRONTEND] Error response:', error.response?.data);
      console.error('[FRONTEND] Error status:', error.response?.status);
      throw error;
    }
  },
};

