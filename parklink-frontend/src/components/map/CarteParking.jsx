import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';


// Composant navigation active
const NavigationActive = ({ depart, arrivee, onResultat }) => {
  const map = useMap();

  useEffect(() => {
    if (!depart || !arrivee) return;

    const control = L.Routing.control({
      waypoints: [
        L.latLng(depart[0], depart[1]),
        L.latLng(arrivee[0], arrivee[1]),
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      show: false,
      createMarker: () => null,
      lineOptions: {
        styles: [{ color: '#0ea5e9', weight: 6, opacity: 0.9 }],
      },
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        profile: 'driving',
      }),
    });

    control.on('routesfound', (e) => {
      const route = e.routes[0];
      onResultat({
        distanceKm: Math.round(route.summary.totalDistance / 100) / 10,
        dureeMin: Math.round(route.summary.totalTime / 60),
        instructions: route.legs[0].steps.map(step => ({
          texte: formaterInstruction(step),
          distanceM: Math.round(step.distance),
          type: step.maneuver.type,
          modifier: step.maneuver.modifier || '',
          coordonnees: [step.maneuver.location[1], step.maneuver.location[0]],
        })),
      });
      map.fitBounds(
        [[depart[0], depart[1]], [arrivee[0], arrivee[1]]],
        { padding: [60, 60] }
      );
    });

    control.addTo(map);
    return () => { try { map.removeControl(control); } catch {} };
  }, [depart, arrivee, map]);

  return null;
};

const formaterInstruction = (step) => {
  const rue = step.name || '';
  const suffixe = rue ? ` sur ${rue}` : '';
  const dist = step.distance < 1000
    ? `${Math.round(step.distance)} m`
    : `${Math.round(step.distance / 100) / 10} km`;

  const map = {
    'depart':      `Démarrez${suffixe}`,
    'arrive':      `Vous êtes arrivé`,
    'turn': {
      'left':        `Tournez à gauche${suffixe}`,
      'right':       `Tournez à droite${suffixe}`,
      'slight left': `Légèrement à gauche${suffixe}`,
      'slight right':`Légèrement à droite${suffixe}`,
      'sharp left':  `Virage serré à gauche${suffixe}`,
      'sharp right': `Virage serré à droite${suffixe}`,
      'uturn':       `Demi-tour${suffixe}`,
    },
    'new name':    { default: `Continuez${suffixe}` },
    'merge':       { default: `Rejoignez${suffixe}` },
    'roundabout':  { default: `Prenez le rond-point${suffixe}` },
    'fork':        {
      'left':  `Gardez la gauche${suffixe}`,
      'right': `Gardez la droite${suffixe}`,
      default: `Continuez${suffixe}`,
    },
    'end of road': {
      'left':  `Au bout de la route, tournez à gauche`,
      'right': `Au bout de la route, tournez à droite`,
      default: `Au bout de la route`,
    },
  };

  const typeMap = map[step.maneuver.type];
  let texte;
  if (typeof typeMap === 'string') texte = typeMap;
  else if (typeof typeMap === 'object') {
    texte = typeMap[step.maneuver.modifier] || typeMap['default'] || `Continuez${suffixe}`;
  } else {
    texte = `Continuez${suffixe}`;
  }

  if (step.maneuver.type !== 'arrive') texte += ` — dans ${dist}`;
  return texte;
};

// Composant qui suit la position pendant la navigation
const SuivrePosition = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, 17, { animate: true, duration: 0.5 });
  }, [position, map]);
  return null;
};

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const creerIcone = (couleur, taille, selectionne) => new L.DivIcon({
  html: `<div style="
    background:${couleur};
    border:${selectionne ? '4px' : '3px'} solid white;
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg) scale(${selectionne ? 1.3 : 1});
    width:${taille}px; height:${taille}px;
    box-shadow:${selectionne ? '0 6px 20px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.2)'};
    display:flex;align-items:center;justify-content:center;
    transition:all 0.2s;">
    <span style="transform:rotate(45deg);font-size:${taille * 0.45}px;">🅿️</span>
  </div>`,
  className: '',
  iconSize: [taille, taille],
  iconAnchor: [taille / 2, taille],
  popupAnchor: [0, -(taille + 4)],
});

// Icône destination
const iconDestination = new L.DivIcon({
  html: `<div style="
    background:#10b981;
    border:3px solid white;
    border-radius:50%;
    width:20px;height:20px;
    box-shadow:0 2px 8px rgba(0,0,0,0.3);
  "></div>`,
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});



const AjusterVue = ({ coordsDestination }) => {
  const map = useMap();
  useEffect(() => {
    if (!coordsDestination) return;
    // Zoom qui montre un rayon d'environ 1.5km autour de la destination
    map.setView([coordsDestination.lat, coordsDestination.lng], 15, { animate: true, duration: 1 });
  }, [coordsDestination, map]);
  return null;
};

