// src/config/axios.js (crear este archivo)
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
});

// ✅ INTERCEPTOR PARA AGREGAR TOKEN A TODAS LAS PETICIONES
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ INTERCEPTOR PARA MANEJAR ERRORES DE AUTENTICACIÓN
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      localStorage.removeItem('jwt_token');
      window.location.href = 'https://tu-app-login.aws.com';
    }
    return Promise.reject(error);
  }
);

export default api;