"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withRlsContext } from "@/lib/db";
import { generateVillageSecretCode, getSessionUser, sha256Hex } from "@/lib/auth";
import {
  sendAddressApprovedEmail,
  sendAdventEveReminderEmail,
  sendAdventPublishedEmail,
} from "@/lib/mail";
import { broadcastLiveEvent } from "@/lib/realtime";

export async function setSeason(formData: FormData) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return { success: false, error: "Accès refusé" };

  const season = formData.get("season") as string;
  const hideFuture = formData.get("hide_future") === "on";
  const opensAt = (formData.get("advent_registration_opens_at") as string) || "2026-11-01";

  await withRlsContext(user.id, async (client) => {
    await client.query(
      `UPDATE public.village_settings
       SET current_season = $1,
           advent_hide_future_details = $2,
           advent_registration_opens_at = $3::DATE,
           updated_at = NOW(),
           updated_by = $4
       WHERE id = 1`,
      [season, hideFuture, opensAt, user.id]
    );
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/advent");
  revalidatePath("/");
  return { success: true };
}

export async function setAdventPublication(formData: FormData) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return { success: false, error: "Accès refusé" };

  const publish = formData.get("publish") === "true";

  const assignedRecipients = await withRlsContext(user.id, async (client) => {
    await client.query(
      `UPDATE public.village_settings
       SET advent_is_published = $1,
           current_season = CASE WHEN $1 = true THEN 'advent'::active_season ELSE current_season END,
           updated_at = NOW(),
           updated_by = $2
       WHERE id = 1`,
      [publish, user.id]
    );

    if (!publish) return [];

    const res = await client.query<{
      email: string;
      day_number: number;
      street_name: string;
      house_number: string;
    }>(
      `SELECT pr.email, ac.day_number, a.street_name, a.house_number
       FROM public.advent_calendar ac
       JOIN public.profiles pr ON pr.id = ac.user_id
       JOIN public.addresses a ON a.id = ac.address_id
       WHERE ac.season_year = EXTRACT(YEAR FROM CURRENT_DATE)
         AND ac.status = 'assigned'
         AND ac.day_number IS NOT NULL`
    );
    return res.rows;
  });

  // Envoie une confirmation email aux foyers attribués lors de la publication officielle
  for (const r of assignedRecipients) {
    try {
      await sendAdventPublishedEmail(r.email, r.day_number, `${r.street_name} ${r.house_number}`);
    } catch {
      /* ignore erreur SMTP individuelle */
    }
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/advent");
  revalidatePath("/");
  return { success: true };
}

export async function sendAdventRemindersAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user || (user.role !== "admin" && user.role !== "moderator")) {
    return { success: false, error: "Accès refusé" };
  }

  const targetDay = Number(formData.get("day_number") || 0);

  const recipients = await withRlsContext(user.id, async (client) => {
    const res = await client.query<{
      email: string;
      day_number: number;
      lighting_time: string;
      street_name: string;
      house_number: string;
    }>(
      `SELECT pr.email, ac.day_number, ac.lighting_time::TEXT, a.street_name, a.house_number
       FROM public.advent_calendar ac
       JOIN public.profiles pr ON pr.id = ac.user_id
       JOIN public.addresses a ON a.id = ac.address_id
       WHERE ac.season_year = EXTRACT(YEAR FROM CURRENT_DATE)
         AND ac.status = 'assigned'
         AND ($1 = 0 OR ac.day_number = $1)`,
      [targetDay]
    );
    return res.rows;
  });

  let sentCount = 0;
  for (const r of recipients) {
    try {
      await sendAdventEveReminderEmail(
        r.email,
        r.day_number,
        `${r.street_name} ${r.house_number}`,
        r.lighting_time
      );
      sentCount++;
    } catch {
      /* ignore */
    }
  }

  return { success: true, sentCount };
}

