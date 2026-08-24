const supabase = require('../supabase');

const cloturerReservationsExpirees = async () => {
  try {
    const maintenant = new Date().toISOString();
    console.log('[CRON] Heure de comparaison (UTC):', maintenant);

    const { data: reservationsExpirees, error: errFetch } = await supabase
      .from('reservations')
      .select('id, heure_fin, statut, parking_id, parkings(places_disponibles, capacite_totale)')
      .eq('statut', 'confirmee')
      .lt('heure_fin', maintenant);

    console.log('[CRON] Réservations confirmées trouvées avec heure_fin < maintenant:', reservationsExpirees?.length || 0);
    if (reservationsExpirees?.length > 0) {
      console.log('[CRON] Détail:', JSON.stringify(reservationsExpirees, null, 2));
    }

    if (errFetch) {
      console.error('[CRON] Erreur récupération réservations:', errFetch.message);
      return;
    }
    

    if (!reservationsExpirees || reservationsExpirees.length === 0) return;

    console.log(`[CRON] ${reservationsExpirees.length} réservation(s) à clôturer`);

    for (const res of reservationsExpirees) {
      // Passer la réservation en "terminee"
      const { error: errUpdate } = await supabase
        .from('reservations')
        .update({ statut: 'terminee' })
        .eq('id', res.id);

      if (errUpdate) {
        console.error(`[CRON] Erreur clôture réservation ${res.id}:`, errUpdate.message);
        continue;
      }

      // Réincrémenter les places disponibles du parking
      const parking = res.parkings;
      if (!parking) continue;

      const nouvelleDispo = Math.min(
        (parking.places_disponibles || 0) + 1,
        parking.capacite_totale
      );

      const { error: errDispo } = await supabase
        .from('parkings')
        .update({ places_disponibles: nouvelleDispo })
        .eq('id', res.parking_id);

      if (errDispo) {
        console.error(`[CRON] Erreur réincrément places parking ${res.parking_id}:`, errDispo.message);
      }
    }

    console.log(`[CRON] Clôture terminée — ${reservationsExpirees.length} réservation(s) traitée(s)`);

  } catch (err) {
    console.error('[CRON] Erreur inattendue:', err.message);
  }
};

module.exports = cloturerReservationsExpirees;