import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// ─── CONSTANTES ALIGNÉES AVEC GESTIONNAIRE ───────────────────────────────────

const GABARITS_OPTIONS = [
  { val: 'petit', icon: '🚗', label: 'Petit',  exemples: 'Kia Picanto, Hyundai i10, Peugeot 108' },
  { val: 'moyen', icon: '🚙', label: 'Moyen',  exemples: 'Dacia Logan, Renault Clio, Peugeot 308' },
  { val: 'grand', icon: '🚐', label: 'Grand',  exemples: 'Hyundai Tucson, Toyota Prado, BMW X5' },
  { val: 'moto',  icon: '🏍️', label: 'Moto',   exemples: 'Moto, scooter' },
];

const ACCES_OPTIONS = [
  { id: 'pmr', icon: '♿', label: 'Accès PMR' },
];

const SERVICES_LISTE = [
  { id: 'lavage',   icon: '🚿', label: 'Lavage',              unite: 'MAD',     description: 'Lavage et petite maintenance pendant le stationnement' },
  { id: 'recharge', icon: '⚡', label: 'Recharge électrique', unite: 'MAD/kWh', description: 'Bornes de recharge pour véhicules électriques et hybrides' },
  { id: 'valet',    icon: '🤵', label: 'Valet parking',       unite: 'MAD',     description: 'Confiez votre véhicule à un professionnel. Récupérez-le prêt.' },
  { id: 'courses',  icon: '🛒', label: 'Transport de courses',unite: 'MAD',     description: 'Un accompagnateur prend en charge vos courses' },
];

const SERVICES_META = {
  lavage:   { icon: '🚿', label: 'Lavage' },
  recharge: { icon: '⚡', label: 'Recharge électrique' },
  valet:    { icon: '🤵', label: 'Valet parking' },
  courses:  { icon: '🛒', label: 'Transport de courses' },
};

const STATUT_RESERVATION = {
  en_attente: { label: 'En attente',  bg: 'bg-amber-100',   text: 'text-amber-700'   },
  confirmee:  { label: 'Confirmée',   bg: 'bg-emerald-100', text: 'text-emerald-700' },
  terminee:   { label: 'Terminée',    bg: 'bg-slate-100',   text: 'text-slate-500'   },
  annulee:    { label: 'Annulée',     bg: 'bg-red-100',     text: 'text-red-600'     },
};

const parseCoord = (val) => {
  const clean = String(val).replace(',', '.').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
};

const CaptureurPosition = ({ onPosition }) => {
  useMapEvents({ click(e) { onPosition(e.latlng.lat, e.latlng.lng); } });
  return null;
};

const Spinner = () => (
  <div className="flex justify-center py-12">
    <svg className="animate-spin w-6 h-6 text-amber-500" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
    </svg>
  </div>
);

const input  = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-slate-50 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100";
const labelC = "block text-xs font-semibold text-slate-600 mb-1.5";
const serif  = { fontFamily: "'DM Serif Display', serif" };

const reverseGeocode = async (lat, lng) => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
    const data = await res.json();
    if (data?.address) {
      const a = data.address;
      const numero = a.house_number ? `${a.house_number} ` : '';
      const rue = a.road || a.pedestrian || a.footway || '';
      const quartier = a.suburb || a.neighbourhood || a.quarter || '';
      const ville = a.city || a.town || a.village || 'Casablanca';
      return `${numero}${rue}${quartier ? ', ' + quartier : ''}, ${ville}`.trim();
    }
  } catch {}
  return null;
};

const ZoomSurPosition = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, 18, { animate: true, duration: 1 });
  }, [position, map]);
  return null;
};

