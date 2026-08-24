import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MapPage from './pages/MapPage';
import ProfilePage from './pages/ProfilePage';
import VerificationTicket from './pages/VerificationTicket';

const RouteProtegee = ({ children }) => {
  const { utilisateur, chargement } = useAuth();
  if (chargement) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-sky-600 text-lg font-medium">Chargement...</div>
    </div>
  );
  return utilisateur ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/carte" element={<MapPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/register/conducteur" element={<RegisterPage role="conducteur" />} />
          <Route path="/register/gestionnaire" element={<RegisterPage role="gestionnaire" />} />
          <Route path="/register/gilet-jaune" element={<RegisterPage role="gilet_jaune" />} />
          <Route path="/profil" element={
            <RouteProtegee><ProfilePage /></RouteProtegee>
          } />
          <Route path="/verifier/:reservationId" element={<VerificationTicket />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;