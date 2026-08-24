const express = require('express');
const router = express.Router();
const { verifierToken } = require('../middleware/auth');
const { mesNotifications, marquerLue, toutMarquerLu } = require('../controllers/notificationsController');

router.get('/', verifierToken, mesNotifications);
router.patch('/:id/lue', verifierToken, marquerLue);
router.patch('/tout-lire', verifierToken, toutMarquerLu);

module.exports = router;