import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [utilisateur, setUtilisateur] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('parklink_token');
    const user = localStorage.getItem('parklink_user');
    if (token && user) {
      setUtilisateur(JSON.parse(user));
    }
    setChargement(false);
  }, []);

  const connexion = (token, user) => {
    localStorage.setItem('parklink_token', token);
    localStorage.setItem('parklink_user', JSON.stringify(user));
    setUtilisateur(user);
  };

  const deconnexion = () => {
    localStorage.removeItem('parklink_token');
    localStorage.removeItem('parklink_user');
    setUtilisateur(null);
  };

  return (
    <AuthContext.Provider value={{ utilisateur, connexion, deconnexion, chargement }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);