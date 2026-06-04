const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../supabase');

const register = async (req, res) => {
  const { nom, prenom, email, mot_de_passe, telephone, role } = req.body;

  if (!nom || !prenom || !email || !mot_de_passe) {
    return res.status(400).json({ erreur: 'Champs obligatoires manquants' });
  }

  const rolesAutorises = ['conducteur', 'gestionnaire'];
  const roleChoisi = rolesAutorises.includes(role) ? role : 'conducteur';

  try {
    const { data: existant } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existant) {
      return res.status(409).json({ erreur: 'Email déjà utilisé' });
    }

    const hash = await bcrypt.hash(mot_de_passe, 10);

    const { data, error } = await supabase
      .from('users')
      .insert([{ nom, prenom, email, mot_de_passe_hash: hash, telephone, role: roleChoisi }])
      .select()
      .single();

    if (error) throw error;

    const token = jwt.sign(
      { id: data.id, email: data.email, role: data.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Compte créé avec succès',
      token,
      utilisateur: { id: data.id, nom: data.nom, prenom: data.prenom, email: data.email, role: data.role }
    });

  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

const login = async (req, res) => {
  const { email, mot_de_passe } = req.body;

  if (!email || !mot_de_passe) {
    return res.status(400).json({ erreur: 'Email et mot de passe requis' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ erreur: 'Email ou mot de passe incorrect' });
    }

    if (!user.actif) {
      return res.status(403).json({ erreur: 'Compte désactivé' });
    }

    const motDePasseValide = await bcrypt.compare(mot_de_passe, user.mot_de_passe_hash);
    if (!motDePasseValide) {
      return res.status(401).json({ erreur: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Connexion réussie',
      token,
      utilisateur: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role }
    });

  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

const moi = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, nom, prenom, email, telephone, role, cree_le')
      .eq('id', req.utilisateur.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ erreur: 'Utilisateur introuvable' });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ erreur: 'Erreur serveur', detail: err.message });
  }
};

module.exports = { register, login, moi };