const express = require('express');
const router = express.Router();
const { register, login, moi } = require('../controllers/authController');
const { verifierToken } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/moi', verifierToken, moi);

module.exports = router;