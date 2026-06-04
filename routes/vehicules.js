const express = require('express');
const router = express.Router();
const { mesVehicules, ajouter, modifier, supprimer } = require('../controllers/vehiculesController');
const { verifierToken, autoriser } = require('../middleware/auth');

router.get('/moi', verifierToken, autoriser('conducteur'), mesVehicules);
router.post('/', verifierToken, autoriser('conducteur'), ajouter);
router.patch('/:id', verifierToken, autoriser('conducteur'), modifier);
router.delete('/:id', verifierToken, autoriser('conducteur'), supprimer);

module.exports = router;