const express = require('express');
const router = express.Router();
const { lister, detail, creer, mettreAJourDisponibilite, changerStatut } = require('../controllers/parkingsController');
const { verifierToken, autoriser } = require('../middleware/auth');

router.get('/', lister);
router.get('/:id', detail);
router.post('/', verifierToken, autoriser('gestionnaire', 'admin'), creer);
router.patch('/:id/disponibilite', verifierToken, autoriser('gestionnaire', 'gilet_jaune', 'admin'), mettreAJourDisponibilite);
router.patch('/:id/statut', verifierToken, autoriser('admin'), changerStatut);

module.exports = router;