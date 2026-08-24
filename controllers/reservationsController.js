const supabase = require('../supabase');
const { creerNotification } = require('./notificationsController');

const creer = async (req, res) => {
  const { parking_id, vehicule_id, heure_debut, heure_fin, services_choisis = [] } = req.body;
  const conducteur_id = req.utilisateur.id;
  const { paiement } = req.body;

  try {
    const { data: parking, error: errParking } = await supabase
      .from('parkings')
      .select('id, nom, tarif_horaire, places_disponibles, services, statut')
      .eq('id', parking_id)
      .single();

    if (errParking || !parking) return res.status(404).json({ erreur: 'Parking introuvable' });
    if (parking.statut !== 'actif') return res.status(400).json({ erreur: 'Ce parking n\'est pas actif' });
    if (parking.places_disponibles <= 0) return res.status(400).json({ erreur: 'Aucune place disponible' });

    const debut = new Date(heure_debut);
    const fin   = new Date(heure_fin);
    if (fin <= debut) return res.status(400).json({ erreur: 'L\'heure de fin doit être après l\'heure de début' });

    const dureeHeures = (fin - debut) / (1000 * 60 * 60);
    const servicesParking = parking.services || {};
    const servicesValides = services_choisis.filter(id => servicesParking[id] !== undefined);

    let montantServices = 0;
    for (const id of servicesValides) {
      montantServices += Number(servicesParking[id]);
    }

    const montantStationnement = Math.round(parking.tarif_horaire * dureeHeures * 100) / 100;
    const montant_total = Math.round((montantStationnement + montantServices) * 100) / 100;
    const statut_service = servicesValides.length > 0 ? 'en_attente' : null;

    const { data: reservation, error: errRes } = await supabase
      .from('reservations')
      .insert({
        conducteur_id,
        parking_id,
        vehicule_id,
        heure_debut,
        heure_fin,
        montant_total,
        services_choisis: servicesValides,
        statut: 'confirmee',
        statut_service,
        paiement: paiement || 'carte',
      })
      .select()
      .single();

    if (errRes) return res.status(500).json({ erreur: 'Erreur création réservation', detail: errRes.message });

    await supabase
      .from('parkings')
      .update({ places_disponibles: parking.places_disponibles - 1 })
      .eq('id', parking_id);

    const dateDebut  = new Date(heure_debut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' });
    const heureDebut = new Date(heure_debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const heureFin   = new Date(heure_fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const servicesLabel = servicesValides.length > 0 ? ` Services : ${servicesValides.join(', ')}.` : '';

    await creerNotification(
      conducteur_id,
      'reservation_confirmee',
      '✅ Réservation confirmée',
      `Votre place chez "${parking.nom || 'parking'}" est confirmée pour le ${dateDebut} de ${heureDebut} à ${heureFin}.${servicesLabel} Montant : ${montant_total} MAD · Paiement : ${paiement === 'especes' ? 'Espèces' : 'Carte bancaire'}.`,
      reservation.id
    );

    res.status(201).json({
      ...reservation,
      detail_montant: {
        stationnement: montantStationnement,
        services: montantServices,
        total: montant_total,
        duree_heures: Math.round(dureeHeures * 100) / 100,
      }
    });

  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

const meReservations = async (req, res) => {
  const conducteur_id = req.utilisateur.id;
  const { historique, filtre } = req.query;

  try {
    let statutsFiltres;
    if (historique === 'true') {
      statutsFiltres = filtre === 'annulee' ? ['annulee'] : ['terminee', 'annulee'];
    } else {
      statutsFiltres = ['confirmee'];
    }

    const { data, error } = await supabase
      .from('reservations')
      .select(`
        *,
        parkings (id, nom, adresse, tarif_horaire, services),
        vehicules (plaque, marque, modele)
      `)
      .eq('conducteur_id', conducteur_id)
      .in('statut', statutsFiltres)
      .order('heure_debut', { ascending: false });

    if (error) return res.status(500).json({ erreur: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

// ── CORRECTION PRINCIPALE : gère gestionnaire ET gilet_jaune ──────────────────
const reservationsGestionnaire = async (req, res) => {
  const userId = req.utilisateur.id;
  const role   = req.utilisateur.role;
  const { historique } = req.query;

  try {
    // Récupérer les parkings selon le rôle
    let query = supabase.from('parkings').select('id, nom');

    if (role === 'gestionnaire') {
      query = query.eq('gestionnaire_id', userId);
    } else if (role === 'gilet_jaune') {
      query = query.eq('gilet_jaune_id', userId);
    } else if (role === 'admin') {
      // pas de filtre — tout voir
    } else {
      return res.status(403).json({ erreur: 'Non autorisé' });
    }

    const { data: mesParkings, error: errParkings } = await query;
    if (errParkings) return res.status(500).json({ erreur: errParkings.message });
    if (!mesParkings || mesParkings.length === 0) return res.json([]);

    const parkingIds = mesParkings.map(p => p.id);

    const statutsFiltres = historique === 'true'
      ? ['terminee', 'annulee']
      : ['confirmee'];

    const { data, error } = await supabase
      .from('reservations')
      .select(`
        *,
        parkings (id, nom, adresse),
        vehicules (plaque, marque, modele, couleur),
        users:conducteur_id (prenom, nom, telephone)
      `)
      .in('parking_id', parkingIds)
      .in('statut', statutsFiltres)
      .order('heure_debut', { ascending: true });

    if (error) return res.status(500).json({ erreur: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

const confirmerService = async (req, res) => {
  const { id } = req.params;
  const userId = req.utilisateur.id;
  const role   = req.utilisateur.role;

  try {
    const { data: reservation, error: errRes } = await supabase
      .from('reservations')
      .select('id, statut_service, parking_id, parkings(gestionnaire_id, gilet_jaune_id)')
      .eq('id', id)
      .single();

    if (errRes || !reservation) return res.status(404).json({ erreur: 'Réservation introuvable' });

    const p = reservation.parkings;
    const estProprietaire =
      (role === 'gestionnaire' && p?.gestionnaire_id === userId) ||
      (role === 'gilet_jaune'  && p?.gilet_jaune_id  === userId) ||
      role === 'admin';

    if (!estProprietaire) return res.status(403).json({ erreur: 'Non autorisé' });
    if (reservation.statut_service !== 'en_attente') return res.status(400).json({ erreur: 'Aucun service en attente' });

    const { data, error } = await supabase
      .from('reservations')
      .update({ statut_service: 'confirmee' })
      .eq('id', id)
      .select()
      .single();

    const { data: resInfo } = await supabase
      .from('reservations')
      .select('conducteur_id, parkings(nom)')
      .eq('id', id)
      .single();

    if (resInfo) {
      await creerNotification(
        resInfo.conducteur_id,
        'service_confirme',
        '✅ Service confirmé',
        `Le service extra demandé chez "${resInfo.parkings?.nom}" a été confirmé.`,
        id
      );
    }

    if (error) return res.status(500).json({ erreur: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

const refuserService = async (req, res) => {
  const { id } = req.params;
  const userId = req.utilisateur.id;
  const role   = req.utilisateur.role;

  try {
    const { data: reservation, error: errRes } = await supabase
      .from('reservations')
      .select('id, statut_service, montant_total, heure_debut, heure_fin, parking_id, parkings(gestionnaire_id, gilet_jaune_id, tarif_horaire)')
      .eq('id', id)
      .single();

    if (errRes || !reservation) return res.status(404).json({ erreur: 'Réservation introuvable' });

    const p = reservation.parkings;
    const estProprietaire =
      (role === 'gestionnaire' && p?.gestionnaire_id === userId) ||
      (role === 'gilet_jaune'  && p?.gilet_jaune_id  === userId) ||
      role === 'admin';

    if (!estProprietaire) return res.status(403).json({ erreur: 'Non autorisé' });
    if (reservation.statut_service !== 'en_attente') return res.status(400).json({ erreur: 'Aucun service en attente' });

    const debut = new Date(reservation.heure_debut);
    const fin   = new Date(reservation.heure_fin);
    const dureeHeures = (fin - debut) / (1000 * 60 * 60);
    const montant_total = Math.round(p.tarif_horaire * dureeHeures * 100) / 100;

    const { data, error } = await supabase
      .from('reservations')
      .update({ statut_service: 'refuse', montant_total, services_choisis: [] })
      .eq('id', id)
      .select()
      .single();

    const { data: resInfo } = await supabase
      .from('reservations')
      .select('conducteur_id, parkings(nom)')
      .eq('id', id)
      .single();

    if (resInfo) {
      await creerNotification(
        resInfo.conducteur_id,
        'service_refuse',
        '❌ Service indisponible',
        `Le service extra demandé chez "${resInfo.parkings?.nom}" n'est pas disponible. Le montant a été ajusté.`,
        id
      );
    }

    if (error) return res.status(500).json({ erreur: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

const terminerReservation = async (req, res) => {
  const { id } = req.params;
  const userId = req.utilisateur.id;
  const role   = req.utilisateur.role;

  try {
    const { data: reservation, error: errRes } = await supabase
      .from('reservations')
      .select('id, statut, parking_id, parkings(gestionnaire_id, gilet_jaune_id, places_disponibles, capacite_totale)')
      .eq('id', id)
      .single();

    if (errRes || !reservation) return res.status(404).json({ erreur: 'Réservation introuvable' });

    const p = reservation.parkings;
    const estProprietaire =
      (role === 'gestionnaire' && p?.gestionnaire_id === userId) ||
      (role === 'gilet_jaune'  && p?.gilet_jaune_id  === userId) ||
      role === 'admin';

    if (!estProprietaire) return res.status(403).json({ erreur: 'Non autorisé' });
    if (reservation.statut !== 'confirmee') return res.status(400).json({ erreur: 'Seules les réservations confirmées peuvent être terminées' });

    const { data, error } = await supabase
      .from('reservations')
      .update({ statut: 'terminee' })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ erreur: error.message });

    await supabase
      .from('parkings')
      .update({ places_disponibles: Math.min((p.places_disponibles || 0) + 1, p.capacite_totale) })
      .eq('id', reservation.parking_id);

    res.json(data);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

const detail = async (req, res) => {
  const { id } = req.params;
  const userId = req.utilisateur.id;
  const role   = req.utilisateur.role;

  try {
    const { data, error } = await supabase
      .from('reservations')
      .select(`*, parkings (id, nom, adresse, tarif_horaire, gestionnaire_id, gilet_jaune_id, services), vehicules (plaque, marque, modele), users:conducteur_id (prenom, nom)`)
      .eq('id', id)
      .single();

    if (error || !data) return res.status(404).json({ erreur: 'Réservation introuvable' });

    const estConducteur   = data.conducteur_id === userId;
    const estGestionnaire = role === 'gestionnaire' && data.parkings?.gestionnaire_id === userId;
    const estGiletJaune   = role === 'gilet_jaune'  && data.parkings?.gilet_jaune_id  === userId;
    const estAdmin        = role === 'admin';

    if (!estConducteur && !estGestionnaire && !estGiletJaune && !estAdmin) {
      return res.status(403).json({ erreur: 'Non autorisé' });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

const annuler = async (req, res) => {
  const { id } = req.params;
  const conducteur_id = req.utilisateur.id;

  try {
    const { data: reservation, error: errRes } = await supabase
      .from('reservations')
      .select('id, statut, parking_id, conducteur_id')
      .eq('id', id)
      .single();

    if (errRes || !reservation) return res.status(404).json({ erreur: 'Réservation introuvable' });
    if (reservation.conducteur_id !== conducteur_id) return res.status(403).json({ erreur: 'Non autorisé' });
    if (!['confirmee'].includes(reservation.statut)) return res.status(400).json({ erreur: 'Cette réservation ne peut pas être annulée' });

    const { data, error } = await supabase
      .from('reservations')
      .update({ statut: 'annulee' })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ erreur: error.message });

    const { data: parking } = await supabase
      .from('parkings')
      .select('places_disponibles, capacite_totale')
      .eq('id', reservation.parking_id)
      .single();

    if (parking) {
      await supabase
        .from('parkings')
        .update({ places_disponibles: Math.min(parking.places_disponibles + 1, parking.capacite_totale) })
        .eq('id', reservation.parking_id);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

const verifierTicket = async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        id, statut, statut_service, heure_debut, heure_fin, montant_total, paiement, services_choisis,
        parkings (nom, adresse),
        vehicules (plaque, marque, modele, couleur),
        users:conducteur_id (prenom, nom)
      `)
      .eq('id', id)
      .single();

    if (error || !data) return res.status(404).json({ erreur: 'Réservation introuvable' });

    res.json(data);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

module.exports = {
  // ... exports existants
  verifierTicket,
};

module.exports = {
  creer,
  meReservations,
  reservationsGestionnaire,
  confirmerService,
  refuserService,
  terminerReservation,
  detail,
  annuler,
  verifierTicket,
};