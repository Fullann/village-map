import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

function pad2(n: number | string): string {
  return String(n).padStart(2, "0");
}

function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const addressId = searchParams.get("addressId");
  const seasonParam = searchParams.get("season");
  const dayParam = searchParams.get("day");

  // Query events
  let sql = `
    SELECT
      address_id,
      street_name,
      house_number,
      current_season,
      is_distributing,
      halloween_start,
      halloween_end,
      is_self_service,
      access_instructions,
      is_accessible_step_free,
      day_number,
      participation_type,
      activity_label,
      lighting_time,
      hospitality_details,
      event_start_time
    FROM public.public_map_events
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (addressId) {
    params.push(addressId);
    sql += ` AND address_id = $${params.length}`;
  }
  if (dayParam) {
    params.push(parseInt(dayParam, 10));
    sql += ` AND day_number = $${params.length}`;
  }
  if (seasonParam) {
    params.push(seasonParam);
    sql += ` AND current_season = $${params.length}`;
  }

  const rows = await query<any>(sql, params);

  if (rows.length === 0) {
    return new NextResponse("Aucun événement trouvé.", { status: 404 });
  }

  const now = new Date();
  const nowIso = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const currentYear = now.getFullYear();

  let icsLines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Commune de Vufflens-la-Ville//Evenements Communaux//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Événements Vufflens-la-Ville",
    "X-WR-TIMEZONE:Europe/Zurich",
  ];

  for (const ev of rows) {
    const address = `${ev.street_name} ${ev.house_number}`;
    const location = `${address}, 1302 Vufflens-la-Ville, Suisse`;
    const uid = `vufflens-${ev.address_id}-${ev.day_number || "halloween"}-${currentYear}@vufflens-la-ville.ch`;

    let summary = "";
    let description = "";
    let dtStart = "";
    let dtEnd = "";

    if (ev.current_season === "halloween" || (!ev.day_number && ev.halloween_start)) {
      summary = `🎃 Halloween : ${address}`;
      const startH = ev.halloween_start?.slice(0, 5) || "18:00";
      const endH = ev.halloween_end?.slice(0, 5) || "20:30";
      const [sH, sM] = startH.split(":");
      const [eH, eM] = endH.split(":");

      dtStart = `${currentYear}1031T${pad2(sH)}${pad2(sM)}00`;
      dtEnd = `${currentYear}1031T${pad2(eH)}${pad2(eM)}00`;

      const detailsList = [
        "Soirée d'Halloween à Vufflens-la-Ville",
        ev.is_self_service ? "Panier en libre-service" : "Accueil à la porte",
        ev.is_accessible_step_free ? "Accès de plain-pied (poussettes & PMR)" : null,
        ev.access_instructions ? `Infos : ${ev.access_instructions}` : null,
      ].filter(Boolean);
      description = detailsList.join("\\n");
    } else {
      const day = ev.day_number || 1;
      const actName = ev.activity_label || (ev.participation_type === "hospitality" ? "Verrée & accueil" : "Fenêtre illuminée");
      summary = `🎄 Avent #${day} : ${actName} (${address})`;

      const timeStr = ev.event_start_time?.slice(0, 5) || ev.lighting_time?.slice(0, 5) || "17:30";
      const [tH, tM] = timeStr.split(":");
      const sH = parseInt(tH || "17", 10);
      const sM = parseInt(tM || "30", 10);
      const endH = (sH + 2) % 24;

      dtStart = `${currentYear}12${pad2(day)}T${pad2(sH)}${pad2(sM)}00`;
      dtEnd = `${currentYear}12${pad2(day)}T${pad2(endH)}${pad2(sM)}00`;

      const detailsList = [
        `Calendrier de l'Avent de Vufflens-la-Ville - Jour ${day}`,
        `Formule : ${actName}`,
        ev.is_accessible_step_free ? "Accès de plain-pied (poussettes & PMR)" : null,
        ev.hospitality_details ? `Précisions : ${ev.hospitality_details}` : null,
      ].filter(Boolean);
      description = detailsList.join("\\n");
    }

    icsLines.push("BEGIN:VEVENT");
    icsLines.push(`UID:${uid}`);
    icsLines.push(`DTSTAMP:${nowIso}`);
    icsLines.push(`DTSTART;TZID=Europe/Zurich:${dtStart}`);
    icsLines.push(`DTEND;TZID=Europe/Zurich:${dtEnd}`);
    icsLines.push(`SUMMARY:${escapeIcsText(summary)}`);
    icsLines.push(`LOCATION:${escapeIcsText(location)}`);
    icsLines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    icsLines.push("STATUS:CONFIRMED");
    icsLines.push("END:VEVENT");
  }

  icsLines.push("END:VCALENDAR");

  const icsBody = icsLines.join("\r\n");
  const filename =
    rows.length === 1
      ? `vufflens-${rows[0].current_season}-${rows[0].day_number || "event"}.ics`
      : `vufflens-calendrier.ics`;

  return new NextResponse(icsBody, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-cache",
    },
  });
}
