-- ============================================================================
-- Seed de démonstration :
-- - Saison active : 'halloween' (modifiable dans /admin)
-- - Code villageois : "VILLAGE2026" (SHA-256 : 8d576aa877aa9e67f5dd0758bf7c34efe71216a6a5586ec50ae0e019522f70c1)
-- - 5 adresses dans le village (Lausanne / Exemple)
-- - 1 compte Admin déjà inscrit et vérifié : admin@village.ch
-- - 1 compte Client (Habitant) déjà inscrit et vérifié : habitant@village.ch
-- - 1 compte en attente de validation pour tester la modération : attente@village.ch
-- ============================================================================

-- Paramètres du village : active Halloween par défaut + code "VILLAGE2026"
UPDATE public.village_settings
SET current_season = 'halloween',
    village_secret_code_hash = '8d576aa877aa9e67f5dd0758bf7c34efe71216a6a5586ec50ae0e019522f70c1'
WHERE id = 1;

-- Adresses de la whitelist
INSERT INTO public.addresses (id, external_cadastre_id, street_name, house_number, postal_code, city, lng, lat) VALUES
 ('11111111-1111-4111-8111-111111111101', 'DEMO-1', 'Rue du Village', '1', '1000', 'Village', 6.6323, 46.5197),
 ('11111111-1111-4111-8111-111111111102', 'DEMO-2', 'Rue du Village', '2', '1000', 'Village', 6.6328, 46.5199),
 ('11111111-1111-4111-8111-111111111103', 'DEMO-3', 'Chemin des Vignes', '5', '1000', 'Village', 6.6315, 46.5202),
 ('11111111-1111-4111-8111-111111111104', 'DEMO-4', 'Place de l''Église', '4', '1000', 'Village', 6.6334, 46.5193),
 ('11111111-1111-4111-8111-111111111105', 'DEMO-5', 'Impasse du Château', '12', '1000', 'Village', 6.6319, 46.5191)
ON CONFLICT (street_name, house_number, postal_code) DO NOTHING;

-- Comptes pré-inscrits : Admin + Client vérifié + Habitant en attente de modération
INSERT INTO public.profiles (id, email, full_name, role, address_id, requested_address_id, verification_status, verified_at) VALUES
 (
   '22222222-2222-4222-8222-222222222201',
   'admin@village.ch',
   'Mairie / Admin Communal',
   'admin',
   '11111111-1111-4111-8111-111111111101',
   NULL,
   'verified_by_admin',
   NOW()
 ),
 (
   '22222222-2222-4222-8222-222222222202',
   'habitant@village.ch',
   'Famille Rochat (Client inscrit)',
   'resident',
   '11111111-1111-4111-8111-111111111102',
   NULL,
   'verified_by_code',
   NOW()
 ),
 (
   '22222222-2222-4222-8222-222222222203',
   'attente@village.ch',
   'Voisin en attente',
   'resident',
   NULL,
   '11111111-1111-4111-8111-111111111103',
   'pending',
   NULL
 )
ON CONFLICT (email) DO NOTHING;

-- Inscriptions Halloween pré-remplies pour voir les marqueurs sur la carte immédiatement
INSERT INTO public.halloween_registrations
  (season_year, address_id, user_id, is_distributing, start_time, end_time, is_self_service, access_instructions)
VALUES
  (
    EXTRACT(YEAR FROM CURRENT_DATE),
    '11111111-1111-4111-8111-111111111101',
    '22222222-2222-4222-8222-222222222201',
    true,
    '17:30',
    '21:00',
    false,
    'Sonnez à la porte principale décorée de citrouilles !'
  ),
  (
    EXTRACT(YEAR FROM CURRENT_DATE),
    '11111111-1111-4111-8111-111111111102',
    '22222222-2222-4222-8222-222222222202',
    true,
    '18:00',
    '20:30',
    true,
    'Grand chaudron en libre-service sous le porche, servez-vous (2 bonbons par enfant) !'
  )
ON CONFLICT (season_year, address_id) DO NOTHING;

-- Fenêtres du Calendrier de l'Avent pré-remplies (visibles en basculant sur l'onglet Avent)
INSERT INTO public.advent_calendar
  (season_year, day_number, address_id, user_id, participation_type, lighting_time, event_start_time, event_end_time, hospitality_details)
VALUES
  (
    EXTRACT(YEAR FROM CURRENT_DATE),
    1,
    '11111111-1111-4111-8111-111111111101',
    '22222222-2222-4222-8222-222222222201',
    'hospitality',
    '17:00',
    '18:30',
    '20:00',
    'Ouverture du calendrier : vin chaud, thé à la cannelle et biscuits de Noël sur le parvis !'
  ),
  (
    EXTRACT(YEAR FROM CURRENT_DATE),
    12,
    '11111111-1111-4111-8111-111111111102',
    '22222222-2222-4222-8222-222222222202',
    'window_only',
    '17:30',
    NULL,
    NULL,
    NULL
  )
ON CONFLICT (season_year, address_id) DO NOTHING;
