-- ============================================================================
-- 0009_advent_communal_slots.sql :
-- Pré-réservation de jours communaux (inauguration, Saint-Nicolas, école)
-- et blocage de dates dans le Calendrier de l'Avent (1 au 24 décembre).
-- ============================================================================

ALTER TABLE public.advent_calendar
  ALTER COLUMN address_id DROP NOT NULL,
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS is_communal_event BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS block_reason TEXT;

-- Mise à jour du CHECK constraint sur le statut pour accepter 'reserved_commune' et 'blocked'
ALTER TABLE public.advent_calendar
  DROP CONSTRAINT IF EXISTS advent_calendar_status_check;

ALTER TABLE public.advent_calendar
  ADD CONSTRAINT advent_calendar_status_check
  CHECK (status IN ('submitted', 'assigned', 'rejected', 'reserved_commune', 'blocked'));

-- Vue mise à jour des jours occupés avec distinction des réservations et blocages communaux
DROP VIEW IF EXISTS public.advent_taken_days;

CREATE VIEW public.advent_taken_days AS
SELECT
    ac.day_number,
    ac.user_id,
    ac.status,
    ac.activity_label,
    ac.is_communal_event,
    ac.block_reason
FROM public.advent_calendar ac
JOIN public.village_settings s ON s.season_year = ac.season_year AND s.id = 1
WHERE ac.day_number IS NOT NULL AND ac.status <> 'rejected';

-- Vue cartographique mise à jour pour inclure les événements pré-réservés par la commune
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
    COALESCE(h.is_accessible_step_free, ac.is_accessible_step_free, true) AS is_accessible_step_free,
    COALESCE(h.photo_url, ac.photo_url) AS photo_url,
    ac.day_number,
    ac.participation_type,
    ac.activity_label,
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
   AND ac.status IN ('assigned', 'reserved_commune')
   AND ac.day_number IS NOT NULL
WHERE
    (s.current_season = 'halloween' AND h.id IS NOT NULL)
    OR (s.current_season = 'advent' AND s.advent_is_published = true AND ac.id IS NOT NULL);
