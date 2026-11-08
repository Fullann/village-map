import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createSessionCookie, createVillageGateCookie } from "@/lib/auth";
import type { AppRole } from "@/types";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const { searchParams, origin } = new URL(request.url);

  const email = searchParams.get("email")?.trim().toLowerCase();
  const nextPath = searchParams.get("next") || "/dashboard";
  if (!email) {
    return NextResponse.redirect(`${origin}/access`);
  }

  const rows = await query<{ id: string; email: string; role: AppRole }>(
    `SELECT id, email, role FROM public.profiles WHERE email = $1`,
    [email]
  );

  if (!rows[0]) {
    return NextResponse.redirect(`${origin}/access`);
  }

  const settings = await query<{ village_secret_code_hash: string }>(
    `SELECT village_secret_code_hash FROM public.village_settings WHERE id = 1`
  );

  await createSessionCookie(rows[0].id, rows[0].email, rows[0].role);
  if (settings[0]?.village_secret_code_hash) {
    await createVillageGateCookie(settings[0].village_secret_code_hash);
  }

  return NextResponse.redirect(`${origin}${nextPath.startsWith("/") ? nextPath : "/dashboard"}`, {
    status: 302,
  });
}
