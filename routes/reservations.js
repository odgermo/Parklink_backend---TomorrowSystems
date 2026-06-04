const express = require('express');
const router = express.Router();
const { creer, meReservations, detail, annuler } = require('../controllers/reservationsController');
const { verifierToken, autoriser } = require('../middleware/auth');

router.post('/', verifierToken, autoriser('conducteur'), creer);
router.get('/moi', verifierToken, autoriser('conducteur'), meReservations);
router.get('/:id', verifierToken, autoriser('conducteur'), detail);
router.patch('/:id/annuler', verifierToken, autoriser('conducteur'), annuler);

module.exports = router;