import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import FormulaireAjoutParking from './FormulaireAjoutParking';
import FormulaireModifierParking from './FormulaireModifierParking';

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const SERVICES_META = {
  lavage:   { icon: '🚿', label: 'Lavage' },
  recharge: { icon: '⚡', label: 'Recharge électrique' },
  valet:    { icon: '🤵', label: 'Valet parking' },
  courses:  { icon: '🛒', label: 'Transport de courses' },
};
const STATUT_CONFIG = {
  actif:                 { label: 'Actif',                  bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  en_attente_validation: { label: 'En attente de validation', bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
  suspendu:              { label: 'Suspendu',                bg: 'bg-red-100',     text: 'text-red-600',     dot: 'bg-red-500'     },
};

const STATUT_RESERVATION = {
  en_attente: { label: 'En attente',  bg: 'bg-amber-100',   text: 'text-amber-700'   },
  confirmee:  { label: 'Confirmée',   bg: 'bg-emerald-100', text: 'text-emerald-700' },
  terminee:   { label: 'Terminée',    bg: 'bg-slate-100',   text: 'text-slate-500'   },
  annulee:    { label: 'Annulée',     bg: 'bg-red-100',     text: 'text-red-600'     },
};

// ─── SPINNER ─────────────────────────────────────────────────────────────────
const Spinner = () => (
  <div className="flex justify-center py-12">
    <svg className="animate-spin w-6 h-6 text-sky-500" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
    </svg>
  </div>
);

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
const ProfilGestionnaire = ({ onglet }) => {
  const { utilisateur } = useAuth();

  // Parkings
  const [parkings, setParkings]               = useState([]);
  const [chargementParkings, setChargementParkings] = useState(false);
  const [formulaireOuvert, setFormulaireOuvert]     = useState(false);
  const [parkingAModifier, setParkingAModifier]     = useState(null);
  const [succesAjout, setSuccesAjout]               = useState(false);

  // Réservations
  const [reservations, setReservations]             = useState([]);
  const [chargementRes, setChargementRes]           = useState(false);
  const [afficherHistorique, setAfficherHistorique] = useState(false);
  const [triHistorique, setTriHistorique] = useState('recent'); // 'recent' | 'ancien'
  const [actionEnCours, setActionEnCours]           = useState(null); // id de la résa en cours de traitement

  

  // ── Chargement initial ────────────────────────────────────────────────────
  // Ref pour éviter le stale closure dans setInterval
  const afficherHistoriqueRef = useRef(afficherHistorique);
  useEffect(() => {
    afficherHistoriqueRef.current = afficherHistorique;
  }, [afficherHistorique]);

  useEffect(() => {
    if (onglet === 'parkings') chargerParkings();
    if (onglet === 'reservations') {
      chargerReservations();
      const interval = setInterval(() => {
        chargerReservations(afficherHistoriqueRef.current);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [onglet]);

  // Recharge immédiatement quand on bascule le toggle historique
  useEffect(() => {
    if (onglet === 'reservations') chargerReservations();
  }, [afficherHistorique]);

  // Re-trie localement quand le tri change, sans refaire d'appel API
  useEffect(() => {
    if (afficherHistorique && reservations.length > 0) {
      setReservations(prev => [...prev].sort((a, b) => {
        const diff = new Date(b.heure_debut) - new Date(a.heure_debut);
        return triHistorique === 'recent' ? diff : -diff;
      }));
    }
  }, [triHistorique]);

  // ── Loaders ───────────────────────────────────────────────────────────────
  const chargerParkings = async () => {
    setChargementParkings(true);
    try {
      const { data } = await api.get('/parkings/mes-parkings');
      setParkings(data);
    } catch {
      try {
        const { data } = await api.get('/parkings');
        setParkings(data.filter(p => p.gestionnaire_id === utilisateur?.id));
      } catch (err) { console.error(err); }
    } finally {
      setChargementParkings(false);
    }
  };

  const chargerReservations = async (modeHistoriqueForce) => {
    const modeHistorique = modeHistoriqueForce !== undefined ? modeHistoriqueForce : afficherHistorique;
    setChargementRes(true);
    try {
      const params = modeHistorique ? '?historique=true' : '';
      const { data } = await api.get(`/reservations/gestionnaire${params}`);

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
      console.error('Erreur chargement réservations gestionnaire:', err);
      setReservations([]);
    } finally {
      setChargementRes(false);
    }
  };

 

  // ── Actions parkings ──────────────────────────────────────────────────────
  const mettreAJourDisponibilite = async (parkingId, valeur, capacite) => {
    const val = parseInt(valeur);
    if (isNaN(val) || val < 0 || val > capacite) return;
    try {
      await api.patch(`/parkings/${parkingId}/disponibilite`, { places_disponibles: val });
      setParkings(prev => prev.map(p =>
        p.id === parkingId ? { ...p, places_disponibles: val } : p
      ));
    } catch (err) { console.error(err); }
  };

  // ── Actions réservations ──────────────────────────────────────────────────
  const validerReservation = async (id) => {
    setActionEnCours(id);
    try {
      await api.patch(`/reservations/${id}/valider`);
      setReservations(prev => prev.map(r =>
        r.id === id ? { ...r, statut: 'confirmee' } : r
      ));
    } catch (err) { console.error(err); }
    finally { setActionEnCours(null); }
  };

  const terminerReservation = async (id) => {
    setActionEnCours(id);
    try {
      await api.patch(`/reservations/${id}/terminer`);
      // Retirer de la liste active (ou recharger selon mode)
      setReservations(prev => prev.filter(r => r.id !== id));
    } catch (err) { console.error(err); }
    finally { setActionEnCours(null); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ONGLET PARKINGS
  // ─────────────────────────────────────────────────────────────────────────
  if (onglet === 'parkings') return (
    <div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap');`}</style>

      <div className="flex items-center justify-between mb-5">
        <h2 style={{fontFamily:"'DM Serif Display'"}} className="text-2xl text-slate-900 font-normal">
          Mes parkings
        </h2>
        <button
          onClick={() => setFormulaireOuvert(true)}
          className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
          <span className="text-lg leading-none">+</span> Ajouter un parking
        </button>
      </div>

      {succesAjout && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2 mb-4">
          ✅ Parking soumis avec succès — en attente de validation par l'administrateur.
        </div>
      )}

      {chargementParkings ? <Spinner /> : parkings.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
          <div className="text-5xl mb-4">🏢</div>
          <div className="font-semibold text-slate-700 mb-2">Aucun parking</div>
          <div className="text-slate-500 text-sm mb-5">
            Ajoutez votre premier parking pour apparaître sur la carte ParkLink.
          </div>
          <button
            onClick={() => setFormulaireOuvert(true)}
            className="bg-sky-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-sky-600 transition-colors">
            + Ajouter un parking
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {parkings.map((p) => {
            const statut  = STATUT_CONFIG[p.statut] || STATUT_CONFIG.en_attente_validation;
            // services est maintenant un objet { valet: 50, ... }
            const servicesObj = (p.services && typeof p.services === 'object' && !Array.isArray(p.services))
              ? p.services
              : {};
            const servicesIds = Object.keys(servicesObj);

            return (
              <div key={p.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-sky-200 transition-colors">

                {/* ── Header avec bouton Modifier en haut à droite ── */}
                <div className="p-4 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-slate-900">{p.nom}</h3>
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${statut.bg} ${statut.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statut.dot}`}></span>
                          {statut.label}
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs">{p.adresse}</p>
                    </div>

                    {/* ✏️ Bouton Modifier — coin haut droit */}
                    <button
                      onClick={() => setParkingAModifier(p)}
                      className="shrink-0 text-sky-500 hover:text-sky-700 text-xs font-medium transition-colors border border-sky-200 hover:border-sky-400 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      ✏️ Modifier
                    </button>
                  </div>
                </div>

                {/* ── Infos ── */}
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-sky-50 rounded-xl p-3 text-center">
                      <div className="font-bold text-sky-600">{p.tarif_horaire} MAD</div>
                      <div className="text-slate-500 text-xs">par heure</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <div className="font-bold text-slate-700 text-sm">
                        {p.horaire_ouverture?.slice(0,5)} – {p.horaire_fermeture?.slice(0,5)}
                      </div>
                      <div className="text-slate-500 text-xs">Horaires</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <div className={`font-bold ${p.places_disponibles > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {p.places_disponibles}/{p.capacite_totale}
                      </div>
                      <div className="text-slate-500 text-xs">places libres</div>
                    </div>
                  </div>

                  {/* Types */}
                  <div className="flex gap-2 flex-wrap mb-3">
                    {p.infrastructure && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                        {{ surface:'☀️ Surface', souterrain:'⬇️ Souterrain', residentiel:'🏘️ Résidentiel', relais:'🚌 Relais' }[p.infrastructure] || p.infrastructure}
                      </span>
                    )}
                    {p.mode_gestion && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                        {{ public:'🏛️ Public', prive:'🔒 Privé' }[p.mode_gestion] || p.mode_gestion}
                      </span>
                    )}
                  </div>

                  {/* Services avec tarifs */}
                  {servicesIds.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Services</p>
                      <div className="flex flex-wrap gap-1.5">
                        {servicesIds.map(sId => {
                          const s = SERVICES_META[sId];
                          if (!s) return null;
                          return (
                            <span key={sId}
                              className="flex items-center gap-1 text-xs bg-sky-50 text-sky-700 border border-sky-100 px-2 py-1 rounded-full">
                              {s.icon} {s.label}
                              {servicesObj[sId] > 0 && (
                                <span className="font-semibold">· {servicesObj[sId]} MAD</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Disponibilité */}
                  <div className="border-t border-slate-100 pt-3 flex items-center gap-3">
                    <span className="text-xs text-slate-500">Places disponibles :</span>
                    <input
                      type="number" min="0" max={p.capacite_totale}
                      defaultValue={p.places_disponibles}
                      className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:border-sky-400"
                      onBlur={e => mettreAJourDisponibilite(p.id, e.target.value, p.capacite_totale)}
                    />
                    <span className="text-xs text-slate-400">/ {p.capacite_totale}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formulaireOuvert && (
        <FormulaireAjoutParking
          onFermer={() => setFormulaireOuvert(false)}
          onSucces={() => {
            setFormulaireOuvert(false);
            setSuccesAjout(true);
            chargerParkings();
            setTimeout(() => setSuccesAjout(false), 5000);
          }}
        />
      )}

      {parkingAModifier && (
        <FormulaireModifierParking
          parking={parkingAModifier}
          onFermer={() => setParkingAModifier(null)}
          onSucces={() => {
            setParkingAModifier(null);
            chargerParkings();
          }}
        />
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // ONGLET RÉSERVATIONS
  // ─────────────────────────────────────────────────────────────────────────
  if (onglet === 'reservations') return (
    <div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap');`}</style>

      <div className="flex items-center justify-between mb-5">
        <h2 style={{fontFamily:"'DM Serif Display'"}} className="text-2xl text-slate-900 font-normal">
          {afficherHistorique ? 'Historique des réservations reçues' : 'Réservations reçues'}
        </h2>
        <div className="flex items-center gap-2">
          {afficherHistorique && (
            <select value={triHistorique} onChange={e => setTriHistorique(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-sky-400">
              <option value="recent">Plus récent d'abord</option>
              <option value="ancien">Plus ancien d'abord</option>
            </select>
          )}
          <button
            onClick={() => setAfficherHistorique(h => !h)}
            className="text-xs text-slate-500 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors">
            {afficherHistorique ? '📋 Actives seulement' : '🕓 Voir l\'historique'}
          </button>
        </div>
      </div>

      {/* Légende */}
      <div className="bg-sky-50 border border-sky-100 rounded-xl px-4 py-3 mb-5 text-xs text-sky-700">
        <strong>Flux automatique :</strong> les réservations simples sont confirmées automatiquement.
        Seules les réservations avec <strong>services extra</strong> apparaissent en <em>En attente</em> et nécessitent votre validation.
        Cliquez <strong>Terminer</strong> quand le conducteur a quitté le parking.
      </div>

      {chargementRes ? <Spinner /> : reservations.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
          <div className="text-5xl mb-4">📅</div>
          <div className="font-semibold text-slate-700 mb-2">
            {afficherHistorique ? 'Aucune réservation' : 'Aucune réservation active'}
          </div>
          <div className="text-slate-500 text-sm">
            {afficherHistorique
              ? 'Aucune réservation n\'a encore été effectuée sur vos parkings.'
              : 'Les réservations en cours apparaîtront ici.'}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map((res) => {
            const statutCfg   = STATUT_RESERVATION[res.statut] || STATUT_RESERVATION.confirmee;
            const aServices   = res.services_choisis && res.services_choisis.length > 0;
            const serviceEnAttente = res.statut_service === 'en_attente';
            const serviceConfirme  = res.statut_service === 'confirmee';
            const serviceRefuse    = res.statut_service === 'refuse';
            const enAction    = actionEnCours === res.id;

            return (
              <div key={res.id} className={`bg-white border rounded-2xl p-4 transition-colors ${
                serviceEnAttente ? 'border-amber-200' : 'border-slate-200'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    {/* Parking + statut place */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-slate-900 text-sm">{res.parkings?.nom || 'Parking'}</span>
                      {/* Statut place — toujours confirmée */}
                      {res.statut === 'terminee' ? (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                          🏁 Terminé
                        </span>
                      ) : (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                          ✅ Place confirmée
                        </span>
                      )}
                      {/* Statut service */}
                      {serviceEnAttente && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium animate-pulse">
                          ⏳ Service en attente
                        </span>
                      )}
                      {serviceConfirme && (
                        <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium">
                          ✅ Service confirmé
                        </span>
                      )}
                      {serviceRefuse && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                          ❌ Service refusé
                        </span>
                      )}
                    </div>

                    {/* Détails */}
                    <div className="text-xs text-slate-500 space-y-0.5 mb-2">
                      <div>
                        📅 {new Date(res.heure_debut).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' })}
                        {' · '}
                        {new Date(res.heure_debut).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}
                        {' → '}
                        {new Date(res.heure_fin).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}
                      </div>
                      {res.vehicules && (
                        <div>🚗 {res.vehicules.plaque} · {res.vehicules.marque} {res.vehicules.modele} {res.vehicules.couleur && `(${res.vehicules.couleur})`}</div>
                      )}
                      {res.users && (
                        <div>👤 {res.users.prenom} {res.users.nom}{res.users.telephone ? ` · ${res.users.telephone}` : ''}</div>
                      )}
                      {aServices && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {res.services_choisis.map(sId => {
                            const s = SERVICES_META[sId];
                            return s ? (
                              <span key={sId} className="bg-sky-50 text-sky-700 border border-sky-100 px-2 py-0.5 rounded-full text-xs">
                                {s.icon} {s.label}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Montant + actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="font-bold text-sky-600 text-sm">{res.montant_total} MAD</div>

                    {/* Actions service — uniquement si en attente */}
                    {serviceEnAttente && (
                      <div className="flex flex-col gap-1.5">
                        <button
                          disabled={enAction}
                          onClick={async () => {
                            setActionEnCours(res.id);
                            try {
                              await api.patch(`/reservations/${res.id}/confirmer-service`);
                              setReservations(prev => prev.map(r =>
                                r.id === res.id ? { ...r, statut_service: 'confirmee' } : r
                              ));
                            } catch(e) { console.error(e); }
                            finally { setActionEnCours(null); }
                          }}
                          className="text-xs bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap">
                          {enAction ? '…' : '✓ Confirmer le service'}
                        </button>
                        <button
                          disabled={enAction}
                          onClick={async () => {
                            setActionEnCours(res.id);
                            try {
                              await api.patch(`/reservations/${res.id}/refuser-service`);
                              setReservations(prev => prev.map(r =>
                                r.id === res.id ? { ...r, statut_service: 'refuse' } : r
                              ));
                            } catch(e) { console.error(e); }
                            finally { setActionEnCours(null); }
                          }}
                          className="text-xs bg-white hover:bg-red-50 border border-red-200 text-red-500 px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap">
                          {enAction ? '…' : '✗ Indisponible'}
                        </button>
                      </div>
                    )}

                    {/* Terminer — quand tout est réglé */}
                    {res.statut === 'confirmee' && !serviceEnAttente && (
                      <button
                        disabled={enAction}
                        onClick={() => terminerReservation(res.id)}
                        className="text-xs bg-slate-600 hover:bg-slate-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                        {enAction ? '…' : '🏁 Terminer'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

 
  // ─────────────────────────────────────────────────────────────────────────
  // ONGLET PROFIL
  // ─────────────────────────────────────────────────────────────────────────
  if (onglet === 'profil') return (
    <div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap');`}</style>
      <h2 style={{fontFamily:"'DM Serif Display'"}} className="text-2xl text-slate-900 font-normal mb-5">Mon profil</h2>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-sky-400 to-sky-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl">
            {utilisateur?.prenom?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-slate-900 text-lg">{utilisateur?.prenom} {utilisateur?.nom}</div>
            <div className="text-slate-500 text-sm">{utilisateur?.email}</div>
            <div className="inline-flex items-center gap-1 text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full mt-1">
              🏢 Gestionnaire
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (onglet === 'notifications') return (
    <div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap');`}</style>
      <h2 style={{fontFamily:"'DM Serif Display'"}} className="text-2xl text-slate-900 font-normal mb-5">Notifications</h2>
      <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
        <div className="text-5xl mb-4">🔔</div>
        <div className="text-slate-500 text-sm">Aucune notification pour le moment.</div>
      </div>
    </div>
  );

  if (onglet === 'assistance') return (
    <div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap');`}</style>
      <h2 style={{fontFamily:"'DM Serif Display'"}} className="text-2xl text-slate-900 font-normal mb-5">Assistance</h2>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md text-center">
        <div className="text-4xl mb-3">📞</div>
        <div className="font-semibold text-slate-900 mb-2">Besoin d'aide ?</div>
        <div className="text-slate-500 text-sm">Contactez notre équipe au +212 5 22 XX XX XX</div>
      </div>
    </div>
  );

  return null;
};

export default ProfilGestionnaire;
