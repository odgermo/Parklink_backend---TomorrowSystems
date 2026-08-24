import api from './api';

const parkingsService = {
  // Récupère les parkings actifs (avec filtre géo optionnel)
  lister: async (lat, lng, rayon = 10) => {
    const params = lat && lng ? { lat, lng, rayon } : {};
    const response = await api.get('/parkings', { params });
    return response.data;
  },

  // Détail d'un parking
  detail: async (id) => {
    const response = await api.get(`/parkings/${id}`);
    return response.data;
  }
};

export default parkingsService;