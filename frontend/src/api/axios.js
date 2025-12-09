import axios from 'axios';

// Si estás en local, usa localhost:8000. Si no, usa la variable de entorno (para cuando subas a AWS)
const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export const api = axios.create({
    baseURL: BASE_URL,
    withCredentials: true, // Esto permite el manejo de cookies/tokens si fuera necesario
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor para agregar el token JWT automáticamente si existe
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});