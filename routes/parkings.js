const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { lister, detail, creer, modifier, mesParkings, creerZoneGiletJaune, mettreAJourDisponibilite, changerStatut } = require('../controllers/parkingsController');
const { verifierToken, autoriser } = require('../middleware/auth');

router.get('/', lister);
router.get('/mes-parkings', verifierToken, autoriser('gestionnaire', 'gilet_jaune', 'admin'), mesParkings);
router.post('/zone-gilet-jaune', verifierToken, autoriser('gilet_jaune'), creerZoneGiletJaune);

// ── Routes admin — AVANT /:id ──────────────────────────────────────────────
router.get('/admin/stats', verifierToken, autoriser('admin'), async (req, res) => {
  try {
    const [{ data: parkings }, { data: reservations }, { data: utilisateurs }] = await Promise.all([
      supabase.from('parkings').select('id, statut'),
      supabase.from('reservations').select('id, statut, cree_le'),
      supabase.from('users').select('id, role, cree_le'),
    ]);
    const aujourd_hui = new Date().toISOString().slice(0, 10);
    res.json({
      parkings: {
        total:      parkings?.length || 0,
        actifs:     parkings?.filter(p => p.statut === 'actif').length || 0,
        en_attente: parkings?.filter(p => p.statut === 'en_attente_validation').length || 0,
        suspendus:  parkings?.filter(p => p.statut === 'suspendu').length || 0,
      },
      reservations: {
        total:       reservations?.length || 0,
        aujourd_hui: reservations?.filter(r => r.cree_le?.startsWith(aujourd_hui)).length || 0,
        actives:     reservations?.filter(r => r.statut === 'confirmee').length || 0,
      },
      utilisateurs: {
        total:         utilisateurs?.length || 0,
        conducteurs:   utilisateurs?.filter(u => u.role === 'conducteur').length || 0,
        gestionnaires: utilisateurs?.filter(u => u.role === 'gestionnaire').length || 0,
        gilets_jaunes: utilisateurs?.filter(u => u.role === 'gilet_jaune').length || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
});

router.get('/admin/liste', verifierToken, autoriser('admin'), async (req, res) => {
  const { statut } = req.query;
  try {
    let query = supabase
      .from('parkings')
      .select(`*, gestionnaire:gestionnaire_id(id, prenom, nom, email, telephone), gilet_jaune:gilet_jaune_id(id, prenom, nom, email, telephone)`)
      .order('cree_le', { ascending: false });
    if (statut) query = query.eq('statut', statut);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
});

// ── Routes génériques — APRÈS les routes spécifiques ──────────────────────
router.post('/', verifierToken, autoriser('gestionnaire', 'admin'), creer);
router.patch('/:id/disponibilite', verifierToken, autoriser('gestionnaire', 'gilet_jaune', 'admin'), mettreAJourDisponibilite);
router.patch('/:id/statut', verifierToken, autoriser('admin'), changerStatut);
router.patch('/:id', verifierToken, autoriser('gestionnaire', 'gilet_jaune', 'admin'), modifier);
router.get('/:id', detail);

module.exports = router;