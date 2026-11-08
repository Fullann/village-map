# 8. Analyse de Sécurité & Optimisations

Ce document présente l'audit de sécurité complet et le plan d'optimisation de performance de l'application **Village en Fête** (version 0.2.0).

---

## 🎯 1. Périmètre de l'Audit

L'audit a couvert l'ensemble de la chaîne de valeur applicative :
- **Front-End & Client Cartographique** (MapLibre GL, WebGL, Service Worker, gestion des formulaires et états).
- **Couche Réseau & En-têtes HTTP** (Next.js Middleware, cookies de session, en-têtes de sécurité, SSE).
- **Back-End & Server Actions** (Validation Zod, transactions PostgreSQL RLS, téléversements de fichiers).
- **Stockage & Données** (Base PostgreSQL, stockage local vs compatible S3, rate limiting).
- **Cycle de Vie & Environnements** (Isolation dev/prod, clés secrètes, journalisation).

---

## 🛡️ 2. Analyse de Sécurité Approfondie

### 2.1 Authentification & Modèle de Confiance

| Vecteur d'attaque | Risque | Mesure de protection implémentée | Statut |
|---|---|---|---|
| **Bruteforce du Code Villageois** | Élevé | Comparaison à temps constant `timingSafeEqual` + Rate Limiting en base (table `public.rate_limits`) bloquant après 5 tentatives / 15 min par IP. |  Conforme |
| **Vol de Session / XSS** | Critique | Cookie `village_session` signé avec algorithme `HS256` (`jose`), balisé `HttpOnly`, `SameSite=Lax`, et `Secure=true` en production. Inaccessible au JavaScript malveillant. |  Conforme |
| **Phishing / Vol de mot de passe** | Moyen | Architecture 100% **sans mot de passe** (*Passwordless*). Connexion par Magic Link éphémère (TTL 15 min) transmis par SMTP sécurisé. |  Conforme |
| **Élévation de privilèges RLS** | Élevé | Chaque transaction sensible s'exécute via `withRlsContext(userId, fn)` avec `set_config('app.current_user_id', ..., true)`. Le paramètre `is_local=true` garantit qu'aucune fuite de session n'est possible lors du recyclage de la connexion dans le pool `pg`. |  Conforme |
| **Bypass en Production** | Élevé | La route `/auth/dev-login` renvoie strictement une `404` dès que `NODE_ENV === 'production'` (couvert par test unitaire automatique). `AUTH_SECRET` refuse formellement la clé de développement par défaut. |  Conforme |

### 2.2 Validation des Entrées & Téléversements de Fichiers

| Vecteur d'attaque | Risque | Mesure de protection implémentée | Statut |
|---|---|---|---|
| **Injections SQL** | Critique | 100% des requêtes vers PostgreSQL utilisent des requêtes préparées paramétrées (`$1, $2, ...`). Aucun collage de chaîne SQL non vérifiée. |  Conforme |
| **Usurpation d'extension de fichier** | Élevé | Dans `/api/upload`, le fichier n'est pas uniquement validé par son extension ou son en-tête MIME HTTP : ses **octets magiques binaires (*magic bytes*)** sont inspectés pour certifier qu'il s'agit d'une réelle image JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), GIF (`47 49 46 38`) ou WEBP (`RIFF....WEBP`). |  Conforme |
| **Dépassement de quota disque** | Moyen | Limite stricte à **6 Mo** par image ; renommage aléatoire basé sur `crypto.randomBytes(8)` interdisant les collisions et l'écrasement de fichiers existants. |  Conforme |
| **Attaque par traversée de répertoire (*Path Traversal*)** | Élevé | Le nom de fichier est généré côté serveur à partir d'un timestamp et d'octets hexadécimaux aléatoires. Le nom de fichier original fourni par le client est ignoré. |  Conforme |

### 2.3 En-têtes HTTP de Sécurité (`next.config.mjs`)

