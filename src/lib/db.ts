import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  // Évite de recréer un pool à chaque hot-reload en développement
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __schemaFormulaSynced: boolean | undefined;
}

export const pool: Pool =
  global.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, // Adapté aux hébergements mutualisés o2switch
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") {
  global.__pgPool = pool;
}

async function ensureSchemaSynced() {
  if (global.__schemaFormulaSynced) return;
  global.__schemaFormulaSynced = true;
  try {
    await pool.query(`
      ALTER TABLE public.advent_calendar
        ALTER COLUMN address_id DROP NOT NULL,
        ALTER COLUMN user_id DROP NOT NULL,
        ADD COLUMN IF NOT EXISTS activity_label TEXT,
        ADD COLUMN IF NOT EXISTS is_accessible_step_free BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS photo_url TEXT,
        ADD COLUMN IF NOT EXISTS is_communal_event BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS block_reason TEXT;

      ALTER TABLE public.advent_calendar
        DROP CONSTRAINT IF EXISTS advent_calendar_status_check;

      ALTER TABLE public.advent_calendar
        ADD CONSTRAINT advent_calendar_status_check
        CHECK (status IN ('submitted', 'assigned', 'rejected', 'reserved_commune', 'blocked'));

      ALTER TABLE public.halloween_registrations
        ADD COLUMN IF NOT EXISTS is_accessible_step_free BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS photo_url TEXT;

      ALTER TABLE public.village_settings
        ADD COLUMN IF NOT EXISTS advent_cancellation_deadline DATE;

      CREATE TABLE IF NOT EXISTS public.analytics_visits (
          id BIGSERIAL PRIMARY KEY,
          event_type TEXT NOT NULL,
          address_id UUID REFERENCES public.addresses(id) ON DELETE SET NULL,
          season_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.village_alerts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          level TEXT NOT NULL DEFAULT 'warning' CHECK (level IN ('info', 'warning', 'urgent')),
          title TEXT NOT NULL DEFAULT 'Message de la Commune',
          message TEXT NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_village_alerts_active
        ON public.village_alerts (is_active, created_at DESC);

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
    `);
  } catch (err) {
    global.__schemaFormulaSynced = false;
    console.error("Erreur de synchronisation du schéma :", err);
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  await ensureSchemaSynced();
  const res = await pool.query<T>(text, params);
  return res.rows;
}

/**
 * Exécute une ou plusieurs requêtes dans une transaction PostgreSQL
 * après avoir injecté `app.current_user_id` pour activer les politiques RLS.
 */
export async function withRlsContext<T>(
  userId: string | null,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  await ensureSchemaSynced();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId ?? ""]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
