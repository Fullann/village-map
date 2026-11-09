# Village en Fête 🎃🎄 (v0.2.0)

> **Application web communautaire géolocalisée et sécurisée pour les fêtes de village (Halloween, Fenêtres de l'Avent).**  
> Conçue pour une autonomie totale : **PostgreSQL natif (`pg`)**, authentification **Magic Link par email**, sécurité **Row Level Security (RLS)**, cartographie **MapLibre GL JS 2.5D / 3D** avec intégration Swisstopo, et **zéro dépendance à des services propriétaires (ni Supabase ni Firebase)**.

---

## 🌟 Fonctionnalités Principales

- 🗺️ **Cartographie 2.5D & Bâtiments 3D** :
  - Moteur cartographique MapLibre GL JS haute performance.
  - Extrusions 3D à partir des données officielles cadastrales suisses (**swissBUILDINGS3D 3.0** & **SWISSIMAGE Swisstopo**).
  - Particules atmosphériques réactives et immersives (chute de neige pour Noël, braises et brume pour Halloween).
  - Tiroir tactile mobile rétractable à 3 crans (`MobileDrawer`) avec calcul de distance piétonne en temps réel (formule de Haversine) et tracé de la boucle d'itinéraire.
  - Export de calendrier universel **RFC 5545 (.ics)** pour Apple Calendar, Google Calendar et Outlook.
  - Retours haptiques (vibrations smartphone) et mémorisation locale des maisons visitées.

- 🎃 **Événement d'Halloween** :
  - Inscription des maisons distribuant des friandises avec créneau horaire, mode libre-service et instructions.
  - **Bouton d'action rapide en 1 clic direct sur la carte** : L'habitant connecté peut basculer d'un simple tap son état « Plus de bonbons », diffusé instantanément par **Server-Sent Events (SSE)** pour griser sa maison et notifier tous les enfants et promeneurs en temps réel sans rechargement.
  - Filtre d'accessibilité PMR / poussettes sans marches (`is_accessible_step_free`).
  - Galerie photo des façades hantées compatible stockage local ou **compatible S3 (Cloudflare R2, MinIO, Scaleway)**.

- 🎄 **Calendrier des Fenêtres de l'Avent (1 au 24 Décembre)** :
  - Choix d'un jour précis avec **verrouillage instantané anti-doublon** dès la soumission.
  - Choix de la formule : Fenêtre décorée seule ou Accueil convivial (verrée, vin chaud, contes).
  - Libellé d'animation personnalisé (`activity_label`).
  - **Dévoilement progressif** : Le serveur masque les détails et surprises des jours futurs jusqu'à leur arrivée le jour J.
  - Générateur d'affiche communale prête pour impression A4/A3 (`/admin/print-advent`).

- 📢 **Messages d'Alerte & Flash Communal en Direct (Temps Réel)** :
  - La mairie et le comité d'animation peuvent diffuser à tout instant un flash info ou d'urgence (météo, repli sous préau, consignes).
  - Affichage instantané d'une bannière dynamique sur tous les téléphones et ordinateurs connectés en temps réel avec notification et retour haptique.

- 🔒 **Sécurité & Vie Privée en Profondeur** :
  - **Sas Villageois (*Village Access Gate*)** : Code d'accès municipal à 8 caractères avec vérification temporelle constante (`timingSafeEqual`) pour bloquer le scraping et protéger les données privées des habitants.
  - **Authentification sans mot de passe (Magic Link)** : Envoi d'un lien sécurisé chiffré à usage unique (TTL 15 min) par SMTP standard (`nodemailer`).
  - **Sessions JWT HTTP-Only** signées avec `jose` (30 jours de persistance sécurisée).
  - **Row Level Security (RLS) PostgreSQL** : Isolation stricte des données au niveau transactionnel avec `withRlsContext`.
  - **Rate Limiting en base** : Protection anti-bruteforce par IP sans dépendance à Redis.
  - **Isolation Stricte Dev vs Prod** : Route de bypass 404 en production et validation impérative de la clé secrète.

- 📊 **Tableau de Bord Communal (/admin)** :
  - Pilotage des saisons en 1 clic (*Hors-Saison*, *Halloween*, *Fenêtres de l'Avent*).
  - Validation et modération des foyers et des adresses.
  - Attribution et publication du calendrier de l'Avent avec notification automatique par email.
  - Relance email des participants la veille de leur passage (J-1 / J-0).
  - Statistiques de fréquentation communale anonymes et respectueuses de la vie privée (`analytics_visits`).

---

## 📁 Arborescence du Projet

```text
.
├── docs/                             # Documentation technique complète
│   ├── README.md                     # Index de la documentation
│   ├── ARCHITECTURE.md               # Architecture globale & flux de données
│   ├── AUTHENTICATION_AND_SECURITY.md# Sécurité, JWT, Magic Link & RLS
│   ├── DATABASE_AND_MIGRATIONS.md    # Schéma, 7 migrations SQL & scripts
│   ├── MAP_AND_3D.md                 # MapLibre GL, 3D Swisstopo & Drawer
│   ├── SEASONS_AND_WORKFLOWS.md      # Métier, Halloween, Avent & Emails
│   └── DEPLOYMENT_GUIDE.md           # Guide de déploiement (o2switch / Docker)
├── db/
│   ├── migrations/                   # Migrations SQL versionnées (0001 à 0007)
│   │   ├── 0001_schema.sql           # Schéma initial (tables, enums, triggers)
│   │   ├── 0002_rls.sql              # Politiques RLS PostgreSQL
│   │   ├── 0003_views.sql            # Vues publiques sécurisées
│   │   ├── 0004_advent_workflow.sql  # Workflow et verrouillage de l'Avent
│   │   ├── 0005_enhancements.sql     # 'Plus de bonbons' et rate limiting
│   │   ├── 0006_advent_custom_formula.sql # Libellé d'activité personnalisée
│   │   └── 0007_features.sql         # PMR, galerie photos et analytics
│   └── seed.sql                      # Données de test initiales
├── scripts/
│   ├── migrate.ts                    # Exécution des migrations PostgreSQL
│   ├── fetch-vufflens-3d.ts          # Récupération Swisstopo & OpenStreetMap
│   ├── enrich-vufflens-3d.ts         # Calcul des hauteurs et polygones 3D
│   └── import-addresses.ts           # Import GeoJSON dans la table `addresses`
├── public/
│   ├── data/
│   │   └── vufflens-buildings-3d.geojson # Empreintes et hauteurs 3D
│   ├── manifest.json                 # Manifest PWA
│   └── sw.js                         # Service Worker
├── src/
│   ├── middleware.ts                 # Contrôle d'accès (Sas Villageois + Sessions)
│   ├── types/index.ts                # Typage TypeScript global
│   ├── lib/
│   │   ├── db.ts                     # Pool pg + wrapper RLS `withRlsContext`
│   │   ├── auth.ts                   # JWT HTTP-Only, timingSafeEqual, SHA-256
│   │   ├── mail.ts                   # Transport SMTP Nodemailer & templates
│   │   ├── rateLimit.ts              # Protection anti-bruteforce par IP
│   │   ├── schemas.ts                # Validation Zod des formulaires
│   │   └── themeTokens.ts            # Thèmes visuels et retours haptiques
│   ├── components/
│   │   ├── map/                      # Composants cartographiques 2.5D / 3D
│   │   │   ├── Map3DContainer.tsx    # Conteneur principal MapLibre GL
│   │   │   ├── MobileDrawer.tsx      # Tiroir mobile interactif & itinéraire
│   │   │   ├── FloatingMarker.tsx    # Marqueurs festifs animés
│   │   │   └── AtmosphericParticles.tsx # Particules (neige / braises)
│   │   ├── AdventDayPickerForm.tsx   # Grille de sélection des jours (1-24)
│   │   └── PhotoUploadField.tsx      # Champ d'upload de photo optimisé
│   └── app/                          # Pages Next.js 15 App Router
│       ├── page.tsx                  # Carte interactive publique
│       ├── access/page.tsx           # Porte d'accès villageoise
│       ├── login/page.tsx            # Connexion Magic Link
│       ├── dashboard/page.tsx        # Espace citoyen
│       ├── halloween/page.tsx        # Inscription Halloween
│       ├── advent/page.tsx           # Inscription Calendrier de l'Avent
│       ├── admin/page.tsx            # Panneau de contrôle communal
│       ├── admin/print-advent/page.tsx # Affiche imprimable communale
│       ├── actions/                  # Server Actions Next.js
│       └── api/                      # Routes API (.ics, upload, analytics)
└── tests/                            # 39 tests unitaires (Node.js Test Runner)
```

---

## 🚀 Démarrage Rapide

### 1. Installation des dépendances
```bash
npm install
```

### 2. Configuration locale
Copiez l'exemple de configuration :
```bash
cp .env.example .env.local
```

Renseignez au minimum votre connexion PostgreSQL dans `.env.local` :
```env
DATABASE_URL=postgresql://village_user:village_password@localhost:5432/village_db
AUTH_SECRET=dev_fallback_secret_change_me_in_production_64chars
```

*(Si vous utilisez Docker, démarrez la base locale avec `docker compose up -d`)*

### 3. Appliquer les migrations
```bash
npm run db:migrate
```

### 4. Lancer le serveur de développement
```bash
npm run dev
```
Rendez-vous sur `http://localhost:3000`.

> [!TIP]
> En mode développement, si aucun serveur SMTP n'est configuré, le lien Magic Link de connexion s'affiche directement dans votre console de terminal.

---

## 🧪 Tests Automatisés

Le projet comprend une suite complète de **39 tests unitaires** exécutée avec le runner natif de Node.js (sans dépendance lourde) :

```bash
npm test
```

Couverture des tests :
- Cryptographie, hachage constant-time et génération de codes sécurisés.
- Conformité du format de calendrier RFC 5545 (`.ics`).
- Calculs géodésiques de Haversine et temps de marche piéton.
- Validation stricte des formulaires Zod.
- Tests d'isolation dev vs production (interdiction des clés de dev en production, route 404).

---

## 📖 Documentation Détaillée

Pour approfondir le fonctionnement du projet, consultez les dossiers de documentation :

1. [**Architecture & Choix Techniques**](./docs/ARCHITECTURE.md)
2. [**Authentification & Sécurité**](./docs/AUTHENTICATION_AND_SECURITY.md)
3. [**Base de Données & Migrations SQL**](./docs/DATABASE_AND_MIGRATIONS.md)
4. [**Moteur Cartographique & 3D**](./docs/MAP_AND_3D.md)
5. [**Saisons & Workflows Métier**](./docs/SEASONS_AND_WORKFLOWS.md)
6. [**Guide de Déploiement (o2switch, Docker, VPS)**](./docs/DEPLOYMENT_GUIDE.md)
7. [**Référence API & Server Actions**](./docs/API_AND_ACTIONS.md)
8. [**Analyse de Sécurité & Optimisations**](./docs/SECURITY_AND_OPTIMIZATION.md)
9. [**Politique de Confidentialité nLPD**](./src/app/privacy/page.tsx)

---

## 📄 Licence

Ce projet est sous licence MIT. Consultez le fichier [LICENSE](./LICENSE) pour plus d'informations.
