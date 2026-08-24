import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CarteParking from '../components/map/CarteParking';
import api from '../services/api';

const SERVICES_META = {
  lavage:   { icon: '🚿', label: 'Lavage' },
  recharge: { icon: '⚡', label: 'Recharge électrique' },
  valet:    { icon: '🤵', label: 'Valet parking' },
  courses:  { icon: '🛒', label: 'Transport de courses' },
};

const GABARITS_META = {
  petit: { icon: '🚗', label: 'Petit',  exemples: 'Kia Picanto, Hyundai i10, Peugeot 108' },
  moyen: { icon: '🚙', label: 'Moyen',  exemples: 'Dacia Logan, Renault Clio, Peugeot 308' },
  grand: { icon: '🚐', label: 'Grand',  exemples: 'Hyundai Tucson, Toyota Prado, BMW X5' },
  moto:  { icon: '🏍️', label: 'Moto',   exemples: 'Moto, scooter' },
};

const PHOTOS_PAR_TYPE = {
  surface:     'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
  souterrain:  'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=600&q=80',
  residentiel: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=600&q=80',
  relais:      'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=600&q=80',
};

const versISOAvecOffset = (dateLocaleStr) => {
  if (!dateLocaleStr) return dateLocaleStr;
  const d = new Date(dateLocaleStr);
  if (isNaN(d.getTime())) return dateLocaleStr;
  const offsetMin = -d.getTimezoneOffset();
  const signe = offsetMin >= 0 ? '+' : '-';
  const heuresOffset = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0');
  const minutesOffset = String(Math.abs(offsetMin) % 60).padStart(2, '0');
  const base = dateLocaleStr.length === 16 ? `${dateLocaleStr}:00` : dateLocaleStr;
  return `${base}${signe}${heuresOffset}:${minutesOffset}`;
};

// Retourne les gabarits acceptés par un parking sous forme de tableau
const getVehiculesAcceptes = (parking) => {
  const va = parking.vehicules_acceptes;
  if (Array.isArray(va) && va.length > 0) return va;
  // Fallback pour anciens enregistrements sans vehicules_acceptes
  return ['petit', 'moyen', 'grand'];
};

