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
    horaire_ouverture, horaire_fermeture,
    infrastructure, mode_gestion, source_disponibilite, api_url, services
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
        tarif_horaire,
        tarif_journalier: tarif_journalier || null,
        horaire_ouverture: horaire_ouverture || null,
        horaire_fermeture: horaire_fermeture || null,
        infrastructure: infrastructure || 'surface',
        mode_gestion: mode_gestion || 'public',
        services: services || [],
        vehicules_acceptes: req.body.vehicules_acceptes || ['petit', 'moyen', 'grand'],
        hauteur_limite: req.body.hauteur_limite ? parseFloat(req.body.hauteur_limite) : null,
        description: req.body.description || null,
        source_disponibilite: source_disponibilite || 'manuel',
        api_url: api_url || null,
        statut: 'en_attente_validation'
      }])
      .select()
      .single();

    if (error) {
      console.log('ERREUR SUPABASE:', error);
      throw error;
    }

    res.status(201).json({ message: 'Parking soumis pour validation', parking: data });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

const modifier = async (req, res) => {
  const {
    nom, adresse, latitude, longitude,
    tarif_horaire, tarif_journalier,
    horaire_ouverture, horaire_fermeture,
    infrastructure, mode_gestion, capacite_totale,
    source_disponibilite, api_url, services,
    vehicules_acceptes, hauteur_limite, description,
  } = req.body;

  try {
    // Récupérer le parking avec les deux colonnes de propriété
    const { data: parking } = await supabase
      .from('parkings')
      .select('gestionnaire_id, gilet_jaune_id, statut')
      .eq('id', req.params.id)
      .single();

    if (!parking) return res.status(404).json({ erreur: 'Parking introuvable' });

    const userId = req.utilisateur.id;
    const role   = req.utilisateur.role;

    // Vérification de propriété adaptée au rôle
    const estProprietaire =
      (role === 'gestionnaire' && parking.gestionnaire_id === userId) ||
      (role === 'gilet_jaune'  && parking.gilet_jaune_id === userId) ||
      role === 'admin';

    if (!estProprietaire) {
      return res.status(403).json({ erreur: 'Accès refusé' });
    }

    const updates = {};
    if (nom) updates.nom = nom;
    if (adresse) updates.adresse = adresse;
    if (latitude !== undefined) updates.latitude = parseFloat(latitude);
    if (longitude !== undefined) updates.longitude = parseFloat(longitude);
    if (tarif_horaire) updates.tarif_horaire = parseFloat(tarif_horaire);
    if (tarif_journalier !== undefined) updates.tarif_journalier = tarif_journalier ? parseFloat(tarif_journalier) : null;
    if (horaire_ouverture) updates.horaire_ouverture = horaire_ouverture;
    if (horaire_fermeture) updates.horaire_fermeture = horaire_fermeture;
    if (infrastructure) updates.infrastructure = infrastructure;
    if (mode_gestion) updates.mode_gestion = mode_gestion;
    if (capacite_totale) updates.capacite_totale = parseInt(capacite_totale);
    if (services !== undefined) updates.services = services;
    if (source_disponibilite) updates.source_disponibilite = source_disponibilite;
    if (api_url !== undefined) updates.api_url = api_url || null;
    if (vehicules_acceptes !== undefined) updates.vehicules_acceptes = vehicules_acceptes;
    if (hauteur_limite !== undefined) updates.hauteur_limite = hauteur_limite ? parseFloat(hauteur_limite) : null;
    if (description !== undefined) updates.description = description || null;

    // Toute modification remet en attente de validation
    updates.statut = 'en_attente_validation';

    const { data, error } = await supabase
      .from('parkings')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'Parking mis à jour — en attente de validation', parking: data });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};


const mesParkings = async (req, res) => {
  const userId = req.utilisateur.id;
  const role   = req.utilisateur.role;

  try {
    let query = supabase.from('parkings').select('*');

    if (role === 'gestionnaire') {
      query = query.eq('gestionnaire_id', userId);
    } else if (role === 'gilet_jaune') {
      query = query.eq('gilet_jaune_id', userId);
    } else if (role === 'admin') {
      // pas de filtre
    } else {
      return res.status(403).json({ erreur: 'Non autorisé' });
    }

    const { data, error } = await query.order('cree_le', { ascending: false });
    if (error) return res.status(500).json({ erreur: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

const creerZoneGiletJaune = async (req, res) => {
  const gilet_jaune_id = req.utilisateur.id;
  const {
    nom, adresse, latitude, longitude,
    capacite_totale, tarif_horaire, tarif_journalier,
    horaire_ouverture, horaire_fermeture,
    description, services, vehicules_acceptes,
  } = req.body;

  if (!nom || !adresse || !latitude || !longitude || !capacite_totale) {
    return res.status(400).json({ erreur: 'Nom, adresse, coordonnées et capacité sont obligatoires' });
  }

  try {
    // Un gilet jaune ne peut avoir qu'une seule zone
    const { data: zoneExistante } = await supabase
      .from('parkings')
      .select('id')
      .eq('gilet_jaune_id', gilet_jaune_id)
      .not('statut', 'eq', 'suspendu')
      .maybeSingle();

    if (zoneExistante) {
      return res.status(400).json({
        erreur: 'Vous avez déjà une zone déclarée. Modifiez-la depuis votre dashboard.'
      });
    }

    const { data, error } = await supabase
      .from('parkings')
      .insert({
        gilet_jaune_id,
        gestionnaire_id: null,
        nom,
        adresse,
        latitude:          parseFloat(latitude),
        longitude:         parseFloat(longitude),
        capacite_totale:   parseInt(capacite_totale),
        places_disponibles: parseInt(capacite_totale),
        tarif_horaire:     tarif_horaire ? parseFloat(tarif_horaire) : 2,
        tarif_journalier:  tarif_journalier ? parseFloat(tarif_journalier) : null,
        horaire_ouverture: horaire_ouverture || '07:00',
        horaire_fermeture: horaire_fermeture || '22:00',
        description:       description || null,
        infrastructure:    'surface',
        mode_gestion:      'gilet_jaune',
        source_coords:     'manuel',
        source_disponibilite: 'manuel',
        statut:            'en_attente_validation', // validation admin requise
        vehicules_acceptes: vehicules_acceptes || ['voiture', 'moto'],
        services:          services || {},
      })
      .select()
      .single();

    if (error) return res.status(500).json({ erreur: error.message });
    res.status(201).json(data);
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

module.exports = { lister, detail, creer, modifier, mesParkings, creerZoneGiletJaune, mettreAJourDisponibilite, changerStatut };