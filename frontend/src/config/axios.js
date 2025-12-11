import axios from 'axios';

// 1. Configuración Base
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  withCredentials: true, // <---  Permite que viajen las Cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// 2. Función para obtener el CSRF Token (Django lo exige en POST/PUT/DELETE)
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// 3. Interceptor de Solicitud (Request)
// Ya no en localStorage. Buscamos el CSRF Token para inyectarlo.
api.interceptors.request.use((config) => {
  const csrfToken = getCookie('csrftoken'); 
  if (csrfToken) {
    config.headers['X-CSRFToken'] = csrfToken; // Header estándar de Django
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// 4. Interceptor de Respuesta (Response)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Si el error es 401 (No autorizado)
    if (error.response && error.response.status === 401) {
      console.log("Sesión expirada o no válida");
      // Opcional: Redirigir al login si no estás ya ahí
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
         window.location.href = '/'; 
      }
    }
    return Promise.reject(error);
  }
);

export default api;