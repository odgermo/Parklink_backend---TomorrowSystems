import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';

const LoginPage = () => {
  const navigate = useNavigate();
  const { connexion } = useAuth();
  const [form, setForm] = useState({ email: '', mot_de_passe: '' });
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErreur('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setChargement(true);
    try {
      const data = await authService.connexion(form.email, form.mot_de_passe);
      connexion(data.token, data.utilisateur);
      navigate(data.utilisateur.role === 'conducteur' ? '/carte' : '/');
    } catch (err) {
      setErreur(err.response?.data?.erreur || 'Email ou mot de passe incorrect');
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{fontFamily: "'DM Sans', sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap');
        .input-field { transition: all 0.2s ease; }
        .input-field:focus { outline: none; border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.1); }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp 0.5s ease both; }
        .fade-up-2 { animation: fadeUp 0.5s 0.1s ease both; }
      `}</style>

      {/* Panel gauche — visuel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-sky-700 via-sky-600 to-sky-500 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute rounded-full border border-white"
              style={{
                width: `${(i+1)*120}px`, height: `${(i+1)*120}px`,
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)'
              }}/>
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
          <h2 style={{fontFamily:"'DM Serif Display', serif"}}
            className="text-4xl text-white leading-tight mb-6">
            Votre place de parking,<br />
            <em className="text-sky-200">en quelques secondes</em>
          </h2>
          <div className="space-y-4">
            {[
              { icon: '🔍', text: 'Recherchez parmi 200+ parkings à Casablanca' },
              { icon: '📅', text: 'Réservez à l\'avance ou en arrivant' },
              { icon: '🛡️', text: 'Votre place est garantie à l\'arrivée' },
              { icon: '💳', text: 'Payez en espèces ou par carte' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center text-sm flex-shrink-0">
                  {item.icon}
                </div>
                <span className="text-sky-100 text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-sky-200 text-xs">
          © 2026 ParkLink · Une solution Tomorrow Systems
        </div>
      </div>

      {/* Panel droit — formulaire */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-md">

          <div className="lg:hidden flex items-center gap-2 mb-10 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white"/>
              </svg>
            </div>
            <span style={{fontFamily:"'DM Serif Display', serif"}} className="text-xl text-slate-900">
              Park<span className="text-sky-500">Link</span>
            </span>
          </div>

          <div className="fade-up">
            <h1 style={{fontFamily:"'DM Serif Display', serif"}}
              className="text-3xl text-slate-900 mb-2">Bon retour 👋</h1>
            <p className="text-slate-500 text-sm mb-8">
              Pas encore de compte ?{' '}
              <Link to="/register" className="text-sky-500 hover:text-sky-600 font-semibold">
                S'inscrire gratuitement
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 fade-up-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Adresse email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="sara@example.ma"
                required
                className="input-field w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Mot de passe
              </label>
              <input
                type="password"
                name="mot_de_passe"
                value={form.mot_de_passe}
                onChange={handleChange}
                placeholder="••••••••"
                required
                className="input-field w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 bg-slate-50"
              />
            </div>

            {erreur && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                <span>⚠️</span> {erreur}
              </div>
            )}

            <button
              type="submit"
              disabled={chargement}
              className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white py-3 rounded-xl font-semibold text-sm transition-all hover:shadow-lg hover:shadow-sky-200 flex items-center justify-center gap-2">
              {chargement ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Connexion...
                </>
              ) : 'Se connecter →'}
            </button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-slate-400">ou</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/carte')}
              className="w-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 py-3 rounded-xl font-medium text-sm transition-all">
              🗺️ Continuer sans compte
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;