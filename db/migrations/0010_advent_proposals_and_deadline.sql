-- ============================================================================
-- 0010_advent_proposals_and_deadline.sql :
-- 1. Date limite de désinscription fixée par la commune (advent_cancellation_deadline)
-- 2. Permet aux habitants de proposer un jour souhaité (requested_day) sans
--    auto-attribution immédiate (day_number assigné exclusivement par la commune)
-- 3. Possibilité de désinscription pour l'habitant avant la date limite
-- ============================================================================

ALTER TABLE public.village_settings
  ADD COLUMN IF NOT EXISTS advent_cancellation_deadline DATE;

-- Mise à jour de la vue d'état public du village
DROP VIEW IF EXISTS public.public_village_state;

CREATE VIEW public.public_village_state AS
SELECT
    current_season,
    season_year,
    advent_hide_future_details,
    advent_registration_opens_at::TEXT AS advent_registration_opens_at,
    advent_cancellation_deadline::TEXT AS advent_cancellation_deadline,
    (advent_cancellation_deadline IS NOT NULL AND CURRENT_DATE > advent_cancellation_deadline) AS advent_cancellation_closed,
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
