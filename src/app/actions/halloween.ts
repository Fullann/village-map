"use server";

import { revalidatePath } from "next/cache";
import { withRlsContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { HalloweenSchema } from "@/lib/schemas";
import { broadcastLiveEvent } from "@/lib/realtime";

export async function saveHalloweenRegistration(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Non connecté." };
  if (!user.address_id || !user.verification_status.startsWith("verified")) {
    return { success: false, error: "Résidence non vérifiée." };
  }

  const parsed = HalloweenSchema.safeParse({
    is_distributing: formData.get("is_distributing") === "on",
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time"),
    is_self_service: formData.get("is_self_service") === "on",
    is_accessible_step_free: formData.get("is_accessible_step_free") === "on",
    photo_url: (formData.get("photo_url") as string) || undefined,
    access_instructions: (formData.get("access_instructions") as string) || undefined,
  });
  if (!parsed.success) return { success: false, error: "Formulaire invalide." };
  if (parsed.data.end_time <= parsed.data.start_time) {
    return { success: false, error: "L'heure de fin doit suivre l'heure de début." };
  }

  const {
    is_distributing,
    start_time,
    end_time,
    is_self_service,
    is_accessible_step_free,
    photo_url,
    access_instructions,
  } = parsed.data;

  await withRlsContext(user.id, async (client) => {
    await client.query(
      `INSERT INTO public.halloween_registrations
         (season_year, address_id, user_id, is_distributing, out_of_candy, start_time, end_time, is_self_service, is_accessible_step_free, photo_url, access_instructions)
       VALUES (EXTRACT(YEAR FROM CURRENT_DATE), $1, $2, $3, false, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (season_year, address_id)
       DO UPDATE SET
         is_distributing = EXCLUDED.is_distributing,
         start_time = EXCLUDED.start_time,
         end_time = EXCLUDED.end_time,
         is_self_service = EXCLUDED.is_self_service,
         is_accessible_step_free = EXCLUDED.is_accessible_step_free,
         photo_url = EXCLUDED.photo_url,
         access_instructions = EXCLUDED.access_instructions`,
      [
        user.address_id,
        user.id,
        is_distributing,
        start_time,
        end_time,
        is_self_service,
        is_accessible_step_free,
        photo_url ?? null,
        access_instructions ?? null,
      ]
    );
  });

  revalidatePath("/halloween");
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { success: true };
}

/**
 * Bascule en 1 clic l'état "Plus de bonbons / Stock épuisé pour ce soir" sans supprimer la fiche.
 * Diffuse instantanément l'information à tous les marcheurs connectés en SSE.
 */
export async function toggleOutOfCandyAction() {
  const user = await getSessionUser();
  if (!user || !user.address_id) return { success: false, error: "Non autorisé" };

  let updatedState: { out_of_candy: boolean; street_name?: string; house_number?: string } | null = null;

  await withRlsContext(user.id, async (client) => {
    const res = await client.query<{ out_of_candy: boolean; street_name: string; house_number: string }>(
      `UPDATE public.halloween_registrations h
       SET out_of_candy = NOT COALESCE(h.out_of_candy, false),
           updated_at = NOW()
       FROM public.addresses a
       WHERE h.user_id = $1 
         AND h.season_year = EXTRACT(YEAR FROM CURRENT_DATE)
         AND a.id = h.address_id
       RETURNING h.out_of_candy, a.street_name, a.house_number`,
      [user.id]
    );
    if (res.rows[0]) {
      updatedState = res.rows[0];
    }
  });

  if (updatedState) {
    const state = updatedState as { out_of_candy: boolean; street_name?: string; house_number?: string };
    broadcastLiveEvent({
      type: "candy_update",
      addressId: user.address_id,
      outOfCandy: Boolean(state.out_of_candy),
      streetName: state.street_name,
      houseNumber: state.house_number,
      timestamp: new Date().toISOString(),
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/halloween");
  revalidatePath("/");
  return { success: true };
}