const MapPage = () => {
  const navigate = useNavigate();
  const { utilisateur, deconnexion } = useAuth();
  const [searchParams] = useSearchParams();

  const [parkings, setParkings] = useState([]);
  const [parkingsFiltres, setParkingsFiltres] = useState([]);
  const [parkingSelectionne, setParkingSelectionne] = useState(null);
  const [centreVers, setCentreVers] = useState(null);
  const [positionUser, setPositionUser] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [destinationSaisieDepuisHome, setDestinationSaisieDepuisHome] = useState(
    !!searchParams.get('q') // true si venu de la HomePage avec une recherche
  );
  const [destination, setDestination]           = useState(searchParams.get('q') || '');
  const [coordsDestination, setCoordsDestination] = useState(null);
  const [suggestionsDestination, setSuggestionsDestination] = useState([]);
  const [chargementDestination, setChargementDestination]   = useState(false);
  const [erreurDestination, setErreurDestination]           = useState('');
  const debounceRef  = useRef(null);
  const abortRef     = useRef(null);
  const [chargement, setChargement] = useState(true);
  const [panelListeOuvert, setPanelListeOuvert] = useState(true);
  const [panelDetailOuvert, setPanelDetailOuvert] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [modalReservation, setModalReservation] = useState(false);
  const [erreurRes, setErreurRes] = useState('');
  const [succesRes, setSuccesRes] = useState(false);
  const [chargementRes, setChargementRes] = useState(false);
  const [servicesChoisis, setServicesChoisis] = useState([]);

  const [reservation, setReservation] = useState(() => {
    const date  = searchParams.get('date')  || '';
    const debut = searchParams.get('debut') || '';
    const fin   = searchParams.get('fin')   || '';
    return {
      heure_debut: date && debut ? `${date}T${debut}` : '',
      heure_fin:   date && fin   ? `${date}T${fin}`   : '',
      paiement: 'carte',
    };
  });

  const [filtreType, setFiltreType] = useState('tous');
  const [filtreService, setFiltreService] = useState('');
  const [filtreGabarit, setFiltreGabarit] = useState('');
  const [rayonKm, setRayonKm] = useState(1); // rayon en km, 1 par défaut
  const [filtrePrixMax, setFiltrePrixMax] = useState('');
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [filtreTri, setFiltreTri] = useState('');

  const [modeNavigation, setModeNavigation] = useState(false);
  const [instructionsNav, setInstructionsNav] = useState([]);
  const [instructionActuelle, setInstructionActuelle] = useState(0);
  const [distanceRestante, setDistanceRestante] = useState(null);
  const [dureeRestante, setDureeRestante] = useState(null);
  const [parkingDestinationNav, setParkingDestinationNav] = useState(null);
  const [phaseNavigation, setPhaseNavigation] = useState('idle'); // 'idle' | 'preview' | 'active'
  const watchIdRef = useRef(null);
  const [pannNavPos, setPannNavPos] = useState({ x: null, y: null });
  const dragRef = useRef(null);

  useEffect(() => {
    const charger = async () => {
      try {
        const { data } = await api.get('/parkings');
        const parkingsSains = data.filter(p => {
          const lat = parseFloat(p.latitude);
          const lng = parseFloat(p.longitude);
          return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
        });
        setParkings(parkingsSains);
      } catch (err) {
        console.error(err);
      } finally {
        setChargement(false);
      }
    };
    charger();
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setPositionUser([pos.coords.latitude, pos.coords.longitude]),
        () => {}
      );
    }
  }, []);

  const calculerDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const tempsMarche = (distanceKm) => {
    const minutes = Math.round(distanceKm * 12);
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h${minutes % 60 > 0 ? ` ${minutes % 60}min` : ''}`;
  };

  const rechercherDestination = (valeur) => {
    setDestination(valeur);
    setErreurDestination('');
    setSuggestionsDestination([]);

    // Réinitialise si champ vidé
    if (!valeur.trim()) {
      setCoordsDestination(null);
      return;
    }

    // Debounce — attend 500ms après la dernière frappe
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {

      // Annule la requête précédente si encore en cours
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setChargementDestination(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(valeur + ' Casablanca Maroc')}&format=json&limit=5&addressdetails=1&accept-language=fr`;
        const res = await fetch(url, {
          headers: { 'Accept-Language': 'fr' },
          signal: abortRef.current.signal,
        });
        const data = await res.json();
        if (data && data.length > 0) {
          setSuggestionsDestination(data);
        } else {
          setErreurDestination('Aucun résultat — essayez un nom de quartier ou de rue');
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setErreurDestination('Erreur de recherche');
        }
      } finally {
        setChargementDestination(false);
      }
    }, 500); // 500ms de délai après la dernière frappe
  };

  const selectionnerDestination = (suggestion) => {
    const coords = { lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) };
    const nom = suggestion.display_name.split(',')[0];
    setDestination(nom);
    setCoordsDestination(coords);
    setSuggestionsDestination([]);
    setErreurDestination('');
  };

  useEffect(() => {
    let res = [...parkings];

    if (positionUser) {
      res = res.map(p => ({
        ...p,
        distance_km: Math.round(calculerDistance(
          positionUser[0], positionUser[1], p.latitude, p.longitude
        ) * 10) / 10
      }));
    }

    // Calcul distance marche parking → destination
    if (coordsDestination) {
      res = res.map(p => {
        const distDest = calculerDistance(
          coordsDestination.lat, coordsDestination.lng,
          p.latitude, p.longitude
        );
        return {
          ...p,
          distance_destination_km: Math.round(distDest * 100) / 100,
          temps_marche: tempsMarche(distDest),
        };
      });
    }

    // Si destination saisie : filtrer par defaut les parkings dans 1km de la destination - Rayon dynamique via curseur
    if (coordsDestination) {
      res = res.filter(p => (p.distance_destination_km || 99) <= rayonKm);
    }

    // Filtre par nom/adresse si pas de géocodage réussi
    // (quand l'utilisateur tape mais Nominatim n'a pas encore répondu)
    if (destination && !coordsDestination) {
      const q = destination.toLowerCase();
      res = res.filter(p =>
        p.nom.toLowerCase().includes(q) ||
        p.adresse.toLowerCase().includes(q)
      );
    }

    if (recherche) {
      const q = recherche.toLowerCase();
      res = res.filter(p =>
        p.nom.toLowerCase().includes(q) || p.adresse.toLowerCase().includes(q)
      );
    }
    if (filtreType === 'PMR') {
      res = res.filter(p =>
        Array.isArray(p.vehicules_acceptes) && p.vehicules_acceptes.includes('pmr')
      );
    } else if (filtreType !== 'tous') {
      res = res.filter(p => p.infrastructure === filtreType);
    }

    if (filtreService) {
      res = res.filter(p => {
        const s = p.services;
        if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
        return s[filtreService] !== undefined;
      });
    }
    if (filtreGabarit) {
      res = res.filter(p => {
        const va = Array.isArray(p.vehicules_acceptes) ? p.vehicules_acceptes : [];
        return va.includes(filtreGabarit);
      });
    }
    if (filtrePrixMax) res = res.filter(p => p.tarif_horaire <= parseFloat(filtrePrixMax));

    // Tri
    if (filtreTri === 'marche' && coordsDestination) {
      res.sort((a, b) => (a.distance_destination_km || 99) - (b.distance_destination_km || 99));
    } else if (filtreTri === 'distance' && positionUser) {
      res.sort((a, b) => (a.distance_km || 99) - (b.distance_km || 99));
    } else if (filtreTri === 'prix') {
      res.sort((a, b) => a.tarif_horaire - b.tarif_horaire);
    } else if (filtreTri === 'places') {
      res.sort((a, b) => b.places_disponibles - a.places_disponibles);
    }


    setParkingsFiltres(res);
  }, [recherche, destination, coordsDestination, filtreType, filtreService, filtreGabarit, filtrePrixMax, filtreTri, rayonKm,parkings, positionUser]);
  
  useEffect(() => {
    if (!modeNavigation || !positionUser || instructionsNav.length === 0) return;
    if (instructionActuelle >= instructionsNav.length - 1) return;

    const prochaine = instructionsNav[instructionActuelle];
    if (!prochaine?.coordonnees) return;

    const distanceAuPoint = calculerDistance(
      positionUser[0], positionUser[1],
      prochaine.coordonnees[0], prochaine.coordonnees[1]
    ) * 1000; // en mètres

    if (distanceAuPoint < 30) {
      setInstructionActuelle(prev => prev + 1);
    }
  }, [positionUser]);
  
  const selectionnerParking = (p) => {
    setParkingSelectionne(p);
    setCentreVers([p.latitude, p.longitude]);
    setPanelDetailOuvert(true);
  };

  const fermerDetail = () => {
    setPanelDetailOuvert(false);
    setParkingSelectionne(null);
  };

  const lancerNavigation = (parking) => {
    if (!positionUser) return;
    setParkingDestinationNav(parking);
    setPhaseNavigation('preview'); 
    setPanelDetailOuvert(false);
    setPanelListeOuvert(false);
    setInstructionActuelle(0);
    setInstructionsNav([]);
    setDistanceRestante(null);
    setDureeRestante(null);
  };

  const demarrerNavigation = () => {
    setPhaseNavigation('active');
    setModeNavigation(true);
    // Lance le suivi GPS en continu
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        pos => setPositionUser([pos.coords.latitude, pos.coords.longitude]),
        () => {},
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 5000 }
      );
    }
  };

  const arreterNavigation = () => {
    setModeNavigation(false);
    setPhaseNavigation('idle');
    setParkingDestinationNav(null);
    setInstructionsNav([]);
    setInstructionActuelle(0);
    setDistanceRestante(null);
    setDureeRestante(null);
    setPanelListeOuvert(true);
    setPannNavPos({ x: null, y: null });
    // Arrête le suivi GPS
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };



  const handleReserver = () => {
    if (!utilisateur) { navigate('/login'); return; }
    setServicesChoisis([]);
    setModalReservation(true);
  };

  const confirmerReservation = async (e) => {
    e.preventDefault();
    if (!reservation.heure_debut || !reservation.heure_fin) {
      setErreurRes("Veuillez saisir l'heure d'arrivée et de départ");
      return;
    }
    if (new Date(reservation.heure_fin) <= new Date(reservation.heure_debut)) {
      setErreurRes("L'heure de fin doit être après l'heure de début");
      return;
    }
    setChargementRes(true);
    setErreurRes('');
    try {
      await api.post('/reservations', {
        parking_id: parkingSelectionne.id,
        heure_debut: versISOAvecOffset(reservation.heure_debut),
        heure_fin: versISOAvecOffset(reservation.heure_fin),
        services_choisis: servicesChoisis,
        paiement: reservation.paiement,
      });
      setSuccesRes(true);
      setParkings(prev => prev.map(p =>
        p.id === parkingSelectionne.id
          ? { ...p, places_disponibles: Math.max(0, p.places_disponibles - 1) }
          : p
      ));
    } catch (err) {
      setErreurRes(err.response?.data?.erreur || 'Erreur lors de la réservation');
    } finally {
      setChargementRes(false);
    }
  };

  const fermerModal = () => {
    setModalReservation(false);
    setSuccesRes(false);
    setErreurRes('');
    setServicesChoisis([]);
    setReservation(prev => ({ ...prev, paiement: 'carte' }));
  };

  const getServicesObj = (parking) => {
    const s = parking?.services;
    if (!s || typeof s !== 'object' || Array.isArray(s)) return {};
    return s;
  };

  const montantTotal = () => {
    if (!reservation.heure_debut || !reservation.heure_fin) return 0;
    const diff = new Date(reservation.heure_fin) - new Date(reservation.heure_debut);
    if (diff <= 0) return 0;
    const statio = Math.round(diff / 3600000 * (parkingSelectionne?.tarif_horaire || 0) * 100) / 100;
    const obj = getServicesObj(parkingSelectionne);
    const services = servicesChoisis.reduce((sum, id) => sum + (parseFloat(obj[id]) || 0), 0);
    return Math.round((statio + services) * 100) / 100;
  };

  const montantStatio = () => {
    if (!reservation.heure_debut || !reservation.heure_fin) return 0;
    const diff = new Date(reservation.heure_fin) - new Date(reservation.heure_debut);
    if (diff <= 0) return 0;
    return Math.round(diff / 3600000 * (parkingSelectionne?.tarif_horaire || 0) * 100) / 100;
  };

  const montantServices = () => {
    const obj = getServicesObj(parkingSelectionne);
    return servicesChoisis.reduce((sum, id) => sum + (parseFloat(obj[id]) || 0), 0);
  };

  const dureeHeures = () => {
    if (!reservation.heure_debut || !reservation.heure_fin) return 0;
    return Math.round((new Date(reservation.heure_fin) - new Date(reservation.heure_debut)) / 360000) / 10;
  };

  const maintenant = new Date().toISOString().slice(0, 16);
  const aujourdhui = maintenant.slice(0, 10);
  const filtresActifs = filtrePrixMax || filtreService || filtreGabarit || filtreTri !== '';

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{fontFamily:"'DM Sans', sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap');
        .input-focus:focus { outline:none; border-color:#0ea5e9; box-shadow:0 0 0 3px rgba(14,165,233,0.1); }
        .parking-row { transition:background 0.15s; }
        .parking-row:hover { background:#f0f9ff; }
        .panel-slide { transition:all 0.3s cubic-bezier(0.4,0,0.2,1); }
        .paiement-card { transition:all 0.2s; cursor:pointer; }
        .paiement-card:hover { border-color:#0ea5e9; }
        .paiement-card.selected { border-color:#0ea5e9; background:#f0f9ff; }
        .leaflet-routing-container { display: none !important; }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-thumb { background:#e2e8f0; border-radius:2px; }
      `}</style>

      {/* ── TOPBAR ── */}
      <div className="bg-white border-b border-slate-100 shadow-sm flex-shrink-0 flex items-stretch" style={{zIndex:100}}>

        {/* COLONNE GAUCHE — s'allonge avec les filtres */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Ligne 1 : Logo + Recherche */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex items-center gap-2 cursor-pointer flex-shrink-0" onClick={() => navigate('/')}>
              <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white"/>
                </svg>
              </div>
              <span style={{fontFamily:"'DM Serif Display'"}} className="text-lg text-slate-900 hidden sm:block">
                Park<span className="text-sky-500">Link</span>
              </span>
            </div>

            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
              </svg>
              <input
                type="text"
                placeholder="Où allez-vous ?"
                value={destination}
                onChange={e => rechercherDestination(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && suggestionsDestination.length > 0) selectionnerDestination(suggestionsDestination[0]);
                  if (e.key === 'Escape') setSuggestionsDestination([]);
                }}
                className="input-focus w-full border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-sm bg-slate-50 text-slate-700 placeholder-slate-400"
                autoComplete="off"
              />
              {chargementDestination && (
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin w-4 h-4 text-sky-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              )}
              {destination && !chargementDestination && (
                <button onClick={() => { setDestination(''); setCoordsDestination(null); setSuggestionsDestination([]); setErreurDestination(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
              )}
              {suggestionsDestination.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 max-h-60 overflow-y-auto">
                  {suggestionsDestination.map((s, i) => (
                    <button key={i} type="button" onClick={() => selectionnerDestination(s)}
                      className="w-full text-left px-4 py-3 hover:bg-sky-50 border-b border-slate-50 last:border-0 transition-colors flex items-start gap-3">
                      <span className="text-slate-400 mt-0.5 flex-shrink-0">📍</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{s.display_name.split(',')[0]}</div>
                        <div className="text-xs text-slate-400 truncate">{s.display_name.split(',').slice(1,3).join(',')}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {erreurDestination && (
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-amber-700 text-xs">
              ⚠️ {erreurDestination}
            </div>
          )}

          {/* Ligne 2 : Filtres rapides */}
          <div className="flex items-center gap-2 px-4 pb-2 overflow-x-auto">
            {[
              { val:'tous',        label:'Tous' },
              { val:'surface',     label:'☀️ Surface' },
              { val:'souterrain',  label:'⬇️ Souterrain' },
              { val:'residentiel', label:'🏘️ Résidentiel' },
              { val:'relais',      label:'🚌 Relais' },
              { val:'PMR',         label:'♿ PMR' },
            ].map(f => (
              <button key={f.val} onClick={() => setFiltreType(f.val)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  filtreType === f.val ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                {f.label}
              </button>
            ))}
            <div className="h-4 w-px bg-slate-200 flex-shrink-0 mx-1"/>
            <button onClick={() => setFiltresOuverts(!filtresOuverts)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                filtresOuverts || filtresActifs
                  ? 'bg-sky-50 border-sky-300 text-sky-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              ⚙️ Filtres
              {filtresActifs && (
                <span className="w-4 h-4 bg-sky-500 text-white rounded-full text-xs flex items-center justify-center ml-1">!</span>
              )}
            </button>
          </div>

          {/* Ligne 3 : Filtres avancés — s'étend ici, colonne droite non affectée */}
          {filtresOuverts && (
            <div className="px-4 pb-3 flex flex-wrap gap-3 border-t border-slate-100 pt-3 bg-slate-50">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500 font-medium">Trier :</span>
                {[
                  { val:'marche', label:'🚶 Temps de marche' },
                  { val:'prix',     label:'💰 Prix' },
                  { val:'places',   label:'🅿️ Places dispo' },
                ].map(t => (
                  <button key={t.val} onClick={() => setFiltreTri(t.val)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      filtreTri === t.val ? 'bg-sky-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-sky-300'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Service :</span>
                <select value={filtreService} onChange={e => setFiltreService(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:border-sky-400">
                  <option value="">Tous</option>
                  {Object.entries(SERVICES_META).map(([id, s]) => (
                    <option key={id} value={id}>{s.icon} {s.label}</option>
                  ))}
                </select>
                {filtreService && <button onClick={() => setFiltreService('')} className="text-xs text-red-400 hover:text-red-600">✕</button>}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Mon véhicule :</span>
                <select value={filtreGabarit} onChange={e => setFiltreGabarit(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:border-sky-400">
                  <option value="">Tous les véhicules</option>
                  <option value="petit">🚗 Petit</option>
                  <option value="moyen">🚙 Moyen</option>
                  <option value="grand">🚐 Grand</option>
                  <option value="moto">🏍️ Moto</option>
                </select>
                {filtreGabarit && <button onClick={() => setFiltreGabarit('')} className="text-xs text-red-400 hover:text-red-600">✕</button>}
              </div>

              <div className="flex flex-wrap items-start gap-4 w-full">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 font-medium">Indiquez votre budget max</span>
                  <div className="flex items-center gap-2">
                    <input type="number" placeholder="Prix max MAD/h" value={filtrePrixMax}
                      onChange={e => setFiltrePrixMax(e.target.value)}
                      className="w-32 border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:border-sky-400"/>
                    {filtrePrixMax && <button onClick={() => setFiltrePrixMax('')} className="text-xs text-red-400 hover:text-red-600">✕</button>}
                  </div>
                </div>

              

                {coordsDestination && (
                  <div className="flex flex-col gap-1 flex-1 min-w-48">
                    <span className="text-xs text-slate-500 font-medium">
                      Besoin de marcher ? Stationnez à <strong className="text-sky-600">{rayonKm} km</strong> de votre destination
                    </span>
                    <input type="range" min="0.5" max="4" step="0.1" value={rayonKm}
                      onChange={e => setRayonKm(parseFloat(e.target.value))}
                      className="accent-sky-500"
                      style={{width: '345px'}}/>
                    <span className="text-xs font-bold text-sky-600">{rayonKm} km</span>
                  </div>
                )}
              </div>

              {filtresActifs && (
                <button onClick={() => { setFiltreTri(''); setFiltreService(''); setFiltreGabarit(''); setFiltrePrixMax(''); }}
                  className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-300 px-2.5 py-1 rounded-lg transition-colors">
                  ✕ Réinitialiser
                </button>
              )}
            </div>
          )}
        </div>

        {/* COLONNE DROITE — hauteur fixe, ne bouge pas */}
        <div className="w-80 flex-shrink-0 self-start sticky top-0 flex items-center justify-end px-4 py-3">
          {utilisateur ? (
            <div className="relative">
              <button onClick={() => setMenuOuvert(!menuOuvert)}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 transition-colors">
                <div className="w-6 h-6 bg-sky-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {utilisateur.prenom?.[0]?.toUpperCase()}
                </div>
                <span>{utilisateur.prenom}</span>
              </button>
              {menuOuvert && (
                <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden" style={{zIndex:200}}>
                  <button onClick={() => { navigate('/profil'); setMenuOuvert(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">📋 Mon espace</button>
                  <button onClick={() => { deconnexion(); navigate('/'); setMenuOuvert(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 border-t border-slate-100">🚪 Déconnexion</button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => navigate('/login')}
              className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              Connexion
            </button>
          )}
        </div>

      </div>

      {/* ── CORPS ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* LISTE */}
        <div className={`panel-slide flex-shrink-0 bg-white border-r border-slate-100 flex flex-col ${
          panelListeOuvert ? 'w-80' : 'w-0'
        } overflow-hidden`}>
          
          {coordsDestination && (
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                {parkingsFiltres.length} parking{parkingsFiltres.length !== 1 ? 's' : ''} trouvé{parkingsFiltres.length !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-slate-400">rayon {rayonKm} km</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {/* Dans la liste — état vide sans destination */}
            {!coordsDestination ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center py-16">
                <div className="w-14 h-14 bg-sky-50 border border-sky-100 rounded-2xl flex items-center justify-center text-2xl">
                  📍
                </div>
                <div>
                  <div className="font-semibold text-slate-900 text-sm mb-1">Où allez-vous ?</div>
                  <div className="text-slate-500 text-xs leading-relaxed">
                    Saisissez votre destination dans la barre en haut pour trouver les parkings disponibles à proximité.
                  </div>
                </div>
              </div>
            ) : parkingsFiltres.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 px-4 text-center">
                <span className="text-2xl">🅿️</span>
                <span className="text-slate-600 text-sm font-medium">Aucun parking disponible</span>
                <span className="text-slate-400 text-xs">dans un rayon d'1 km de votre destination</span>
              </div>
            ) : (
              parkingsFiltres.map(p => (
                <div key={p.id} onClick={() => selectionnerParking(p)}
                  className={`parking-row cursor-pointer p-3 border-b border-slate-50 ${
                    parkingSelectionne?.id === p.id ? 'bg-sky-50 border-l-4 border-l-sky-500' : ''
                  }`}>
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">
                      <img src={PHOTOS_PAR_TYPE[p.infrastructure] || PHOTOS_PAR_TYPE.surface}
                        alt={p.nom} className="w-full h-full object-cover"
                        onError={e => { e.target.style.display='none'; }}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 text-sm truncate">{p.nom}</div>
                      <div className="text-slate-500 text-xs truncate mt-0.5">{p.adresse}</div>
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-sky-600">{p.tarif_horaire} MAD/h</span>
                          {p.temps_marche && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs text-emerald-600 font-medium">🚶 {p.temps_marche} à pied de votre destination</span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); selectionnerParking(p); }}
                          className="text-xs text-sky-600 font-medium bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1 rounded-lg transition-colors flex-shrink-0">
                          Détails →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CARTE */}
        <div className="flex-1 relative">
          <CarteParking
            parkings={parkingsFiltres}
            positionUser={positionUser}
            onParkingClick={selectionnerParking}
            coordsDestination={coordsDestination}
            parkingSelectionneId={parkingSelectionne?.id}
            modeNavigation={phaseNavigation === 'active'} 
            parkingDestinationNav={parkingDestinationNav}
            setDistanceRestante={setDistanceRestante}
            setDureeRestante={setDureeRestante}
            setInstructionsNav={setInstructionsNav}
          />

          {!panelListeOuvert && (
            <button onClick={() => setPanelListeOuvert(true)}
              className="absolute top-4 left-4 bg-white shadow-lg border border-slate-200 px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              style={{zIndex:50}}>
              📋 {parkingsFiltres.length} parking{parkingsFiltres.length !== 1 ? 's' : ''}
            </button>
          )}

          <button
            onClick={() => navigator.geolocation?.getCurrentPosition(
              pos => setPositionUser([pos.coords.latitude, pos.coords.longitude])
            )}
            className="absolute bottom-6 right-4 bg-white shadow-lg border border-slate-200 w-10 h-10 rounded-xl flex items-center justify-center text-sky-500 hover:bg-sky-50"
            style={{zIndex:50}}>
            📍
          </button>

          {/* PANEL DÉTAIL */}
          <div className={`panel-slide fixed top-[var(--topbar-h)] right-0 bg-white shadow-2xl flex flex-col overflow-hidden ${
            panelDetailOuvert ? 'w-80 opacity-100' : 'w-0 opacity-0 pointer-events-none'
          }`} style={{zIndex:1000, top: '108px', bottom: 0}}>

            {parkingSelectionne && (
              <>
                {/* ── PANNEAU TRAJET ── */}
                <div className="flex-shrink-0 border-b border-slate-100 px-4 py-3 bg-white space-y-2">

                  {/* Ligne position → parking */}
                  <div className="flex items-center gap-2">
                    {/* Marqueur position */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div style={{
                        background:'#6366f1', width:12, height:12, borderRadius:'50%',
                        border:'2px solid white', boxShadow:'0 0 0 3px rgba(99,102,241,0.25)',
                        flexShrink:0,
                      }}/>
                      <span className="text-xs text-slate-500 whitespace-nowrap">Votre position</span>
                    </div>

                    {/* Segment + km */}
                    <div className="flex-1 flex flex-col items-center">
                      <span className="text-xs font-bold text-sky-600 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full mb-1 whitespace-nowrap">
                        {positionUser
                          ? `${calculerDistance(positionUser[0], positionUser[1], parkingSelectionne.latitude, parkingSelectionne.longitude).toFixed(1)} km`
                          : '— km'}
                      </span>
                      <div className="w-full border-t-2 border-dashed border-sky-400"/>
                    </div>

                    {/* Marqueur parking */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="w-5 h-5 bg-sky-500 rounded-md flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold leading-none">P</span>
                      </div>
                      <span className="text-xs text-slate-700 font-semibold truncate max-w-24">
                        {parkingSelectionne.nom}
                      </span>
                    </div>
                  </div>

                  {/* Temps de marche */}
                  {parkingSelectionne.temps_marche && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">🚶</span>
                      <span className="text-xs text-emerald-600 font-medium">
                        {parkingSelectionne.temps_marche} à pied de votre destination
                      </span>
                    </div>
                  )}



                  <button
                    onClick={() => lancerNavigation(parkingSelectionne)}
                    disabled={!positionUser}
                    className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-slate-200 disabled:text-slate-400 text-white py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2">
                    🧭 Naviguer vers ce parking
                  </button>
                  {!positionUser && (
                    <p className="text-xs text-slate-400 text-center mt-1">
                      Activez votre GPS pour utiliser la navigation
                    </p>
                  )}
                      
                </div>

                {/* ── IMAGE HERO ── */}
                <div className="relative flex-shrink-0 h-28">
                  <img src={PHOTOS_PAR_TYPE[parkingSelectionne.infrastructure] || PHOTOS_PAR_TYPE.surface}
                    alt={parkingSelectionne.nom} className="w-full h-full object-cover"/>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"/>
                  <button onClick={fermerDetail}
                    className="absolute top-3 right-3 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center text-sm transition-colors">
                    ✕
                  </button>
                </div>

                {/* ── INFOS PARKING ── */}
                <div className="flex-1 overflow-y-auto">

                  <div className="p-4 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <div className="font-semibold text-slate-900 text-sm leading-tight">{parkingSelectionne.nom}</div>
                    </div>
                    <div className="text-slate-500 text-xs mb-2">{parkingSelectionne.adresse}</div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Horaires</h4>
                      {(() => {
                        const ouverture = parkingSelectionne.horaire_ouverture?.slice(0, 5) || '00:00';
                        const fermeture = parkingSelectionne.horaire_fermeture?.slice(0, 5) || '23:59';
                        const maintenant = new Date();
                        const [hO, mO] = ouverture.split(':').map(Number);
                        const [hF, mF] = fermeture.split(':').map(Number);
                        const minutesMaintenant = maintenant.getHours() * 60 + maintenant.getMinutes();
                        const estOuvert = minutesMaintenant >= hO * 60 + mO && minutesMaintenant < hF * 60 + mF;
                        return (
                          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                            <div>
                              <span className={`text-sm font-bold ${estOuvert ? 'text-emerald-600' : 'text-red-500'}`}>
                                {estOuvert ? 'Ouvert' : 'Fermé'}
                              </span>
                              <div className="text-xs text-slate-500 mt-0.5">{ouverture} – {fermeture}</div>
                            </div>
                            <div className={`w-2.5 h-2.5 rounded-full ${estOuvert ? 'bg-emerald-500' : 'bg-red-500'}`}/>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="text-xs text-slate-500 mt-2">
                      🅿️{' '}
                      <span className={`font-semibold ${parkingSelectionne.places_disponibles > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {parkingSelectionne.places_disponibles}/{parkingSelectionne.capacite_totale} places
                      </span>{' '}disponibles
                    </div>
                  </div>


                  <div className="p-4 border-b border-slate-100 space-y-3">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tarifs & Paiements</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-sky-50 rounded-xl p-3 text-center">
                        <div className="font-bold text-sky-600 text-lg">{parkingSelectionne.tarif_horaire} MAD</div>
                        <div className="text-slate-500 text-xs">par heure</div>
                      </div>
                      {parkingSelectionne.tarif_journalier && (
                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                          <div className="font-bold text-slate-700 text-lg">{parkingSelectionne.tarif_journalier} MAD</div>
                          <div className="text-slate-500 text-xs">par jour</div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {[{ icon:'💳', label:'Carte' }, { icon:'💵', label:'Espèces' }].map((p, i) => (
                        <span key={i} className="flex items-center gap-1 text-xs bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-full">
                          {p.icon} {p.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {(() => {
                    const obj = getServicesObj(parkingSelectionne);
                    const ids = Object.keys(obj);
                    if (ids.length === 0) return null;
                    return (
                      <div className="p-4 border-b border-slate-100">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Services disponibles</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {ids.map(id => {
                            const s = SERVICES_META[id];
                            return (
                              <span key={id} className="flex items-center gap-1 text-xs bg-sky-50 text-sky-700 border border-sky-100 px-2 py-1 rounded-full">
                                {s?.icon} {s?.label || id}
                                {obj[id] > 0 && <span className="font-semibold">· +{obj[id]} MAD</span>}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="p-4 border-b border-slate-100 space-y-4">
                    {(() => {
                      const va = Array.isArray(parkingSelectionne.vehicules_acceptes) ? parkingSelectionne.vehicules_acceptes : [];
                      const gabarits = va.filter(v => ['petit', 'moyen', 'grand', 'moto'].includes(v));
                      const acces = va.filter(v => ['pmr', 'electrique'].includes(v));
                      if (gabarits.length === 0 && !parkingSelectionne.hauteur_limite && acces.length === 0) return null;
                      return (
                        <div>
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Véhicules acceptés</h4>
                          {gabarits.length > 0 && (
                            <div className="grid grid-cols-2 gap-1.5 mb-2">
                              {gabarits.map(g => {
                                const meta = GABARITS_META[g];
                                return meta ? (
                                  <div key={g} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-2">
                                    <span className="text-base">{meta.icon}</span>
                                    <div>
                                      <div className="text-xs font-semibold text-slate-800">{meta.label}</div>
                                      <div className="text-xs text-slate-400 leading-tight">{meta.exemples}</div>
                                    </div>
                                  </div>
                                ) : null;
                              })}
                            </div>
                          )}
                          {parkingSelectionne.infrastructure === 'souterrain' && (
                            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-center gap-2 mb-2">
                              <span className="text-sm">⚠️</span>
                              <span className="text-xs text-amber-700 font-medium">
                                Hauteur limite :{' '}
                                {parkingSelectionne.hauteur_limite
                                  ? `${parkingSelectionne.hauteur_limite} m`
                                  : '2,10 m (standard)'}
                              </span>
                            </div>
                          )}
                          {acces.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                              {acces.includes('pmr') && (
                                <span className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full">
                                  ♿ Accès PMR
                                </span>
                              )}
                              {acces.includes('electrique') && (
                                <span className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full">
                                  ⚡ Borne électrique
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {parkingSelectionne.description && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Informations</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">{parkingSelectionne.description}</p>
                      </div>
                    )}

                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contact</h4>
                      <a href="tel:+212522000000"
                        className="flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-medium transition-colors">
                        📞 Appeler le parking
                      </a>
                    </div>
                  </div>

                  <div className="p-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Notes et avis</h4>
                    <div className="text-center py-6 bg-slate-50 rounded-xl">
                      <div className="text-2xl mb-1">⭐</div>
                      <div className="text-slate-500 text-xs">Aucun avis pour le moment</div>
                    </div>
                  </div>

                </div>

                <div className="p-4 border-t border-slate-100 flex-shrink-0 bg-white">
                  <button onClick={handleReserver}
                    disabled={parkingSelectionne.places_disponibles === 0}
                    className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-slate-200 disabled:text-slate-400 text-white py-3 rounded-xl font-semibold text-sm transition-all hover:shadow-lg hover:shadow-sky-200">
                    {parkingSelectionne.places_disponibles === 0
                      ? 'Complet — indisponible'
                      : !utilisateur
                      ? '🔐 Se connecter pour réserver'
                      : '📅 Réserver une place'}
                  </button>
                  {!utilisateur && (
                    <p className="text-center text-slate-400 text-xs mt-2">
                      Recherche gratuite · Compte requis pour réserver
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── PANNEAU PREVIEW NAVIGATION ── */}
      {phaseNavigation === 'preview' && parkingDestinationNav && (
        <div
          className="absolute z-[1001] w-96 max-w-[90vw]"
          style={{
            top: pannNavPos.y !== null ? `${pannNavPos.y}px` : 'auto',
            bottom: pannNavPos.y !== null ? 'auto' : '1rem',
            left: pannNavPos.x !== null ? `${pannNavPos.x}px` : '50%',
            transform: pannNavPos.x !== null ? 'none' : 'translateX(-50%)',
            cursor: 'grab',
            userSelect: 'none',
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const rect = e.currentTarget.getBoundingClientRect();
            dragRef.current = {
              startX: e.clientX,
              startY: e.clientY,
              startLeft: rect.left,
              startTop: rect.top,
            };
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            const deltaX = e.clientX - dragRef.current.startX;
            const deltaY = e.clientY - dragRef.current.startY;
            const newLeft = Math.max(0, Math.min(
              window.innerWidth - 384,
              dragRef.current.startLeft + deltaX
            ));
            const newTop = Math.max(60, Math.min(
              window.innerHeight - 100,
              dragRef.current.startTop + deltaY
            ));
            setPannNavPos({ x: newLeft, y: newTop });
          }}
          onPointerUp={() => { dragRef.current = null; }}
          onPointerCancel={() => { dragRef.current = null; }}
        >
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Poignée visuelle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-8 h-1 bg-slate-300 rounded-full"/>
            </div>
            {/* Header */}
            <div className="bg-sky-600 px-5 py-4 flex items-center justify-between">
              <div>
                <div className="text-white font-semibold text-sm">{parkingDestinationNav.nom}</div>
                <div className="text-sky-200 text-xs mt-0.5">{parkingDestinationNav.adresse}</div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-bold text-white text-lg">{parkingDestinationNav.tarif_horaire} MAD</span>
                  <span className="text-sky-200 text-xs">/ heure</span>
                </div>
              </div>
              <button onClick={arreterNavigation}
                className="text-white/70 hover:text-white w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                ✕
              </button>
            </div>

            {/* Infos trajet */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-around mb-4">
                <div className="text-center">
                  <div className="font-bold text-sky-600 text-2xl">
                    {positionUser
                      ? `${calculerDistance(positionUser[0], positionUser[1], parkingDestinationNav.latitude, parkingDestinationNav.longitude).toFixed(1)} km`
                      : '— km'}
                  </div>
                  <div className="text-slate-400 text-xs mt-0.5">Distance à parcourir</div>
                </div>
                <div className="h-10 w-px bg-slate-200"/>
                <div className="text-center">
                  <div className="font-bold text-slate-900 text-2xl">
                    {positionUser
                      ? `${Math.round(calculerDistance(positionUser[0], positionUser[1], parkingDestinationNav.latitude, parkingDestinationNav.longitude) / 40 * 60)} min`
                      : '— min'}
                  </div>
                  <div className="text-slate-400 text-xs mt-0.5">Durée estimée</div>
                </div>
                
                
              </div>

              <div className="flex items-center gap-2 mb-3 bg-slate-50 rounded-xl px-4 py-2.5">
                <div style={{background:'#6366f1', width:10, height:10, borderRadius:'50%', flexShrink:0}}/>
                <div className="flex-1 border-t border-dashed border-slate-300"/>
                <div className="w-5 h-5 bg-sky-500 rounded-md flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold leading-none">P</span>
                </div>
              </div>
              <div className="flex justify-between text-xs text-slate-400 mb-4 px-1">
                <span>Votre position</span>
                <span>{parkingDestinationNav.nom}</span>
              </div>

              <button 
                onClick={demarrerNavigation}
                onPointerDown={e => e.stopPropagation()} 
                className="w-full bg-sky-500 hover:bg-sky-600 text-white py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                🧭 Démarrer la navigation
              </button>
            </div>
          </div>
        </div>
      )}

      {phaseNavigation === 'active' && (
        <>
          {/* Instruction courante — en haut */}
          <div className="absolute top-0 left-0 right-0 z-[1001] pointer-events-none">
            <div className="mx-3 mt-3 bg-sky-600 text-white rounded-2xl shadow-xl px-4 py-3 pointer-events-auto">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                    {instructionsNav[instructionActuelle]?.type === 'turn' && instructionsNav[instructionActuelle]?.modifier === 'left'  ? '↰' :
                    instructionsNav[instructionActuelle]?.type === 'turn' && instructionsNav[instructionActuelle]?.modifier === 'right' ? '↱' :
                    instructionsNav[instructionActuelle]?.type === 'arrive' ? '🅿️' :
                    instructionsNav[instructionActuelle]?.type === 'roundabout' ? '🔄' : '↑'}
                  </div>
                  <div className="flex-1 min-w-0">
                    {instructionsNav.length > 0 ? (
                      <>
                        <div className="font-semibold text-sm leading-tight">
                          {instructionsNav[instructionActuelle]?.texte || 'Calcul de l\'itinéraire…'}
                        </div>
                        <div className="text-sky-200 text-xs mt-0.5">
                          Étape {instructionActuelle + 1} / {instructionsNav.length}
                        </div>
                      </>
                    ) : (
                      <div className="font-semibold text-sm">Calcul de l'itinéraire…</div>
                    )}
                  </div>
                </div>
                <button 
                  onClick={arreterNavigation}
                  onPointerDown={e => e.stopPropagation()} 
                  className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0">
                  ✕
                </button>
              </div>
            </div>
          </div>

          {/* Barre récap — en bas */}
          {distanceRestante && dureeRestante && (
            <div className="absolute bottom-4 left-3 right-3 z-[1001]">
              <div className="bg-white rounded-2xl shadow-xl px-5 py-3 flex items-center justify-between">
                <div className="text-center">
                  <div className="font-bold text-sky-600 text-xl">{distanceRestante} km</div>
                  <div className="text-slate-400 text-xs">Distance</div>
                </div>
                <div className="h-8 w-px bg-slate-200"/>
                <div className="text-center">
                  <div className="font-bold text-slate-900 text-xl">{dureeRestante} min</div>
                  <div className="text-slate-400 text-xs">Durée estimée</div>
                </div>
                <div className="h-8 w-px bg-slate-200"/>
                <div className="text-center flex-1 ml-2">
                  <div className="font-semibold text-slate-700 text-sm truncate">
                    {parkingDestinationNav?.nom}
                  </div>
                  <div className="text-slate-400 text-xs">Destination</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── MODAL RÉSERVATION ── */}
      {modalReservation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" style={{zIndex:2000}}>
          <div className="bg-white w-full sm:max-w-md rounded-2xl shadow-2xl overflow-hidden">
            {!succesRes ? (
              <>
                <div className="bg-gradient-to-r from-sky-600 to-sky-500 px-5 py-4 flex items-center justify-between">
                  <div>
                    <h3 style={{fontFamily:"'DM Serif Display'"}} className="text-white text-xl font-normal">Réserver une place</h3>
                    <p className="text-sky-100 text-xs mt-0.5">{parkingSelectionne?.nom}</p>
                    
                  </div>
                  <button onClick={fermerModal} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
                </div>

                <form onSubmit={confirmerReservation} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                  <div className="flex gap-3 p-3 bg-sky-50 rounded-xl">
                    <div className="flex-1 text-center">
                      <div className="font-bold text-sky-600">{parkingSelectionne?.tarif_horaire} MAD/h</div>
                      <div className="text-slate-500 text-xs">Tarif horaire</div>
                    </div>
                    <div className="w-px bg-sky-200"></div>
                    <div className="flex-1 text-center">
                      <div className={`font-bold ${parkingSelectionne?.places_disponibles > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {parkingSelectionne?.places_disponibles} places
                      </div>
                      <div className="text-slate-500 text-xs">Disponibles</div>
                    </div>
                  </div>

                  {(reservation.heure_debut || reservation.heure_fin) && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-700 flex items-center gap-2">
                      ✅ Créneau pré-rempli depuis votre recherche — modifiable ci-dessous
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">📅 Arrivée</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" min={aujourdhui}
                        value={reservation.heure_debut?.slice(0, 10) || ''}
                        onChange={e => setReservation(prev => ({
                          ...prev,
                          heure_debut: e.target.value + 'T' + (prev.heure_debut?.slice(11, 16) || '08:00')
                        }))}
                        required
                        className="input-focus border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-700"/>
                      <input type="time"
                        value={reservation.heure_debut?.slice(11, 16) || ''}
                        onChange={e => setReservation(prev => ({
                          ...prev,
                          heure_debut: (prev.heure_debut?.slice(0, 10) || aujourdhui) + 'T' + e.target.value
                        }))}
                        required
                        className="input-focus border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-700"/>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">🕕 Départ</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date"
                        min={reservation.heure_debut?.slice(0, 10) || aujourdhui}
                        value={reservation.heure_fin?.slice(0, 10) || ''}
                        onChange={e => setReservation(prev => ({
                          ...prev,
                          heure_fin: e.target.value + 'T' + (prev.heure_fin?.slice(11, 16) || '10:00')
                        }))}
                        required
                        className="input-focus border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-700"/>
                      <input type="time"
                        value={reservation.heure_fin?.slice(11, 16) || ''}
                        onChange={e => setReservation(prev => ({
                          ...prev,
                          heure_fin: (prev.heure_fin?.slice(0, 10) || aujourdhui) + 'T' + e.target.value
                        }))}
                        required
                        className="input-focus border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-700"/>
                    </div>
                  </div>

                  {(() => {
                    const obj = getServicesObj(parkingSelectionne);
                    const ids = Object.keys(obj);
                    if (ids.length === 0) return null;
                    return (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-2">✨ Services extra (optionnel)</label>
                        <div className="space-y-2">
                          {ids.map(id => {
                            const s = SERVICES_META[id];
                            const actif = servicesChoisis.includes(id);
                            return (
                              <div key={id}
                                onClick={() => setServicesChoisis(prev =>
                                  prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                                )}
                                className={`cursor-pointer flex items-center justify-between border-2 rounded-xl px-3 py-2.5 transition-all ${
                                  actif ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-sky-200'
                                }`}>
                                <span className="text-sm">{s?.icon} {s?.label || id}</span>
                                <div className="flex items-center gap-2">
                                  {obj[id] > 0
                                    ? <span className="text-xs font-semibold text-sky-600">+{obj[id]} MAD</span>
                                    : <span className="text-xs text-emerald-600 font-medium">Gratuit</span>
                                  }
                                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                    actif ? 'border-sky-500 bg-sky-500' : 'border-slate-300'
                                  }`}>
                                    {actif && <span className="text-white text-xs leading-none">✓</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {montantTotal() > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      {servicesChoisis.length > 0 && (
                        <div className="text-xs text-emerald-700 mb-2 space-y-0.5">
                          <div className="flex justify-between">
                            <span>Stationnement ({dureeHeures()}h)</span>
                            <span>{montantStatio()} MAD</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Services extra</span>
                            <span>+{montantServices()} MAD</span>
                          </div>
                          <div className="border-t border-emerald-200 pt-1 mt-1"></div>
                        </div>
                      )}
                      <div className="text-emerald-700 font-bold text-xl text-center">{montantTotal()} MAD</div>
                      {servicesChoisis.length === 0 && (
                        <div className="text-emerald-600 text-xs text-center">{dureeHeures()}h de stationnement</div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-2">💳 Mode de paiement</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { val:'carte',   icon:'💳', label:'Carte bancaire', sub:"En ligne maintenant" },
                        { val:'especes', icon:'💵', label:'Espèces',        sub:"À l'arrivée au parking" },
                      ].map(p => (
                        <div key={p.val}
                          onClick={() => setReservation(prev => ({...prev, paiement: p.val}))}
                          className={`paiement-card border-2 rounded-xl p-3 text-center ${
                            reservation.paiement === p.val ? 'selected' : 'border-slate-200'
                          }`}>
                          <div className="text-2xl mb-1">{p.icon}</div>
                          <div className="font-semibold text-slate-900 text-xs">{p.label}</div>
                          <div className="text-slate-500 text-xs mt-0.5">{p.sub}</div>
                          {reservation.paiement === p.val && (
                            <div className="text-sky-500 text-xs mt-1 font-medium">✓ Sélectionné</div>
                          )}
                        </div>
                      ))}
                    </div>

                    {reservation.paiement === 'carte' && (
                      <div className="mt-3 space-y-2">
                        <input type="text" placeholder="1234 5678 9012 3456" maxLength={19}
                          className="input-focus w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 placeholder-slate-400"/>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="MM/AA"
                            className="input-focus border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 placeholder-slate-400"/>
                          <input type="text" placeholder="CVV"
                            className="input-focus border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 placeholder-slate-400"/>
                        </div>
                        <p className="text-slate-400 text-xs text-center">🔒 Simulé — aucune donnée réelle collectée</p>
                      </div>
                    )}

                    {reservation.paiement === 'especes' && montantTotal() > 0 && (
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                        <p className="text-amber-700 text-xs">
                          💵 Vous paierez <strong>{montantTotal()} MAD</strong> en espèces à votre arrivée.
                        </p>
                      </div>
                    )}
                  </div>

                  {erreurRes && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                      ⚠️ {erreurRes}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={fermerModal}
                      className="border border-slate-200 text-slate-600 py-3 rounded-xl text-sm font-medium hover:bg-slate-50">
                      Annuler
                    </button>
                    <button type="submit" disabled={chargementRes}
                      className="bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                      {chargementRes
                        ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                        : '✅ Confirmer'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
                <h3 style={{fontFamily:"'DM Serif Display'"}} className="text-2xl text-slate-900 mb-2">Place réservée !</h3>
                <p className="text-slate-500 text-sm mb-2"><strong>{parkingSelectionne?.nom}</strong></p>
                {reservation.paiement === 'especes' ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                    <p className="text-amber-700 text-xs">
                      💵 Rappel : payez <strong>{montantTotal()} MAD</strong> en espèces à votre arrivée.
                    </p>
                  </div>
                ) : (
                  <p className="text-emerald-600 text-xs mb-4">💳 Paiement de {montantTotal()} MAD confirmé.</p>
                )}
                <p className="text-slate-400 text-xs mb-6">Votre place vous attend. Présentez-vous à l'heure prévue.</p>
                <div className="flex gap-3">
                  <button onClick={fermerModal}
                    className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-xl text-sm hover:bg-slate-50">
                    Fermer
                  </button>
                  <button onClick={() => { fermerModal(); navigate('/profil'); }}
                    className="flex-1 bg-sky-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-sky-600">
                    Mes réservations
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapPage;