-- ============================================================================
-- 0005_enhancements.sql :
-- 1. Bouton temps réel "Plus de bonbons" (out_of_candy) sur halloween_registrations
-- 2. Table rate_limits pour protéger /access et l'envoi de Magic Links SMTP par IP
-- 3. Mise à jour de la vue public_map_events pour exposer out_of_candy
-- ============================================================================

ALTER TABLE public.halloween_registrations
  ADD COLUMN IF NOT EXISTS out_of_candy BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.rate_limits (
    id BIGSERIAL PRIMARY KEY,
    ip_key TEXT NOT NULL,
    action TEXT NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON public.rate_limits (ip_key, action, attempted_at DESC);

DROP VIEW IF EXISTS public.public_map_events;

CREATE VIEW public.public_map_events AS
SELECT
    a.id AS address_id,
    a.street_name,
    a.house_number,
    a.lng,
    a.lat,
    s.current_season,
    h.is_distributing,
    h.out_of_candy,
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

