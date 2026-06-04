const jwt = require('jsonwebtoken');

const verifierToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erreur: 'Token manquant' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.utilisateur = decoded;
    next();
  } catch {
    return res.status(401).json({ erreur: 'Token invalide ou expiré' });
  }
};

const autoriser = (...roles) => (req, res, next) => {
  if (!roles.includes(req.utilisateur.role)) {
    return res.status(403).json({ erreur: 'Accès refusé — rôle insuffisant' });
  }
  next();
};

module.exports = { verifierToken, autoriser };