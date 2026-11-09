"use server";

import { revalidatePath } from "next/cache";
import { query, withRlsContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { AdventApplicationSchema } from "@/lib/schemas";

export async function submitAdventApplication(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Non connecté." };
  if (!user.address_id || !user.verification_status.startsWith("verified")) {
    return { success: false, error: "Résidence non vérifiée." };
  }

  // 1. Vérifier que la date d'ouverture des inscriptions est atteinte et contrôler la date limite
  const settingsRows = await query<{
    opens_now: boolean;
    advent_registration_opens_at: string;
    advent_cancellation_deadline: string | null;
    is_cancellation_closed: boolean;
  }>(
    `SELECT (CURRENT_DATE >= advent_registration_opens_at) AS opens_now,
            advent_registration_opens_at::TEXT,
            advent_cancellation_deadline::TEXT,
            (advent_cancellation_deadline IS NOT NULL AND CURRENT_DATE > advent_cancellation_deadline) AS is_cancellation_closed
     FROM public.village_settings WHERE id = 1`
  );
  if (settingsRows[0] && !settingsRows[0].opens_now) {
    return {
      success: false,
      error: `Les inscriptions ouvrent le ${settingsRows[0].advent_registration_opens_at}.`,
    };
  }

  const rawType = (formData.get("participation_type") as string) || "window_only";
  const rawLabel =
    ((formData.get("activity_label") as string) || "").trim() ||
    (rawType === "hospitality" ? "Verrée & accueil des voisins" : "Fenêtre décorée");

  const parsed = AdventApplicationSchema.safeParse({
    requested_day: formData.get("requested_day"),
    participation_type: rawType,
    activity_label: rawLabel,
    lighting_time: formData.get("lighting_time"),
    event_start_time: (formData.get("event_start_time") as string) || undefined,
    event_end_time: (formData.get("event_end_time") as string) || undefined,
    hospitality_details: (formData.get("hospitality_details") as string) || undefined,
    is_accessible_step_free: formData.get("is_accessible_step_free") === "on",
    photo_url: (formData.get("photo_url") as string) || undefined,
  });
  if (!parsed.success) {
    return {
      success: false,
      error: "Veuillez sélectionner une date libre (1 à 24 décembre) et préciser votre formule.",
    };
  }
  if (parsed.data.participation_type === "hospitality" && !parsed.data.event_start_time) {
    return { success: false, error: "Indiquez l'heure de début pour l'accueil ou l'animation." };
  }

  const {
    requested_day,
    participation_type,
    activity_label,
    lighting_time,
    event_start_time,
    event_end_time,
    hospitality_details,
    is_accessible_step_free,
    photo_url,
  } = parsed.data;

  try {
    return await withRlsContext(user.id, async (client) => {
      // Vérifier si une inscription existe déjà et si la date limite de modification/désinscription est dépassée
      const existingRes = await client.query<{ id: string }>(
        `SELECT id FROM public.advent_calendar WHERE user_id = $1 AND season_year = EXTRACT(YEAR FROM CURRENT_DATE)`,
        [user.id]
      );
      if ((existingRes.rowCount ?? 0) > 0 && settingsRows[0]?.is_cancellation_closed) {
        return {
          success: false,
          error: `La date limite de modification fixée par la commune au ${settingsRows[0].advent_cancellation_deadline} est dépassée. Veuillez contacter la mairie pour toute modification.`,
        };
      }

      // 2. Vérifier que la date choisie n'est pas déjà bloquée ou pré-réservée par la commune
      const conflict = await client.query<{
        status: string;
        is_communal_event: boolean;
        block_reason: string | null;
      }>(
        `SELECT status, is_communal_event, block_reason
         FROM public.advent_calendar
         WHERE season_year = EXTRACT(YEAR FROM CURRENT_DATE)
           AND day_number = $1
           AND (is_communal_event = true OR status IN ('reserved_commune', 'blocked'))
           AND status <> 'rejected'
         LIMIT 1`,
        [requested_day]
      );

      if ((conflict.rowCount ?? 0) > 0) {
        const row = conflict.rows[0];
        if (row.status === "blocked") {
          return {
            success: false,
            error: `Le ${requested_day} décembre est bloqué par la commune${row.block_reason ? ` (${row.block_reason})` : ""}. Veuillez proposer une autre date.`,
          };
        }
        if (row.is_communal_event || row.status === "reserved_commune") {
          return {
            success: false,
            error: `Le ${requested_day} décembre est réservé pour un événement communal officiel. Veuillez proposer une autre date.`,
          };
        }
      }

      // 3. Enregistrer la proposition de date de l'habitant (status = 'submitted', day_number validé ultérieurement par la commune)
      await client.query(
        `INSERT INTO public.advent_calendar
           (season_year, requested_day, day_number, status, address_id, user_id, participation_type, activity_label, lighting_time, event_start_time, event_end_time, hospitality_details, is_accessible_step_free, photo_url)
         VALUES (EXTRACT(YEAR FROM CURRENT_DATE), $1, NULL, 'submitted', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (season_year, address_id)
         DO UPDATE SET
           requested_day = EXCLUDED.requested_day,
           day_number = CASE WHEN advent_calendar.status = 'assigned' AND advent_calendar.day_number = EXCLUDED.requested_day THEN advent_calendar.day_number ELSE NULL END,
           status = CASE WHEN advent_calendar.status = 'assigned' AND advent_calendar.day_number = EXCLUDED.requested_day THEN 'assigned' ELSE 'submitted' END,
           participation_type = EXCLUDED.participation_type,
           activity_label = EXCLUDED.activity_label,
           lighting_time = EXCLUDED.lighting_time,
           event_start_time = EXCLUDED.event_start_time,
           event_end_time = EXCLUDED.event_end_time,
           hospitality_details = EXCLUDED.hospitality_details,
           is_accessible_step_free = EXCLUDED.is_accessible_step_free,
           photo_url = COALESCE(EXCLUDED.photo_url, advent_calendar.photo_url)`,
        [
          requested_day,
          user.address_id,
          user.id,
          participation_type,
          activity_label,
          lighting_time,
          event_start_time ?? null,
          event_end_time ?? null,
          hospitality_details ?? null,
          is_accessible_step_free,
          photo_url ?? null,
        ]
      );

      revalidatePath("/advent");
      revalidatePath("/dashboard");
      revalidatePath("/admin");
      revalidatePath("/admin/print-advent");
      revalidatePath("/");
      return { success: true };
    });
  } catch (err: unknown) {
    console.error("Erreur candidature Avent :", err);
    return { success: false, error: "Enregistrement de la proposition refusé." };
  }
}

export async function withdrawAdventApplication() {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Non connecté." };
  if (!user.address_id) return { success: false, error: "Adresse non reconnue." };

  // 1. Vérifier si la commune a fixé une date limite de désinscription et si elle est dépassée
  const settingsRows = await query<{
    advent_cancellation_deadline: string | null;
    is_closed: boolean;
  }>(
    `SELECT advent_cancellation_deadline::TEXT,
            (advent_cancellation_deadline IS NOT NULL AND CURRENT_DATE > advent_cancellation_deadline) AS is_closed
     FROM public.village_settings WHERE id = 1`
  );
  const settings = settingsRows[0];
  if (settings?.is_closed && settings.advent_cancellation_deadline) {
    return {
      success: false,
      error: `La date limite de désinscription fixée par la commune (${settings.advent_cancellation_deadline}) est dépassée. Veuillez contacter la mairie pour toute demande.`,
    };
  }

  try {
    await withRlsContext(user.id, async (client) => {
      await client.query(
        `DELETE FROM public.advent_calendar
         WHERE user_id = $1
           AND season_year = EXTRACT(YEAR FROM CURRENT_DATE)
           AND is_communal_event = false`,
        [user.id]
      );
    });
  } catch (err) {
    console.error("Erreur désinscription Avent :", err);
    return { success: false, error: "Impossible de se désinscrire du Calendrier de l'Avent." };
  }

  revalidatePath("/advent");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath("/admin/print-advent");
  revalidatePath("/");
  return { success: true };
}
