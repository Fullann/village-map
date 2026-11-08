import { headers } from "next/headers";
import { query } from "@/lib/db";

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "local";
}

export async function checkRateLimit(
  action: "access_gate" | "magic_link",
  maxAttempts: number,
  windowMinutes = 15
): Promise<{ allowed: boolean }> {
  const ip = await getClientIp();
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM public.rate_limits
     WHERE ip_key = $1
       AND action = $2
       AND attempted_at > NOW() - ($3 || ' minutes')::INTERVAL`,
    [ip, action, String(windowMinutes)]
  );
  const count = Number(rows[0]?.count ?? 0);
  return { allowed: count < maxAttempts };
}

export async function recordRateLimitAttempt(action: "access_gate" | "magic_link"): Promise<void> {
  const ip = await getClientIp();
  await query(`INSERT INTO public.rate_limits (ip_key, action) VALUES ($1, $2)`, [ip, action]);
}

