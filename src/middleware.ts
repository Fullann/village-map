import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "village_session";
const VILLAGE_GATE_COOKIE = "village_access_gate";

// Routes nécessitant un compte connecté (Magic Link)
const AUTH_PROTECTED = ["/dashboard", "/verify", "/halloween", "/advent"];

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret === "dev_fallback_secret_change_me_in_production_64chars") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_SECRET doit être défini avec une clé secrète robuste en production."
      );
    }
    return new TextEncoder().encode("dev_fallback_secret_change_me_in_production_64chars");
  }
  return new TextEncoder().encode(secret);
}

async function verifyToken(token?: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Routes techniques / publiques d'authentification, PWA, API et ressources statiques
  if (
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/data/") ||
    pathname.startsWith("/uploads/") ||
    pathname.startsWith("/api/") ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname === "/icon.svg" ||
    pathname === "/access" ||
    pathname === "/admin/login" ||
    pathname === "/privacy"
  ) {
    return NextResponse.next();
  }

  const sessionPayload = await verifyToken(request.cookies.get(SESSION_COOKIE)?.value);
  const gatePayload = await verifyToken(request.cookies.get(VILLAGE_GATE_COOKIE)?.value);

  const isAdminOrMod =
    sessionPayload?.role === "admin" || sessionPayload?.role === "moderator";

  // 2. Accès /admin : ne demande JAMAIS le code villageois, mais redirige vers /admin/login si non connecté
  if (pathname.startsWith("/admin")) {
    if (!sessionPayload) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // 3. Pour tout le reste du site (y compris la carte / et /login) :
  //    Exige le Code Villageois (cookie `village_access_gate`) OU une session active (ex: admin déjà connecté)
  const hasVillageAccess = Boolean(gatePayload?.gate === "unlocked" || sessionPayload);
  if (!hasVillageAccess && !isAdminOrMod) {
    return NextResponse.redirect(new URL("/access", request.url));
  }

  // 4. Pages de l'espace habitant : exigent en plus d'être connecté par Magic Link
  const needsUserAccount = AUTH_PROTECTED.some((p) => pathname.startsWith(p));
  if (needsUserAccount && !sessionPayload) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
