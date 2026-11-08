# Documentation Village en Fête 📖

Bienvenue dans la documentation technique et opérationnelle de **Village en Fête** (version 0.2.0), une application web communautaire géolocalisée et sécurisée pour les événements festifs de village (Halloween, Fenêtres de l'Avent).

---

## 🧭 Sommaire des guides

| Document | Description |
|---|---|
| [**1. Architecture Globale**](./ARCHITECTURE.md) | Principes de conception, stack technique (Next.js 15, React 19, PostgreSQL natif), structure des dossiers et flux de données. |
| [**2. Authentification & Sécurité**](./AUTHENTICATION_AND_SECURITY.md) | Magic Link sans mot de passe, sessions JWT HTTP-only, porte d'accès villageoise (*Gate*), Row-Level Security (RLS) et protections anti-bruteforce. |
| [**3. Base de données & Migrations**](./DATABASE_AND_MIGRATIONS.md) | Schéma relationnel complet, détail des 7 migrations SQL, vues sécurisées, contexte RLS PostgreSQL et scripts de maintenance. |
| [**4. Cartographie 2.5D & Expérience Visuelle**](./MAP_AND_3D.md) | Moteur cartographique MapLibre GL JS, intégration Swisstopo / swissBUILDINGS3D, particules atmosphériques, Drawer mobile et calculs géodésiques. |
| [**5. Saisons & Workflows Métier**](./SEASONS_AND_WORKFLOWS.md) | Cycle de vie des saisons (Halloween, Avent, Hors-saison), inscription des habitants, attribution des dates, notifications email et exports iCalendar/Print. |
| [**6. Guide de Déploiement**](./DEPLOYMENT_GUIDE.md) | Déploiement pas-à-pas sur o2switch (cPanel / Node.js App), conteneurs Docker / Docker Compose, configuration SMTP et checklist de production. |
| [**7. Référence API & Server Actions**](./API_AND_ACTIONS.md) | Liste exhaustive des Server Actions Next.js, endpoints HTTP (.ics, uploads, analytics, live SSE) et schémas Zod. |
| [**8. Analyse de Sécurité & Optimisations**](./SECURITY_AND_OPTIMIZATION.md) | Rapport d'audit de sécurité approfondi (magic bytes, CSP, RLS, rate limiting) et stratégies d'optimisation (SSE, WebGL, index PostgreSQL). |

---

## ⚡ En un coup d'œil

- **Framework Web** : [Next.js 15 (App Router)](https://nextjs.org/) + [React 19](https://react.dev/) + [Tailwind CSS](https://tailwindcss.com/)
- **Moteur Géographique** : [MapLibre GL JS](https://maplibre.org/) + Intégration Swisstopo & GeoJSON 3D
- **Base de Données** : PostgreSQL 13+ natif (`pg`), sans ORM lourd, avec Row-Level Security (RLS)
- **Authentification** : Magic Link par email (SMTP `nodemailer`), chiffrement de session via `jose` (JWT HTTP-Only)
- **Temps Réel** : Server-Sent Events (SSE) natif pour la tournée d'Halloween sans polling CPU
- **Stockage Hybride** : Disque local (`public/uploads`) ou Stockage Objet compatible S3 (MinIO, Cloudflare R2, Scaleway)
- **Protection des données** : Conforme à la nouvelle loi suisse sur la protection des données (**nLPD**)
- **Tests** : 42 tests automatisés avec le test runner natif de Node.js (`npm test`)
- **Intégration Continue** : Pipeline GitHub Actions (`.github/workflows/ci.yml`)
