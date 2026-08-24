import { useState } from 'react';
import api from '../../services/api';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

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

const INFRASTRUCTURE = [
  { val: 'surface',    icon: '☀️', label: 'Parking en surface' },
  { val: 'souterrain', icon: '⬇️', label: 'Souterrain / en ouvrage' },
  { val: 'residentiel',icon: '🏘️', label: 'Résidentiel & immeubles' },
  { val: 'relais',     icon: '🚌', label: 'Parking relais (P+R)' },
];

const MODE_GESTION = [
  { val: 'public', icon: '🏛️', label: 'Parking public' },
  { val: 'prive',  icon: '🔒', label: 'Parking privé' },
];

const parseCoord = (val) => {
  const clean = String(val).replace(',', '.').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
};

const CaptureurClic = ({ onClic }) => {
  useMapEvents({ click(e) { onClic(e.latlng.lat, e.latlng.lng); } });
  return null;
};

// Carte réutilisable pour les modes "position" et "carte"
const CarteLocalisation = ({ centre, zoom, marqueurPos, onClic, modeCliquable = false }) => (
  <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: 240 }}>
    <MapContainer
      center={centre}
      zoom={zoom}
      style={{ height: '100%', width: '100%' }}
      key={`map-${centre[0]}-${centre[1]}`}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
      {modeCliquable && 
        <CaptureurClic onClic={async (lat, lng) => {
          setMarqueurPos([lat, lng]);
          setForm(prev => ({ ...prev, latitude: lat, longitude: lng, source_coords: 'manuel' }));
          // Remplissage automatique de l'adresse
          const adresseAuto = await reverseGeocode(lat, lng);
          if (adresseAuto) {
            setForm(prev => ({
              ...prev,
              adresse: adresseAuto,
              // Si le nom est vide, propose un nom par défaut
              nom: prev.nom || '',
            }));
          }
        }}/>
      }
      {marqueurPos && (
        <Marker
          position={marqueurPos}
          icon={L.divIcon({
            className: '',
            html: `<div style="background:#0ea5e9;width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          })}
        />
      )}
    </MapContainer>
  </div>
);

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

const FormulaireAjoutParking = ({ onFermer, onSucces }) => {
  const [etape, setEtape] = useState(1);
  const [chargementOSM, setChargementOSM] = useState(false);
  const [suggestionsOSM, setSuggestionsOSM] = useState([]);
  const [rechercheOSM, setRechercheOSM] = useState('');
  const [chargementSoumission, setChargementSoumission] = useState(false);
  const [erreur, setErreur] = useState('');
  const [marqueurPos, setMarqueurPos] = useState(null);

  // 3 modes : 'osm' | 'position' | 'carte'
  const [modeLocalisation, setModeLocalisation] = useState('osm');
  const [chargementGPS, setChargementGPS] = useState(false);
  const [erreurGPS, setErreurGPS] = useState('');

  const [servicesActifs, setServicesActifs] = useState({});
  const [tarifsServices, setTarifsServices] = useState({});
  const [gabaritsAcceptes, setGabaritsAcceptes] = useState(['petit', 'moyen', 'grand']);
  const [accesActifs, setAccesActifs] = useState([]);

  const [form, setForm] = useState({
    nom: '', adresse: '', latitude: '', longitude: '',
    osm_id: '', source_coords: 'manuel',
    infrastructure: 'surface', mode_gestion: 'public',
    capacite_totale: '', tarif_horaire: '', tarif_journalier: '',
    horaire_ouverture: '08:00', horaire_fermeture: '22:00',
    source_disponibilite: 'manuel', api_url: '',
    hauteur_limite: '', description: '',
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErreur('');
  };

  // ── GPS ────────────────────────────────────────────────────────────────────
  const recupererPosition = () => {
    if (!navigator.geolocation) {
      setErreurGPS("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    setChargementGPS(true);
    setErreurGPS('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMarqueurPos([lat, lng]);
        setForm(prev => ({ ...prev, latitude: lat, longitude: lng, source_coords: 'gps' }));
        setChargementGPS(false);
      },
      (err) => {
        setChargementGPS(false);
        if (err.code === 1) {
          setErreurGPS("Permission refusée. Autorisez la géolocalisation dans votre navigateur.");
        } else if (err.code === 2) {
          setErreurGPS("Position introuvable. Vérifiez que le GPS est activé.");
        } else {
          setErreurGPS("Délai dépassé. Réessayez dans un endroit dégagé.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const effacerPosition = () => {
    setMarqueurPos(null);
    setForm(prev => ({ ...prev, latitude: '', longitude: '', source_coords: 'manuel' }));
    setErreurGPS('');
  };

  // ── OSM ────────────────────────────────────────────────────────────────────
  const rechercherOSM = async () => {
    if (!rechercheOSM.trim()) return;
    setChargementOSM(true);
    setSuggestionsOSM([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(rechercheOSM + ' Casablanca Maroc')}&format=json&limit=6&addressdetails=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
      const data = await res.json();
      setSuggestionsOSM(data);
    } catch {
      setErreur('Erreur de recherche — vérifiez votre connexion');
    } finally {
      setChargementOSM(false);
    }
  };

  const selectionnerOSM = (lieu) => {
    setForm({
      ...form,
      nom: lieu.display_name.split(',')[0],
      adresse: lieu.display_name,
      latitude: parseFloat(lieu.lat),
      longitude: parseFloat(lieu.lon),
      osm_id: `${lieu.osm_type}/${lieu.osm_id}`,
      source_coords: 'osm',
    });
    setSuggestionsOSM([]);
    setRechercheOSM(lieu.display_name.split(',')[0]);
  };

  // ── Changement d'onglet — réinitialise la position ────────────────────────
  const changerMode = (mode) => {
    setModeLocalisation(mode);
    setMarqueurPos(null);
    setErreurGPS('');
    setForm(prev => ({
      ...prev,
      latitude: '',
      longitude: '',
      source_coords: 'manuel',
      osm_id: '',
    }));
    setSuggestionsOSM([]);
    setRechercheOSM('');
  };



  // ── Validation étape 1 ────────────────────────────────────────────────────
  const validerEtape1 = () => {
    if (!form.nom.trim() || !form.adresse.trim()) {
      setErreur("Veuillez renseigner le nom et l'adresse du parking");
      return;
    }
    const lat = parseCoord(form.latitude);
    const lng = parseCoord(form.longitude);
    if (!lat || !lng || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      if (modeLocalisation === 'position') {
        setErreur("Récupérez votre position GPS avant de continuer.");
      } else if (modeLocalisation === 'carte') {
        setErreur("Cliquez sur la carte pour placer le marqueur de votre parking.");
      } else {
        setErreur("Sélectionnez un résultat OSM ou passez en mode carte / position GPS.");
      }
      return;
    }
    setForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
    setErreur('');
    setEtape(2);
  };

  const validerEtape2 = () => {
    if (!form.capacite_totale || !form.tarif_horaire) {
      setErreur('La capacité et le tarif horaire sont obligatoires');
      return;
    }
    if (gabaritsAcceptes.length === 0) {
      setErreur('Sélectionnez au moins un type de véhicule accepté');
      return;
    }
    setErreur('');
    setEtape(3);
  };

  const toggleGabarit = (val) => {
    setGabaritsAcceptes(prev =>
      prev.includes(val) ? prev.filter(g => g !== val) : [...prev, val]
    );
  };

  const toggleAcces = (id) => {
    setAccesActifs(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const toggleService = (id) => {
    if (servicesActifs[id] !== undefined) {
      const updated = { ...servicesActifs };
      delete updated[id];
      setServicesActifs(updated);
      const t = { ...tarifsServices };
      delete t[id];
      setTarifsServices(t);
    } else {
      setServicesActifs(prev => ({ ...prev, [id]: 0 }));
      setTarifsServices(prev => ({ ...prev, [id]: 0 }));
    }
  };

  const mettreAJourTarif = (id, val) => {
    setTarifsServices(prev => ({ ...prev, [id]: val }));
  };

  const soumettre = async () => {
    setChargementSoumission(true);
    setErreur('');
    const servicesFinaux = {};
    for (const id of Object.keys(servicesActifs)) {
      servicesFinaux[id] = parseFloat(tarifsServices[id]) || 0;
    }
    const vehiculesAcceptesFinal = [...gabaritsAcceptes, ...accesActifs];
    try {
      await api.post('/parkings', {
        ...form,
        latitude: parseCoord(form.latitude),
        longitude: parseCoord(form.longitude),
        capacite_totale: parseInt(form.capacite_totale),
        tarif_horaire: parseFloat(form.tarif_horaire),
        tarif_journalier: form.tarif_journalier ? parseFloat(form.tarif_journalier) : null,
        hauteur_limite: form.hauteur_limite ? parseFloat(form.hauteur_limite) : null,
        description: form.description || null,
        api_url: form.api_url || null,
        services: servicesFinaux,
        vehicules_acceptes: vehiculesAcceptesFinal,
      });
      onSucces();
    } catch (err) {
      setErreur(err.response?.data?.erreur || "Erreur lors de l'ajout");
    } finally {
      setChargementSoumission(false);
    }
  };

  const input = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-slate-50 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-100";
  const label = "block text-xs font-semibold text-slate-600 mb-1.5";
  const etapeLabels = ['Localisation', 'Informations', 'Confirmation'];

  // Centre de carte par défaut — Casablanca
  const centreCasa = [33.5731, -7.5898];
  const centreActuel = marqueurPos || centreCasa;
  const zoomActuel = marqueurPos ? 17 : 13;

  // Badges source pour le récap
  const sourceBadge = {
    osm:    { icon: '🗺️', label: 'OpenStreetMap' },
    gps:    { icon: '📡', label: 'Position GPS' },
    manuel: { icon: '🖱️', label: 'Pointé sur la carte' },
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap');`}</style>
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-sky-700 to-sky-500 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 style={{ fontFamily: "'DM Serif Display'" }} className="text-white text-xl font-normal">Ajouter un parking</h2>
            <p className="text-sky-100 text-xs mt-0.5">Étape {etape}/3 — {etapeLabels[etape - 1]}</p>
          </div>
          <button onClick={onFermer} className="text-white/70 hover:text-white text-2xl">✕</button>
        </div>

        {/* Barre de progression */}
        <div className="flex">
          {[1, 2, 3].map(n => (
            <div key={n} className={`flex-1 h-1 transition-all ${n <= etape ? 'bg-sky-500' : 'bg-slate-200'}`} />
          ))}
        </div>

        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4">

          {/* ── ÉTAPE 1 : LOCALISATION ── */}
          {etape === 1 && (
            <>
              <p className="text-sm text-slate-500">
                Choisissez comment localiser votre parking parmi les trois options ci-dessous.
              </p>

              {/* Sélecteur de mode — 3 onglets */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
                {[
                  { val: 'osm',      icon: '🔍', label: 'OSM' },
                  { val: 'position', icon: '📡', label: 'Ma position' },
                  { val: 'carte',    icon: '🖱️', label: 'Sur la carte' },
                ].map(m => (
                  <button key={m.val} type="button"
                    onClick={() => changerMode(m.val)}
                    className={`py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                      modeLocalisation === m.val
                        ? 'bg-white text-sky-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>

              {/* ── MODE OSM ── */}
              {modeLocalisation === 'osm' && (
                <div className="space-y-3">
                  <div>
                    <label className={label}>Rechercher sur OpenStreetMap</label>
                    <div className="flex gap-2">
                      <input type="text" placeholder="Nom du parking ou adresse..."
                        value={rechercheOSM}
                        onChange={e => setRechercheOSM(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && rechercherOSM()}
                        className={input} />
                      <button onClick={rechercherOSM} disabled={chargementOSM} type="button"
                        className="flex-shrink-0 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:bg-sky-300 transition-colors">
                        {chargementOSM
                          ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                          : 'Chercher'}
                      </button>
                    </div>

                    {suggestionsOSM.length > 0 && (
                      <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden shadow-lg max-h-48 overflow-y-auto">
                        {suggestionsOSM.map((lieu, i) => (
                          <button key={i} type="button" onClick={() => selectionnerOSM(lieu)}
                            className="w-full text-left px-4 py-3 text-sm hover:bg-sky-50 border-b border-slate-100 last:border-0 transition-colors">
                            <div className="font-medium text-slate-900 truncate">{lieu.display_name.split(',')[0]}</div>
                            <div className="text-slate-400 text-xs truncate">{lieu.display_name}</div>
                          </button>
                        ))}
                      </div>
                    )}

                    {form.source_coords === 'osm' && form.latitude && (
                      <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                        <div className="font-semibold text-emerald-800 text-sm">✓ {form.nom}</div>
                        <div className="text-emerald-600 text-xs mt-0.5">{form.adresse}</div>
                        <div className="text-emerald-500 text-xs mt-1">📍 {Number(form.latitude).toFixed(5)}, {Number(form.longitude).toFixed(5)}</div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className={label}>Nom du parking *</label>
                    <input name="nom" value={form.nom} onChange={handleChange}
                      placeholder="Ex: Parking Maarif Centre" className={input} />
                  </div>
                  <div>
                    <label className={label}>Adresse *</label>
                    <input name="adresse" value={form.adresse} onChange={handleChange}
                      placeholder="Ex: Rue Soumaya, Maarif, Casablanca" className={input} />
                  </div>
                </div>
              )}

              {/* ── MODE POSITION GPS ── */}
              {modeLocalisation === 'position' && (
                <div className="space-y-3">
                  <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-center">
                    <div className="text-3xl mb-2">📡</div>
                    <p className="text-slate-700 text-sm font-medium mb-1">Vous êtes dans votre parking ?</p>
                    <p className="text-slate-500 text-xs mb-4">
                      Appuyez sur le bouton pour capturer votre position GPS exacte. Restez immobile quelques secondes pour une meilleure précision.
                    </p>

                    {!marqueurPos ? (
                      <button type="button" onClick={recupererPosition} disabled={chargementGPS}
                        className="bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 mx-auto">
                        {chargementGPS ? (
                          <>
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            <span>Localisation en cours…</span>
                          </>
                        ) : (
                          <>
                            <span>📍</span>
                            <span>Récupérer ma position</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-semibold">
                          ✓ Position récupérée
                        </div>
                        <div className="text-xs text-slate-500">
                          {Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)}
                        </div>
                        <button type="button" onClick={effacerPosition}
                          className="text-xs text-red-400 hover:text-red-600 underline">
                          Effacer et réessayer
                        </button>
                      </div>
                    )}

                    {erreurGPS && (
                      <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-600">
                        ⚠️ {erreurGPS}
                      </div>
                    )}
                  </div>

                  {/* Carte de confirmation — s'affiche une fois la position récupérée */}
                  {marqueurPos && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2">
                        Vérifiez que le marqueur correspond bien à l'entrée de votre parking. Vous pouvez cliquer sur la carte pour l'ajuster.
                      </p>
                      <CarteLocalisation
                        centre={centreActuel}
                        zoom={zoomActuel}
                        marqueurPos={marqueurPos}
                        modeCliquable={true}
                        onClic={(lat, lng) => {
                          setMarqueurPos([lat, lng]);
                          setForm(prev => ({ ...prev, latitude: lat, longitude: lng, source_coords: 'gps' }));
                        }}
                      />
                      <p className="text-xs text-slate-400 mt-1 text-center">
                        Cliquez sur la carte pour affiner l'emplacement si nécessaire
                      </p>
                    </div>
                  )}

                  <div>
                    <label className={label}>Nom du parking *</label>
                    <input name="nom" value={form.nom} onChange={handleChange}
                      placeholder="Ex: Parking Maarif Centre" className={input} />
                  </div>
                  <div>
                    <label className={label}>Adresse *</label>
                    <input name="adresse" value={form.adresse} onChange={handleChange}
                      placeholder="Ex: Rue Soumaya, Maarif, Casablanca" className={input} />
                  </div>
                </div>
              )}

              {/* ── MODE CARTE (clic libre) ── */}
              {modeLocalisation === 'carte' && (
                <div className="space-y-3">
                  <div>
                    <label className={label}>Cliquez sur la carte pour placer votre parking</label>
                    <p className="text-xs text-slate-500 mb-2">
                      Naviguez et zoomez sur votre parking, puis cliquez sur son emplacement exact.
                    </p>
                    <CarteLocalisation
                      centre={centreActuel}
                      zoom={zoomActuel}
                      marqueurPos={marqueurPos}
                      modeCliquable={true}
                      onClic={(lat, lng) => {
                        setMarqueurPos([lat, lng]);
                        setForm(prev => ({ ...prev, latitude: lat, longitude: lng, source_coords: 'manuel' }));
                      }}
                    />
                  </div>

                  {marqueurPos ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 flex items-center justify-between text-xs text-emerald-700">
                      <span>✓ {Number(form.latitude).toFixed(5)}, {Number(form.longitude).toFixed(5)}</span>
                      <button type="button" onClick={effacerPosition}
                        className="text-red-400 hover:text-red-600 ml-2">
                        ✕ Effacer
                      </button>
                    </div>
                  ) : (
                    <div className="bg-sky-50 border border-sky-100 rounded-xl px-3 py-2 text-xs text-slate-500">
                      👆 Cliquez sur la carte ci-dessus pour placer le marqueur
                    </div>
                  )}

                  <div>
                    <label className={label}>Nom du parking *</label>
                    <input name="nom" value={form.nom} onChange={handleChange}
                      placeholder="Ex: Parking Maarif Centre" className={input} />
                  </div>
                  <div>
                    <label className={label}>Adresse *</label>
                    <input name="adresse" value={form.adresse} onChange={handleChange}
                      placeholder="Ex: Rue Soumaya, Maarif, Casablanca" className={input} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── ÉTAPE 2 : INFORMATIONS ── */}
          {etape === 2 && (
            <>
              <div>
                <label className={label}>Type d'infrastructure *</label>
                <div className="grid grid-cols-2 gap-2">
                  {INFRASTRUCTURE.map(opt => (
                    <div key={opt.val} onClick={() => setForm({ ...form, infrastructure: opt.val })}
                      className={`cursor-pointer border-2 rounded-xl p-3 flex items-center gap-2 transition-all ${
                        form.infrastructure === opt.val ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-sky-200'
                      }`}>
                      <span className="text-xl flex-shrink-0">{opt.icon}</span>
                      <span className="text-xs font-medium text-slate-800">{opt.label}</span>
                      {form.infrastructure === opt.val && (
                        <div className="ml-auto w-4 h-4 bg-sky-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className={label}>Mode de gestion *</label>
                <div className="grid grid-cols-2 gap-2">
                  {MODE_GESTION.map(opt => (
                    <div key={opt.val} onClick={() => setForm({ ...form, mode_gestion: opt.val })}
                      className={`cursor-pointer border-2 rounded-xl p-3 flex items-center gap-2 transition-all ${
                        form.mode_gestion === opt.val ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-sky-200'
                      }`}>
                      <span className="text-xl flex-shrink-0">{opt.icon}</span>
                      <span className="text-xs font-medium text-slate-800">{opt.label}</span>
                      {form.mode_gestion === opt.val && (
                        <div className="ml-auto w-4 h-4 bg-sky-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Capacité totale (places) *</label>
                  <input name="capacite_totale" type="number" min="1"
                    value={form.capacite_totale} onChange={handleChange} placeholder="Ex: 120" className={input} />
                </div>
                <div>
                  <label className={label}>Tarif horaire (MAD/h) *</label>
                  <input name="tarif_horaire" type="number" step="0.5" min="0"
                    value={form.tarif_horaire} onChange={handleChange} placeholder="Ex: 5" className={input} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Tarif journalier (MAD) <span className="font-normal text-slate-400">optionnel</span></label>
                  <input name="tarif_journalier" type="number" step="1" min="0"
                    value={form.tarif_journalier} onChange={handleChange} placeholder="Ex: 40" className={input} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={label}>Ouverture</label>
                    <input name="horaire_ouverture" type="time" value={form.horaire_ouverture} onChange={handleChange} className={input} />
                  </div>
                  <div>
                    <label className={label}>Fermeture</label>
                    <input name="horaire_fermeture" type="time" value={form.horaire_fermeture} onChange={handleChange} className={input} />
                  </div>
                </div>
              </div>

              <div>
                <label className={label}>Véhicules acceptés *</label>
                <p className="text-xs text-slate-500 mb-2">Cochez tous les types que votre parking peut accueillir.</p>
                <div className="grid grid-cols-2 gap-2">
                  {GABARITS_OPTIONS.map(g => {
                    const actif = gabaritsAcceptes.includes(g.val);
                    return (
                      <div key={g.val} onClick={() => toggleGabarit(g.val)}
                        className={`cursor-pointer border-2 rounded-xl p-3 transition-all ${
                          actif ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-sky-200'
                        }`}>
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-2xl">{g.icon}</span>
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            actif ? 'border-sky-500 bg-sky-500' : 'border-slate-300'
                          }`}>
                            {actif && <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>}
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

              <div>
                <label className={label}>Accès complémentaires <span className="font-normal text-slate-400">optionnel</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {ACCES_OPTIONS.map(a => {
                    const actif = accesActifs.includes(a.id);
                    return (
                      <div key={a.id} onClick={() => toggleAcces(a.id)}
                        className={`cursor-pointer border-2 rounded-xl p-3 flex items-center gap-2 transition-all ${
                          actif ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-sky-200'
                        }`}>
                        <span className="text-xl">{a.icon}</span>
                        <span className="text-sm font-medium text-slate-800">{a.label}</span>
                        {actif && <span className="ml-auto text-sky-500 text-xs font-bold">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {form.infrastructure === 'souterrain' && (
                <div>
                  <label className={label}>Hauteur limite <span className="font-normal text-slate-400">optionnel</span></label>
                  <div className="flex items-center gap-3">
                    <input name="hauteur_limite" type="number" step="0.1" min="1" max="5"
                      value={form.hauteur_limite} onChange={handleChange}
                      placeholder="Ex: 1.9" className={`${input} max-w-32`} />
                    <span className="text-sm text-slate-500">mètres</span>
                  </div>
                </div>
              )}

              <div>
                <label className={label}>Source des disponibilités</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: 'manuel', icon: '✋', titre: 'Mise à jour manuelle', desc: 'Mettez à jour les places disponibles' },
                    { val: 'api',    icon: '🔗', titre: 'Via une API',          desc: 'Synchronisation automatique depuis votre système' },
                  ].map(opt => (
                    <div key={opt.val} onClick={() => setForm({ ...form, source_disponibilite: opt.val })}
                      className={`cursor-pointer border-2 rounded-xl p-3 transition-all ${
                        form.source_disponibilite === opt.val ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-sky-200'
                      }`}>
                      <div className="text-xl mb-1">{opt.icon}</div>
                      <div className="font-semibold text-slate-900 text-xs">{opt.titre}</div>
                      <div className="text-slate-500 text-xs mt-0.5">{opt.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {form.source_disponibilite === 'api' && (
                <div>
                  <label className={label}>URL de votre API</label>
                  <input name="api_url" type="url" value={form.api_url} onChange={handleChange}
                    placeholder="https://votre-api.com/parkings/123/disponibilite" className={input} />
                  <p className="text-slate-400 text-xs mt-1">L'intégration automatique sera activée prochainement.</p>
                </div>
              )}

              <div>
                <label className={label}>Services proposés <span className="font-normal text-slate-400">optionnel</span></label>
                <div className="space-y-2">
                  {SERVICES_LISTE.map(s => {
                    const actif = servicesActifs[s.id] !== undefined;
                    return (
                      <div key={s.id} className={`border-2 rounded-xl p-3 transition-all ${actif ? 'border-sky-500 bg-sky-50' : 'border-slate-200'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleService(s.id)}>
                            <span className="text-xl">{s.icon}</span>
                            <span className="text-sm font-medium text-slate-800">{s.label}</span>
                          </div>
                          <button type="button" onClick={() => toggleService(s.id)}
                            className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${actif ? 'bg-sky-500' : 'bg-slate-200'}`}>
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${actif ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                        {actif && (
                          <div className="flex items-center gap-2 mt-2 bg-white border border-sky-200 rounded-lg px-3 py-1.5">
                            <span className="text-xs text-slate-500 flex-1">Tarif additionnel</span>
                            <input type="number" min="0" step={s.id === 'recharge' ? '0.5' : '5'}
                              value={tarifsServices[s.id] ?? 0}
                              onChange={e => mettreAJourTarif(s.id, e.target.value)}
                              onClick={e => e.stopPropagation()}
                              className="w-16 text-right text-sm font-semibold text-sky-600 focus:outline-none bg-transparent" />
                            <span className="text-xs text-slate-500">{s.unite}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={label}>Informations complémentaires <span className="font-normal text-slate-400">optionnel</span></label>
                <textarea name="description" value={form.description} onChange={handleChange}
                  rows={3} placeholder="Ex: Accès par la rue latérale, badge requis pour les abonnés..."
                  className={`${input} resize-none`} />
                <p className="text-slate-400 text-xs mt-1">{form.description.length}/500 caractères</p>
              </div>
            </>
          )}

          {/* ── ÉTAPE 3 : CONFIRMATION ── */}
          {etape === 3 && (
            <>
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 space-y-2">
                <h3 className="font-bold text-slate-900 text-sm mb-3">Récapitulatif</h3>
                {[
                  { l: 'Nom',             v: form.nom },
                  { l: 'Adresse',         v: form.adresse },
                  { l: 'Coordonnées',     v: `${Number(form.latitude).toFixed(5)}, ${Number(form.longitude).toFixed(5)}` },
                  { l: 'Source coords',   v: `${sourceBadge[form.source_coords]?.icon} ${sourceBadge[form.source_coords]?.label}` },
                  { l: 'Infrastructure',  v: INFRASTRUCTURE.find(i => i.val === form.infrastructure)?.label },
                  { l: 'Mode de gestion', v: MODE_GESTION.find(m => m.val === form.mode_gestion)?.label },
                  { l: 'Capacité',        v: `${form.capacite_totale} places` },
                  { l: 'Tarif horaire',   v: `${form.tarif_horaire} MAD/h` },
                  { l: 'Tarif journalier',v: form.tarif_journalier ? `${form.tarif_journalier} MAD` : '—' },
                  { l: 'Horaires',        v: `${form.horaire_ouverture} – ${form.horaire_fermeture}` },
                  { l: 'Véhicules',       v: gabaritsAcceptes.map(id => GABARITS_OPTIONS.find(o => o.val === id)?.icon + ' ' + GABARITS_OPTIONS.find(o => o.val === id)?.label).join(', ') || '—' },
                  { l: 'Accès',           v: accesActifs.length > 0 ? accesActifs.map(id => ACCES_OPTIONS.find(a => a.id === id)?.label).join(', ') : 'Aucun' },
                  { l: 'Hauteur limite',  v: form.hauteur_limite ? `${form.hauteur_limite} m` : '—' },
                  { l: 'Disponibilités',  v: form.source_disponibilite === 'api' ? 'Via API' : 'Manuelle' },
                  { l: 'Services',        v: Object.keys(servicesActifs).length > 0
                      ? SERVICES_LISTE.filter(s => servicesActifs[s.id] !== undefined)
                          .map(s => `${s.icon} ${s.label}${tarifsServices[s.id] > 0 ? ` (+${tarifsServices[s.id]} MAD)` : ''}`)
                          .join(', ')
                      : 'Aucun' },
                  { l: 'Description',     v: form.description || '—' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 py-1 border-b border-sky-100 last:border-0">
                    <span className="text-slate-500 text-xs w-32 flex-shrink-0">{item.l}</span>
                    <span className="text-slate-900 text-xs font-medium">{item.v}</span>
                  </div>
                ))}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
                <span className="text-xl flex-shrink-0">⏳</span>
                <div>
                  <p className="text-amber-800 text-sm font-semibold">En attente de validation</p>
                  <p className="text-amber-700 text-xs mt-0.5">
                    Votre parking apparaîtra dans votre dashboard immédiatement. Il sera visible sur la carte après validation par l'administrateur ParkLink.
                  </p>
                </div>
              </div>
            </>
          )}

          {erreur && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">⚠️ {erreur}</div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-3 bg-white">
          {etape > 1 && (
            <button onClick={() => setEtape(etape - 1)}
              className="border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
              ← Retour
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onFermer}
            className="border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          {etape === 1 && (
            <button onClick={validerEtape1}
              disabled={!form.latitude || !form.longitude}
              className="bg-sky-500 hover:bg-sky-600 disabled:bg-sky-200 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              Suivant →
            </button>
          )}
          {etape === 2 && (
            <button onClick={validerEtape2}
              className="bg-sky-500 hover:bg-sky-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              Vérifier →
            </button>
          )}
          {etape === 3 && (
            <button onClick={soumettre} disabled={chargementSoumission}
              className="bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
              {chargementSoumission
                ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                : '✅ Soumettre le parking'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormulaireAjoutParking;