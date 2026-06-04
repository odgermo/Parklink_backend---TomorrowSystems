const supabase = require('../supabase');

// POST /reservations — créer une réservation
const creer = async (req, res) => {
  const { parking_id, vehicule_id, heure_debut, heure_fin } = req.body;

  if (!parking_id || !heure_debut || !heure_fin) {
    return res.status(400).json({ erreur: 'Champs obligatoires manquants' });
  }

  const debut = new Date(heure_debut);
  const fin = new Date(heure_fin);

  if (fin <= debut) {
    return res.status(400).json({ erreur: 'heure_fin doit être après heure_debut' });
  }

  try {
    // 1. Vérifier que le parking existe et est actif
    const { data: parking, error: errParking } = await supabase
      .from('parkings')
      .select('id, nom, places_disponibles, tarif_horaire, statut')
      .eq('id', parking_id)
      .single();

    if (errParking || !parking) {
      return res.status(404).json({ erreur: 'Parking introuvable' });
    }

    if (parking.statut !== 'actif') {
      return res.status(400).json({ erreur: 'Ce parking n\'est pas disponible' });
    }

    // 2. Vérifier qu'il reste des places
    if (parking.places_disponibles <= 0) {
      return res.status(400).json({ erreur: 'Plus de places disponibles dans ce parking' });
    }

    // 3. Calculer le montant
    const dureeHeures = (fin - debut) / (1000 * 60 * 60);
    const montant = Math.round(dureeHeures * parking.tarif_horaire * 100) / 100;

    // 4. Créer la réservation
    const { data: reservation, error: errRes } = await supabase
      .from('reservations')
      .insert([{
        conducteur_id: req.utilisateur.id,
        parking_id,
        vehicule_id: vehicule_id || null,
        heure_debut: debut.toISOString(),
        heure_fin: fin.toISOString(),
        montant_total: montant,
        statut: 'confirmee'
      }])
      .select()
      .single();

    if (errRes) throw errRes;

    // 5. Décrémenter les places disponibles
    const { error: errUpdate } = await supabase
      .from('parkings')
      .update({ places_disponibles: parking.places_disponibles - 1 })
      .eq('id', parking_id);

    if (errUpdate) throw errUpdate;

    // 6. Créer le paiement simulé
    const { error: errPaiement } = await supabase
      .from('paiements')
      .insert([{
        reservation_id: reservation.id,
        montant,
        methode: 'simule',
        statut: 'simule',
        reference: `SIM-${Date.now()}`
      }]);

    if (errPaiement) throw errPaiement;

    res.status(201).json({
      message: 'Réservation confirmée',
      reservation,
      paiement: {
        montant,
        statut: 'simule',
        reference: `SIM-${reservation.id.slice(0, 8).toUpperCase()}`
      }
    });

  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

// GET /reservations/moi — historique du conducteur connecté
const meReservations = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        id, heure_debut, heure_fin, montant_total, statut, cree_le,
        parkings (nom, adresse, tarif_horaire),
        vehicules (plaque, marque, modele)
      `)
      .eq('conducteur_id', req.utilisateur.id)
      .order('cree_le', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

// GET /reservations/:id — détail d'une réservation
const detail = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        id, heure_debut, heure_fin, montant_total, statut, cree_le,
        parkings (nom, adresse),
        vehicules (plaque, marque, modele),
        paiements (montant, statut, reference, paye_le)
      `)
      .eq('id', req.params.id)
      .eq('conducteur_id', req.utilisateur.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ erreur: 'Réservation introuvable' });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

// PATCH /reservations/:id/annuler — annuler une réservation
const annuler = async (req, res) => {
  try {
    // 1. Récupérer la réservation
    const { data: reservation, error } = await supabase
      .from('reservations')
      .select('id, statut, parking_id, conducteur_id, heure_debut')
      .eq('id', req.params.id)
      .single();

    if (error || !reservation) {
      return res.status(404).json({ erreur: 'Réservation introuvable' });
    }

    // 2. Vérifier que c'est bien sa réservation
    if (reservation.conducteur_id !== req.utilisateur.id) {
      return res.status(403).json({ erreur: 'Accès refusé' });
    }

    // 3. Vérifier qu'elle est annulable
    if (!['en_attente', 'confirmee'].includes(reservation.statut)) {
      return res.status(400).json({ erreur: 'Cette réservation ne peut plus être annulée' });
    }

    // 4. Annuler
    const { data: updated, error: errUpdate } = await supabase
      .from('reservations')
      .update({ statut: 'annulee' })
      .eq('id', req.params.id)
      .select()
      .single();

    if (errUpdate) throw errUpdate;

    // 5. Réincrémenter les places disponibles
    const { data: parking } = await supabase
      .from('parkings')
      .select('places_disponibles, capacite_totale')
      .eq('id', reservation.parking_id)
      .single();

    await supabase
      .from('parkings')
      .update({
        places_disponibles: Math.min(parking.places_disponibles + 1, parking.capacite_totale)
      })
      .eq('id', reservation.parking_id);

    res.json({ message: 'Réservation annulée', reservation: updated });

  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

module.exports = { creer, meReservations, detail, annuler };