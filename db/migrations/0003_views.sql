-- ============================================================================
-- 0003_views.sql : Vues publiques (masquage serveur des surprises de l'Avent)
-- Permet aussi de prévisualiser les deux couches (Halloween & Avent) sur la carte
-- ============================================================================

CREATE OR REPLACE VIEW public.public_village_state AS
SELECT
    current_season,
    season_year,
    advent_hide_future_details,
    map_center_lng,
    map_center_lat,
    map_bounds_sw_lng,
    map_bounds_sw_lat,
    map_bounds_ne_lng,
    map_bounds_ne_lat,
    map_style_url
FROM public.village_settings
WHERE id = 1;

CREATE OR REPLACE VIEW public.public_map_events AS
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
         ELSE 'Surprise dévoilée le jour J !' END AS hospitality_details,
    CASE WHEN ac.id IS NULL THEN NULL
         WHEN NOT s.advent_hide_future_details
           OR (EXTRACT(MONTH FROM (NOW() AT TIME ZONE 'Europe/Zurich')) = 12
               AND EXTRACT(DAY FROM (NOW() AT TIME ZONE 'Europe/Zurich')) >= ac.day_number)
         THEN ac.event_start_time::TEXT
         ELSE NULL END AS event_start_time
FROM public.village_settings s
CROSS JOIN public.addresses a
LEFT JOIN public.halloween_registrations h
    ON h.address_id = a.id AND h.season_year = s.season_year AND h.is_approved AND h.is_distributing
LEFT JOIN public.advent_calendar ac
    ON ac.address_id = a.id AND ac.season_year = s.season_year AND ac.is_approved
WHERE h.id IS NOT NULL OR ac.id IS NOT NULL;

CREATE OR REPLACE VIEW public.advent_taken_days AS
SELECT ac.day_number
FROM public.advent_calendar ac
JOIN public.village_settings s ON s.season_year = ac.season_year AND s.id = 1;
