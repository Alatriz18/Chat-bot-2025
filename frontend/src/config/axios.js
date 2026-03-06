// config/axios.js
import axios from 'axios';

const HUB_LOGIN_URL = 'https://main.d2n6dprtfytcex.amplifyapp.com/login';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://eipaj4pzfp.us-east-1.awsapprunner.com/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de REQUEST: CSRF para Django
api.interceptors.request.use((config) => {
  const getCookie = (name) => {
    if (!document.cookie) return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  };
  const csrfToken = getCookie('csrftoken');
  if (csrfToken) config.headers['X-CSRFToken'] = csrfToken;
  return config;
}, (error) => Promise.reject(error));

// Interceptor de RESPONSE: redirigir al hub si el token expiró
let redirecting = false; // evitar múltiples redirects simultáneos

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !redirecting) {
      redirecting = true;
      console.warn('🔒 Sesión expirada. Redirigiendo al hub de login...');
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('notificationsLastCheck');
      window.location.href = HUB_LOGIN_URL;
    }
    return Promise.reject(error);
  }
);

export default api;