# ParkLink — Backend

API REST pour la plateforme ParkLink, plateforme de réservation et gestion du stationnement urbain à Casablanca.

## Stack technique

- **Runtime** : Node.js
- **Framework** : Express.js
- **Base de données** : Supabase (PostgreSQL)
- **Authentification** : JWT + bcryptjs
- **Tâches planifiées** : node-cron

## Prérequis

- Node.js v18+
- Un projet Supabase avec les tables créées (voir `schema.sql`)

## Installation

```bash
npm install
```

Crée un fichier `.env` à la racine :

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=ta_cle_anon_supabase
JWT_SECRET=une_chaine_secrete_longue_et_aleatoire
PORT=3000
```

## Démarrage

```bash
# Production
node index.js

# Développement (redémarrage automatique)
npx nodemon index.js
```

Le serveur démarre sur `http://localhost:3000`.

## Structure des fichiers

```
parklink-backend/
├── index.js                      ← Point d'entrée Express + cron
├── supabase.js                   ← Client Supabase
├── .env                          ← Variables d'environnement (non versionné)
├── middleware/
│   └── auth.js                   ← Vérification JWT et contrôle des rôles
├── routes/
│   ├── auth.js                   ← /auth/register, /auth/login, /auth/moi
│   ├── parkings.js               ← /parkings + routes admin
│   ├── reservations.js           ← /reservations
│   ├── vehicules.js              ← /vehicules
│   └── notifications.js          ← /notifications
├── controllers/
│   ├── authController.js
│   ├── parkingsController.js
│   ├── reservationsController.js
│   ├── vehiculesController.js
│   └── notificationsController.js
└── jobs/
    └── cloturerReservations.js   ← Clôture automatique des réservations expirées
```

## Rôles utilisateurs

| Rôle | Accès |
|---|---|
| `conducteur` | Réservations, véhicules, notifications |
| `gestionnaire` | Parkings, réservations reçues, services |
| `gilet_jaune` | Zone, disponibilités, réservations reçues |
| `autorite` | Données de supervision (à venir) |
| `admin` | Accès complet + validation des parkings |

## Créer un compte admin

Dans Supabase SQL Editor :

```sql
UPDATE users SET role = 'admin' WHERE email = 'ton@email.com';
```

## Cron job

Le job `cloturerReservations` s'exécute toutes les minutes. Il passe les réservations expirées au statut `terminee` et réincrémente les places disponibles des parkings concernés.

## Variables d'environnement

| Variable | Description |
|---|---|
| `SUPABASE_URL` | URL de ton projet Supabase |
| `SUPABASE_KEY` | Clé anon publique Supabase |
| `JWT_SECRET` | Secret pour signer les tokens JWT |
| `PORT` | Port du serveur (défaut : 3000) |