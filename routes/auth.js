const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { verifierToken, autoriser } = require('../middleware/auth');
const { register, login, moi } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.get('/moi', verifierToken, moi);

router.get('/utilisateurs', verifierToken, autoriser('admin'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, prenom, nom, email, role, actif, cree_le')
      .order('cree_le', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
});

module.exports = router;