// ── Trace l'itinéraire entre deux points via OSRM (service public gratuit, sans clé API)
const ItineraireDouble = ({ parking, destination, positionUser }) => {
  const map = useMap();

  useEffect(() => {
    // GPS requis — sans position, aucun itinéraire affiché
    if (!positionUser || !parking) return;

    const controles = [];

    // Segment 1 — conducteur → parking (bleu, voiture)
    const ctrlVoiture = L.Routing.control({
      waypoints: [
        L.latLng(positionUser[0], positionUser[1]),
        L.latLng(parking.latitude, parking.longitude),
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      show: false,
      createMarker: () => null,
      lineOptions: {
        styles: [{ color: '#0ea5e9', weight: 5, opacity: 0.8 }],
      },
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        profile: 'driving',
      }),
    }).addTo(map);
    controles.push(ctrlVoiture);

    // Segment 2 — parking → destination (vert, piéton)
    // Affiché uniquement si destination saisie ET segment 1 disponible (GPS requis)
    if (destination) {
      const ctrlPieton = L.Routing.control({
        waypoints: [
          L.latLng(parking.latitude, parking.longitude),
          L.latLng(destination.lat, destination.lng),
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        show: false,
        createMarker: () => null,
        lineOptions: {
          styles: [{ color: '#10b981', weight: 4, opacity: 0.8, dashArray: '8 4' }],
        },
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1',
          profile: 'foot',
        }),
      }).addTo(map);
      controles.push(ctrlPieton);
    }

    return () => {
      controles.forEach(c => { try { map.removeControl(c); } catch {} });
    };
  }, [parking, destination, positionUser, map]);

  return null;
};

const iconUser = new L.DivIcon({
  html: `<div style="background:#6366f1;border:3px solid white;border-radius:50%;width:18px;height:18px;box-shadow:0 0 0 5px rgba(99,102,241,0.25);"></div>`,
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const CarteParking = ({
  parkings, positionUser, onParkingClick, coordsDestination,
  parkingSelectionneId, modeNavigation, parkingDestinationNav,
  setDistanceRestante, setDureeRestante, setInstructionsNav,
}) => {
  const centre = positionUser || [33.5731, -7.6298];

  return (
    <MapContainer center={centre} zoom={13}
      style={{ height: '100%', width: '100%', zIndex: 0 }}
      zoomControl={false}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'
      />


   

      {coordsDestination && <AjusterVue coordsDestination={coordsDestination} />}

      {/* Itinéraire double — GPS requis */}
      {parkingSelectionneId && positionUser && (() => {
        const p = parkings.find(pk => pk.id === parkingSelectionneId);
        return p ? (
          <ItineraireDouble
            parking={p}
            destination={coordsDestination}
            positionUser={positionUser}
          />
        ) : null;
      })()}

      {positionUser && (
        <Marker position={positionUser} icon={iconUser}>
          <Popup>Vous êtes ici</Popup>
        </Marker>
      )}
      {parkings.map((p) => {
        const selectionne = p.id === parkingSelectionneId;
        const couleur = p.places_disponibles > 0
          ? (selectionne ? '#0369a1' : '#0ea5e9')
          : (selectionne ? '#b91c1c' : '#ef4444');
        const taille = selectionne ? 38 : 30;
        return (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={creerIcone(couleur, taille, selectionne)}
            eventHandlers={{ click: () => onParkingClick(p) }}>
            <Popup>
              <div style={{fontFamily:'sans-serif', minWidth:'150px'}}>
                <div style={{fontWeight:600, marginBottom:'4px'}}>{p.nom}</div>
                <div style={{fontSize:'12px', color:'#64748b', marginBottom:'6px'}}>{p.adresse}</div>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span style={{fontWeight:600, color:'#0ea5e9'}}>{p.tarif_horaire} MAD/h</span>
                  <span style={{fontSize:'11px', padding:'2px 8px', borderRadius:'20px',
                    background: p.places_disponibles > 0 ? '#dcfce7' : '#fee2e2',
                    color: p.places_disponibles > 0 ? '#16a34a' : '#dc2626'}}>
                    {p.places_disponibles > 0 ? `${p.places_disponibles} places` : 'Complet'}
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
      {coordsDestination && (
        <Marker position={[coordsDestination.lat, coordsDestination.lng]} icon={iconDestination}>
          <Popup>🏁 Votre destination</Popup>
        </Marker>
      )}

      {modeNavigation && positionUser && parkingDestinationNav && (
        <NavigationActive
          depart={positionUser}
          arrivee={[parkingDestinationNav.latitude, parkingDestinationNav.longitude]}
          onResultat={({ distanceKm, dureeMin, instructions }) => {
            setDistanceRestante(distanceKm);
            setDureeRestante(dureeMin);
            setInstructionsNav(instructions);
          }}
        />
      )}
      {modeNavigation && positionUser && <SuivrePosition position={positionUser} />}
    </MapContainer>
  );
};

export default CarteParking;