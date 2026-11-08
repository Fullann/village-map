-- ============================================================================
-- 0004_advent_workflow.sql :
-- 1. Date d'ouverture des inscriptions Noël/Avent (advent_registration_opens_at)
-- 2. Publication manuelle des résultats par l'admin (advent_is_published)
-- 3. Verrouillage immédiat des dates prises : dès qu'un habitant s'inscrit sur
--    une date libre (1 à 24), ce jour (day_number) est verrouillé pour éviter
--    les doublons. L'admin peut ensuite ajuster/valider et publier les résultats.
-- ============================================================================

ALTER TABLE public.village_settings
  ADD COLUMN IF NOT EXISTS advent_registration_opens_at DATE NOT NULL DEFAULT '2026-11-01',
  ADD COLUMN IF NOT EXISTS advent_is_published BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.advent_calendar
  ALTER COLUMN day_number DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS requested_day INT CHECK (requested_day BETWEEN 1 AND 24),
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('submitted', 'assigned', 'rejected'));

UPDATE public.advent_calendar
SET requested_day = COALESCE(requested_day, day_number),
    day_number = COALESCE(day_number, requested_day)
WHERE requested_day IS NULL OR day_number IS NULL;

-- Contrainte d'unicité sur (season_year, day_number) dès qu'une date est réservée (submitted ou assigned)
ALTER TABLE public.advent_calendar
  DROP CONSTRAINT IF EXISTS advent_calendar_season_year_day_number_key;

DROP INDEX IF EXISTS public.idx_advent_unique_assigned_day;

CREATE UNIQUE INDEX IF NOT EXISTS idx_advent_unique_active_day
  ON public.advent_calendar (season_year, day_number)
  WHERE day_number IS NOT NULL AND status <> 'rejected';

DROP VIEW IF EXISTS public.public_map_events;
DROP VIEW IF EXISTS public.public_village_state;
DROP VIEW IF EXISTS public.advent_taken_days;

CREATE VIEW public.public_village_state AS
SELECT
    current_season,
    season_year,
    advent_hide_future_details,
    advent_registration_opens_at::TEXT AS advent_registration_opens_at,
    advent_is_published,
    map_center_lng,
    map_center_lat,
    map_bounds_sw_lng,
    map_bounds_sw_lat,
    map_bounds_ne_lng,
    map_bounds_ne_lat,
    map_style_url
FROM public.village_settings
WHERE id = 1;

CREATE VIEW public.public_map_events AS
SELECT
    a.id AS address_id,
    a.street_name,
    a.house_number,
    a.lng,
    a.lat,
    s.current_season,
    h.is_distributing,
    h.start_time::TEXT AS halloween_start,
    h.end_time::TEXT AS halloween_end,
    h.is_self_service,
    h.access_instructions,
    ac.day_number,
    ac.participation_type,
    ac.lighting_time::TEXT AS lighting_time,
    CASE WHEN ac.id IS NULL THEN NULL
         WHEN NOT s.advent_hide_future_details
           OR (EXTRACT(MONTH FROM (NOW() AT TIME ZONE 'Europe/Zurich')) = 12
               AND EXTRACT(DAY FROM (NOW() AT TIME ZONE 'Europe/Zurich')) >= ac.day_number)
         THEN ac.hospitality_details
         ELSE 'Détails dévoilés le jour J' END AS hospitality_details,
    CASE WHEN ac.id IS NULL THEN NULL
         WHEN NOT s.advent_hide_future_details
           OR (EXTRACT(MONTH FROM (NOW() AT TIME ZONE 'Europe/Zurich')) = 12
               AND EXTRACT(DAY FROM (NOW() AT TIME ZONE 'Europe/Zurich')) >= ac.day_number)
         THEN ac.event_start_time::TEXT
         ELSE NULL END AS event_start_time
FROM public.village_settings s
CROSS JOIN public.addresses a
LEFT JOIN public.halloween_registrations h
    ON h.address_id = a.id
   AND h.season_year = s.season_year
   AND h.is_approved = true
   AND h.is_distributing = true
LEFT JOIN public.advent_calendar ac
    ON ac.address_id = a.id
   AND ac.season_year = s.season_year
   AND ac.is_approved = true
   AND ac.status = 'assigned'
   AND ac.day_number IS NOT NULL
WHERE
    (s.current_season = 'halloween' AND h.id IS NOT NULL)
    OR (s.current_season = 'advent' AND s.advent_is_published = true AND ac.id IS NOT NULL);

-- Toutes les dates déjà prises (en attente ou validées par l'admin) sont verrouillées pour les nouveaux inscrits
CREATE VIEW public.advent_taken_days AS
SELECT ac.day_number, ac.user_id
FROM public.advent_calendar ac
JOIN public.village_settings s ON s.season_year = ac.season_year AND s.id = 1
WHERE ac.day_number IS NOT NULL AND ac.status <> 'rejected';
