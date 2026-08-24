import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';

const ProfilConducteur = ({ onglet }) => {
  const GABARITS_OPTIONS = [
    { val: 'petit', icon: '🚗', label: 'Petit',  exemples: 'Kia Picanto, Hyundai i10, Peugeot 108' },
    { val: 'moyen', icon: '🚙', label: 'Moyen',  exemples: 'Dacia Logan, Renault Clio, Peugeot 308' },
    { val: 'grand', icon: '🚐', label: 'Grand',  exemples: 'Hyundai Tucson, Toyota Prado, BMW X5' },
    { val: 'moto',  icon: '🏍️', label: 'Moto',   exemples: 'Moto, scooter' },
  ];

  const { utilisateur } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [vehicules, setVehicules] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [nouvelleVoiture, setNouvelleVoiture] = useState({
    plaque: '', marque: '', modele: '', couleur: '', gabarit: 'moyen'
  });
  const [ajoutVehicule, setAjoutVehicule] = useState(false);
  const [msgSucces, setMsgSucces] = useState('');

  // Réservations — actives / historique
  const [afficherHistorique, setAfficherHistorique] = useState(false);
  const [filtreHistorique, setFiltreHistorique] = useState('tout'); // 'tout' | 'annulee'
  const [triHistorique, setTriHistorique] = useState('recent'); // 'recent' | 'ancien'

  const [notifications, setNotifications] = useState([]);
  const [chargementNotifs, setChargementNotifs] = useState(false);
  const [ticketOuvert, setTicketOuvert] = useState(null);
  
  // Ref anti stale-closure pour le polling
  const afficherHistoriqueRef = useRef(afficherHistorique);
  const filtreHistoriqueRef   = useRef(filtreHistorique);
  useEffect(() => { afficherHistoriqueRef.current = afficherHistorique; }, [afficherHistorique]);
  useEffect(() => { filtreHistoriqueRef.current = filtreHistorique; }, [filtreHistorique]);

  useEffect(() => {
    if (onglet === 'reservations') {
      chargerReservations();
      const interval = setInterval(() => {
        chargerReservations(afficherHistoriqueRef.current, filtreHistoriqueRef.current);
      }, 30000);
      return () => clearInterval(interval);
    }
    if (onglet === 'vehicules') chargerVehicules();
  }, [onglet]);

  // Recharge immédiatement au changement de toggle ou de filtre
  useEffect(() => {
    if (onglet === 'reservations') chargerReservations();
  }, [afficherHistorique, filtreHistorique]);

  // Re-trie localement sans appel API quand le tri change
  useEffect(() => {
    if (afficherHistorique && reservations.length > 0) {
      setReservations(prev => [...prev].sort((a, b) => {
        const diff = new Date(b.heure_debut) - new Date(a.heure_debut);
        return triHistorique === 'recent' ? diff : -diff;
      }));
    }
  }, [triHistorique]);

  // Charge les notifications quand l'onglet s'ouvre
  useEffect(() => {
    if (onglet === 'notifications') chargerNotifications();
  }, [onglet]);

  const chargerNotifications = async () => {
    setChargementNotifs(true);
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data || []);
    } catch (err) { console.error(err); }
    finally { setChargementNotifs(false); }
  };

  const marquerLue = async (id) => {
    try {
      await api.patch(`/notifications/${id}/lue`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, lue: true } : n));
    } catch (err) { console.error(err); }
  };

  const ouvrirTicket = (notif) => {
    if (!notif.lue) marquerLue(notif.id);
    if (notif.reservations) setTicketOuvert(notif);
  };

  const chargerReservations = async (modeHistoriqueForce, filtreForce) => {
    const modeHistorique = modeHistoriqueForce !== undefined ? modeHistoriqueForce : afficherHistorique;
    const filtre = filtreForce !== undefined ? filtreForce : filtreHistorique;

    setChargement(true);
    try {
      const params = new URLSearchParams();
      if (modeHistorique) {
        params.set('historique', 'true');
        if (filtre === 'annulee') params.set('filtre', 'annulee');
      }
      const { data } = await api.get(`/reservations/moi?${params.toString()}`);

      if (modeHistorique) {
        const trie = [...data].sort((a, b) => {
          const diff = new Date(b.heure_debut) - new Date(a.heure_debut);
          return triHistorique === 'recent' ? diff : -diff;
        });
        setReservations(trie);
      } else {
        const maintenant = new Date();
        const dataFiltree = data.filter(r => new Date(r.heure_fin) > maintenant);
        setReservations(dataFiltree);
      }
    } catch (err) {
      console.error(err);
      setReservations([]);
    } finally {
      setChargement(false);
    }
  };

  const chargerVehicules = async () => {
    setChargement(true);
    try {
      const { data } = await api.get('/vehicules/moi');
      setVehicules(data);
    } catch (err) {
      console.error(err);
    } finally {
      setChargement(false);
    }
  };

  const ajouterVehicule = async (e) => {
    e.preventDefault();
    try {
      await api.post('/vehicules', nouvelleVoiture);
      setMsgSucces('Véhicule ajouté !');
      setAjoutVehicule(false);
      setNouvelleVoiture({ plaque: '', marque: '', modele: '', couleur: '', gabarit: 'moyen' });
      chargerVehicules();
      setTimeout(() => setMsgSucces(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const supprimerVehicule = async (id) => {
    if (!confirm('Supprimer ce véhicule ?')) return;
    try {
      await api.delete(`/vehicules/${id}`);
      chargerVehicules();
    } catch (err) {
      console.error(err);
    }
  };

  const annulerReservation = async (id) => {
    if (!confirm('Annuler cette réservation ?')) return;
    try {
      await api.patch(`/reservations/${id}/annuler`);
      // Retire immédiatement de la liste active sans attendre le polling
      setReservations(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  // Onglet profil
  if (onglet === 'profil') return (
    <div>
      <h2 style={{fontFamily:"'DM Serif Display', serif"}} className="text-2xl text-slate-900 mb-6">Mon profil</h2>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-sky-400 to-sky-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl">
            {utilisateur?.prenom?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-slate-900 text-lg">{utilisateur?.prenom} {utilisateur?.nom}</div>
            <div className="text-slate-500 text-sm">{utilisateur?.email}</div>
            <div className="inline-flex items-center gap-1 text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full mt-1">
              🚗 Conducteur
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Prénom', val: utilisateur?.prenom },
            { label: 'Nom', val: utilisateur?.nom },
            { label: 'Email', val: utilisateur?.email },
            { label: 'Membre depuis', val: utilisateur?.cree_le ? new Date(utilisateur.cree_le).toLocaleDateString('fr-FR') : '—' },
          ].map((f, i) => (
            <div key={i} className="flex justify-between py-3 border-b border-slate-100 last:border-0">
              <span className="text-sm text-slate-500">{f.label}</span>
              <span className="text-sm font-medium text-slate-900">{f.val || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Onglet réservations — actives / historique
  // ─────────────────────────────────────────────────────────────────────────
  if (onglet === 'reservations') return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h2 style={{fontFamily:"'DM Serif Display', serif"}} className="text-2xl text-slate-900">
          {afficherHistorique ? 'Historique de mes réservations' : 'Mes réservations'}
        </h2>
        <div className="flex items-center gap-2">
          {afficherHistorique && (
            <>
              <select value={filtreHistorique} onChange={e => setFiltreHistorique(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-sky-400">
                <option value="tout">Toutes (terminées + annulées)</option>
                <option value="annulee">Annulées uniquement</option>
              </select>
              <select value={triHistorique} onChange={e => setTriHistorique(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-sky-400">
                <option value="recent">Plus récent d'abord</option>
                <option value="ancien">Plus ancien d'abord</option>
              </select>
            </>
          )}
          <button
            onClick={() => setAfficherHistorique(h => !h)}
            className="text-xs text-slate-500 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
            {afficherHistorique ? '📋 Réservations actives' : '🕓 Voir l\'historique'}
          </button>
        </div>
      </div>
      <p className="text-slate-500 text-sm mb-5">
        {afficherHistorique
          ? 'Vos réservations passées et annulées.'
          : 'Vos réservations en cours.'}
      </p>

      {chargement ? (
        <div className="flex justify-center py-12">
          <svg className="animate-spin w-6 h-6 text-sky-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
        </div>
      ) : reservations.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
          <div className="text-5xl mb-4">{afficherHistorique ? '🕓' : '📋'}</div>
          <div className="font-semibold text-slate-700 mb-2">
            {afficherHistorique ? 'Aucun historique' : 'Aucune réservation active'}
          </div>
          <div className="text-slate-500 text-sm">
            {afficherHistorique
              ? 'Vos réservations passées apparaîtront ici.'
              : 'Vos réservations en cours apparaîtront ici.'}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map((res) => (
            <div key={res.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-sky-200 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="font-semibold text-slate-900 mb-1">
                    {res.parkings?.nom || 'Parking'}
                  </div>
                  <div className="text-slate-500 text-xs mb-2">{res.parkings?.adresse}</div>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>📅 {new Date(res.heure_debut).toLocaleDateString('fr-FR', {day:'2-digit', month:'short', year:'numeric'})}</span>
                    <span>🕐 {new Date(res.heure_debut).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})} → {new Date(res.heure_fin).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</span>
                    {res.vehicules && <span>🚗 {res.vehicules.plaque}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* Badge statut place */}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      res.statut === 'confirmee' ? 'bg-emerald-100 text-emerald-700' :
                      res.statut === 'annulee'   ? 'bg-red-100 text-red-600' :
                      res.statut === 'terminee'  ? 'bg-slate-100 text-slate-500' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {res.statut === 'confirmee' ? '✅ Place confirmée' :
                      res.statut === 'annulee'   ? '❌ Annulée' :
                      res.statut === 'terminee'  ? '🏁 Terminée' : res.statut}
                    </span>

                    {/* Badge statut service */}
                    {res.statut_service === 'en_attente' && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        ⏳ Service en attente
                      </span>
                    )}
                    {res.statut_service === 'confirmee' && (
                      <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium">
                        ✅ Service confirmé
                      </span>
                    )}
                    {res.statut_service === 'refuse' && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                        ❌ Service non disponible · montant ajusté
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-sky-600">{res.montant_total} MAD</div>
                </div>
              </div>
              {!afficherHistorique && res.statut === 'confirmee' && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <button onClick={() => annulerReservation(res.id)}
                    className="text-red-500 hover:text-red-600 text-xs font-medium transition-colors">
                    Annuler cette réservation
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Onglet véhicules
  if (onglet === 'vehicules') return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 style={{fontFamily:"'DM Serif Display', serif"}} className="text-2xl text-slate-900">Mes véhicules</h2>
        <button onClick={() => setAjoutVehicule(true)}
          className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
          + Ajouter
        </button>
      </div>

      {msgSucces && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
          ✅ {msgSucces}
        </div>
      )}

      {ajoutVehicule && (
        <form onSubmit={ajouterVehicule}
          className="bg-sky-50 border border-sky-200 rounded-2xl p-5 mb-4">
          <h3 className="font-semibold text-slate-900 mb-4 text-sm">Nouveau véhicule</h3>

          {/* Gabarit du véhicule */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-600 mb-2">Gabarit de votre véhicule</label>
            <div className="grid grid-cols-2 gap-2">
              {GABARITS_OPTIONS.map(g => (
                <div key={g.val}
                  onClick={() => setNouvelleVoiture(prev => ({...prev, gabarit: g.val}))}
                  className={`cursor-pointer border-2 rounded-xl p-3 text-center transition-all ${
                    nouvelleVoiture.gabarit === g.val ? 'border-sky-500 bg-sky-100' : 'border-slate-200 bg-white hover:border-sky-200'
                  }`}>
                  <div className="text-2xl mb-1">{g.icon}</div>
                  <div className="text-xs font-semibold text-slate-800">{g.label}</div>
                  <div className="text-xs text-slate-400 mt-0.5 leading-tight">{g.exemples}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            {[
              { name: 'plaque', placeholder: 'Plaque (ex: 12345-A-1)', required: true },
              { name: 'marque', placeholder: 'Marque (ex: Dacia)' },
              { name: 'modele', placeholder: 'Modèle (ex: Logan)' },
              { name: 'couleur', placeholder: 'Couleur (ex: Blanc)' },
            ].map((f) => (
              <input key={f.name} type="text"
                placeholder={f.placeholder}
                value={nouvelleVoiture[f.name]}
                onChange={(e) => setNouvelleVoiture({...nouvelleVoiture, [f.name]: e.target.value})}
                required={f.required}
                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:border-sky-400"/>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit"
              className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
              Enregistrer
            </button>
            <button type="button" onClick={() => setAjoutVehicule(false)}
              className="border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
              Annuler
            </button>
          </div>
        </form>
      )}

      {chargement ? (
        <div className="flex justify-center py-12">
          <svg className="animate-spin w-6 h-6 text-sky-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
        </div>
      ) : vehicules.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
          <div className="text-5xl mb-4">🚗</div>
          <div className="font-semibold text-slate-700 mb-2">Aucun véhicule</div>
          <div className="text-slate-500 text-sm">Ajoutez votre véhicule pour réserver plus vite.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {vehicules.map((v) => {
            const g = GABARITS_OPTIONS.find(g => g.val === v.gabarit) || GABARITS_OPTIONS[1];
            return (
              <div key={v.id} className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-sky-200 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{g.icon}</span>
                    <div>
                      <div className="font-bold text-slate-900 text-lg">{v.plaque}</div>
                      <div className="text-slate-500 text-sm mt-0.5">
                        {[v.marque, v.modele, v.couleur].filter(Boolean).join(' · ') || 'Informations non renseignées'}
                      </div>
                      <div className="text-xs text-sky-600 font-medium mt-1">{g.label}</div>
                    </div>
                  </div>
                  <button onClick={() => supprimerVehicule(v.id)}
                    className="text-slate-300 hover:text-red-400 transition-colors text-lg p-1">
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // Onglet notifications
  if (onglet === 'notifications') return (
    <div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap');`}</style>
      <div className="flex items-center gap-2 mb-5">
        <h2 style={{fontFamily:"'DM Serif Display'"}} className="text-2xl text-slate-900 font-normal">
          Notifications
        </h2>
        {notifications.filter(n => !n.lue).length > 0 && (
          <span className="bg-sky-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {notifications.filter(n => !n.lue).length}
          </span>
        )}
      </div>

      {chargementNotifs ? (
        <div className="flex justify-center py-12">
          <svg className="animate-spin w-6 h-6 text-sky-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
          <div className="text-5xl mb-4">🔔</div>
          <div className="text-slate-500 text-sm">Aucune notification pour le moment.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notif => (
            <div key={notif.id}
              onClick={() => ouvrirTicket(notif)}
              className={`cursor-pointer bg-white border rounded-2xl p-4 transition-all hover:border-sky-200 ${
                !notif.lue ? 'border-sky-200 bg-sky-50/30' : 'border-slate-200'
              }`}>
              <div className="flex items-start gap-3">
                {!notif.lue && <span className="w-2 h-2 bg-sky-500 rounded-full mt-1.5 flex-shrink-0"></span>}
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 text-sm">{notif.titre}</span>
                    <span className="text-slate-400 text-xs whitespace-nowrap">
                      {new Date(notif.cree_le).toLocaleDateString('fr-FR', {day:'2-digit', month:'short'})}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs mt-1">{notif.message}</p>
                  {notif.reservations && (
                    <span className="inline-flex items-center gap-1 text-xs text-sky-600 font-medium mt-2">
                      🎫 Voir le ticket →
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Ticket digital */}
      {ticketOuvert && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setTicketOuvert(null)}>
          <div onClick={e => e.stopPropagation()}
            className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">

            {/* Header ticket */}
            <div className="bg-gradient-to-br from-sky-600 to-sky-400 px-6 py-5 text-center relative">
              <button onClick={() => setTicketOuvert(null)}
                className="absolute top-3 right-3 text-white/70 hover:text-white text-xl">✕</button>
              <div className="text-3xl mb-2">🎫</div>
              <h3 style={{fontFamily:"'DM Serif Display'"}} className="text-white text-xl font-normal">
                Ticket de réservation
              </h3>
              <p className="text-sky-100 text-xs mt-1">ParkLink · Place garantie</p>
            </div>

            {/* Perforation visuelle */}
            <div className="relative">
              <div className="absolute -top-3 left-0 right-0 flex justify-between px-2">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="w-3 h-3 bg-slate-50 rounded-full"></div>
                ))}
              </div>
            </div>

            {/* Corps ticket */}
            <div className="p-6 space-y-4">
              <div className="text-center pb-4 border-b border-dashed border-slate-200">
                <div className="font-bold text-slate-900 text-lg">
                  {ticketOuvert.reservations?.parkings?.nom}
                </div>
                <div className="text-emerald-600 text-xs font-semibold mt-1 inline-flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-full">
                  ✅ Place confirmée
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <div className="text-xs text-slate-400 mb-1">Arrivée</div>
                  <div className="font-semibold text-slate-900 text-sm">
                    {ticketOuvert.reservations && new Date(ticketOuvert.reservations.heure_debut).toLocaleDateString('fr-FR', {day:'2-digit', month:'short'})}
                  </div>
                  <div className="text-slate-600 text-sm">
                    {ticketOuvert.reservations && new Date(ticketOuvert.reservations.heure_debut).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-400 mb-1">Départ</div>
                  <div className="font-semibold text-slate-900 text-sm">
                    {ticketOuvert.reservations && new Date(ticketOuvert.reservations.heure_fin).toLocaleDateString('fr-FR', {day:'2-digit', month:'short'})}
                  </div>
                  <div className="text-slate-600 text-sm">
                    {ticketOuvert.reservations && new Date(ticketOuvert.reservations.heure_fin).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">Montant total</span>
                <span className="font-bold text-sky-600 text-lg">
                  {ticketOuvert.reservations?.montant_total} MAD
                </span>
              </div>
              
              {/* Mode de paiement */}
              <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                <span className="text-xs text-slate-500">Mode de paiement</span>
                <span className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  {ticketOuvert.reservations?.paiement === 'especes' ? '💵 Espèces' : '💳 Carte bancaire'}
                </span>
              </div>

              {/* Services extra si présents */}
              {ticketOuvert.reservations?.services_choisis?.length > 0 && (
                <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
                  <div className="text-xs text-sky-700 font-semibold mb-2">Services extra</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ticketOuvert.reservations.services_choisis.map(id => (
                      <span key={id} className="text-xs bg-white text-sky-700 border border-sky-200 px-2 py-1 rounded-full">
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-center text-slate-400 text-xs pt-2">
                Référence : {ticketOuvert.reservation_id?.slice(0, 8).toUpperCase()}
              </div>
            </div>

            {/* QR Code */}
            {ticketOuvert && (() => {
              const qrData = `${window.location.origin}/verifier/${ticketOuvert.reservation_id}`;
              
              return (
                <div className="border-t border-dashed border-slate-200 pt-4 flex flex-col items-center gap-2">
                  <p className="text-xs text-slate-400 font-medium">Scanner pour vérifier</p>
                  <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                    <QRCodeSVG
                      value={qrData}
                      size={120}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <p className="text-xs text-slate-400">Réf. {ticketOuvert.reservation_id?.slice(0, 8).toUpperCase()}</p>
                </div>
              );
            })()}

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-3 text-center">
              <p className="text-slate-400 text-xs">Présentez ce ticket à votre arrivée si demandé</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Onglet assistance
  if (onglet === 'assistance') return (
    <div>
      <h2 style={{fontFamily:"'DM Serif Display', serif"}} className="text-2xl text-slate-900 mb-6">Assistance</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        {[
          { icon:'💬', titre:'Chat en direct', desc:'Discutez avec notre équipe en temps réel.', bientot: true },
          { icon:'📧', titre:'Email', desc:'Envoyez-nous un message à support@parklink.ma', bientot: false },
          { icon:'📞', titre:'Téléphone', desc:'Appelez-nous au +212 5 22 XX XX XX', bientot: false },
          { icon:'📖', titre:'FAQ', desc:'Consultez nos questions fréquentes.', bientot: true },
        ].map((item, i) => (
          <div key={i} className={`bg-white border rounded-2xl p-5 ${item.bientot ? 'border-slate-100 opacity-60' : 'border-slate-200 hover:border-sky-200 transition-colors'}`}>
            <div className="text-3xl mb-3">{item.icon}</div>
            <div className="font-semibold text-slate-900 text-sm mb-1">
              {item.titre}
              {item.bientot && <span className="ml-2 text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">bientôt</span>}
            </div>
            <div className="text-slate-500 text-xs">{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return null;
};

export default ProfilConducteur;