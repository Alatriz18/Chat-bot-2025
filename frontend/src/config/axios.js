// config/axios.js - VERSIÓN DEFINITIVA
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://eipaj4pzfp.us-east-1.awsapprunner.com/api',
  withCredentials: true,
});

// Interceptor para añadir el token JWT del localStorage al header
api.interceptors.request.use((config) => {
  console.group(`📤 ${config.method?.toUpperCase()} ${config.url}`);
  
  // Obtener token del localStorage (de tu SSO)
  const jwtToken = localStorage.getItem('jwt_token');
  
  if (jwtToken) {
    // Enviar token en Authorization header (para SSOAuthentication)
    config.headers['Authorization'] = `Bearer ${jwtToken}`;
    console.log('✅ Token JWT añadido al header');
  } else {
    console.log('⚠️ No hay token JWT en localStorage');
  }
  
  // Añadir CSRF token si existe
  const csrfToken = getCookie('csrftoken');
  if (csrfToken) {
    config.headers['X-CSRFToken'] = csrfToken;
  }
  
  console.log('Headers:', config.headers);
  console.groupEnd();
  
  return config;
}, (error) => {
  console.error('❌ Error en request:', error);
  return Promise.reject(error);
});

// Interceptor de respuesta
api.interceptors.response.use(
  (response) => {
    console.log(`✅ ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`❌ ${error.response?.status || 'NO RESPONSE'} ${error.config?.url}`);
    console.error('Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('🔒 Token inválido o expirado');
      // Redirigir a login
      window.location.href = '/';
    }
    
    if (error.response?.status === 403) {
      console.log('🚫 No tienes permisos (is_staff=False)');
    }
    
    return Promise.reject(error);
  }
);

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

export default api;