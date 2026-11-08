import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete("village_access_gate");
  cookieStore.delete("village_session");

  const url = new URL("/access", request.url);
  return NextResponse.redirect(url);
}