export async function assignAdventDay(formData: FormData) {
  const user = await getSessionUser();
  if (!user || (user.role !== "admin" && user.role !== "moderator")) {
    return { success: false, error: "Accès refusé" };
  }

  const registrationId = formData.get("registration_id") as string;
  const actionType = formData.get("action_type") as string;
  const rawDay = formData.get("day_number") as string;
  const dayNumber = rawDay ? Number(rawDay) : null;

  try {
    await withRlsContext(user.id, async (client) => {
      if (actionType === "reject") {
        await client.query(
          `UPDATE public.advent_calendar
           SET status = 'rejected', day_number = NULL, updated_at = NOW()
           WHERE id = $1`,
          [registrationId]
        );
      } else if (actionType === "unassign" || !dayNumber) {
        await client.query(
          `UPDATE public.advent_calendar
           SET status = 'submitted', day_number = NULL, updated_at = NOW()
           WHERE id = $1`,
          [registrationId]
        );
      } else {
        await client.query(
          `UPDATE public.advent_calendar
           SET status = 'submitted', day_number = NULL
           WHERE season_year = EXTRACT(YEAR FROM CURRENT_DATE)
             AND day_number = $1
             AND id <> $2`,
          [dayNumber, registrationId]
        );

        await client.query(
          `UPDATE public.advent_calendar
           SET day_number = $1, status = 'assigned', updated_at = NOW()
           WHERE id = $2`,
          [dayNumber, registrationId]
        );
      }
    });
  } catch (err) {
    console.error("Erreur attribution jour Avent :", err);
    return { success: false, error: "Impossible d'attribuer ce jour." };
  }

  revalidatePath("/admin");
  revalidatePath("/advent");
  revalidatePath("/");
  return { success: true };
}

const MapSettingsSchema = z.object({
  map_center_lng: z.coerce.number().min(-180).max(180),
  map_center_lat: z.coerce.number().min(-90).max(90),
  map_bounds_sw_lng: z.coerce.number().min(-180).max(180),
  map_bounds_sw_lat: z.coerce.number().min(-90).max(90),
  map_bounds_ne_lng: z.coerce.number().min(-180).max(180),
  map_bounds_ne_lat: z.coerce.number().min(-90).max(90),
  map_style_url: z.string().url("URL du style de carte invalide"),
});

export async function updateMapSettings(formData: FormData) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return { success: false, error: "Accès refusé" };

  const parsed = MapSettingsSchema.safeParse({
    map_center_lng: formData.get("map_center_lng"),
    map_center_lat: formData.get("map_center_lat"),
    map_bounds_sw_lng: formData.get("map_bounds_sw_lng"),
    map_bounds_sw_lat: formData.get("map_bounds_sw_lat"),
    map_bounds_ne_lng: formData.get("map_bounds_ne_lng"),
    map_bounds_ne_lat: formData.get("map_bounds_ne_lat"),
    map_style_url: formData.get("map_style_url"),
  });

  if (!parsed.success) {
    return { success: false, error: "Paramètres cartographiques invalides." };
  }

  const d = parsed.data;
  if (d.map_bounds_sw_lng >= d.map_bounds_ne_lng || d.map_bounds_sw_lat >= d.map_bounds_ne_lat) {
    return {
      success: false,
      error: "Les coordonnées Sud-Ouest doivent être inférieures aux coordonnées Nord-Est.",
    };
  }

  await withRlsContext(user.id, async (client) => {
    await client.query(
      `UPDATE public.village_settings
       SET map_center_lng = $1,
           map_center_lat = $2,
           map_bounds_sw_lng = $3,
           map_bounds_sw_lat = $4,
           map_bounds_ne_lng = $5,
           map_bounds_ne_lat = $6,
           map_style_url = $7,
           updated_at = NOW(),
           updated_by = $8
       WHERE id = 1`,
      [
        d.map_center_lng,
        d.map_center_lat,
        d.map_bounds_sw_lng,
        d.map_bounds_sw_lat,
        d.map_bounds_ne_lng,
        d.map_bounds_ne_lat,
        d.map_style_url,
        user.id,
      ]
    );
  });

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

/**
 * Diffuse un message d'alerte / flash communal instantané à tous les habitants connectés (SSE)
 */
