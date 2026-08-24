import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' }
});

// Ajoute automatiquement le token JWT à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('parklink_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Gère les erreurs 401 globalement
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('parklink_token');
      localStorage.removeItem('parklink_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;