const supabase = require('../supabase');

// GET /parkings — liste les parkings actifs (avec filtre géo optionnel)
const lister = async (req, res) => {
  try {
    const { lat, lng, rayon = 10 } = req.query;

    let query = supabase
      .from('parkings')
      .select('*')
      .eq('statut', 'actif');

    const { data, error } = await query;
    if (error) throw error;

    // Filtre par distance si lat/lng fournis
    let resultats = data;
    if (lat && lng) {
      resultats = data.filter(p => {
        const dist = calculerDistance(parseFloat(lat), parseFloat(lng), p.latitude, p.longitude);
        p.distance_km = Math.round(dist * 10) / 10;
        return dist <= parseFloat(rayon);
      }).sort((a, b) => a.distance_km - b.distance_km);
    }

    res.json(resultats);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

// GET /parkings/:id — détail d'un parking
const detail = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('parkings')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ erreur: 'Parking introuvable' });

    res.json(data);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

// POST /parkings — créer un parking (gestionnaire)
const creer = async (req, res) => {
  const {
    nom, adresse, latitude, longitude, osm_id, zone_geo, source_coords,
    capacite_totale, tarif_horaire, tarif_journalier,
    horaire_ouverture, horaire_fermeture, type
  } = req.body;

  if (!nom || !adresse || !latitude || !longitude || !tarif_horaire || !capacite_totale) {
    return res.status(400).json({ erreur: 'Champs obligatoires manquants' });
  }

  try {
    const { data, error } = await supabase
      .from('parkings')
      .insert([{
        gestionnaire_id: req.utilisateur.id,
        nom, adresse, latitude, longitude,
        osm_id: osm_id || null,
        zone_geo: zone_geo || null,
        source_coords: source_coords || 'manuel',
        capacite_totale,
        places_disponibles: capacite_totale,
        tarif_horaire, tarif_journalier: tarif_journalier || null,
        horaire_ouverture: horaire_ouverture || null,
        horaire_fermeture: horaire_fermeture || null,
        type: type || 'public',
        statut: 'en_attente_validation'
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ message: 'Parking soumis pour validation', parking: data });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

// PATCH /parkings/:id/disponibilite — mise à jour manuelle des places (gestionnaire/gilet jaune)
const mettreAJourDisponibilite = async (req, res) => {
  const { places_disponibles } = req.body;

  if (places_disponibles === undefined || places_disponibles < 0) {
    return res.status(400).json({ erreur: 'Valeur invalide' });
  }

  try {
    const { data: parking } = await supabase
      .from('parkings')
      .select('gestionnaire_id, capacite_totale')
      .eq('id', req.params.id)
      .single();

    if (!parking) return res.status(404).json({ erreur: 'Parking introuvable' });

    if (places_disponibles > parking.capacite_totale) {
      return res.status(400).json({ erreur: 'Impossible de dépasser la capacité totale' });
    }

    const { data, error } = await supabase
      .from('parkings')
      .update({ places_disponibles })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'Disponibilité mise à jour', parking: data });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

// PATCH /parkings/:id/statut — valider ou suspendre (admin)
const changerStatut = async (req, res) => {
  const { statut } = req.body;
  const statutsValides = ['actif', 'suspendu', 'en_attente_validation'];

  if (!statutsValides.includes(statut)) {
    return res.status(400).json({ erreur: 'Statut invalide' });
  }

  try {
    const { data, error } = await supabase
      .from('parkings')
      .update({ statut })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: `Parking ${statut}`, parking: data });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

// Calcul distance Haversine (en km) entre deux coordonnées GPS
function calculerDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { lister, detail, creer, mettreAJourDisponibilite, changerStatut };