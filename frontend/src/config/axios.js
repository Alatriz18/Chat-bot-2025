// config/axios.js - VERSIÓN LIMPIA PARA COOKIES
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://eipaj4pzfp.us-east-1.awsapprunner.com/api',
  // ESTO ES LO ÚNICO IMPORTANTE:
  // Le dice al navegador: "Envía la cookie chatbot-auth automáticamente"
  withCredentials: true, 
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor SOLO para CSRF (Seguridad de Django), NO para JWT
api.interceptors.request.use((config) => {
  const getCookie = (name) => {
    if (!document.cookie) return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  };

  const csrfToken = getCookie('csrftoken');
  if (csrfToken) {
    config.headers['X-CSRFToken'] = csrfToken;
  }
  
  return config;
}, (error) => Promise.reject(error));

// Interceptor de respuesta para detectar 401/403
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('🔒 Sesión expirada o inválida');
      // Opcional: Redirigir si no estamos ya en el home
      if (window.location.pathname !== '/') {
         // window.location.href = '/'; 
      }
    }
    return Promise.reject(error);
  }
);

export default api;