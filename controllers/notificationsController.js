const supabase = require('../supabase');

const mesNotifications = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*, reservations(id, parkings(nom), vehicules(plaque, marque, modele), heure_debut, heure_fin, montant_total, paiement, services_choisis)')
      .eq('utilisateur_id', req.utilisateur.id)
      .order('cree_le', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Notifications] Erreur Supabase:', error.message);
      return res.status(500).json({ erreur: error.message });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

const marquerLue = async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ lue: true })
      .eq('id', req.params.id)
      .eq('utilisateur_id', req.utilisateur.id);

    if (error) return res.status(500).json({ erreur: error.message });
    res.json({ message: 'Notification marquée comme lue' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

const toutMarquerLu = async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ lue: true })
      .eq('utilisateur_id', req.utilisateur.id)
      .eq('lue', false);

    if (error) return res.status(500).json({ erreur: error.message });
    res.json({ message: 'Toutes les notifications marquées comme lues' });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

// Fonction utilitaire interne — appelée depuis d'autres controllers (pas une route)
const creerNotification = async (utilisateur_id, type, titre, message, reservation_id = null) => {
  try {
    await supabase.from('notifications').insert({
      utilisateur_id, type, titre, message, reservation_id,
    });
  } catch (err) {
    console.error('[Notification] Erreur création:', err.message);
  }
};

module.exports = { mesNotifications, marquerLue, toutMarquerLu, creerNotification };