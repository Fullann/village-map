import { redirect } from "next/navigation";
import Link from "next/link";
import { query, withRlsContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import {
  approveVerification,
  revokeUser,
  setSeason,
  setAdventPublication,
  assignAdventDay,
  reserveCommunalAdventDay,
  blockAdventDay,
  freeAdventDay,
  regenerateVillageCode,
  updateMapSettings,
  sendAdventRemindersAction,
  publishCommunalAlert,
  dismissCommunalAlert,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import type { SeasonMode, CommunalAlert } from "@/types";

interface VillageStateRow {
  current_season: SeasonMode;
  advent_hide_future_details: boolean;
  advent_registration_opens_at: string;
  advent_cancellation_deadline?: string | null;
  advent_is_published: boolean;
  map_center_lng: number;
  map_center_lat: number;
  map_bounds_sw_lng: number;
  map_bounds_sw_lat: number;
  map_bounds_ne_lng: number;
  map_bounds_ne_lat: number;
  map_style_url: string;
}

interface AdventCandidateRow {
  id: string;
  requested_day: number | null;
  day_number: number | null;
  status: "submitted" | "assigned" | "rejected" | "reserved_commune" | "blocked";
  is_communal_event: boolean;
  block_reason: string | null;
  participation_type: "window_only" | "hospitality";
  activity_label: string | null;
  lighting_time: string | null;
  event_start_time: string | null;
  hospitality_details: string | null;
  email: string | null;
  full_name: string | null;
  address_id: string | null;
  street_name: string | null;
  house_number: string | null;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    newcode?: string;
    map_saved?: string;
    map_error?: string;
    reminded?: string;
  }>;
}) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (me.role === "resident") redirect("/dashboard");

  const stateRows = await query<VillageStateRow>(
    `SELECT * FROM public.public_village_state LIMIT 1`
  );
  const state = stateRows[0];

  const { pending, verified, adventCandidates, addresses, analytics } = await withRlsContext(me.id, async (client) => {
    const p = await client.query<{
      id: string;
      email: string;
      full_name: string;
      street_name: string;
      house_number: string;
    }>(
      `SELECT pr.id, pr.email, pr.full_name, a.street_name, a.house_number
       FROM public.profiles pr
       JOIN public.addresses a ON a.id = pr.requested_address_id
       WHERE pr.verification_status = 'pending' AND pr.requested_address_id IS NOT NULL`
    );

    const v = await client.query<{
      id: string;
      email: string;
      full_name: string;
      street_name: string;
      house_number: string;
    }>(
      `SELECT pr.id, pr.email, pr.full_name, a.street_name, a.house_number
       FROM public.profiles pr
       JOIN public.addresses a ON a.id = pr.address_id
       WHERE pr.verification_status IN ('verified_by_code', 'verified_by_admin')
       ORDER BY a.street_name, a.house_number`
    );

    const ac = await client.query<AdventCandidateRow>(
      `SELECT ac.id,
              ac.requested_day,
              ac.day_number,
              ac.status,
              ac.is_communal_event,
              ac.block_reason,
              ac.participation_type,
              ac.activity_label,
              ac.lighting_time::TEXT,
              ac.event_start_time::TEXT,
              ac.hospitality_details,
              pr.email,
              pr.full_name,
              a.id AS address_id,
              a.street_name,
              a.house_number
       FROM public.advent_calendar ac
       LEFT JOIN public.profiles pr ON pr.id = ac.user_id
       LEFT JOIN public.addresses a ON a.id = ac.address_id
       WHERE ac.season_year = EXTRACT(YEAR FROM CURRENT_DATE)
       ORDER BY COALESCE(ac.day_number, ac.requested_day, 99) ASC`
    );

    const addrRes = await client.query<{
      id: string;
      street_name: string;
      house_number: string;
    }>(
      `SELECT id, street_name, house_number
       FROM public.addresses
       ORDER BY street_name, house_number`
    );

    const statsRes = await client.query<{
      total_visits: string;
      live_active_30m: string;
      page_views: string;
      address_clicks: string;
    }>(`
      SELECT
        COUNT(*)::TEXT AS total_visits,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 minutes')::TEXT AS live_active_30m,
        COUNT(*) FILTER (WHERE event_type = 'page_view')::TEXT AS page_views,
        COUNT(*) FILTER (WHERE event_type = 'address_view')::TEXT AS address_clicks
      FROM public.analytics_visits
      WHERE season_year = EXTRACT(YEAR FROM CURRENT_DATE)
    `);

    const topRes = await client.query<{
      street_name: string;
      house_number: string;
      count: string;
    }>(`
      SELECT a.street_name, a.house_number, COUNT(*)::TEXT AS count
      FROM public.analytics_visits v
      JOIN public.addresses a ON a.id = v.address_id
      WHERE v.event_type = 'address_view'
        AND v.season_year = EXTRACT(YEAR FROM CURRENT_DATE)
      GROUP BY a.street_name, a.house_number
      ORDER BY COUNT(*) DESC
      LIMIT 5
    `);

    const hourlyRes = await client.query<{
      hour_slot: string;
      hour_num: number;
      count: string;
    }>(`
      SELECT
        TO_CHAR(created_at, 'HH24') || 'h' AS hour_slot,
        EXTRACT(HOUR FROM created_at)::INT AS hour_num,
        COUNT(*)::TEXT AS count
      FROM public.analytics_visits
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY hour_slot, hour_num
      ORDER BY hour_num ASC
    `);

    const analytics = {
      totalVisits: parseInt(statsRes.rows[0]?.total_visits || "0", 10),
      liveActive30m: parseInt(statsRes.rows[0]?.live_active_30m || "0", 10),
      pageViews: parseInt(statsRes.rows[0]?.page_views || "0", 10),
      addressClicks: parseInt(statsRes.rows[0]?.address_clicks || "0", 10),
      topAddresses: topRes.rows.map((r) => ({
        street_name: r.street_name,
        house_number: r.house_number,
        count: parseInt(r.count, 10),
      })),
      hourlyDistribution: hourlyRes.rows.map((r) => ({
        hour_label: r.hour_slot,
        count: parseInt(r.count, 10),
      })),
    };

    return {
      pending: p.rows,
      verified: v.rows,
      adventCandidates: ac.rows,
      addresses: addrRes.rows,
      analytics,
    };
  });

  const occupiedDays = new Map<number, AdventCandidateRow>();
  for (const c of adventCandidates) {
    if (
      c.day_number &&
      (c.status === "assigned" || c.status === "reserved_commune" || c.status === "blocked")
    ) {
      occupiedDays.set(c.day_number, c);
    }
  }

  const communalSlots = adventCandidates.filter(
    (c) => c.is_communal_event || c.status === "reserved_commune" || c.status === "blocked"
  );

  const residentCandidates = adventCandidates.filter(
    (c) => !c.is_communal_event && c.status !== "reserved_commune" && c.status !== "blocked"
  );

  const { newcode, map_saved, map_error, reminded } = await searchParams;

  const alertRows = await query<CommunalAlert>(
    `SELECT id, level, title, message, created_at::TEXT
     FROM public.village_alerts
     WHERE is_active = true
     ORDER BY created_at DESC
     LIMIT 1`
  );
  const activeAlert = alertRows[0] ?? null;

  async function broadcastAlert(fd: FormData) {
    "use server";
    await publishCommunalAlert(fd);
    redirect("/admin");
  }
  async function removeAlert(fd: FormData) {
    "use server";
    await dismissCommunalAlert(fd);
    redirect("/admin");
  }

  async function regen() {
    "use server";
    const r = await regenerateVillageCode();
    redirect(`/admin?newcode=${r.success ? r.data : ""}`);
  }
  async function seasonAction(fd: FormData) {
    "use server";
    await setSeason(fd);
  }
  async function publishAction(fd: FormData) {
    "use server";
    await setAdventPublication(fd);
  }
  async function assignAction(fd: FormData) {
    "use server";
    await assignAdventDay(fd);
  }
  async function reserveCommunalAction(fd: FormData) {
    "use server";
    await reserveCommunalAdventDay(fd);
    redirect("/admin");
  }
  async function blockAdventAction(fd: FormData) {
    "use server";
    await blockAdventDay(fd);
    redirect("/admin");
  }
  async function freeAdventAction(fd: FormData) {
    "use server";
    await freeAdventDay(fd);
    redirect("/admin");
  }
  async function reminderAction(fd: FormData) {
    "use server";
    const r = await sendAdventRemindersAction(fd);
    redirect(`/admin?reminded=${r.success ? r.sentCount : 0}`);
  }
  async function saveMap(fd: FormData) {
    "use server";
    const r = await updateMapSettings(fd);
    if (!r.success) {
      redirect(`/admin?map_error=${encodeURIComponent(r.error ?? "Erreur")}`);
    }
    redirect("/admin?map_saved=1");
  }
  async function approve(fd: FormData) {
    "use server";
    await approveVerification(fd);
  }
  async function revoke(fd: FormData) {
    "use server";
    await revokeUser(fd);
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6 text-stone-900">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-stone-300 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            Commune de Vufflens-la-Ville
          </p>
          <h1 className="font-editorial text-2xl font-bold mt-0.5">
            Administration de la carte communale
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
          <Link
            href="/admin/print-advent"
            className="rounded-md border border-[#1b4d3e] bg-[#1b4d3e]/10 px-3 py-1.5 font-semibold text-[#1b4d3e] hover:bg-[#1b4d3e]/20 transition"
          >
            Exporter l&apos;affiche officielle A4 / PDF (avec QR Code)
          </Link>
          <Link href="/dashboard" className="text-stone-600 hover:text-stone-900">
            Mon espace
          </Link>
          <Link
            href="/"
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-stone-900 hover:bg-stone-100"
          >
            Voir la carte publique
          </Link>
        </div>
      </header>

      {reminded !== undefined && (
        <div className="rounded-md border border-[#1b4d3e]/40 bg-[#1b4d3e]/10 p-3 text-xs text-[#1b4d3e] font-medium">
          Email(s) de rappel J-1 envoyé(s) avec succès via le serveur SMTP ({reminded} destinataire(s)).
        </div>
      )}

      {me.role === "admin" && (
        <>
          {/* 📢 FLASH COMMUNAL & MESSAGES D'ALERTE EN DIRECT (SSE) */}
          <section className="rounded-2xl border border-stone-300/80 bg-white p-6 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
              <div>
                <h2 className="font-editorial text-lg font-bold text-stone-900 flex items-center gap-2">
                  <span>📢 Message d&apos;alerte & Flash communal en direct</span>
                  <span className="rounded-full bg-red-100 text-red-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    Temps réel SSE
                  </span>
                </h2>
                <p className="text-xs text-stone-600 mt-0.5">
                  Diffuse instantanément une notification visuelle sur tous les téléphones et ordinateurs connectés en direct.
                </p>
              </div>

              {activeAlert && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-900">
                    <span className="h-2 w-2 rounded-full bg-amber-600 animate-ping" />
                    <span>Alerte active à l&apos;écran</span>
                  </span>
                  <form action={removeAlert}>
                    <input type="hidden" name="alert_id" value={activeAlert.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-red-300 bg-red-50 hover:bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 transition"
                    >
                      Retirer l&apos;alerte
                    </button>
                  </form>
                </div>
              )}
            </div>

            {activeAlert && (
              <div
                className={`rounded-xl border p-4 text-xs space-y-1 ${
                  activeAlert.level === "urgent"
                    ? "border-red-300 bg-red-50 text-red-900"
                    : activeAlert.level === "warning"
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-sky-300 bg-sky-50 text-sky-900"
                }`}
              >
                <div className="font-bold flex items-center gap-2">
                  <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-white font-mono">
                    {activeAlert.level}
                  </span>
                  <span>{activeAlert.title}</span>
                </div>
                <p className="font-medium text-stone-800">{activeAlert.message}</p>
              </div>
            )}

            <form action={broadcastAlert} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Niveau d&apos;importance
                  </label>
                  <select
                    name="level"
                    defaultValue="warning"
                    className="w-full h-9 rounded-md border border-stone-300 bg-white px-2.5 text-xs text-stone-900 focus:border-stone-900 focus:outline-none"
                  >
                    <option value="info">🔵 Information (Informatif)</option>
                    <option value="warning">🟠 Avertissement (Météo / Programme)</option>
                    <option value="urgent">🔴 Urgent (Sécurité / Report)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Titre du flash communal
                  </label>
                  <input
                    name="title"
                    type="text"
                    required
                    placeholder="Ex: Fortes pluies à 19h / Verrée sous le préau"
                    className="w-full h-9 rounded-md border border-stone-300 bg-white px-3 text-xs text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Message détaillé (visible immédiatement sur tous les écrans)
                </label>
                <textarea
                  name="message"
                  required
                  rows={2}
                  maxLength={280}
                  placeholder="Ex: En raison des averses orageuses, la tournée d'Halloween se termine à 20h. Les boissons chaudes sont servies au chaud dans la Grande Salle !"
                  className="w-full rounded-md border border-stone-300 bg-white p-3 text-xs text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" className="bg-stone-900 text-white hover:bg-stone-800 text-xs font-semibold">
                  Diffuser le message à tous les habitants en direct →
                </Button>
              </div>
            </form>
          </section>

          {/* STATISTIQUES & FRÉQUENTATION EN DIRECT */}
          <section className="rounded-2xl border border-stone-300/80 bg-white p-6 space-y-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200/80 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <h2 className="font-editorial text-lg font-bold text-stone-900">
                    Statistiques de fréquentation en direct
                  </h2>
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  Données anonymisées des promeneurs connectés et de l&apos;activité du parcours dans le village.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50/80 px-3.5 py-1 text-xs font-semibold text-emerald-900 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                <span>
                  {analytics.liveActive30m > 0
                    ? `${analytics.liveActive30m} promeneur(s) en direct (30 min)`
                    : "0 promeneur actif en ce moment"}
                </span>
              </div>
            </div>

            {/* 4 Indicateurs Clés */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                  Actifs en direct
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-editorial text-3xl font-bold text-stone-900">
                    {analytics.liveActive30m}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-medium">30 min</span>
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                  Vues de la carte
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-editorial text-3xl font-bold text-stone-900">
                    {analytics.pageViews}
                  </span>
                  <span className="text-[11px] text-stone-400 font-medium">chargements</span>
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                  Clics sur maisons 3D
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-editorial text-3xl font-bold text-stone-900">
                    {analytics.addressClicks}
                  </span>
                  <span className="text-[11px] text-stone-400 font-medium">consultations</span>
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                  Total interactions
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-editorial text-3xl font-bold text-stone-900">
                    {analytics.totalVisits}
                  </span>
                  <span className="text-[11px] text-stone-400 font-medium">saison {new Date().getFullYear()}</span>
                </div>
              </div>
            </div>

            {/* Graphique de fréquentation par heure & Top 5 Adresses */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              {/* Histogramme horaire */}
              <div className="md:col-span-2 space-y-3 rounded-xl border border-stone-200/90 bg-stone-50/50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                    Affluence horaire (Dernières 24 heures)
                  </h3>
                  <span className="text-[11px] text-stone-500">Heure locale (Europe/Zurich)</span>
                </div>

                {analytics.hourlyDistribution.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-xs text-stone-400 italic">
                    Aucune visite enregistrée au cours des dernières 24h. Le graphique se mettra à jour automatiquement lors des promenades.
                  </div>
                ) : (
                  <div className="space-y-2 pt-2">
                    {(() => {
                      const maxVal = Math.max(...analytics.hourlyDistribution.map((h) => h.count), 1);
                      return (
                        <div className="space-y-2">
                          {analytics.hourlyDistribution.map((slot) => {
                            const pct = Math.max(8, Math.round((slot.count / maxVal) * 100));
                            return (
                              <div key={slot.hour_label} className="flex items-center gap-3 text-xs">
                                <span className="w-10 font-mono text-[11px] font-semibold text-stone-600">
                                  {slot.hour_label}
                                </span>
                                <div className="flex-1 h-6 bg-stone-200/70 rounded-md overflow-hidden relative">
                                  <div
                                    className="h-full bg-gradient-to-r from-emerald-600 to-teal-700 rounded-md transition-all duration-500"
                                    style={{ width: `${pct}%` }}
                                  />
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white drop-shadow-sm">
                                    {slot.count} visite(s)
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Top 5 adresses les plus consultées */}
              <div className="space-y-3 rounded-xl border border-stone-200/90 bg-stone-50/50 p-4">
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Top 5 Maisons consultées
                </h3>

                {analytics.topAddresses.length === 0 ? (
                  <p className="text-xs text-stone-400 italic pt-6 text-center">
                    Les adresses les plus recherchées s&apos;afficheront ici dès les premiers clics des promeneurs.
                  </p>
                ) : (
                  <ol className="space-y-2 pt-1">
                    {analytics.topAddresses.map((addr, idx) => (
                      <li
                        key={`${addr.street_name}-${addr.house_number}`}
                        className="flex items-center justify-between text-xs rounded-lg border border-stone-200/80 bg-white p-2.5 shadow-2xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-900 text-[10px] font-bold text-white">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-stone-800">
                            {addr.street_name} {addr.house_number}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          {addr.count} vues
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </section>

          {/* 1. Bascule de mode (Halloween / Noël / Hors-saison) & Date d'inscription */}
          <section className="rounded-lg border border-stone-300 bg-white p-6 space-y-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-editorial text-lg font-bold">
                  1. Mode actif &amp; Calendrier d&apos;ouverture
                </h2>
                <p className="text-xs text-stone-600 mt-0.5">
                  Choisissez l&apos;événement affiché publiquement sur la carte et la date à partir de laquelle les habitants peuvent postuler pour Noël.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full border border-stone-300 bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-800">
                Mode actif :{" "}
                {state?.current_season === "halloween"
                  ? "Halloween (31 octobre)"
                  : state?.current_season === "advent"
                  ? "Noël / Calendrier de l'Avent"
                  : "Hors-saison"}
              </span>
            </div>

            <form action={seasonAction} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="block text-xs font-medium text-stone-700">
                  Mode affiché sur le site
                  <select
                    name="season"
                    defaultValue={state?.current_season}
                    className="mt-1.5 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
                  >
                    <option value="halloween">Mode Halloween (Octobre)</option>
                    <option value="advent">Mode Noël / Calendrier de l&apos;Avent (Décembre)</option>
                    <option value="off_season">Hors-saison</option>
                  </select>
                </label>

                <label className="block text-xs font-medium text-stone-700">
                  Ouverture des propositions dès le
                  <input
                    type="date"
                    name="advent_registration_opens_at"
                    defaultValue={state?.advent_registration_opens_at ?? "2026-11-01"}
                    className="mt-1.5 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
                  />
                  <span className="block text-[11px] text-stone-500 mt-1">
                    Date à partir de laquelle les résidents peuvent soumettre leur souhait.
                  </span>
                </label>

                <label className="block text-xs font-medium text-stone-700">
                  Date limite de désinscription
                  <input
                    type="date"
                    name="advent_cancellation_deadline"
                    defaultValue={state?.advent_cancellation_deadline ?? ""}
                    className="mt-1.5 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
                  />
                  <span className="block text-[11px] text-stone-500 mt-1">
                    Après cette date, les habitants ne peuvent plus se désinscrire eux-mêmes.
                  </span>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-stone-200">
                <label className="flex items-center gap-2 text-xs text-stone-700">
                  <input
                    type="checkbox"
                    name="hide_future"
                    defaultChecked={state?.advent_hide_future_details}
                    className="rounded border-stone-300"
                  />
                  <span>Masquer le texte d&apos;accueil avant le jour J</span>
                </label>

                <Button type="submit" size="sm">
                  Enregistrer les paramètres de saison
                </Button>
              </div>
            </form>
          </section>

          {/* 2. Attribution des 24 fenêtres de Noël et Mise en ligne des résultats */}
          <section className="rounded-lg border border-stone-300 bg-white p-6 space-y-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-4">
              <div>
                <h2 className="font-editorial text-lg font-bold">
                  2. Attribution des fenêtres de Noël &amp; Publication
                </h2>
                <p className="text-xs text-stone-600 mt-0.5">
                  Attribuez le jour définitif (1 au 24 décembre). La publication envoie automatiquement un email de confirmation aux foyers retenus.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="/api/admin/export-advent"
                  download
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-800 hover:bg-stone-50 shadow-2xs transition"
                >
                  <span>📊</span>
                  <span>Export Excel / CSV</span>
                </a>

                <Link
                  href="/admin/print-advent"
                  className="inline-flex h-8 items-center rounded-md border border-stone-300 bg-stone-50 px-3 text-xs font-semibold text-stone-800 hover:bg-stone-100"
                >
                  Affiche PDF / Impression
                </Link>

                <form action={publishAction} className="flex items-center gap-2">
                  <input
                    type="hidden"
                    name="publish"
                    value={state?.advent_is_published ? "false" : "true"}
                  />
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded ${
                      state?.advent_is_published
                        ? "bg-[#1b4d3e]/15 text-[#1b4d3e]"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {state?.advent_is_published ? "Résultats publiés en ligne" : "En préparation (non publié)"}
                  </span>
                  <Button
                    type="submit"
                    variant={state?.advent_is_published ? "outline" : "default"}
                    size="sm"
                  >
                    {state?.advent_is_published
                      ? "Retirer de la publication"
                      : "Mettre en ligne les résultats"}
                  </Button>
                </form>
              </div>
            </div>

            {/* Aperçu des 24 jours de décembre */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-stone-700 mb-2">
                <span>
                  Récapitulatif des 24 dates ({occupiedDays.size} / 24 occupées)
                </span>
                <span className="font-mono-tabular text-[11px] text-stone-500 font-normal">
                  {residentCandidates.filter((r) => r.status === "assigned").length} habitant(s) ·{" "}
                  {communalSlots.filter((c) => c.status === "reserved_commune").length} commune ·{" "}
                  {communalSlots.filter((c) => c.status === "blocked").length} bloqué(s)
                </span>
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1.5">
                {Array.from({ length: 24 }, (_, i) => i + 1).map((day) => {
                  const item = occupiedDays.get(day);
                  const isResident = item && item.status === "assigned";
                  const isCommunal =
                    item &&
                    (item.status === "reserved_commune" ||
                      (item.is_communal_event && item.status !== "blocked"));
                  const isBlocked = item && item.status === "blocked";

                  let tooltip = `${day} déc. : libre`;
                  let styleClass = "border-stone-200 bg-stone-50 text-stone-400";

                  if (isResident) {
                    tooltip = `${day} déc. : ${item.street_name} ${item.house_number} (${item.full_name || item.email})`;
                    styleClass = "border-[#1b4d3e] bg-[#1b4d3e] text-white font-semibold";
                  } else if (isCommunal) {
                    tooltip = `${day} déc. : Réservé Commune — ${item.activity_label || "Événement communal"}${item.street_name ? ` (${item.street_name} ${item.house_number})` : ""}`;
                    styleClass = "border-purple-700 bg-purple-700 text-white font-semibold";
                  } else if (isBlocked) {
                    tooltip = `${day} déc. : Bloqué par la commune (${item.block_reason || "Non disponible"})`;
                    styleClass = "border-stone-600 bg-stone-700 text-stone-200 font-semibold";
                  }

                  return (
                    <div
                      key={day}
                      title={tooltip}
                      className={`rounded border px-2 py-1.5 text-center tabular-nums text-xs transition ${styleClass}`}
                    >
                      <span>{day}</span>
                      {isCommunal && <span className="block text-[8px] font-normal opacity-90">Com.</span>}
                      {isBlocked && <span className="block text-[8px] font-normal opacity-90">Bloq.</span>}
                    </div>
                  );
                })}
              </div>

              {/* Légende */}
              <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-stone-600">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#1b4d3e] inline-block" />
                  <span>Attribué habitant</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-700 inline-block" />
                  <span>Pré-réservé Commune</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-stone-700 inline-block" />
                  <span>Bloqué (férié / école)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full border border-stone-300 bg-stone-50 inline-block" />
                  <span>Libre</span>
                </div>
              </div>
            </div>

            {/* Gestion des dates communales & blocages */}
            <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-4 space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-900">
                  Créneaux communaux &amp; Blocage de dates
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  Pré-réservez une date pour un événement officiel de la commune (inauguration, Saint-Nicolas, clôture) ou bloquez des jours sans animation (fête de l&apos;école, cultes, etc.).
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Formulaire A : Pré-réserver pour la commune */}
                <form action={reserveCommunalAction} className="rounded-md border border-purple-200 bg-white p-3.5 space-y-3 text-xs shadow-xs">
                  <div className="font-semibold text-purple-950 flex items-center gap-1.5">
                    <span>🏛️</span> Pré-réserver une date pour la Commune
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className="block text-stone-700">
                      Jour de décembre
                      <select name="day_number" required className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-900">
                        <option value="">Choisir (1 à 24)…</option>
                        {Array.from({ length: 24 }, (_, i) => i + 1).map((d) => {
                          const occ = occupiedDays.get(d);
                          return (
                            <option key={d} value={d}>
                              {d} décembre {occ ? `(${occ.status === "reserved_commune" ? "Déjà commune" : occ.status === "blocked" ? "Bloqué" : "Attribué"})` : "— Libre"}
                            </option>
                          );
                        })}
                      </select>
                    </label>

                    <label className="block text-stone-700">
                      Lieu / Adresse
                      <select name="address_id" required className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-900">
                        <option value="">Sélectionner un lieu…</option>
                        {addresses.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.street_name} {a.house_number}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block text-stone-700">
                    Intitulé de l&apos;événement
                    <input
                      type="text"
                      name="activity_label"
                      required
                      placeholder="Ex: Inauguration du Calendrier & Apéritif municipal"
                      className="mt-1 w-full rounded border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="block text-stone-700">
                      Illumination (dès)
                      <input
                        type="time"
                        name="lighting_time"
                        defaultValue="18:00"
                        className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-900"
                      />
                    </label>

                    <label className="block text-stone-700">
                      Verrée / Accueil (dès)
                      <input
                        type="time"
                        name="event_start_time"
                        defaultValue="18:30"
                        className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-900"
                      />
                    </label>
                  </div>

                  <label className="block text-stone-700">
                    Détails ou message aux habitants (optionnel)
                    <input
                      type="text"
                      name="hospitality_details"
                      placeholder="Ex: Vin chaud et jus de pomme offerts par la Municipalité"
                      className="mt-1 w-full rounded border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900"
                    />
                  </label>

                  <Button type="submit" size="sm" className="w-full bg-purple-700 hover:bg-purple-800 text-white">
                    Enregistrer la date communale
                  </Button>
                </form>

                {/* Formulaire B : Bloquer une date */}
                <form action={blockAdventAction} className="rounded-md border border-stone-300 bg-white p-3.5 space-y-3 text-xs shadow-xs flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                      <span>🔒</span> Bloquer une date sans animation
                    </div>

                    <label className="block text-stone-700">
                      Jour de décembre à bloquer
                      <select name="day_number" required className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-900">
                        <option value="">Choisir (1 à 24)…</option>
                        {Array.from({ length: 24 }, (_, i) => i + 1).map((d) => {
                          const occ = occupiedDays.get(d);
                          return (
                            <option key={d} value={d}>
                              {d} décembre {occ ? `(${occ.status === "blocked" ? "Déjà bloqué" : "Occupé"})` : "— Libre"}
                            </option>
                          );
                        })}
                      </select>
                    </label>

                    <label className="block text-stone-700">
                      Motif du blocage
                      <input
                        type="text"
                        name="block_reason"
                        required
                        placeholder="Ex: Fête de Noël de l'école primaire / Paroisse / Férié"
                        className="mt-1 w-full rounded border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900"
                      />
                    </label>
                    <p className="text-[11px] text-stone-500">
                      Les dates bloquées n&apos;apparaissent pas sur la carte publique et ne peuvent pas être sélectionnées par les habitants.
                    </p>
                  </div>

                  <Button type="submit" variant="outline" size="sm" className="w-full border-stone-400 text-stone-800 hover:bg-stone-100">
                    Bloquer ce jour
                  </Button>
                </form>
              </div>

              {/* Liste des créneaux communaux ou bloqués actifs avec action de libération */}
              {communalSlots.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-purple-200">
                  <div className="text-xs font-semibold text-purple-950">
                    Dates actuellement gérées par la Commune ({communalSlots.length}) :
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {communalSlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-stone-200 bg-white p-2.5 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 font-semibold text-stone-900">
                            <span className="font-mono-tabular text-sm font-bold text-stone-800">
                              {slot.day_number} déc.
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                slot.status === "blocked"
                                  ? "bg-stone-200 text-stone-800"
                                  : "bg-purple-100 text-purple-900"
                              }`}
                            >
                              {slot.status === "blocked" ? "Bloqué" : "Commune"}
                            </span>
                          </div>
                          <div className="truncate text-stone-600 mt-0.5">
                            {slot.status === "blocked"
                              ? slot.block_reason || "Date bloquée"
                              : `${slot.activity_label || "Événement"} ${slot.street_name ? `(${slot.street_name} ${slot.house_number})` : ""}`}
                          </div>
                        </div>

                        <form action={freeAdventAction}>
                          <input type="hidden" name="day_number" value={slot.day_number ?? ""} />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            className="text-red-700 hover:bg-red-50 hover:text-red-800 text-[11px] h-7 px-2"
                          >
                            Libérer
                          </Button>
                        </form>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Liste des candidatures d'habitants pour le Calendrier de l'Avent */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-stone-700">
                Candidatures des habitants ({residentCandidates.length})
              </div>
              <div className="divide-y divide-stone-200 border border-stone-200 rounded-md">
                {residentCandidates.length === 0 ? (
                  <p className="p-4 text-xs text-stone-500">
                    Aucune candidature d&apos;habitant enregistrée pour le moment.
                  </p>
                ) : (
                  residentCandidates.map((c) => (
                    <form
                      key={c.id}
                      action={assignAction}
                      className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-xs"
                    >
                      <input type="hidden" name="registration_id" value={c.id} />
                      <div className="space-y-0.5 min-w-[220px] flex-1">
                        <div className="font-semibold text-stone-900">
                          {c.street_name} {c.house_number}{" "}
                          <span className="font-normal text-stone-500">({c.full_name || c.email})</span>
                        </div>
                        <div className="text-stone-600">
                          Souhait :{" "}
                          <strong>
                            {c.requested_day ? `${c.requested_day} décembre` : "Flexible"}
                          </strong>{" "}
                          ·{" "}
                          <span className="font-medium text-stone-800">
                            {c.activity_label ||
                              (c.participation_type === "hospitality"
                                ? "Accueil & verrée"
                                : "Fenêtre illuminée")}
                          </span>{" "}
                          ({c.event_start_time ? `dès ${c.event_start_time.slice(0, 5)}` : `illumination ${c.lighting_time?.slice(0, 5)}`})
                        </div>
                        {c.hospitality_details && (
                          <div className="text-stone-500 italic">{c.hospitality_details}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          name="day_number"
                          defaultValue={c.day_number ?? c.requested_day ?? ""}
                          className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900 tabular-nums"
                        >
                          <option value="">Choisir le jour…</option>
                          {Array.from({ length: 24 }, (_, i) => i + 1).map((d) => {
                            const occ = occupiedDays.get(d);
                            const isOther = occ && occ.id !== c.id;
                            let labelSuffix = "";
                            if (isOther) {
                              if (occ.status === "reserved_commune") {
                                labelSuffix = `(réservé Commune)`;
                              } else if (occ.status === "blocked") {
                                labelSuffix = `(bloqué)`;
                              } else {
                                labelSuffix = `(attribué à ${occ.street_name} ${occ.house_number})`;
                              }
                            }
                            return (
                              <option key={d} value={d}>
                                {d} décembre {labelSuffix}
                              </option>
                            );
                          })}
                        </select>

                        <Button type="submit" name="action_type" value="assign" size="sm">
                          {c.status === "assigned" ? "Modifier le jour" : "Attribuer ce jour"}
                        </Button>

                        {c.status === "assigned" && (
                          <Button
                            type="submit"
                            name="action_type"
                            value="unassign"
                            variant="outline"
                            size="sm"
                          >
                            Retirer
                          </Button>
                        )}
                      </div>
                    </form>
                  ))
                )}
              </div>
            </div>

            {/* Rappel Email J-1 aux hôtes */}
            <form
              action={reminderAction}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 bg-stone-50 p-3.5 text-xs"
            >
              <div>
                <div className="font-semibold text-stone-900">
                  Rappel email automatique (veille du jour J)
                </div>
                <p className="text-stone-600">
                  Envoyer un email de rappel au foyer organisateur d&apos;une journée (ou de demain par défaut).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  name="target_day"
                  defaultValue=""
                  className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900"
                >
                  <option value="">Demain (automatique)</option>
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      Fenêtre du {d} décembre
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="outline" size="sm">
                  Envoyer le rappel email
                </Button>
              </div>
            </form>
          </section>
        </>
      )}

      {/* 3. Modération des adresses & Code d'accès communal */}
      <section className="rounded-lg border border-stone-300 bg-white p-6 space-y-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-4">
          <div>
            <h2 className="font-editorial text-lg font-bold">
              3. Foyers inscrits &amp; Code d&apos;accès communal
            </h2>
            <p className="text-xs text-stone-600 mt-0.5">
              Validez les demandes manuelles de résidence (un email de confirmation est envoyé automatiquement) ou régénérez le code imprimé dans le tout-ménage.
            </p>
          </div>
          {me.role === "admin" && (
            <form action={regen}>
              <Button type="submit" variant="outline" size="sm">
                Générer un nouveau code villageois
              </Button>
            </form>
          )}
        </div>

        {newcode && (
          <div className="rounded-md border border-stone-900 bg-stone-100 p-3 text-xs">
            Nouveau code villageois (à conserver, il n&apos;est affiché qu&apos;une seule fois) :{" "}
            <strong className="font-mono text-sm">{newcode}</strong>
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Demandes de validation en attente ({pending.length})
          </h3>
          {pending.length === 0 ? (
            <p className="text-xs text-stone-500">Aucune demande en attente.</p>
          ) : (
            <div className="divide-y divide-stone-200 rounded-md border border-stone-200">
              {pending.map((p) => (
                <form
                  key={p.id}
                  action={approve}
                  className="flex items-center justify-between p-3 text-xs"
                >
                  <span>
                    <strong>{p.full_name || p.email}</strong> ({p.email}) demande le rattachement à{" "}
                    <strong>
                      {p.street_name} {p.house_number}
                    </strong>
                  </span>
                  <input type="hidden" name="user_id" value={p.id} />
                  <Button size="sm" type="submit">
                    Valider l&apos;adresse
                  </Button>
                </form>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Foyers vérifiés ({verified.length})
          </h3>
          <div className="divide-y divide-stone-200 rounded-md border border-stone-200">
            {verified.map((p) => (
              <form
                key={p.id}
                action={revoke}
                className="flex items-center justify-between p-3 text-xs"
              >
                <span>
                  <strong>
                    {p.street_name} {p.house_number}
                  </strong>{" "}
                  — {p.full_name || p.email} ({p.email})
                </span>
                <input type="hidden" name="user_id" value={p.id} />
                <Button size="sm" variant="outline" type="submit">
                  Révoquer
                </Button>
              </form>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Configuration cartographique */}
      {me.role === "admin" && (
        <section className="rounded-lg border border-stone-300 bg-white p-6 space-y-4 shadow-sm">
          <div>
            <h2 className="font-editorial text-lg font-bold">
              4. Cadrage géographique (Vufflens-la-Ville)
            </h2>
            <p className="text-xs text-stone-600 mt-0.5">
              Coordonnées du centre et limites de la carte.
            </p>
          </div>

          {map_saved && (
            <p className="rounded-md bg-stone-100 border border-stone-300 p-2.5 text-xs text-stone-800">
              Paramètres de cadrage enregistrés.
            </p>
          )}
          {map_error && (
            <p className="rounded-md bg-red-50 border border-red-300 p-2.5 text-xs text-red-900">
              {map_error}
            </p>
          )}

          <form action={saveMap} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <label className="block text-xs text-stone-700">
                Centre — Longitude
                <input
                  type="number"
                  step="any"
                  name="map_center_lng"
                  required
                  defaultValue={state?.map_center_lng ?? 6.5364}
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-1.5 text-xs"
                />
              </label>
              <label className="block text-xs text-stone-700">
                Centre — Latitude
                <input
                  type="number"
                  step="any"
                  name="map_center_lat"
                  required
                  defaultValue={state?.map_center_lat ?? 46.5822}
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-1.5 text-xs"
                />
              </label>
              <label className="block text-xs text-stone-700 col-span-2 sm:col-span-1">
                Style des tuiles
                <input
                  type="url"
                  name="map_style_url"
                  required
                  defaultValue={
                    state?.map_style_url ??
                    "https://vectortiles.geo.admin.ch/styles/ch.swisstopo.basemap.vt/style.json"
                  }
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-1.5 text-xs"
                />
              </label>
              <label className="block text-xs text-stone-700">
                Sud-Ouest — Longitude
                <input
                  type="number"
                  step="any"
                  name="map_bounds_sw_lng"
                  required
                  defaultValue={state?.map_bounds_sw_lng ?? 6.526}
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-1.5 text-xs"
                />
              </label>
              <label className="block text-xs text-stone-700">
                Sud-Ouest — Latitude
                <input
                  type="number"
                  step="any"
                  name="map_bounds_sw_lat"
                  required
                  defaultValue={state?.map_bounds_sw_lat ?? 46.576}
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-1.5 text-xs"
                />
              </label>
              <label className="block text-xs text-stone-700">
                Nord-Est — Longitude
                <input
                  type="number"
                  step="any"
                  name="map_bounds_ne_lng"
                  required
                  defaultValue={state?.map_bounds_ne_lng ?? 6.547}
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-1.5 text-xs"
                />
              </label>
              <label className="block text-xs text-stone-700">
                Nord-Est — Latitude
                <input
                  type="number"
                  step="any"
                  name="map_bounds_ne_lat"
                  required
                  defaultValue={state?.map_bounds_ne_lat ?? 46.589}
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-1.5 text-xs"
                />
              </label>
            </div>
            <Button type="submit" variant="outline" size="sm">
              Mettre à jour le cadrage
            </Button>
          </form>
        </section>
      )}
    </main>
  );
}
