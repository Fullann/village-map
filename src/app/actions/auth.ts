"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { query } from "@/lib/db";
import {
  clearSessionCookie,
  createVillageGateCookie,
  sha256Hex,
  verifyHashConstantTime,
} from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/mail";
import { checkRateLimit, recordRateLimitAttempt } from "@/lib/rateLimit";

const EmailSchema = z.object({ email: z.string().email() });

export async function unlockSiteWithVillageCode(formData: FormData) {
  const { allowed } = await checkRateLimit("access_gate", 8, 15);
  if (!allowed) {
    return {
      success: false,
      error: "Trop de tentatives depuis votre connexion. Veuillez patienter 15 minutes.",
    };
  }

  const submittedCode = (formData.get("villageCode") as string)?.trim();
  if (!submittedCode || submittedCode.length < 4) {
    return { success: false, error: "Veuillez saisir le code villageois." };
  }

  const rows = await query<{ village_secret_code_hash: string }>(
    `SELECT village_secret_code_hash FROM public.village_settings WHERE id = 1`
  );
  const expectedHash = rows[0]?.village_secret_code_hash ?? "";

  if (!verifyHashConstantTime(submittedCode, expectedHash)) {
    await recordRateLimitAttempt("access_gate");
    return { success: false, error: "Code villageois incorrect." };
  }

  await createVillageGateCookie(expectedHash);
  return { success: true };
}

export async function signInWithMagicLink(formData: FormData) {
  const { allowed } = await checkRateLimit("magic_link", 5, 15);
  if (!allowed) {
    return {
      success: false,
      error: "Trop de demandes d'email. Veuillez patienter 15 minutes.",
    };
  }

  const parsed = EmailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { success: false, error: "Adresse email invalide." };

  const email = parsed.data.email.trim().toLowerCase();
  const isAdminLogin = formData.get("adminOnly") === "true";

  await recordRateLimitAttempt("magic_link");

  if (isAdminLogin) {
    const adminCheck = await query<{ role: string }>(
      `SELECT role FROM public.profiles WHERE email = $1 AND role IN ('admin', 'moderator')`,
      [email]
    );
    if (adminCheck.length === 0) {
      return {
        success: false,
        error: "Cet email ne correspond à aucun compte administrateur ou modérateur communal.",
      };
    }
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(rawToken);

  await query(
    `INSERT INTO public.magic_links (email, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
    [email, tokenHash]
  );

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (await headers()).get("origin") ||
    "http://localhost:3000";

  const nextPath = isAdminLogin ? "/admin" : "/dashboard";
  const magicUrl = `${origin}/auth/callback?token=${rawToken}&next=${encodeURIComponent(nextPath)}`;

  try {
    await sendMagicLinkEmail(email, magicUrl);
    return {
      success: true,
      devMagicUrl: process.env.NODE_ENV !== "production" ? magicUrl : undefined,
    };
  } catch (err) {
    console.error("Erreur SMTP:", err);
    return { success: false, error: "Envoi d'email impossible (vérifiez la configuration SMTP)." };
  }
}

export async function signOut() {
  await clearSessionCookie();
  redirect("/access");
}
