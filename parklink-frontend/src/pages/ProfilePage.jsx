import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import SidebarProfil from '../components/profil/SidebarProfil';
import ProfilConducteur from '../components/profil/ProfilConducteur';
import ProfilGestionnaire from '../components/profil/ProfilGestionnaire';
import ProfilGiletJaune from '../components/profil/ProfilGiletJaune';

const ongletParDefaut = {
  conducteur: 'profil',
  gestionnaire: 'parkings',
  gilet_jaune: 'zone',
  autorite: 'dashboard',
  admin: 'utilisateurs',
};

const ProfilePage = () => {
  const { utilisateur } = useAuth();
  const [ongletActif, setOngletActif] = useState(
    ongletParDefaut[utilisateur?.role] || 'profil'
  );
  const [mobileOuvert, setMobileOuvert] = useState(false);

  const renderContenu = () => {
    switch (utilisateur?.role) {
      case 'conducteur':
        return <ProfilConducteur onglet={ongletActif} />;
      case 'gestionnaire':
        return <ProfilGestionnaire onglet={ongletActif} />;
      case 'gilet_jaune':
        return <ProfilGiletJaune onglet={ongletActif} />;
      case 'autorite':
        return (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🏛️</div>
            <div className="font-semibold text-slate-700 text-lg mb-2">Dashboard ville</div>
            <div className="text-slate-500 text-sm">
              Cette interface sera disponible prochainement.<br/>
              Contactez-nous pour un accès anticipé.
            </div>
          </div>
        );
      default:
        return (
          <div className="text-center py-20">
            <div className="text-slate-500">Interface non disponible</div>
          </div>
        );
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50"
      style={{fontFamily:"'DM Sans', sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap');
      `}</style>

      {/* Sidebar */}
      <SidebarProfil
        ongletActif={ongletActif}
        setOngletActif={setOngletActif}
        mobileOuvert={mobileOuvert}
        setMobileOuvert={setMobileOuvert}
      />

      {/* Contenu principal */}
      <main className="flex-1 overflow-y-auto">

        {/* Topbar mobile */}
        <div className="lg:hidden bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <button onClick={() => setMobileOuvert(true)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
            ☰
          </button>
          <span style={{fontFamily:"'DM Serif Display', serif"}} className="text-lg text-slate-900">
            Park<span className="text-sky-500">Link</span>
          </span>
          <div className="w-9"></div>
        </div>

        <div className="p-6 max-w-4xl mx-auto">
          {renderContenu()}
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;