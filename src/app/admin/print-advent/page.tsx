import { redirect } from "next/navigation";
import Link from "next/link";
import { withRlsContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { PrintPosterButton } from "@/components/PrintPosterButton";

interface AdventRow {
  day_number: number;
  street_name: string;
  house_number: string;
  full_name: string;
  participation_type: "window_only" | "hospitality";
  activity_label: string | null;
  lighting_time: string;
  event_start_time: string | null;
  event_end_time: string | null;
  hospitality_details: string | null;
}

export default async function PrintAdventPosterPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (me.role === "resident") redirect("/dashboard");

  const rows = await withRlsContext(me.id, async (client) => {
    const res = await client.query<AdventRow>(
      `SELECT ac.day_number,
              a.street_name,
              a.house_number,
              pr.full_name,
              ac.participation_type,
              ac.activity_label,
              ac.lighting_time::TEXT,
              ac.event_start_time::TEXT,
              ac.event_end_time::TEXT,
              ac.hospitality_details
       FROM public.advent_calendar ac
       JOIN public.addresses a ON a.id = ac.address_id
       JOIN public.profiles pr ON pr.id = ac.user_id
       WHERE ac.season_year = EXTRACT(YEAR FROM CURRENT_DATE)
         AND ac.status = 'assigned'
         AND ac.day_number IS NOT NULL
       ORDER BY ac.day_number ASC`
    );
    return res.rows;
  });

  const byDay = new Map<number, AdventRow>();
  for (const r of rows) {
    byDay.set(r.day_number, r);
  }

  const currentYear = new Date().getFullYear();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vufflens-en-fete.ch";
  const qrSvgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&format=svg&data=${encodeURIComponent(
    appUrl
  )}`;

  return (
    <div className="min-h-screen bg-stone-200 py-8 px-4 print:bg-white print:p-0 text-stone-900">
      {/* Barre d'outils (masquée à l'impression) */}
      <div className="mx-auto mb-6 flex max-w-[210mm] items-center justify-between rounded-lg border border-stone-300 bg-white px-4 py-3 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="text-xs font-medium text-stone-600 hover:text-stone-900"
          >
            ← Retour à l&apos;administration
          </Link>
          <span className="text-xs text-stone-400">|</span>
          <span className="text-xs font-semibold text-stone-800">
            Aperçu A4 prêt pour le pilier public / tout-ménage
          </span>
        </div>
        <PrintPosterButton />
      </div>

      {/* Feuille A4 */}
      <main className="mx-auto max-w-[210mm] bg-[#FAF8F5] p-8 sm:p-10 shadow-md print:shadow-none print:bg-white border border-stone-300 print:border-0">
        {/* En-tête officiel */}
        <header className="flex items-start justify-between border-b-2 border-stone-900 pb-5 mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#1b4d3e]">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-[#b91c1c] text-white text-[11px] font-bold">
                +
              </span>
              Commune de Vufflens-la-Ville · Décembre {currentYear}
            </div>
            <h1 className="font-editorial text-3xl font-bold tracking-tight text-stone-900">
              Calendrier des Fenêtres de l&apos;Avent
            </h1>
            <p className="text-xs text-stone-600 max-w-md">
              Chaque soir du 1er au 24 décembre, une nouvelle fenêtre décorée s&apos;illumine dans le village. Retrouvez le parcours 3D interactif en scannant le QR code ci-contre.
            </p>
          </div>

          {/* Bloc QR Code */}
          <div className="flex flex-col items-center rounded-lg border border-stone-300 bg-white p-2.5 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrSvgUrl}
              alt="QR Code vers la carte 3D de Vufflens-la-Ville"
              className="h-20 w-20"
            />
            <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-stone-700">
              Carte 3D interactive
            </span>
          </div>
        </header>

        {/* Tableau des 24 dates */}
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b-2 border-stone-900 text-[10px] font-bold uppercase tracking-wider text-stone-600">
              <th className="py-2 pr-3 w-20">Date</th>
              <th className="py-2 px-3">Adresse à Vufflens-la-Ville</th>
              <th className="py-2 px-3">Famille / Hôte</th>
              <th className="py-2 px-3">Horaires</th>
              <th className="py-2 pl-3 text-right">Formule</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {Array.from({ length: 24 }, (_, i) => i + 1).map((day) => {
              const item = byDay.get(day);
              return (
                <tr key={day} className="align-middle">
                  <td className="py-2 pr-3 font-editorial font-bold text-sm text-[#1b4d3e] tabular-nums">
                    {day} déc.
                  </td>
                  {item ? (
                    <>
                      <td className="py-2 px-3 font-semibold text-stone-900">
                        {item.street_name} {item.house_number}
                      </td>
                      <td className="py-2 px-3 text-stone-700">
                        {item.full_name || "Habitant du village"}
                      </td>
                      <td className="py-2 px-3 tabular-nums text-stone-700">
                        Dès {item.lighting_time.slice(0, 5)}
                        {item.participation_type === "hospitality" &&
                        item.event_start_time
                          ? ` (accueil ${item.event_start_time.slice(0, 5)}${
                              item.event_end_time ? `–${item.event_end_time.slice(0, 5)}` : ""
                            })`
                          : ""}
                      </td>
                      <td className="py-2 pl-3 text-right">
                        {item.participation_type === "hospitality" ? (
                          <span className="inline-block rounded border border-[#1b4d3e] bg-[#1b4d3e]/10 px-2 py-0.5 text-[10px] font-bold text-[#1b4d3e]">
                            {item.activity_label || "Verrée & accueil"}
                          </span>
                        ) : (
                          <span className="inline-block rounded border border-stone-300 bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-700">
                            {item.activity_label || "Fenêtre décorée"}
                          </span>
                        )}
                      </td>
                    </>
                  ) : (
                    <td colSpan={4} className="py-2 px-3 italic text-stone-400">
                      Date disponible — Inscription ouverte sur la plateforme communale
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pied de page officiel */}
        <footer className="mt-6 flex items-center justify-between border-t border-stone-300 pt-3 text-[10px] text-stone-500">
          <span>Commune de Vufflens-la-Ville (1302) · Pilier public &amp; bulletin communal</span>
          <span>Accès web : {appUrl}</span>
        </footer>
      </main>
    </div>
  );
}

