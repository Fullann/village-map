# 7. Référence des API & Server Actions

Ce document documente l'ensemble des points d'entrée applicatifs : les **Server Actions Next.js** et les **Routes d'API HTTP** de **Village en Fête**.

---

## ⚡ Server Actions Next.js

Les Server Actions sont localisées dans `src/app/actions/`. Elles s'exécutent exclusivement côté serveur avec injection du contexte de transaction RLS (`withRlsContext`).

### 1. Authentification & Sas Villageois (`src/app/actions/auth.ts`)

| Action | Description | Paramètres / FormData |
|---|---|---|
| `sendMagicLink(formData)` | Génère un token cryptographique de 32 octets, stocke son hash SHA-256 avec TTL 15 min, et envoie l'email par SMTP. Soumis au rate limiting par IP. | `email: string` |
| `unlockVillageGate(formData)` | Vérifie le Code Villageois fourni avec `timingSafeEqual`. Dépose le cookie HTTP-Only signé `village_access_gate`. Soumis au rate limiting (5 essais / 15 min). | `code: string` |
| `logout()` | Supprime le cookie de session `village_session` et redirige vers `/access`. | — |

### 2. Inscriptions Halloween (`src/app/actions/halloween.ts`)

| Action | Description | Paramètres / FormData |
|---|---|---|
| `registerHalloween(formData)` | Enregistre ou met à jour la participation du foyer à la soirée d'Halloween. Valide les données avec `HalloweenSchema` (Zod). | `is_distributing`, `start_time`, `end_time`, `is_self_service`, `is_accessible_step_free`, `access_instructions`, `photo_url` |
| `toggleOutOfCandy(formData)` | Permet au résident de basculer instantanément l'état *"Plus de bonbons"* le soir du 31 octobre depuis son espace citoyen. | `out_of_candy: boolean` |

### 3. Inscriptions & Propositions Avent (`src/app/actions/advent.ts`)

| Action | Description | Paramètres / FormData |
|---|---|---|
| `submitAdventApplication(formData)` | Transmet une proposition de date souhaitée (1 au 24 décembre) pour examen par la mairie. Statut initial `submitted` ; l'attribution définitive (`day_number`) est gérée par la commune. Valide avec `AdventApplicationSchema` (Zod). | `requested_day: number`, `participation_type`, `activity_label`, `lighting_time`, `event_start_time`, `hospitality_details`, `is_accessible_step_free`, `photo_url` |
| `withdrawAdventApplication()` | Permet au résident de retirer sa proposition et se désinscrire du Calendrier de l'Avent, à condition que la date limite communale `advent_cancellation_deadline` ne soit pas dépassée. | — |

### 4. Vérification de Domicile (`src/app/actions/verify-residence.ts`)

| Action | Description | Paramètres / FormData |
|---|---|---|
| `verifyWithVillageCode(formData)` | Rapproche un compte utilisateur d'une adresse officielle déclarée en contrôlant le code villageois. | `address_id: string`, `code: string` |
| `requestAdminVerification(formData)` | Dépose une demande de modération manuelle pour les foyers n'ayant pas reçu le courrier postal ou le flyer municipal. | `address_id: string`, `notes: string` |

### 5. Administration Communale (`src/app/actions/admin.ts`)

| Action | Description | Paramètres / FormData |
|---|---|---|
| `setSeason(formData)` | Bascule la saison active (`off_season`, `halloween`, `advent`), configure la date d'ouverture des inscriptions et l'option de masquage des détails futurs. | `season: string`, `hide_future: boolean`, `advent_registration_opens_at: string` |
| `setAdventPublication(formData)` | Publie officiellement le calendrier de l'Avent sur la carte publique et notifie automatiquement par email tous les foyers retenus. | `publish: boolean` |
| `assignAdventDay(formData)` | L'administrateur confirme ou modifie l'attribution du jour d'un foyer (`status: 'assigned'` ou `'rejected'`). | `candidate_id: string`, `assigned_day: number`, `status: string` |
| `regenerateVillageCode()` | Génère un nouveau code secret aléatoire de 8 caractères non-ambigus (`generateVillageSecretCode`), met à jour le hash en base et révoque les sessions obsolètes. | — |
| `updateMapSettings(formData)` | Modifie les coordonnées de centrage, la bounding box d'emprise et l'URL du style de tuiles de la carte. | `center_lng`, `center_lat`, `sw_lng`, `sw_lat`, `ne_lng`, `ne_lat`, `style_url` |
| `sendAdventRemindersAction()` | Parcourt les fenêtres prévues pour le lendemain (J-1) et envoie automatiquement les courriels de rappel aux habitants organisateurs. | — |
| `approveVerification(formData)` | Valide manuellement l'adresse d'un résident en attente de modération. | `user_id: string` |
| `revokeUser(formData)` | Révoque l'accès ou la vérification d'un profil suspect. | `user_id: string` |
| `publishCommunalAlert(formData)` | Diffuse instantanément un message flash communal en direct (SSE) sur tous les téléphones et ordinateurs connectés. | `level: info/warning/urgent`, `title`, `message` |
| `dismissCommunalAlert(formData)` | Retire immédiatement l'alerte active courante de tous les écrans connectés. | `alert_id: string` |
| `reserveCommunalAdventDay(formData)` | Pré-réserve une date du calendrier pour un événement officiel de la commune (ex: Inauguration Maison de Commune, Saint-Nicolas). Crée l'entrée avec `status = 'reserved_commune'` et `is_communal_event = true`. | `day_number`, `address_id`, `activity_label`, `lighting_time`, `event_start_time`, `hospitality_details` |
| `blockAdventDay(formData)` | Bloque une date sans animation (fête scolaire, culte, férié). Crée l'entrée avec `status = 'blocked'`, empêchant toute sélection par les habitants. | `day_number`, `block_reason` |
| `freeAdventDay(formData)` | Libère ou débloque une date communale pour la rendre à nouveau disponible pour les inscriptions d'habitants. | `day_number` |