// ══════════════════════════════════════════════════════════════
// FORMULAIRE MODAL — défini hors du composant principal
// ══════════════════════════════════════════════════════════════
const FormulaireModal = ({
  modeFormulaire, etapeFormulaire, setEtapeFormulaire,
  formZone, setFormZone,
  gabaritsAcceptes, toggleGabarit,
  accesActifs, toggleAcces,
  servicesActifs, toggleService, tarifsServices, setTarifsServices,
  marqueurPos, setMarqueurPos,
  geolocalisation, recupererPosition,
  erreurZone, setErreurZone,
  soumissionZone, succesZone,
  soumettreZone, fermer, pointDebut, setPointDebut,
  pointFin, setPointFin,
  etapeClic, setEtapeClic,
}) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-amber-600 to-amber-400 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 style={serif} className="text-white text-xl font-normal">
            {modeFormulaire === 'creation' ? 'Déclarer ma zone' : 'Modifier ma zone'}
          </h3>
          <p className="text-amber-100 text-xs mt-0.5">
            {modeFormulaire === 'creation' ? 'Renseignez les informations de votre zone' : formZone.nom}
          </p>
        </div>
        <button onClick={fermer} className="text-white/70 hover:text-white text-2xl">✕</button>
      </div>

      {succesZone ? (
        <div className="p-8 text-center">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">✅</div>
          <p className="font-semibold text-slate-700">
            {modeFormulaire === 'creation'
              ? "Zone soumise ! En attente de validation par l'administrateur."
              : 'Zone mise à jour avec succès.'}
          </p>
        </div>
      ) : (
        <form onSubmit={soumettreZone} className="overflow-hidden">

          {/* Barre de progression */}
          <div className="flex px-6 pt-4 gap-2 mb-4">
            {['Localisation', 'Informations'].map((s, i) => (
              <div key={i} className="flex-1">
                <div className={`h-1 rounded-full transition-all ${etapeFormulaire > i ? 'bg-amber-500' : 'bg-slate-200'}`}/>
                <div className={`text-xs mt-1 font-medium ${etapeFormulaire === i + 1 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {i + 1}. {s}
                </div>
              </div>
            ))}
          </div>

          {/* ── ÉTAPE 1 : LOCALISATION ── */}
          {etapeFormulaire === 1 && (
            <div className="px-6 pb-6 space-y-4">
              {/* Instruction dynamique A→B */}
              <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                !pointDebut ? 'bg-amber-50 border border-amber-200 text-amber-800'
                : !pointFin ? 'bg-sky-50 border border-sky-200 text-sky-800'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              }`}>
                {!pointDebut
                  ? '1️⃣ Cliquez sur le début de votre zone (point A)'
                  : !pointFin
                  ? '2️⃣ Cliquez sur la fin de votre zone (point B)'
                  : '✅ Zone délimitée — glissez les points A ou B pour ajuster précisément'}
              </div>

              {/* ── NOUVEAU : bouton GPS pour le point A ── */}
              {!pointDebut && (
                <button type="button" onClick={recupererPosition} disabled={geolocalisation}
                  className="w-full flex items-center justify-center gap-2 border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-50">
                  {geolocalisation
                    ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Récupération en cours…</>
                    : '📍 Utiliser ma position GPS pour le point A'}
                </button>
              )}

              {/* Boutons pour réinitialiser */}
              {(pointDebut || pointFin) && (
                <div className="flex gap-2">
                  {pointDebut && (
                    <button type="button"
                      onClick={() => { setPointDebut(null); setEtapeClic('debut'); setMarqueurPos(null); setFormZone(p => ({...p, latitude:'', longitude:''})); }}
                      className="flex-1 text-xs border border-red-200 text-red-500 py-1.5 rounded-lg hover:bg-red-50">
                      ✕ Effacer point A
                    </button>
                  )}
                  {pointFin && (
                    <button type="button"
                      onClick={() => { setPointFin(null); setEtapeClic('fin'); }}
                      className="flex-1 text-xs border border-red-200 text-red-500 py-1.5 rounded-lg hover:bg-red-50">
                      ✕ Effacer point B
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200"></div>
                <span className="text-xs text-slate-400">ou cliquez sur la carte</span>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>

              <div className="rounded-xl overflow-hidden border-2 border-slate-200 hover:border-amber-300 transition-colors" style={{height: 280}}>
                <MapContainer
                  center={marqueurPos || [33.5731, -7.5898]}
                  zoom={marqueurPos ? 16 : 13}
                  style={{height:'100%', width:'100%'}}
                  key={`gilet-map-${modeFormulaire}`}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap"/>
                  {/* Zoom automatique quand GPS récupéré */}
                  {marqueurPos && <ZoomSurPosition position={marqueurPos} />}
                  <CaptureurPosition onPosition={async (lat, lng) => {
                    if (etapeClic === 'debut' || !pointDebut) {
                      setPointDebut({ lat, lng });
                      setEtapeClic('fin');
                      const adresseAuto = await reverseGeocode(lat, lng);
                      if (adresseAuto) setFormZone(p => ({ ...p, adresse: p.adresse || adresseAuto }));
                    } else {
                      setPointFin({ lat, lng });
                      setEtapeClic('debut');
                    }
                    // Centre de la zone = milieu des deux points si les deux sont définis
                    const debut = etapeClic === 'debut' ? { lat, lng } : pointDebut;
                    const fin   = etapeClic === 'fin'   ? { lat, lng } : pointFin;
                    if (debut && fin) {
                      const centreLat = (debut.lat + fin.lat) / 2;
                      const centreLng = (debut.lng + fin.lng) / 2;
                      setMarqueurPos([centreLat, centreLng]);
                      setFormZone(p => ({ ...p, latitude: centreLat, longitude: centreLng }));
                    } else if (debut) {
                      setMarqueurPos([debut.lat, debut.lng]);
                      setFormZone(p => ({ ...p, latitude: debut.lat, longitude: debut.lng }));
                    }
                  }}/>
                  {marqueurPos && (
                    <Marker position={marqueurPos}
                      icon={L.divIcon({
                        className: '',
                        html: `<div style="background:#f59e0b;width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>`,
                        iconSize: [22, 22], iconAnchor: [11, 11],
                      })}
                    />
                  )}
                  {/* Ligne A→B */}
                  {pointDebut && pointFin && (
                    <Polyline
                      positions={[[pointDebut.lat, pointDebut.lng], [pointFin.lat, pointFin.lng]]}
                      pathOptions={{ color: '#f59e0b', weight: 6, opacity: 0.85 }}
                    />
                  )}

                  {/* Marqueur A — déplaçable */}
                  {pointDebut && (
                    <Marker
                      position={[pointDebut.lat, pointDebut.lng]}
                      draggable={true}
                      eventHandlers={{
                        dragend: (e) => {
                          const { lat, lng } = e.target.getLatLng();
                          setPointDebut({ lat, lng });
                          // Recalcule le centre si B est aussi défini
                          if (pointFin) {
                            const centreLat = (lat + pointFin.lat) / 2;
                            const centreLng = (lng + pointFin.lng) / 2;
                            setMarqueurPos([centreLat, centreLng]);
                            setFormZone(p => ({ ...p, latitude: centreLat, longitude: centreLng }));
                          } else {
                            setMarqueurPos([lat, lng]);
                            setFormZone(p => ({ ...p, latitude: lat, longitude: lng }));
                          }
                        },
                      }}
                      icon={L.divIcon({
                        className: '',
                        html: `<div style="background:#10b981;color:white;width:26px;height:26px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:grab;">A</div>`,
                        iconSize: [26, 26], iconAnchor: [13, 13],
                      })}/>
                  )}

                  {/* Marqueur B — déplaçable */}
                  {pointFin && (
                    <Marker
                      position={[pointFin.lat, pointFin.lng]}
                      draggable={true}
                      eventHandlers={{
                        dragend: (e) => {
                          const { lat, lng } = e.target.getLatLng();
                          setPointFin({ lat, lng });
                          if (pointDebut) {
                            const centreLat = (pointDebut.lat + lat) / 2;
                            const centreLng = (pointDebut.lng + lng) / 2;
                            setMarqueurPos([centreLat, centreLng]);
                            setFormZone(p => ({ ...p, latitude: centreLat, longitude: centreLng }));
                          }
                        },
                      }}
                      icon={L.divIcon({
                        className: '',
                        html: `<div style="background:#ef4444;color:white;width:26px;height:26px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:grab;">B</div>`,
                        iconSize: [26, 26], iconAnchor: [13, 13],
                      })}/>
                  )}
                </MapContainer>
              </div>

              {marqueurPos ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-emerald-800">📍 Zone localisée</div>
                    <div className="text-xs text-emerald-600 mt-0.5">
                      {parseFloat(formZone.latitude).toFixed(5)}, {parseFloat(formZone.longitude).toFixed(5)}
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => { setMarqueurPos(null); setFormZone(p => ({...p, latitude: '', longitude: ''})); }}
                    className="text-red-400 hover:text-red-600 text-xs border border-red-200 px-2 py-1 rounded-lg">
                    ✕ Effacer
                  </button>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500 text-center">
                  Aucun emplacement sélectionné — cliquez sur la carte ou utilisez le GPS
                </div>
              )}

              {erreurZone && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">⚠️ {erreurZone}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={fermer}
                  className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl text-sm font-medium hover:bg-slate-50">
                  Annuler
                </button>
                <button type="button" disabled={!pointDebut || !pointFin}
                  onClick={() => { setErreurZone(''); setEtapeFormulaire(2); }}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 disabled:text-amber-400 text-white py-3 rounded-xl text-sm font-semibold transition-colors">
                  Suivant → Informations
                </button>
              </div>
            </div>
          )}

          {/* ── ÉTAPE 2 : INFORMATIONS ── */}
          {etapeFormulaire === 2 && (
            <div className="max-h-[62vh] overflow-y-auto">
              <div className="px-6 pb-6 space-y-4">

                {/* Rappel position */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-emerald-800">📍 Position enregistrée</div>
                    <div className="text-xs text-emerald-600">
                      {parseFloat(formZone.latitude).toFixed(5)}, {parseFloat(formZone.longitude).toFixed(5)}
                    </div>
                  </div>
                  <button type="button" onClick={() => setEtapeFormulaire(1)}
                    className="text-xs text-amber-600 hover:text-amber-800 border border-amber-200 px-2 py-1 rounded-lg">
                    Modifier
                  </button>
                </div>

                {/* Nom + Adresse */}
                <div>
                  <label className={labelC}>Nom de la zone *</label>
                  <input value={formZone.nom}
                    onChange={e => setFormZone(p => ({...p, nom: e.target.value}))}
                    placeholder="Ex: Zone Maarif Rue Soumaya" className={input}/>
                </div>
                <div>
                  <label className={labelC}>Adresse *</label>
                  <input value={formZone.adresse}
                    onChange={e => setFormZone(p => ({...p, adresse: e.target.value}))}
                    placeholder="Ex: Rue Soumaya, Maarif, Casablanca" className={input}/>
                </div>

                {/* Capacité + Tarifs + Horaires */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelC}>Nombre de places *</label>
                    <input type="number" min="1"
                      value={formZone.capacite_totale}
                      onChange={e => setFormZone(p => ({...p, capacite_totale: e.target.value}))}
                      placeholder="Ex: 20" className={input}/>
                  </div>
                  <div>
                    <label className={labelC}>Tarif horaire (MAD/h)</label>
                    <input type="number" step="0.5" min="0"
                      value={formZone.tarif_horaire}
                      onChange={e => setFormZone(p => ({...p, tarif_horaire: e.target.value}))}
                      placeholder="2" className={input}/>
                  </div>
                  <div>
                    <label className={labelC}>Tarif journalier <span className="font-normal text-slate-400">optionnel</span></label>
                    <input type="number" step="1" min="0"
                      value={formZone.tarif_journalier}
                      onChange={e => setFormZone(p => ({...p, tarif_journalier: e.target.value}))}
                      placeholder="Ex: 30" className={input}/>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelC}>Ouverture</label>
                      <input type="time" value={formZone.horaire_ouverture}
                        onChange={e => setFormZone(p => ({...p, horaire_ouverture: e.target.value}))}
                        className={input}/>
                    </div>
                    <div>
                      <label className={labelC}>Fermeture</label>
                      <input type="time" value={formZone.horaire_fermeture}
                        onChange={e => setFormZone(p => ({...p, horaire_fermeture: e.target.value}))}
                        className={input}/>
                    </div>
                  </div>
                </div>

                {/* Véhicules acceptés — alignés gestionnaire */}
                <div>
                  <label className={labelC}>Véhicules acceptés *</label>
                  <p className="text-xs text-slate-500 mb-2">Cochez tous les types que votre zone peut accueillir.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {GABARITS_OPTIONS.map(g => {
                      const actif = gabaritsAcceptes.includes(g.val);
                      return (
                        <div key={g.val} onClick={() => toggleGabarit(g.val)}
                          className={`cursor-pointer border-2 rounded-xl p-3 transition-all ${
                            actif ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-amber-200'
                          }`}>
                          <div className="flex items-start justify-between mb-1">
                            <span className="text-2xl">{g.icon}</span>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              actif ? 'border-amber-500 bg-amber-500' : 'border-slate-300'
                            }`}>
                              {actif && <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-slate-800">{g.label}</div>
                          <div className="text-xs text-slate-400 mt-0.5 leading-tight">{g.exemples}</div>
                        </div>
                      );
                    })}
                  </div>
                  {gabaritsAcceptes.length === 0 && (
                    <p className="text-red-400 text-xs mt-1">⚠️ Sélectionnez au moins un type de véhicule.</p>
                  )}
                </div>

                {/* Accès PMR */}
                <div>
                  <label className={labelC}>Accès complémentaire <span className="font-normal text-slate-400">optionnel</span></label>
                  {ACCES_OPTIONS.map(a => {
                    const actif = accesActifs.includes(a.id);
                    return (
                      <div key={a.id} onClick={() => toggleAcces(a.id)}
                        className={`cursor-pointer border-2 rounded-xl p-3 flex items-center gap-2 transition-all max-w-xs ${
                          actif ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-amber-200'
                        }`}>
                        <span className="text-xl">{a.icon}</span>
                        <span className="text-sm font-medium text-slate-800">{a.label}</span>
                        {actif && <span className="ml-auto text-amber-500 text-xs font-bold">✓</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Services extra — alignés gestionnaire */}
                <div>
                  <label className={labelC}>Services extra <span className="font-normal text-slate-400">optionnel</span></label>
                  <p className="text-xs text-slate-500 mb-3">Activez les services proposés et définissez leur tarif additionnel.</p>
                  <div className="space-y-2">
                    {SERVICES_LISTE.map(s => {
                      const actif = servicesActifs[s.id] !== undefined;
                      return (
                        <div key={s.id} className={`border-2 rounded-xl p-3 transition-all ${
                          actif ? 'border-amber-500 bg-amber-50' : 'border-slate-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleService(s.id)}>
                              <span className="text-xl">{s.icon}</span>
                              <div>
                                <div className="text-sm font-medium text-slate-800">{s.label}</div>
                                <div className="text-xs text-slate-500">{s.description}</div>
                              </div>
                            </div>
                            <button type="button" onClick={() => toggleService(s.id)}
                              className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ml-2 ${actif ? 'bg-amber-500' : 'bg-slate-200'}`}>
                              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${actif ? 'translate-x-5' : 'translate-x-0.5'}`}/>
                            </button>
                          </div>
                          {actif && (
                            <div className="flex items-center gap-2 mt-2 bg-white border border-amber-200 rounded-lg px-3 py-1.5">
                              <span className="text-xs text-slate-500 flex-1">Tarif additionnel</span>
                              <input type="number" min="0" step={s.id === 'recharge' ? '0.5' : '5'}
                                value={tarifsServices[s.id] ?? 0}
                                onChange={e => setTarifsServices(p => ({...p, [s.id]: e.target.value}))}
                                onClick={e => e.stopPropagation()}
                                className="w-16 text-right text-sm font-semibold text-amber-600 focus:outline-none bg-transparent"/>
                              <span className="text-xs text-slate-500">{s.unite}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className={labelC}>Description de votre zone *</label>
                  <p className="text-xs text-slate-400 mb-1.5">
                    Décrivez votre zone (rue, tronçon, repères), vos horaires habituels, conditions d'accès…
                  </p>
                  <textarea rows={3} value={formZone.description}
                    onChange={e => setFormZone(p => ({...p, description: e.target.value}))}
                    placeholder="Ex: Je gère le tronçon de la Rue Soumaya entre le carrefour Maarif et la boulangerie El Fath, côté droit en montant."
                    className={`${input} resize-none`}/>
                </div>

                {modeFormulaire === 'creation' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">⏳</span>
                    <div>
                      <p className="text-amber-800 text-sm font-semibold">Validation requise</p>
                      <p className="text-amber-700 text-xs mt-0.5">
                        Votre zone sera visible sur la carte après validation par l'administrateur ParkLink.
                      </p>
                    </div>
                  </div>
                )}

                {erreurZone && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">⚠️ {erreurZone}</div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEtapeFormulaire(1)}
                    className="border border-slate-200 text-slate-600 px-5 py-3 rounded-xl text-sm font-medium hover:bg-slate-50">
                    ← Retour
                  </button>
                  <button type="submit" disabled={soumissionZone}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                    {soumissionZone
                      ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      : modeFormulaire === 'creation' ? '✅ Soumettre ma zone' : '💾 Enregistrer'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ══════════════════════════════════════════════════════════════
const ProfilGiletJaune = ({ onglet }) => {
  const { utilisateur } = useAuth();

  // Zone
  const [zone, setZone]                           = useState(null);
  const [chargementZone, setChargementZone]       = useState(false);
  const [formulaireOuvert, setFormulaireOuvert]   = useState(false);
  const [modeFormulaire, setModeFormulaire]       = useState('creation');
  const [etapeFormulaire, setEtapeFormulaire]     = useState(1);

  const formVide = {
    nom: '', adresse: '', latitude: '', longitude: '',
    capacite_totale: '', tarif_horaire: '2', tarif_journalier: '',
    horaire_ouverture: '07:00', horaire_fermeture: '22:00',
    description: '',
  };
  const [formZone, setFormZone]                   = useState(formVide);
  const [gabaritsAcceptes, setGabaritsAcceptes]   = useState(['petit', 'moyen', 'grand']);
  const [accesActifs, setAccesActifs]             = useState([]);
  const [servicesActifs, setServicesActifs]       = useState({});
  const [tarifsServices, setTarifsServices]       = useState({});
  const [marqueurPos, setMarqueurPos]             = useState(null);
  const [pointDebut, setPointDebut] = useState(null);
  const [pointFin, setPointFin]     = useState(null);
  const [etapeClic, setEtapeClic]   = useState('debut'); // 'debut' | 'fin'
  const [erreurZone, setErreurZone]               = useState('');
  const [soumissionZone, setSoumissionZone]       = useState(false);
  const [succesZone, setSuccesZone]               = useState(false);
  const [geolocalisation, setGeolocalisation]     = useState(false);

  // Disponibilités
  const [nouvellesDispo, setNouvellesDispo]       = useState('');
  const [majDispo, setMajDispo]                   = useState(false);
  const [succesDispo, setSuccesDispo]             = useState(false);
  const [statutPresence, setStatutPresence]       = useState('actif');
  const [majPresence, setMajPresence]             = useState(false);

  // Réservations
  const [reservations, setReservations]           = useState([]);
  const [chargementRes, setChargementRes]         = useState(false);
  const [afficherHistorique, setAfficherHistorique] = useState(false);
  const [triHistorique, setTriHistorique]         = useState('recent');
  const [actionEnCours, setActionEnCours]         = useState(null);

  const afficherHistoriqueRef = useRef(afficherHistorique);
  useEffect(() => { afficherHistoriqueRef.current = afficherHistorique; }, [afficherHistorique]);

  useEffect(() => {
    if (['zone', 'reservations'].includes(onglet)) chargerZone();
    if (onglet === 'reservations') {
      chargerReservations();
      const interval = setInterval(() => {
        chargerReservations(afficherHistoriqueRef.current);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [onglet]);

  useEffect(() => {
    if (onglet === 'reservations') chargerReservations();
  }, [afficherHistorique]);

  useEffect(() => {
    if (afficherHistorique && reservations.length > 0) {
      setReservations(prev => [...prev].sort((a, b) => {
        const diff = new Date(b.heure_debut) - new Date(a.heure_debut);
        return triHistorique === 'recent' ? diff : -diff;
      }));
    }
  }, [triHistorique]);

  const chargerZone = async () => {
    setChargementZone(true);
    try {
      const { data } = await api.get('/parkings/mes-parkings');
      const maZone = Array.isArray(data) && data.length > 0 ? data[0] : null;
      setZone(maZone);
      if (maZone) {
        setNouvellesDispo(String(maZone.places_disponibles));
        const s = maZone.services;
        if (s && typeof s === 'object' && !Array.isArray(s)) {
          setServicesActifs({ ...s });
          setTarifsServices({ ...s });
        }
      }
    } catch (err) { console.error(err); }
    finally { setChargementZone(false); }
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
        setReservations(data.filter(r => new Date(r.heure_fin) > maintenant));
      }
    } catch (err) {
      console.error(err);
      setReservations([]);
    } finally {
      setChargementRes(false);
    }
  };

  const ouvrirCreation = () => {
    setModeFormulaire('creation');
    setEtapeFormulaire(1);
    setFormZone(formVide);
    setGabaritsAcceptes(['petit', 'moyen', 'grand']);
    setAccesActifs([]);
    setServicesActifs({});
    setTarifsServices({});
    setMarqueurPos(null);
    setPointDebut(null);
    setPointFin(null);
    setEtapeClic('debut');
    setErreurZone('');
    setSuccesZone(false);
    setFormulaireOuvert(true);
  };

  const ouvrirModification = () => {
    if (!zone) return;
    setModeFormulaire('modification');
    const positionConnue = zone.latitude && zone.longitude;
    setEtapeFormulaire(positionConnue ? 2 : 1);
    setFormZone({
      nom:               zone.nom || '',
      adresse:           zone.adresse || '',
      latitude:          zone.latitude || '',
      longitude:         zone.longitude || '',
      capacite_totale:   zone.capacite_totale || '',
      tarif_horaire:     zone.tarif_horaire || '2',
      tarif_journalier:  zone.tarif_journalier || '',
      horaire_ouverture: zone.horaire_ouverture?.slice(0, 5) || '07:00',
      horaire_fermeture: zone.horaire_fermeture?.slice(0, 5) || '22:00',
      description:       zone.description || '',
    });
    const va = Array.isArray(zone.vehicules_acceptes) ? zone.vehicules_acceptes : [];
    setGabaritsAcceptes(va.filter(v => ['petit', 'moyen', 'grand', 'moto'].includes(v)));
    setAccesActifs(va.filter(v => v === 'pmr'));
    const s = zone.services;
    if (s && typeof s === 'object' && !Array.isArray(s)) {
      setServicesActifs({ ...s });
      setTarifsServices({ ...s });
    } else {
      setServicesActifs({});
      setTarifsServices({});
    }
    setMarqueurPos(positionConnue ? [parseFloat(zone.latitude), parseFloat(zone.longitude)] : null);
      setPointDebut(zone.zone_debut || null);
    setPointFin(zone.zone_fin || null);
    setEtapeClic('debut');
    setErreurZone('');
    setSuccesZone(false);
    setFormulaireOuvert(true);
  };

  const recupererPosition = () => {
    if (!navigator.geolocation) { setErreurZone('Géolocalisation non disponible.'); return; }
    setGeolocalisation(true);
    setErreurZone('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMarqueurPos([lat, lng]);
        setFormZone(p => ({...p, latitude: lat, longitude: lng}));
        // Adresse automatique depuis GPS
        const adresseAuto = await reverseGeocode(lat, lng);
        if (adresseAuto) {
          setFormZone(p => ({ ...p, adresse: p.adresse || adresseAuto }));
        }
        setGeolocalisation(false);
      },
      
      (err) => {
        const msg = {
          1: "Permission refusée. Autorisez la géolocalisation dans votre navigateur.",
          2: 'Position indisponible. Vérifiez votre GPS.',
          3: 'Délai dépassé. Réessayez ou cliquez sur la carte.',
        };
        setErreurZone(msg[err.code] || 'Erreur de géolocalisation.');
        setGeolocalisation(false);
      },
      { timeout: 8000, enableHighAccuracy: false, maximumAge: 30000 }
    );
  };


  const toggleGabarit = (val) => {
    setGabaritsAcceptes(prev => prev.includes(val) ? prev.filter(g => g !== val) : [...prev, val]);
  };

  const toggleAcces = (id) => {
    setAccesActifs(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const toggleService = (id) => {
    if (servicesActifs[id] !== undefined) {
      const a = { ...servicesActifs }; delete a[id]; setServicesActifs(a);
      const t = { ...tarifsServices }; delete t[id]; setTarifsServices(t);
    } else {
      setServicesActifs(p => ({ ...p, [id]: 0 }));
      setTarifsServices(p => ({ ...p, [id]: 0 }));
    }
  };

  const soumettreZone = async (e) => {
    e.preventDefault();
    const lat = parseCoord(formZone.latitude);
    const lng = parseCoord(formZone.longitude);
    if (!formZone.nom || !formZone.adresse) { setErreurZone('Nom et adresse sont obligatoires'); return; }
    if (!lat || !lng) { setErreurZone('Coordonnées invalides. Cliquez sur la carte ou utilisez le GPS.'); return; }
    if (!formZone.capacite_totale || parseInt(formZone.capacite_totale) < 1) { setErreurZone("La capacité doit être d'au moins 1 place"); return; }
    if (gabaritsAcceptes.length === 0) { setErreurZone('Sélectionnez au moins un type de véhicule'); return; }

    const servicesFinaux = {};
    for (const id of Object.keys(servicesActifs)) {
      servicesFinaux[id] = parseFloat(tarifsServices[id]) || 0;
    }
    const vehiculesAcceptesFinal = [...gabaritsAcceptes, ...accesActifs];

    setSoumissionZone(true);
    setErreurZone('');
    try {
      const payload = {
        nom: formZone.nom,
        adresse: formZone.adresse,
        latitude: lat,
        longitude: lng,
        capacite_totale: parseInt(formZone.capacite_totale),
        tarif_horaire: parseFloat(formZone.tarif_horaire) || 2,
        tarif_journalier: formZone.tarif_journalier ? parseFloat(formZone.tarif_journalier) : null,
        horaire_ouverture: formZone.horaire_ouverture,
        horaire_fermeture: formZone.horaire_fermeture,
        description: formZone.description || null,
        services: servicesFinaux,
        vehicules_acceptes: vehiculesAcceptesFinal,
        zone_debut: pointDebut || null,
        zone_fin: pointFin || null,
      };
      if (modeFormulaire === 'creation') {
        await api.post('/parkings/zone-gilet-jaune', payload);
      } else {
        await api.patch(`/parkings/${zone.id}`, payload);
      }
      setSuccesZone(true);
      setTimeout(() => { setFormulaireOuvert(false); setSuccesZone(false); chargerZone(); }, 1500);
    } catch (err) {
      setErreurZone(err.response?.data?.erreur || "Erreur lors de l'enregistrement");
    } finally { setSoumissionZone(false); }
  };

  const mettreAJourDisponibilite = async (val) => {
    if (!zone) return;
    const v = parseInt(val ?? nouvellesDispo);
    if (isNaN(v) || v < 0 || v > zone.capacite_totale) return;
    setMajDispo(true);
    try {
      await api.patch(`/parkings/${zone.id}/disponibilite`, { places_disponibles: v });
      setZone(prev => ({ ...prev, places_disponibles: v }));
      setNouvellesDispo(String(v));
      setSuccesDispo(true);
      setTimeout(() => setSuccesDispo(false), 2500);
    } catch (err) { console.error(err); }
    finally { setMajDispo(false); }
  };

  const togglePresence = async () => {
    if (!zone) return;
    const nouveau = statutPresence === 'actif' ? 'absent' : 'actif';
    setMajPresence(true);
    try {
      if (nouveau === 'absent') {
        await api.patch(`/parkings/${zone.id}/disponibilite`, { places_disponibles: 0 });
        setZone(prev => ({ ...prev, places_disponibles: 0 }));
      } else {
        const restore = parseInt(nouvellesDispo) || zone.capacite_totale;
        await api.patch(`/parkings/${zone.id}/disponibilite`, { places_disponibles: restore });
        setZone(prev => ({ ...prev, places_disponibles: restore }));
      }
      setStatutPresence(nouveau);
    } catch (err) { console.error(err); }
    finally { setMajPresence(false); }
  };

  const terminerReservation = async (id) => {
    setActionEnCours(id);
    try {
      await api.patch(`/reservations/${id}/terminer`);
      setReservations(prev => prev.filter(r => r.id !== id));
    } catch (err) { console.error(err); }
    finally { setActionEnCours(null); }
  };

  const confirmerService = async (id) => {
    setActionEnCours(id + '_svc');
    try {
      await api.patch(`/reservations/${id}/confirmer-service`);
      setReservations(prev => prev.map(r => r.id === id ? { ...r, statut_service: 'confirmee' } : r));
    } catch (err) { console.error(err); }
    finally { setActionEnCours(null); }
  };

  const refuserService = async (id) => {
    setActionEnCours(id + '_ref');
    try {
      await api.patch(`/reservations/${id}/refuser-service`);
      setReservations(prev => prev.map(r => r.id === id ? { ...r, statut_service: 'refuse' } : r));
    } catch (err) { console.error(err); }
    finally { setActionEnCours(null); }
  };

  // ══════════════════════════════════════
  // ONGLET ZONE (fusion zone + disponibilités)
  // ══════════════════════════════════════
  if (onglet === 'zone') return (
    <div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap');`}</style>

      <div className="flex items-center justify-between mb-5">
        <h2 style={serif} className="text-2xl text-slate-900 font-normal">Ma zone</h2>
        {zone && (
          <button onClick={ouvrirModification}
            className="text-amber-600 text-xs font-medium border border-amber-200 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
            ✏️ Modifier
          </button>
        )}
      </div>

      {chargementZone ? <Spinner /> : !zone ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
          <div className="text-5xl mb-4">🦺</div>
          <div className="font-semibold text-slate-700 mb-2">Aucune zone déclarée</div>
          <div className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
            Déclarez votre zone pour apparaître sur la carte ParkLink et recevoir des réservations.
          </div>
          <button onClick={ouvrirCreation}
            className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            + Déclarer ma zone
          </button>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Statut validation */}
          {zone.statut === 'en_attente_validation' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
              <span className="text-xl">⏳</span>
              <div>
                <p className="text-amber-800 text-sm font-semibold">En attente de validation</p>
                <p className="text-amber-700 text-xs mt-0.5">Votre zone sera visible sur la carte après validation par l'administrateur.</p>
              </div>
            </div>
          )}
          {zone.statut === 'actif' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
              <span>✅</span>
              <p className="text-emerald-800 text-sm font-semibold">Zone active — visible sur la carte</p>
            </div>
          )}

          {/* Fiche zone */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">{zone.nom}</h3>
                  <p className="text-slate-500 text-xs mt-0.5">{zone.adresse}</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    📍 {parseFloat(zone.latitude).toFixed(5)}, {parseFloat(zone.longitude).toFixed(5)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    statutPresence === 'actif' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {statutPresence === 'actif' ? '🟢 Présent' : '🔴 Absent'}
                  </span>
                  <button onClick={togglePresence} disabled={majPresence}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                      statutPresence === 'actif'
                        ? 'border-red-200 text-red-500 hover:bg-red-50'
                        : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                    }`}>
                    {majPresence ? '…' : statutPresence === 'actif' ? 'Signaler mon absence' : 'Je suis de retour'}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <div className="font-bold text-amber-600">{zone.tarif_horaire} MAD</div>
                  <div className="text-slate-500 text-xs">par heure</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className="font-bold text-slate-700 text-sm">{zone.horaire_ouverture?.slice(0,5)} – {zone.horaire_fermeture?.slice(0,5)}</div>
                  <div className="text-slate-500 text-xs">Horaires</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className={`font-bold ${zone.places_disponibles > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {zone.places_disponibles}/{zone.capacite_totale}
                  </div>
                  <div className="text-slate-500 text-xs">places libres</div>
                </div>
              </div>

              {/* Services */}
              {(() => {
                const s = zone.services;
                const obj = (s && typeof s === 'object' && !Array.isArray(s)) ? s : {};
                const ids = Object.keys(obj);
                if (ids.length === 0) return null;
                return (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Services</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ids.map(id => {
                        const meta = SERVICES_META[id];
                        return (
                          <span key={id} className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2 py-1 rounded-full">
                            {meta?.icon} {meta?.label || id}
                            {obj[id] > 0 && <span className="font-semibold">· +{obj[id]} MAD</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {zone.description && (
                <div className="bg-slate-50 rounded-xl p-3 mb-4">
                  <p className="text-xs text-slate-600 leading-relaxed">{zone.description}</p>
                </div>
              )}

              
              
    
            </div>
          </div>

          
          {/* ── BLOC DISPONIBILITÉS SIMPLIFIÉ ── */}
          {zone.statut === 'actif' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">Places disponibles</h3>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Modifiez si des véhicules ont été garés sans réservation ParkLink.
                  </p>
                </div>
                <div className={`text-2xl font-bold ${zone.places_disponibles > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {zone.places_disponibles}
                  <span className="text-sm font-normal text-slate-400"> / {zone.capacite_totale}</span>
                </div>
              </div>

              <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
                <div className={`h-2 rounded-full transition-all ${
                  zone.places_disponibles / zone.capacite_totale > 0.3 ? 'bg-emerald-500' : 'bg-red-500'
                }`} style={{width:`${Math.max(2,(zone.places_disponibles/zone.capacite_totale)*100)}%`}}/>
              </div>

              <div className="flex items-center gap-3">
                <input type="number" min="0" max={zone.capacite_totale}
                  value={nouvellesDispo}
                  onChange={e => setNouvellesDispo(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-center font-bold focus:outline-none focus:border-amber-400"/>
                <span className="text-slate-400 text-sm">/ {zone.capacite_totale}</span>
                <button onClick={() => mettreAJourDisponibilite()} disabled={majDispo}
                  className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
                  {majDispo
                    ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    : '✓ Mettre à jour'}
                </button>
              </div>

              {succesDispo && (
                <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-4 py-2.5 rounded-xl">
                  ✅ Disponibilité mise à jour.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {formulaireOuvert && (
        <FormulaireModal
          modeFormulaire={modeFormulaire}
          etapeFormulaire={etapeFormulaire}
          setEtapeFormulaire={setEtapeFormulaire}
          formZone={formZone}
          setFormZone={setFormZone}
          gabaritsAcceptes={gabaritsAcceptes}
          toggleGabarit={toggleGabarit}
          accesActifs={accesActifs}
          toggleAcces={toggleAcces}
          servicesActifs={servicesActifs}
          toggleService={toggleService}
          tarifsServices={tarifsServices}
          setTarifsServices={setTarifsServices}
          marqueurPos={marqueurPos}
          setMarqueurPos={setMarqueurPos}
          geolocalisation={geolocalisation}
          recupererPosition={recupererPosition}
          erreurZone={erreurZone}
          setErreurZone={setErreurZone}
          soumissionZone={soumissionZone}
          succesZone={succesZone}
          soumettreZone={soumettreZone}
          fermer={() => setFormulaireOuvert(false)}
          pointDebut={pointDebut}
          setPointDebut={setPointDebut}
          pointFin={pointFin}
          setPointFin={setPointFin}
          etapeClic={etapeClic}
          setEtapeClic={setEtapeClic}
        />
      )}
    </div>
  );

  // ══════════════════════════════════════
  // ONGLET RÉSERVATIONS REÇUES
  // ══════════════════════════════════════
  if (onglet === 'reservations') return (
    <div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap');`}</style>

      <div className="flex items-center justify-between mb-5">
        <h2 style={serif} className="text-2xl text-slate-900 font-normal">
          {afficherHistorique ? 'Historique des réservations' : 'Réservations reçues'}
        </h2>
        <div className="flex items-center gap-2">
          {afficherHistorique && (
            <select value={triHistorique} onChange={e => setTriHistorique(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-amber-400">
              <option value="recent">Plus récent d'abord</option>
              <option value="ancien">Plus ancien d'abord</option>
            </select>
          )}
          <button
            onClick={() => setAfficherHistorique(h => !h)}
            className="text-xs text-slate-500 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors">
            {afficherHistorique ? '📋 Actives seulement' : "🕓 Voir l'historique"}
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-5 text-xs text-amber-700">
        <strong>Flux automatique :</strong> les réservations simples sont confirmées automatiquement.
        Seules celles avec <strong>services extra</strong> apparaissent en <em>En attente</em> et nécessitent votre validation.
        Cliquez <strong>Terminer</strong> quand le conducteur a quitté votre zone.
      </div>

      {chargementRes ? <Spinner /> : reservations.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
          <div className="text-5xl mb-4">📅</div>
          <div className="font-semibold text-slate-700 mb-2">
            {afficherHistorique ? 'Aucune réservation' : 'Aucune réservation active'}
          </div>
          <div className="text-slate-500 text-sm">
            {afficherHistorique
              ? "Aucune réservation n'a encore été effectuée sur votre zone."
              : 'Les réservations en cours apparaîtront ici.'}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map((res) => {
            const aServices        = res.services_choisis && res.services_choisis.length > 0;
            const serviceEnAttente = res.statut_service === 'en_attente';
            const serviceConfirme  = res.statut_service === 'confirmee';
            const serviceRefuse    = res.statut_service === 'refuse';
            const enAction         = actionEnCours === res.id;
            const enActionSvc      = actionEnCours === res.id + '_svc' || actionEnCours === res.id + '_ref';

            return (
              <div key={res.id} className={`bg-white border rounded-2xl p-4 transition-colors ${
                serviceEnAttente ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-slate-900 text-sm">{res.parkings?.nom || 'Ma zone'}</span>
                      {res.statut === 'terminee' ? (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">🏁 Terminé</span>
                      ) : (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">✅ Place confirmée</span>
                      )}
                      {serviceEnAttente && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium animate-pulse">⏳ Service en attente</span>
                      )}
                      {serviceConfirme && (
                        <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium">✅ Service confirmé</span>
                      )}
                      {serviceRefuse && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">❌ Service refusé</span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 space-y-0.5 mb-2">
                      <div>
                        📅 {new Date(res.heure_debut).toLocaleDateString('fr-FR', {day:'2-digit', month:'short'})}
                        {' · '}
                        {new Date(res.heure_debut).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}
                        {' → '}
                        {new Date(res.heure_fin).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}
                      </div>
                      {res.vehicules && (
                        <div>🚗 {res.vehicules.plaque} · {res.vehicules.marque} {res.vehicules.modele}{res.vehicules.couleur ? ` (${res.vehicules.couleur})` : ''}</div>
                      )}
                      {res.users && (
                        <div>👤 {res.users.prenom} {res.users.nom}{res.users.telephone ? ` · ${res.users.telephone}` : ''}</div>
                      )}
                      {aServices && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {res.services_choisis.map(sId => {
                            const s = SERVICES_META[sId];
                            return s ? (
                              <span key={sId} className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full text-xs">
                                {s.icon} {s.label}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="font-bold text-amber-600 text-sm">{res.montant_total} MAD</div>

                    {serviceEnAttente && (
                      <div className="flex flex-col gap-1.5">
                        <button disabled={enActionSvc} onClick={() => confirmerService(res.id)}
                          className="text-xs bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap">
                          {actionEnCours === res.id + '_svc' ? '…' : '✓ Confirmer le service'}
                        </button>
                        <button disabled={enActionSvc} onClick={() => refuserService(res.id)}
                          className="text-xs bg-white hover:bg-red-50 border border-red-200 text-red-500 px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap">
                          {actionEnCours === res.id + '_ref' ? '…' : '✗ Indisponible'}
                        </button>
                      </div>
                    )}

                    {res.statut === 'confirmee' && !serviceEnAttente && (
                      <button disabled={enAction} onClick={() => terminerReservation(res.id)}
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

  // ══════════════════════════════════════
  // ONGLETS STATIQUES
  // ══════════════════════════════════════
  if (onglet === 'profil') return (
    <div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap');`}</style>
      <h2 style={serif} className="text-2xl text-slate-900 font-normal mb-5">Mon profil</h2>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl">
            {utilisateur?.prenom?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-slate-900 text-lg">{utilisateur?.prenom} {utilisateur?.nom}</div>
            <div className="text-slate-500 text-sm">{utilisateur?.email}</div>
            <div className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full mt-1">
              🦺 Gilet jaune
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (onglet === 'notifications') return (
    <div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap');`}</style>
      <h2 style={serif} className="text-2xl text-slate-900 font-normal mb-5">Notifications</h2>
      <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
        <div className="text-5xl mb-4">🔔</div>
        <div className="text-slate-500 text-sm">Aucune notification pour le moment.</div>
      </div>
    </div>
  );

  if (onglet === 'assistance') return (
    <div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap');`}</style>
      <h2 style={serif} className="text-2xl text-slate-900 font-normal mb-5">Assistance</h2>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md text-center">
        <div className="text-4xl mb-3">📞</div>
        <div className="font-semibold text-slate-900 mb-2">Besoin d'aide ?</div>
        <div className="text-slate-500 text-sm">Contactez notre équipe au +212 5 22 XX XX XX</div>
      </div>
    </div>
  );

  return null;
};

export default ProfilGiletJaune;