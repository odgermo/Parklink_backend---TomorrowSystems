import api from './api';

const authService = {
  inscription: async (donnees) => {
    const response = await api.post('/auth/register', donnees);
    return response.data;
  },

  connexion: async (email, mot_de_passe) => {
    const response = await api.post('/auth/login', { email, mot_de_passe });
    return response.data;
  },

  moi: async () => {
    const response = await api.get('/auth/moi');
    return response.data;
  }
};

export default authService;