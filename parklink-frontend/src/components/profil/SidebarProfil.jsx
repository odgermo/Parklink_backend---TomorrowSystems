import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const menuParRole = {
  conducteur: [
    { id: 'profil', icon: '👤', label: 'Mon profil' },
    { id: 'reservations', icon: '📋', label: 'Mes réservations' },
    { id: 'vehicules', icon: '🚗', label: 'Mes véhicules' },
    { id: 'notifications', icon: '🔔', label: 'Notifications' },
    { id: 'assistance', icon: '❓', label: 'Assistance' },
  ],
  gestionnaire: [
    { id: 'parkings', icon: '🏢', label: 'Mes parkings' },
    { id: 'reservations', icon: '📅', label: 'Réservations reçues' },
    { id: 'statistiques', icon: '📊', label: 'Statistiques', bientot: true },
    { id: 'profil', icon: '👤', label: 'Mon profil' },
    { id: 'notifications', icon: '🔔', label: 'Notifications' },
    { id: 'assistance', icon: '❓', label: 'Assistance' },
  ],
  gilet_jaune: [
    { id: 'zone', icon: '🗺️', label: 'Ma zone' },
    { id: 'reservations', icon: '📅', label: 'Réservations reçues' },
    { id: 'statistiques', icon: '📊', label: 'Statistiques', bientot: true },
    { id: 'profil', icon: '👤', label: 'Mon profil' },
    { id: 'notifications', icon: '🔔', label: 'Notifications' },
    { id: 'assistance', icon: '❓', label: 'Assistance' },
  ],
  autorite: [
    { id: 'dashboard', icon: '📊', label: 'Dashboard ville', bientot: true },
    { id: 'carte', icon: '🗺️', label: 'Carte de chaleur', bientot: true },
    { id: 'rapports', icon: '📈', label: 'Rapports', bientot: true },
    { id: 'profil', icon: '👤', label: 'Mon profil' },
  ],
  admin: [
    { id: 'utilisateurs', icon: '👥', label: 'Utilisateurs' },
    { id: 'parkings', icon: '🏢', label: 'Validation parkings' },
    { id: 'profil', icon: '👤', label: 'Mon profil' },
  ],
};

const roleLabel = {
  conducteur: { label: 'Conducteur', icon: '🚗', bg: 'bg-sky-100', text: 'text-sky-700' },
  gestionnaire: { label: 'Gestionnaire', icon: '🏢', bg: 'bg-blue-100', text: 'text-blue-700' },
  gilet_jaune: { label: 'Gilet jaune', icon: '🦺', bg: 'bg-amber-100', text: 'text-amber-700' },
  autorite: { label: 'Autorité ville', icon: '🏛️', bg: 'bg-indigo-100', text: 'text-indigo-700' },
  admin: { label: 'Administrateur', icon: '⚙️', bg: 'bg-slate-100', text: 'text-slate-700' },
};

const SidebarProfil = ({ ongletActif, setOngletActif, mobileOuvert, setMobileOuvert }) => {
  const { utilisateur, deconnexion } = useAuth();
  const navigate = useNavigate();

  const menu = menuParRole[utilisateur?.role] || menuParRole.conducteur;
  const config = roleLabel[utilisateur?.role] || roleLabel.conducteur;

  const handleDeconnexion = () => {
    deconnexion();
    navigate('/');
  };

  return (
    <>
      {/* Overlay mobile */}
      {mobileOuvert && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setMobileOuvert(false)}/>
      )}

      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-40 lg:z-auto
        w-72 bg-white border-r border-slate-100 flex flex-col
        transform transition-transform duration-300
        ${mobileOuvert ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header sidebar */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-4 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white"/>
              </svg>
            </div>
            <span style={{fontFamily:"'DM Serif Display', serif"}} className="text-lg text-slate-900">
              Park<span className="text-sky-500">Link</span>
            </span>
          </div>

          {/* Info utilisateur */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-sky-400 to-sky-600 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {utilisateur?.prenom?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 text-sm truncate">
                {utilisateur?.prenom} {utilisateur?.nom}
              </div>
              <div className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-0.5 ${config.bg} ${config.text}`}>
                <span>{config.icon}</span>
                <span>{config.label}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-3 overflow-y-auto">
          <div className="space-y-1">
            {menu.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (!item.bientot) {
                    setOngletActif(item.id);
                    setMobileOuvert(false);
                  }
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  item.bientot
                    ? 'text-slate-400 cursor-not-allowed'
                    : ongletActif === item.id
                    ? 'bg-sky-50 text-sky-600 border border-sky-100'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}>
                <span className="text-base">{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.bientot && (
                  <span className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">
                    bientôt
                  </span>
                )}
                {ongletActif === item.id && !item.bientot && (
                  <div className="w-1.5 h-1.5 bg-sky-500 rounded-full"></div>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Déconnexion */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={handleDeconnexion}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
            <span>🚪</span>
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default SidebarProfil;