import { NextResponse } from "next/server";
import { query, withRlsContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user || (user.role !== "admin" && user.role !== "moderator")) {
    return new NextResponse("Accès non autorisé", { status: 403 });
  }

  const rows = await withRlsContext(user.id, async (client) => {
    const res = await client.query<{
      day_number: number | null;
      requested_day: number | null;
      status: string;
      is_communal_event: boolean;
      block_reason: string | null;
      street_name: string | null;
      house_number: string | null;
      full_name: string | null;
      email: string | null;
      activity_label: string | null;
      participation_type: string | null;
      lighting_time: string | null;
      event_start_time: string | null;
      event_end_time: string | null;
      is_accessible_step_free: boolean | null;
      hospitality_details: string | null;
    }>(
      `SELECT ac.day_number,
              ac.requested_day,
              ac.status,
              ac.is_communal_event,
              ac.block_reason,
              a.street_name,
              a.house_number,
              pr.full_name,
              pr.email,
              ac.activity_label,
              ac.participation_type,
              ac.lighting_time::TEXT,
              ac.event_start_time::TEXT,
              ac.event_end_time::TEXT,
              ac.is_accessible_step_free,
              ac.hospitality_details
       FROM public.advent_calendar ac
       LEFT JOIN public.addresses a ON a.id = ac.address_id
       LEFT JOIN public.profiles pr ON pr.id = ac.user_id
       WHERE ac.season_year = EXTRACT(YEAR FROM CURRENT_DATE)
       ORDER BY COALESCE(ac.day_number, ac.requested_day, 99) ASC`
    );
    return res.rows;
  });

  const headers = [
    "Jour officiel (décembre)",
    "Jour souhaité",
    "Statut",
    "Type",
    "Adresse",
    "Organisateur / Contact",
    "Email",
    "Intitulé de l'animation",
    "Formule",
    "Heure illumination",
    "Heure accueil/verrée (début)",
    "Heure fin",
    "Plain-pied / PMR",
    "Détails pratiques & accueil",
    "Motif de blocage",
  ];

  const csvRows: string[] = [];
  // UTF-8 BOM pour ouverture directe et parfaite dans Excel (Mac & Windows)
  csvRows.push(headers.map(escapeCsvCell).join(";"));

  for (const r of rows) {
    let statutLabel = "En attente";
    if (r.status === "assigned") statutLabel = "Attribué habitant";
    else if (r.status === "reserved_commune") statutLabel = "Réservé Commune";
    else if (r.status === "blocked") statutLabel = "Bloqué Commune";
    else if (r.status === "rejected") statutLabel = "Refusé";

    const typeLabel = r.is_communal_event
      ? "Communal"
      : r.participation_type === "hospitality"
      ? "Accueil & verrée"
      : "Fenêtre décorée";

    const adresse = r.street_name ? `${r.street_name} ${r.house_number}` : "";
    const pmr = r.is_accessible_step_free ? "Oui (plain-pied)" : "Non";

    const line = [
      r.day_number ?? "",
      r.requested_day ?? "",
      statutLabel,
      typeLabel,
      adresse,
      r.full_name ?? "",
      r.email ?? "",
      r.activity_label ?? "",
      r.participation_type === "hospitality" ? "Verrée & accueil" : "Fenêtre illuminée",
      r.lighting_time ? r.lighting_time.slice(0, 5) : "",
      r.event_start_time ? r.event_start_time.slice(0, 5) : "",
      r.event_end_time ? r.event_end_time.slice(0, 5) : "",
      pmr,
      r.hospitality_details ?? "",
      r.block_reason ?? "",
    ];

    csvRows.push(line.map(escapeCsvCell).join(";"));
  }

  const csvContent = "\uFEFF" + csvRows.join("\r\n");
  const year = new Date().getFullYear();

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="calendrier-avent-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