Les en-têtes suivants sont injectés sur toutes les requêtes :
- **`X-Frame-Options: DENY`** : Interdit l'inclusion de l'application dans des iframes tierces (anti-clickjacking).
- **`X-Content-Type-Options: nosniff`** : Empêche les navigateurs de réinterpréter les types MIME déclarés.
- **`Referrer-Policy: strict-origin-when-cross-origin`** : Préserve la confidentialité des URL lors de redirections externes.
- **`Permissions-Policy: camera=(), microphone=(), geolocation=(self)`** : Bloque l'accès aux périphériques non nécessaires et restreint la géolocalisation au domaine communal.
- **`X-Powered-By: false`** : Supprime la signature de framework Next.js.

---

## ⚡ 3. Analyse de Performance & Optimisations

### 3.1 Temps Réel Économe en Ressources (SSE vs Polling)

- **Problème du Polling classique** : Faire interroger la base par chaque smartphone toutes les 5 secondes le soir d'Halloween saturerait le processeur et la bande passante sur un hébergement mutualisé.
- **Solution retenue (SSE - Server-Sent Events)** :
  - Route `/api/events/live` basée sur un `ReadableStream` standard.
  - Utilisation d'un `EventEmitter` partagé en mémoire Node.js.
  - Consommation réseau quasi-nulle tant qu'aucun événement n'est émis.
  - Heartbeat léger toutes les 25 secondes pour prévenir les déconnexions proxy/Nginx sans éveiller inutilement les CPU mobiles.
  - Mise à jour instantanée du composant React sans rechargement de page.

### 3.2 Performance de la Base de Données (PostgreSQL)

- **Taille du pool adaptée** : Configuration `max: 10` et `idleTimeoutMillis: 30000`, convenant parfaitement aux quotas mémoire de cPanel / o2switch.
- **Index partiels ciblés** :
  - `idx_unique_verified_address` : index conditionnel `WHERE verification_status IN ('verified_by_code', 'verified_by_admin')` réduisant la taille de l'arbre B-tree.
  - `idx_advent_unique_active_day` : index unique partiel `WHERE day_number IS NOT NULL AND status <> 'rejected'`.
  - `idx_rate_limits_lookup` : index composite B-tree sur `(ip_key, action, attempted_at DESC)` assurant des vérifications de quota en moins d'une milliseconde.

### 3.3 Cartographie 2.5D & Optimisations WebGL

- **Nettoyage des instances MapLibre** : Utilisation de `markerInstancesRef` pour recycler et détruire proprement les racines React (`Root.unmount()`) lors du changement de filtre, évitant toute fuite mémoire sur smartphone.
- **Géométrie 3D GeoJSON statique** : Le fichier cadastral `vufflens-buildings-3d.geojson` est pré-calculé et servi de manière statique avec mise en cache navigateur, plutôt que généré dynamiquement à chaque requête.
- **Calculs géodésiques locaux** : Le calcul de distance piétonne (Haversine) s'effectue directement sur le client mobile en microsecondes sans aucun appel API réseau.

### 3.4 Formats d'Images Modernes

- Support configuré dans `next.config.mjs` pour la négociation automatique des formats **AVIF** et **WebP**, offrant des réductions de poids de 30% à 50% par rapport au JPEG standard.

---

## 📋 4. Synthèse des Bonnes Pratiques pour l'Exploitation

1. **Régénération périodique du Code Villageois** : Depuis `/admin`, renouveler le code communal une fois par an ou après chaque grande saison festive.
2. **Sauvegarde de la base PostgreSQL** : Planifier un dump régulier via cron (`pg_dump -U ... villagedb > backup.sql`).
3. **Activation S3 pour la scalabilité** : Si le nombre de photos de façades dépasse quelques gigaoctets, renseigner simplement les 4 variables `S3_*` dans `.env.local` pour basculer sans interruption sur du stockage objet.
4. **Surveillance des Rate Limits** : Les tentatives de bruteforce sont automatiquement tracées dans `public.rate_limits` et peuvent être purgées par cron (`DELETE FROM public.rate_limits WHERE attempted_at < NOW() - INTERVAL '7 days'`).
