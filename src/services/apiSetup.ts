/**
 * Global API setup: intercept 401 responses and log user out.
 * When session expires, user sees "logged in" but API calls fail silently.
 * This redirects to login and shows a session-expired message.
 */
import axios from 'axios';
import { authService } from './auth.service';
import { isClientPortalPath } from './clientPortal.service';

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    // Don't intercept 401 on auth endpoints (login returns 401 for bad credentials)
    const isAuthEndpoint = url.includes('/auth/login');
    // A client's wrong code or expired session must not log out a team member on this browser or show the team login.
    if (status === 401 && !isAuthEndpoint && !isClientPortalPath()) {
      authService.logout();
      window.location.href = '/login?session=expired';
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);