export async function publishCommunalAlert(formData: FormData) {
  const user = await getSessionUser();
  if (!user || (user.role !== "admin" && user.role !== "moderator")) {
    return { success: false, error: "Accès refusé" };
  }

  const level = (formData.get("level") as string) || "warning";
  const title = (formData.get("title") as string)?.trim() || "Message de la Commune";
  const message = (formData.get("message") as string)?.trim();

  if (!message || message.length < 3) {
    return { success: false, error: "Le message d'alerte ne peut pas être vide." };
  }

  const safeLevel = ["info", "warning", "urgent"].includes(level)
    ? (level as "info" | "warning" | "urgent")
    : "warning";

  let createdAlert: { id: string; title: string; message: string; level: "info" | "warning" | "urgent" } | null = null;

  await withRlsContext(user.id, async (client) => {
    await client.query(`UPDATE public.village_alerts SET is_active = false WHERE is_active = true`);

    const res = await client.query<{ id: string; title: string; message: string; level: "info" | "warning" | "urgent" }>(
      `INSERT INTO public.village_alerts (level, title, message, is_active, created_by)
       VALUES ($1, $2, $3, true, $4)
       RETURNING id, title, message, level`,
      [safeLevel, title, message, user.id]
    );
    createdAlert = res.rows[0] ?? null;
  });

  if (createdAlert) {
    const alertData = createdAlert as { id: string; title: string; message: string; level: "info" | "warning" | "urgent" };
    broadcastLiveEvent({
      type: "communal_alert",
      id: alertData.id,
      level: alertData.level,
      title: alertData.title,
      message: alertData.message,
      active: true,
      timestamp: new Date().toISOString(),
    });
  }

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

/**
 * Retire immédiatement l'alerte active courante
 */
export async function dismissCommunalAlert(formData: FormData) {
  const user = await getSessionUser();
  if (!user || (user.role !== "admin" && user.role !== "moderator")) {
    return { success: false, error: "Accès refusé" };
  }

  const alertId = formData.get("alert_id") as string;

  await withRlsContext(user.id, async (client) => {
    if (alertId) {
      await client.query(`UPDATE public.village_alerts SET is_active = false WHERE id = $1`, [alertId]);
    } else {
      await client.query(`UPDATE public.village_alerts SET is_active = false WHERE is_active = true`);
    }
  });

  broadcastLiveEvent({
    type: "communal_alert",
    id: alertId || undefined,
    level: "info",
    title: "",
    message: "",
    active: false,
    timestamp: new Date().toISOString(),
  });

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

export async function regenerateVillageCode() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return { success: false as const, error: "Accès refusé" };

  const newPlainCode = generateVillageSecretCode();
  const hash = sha256Hex(newPlainCode);

  await withRlsContext(user.id, async (client) => {
    await client.query(
      `UPDATE public.village_settings
       SET village_secret_code_hash = $1, updated_at = NOW(), updated_by = $2
       WHERE id = 1`,
      [hash, user.id]
    );
  });

  revalidatePath("/admin");
  return { success: true as const, data: newPlainCode };
}

export async function approveVerification(formData: FormData) {
  const user = await getSessionUser();
  if (!user || (user.role !== "admin" && user.role !== "moderator")) {
    return { success: false, error: "Accès refusé" };
  }

  const targetUserId = formData.get("user_id") as string;

  const approvedUser = await withRlsContext(user.id, async (client) => {
    const res = await client.query<{ email: string; street_name: string; house_number: string }>(
      `UPDATE public.profiles pr
       SET address_id = pr.requested_address_id,
           requested_address_id = NULL,
           verification_status = 'verified_by_admin',
           verified_at = NOW(),
           verified_by = $1
       FROM public.addresses a
       WHERE pr.id = $2
         AND pr.requested_address_id IS NOT NULL
         AND a.id = pr.requested_address_id
       RETURNING pr.email, a.street_name, a.house_number`,
      [user.id, targetUserId]
    );
    return res.rows[0] ?? null;
  });

  if (approvedUser) {
    try {
      await sendAddressApprovedEmail(
        approvedUser.email,
        `${approvedUser.street_name} ${approvedUser.house_number}`
      );
    } catch {
      /* ignore erreur SMTP */
    }
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function revokeUser(formData: FormData) {
  const user = await getSessionUser();
  if (!user || (user.role !== "admin" && user.role !== "moderator")) {
    return { success: false, error: "Accès refusé" };
  }

  const targetUserId = formData.get("user_id") as string;

  await withRlsContext(user.id, async (client) => {
    await client.query(
      `UPDATE public.profiles
       SET verification_status = 'revoked', address_id = NULL, requested_address_id = NULL
       WHERE id = $1 AND role = 'resident'`,
      [targetUserId]
    );
    await client.query(`UPDATE public.halloween_registrations SET is_approved = false WHERE user_id = $1`, [
      targetUserId,
    ]);
    await client.query(`DELETE FROM public.advent_calendar WHERE user_id = $1`, [targetUserId]);
  });

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}
