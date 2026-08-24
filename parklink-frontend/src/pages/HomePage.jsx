import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const HomePage = () => {
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const [recherche, setRecherche] = useState('');
  const [typeVehicule, setTypeVehicule] = useState('');
  const [serviceExtra, setServiceExtra] = useState('');
  const [dateRecherche, setDateRecherche] = useState('');
  const [heureDebut, setHeureDebut] = useState('');
  const [heureFin, setHeureFin] = useState('');

  const handleRecherche = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (recherche)     params.set('q',       recherche);
    if (typeVehicule)  params.set('vehicule', typeVehicule);
    if (serviceExtra)  params.set('service',  serviceExtra);
    // On passe date, debut et fin séparément
    // MapPage les recompose en heure_debut = date + 'T' + debut
    if (dateRecherche) params.set('date',  dateRecherche);
    if (heureDebut)    params.set('debut', heureDebut);
    if (heureFin)      params.set('fin',   heureFin);
    navigate(`/carte?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-white" style={{fontFamily:"'DM Sans', sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap');
        .hero-bg { background: linear-gradient(135deg, #0c4a6e 0%, #0369a1 45%, #0ea5e9 100%); }
        .operator-bg { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); }
        .authority-bg { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%); }
        .card-hover { transition: all 0.25s ease; }
        .card-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        .input-focus:focus { outline:none; border-color:#0ea5e9; box-shadow:0 0 0 3px rgba(14,165,233,0.12); }
        .pill-tag { background:rgba(255,255,255,0.15); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.25); }
        .select-field { appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation:fadeUp 0.6s ease both; }
        .fade-up-2 { animation:fadeUp 0.6s 0.15s ease both; }
        .fade-up-3 { animation:fadeUp 0.6s 0.3s ease both; }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:0.4} 100%{transform:scale(1.5);opacity:0} }
        .pulse-ring { animation:pulse-ring 2s ease-out infinite; }
      `}</style>

      {/* ═══════════════════════════════════════
          NAVBAR
      ═══════════════════════════════════════ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 bg-sky-500 rounded-xl flex items-center justify-center shadow-md shadow-sky-200">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white"/>
              </svg>
            </div>
            <span style={{fontFamily:"'DM Serif Display', serif"}} className="text-xl text-slate-900">
              Park<span className="text-sky-500">Link</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {utilisateur ? (
              <button onClick={() => navigate('/profil')}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                👤 {utilisateur.prenom}
              </button>
            ) : (
              <>
                <button onClick={() => navigate('/login')}
                  className="text-slate-600 hover:text-sky-600 px-4 py-2 text-sm font-medium transition-colors">
                  Connexion
                </button>
                <button onClick={() => navigate('/register/conducteur')}
                  className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:shadow-sky-200">
                  S'inscrire
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════
          ÉTAGE 1 — HERO + RECHERCHE
      ═══════════════════════════════════════ */}
      <div className="hero-bg pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 style={{fontFamily:"'DM Serif Display', serif"}}
            className="text-5xl md:text-6xl text-white mb-4 leading-tight fade-up">
            Trouvez votre place<br/>
            <em className="text-sky-200 not-italic">de parking en quelques clics</em>
          </h1>
          <p className="text-sky-100 text-lg mb-10 max-w-xl mx-auto fade-up-2">
            Recherchez, comparez et réservez parmi des centaines de parkings à Casablanca. Payez en espèces ou par carte.
          </p>

          {/* Barre de recherche principale */}
          <form onSubmit={handleRecherche}
            className="bg-white rounded-2xl p-3 shadow-2xl max-w-3xl mx-auto fade-up-3">

            {/* Ligne 1 — localisation */}
            <div className="flex items-center gap-3 px-3 pb-3 border-b border-slate-100">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-slate-400 flex-shrink-0">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
              </svg>
              <input type="text"
                placeholder="Où allez-vous ? Quartier, adresse, lieu..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                className="flex-1 py-2 text-slate-700 placeholder-slate-400 text-sm font-medium bg-transparent focus:outline-none"/>
            </div>

            {/* Ligne 2 — date et heures */}
            <div className="flex flex-col sm:flex-row gap-2 px-1 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2 flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <span className="text-slate-400 text-sm flex-shrink-0">📅</span>
                <input
                  type="date"
                  value={dateRecherche}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDateRecherche(e.target.value)}
                  className="flex-1 text-xs text-slate-600 bg-transparent focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2 flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <span className="text-slate-400 text-sm flex-shrink-0">🕐</span>
                <input
                  type="time"
                  value={heureDebut}
                  onChange={(e) => setHeureDebut(e.target.value)}
                  className="flex-1 text-xs text-slate-600 bg-transparent focus:outline-none"
                />
                <span className="text-slate-400 text-xs flex-shrink-0">Arrivée</span>
              </div>
              <div className="flex items-center gap-2 flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <span className="text-slate-400 text-sm flex-shrink-0">🕕</span>
                <input
                  type="time"
                  value={heureFin}
                  onChange={(e) => setHeureFin(e.target.value)}
                  className="flex-1 text-xs text-slate-600 bg-transparent focus:outline-none"
                />
                <span className="text-slate-400 text-xs flex-shrink-0">Départ</span>
              </div>
            </div>

            {/* Ligne 3 — filtres */}
            <div className="flex flex-wrap gap-2 pt-3 px-1">
              <select value={typeVehicule} onChange={(e) => setTypeVehicule(e.target.value)}
                className="select-field flex-1 min-w-32 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 bg-slate-50 input-focus pr-8">
                <option value="">🚗 Type de véhicule</option>
                <option value="voiture">🚗 Voiture</option>
                <option value="moto">🏍️ Moto</option>
                <option value="electrique">⚡ Électrique</option>
                <option value="pmr">♿ PMR</option>
              </select>

              <select value={serviceExtra} onChange={(e) => setServiceExtra(e.target.value)}
                className="select-field flex-1 min-w-32 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 bg-slate-50 input-focus pr-8">
                <option value="">✨ Services extra</option>
                <option value="lavage">🚿 Lavage & Entretien</option>
                <option value="recharge">⚡ Recharge électrique</option>
                <option value="valet">🤵 Valet parking</option>
                <option value="courses">🛒 Transport de courses</option>
                <option value="assistance">♿ Assistance PMR</option>
              </select>

              {[
                { val: 'park_ride', label: '🚌 Park & Ride' },
                { val: 'abonnement', label: '📋 Abonnement' },
              ].map((tag) => (
                <button key={tag.val} type="button"
                  onClick={() => setServiceExtra(serviceExtra === tag.val ? '' : tag.val)}
                  className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                    serviceExtra === tag.val
                      ? 'bg-sky-500 text-white border-sky-500'
                      : 'border-slate-200 text-slate-600 bg-slate-50 hover:border-sky-300'
                  }`}>
                  {tag.label}
                </button>
              ))}

              <button type="submit"
                className="ml-auto bg-sky-500 hover:bg-sky-600 text-white px-6 py-2 rounded-xl font-semibold text-sm transition-all hover:shadow-lg whitespace-nowrap">
                Rechercher →
              </button>
            </div>
          </form>

          {/* Suggestions rapides */}
          <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
            <span className="text-sky-200 text-xs">Populaires :</span>
            {['Maarif', 'Casa-Port', 'Hay Hassane', 'Ain Diab', 'Guéliz'].map((lieu) => (
              <button key={lieu}
                onClick={() => navigate(`/carte?q=${encodeURIComponent(lieu)}`)}
                className="pill-tag text-sky-100 hover:bg-white/25 text-xs px-3 py-1.5 rounded-full transition-colors">
                {lieu}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-slate-900 py-8">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { icon: '🅿️', val: '200+', label: 'Parkings référencés' },
            { icon: '📍', val: '15 000+', label: 'Places disponibles' },
            { icon: '⚡', val: '2 min', label: 'Pour réserver' },
            { icon: '🛡️', val: '100%', label: 'Place garantie' },
          ].map((s, i) => (
            <div key={i} className="p-3">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-base font-bold text-white">{s.val}</div>
              <div className="text-slate-400 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          ÉTAGE 2 — AVANTAGES + SERVICES + COMMENT ÇA MARCHE
      ═══════════════════════════════════════ */}

      {/* Services */}
      <div className="bg-sky-50 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 style={{fontFamily:"'DM Serif Display', serif"}}
              className="text-3xl text-slate-900 mb-3">Votre parking, votre expérience</h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm">
              Chaque conducteur a des besoins différents. C'est pourquoi ParkLink vous permet de choisir parmi des parkings offrant des services complémentaires pour gagner du temps et profiter d'une expérience sur mesure.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { icon:'🚿', titre:'Lavage & entretien', desc:'Lavage et petite maintenance pendant votre stationnement.' },
              { icon:'⚡', titre:'Recharge électrique', desc:'Bornes de recharge pour véhicules électriques et hybrides.' },
              { icon:'🤵', titre:'Valet parking', desc:'Confiez votre véhicule à un professionnel. Récupérez-le prêt.' },
              { icon:'🛒', titre:'Transport de courses', desc:'Un accompagnateur prend en charge vos courses.' },
              { icon:'♿', titre:'Accès PMR', desc:'Places et accès adaptés aux personnes en situation de handicap.' },
              { icon:'🅿️🚊', titre:'Park & Ride', desc:'Stationnez votre véhicule en sécurité et rejoignez facilement votre destination grâce aux transports publics.' },
            ].map((s, i) => (
              <div key={i} className="card-hover bg-white rounded-2xl p-5 border border-slate-100">
                <div className="text-3xl mb-3">{s.icon}</div>
                <div className="font-semibold text-slate-900 text-sm mb-1">{s.titre}</div>
                <div className="text-slate-500 text-xs leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comment ça marche */}
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 style={{fontFamily:"'DM Serif Display', serif"}}
            className="text-3xl text-slate-900 mb-3">Comment ça marche ?</h2>
          <p className="text-slate-500 text-sm">De la recherche à la place garantie, en moins de 2 minutes</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { step:'01', icon:'🔍', titre:'Recherchez', desc:'Entrez votre destination ou activez la géolocalisation. Voyez tous les parkings disponibles avec prix et distance.' },
            { step:'02', icon:'⚖️', titre:'Comparez', desc:'Tarifs, horaires, services disponibles. Lisez les avis d\'autres conducteurs pour faire le bon choix.' },
            { step:'03', icon:'📅', titre:'Réservez & payez', desc:'Choisissez votre créneau. Payez en espèces à l\'arrivée ou par carte bancaire en ligne.' },
            { step:'04', icon:'🛡️', titre:'Place garantie', desc:'Votre place est bloquée et vous attend. Arrivez directement, sans stress, sans tourner en rond.' },
          ].map((item, i) => (
            <div key={i} className="card-hover text-center p-6 rounded-2xl hover:bg-sky-50 border border-transparent hover:border-sky-100">
              <div className="w-14 h-14 bg-sky-100 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">
                {item.icon}
              </div>
              <div className="text-xs font-bold text-sky-400 tracking-widest mb-2">ÉTAPE {item.step}</div>
              <h3 className="font-bold text-slate-900 mb-2 text-sm">{item.titre}</h3>
              <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          ÉTAGE 3 — OPÉRATEURS (GESTIONNAIRES + GILETS JAUNES)
      ═══════════════════════════════════════ */}
      <div className="operator-bg py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block bg-sky-500/20 text-sky-400 text-xs font-bold tracking-widest px-4 py-1.5 rounded-full mb-4 uppercase">
              Opérateurs de stationnement
            </span>
            <h2 style={{fontFamily:"'DM Serif Display', serif"}}
              className="text-3xl md:text-4xl text-white mb-4">
              Êtes-vous un opérateur de stationnement ?
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm leading-relaxed">
              Souhaiteriez-vous promouvoir vos parcs de stationnement, atteindre de nouveaux clients et piloter votre activité en temps réel ?
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {[
              {
                icon: '🏢',
                titre: 'Gestionnaire de parking',
                desc: 'Gérez vos parkings, définissez vos tarifs, suivez vos réservations et maximisez votre taux d\'occupation depuis un dashboard dédié.',
                avantages: ['Dashboard de gestion complet', 'Suivi des réservations en temps réel', 'Statistiques d\'occupation', 'Gestion multi-parkings'],
                cta: 'Inscrire mon parking',
                route: '/register/gestionnaire',
                couleur: 'sky'
              },
              {
                icon: '🦺',
                titre: 'Gilet jaune',
                desc: 'Référencez votre zone de stationnement sur la carte, mettez à jour les disponibilités de places et soyez visible par des milliers de conducteurs.',
                avantages: ['Référencement sur la carte', 'Mise à jour des disponibilités', 'Visibilité accrue', 'Interface mobile simple'],
                cta: 'Rejoindre ParkLink',
                route: '/register/gilet-jaune',
                couleur: 'amber'
              }
            ].map((op, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-7 hover:bg-white/10 transition-all">
                <div className="text-4xl mb-4">{op.icon}</div>
                <h3 style={{fontFamily:"'DM Serif Display', serif"}}
                  className="text-xl text-white mb-3">{op.titre}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-5">{op.desc}</p>
                <ul className="space-y-2 mb-6">
                  {op.avantages.map((a, j) => (
                    <li key={j} className="flex items-center gap-2 text-slate-300 text-xs">
                      <span className="w-4 h-4 bg-sky-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2 2 4-4" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                      {a}
                    </li>
                  ))}
                </ul>
                <button onClick={() => navigate(op.route)}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                    op.couleur === 'sky'
                      ? 'bg-sky-500 hover:bg-sky-400 text-white hover:shadow-lg hover:shadow-sky-500/20'
                      : 'bg-amber-500 hover:bg-amber-400 text-white hover:shadow-lg hover:shadow-amber-500/20'
                  }`}>
                  {op.cta} →
                </button>
              </div>
            ))}
          </div>

          <div className="text-center text-slate-500 text-xs">
            Vous avez déjà un compte ?{' '}
            <button onClick={() => navigate('/login')} className="text-sky-400 hover:text-sky-300 font-medium">
              Se connecter
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          ÉTAGE 4 — AUTORITÉS DE LA VILLE
      ═══════════════════════════════════════ */}
      <div className="authority-bg py-20 px-6 relative overflow-hidden">
        {/* Éléments décoratifs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 text-center md:text-left">
              <span className="inline-block bg-indigo-500/20 text-indigo-300 text-xs font-bold tracking-widest px-4 py-1.5 rounded-full mb-5 uppercase">
                Autorités urbaines
              </span>
              <h2 style={{fontFamily:"'DM Serif Display', serif"}}
                className="text-3xl md:text-4xl text-white mb-5 leading-tight">
                ParkLink, plus qu'un outil<br/>
                <em className="text-indigo-300 not-italic">de recherche de stationnement</em>
              </h2>
              <p className="text-indigo-200 text-sm leading-relaxed mb-4">
                Laissez-nous vous fournir les données pour mieux piloter votre ville. Flux de circulation, taux d'occupation, zones saturées, comportements de stationnement — tout en temps réel.
              </p>
              <ul className="space-y-2 mb-8">
                {[
                  'Données de mobilité urbaine en temps réel',
                  'Cartographie des zones de saturation',
                  'Tableaux de bord décisionnels',
                  'Rapports périodiques et exports',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-indigo-200 text-xs">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0"></span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => alert('Fonctionnalité disponible prochainement — contactez-nous.')}
                  className="bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:shadow-lg hover:shadow-indigo-500/20">
                  Demander une démo
                </button>
                <button
                  onClick={() => alert('Fonctionnalité disponible prochainement.')}
                  className="border border-indigo-400/40 hover:bg-white/10 text-indigo-200 px-6 py-3 rounded-xl font-semibold text-sm transition-all">
                  En savoir plus
                </button>
              </div>
              <p className="text-indigo-400 text-xs mt-4">
                * Ces fonctionnalités seront disponibles prochainement.
              </p>
            </div>

            {/* Visuel data */}
            <div className="flex-shrink-0 w-full md:w-72">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur">
                <div className="text-indigo-300 text-xs font-bold uppercase tracking-widest mb-4">
                  Tableau de bord ville
                </div>
                {[
                  { label: 'Taux d\'occupation moyen', val: '73%', color: 'bg-indigo-500', width: '73%' },
                  { label: 'Zones saturées', val: '4', color: 'bg-red-500', width: '30%' },
                  { label: 'Parkings actifs', val: '47', color: 'bg-emerald-500', width: '90%' },
                  { label: 'Conducteurs actifs', val: '1 240', color: 'bg-sky-500', width: '60%' },
                ].map((stat, i) => (
                  <div key={i} className="mb-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">{stat.label}</span>
                      <span className="text-white font-semibold">{stat.val}</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5">
                      <div className={`${stat.color} h-1.5 rounded-full opacity-70`} style={{width: stat.width}}></div>
                    </div>
                  </div>
                ))}
                <div className="mt-4 pt-4 border-t border-white/10 text-center">
                  <span className="text-indigo-300 text-xs">Données simulées · Démo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-500 py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white"/>
                </svg>
              </div>
              <span style={{fontFamily:"'DM Serif Display', serif"}} className="text-white text-lg">ParkLink</span>
            </div>
            <div className="flex items-center gap-6 text-xs">
              <button onClick={() => navigate('/carte')} className="hover:text-slate-300 transition-colors">Trouver un parking</button>
              <button onClick={() => navigate('/register/gestionnaire')} className="hover:text-slate-300 transition-colors">Gestionnaires</button>
              <button onClick={() => navigate('/register/gilet-jaune')} className="hover:text-slate-300 transition-colors">Gilets jaunes</button>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-2 text-xs">
            <p>© 2026 ParkLink · Casablanca, Maroc · Tous droits réservés</p>
            <p>Une solution <span className="text-slate-400">Tomorrow Systems</span></p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;