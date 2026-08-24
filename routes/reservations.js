const express = require('express');
const router  = express.Router();
const { verifierToken, autoriser } = require('../middleware/auth');
const {
  creer,
  meReservations,
  reservationsGestionnaire,
  confirmerService,
  refuserService,
  terminerReservation,
  detail,
  annuler,
} = require('../controllers/reservationsController');

const { verifierTicket } = require('../controllers/reservationsController');

router.post('/',                       verifierToken, autoriser('conducteur'),                                creer);
router.get('/moi',                     verifierToken, autoriser('conducteur'),                                meReservations);
router.get('/gestionnaire',            verifierToken, autoriser('gestionnaire', 'gilet_jaune', 'admin'),      reservationsGestionnaire);
router.patch('/:id/confirmer-service', verifierToken, autoriser('gestionnaire', 'gilet_jaune', 'admin'),      confirmerService);
router.patch('/:id/refuser-service',   verifierToken, autoriser('gestionnaire', 'gilet_jaune', 'admin'),      refuserService);
router.patch('/:id/terminer',          verifierToken, autoriser('gestionnaire', 'gilet_jaune', 'admin'),      terminerReservation);
router.patch('/:id/annuler',           verifierToken, autoriser('conducteur'),                                annuler);
router.get('/verifier/:id', verifierTicket);
router.get('/:id',                     verifierToken,                                                         detail);


module.exports = router;