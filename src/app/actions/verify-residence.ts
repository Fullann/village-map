"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withRlsContext } from "@/lib/db";
import { getSessionUser, verifyHashConstantTime } from "@/lib/auth";

const VerifySchema = z.object({
  addressId: z.string().uuid("Adresse invalide"),
  mode: z.enum(["code", "manual_moderation"]),
  villageCode: z.string().optional(),
});

export async function verifyResidenceAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Vous devez être connecté (Magic Link)." };
  if (user.verification_status === "revoked") {
    return { success: false, error: "Compte révoqué : contactez la commune." };
  }

  const parsed = VerifySchema.safeParse({
    addressId: formData.get("addressId"),
    mode: formData.get("mode"),
    villageCode: formData.get("villageCode") ?? undefined,
  });
  if (!parsed.success) return { success: false, error: "Données de formulaire invalides." };

  const { addressId, mode, villageCode } = parsed.data;

  return withRlsContext(user.id, async (client) => {
    // 1. Vérifier que l'adresse fait partie de la whitelist communale
    const addrCheck = await client.query(`SELECT 1 FROM public.addresses WHERE id = $1`, [addressId]);
    if (addrCheck.rowCount === 0) {
      return { success: false, error: "Adresse hors du périmètre communal." };
    }

    // 2. Vérifier qu'aucun autre foyer vérifié n'occupe déjà cette adresse
    const takenCheck = await client.query(
      `SELECT 1 FROM public.profiles
       WHERE address_id = $1 AND id <> $2
         AND verification_status IN ('verified_by_code', 'verified_by_admin')`,
      [addressId, user.id]
    );
    if ((takenCheck.rowCount ?? 0) > 0) {
      return { success: false, error: "Cette adresse est déjà rattachée à un foyer vérifié." };
    }

    // Voie A : Validation par Code Villageois
    if (mode === "code") {
      if (!villageCode || villageCode.trim().length < 4) {
        return { success: false, error: "Veuillez saisir le code villageois." };
      }

      // Anti-bruteforce : max 5 essais sur 15 minutes
      const attemptsRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM public.verification_attempts
         WHERE user_id = $1 AND attempted_at > NOW() - INTERVAL '15 minutes'`,
        [user.id]
      );
      if (Number(attemptsRes.rows[0].count) >= 5) {
        return { success: false, error: "Trop de tentatives. Réessayez dans 15 minutes." };
      }

      const settingsRes = await client.query<{ village_secret_code_hash: string }>(
        `SELECT village_secret_code_hash FROM public.village_settings WHERE id = 1`
      );
      const expectedHash = settingsRes.rows[0]?.village_secret_code_hash ?? "";

      if (!verifyHashConstantTime(villageCode, expectedHash)) {
        await client.query(`INSERT INTO public.verification_attempts (user_id) VALUES ($1)`, [user.id]);
        return { success: false, error: "Code villageois invalide." };
      }

      await client.query(
        `UPDATE public.profiles
         SET address_id = $1, requested_address_id = NULL,
             verification_status = 'verified_by_code', verified_at = NOW()
         WHERE id = $2`,
        [addressId, user.id]
      );

      revalidatePath("/dashboard");
      return { success: true, status: "verified_by_code" };
    }

    // Voie B : Demande de modération manuelle par un administrateur communal
    await client.query(
      `UPDATE public.profiles
       SET requested_address_id = $1, verification_status = 'pending'
       WHERE id = $2`,
      [addressId, user.id]
    );

    revalidatePath("/dashboard");
    return { success: true, status: "pending" };
  });
}
