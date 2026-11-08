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

  // 1. Vérifier que la date d'ouverture des inscriptions est atteinte
  const settingsRows = await query<{ opens_now: boolean; advent_registration_opens_at: string }>(
    `SELECT (CURRENT_DATE >= advent_registration_opens_at) AS opens_now,
            advent_registration_opens_at::TEXT
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
      // 2. Vérifier que la date choisie n'est pas déjà prise par un autre foyer
      const conflict = await client.query(
        `SELECT 1 FROM public.advent_calendar
         WHERE season_year = EXTRACT(YEAR FROM CURRENT_DATE)
           AND day_number = $1
           AND address_id <> $2
           AND status <> 'rejected'`,
        [requested_day, user.address_id]
      );

      if ((conflict.rowCount ?? 0) > 0) {
        return {
          success: false,
          error: `Le ${requested_day} décembre est déjà réservé par un autre foyer. Veuillez choisir une date disponible.`,
        };
      }

      // 3. Enregistrer et verrouiller immédiatement la date choisie
      await client.query(
        `INSERT INTO public.advent_calendar
           (season_year, requested_day, day_number, status, address_id, user_id, participation_type, activity_label, lighting_time, event_start_time, event_end_time, hospitality_details, is_accessible_step_free, photo_url)
         VALUES (EXTRACT(YEAR FROM CURRENT_DATE), $1, $1, 'submitted', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (season_year, address_id)
         DO UPDATE SET
           requested_day = EXCLUDED.requested_day,
           day_number = EXCLUDED.day_number,
           status = CASE WHEN advent_calendar.status = 'assigned' THEN 'assigned' ELSE 'submitted' END,
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
      revalidatePath("/admin");
      revalidatePath("/admin/print-advent");
      revalidatePath("/");
      return { success: true };
    });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      return {
        success: false,
        error: `Le ${requested_day} décembre vient d'être réservé par un autre foyer. Veuillez choisir une autre date disponible.`,
      };
    }
    console.error("Erreur candidature Avent :", err);
    return { success: false, error: "Enregistrement refusé." };
  }
}
