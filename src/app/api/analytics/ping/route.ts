import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const eventType = typeof body.eventType === "string" ? body.eventType.slice(0, 50) : "page_view";
    const addressId = typeof body.addressId === "string" ? body.addressId : null;

    await query(
      `INSERT INTO public.analytics_visits (event_type, address_id, season_year, created_at)
       VALUES ($1, $2, EXTRACT(YEAR FROM CURRENT_DATE), NOW())`,
      [eventType, addressId]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
