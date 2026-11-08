# 2. Authentification & Sécurité

Ce document décrit en détail les couches de sécurité, le modèle d'authentification sans mot de passe, la protection contre les attaques et l'isolation des environnements de **Village en Fête**.

---

## 🛡️ Modèle de Sécurité en Couches

L'application protège la vie privée des habitants et l'intégrité des données à travers 4 niveaux de protection :

```
[ Niveau 1 : Le Sas Villageois (Village Access Gate) ]
   └── Empêche le scraping extérieur et la consultation par des tiers non autorisés.
       │
[ Niveau 2 : Middleware Next.js & Cookies HTTP-Only ]
   └── Contrôle l'accès aux routes privées (/dashboard, /advent, /admin).
       │
[ Niveau 3 : Authentification sans mot de passe (Magic Link) ]
   └── Vérification par email via code unique à usage unique (TTL 15 min).
       │
[ Niveau 4 : Row-Level Security (RLS) PostgreSQL ]
   └── Isolation au niveau des lignes SQL via app.current_user_id.
```

---

## 🚪 Niveau 1 : Le Sas Villageois (`village_access_gate`)

Pour éviter que des adresses personnelles ou des présences d'enfants lors de tournées festives ne soient indexées par des moteurs de recherche ou consultées par des personnes extérieures à la commune :

- **Principe** : Un code secret municipal de 8 caractères (ex: `K9B3-7PX2`) est distribué aux habitants (via le journal communal, un flyer dans les boîtes aux lettres, ou lors de l'assemblée).
- **Stockage sécurisé** : Seul le hachage SHA-256 du code est stocké en base de données (`public.village_settings.village_secret_code_hash`).
- **Comparaison à temps constant** : La validation s'effectue via `timingSafeEqual` (`verifyHashConstantTime`) afin d'interdire les attaques temporelles (*timing attacks*).
- **Cookie de passage** : Une fois validé, un cookie signé JWT (`village_access_gate`, validité 30 jours, HTTP-Only, SameSite=Lax, Secure en prod) est déposé sur le navigateur.

---

## ✉️ Niveau 2 : Authentification par Magic Link

L'application n'utilise **aucun mot de passe**, éliminant les risques de vol d'identifiants ou de mots de passe faibles :

1. **Demande de connexion** : L'habitant renseigne son adresse email sur `/login`.
2. **Génération du Token** : Un token cryptographique aléatoire de 32 octets (`randomBytes(32).toString('hex')`) est généré.
3. **Stockage sécurisé du Token** : Seul le hash SHA-256 du token est consigné dans la table `public.magic_links` avec une date d'expiration fixée à **15 minutes**.
4. **Envoi par email** : Le lien complet `https://domaine.ch/auth/callback?token=...` est envoyé par email via le transport SMTP configuré (`nodemailer`).
5. **Validation et Session** :
   - Au clic, la route `/auth/callback` vérifie le token contre le hash SHA-256.
   - S'il est valide et non expiré, le token est marqué comme utilisé (`used_at = NOW()`).
   - Un cookie de session JWT signé `village_session` est émis pour 30 jours.

> [!NOTE]
> En environnement de développement local (`NODE_ENV !== 'production'`), si aucun serveur SMTP n'est configuré, le Magic Link est directement imprimé dans le terminal pour faciliter le travail sans configuration complexe.

---

## 🔒 Niveau 3 : Rôles et Row-Level Security (RLS)

PostgreSQL assure lui-même l'étanchéité des données grâce à son moteur RLS natif :

### Rôles applicatifs (`app_role`)
- `resident` : Habitant de la commune. Peut consulter la carte, inscrire son adresse, modifier ses propres participations.
- `moderator` : Membre du comité d'animation. Peut valider les adresses et inscriptions.
- `admin` : Administrateur communal. Accès complet au panneau `/admin`, modification des saisons, régénération des codes, exports et rappels.

### Injection du contexte utilisateur (`withRlsContext`)
Dans chaque Server Action modifiant des données sensibles, la connexion PostgreSQL exécute :

```typescript
await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
```

Le troisième argument `true` indique à PostgreSQL que la variable `app.current_user_id` est locale à la transaction courante (`is_local = true`). Ainsi, même en cas de réutilisation de la connexion par le pool, aucune fuite de session n'est possible entre deux requêtes.

---

## 🛑 Protections Anti-Bruteforce & Anti-Abus

### Rate Limiting en base de données (`public.rate_limits`)
Pour protéger les actions sensibles sans dépendre d'un serveur Redis externe :
- **Table `rate_limits`** : Enregistre les tuples `(ip_key, action, attempted_at)`.
- **Limites configurées** :
  - Tentatives de Code Villageois (`/access`) : maximum 5 essais par IP toutes les 15 minutes.
  - Envois de Magic Link (`/login`) : maximum 3 envois par tranche de 10 minutes par IP.
- **Nettoyage automatique** : Les anciennes tentatives au-delà de 24h sont automatiquement élaguées.

### Anti-bruteforce du profil (`public.verification_attempts`)
Chaque tentative infructueuse de validation d'un code de vérification résidentiel par un compte utilisateur est consignée, bloquant le compte après plusieurs échecs consécutifs.

---

## 🧪 Isolation Stricte Développement vs Production

La sécurité a fait l'objet de tests automatisés unitaires stricts (`tests/dev-isolation.test.ts`) :
- **Clé secrète JWT** : Interdiction absolue en production d'utiliser la clé par défaut (`dev_fallback_secret_...`). Si `AUTH_SECRET` est manquant ou trop court, l'application refuse de démarrer.
- **Route de bypass de test (`/auth/dev-login`)** : Accessible uniquement en mode `NODE_ENV !== 'production'`. En production, elle renvoie impérativement un code HTTP **404 Not Found**.
- **Sécurité des cookies** : En production, l'attribut `Secure: true` est systématiquement forcé sur les cookies de session et de passage.
