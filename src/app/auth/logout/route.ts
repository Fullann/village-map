import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  await clearSessionCookie();
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/access`, { status: 302 });
}

export async function GET(request: Request) {
  await clearSessionCookie();
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/access`, { status: 302 });
}
