# 6. Guide de Déploiement

Ce document fournit les procédures pas-à-pas pour déployer **Village en Fête** sur un hébergement mutualisé cPanel (o2switch), un conteneur Docker, ou un serveur VPS Linux.

---

## 📋 Prérequis & Variables d'Environnement

Créez votre fichier de configuration `.env.local` (ou configurez les variables d'environnement dans votre panneau d'hébergement) en vous basant sur `.env.example` :

| Variable | Description | Exemple |
|---|---|---|
| `DATABASE_URL` | Chaîne de connexion PostgreSQL standard | `postgresql://user:pass@localhost:5432/villagedb` |
| `AUTH_SECRET` | Clé secrète JWT (min. 32 caractères aléatoires) | Générer avec : `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL`| URL publique canonique du site | `https://notre-village.ch` |
| `SMTP_HOST` | Hôte du serveur SMTP sortant | `mail.notre-village.ch` |
| `SMTP_PORT` | Port SMTP (465 avec SSL ou 587 avec STARTTLS) | `465` |
| `SMTP_SECURE` | Chiffrement SSL direct | `true` |
| `SMTP_USER` | Identifiant du compte email communal | `no-reply@notre-village.ch` |
| `SMTP_PASS` | Mot de passe de la boîte email | `Secret1234!` |
| `SMTP_FROM` | Nom et adresse d'expédition affichés | `"Village en Fête <no-reply@notre-village.ch>"` |

---

## 🚀 Option 1 : Déploiement sur o2switch (cPanel)

L'architecture sans dépendances lourdes est taillée sur-mesure pour l'outil **Setup Node.js App** de cPanel chez o2switch :

### Étape 1 : Créer la base de données PostgreSQL
1. Connectez-vous à votre interface cPanel o2switch.
2. Allez dans **Bases de données PostgreSQL**.
3. Créez une nouvelle base (ex: `votrecompte_villagedb`).
4. Créez un utilisateur PostgreSQL avec un mot de passe robuste, puis ajoutez l'utilisateur à la base avec tous les privilèges.

### Étape 2 : Configurer l'adresse email SMTP
1. Dans cPanel, allez dans **Comptes de messagerie**.
2. Créez l'adresse `no-reply@votre-domaine.ch`.
3. Notez le mot de passe et le serveur sortant (généralement `mail.votre-domaine.ch` sur le port 465 SSL).

### Étape 3 : Configurer l'application Node.js
1. Dans cPanel, cliquez sur **Setup Node.js App**.
2. Cliquez sur **Create Application** :
   - **Node.js version** : Sélectionnez **20.x** ou supérieure.
   - **Application mode** : **Production**.
   - **Application root** : Le dossier où est déposé le projet (ex: `village-map`).
   - **Application URL** : Votre domaine ou sous-domaine.
   - **Application startup file** : `node_modules/next/dist/bin/next` ou un script de démarrage `server.js`.
3. Dans la section **Environment variables**, ajoutez l'ensemble des variables listées plus haut (`DATABASE_URL`, `AUTH_SECRET`, etc.).
4. Cliquez sur **Create**.

### Étape 4 : Déployer le code et exécuter les migrations
Ouvrez le terminal cPanel (ou connectez-vous en SSH) :

```bash
cd ~/village-map

# 1. Installer les dépendances
npm install

# 2. Exécuter les migrations SQL et le seed initial
npm run db:migrate

# 3. Construire le build de production optimisé Next.js
npm run build

# 4. Redémarrer l'application depuis le panneau cPanel (bouton Restart)
```

### Étape 5 : Activer le premier compte Administrateur
1. Rendez-vous sur votre site sur `/login` et connectez-vous avec votre adresse email.
2. Dans cPanel → **phpPgAdmin**, ouvrez la base de données et exécutez la requête SQL :
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE email = 'votre-email@votre-domaine.ch';
   ```
3. Rendez-vous sur `/admin` :
   - Régénérez un **Code Villageois** sécurisé.
   - Vérifiez le centrage de la carte et les coordonnées communales.

---

## 🐳 Option 2 : Déploiement avec Docker & Docker Compose

Pour un hébergement sur VPS (Debian, Ubuntu, AlmaLinux) avec Docker :

Le fichier `docker-compose.yml` fourni configure automatiquement la base de données :

```yaml
version: "3.8"
services:
  db:
    image: postgres:16-alpine
    container_name: village_postgres
    restart: always
    environment:
      POSTGRES_USER: village_user
      POSTGRES_PASSWORD: village_password
      POSTGRES_DB: village_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Lancement :
```bash
docker compose up -d
npm run db:migrate
npm run build
npm start
```

---

## 🛡️ Checklist Avant Mise en Production

- [ ] `AUTH_SECRET` est une chaîne aléatoire d'au moins 64 caractères hexadécimaux et n'utilise pas la valeur par défaut.
- [ ] `NODE_ENV` est bien positionné sur `production` (garantit que la route `/auth/dev-login` renvoie une 404).
- [ ] Le certificat SSL (HTTPS / Let's Encrypt) est actif sur le domaine (obligatoire pour les cookies `Secure` et la géolocalisation GPS).
- [ ] Le dossier `public/uploads/` dispose des permissions d'écriture par le processus Node.js pour l'upload de photos.
- [ ] Le code villageois par défaut (`CHANGEME`) a été remplacé par un code généré depuis `/admin`.
- [ ] Les tests de régression passent avec succès : `npm test`.
