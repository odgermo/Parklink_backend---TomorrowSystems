// 1. Variables d'environnement — EN PREMIER
require('dotenv').config();
// 2. Imports des packages
const express = require('express');
const cors = require('cors');

const app = express();

// 3. Middlewares globaux — AVANT les routes
app.use(cors());
app.use(express.json());

// 4. Routes — APRÈS les middlewares globaux
const authRoutes = require('./routes/auth');
const parkingsRoutes = require('./routes/parkings');
const reservationsRoutes = require('./routes/reservations');
const vehiculesRoutes = require('./routes/vehicules');

app.use('/auth', authRoutes);
app.use('/parkings', parkingsRoutes);
app.use('/reservations', reservationsRoutes);
app.use('/vehicules', vehiculesRoutes);

// 5. Route de test — après tout le reste
app.get('/', (req, res) => {
  res.json({ message: 'ParkLink API en ligne' });
});

// 6. Démarrage du serveur — EN DERNIER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur ParkLink démarré sur le port ${PORT}`);
});