---

## 🌐 Routes HTTP API (`src/app/api/`)

### 1. Export Calendrier Universel RFC 5545 (`/api/calendar/export`)
- **Méthode** : `GET`
- **Description** : Génère un fichier iCalendar standard (`.ics`) au format `text/calendar; charset=utf-8`.
- **Paramètres d'URL (Query Strings)** :
  - `addressId` *(optionnel)* : Exporte uniquement l'événement d'une adresse physique.
  - `day` *(optionnel)* : Exporte la fenêtre de l'Avent d'un jour précis (1 à 24).
  - `season` *(optionnel)* : Filtre par saison (`halloween` ou `advent`).
- **En-têtes HTTP de réponse** :
  - `Content-Disposition: attachment; filename="village-evenements.ics"`
  - `Cache-Control: private, max-age=300`

### 2. Téléversement Sécurisé de Photos (`/api/upload`)
- **Méthode** : `POST`
- **Sécurité** : Requiert une session utilisateur valide (`getSessionUser()`).
- **Corps de requête** : `multipart/form-data` avec le champ `file`.
- **Validation & Contraintes** :
  - Types MIME acceptés : `image/jpeg`, `image/png`, `image/webp`.
  - Poids maximal : **6 Mo**.
  - Génération de nom de fichier imprévisible : `${Date.now()}-${randomBytes(6).hex}.${ext}`.
  - Stockage dans `public/uploads/`.
- **Réponse JSON** :
  ```json
  {
    "url": "/uploads/1731087600000-a1b2c3d4e5f6.webp",
    "success": true
  }
  ```

### 3. Télémétrie Discrète de Fréquentation (`/api/analytics/ping`)
- **Méthode** : `POST`
- **Description** : Permet à la commune de mesurer l'affluence et l'intérêt sans collecter aucune donnée personnelle ni installer de traceurs tiers (RGPD / nLPD friendly).
- **Corps de requête (JSON)** :
  ```json
  {
    "eventType": "address_view",
    "addressId": "018f3a5e-...",
    "seasonYear": 2026
  }
  ```
- **Événements supportés** : `page_view`, `address_view`, `route_view`.

### 4. Export CSV / Excel du Calendrier de l'Avent (`/api/admin/export-advent`)
- **Méthode** : `GET`
- **Sécurité** : Réservé aux administrateurs et modérateurs (`role: 'admin' | 'moderator'`).
- **Description** : Génère un fichier CSV encodé en UTF-8 avec BOM (`\uFEFF`) et séparateur `;` directement lisible par Microsoft Excel sur macOS et Windows, contenant toutes les fenêtres, contacts, formules et horaires pour le greffe communal ou les secours.
- **Paramètres de requête** : `?year=2026` (optionnel, par défaut l'année en cours).

### 5. Météo Communale en Direct (`/api/weather`)
- **Méthode** : `GET`
- **Description** : Fournit la météo en direct pour Vufflens-la-Ville (Open-Meteo, sans clé API), mise en cache 15 minutes, avec température, code WMO et conseil adapté à la promenade du soir.

### 6. Flux Temps Réel Server-Sent Events (`/api/events/live`)
- **Méthode** : `GET` (stream `text/event-stream`)
- **Description** : Diffuse en temps réel les changements d'état (ex: bascule « Plus de bonbons ») et les alertes communales instantanées envoyées par les autorités.
