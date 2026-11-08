import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { query } from "@/lib/db";
import type { AppRole, Profile } from "@/types";

export const SESSION_COOKIE = "village_session";
export const VILLAGE_GATE_COOKIE = "village_access_gate";

export const DEV_FALLBACK_SECRET = "dev_fallback_secret_change_me_in_production_64chars";

export function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret === DEV_FALLBACK_SECRET) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_SECRET doit être défini avec une clé secrète robuste en production (min. 32 caractères)."
      );
    }
    return new TextEncoder().encode(DEV_FALLBACK_SECRET);
  }
  return new TextEncoder().encode(secret);
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function verifyHashConstantTime(plain: string, expectedHashHex: string): boolean {
  const computed = Buffer.from(sha256Hex(plain.trim().toUpperCase()), "hex");
  const expected = Buffer.from(expectedHashHex, "hex");
  if (computed.length !== expected.length) return false;
  return timingSafeEqual(computed, expected);
}

export function generateVillageSecretCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

export async function createSessionCookie(userId: string, email: string, role: AppRole = "resident") {
  const token = await new SignJWT({ sub: userId, email, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getJwtSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function createVillageGateCookie(codeHashPrefix: string) {
  const token = await new SignJWT({ gate: "unlocked", ver: codeHashPrefix.slice(0, 12) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getJwtSecret());

  const cookieStore = await cookies();
  cookieStore.set(VILLAGE_GATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(VILLAGE_GATE_COOKIE);
}

export async function getSessionUser(): Promise<Profile | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.sub) return null;

    const rows = await query<Profile>(
      `SELECT id, email, full_name, role, address_id, requested_address_id, verification_status
       FROM public.profiles WHERE id = $1`,
      [payload.sub]
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
