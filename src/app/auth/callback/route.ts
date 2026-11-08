import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createSessionCookie, createVillageGateCookie, sha256Hex } from "@/lib/auth";
import type { AppRole } from "@/types";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const rawToken = searchParams.get("token");
  const nextPath = searchParams.get("next") || "/dashboard";

  if (!rawToken) {
    return NextResponse.redirect(`${origin}/login?error=missing_token`);
  }

  const tokenHash = sha256Hex(rawToken);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const linkRes = await client.query<{ email: string }>(
      `UPDATE public.magic_links
       SET used_at = NOW()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       RETURNING email`,
      [tokenHash]
    );

    if (linkRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.redirect(`${origin}/login?error=expired_or_invalid`);
    }

    const email = linkRes.rows[0].email;

    const userRes = await client.query<{ id: string; email: string; role: AppRole }>(
      `INSERT INTO public.profiles (email)
       VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
       RETURNING id, email, role`,
      [email]
    );

    const settingsRes = await client.query<{ village_secret_code_hash: string }>(
      `SELECT village_secret_code_hash FROM public.village_settings WHERE id = 1`
    );

    await client.query("COMMIT");

    const user = userRes.rows[0];
    await createSessionCookie(user.id, user.email, user.role);
    if (settingsRes.rows[0]?.village_secret_code_hash) {
      await createVillageGateCookie(settingsRes.rows[0].village_secret_code_hash);
    }

    const safeNext = nextPath.startsWith("/") ? nextPath : "/dashboard";
    return NextResponse.redirect(`${origin}${safeNext}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erreur callback Magic Link:", err);
    return NextResponse.redirect(`${origin}/login?error=server_error`);
  } finally {
    client.release();
  }
}
