import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';

const RegisterPage = ({ role: roleProp }) => {
  const navigate = useNavigate();
  const { connexion } = useAuth();

  const roleEffectif = roleProp || 'conducteur';

  const roleConfig = {
    conducteur: {
      titre: 'Créer un compte conducteur',
      sousTitre: 'Recherchez et réservez des places de parking à Casablanca.',
      icon: '🚗',
      couleur: 'sky',
      panneau: {
        titre: 'Stationnez en toute sérénité',
        points: [
          { icon:'🔍', text:'Recherchez parmi 200+ parkings' },
          { icon:'📅', text:'Réservez à l\'avance ou en arrivant' },
          { icon:'🛡️', text:'Votre place est garantie' },
          { icon:'💳', text:'Payez en espèces ou par carte' },
        ]
      }
    },
    gestionnaire: {
      titre: 'Inscrire mon parking',
      sousTitre: 'Rejoignez ParkLink et atteignez de nouveaux clients chaque jour.',
      icon: '🏢',
      couleur: 'sky',
      panneau: {
        titre: 'Développez votre activité',
        points: [
          { icon:'📊', text:'Dashboard de gestion complet' },
          { icon:'🔔', text:'Notifications de réservations' },
          { icon:'📈', text:'Statistiques d\'occupation' },
          { icon:'🗺️', text:'Visibilité sur la carte ParkLink' },
        ]
      }
    },
    gilet_jaune: {
      titre: 'Rejoindre ParkLink',
      sousTitre: 'Référencez votre zone et soyez visible par des milliers de conducteurs.',
      icon: '🦺',
      couleur: 'amber',
      panneau: {
        titre: 'Augmentez votre visibilité',
        points: [
          { icon:'🗺️', text:'Référencement sur la carte interactive' },
          { icon:'📱', text:'Interface mobile simple et rapide' },
          { icon:'🔄', text:'Mise à jour des disponibilités en direct' },
          { icon:'👥', text:'Accès à des milliers de conducteurs' },
        ]
      }
    }
  };

  const config = roleConfig[roleEffectif] || roleConfig.conducteur;

  const [form, setForm] = useState({
    nom: '', prenom: '', email: '',
    mot_de_passe: '', telephone: '',
    role: roleEffectif
  });
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErreur('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.mot_de_passe.length < 6) {
      setErreur('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setChargement(true);
    try {
      const data = await authService.inscription({ ...form, role: roleEffectif });
      connexion(data.token, data.utilisateur);
      navigate(roleEffectif === 'conducteur' ? '/carte' : '/');
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'Une erreur est survenue');
    } finally {
      setChargement(false);
    }
  };

  const couleurBouton = roleEffectif === 'gilet_jaune'
    ? 'bg-amber-500 hover:bg-amber-600 hover:shadow-amber-200'
    : 'bg-sky-500 hover:bg-sky-600 hover:shadow-sky-200';

  return (
    <div className="min-h-screen flex" style={{fontFamily:"'DM Sans', sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap');
        .input-field { transition:all 0.2s ease; }
        .input-field:focus { outline:none; border-color:#0ea5e9; box-shadow:0 0 0 3px rgba(14,165,233,0.1); }
      `}</style>

      {/* Panel gauche */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-sky-700 via-sky-600 to-sky-500 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="absolute rounded-full border border-white"
              style={{ width:`${(i+1)*130}px`, height:`${(i+1)*130}px`, top:'50%', left:'50%', transform:'translate(-50%,-50%)' }}/>
          ))}
        </div>

        <div className="relative z-10 flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white"/>
            </svg>
          </div>
          <span style={{fontFamily:"'DM Serif Display', serif"}} className="text-white text-2xl">
            Park<span className="text-sky-200">Link</span>
          </span>
        </div>

        <div className="relative z-10">
          <div className="text-5xl mb-6">{config.icon}</div>
          <h2 style={{fontFamily:"'DM Serif Display', serif"}}
            className="text-4xl text-white leading-tight mb-6">
            {config.panneau.titre}
          </h2>
          <div className="space-y-4">
            {config.panneau.points.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center text-sm flex-shrink-0">
                  {p.icon}
                </div>
                <span className="text-sky-100 text-sm">{p.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-sky-200 text-xs">
          © 2026 ParkLink · Une solution Tomorrow Systems
        </div>
      </div>

      {/* Panel droit — formulaire */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-white overflow-y-auto">
        <div className="w-full max-w-md">

          <div className="lg:hidden flex items-center gap-2 mb-8 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white"/>
              </svg>
            </div>
            <span style={{fontFamily:"'DM Serif Display', serif"}} className="text-xl text-slate-900">
              Park<span className="text-sky-500">Link</span>
            </span>
          </div>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-sky-50 text-sky-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              <span>{config.icon}</span> {roleEffectif === 'gilet_jaune' ? 'Gilet jaune' : roleEffectif === 'gestionnaire' ? 'Gestionnaire' : 'Conducteur'}
            </div>
            <h1 style={{fontFamily:"'DM Serif Display', serif"}}
              className="text-3xl text-slate-900 mb-2">{config.titre}</h1>
            <p className="text-slate-500 text-sm">{config.sousTitre}</p>
            <p className="text-slate-500 text-sm mt-1">
              Déjà inscrit ?{' '}
              <Link to="/login" className="text-sky-500 hover:text-sky-600 font-semibold">
                Se connecter
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Prénom</label>
                <input type="text" name="prenom" value={form.prenom}
                  onChange={handleChange} placeholder="Sara" required
                  className="input-field w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 bg-slate-50"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nom</label>
                <input type="text" name="nom" value={form.nom}
                  onChange={handleChange} placeholder="Benali" required
                  className="input-field w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 bg-slate-50"/>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Adresse email</label>
              <input type="email" name="email" value={form.email}
                onChange={handleChange} placeholder="sara@example.ma" required
                className="input-field w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 bg-slate-50"/>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Téléphone <span className="text-slate-400 font-normal">(optionnel)</span>
              </label>
              <input type="tel" name="telephone" value={form.telephone}
                onChange={handleChange} placeholder="06 12 34 56 78"
                className="input-field w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 bg-slate-50"/>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mot de passe</label>
              <input type="password" name="mot_de_passe" value={form.mot_de_passe}
                onChange={handleChange} placeholder="Min. 6 caractères" required
                className="input-field w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 bg-slate-50"/>
            </div>

            {erreur && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                <span>⚠️</span> {erreur}
              </div>
            )}

            <button type="submit" disabled={chargement}
              className={`w-full ${couleurBouton} disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-sm transition-all hover:shadow-lg flex items-center justify-center gap-2`}>
              {chargement ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Création du compte...
                </>
              ) : `Créer mon compte →`}
            </button>

            <p className="text-center text-xs text-slate-400">
              En créant un compte, vous acceptez nos{' '}
              <span className="text-sky-500 cursor-pointer">conditions d'utilisation</span>.
            </p>
          </form>

          {/* Lien retour selon le rôle */}
          {roleEffectif !== 'conducteur' && (
            <div className="mt-6 text-center">
              <button onClick={() => navigate('/')}
                className="text-slate-400 hover:text-slate-600 text-xs transition-colors">
                ← Retour à l'accueil
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;