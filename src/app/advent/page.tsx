import { redirect } from "next/navigation";
import Link from "next/link";
import { query, withRlsContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { submitAdventApplication, withdrawAdventApplication } from "@/app/actions/advent";
import AdventDayPickerForm from "@/components/AdventDayPickerForm";

export default async function AdventBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; withdrawn?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const settingsRows = await query<{
    advent_registration_opens_at: string;
    advent_cancellation_deadline: string | null;
    is_cancellation_closed: boolean;
    advent_is_published: boolean;
    opens_now: boolean;
  }>(
    `SELECT advent_registration_opens_at::TEXT,
            advent_cancellation_deadline::TEXT,
            (advent_cancellation_deadline IS NOT NULL AND CURRENT_DATE > advent_cancellation_deadline) AS is_cancellation_closed,
            advent_is_published,
            (CURRENT_DATE >= advent_registration_opens_at) AS opens_now
     FROM public.village_settings WHERE id = 1`
  );
  const settings = settingsRows[0];

  // Récupère toutes les dates déjà occupées (réservées par d'autres foyers, par la commune ou bloquées)
  const takenRows = await query<{
    day_number: number;
    user_id: string | null;
    status: string;
    activity_label: string | null;
    is_communal_event: boolean;
    block_reason: string | null;
  }>(
    `SELECT day_number, user_id, status, activity_label, is_communal_event, block_reason
     FROM public.advent_taken_days`
  );

  const takenByOthers = takenRows
    .filter((t) => t.user_id !== user.id)
    .map((t) => Number(t.day_number));

  const takenMeta: Record<number, { status: string; is_communal: boolean; label: string | null }> = {};
  for (const t of takenRows) {
    if (t.day_number) {
      takenMeta[t.day_number] = {
        status: t.status,
        is_communal: Boolean(t.is_communal_event),
        label: t.block_reason || t.activity_label || null,
      };
    }
  }

  const mine = await withRlsContext(user.id, async (client) => {
    const res = await client.query<{
      requested_day: number | null;
      day_number: number | null;
      status: "submitted" | "assigned" | "rejected";
      participation_type: "window_only" | "hospitality";
      activity_label: string | null;
      lighting_time: string;
      event_start_time: string | null;
      event_end_time: string | null;
      hospitality_details: string | null;
      is_accessible_step_free: boolean | null;
      photo_url: string | null;
    }>(
      `SELECT requested_day, day_number, status, participation_type, activity_label,
              lighting_time::TEXT, event_start_time::TEXT, event_end_time::TEXT, hospitality_details,
              is_accessible_step_free, photo_url
       FROM public.advent_calendar
       WHERE user_id = $1 AND season_year = EXTRACT(YEAR FROM CURRENT_DATE)`,
      [user.id]
    );
    return res.rows[0] ?? null;
  });

  const { saved, error, withdrawn } = await searchParams;

  async function submit(fd: FormData) {
    "use server";
    const r = await submitAdventApplication(fd);
    if (!r.success) {
      redirect(`/advent?error=${encodeURIComponent(r.error ?? "Erreur")}`);
    }
    redirect("/advent?saved=1");
  }

  async function withdraw() {
    "use server";
    const r = await withdrawAdventApplication();
    if (!r.success) {
      redirect(`/advent?error=${encodeURIComponent(r.error ?? "Erreur")}`);
    }
    redirect("/advent?withdrawn=1");
  }

  return (
    <main className="mx-auto max-w-xl p-6 text-stone-900 space-y-6">
      <div className="flex items-baseline justify-between border-b border-stone-300 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            Vufflens-la-Ville · Décembre
          </p>
          <h1 className="font-editorial text-2xl font-bold mt-0.5">
            Proposition au Calendrier de l&apos;Avent
          </h1>
        </div>
        <Link href="/dashboard" className="text-xs font-medium text-stone-600 hover:text-stone-900">
          ← Retour
        </Link>
      </div>

      {mine && (
        <div className="rounded-xl border border-stone-300 bg-white p-4 text-xs space-y-2.5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 pb-2">
            <div className="font-semibold text-stone-900">
              {mine.status === "assigned" && mine.day_number ? (
                <span>
                  Date officielle attribuée :{" "}
                  <strong className="text-[#14532d] font-bold text-sm">
                    {mine.day_number} décembre
                  </strong>
                </span>
              ) : (
                <span>
                  Date souhaitée proposée :{" "}
                  <strong className="text-amber-800 font-bold text-sm">
                    {mine.requested_day} décembre
                  </strong>
                </span>
              )}
            </div>

            <span
              className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                mine.status === "assigned"
                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                  : "bg-amber-100 text-amber-900 border border-amber-300"
              }`}
            >
              {mine.status === "assigned"
                ? "Validé par la commune"
                : "En cours d'examen par la mairie"}
            </span>
          </div>

          <div className="text-stone-700">
            Formule :{" "}
            <span className="font-medium text-stone-900">
              {mine.activity_label ||
                (mine.participation_type === "hospitality"
                  ? "Verrée & accueil"
                  : "Fenêtre décorée")}
            </span>{" "}
            ({mine.event_start_time ? `dès ${mine.event_start_time.slice(0, 5)}` : `illumination ${mine.lighting_time?.slice(0, 5)}`})
          </div>

          {/* Date limite et désinscription */}
          <div className="pt-2 border-t border-stone-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            {settings?.is_cancellation_closed ? (
              <span className="text-amber-900 font-medium">
                🔒 Date limite de désinscription ({settings.advent_cancellation_deadline}) dépassée.
              </span>
            ) : (
              <span className="text-stone-500">
                {settings?.advent_cancellation_deadline
                  ? `Désinscription possible jusqu'au ${settings.advent_cancellation_deadline}.`
                  : "Vous pouvez annuler ou modifier votre proposition librement."}
              </span>
            )}

            {!settings?.is_cancellation_closed && (
              <form action={withdraw}>
                <button
                  type="submit"
                  className="font-semibold text-red-700 hover:text-red-900 underline underline-offset-2 transition"
                >
                  Se désinscrire
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {withdrawn && (
        <p className="rounded-xl border border-stone-300 bg-stone-100 p-3 text-xs font-medium text-stone-800">
          Votre proposition pour le Calendrier de l&apos;Avent a bien été retirée.
        </p>
      )}
      {saved && (
        <p className="rounded-xl border border-[#14532d]/30 bg-[#14532d]/10 p-3 text-xs font-medium text-[#14532d]">
          Votre proposition de date et votre formule ont bien été transmises à la commune.
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-900">
          {error}
        </p>
      )}

      {settings && !settings.opens_now ? (
        <div className="rounded-xl border border-stone-300 bg-white p-6 space-y-2">
          <h2 className="font-editorial text-lg font-bold">Propositions bientôt ouvertes</h2>
          <p className="text-xs text-stone-600 leading-relaxed">
            Les propositions de dates pour les fenêtres de l&apos;Avent ouvriront le{" "}
            <strong>{settings.advent_registration_opens_at}</strong>.
          </p>
        </div>
      ) : (
        <AdventDayPickerForm
          takenByOthers={takenByOthers}
          takenMeta={takenMeta}
          initialDay={mine?.requested_day ?? mine?.day_number ?? null}
          initialType={mine?.participation_type ?? "window_only"}
          initialActivityLabel={mine?.activity_label ?? ""}
          initialLightingTime={mine?.lighting_time?.slice(0, 5) ?? "17:30"}
          initialEventStart={mine?.event_start_time?.slice(0, 5) ?? ""}
          initialEventEnd={mine?.event_end_time?.slice(0, 5) ?? ""}
          initialDetails={mine?.hospitality_details ?? ""}
          initialIsAccessible={mine?.is_accessible_step_free ?? true}
          initialPhotoUrl={mine?.photo_url}
          hasExisting={Boolean(mine)}
          isCancellationClosed={settings?.is_cancellation_closed}
          cancellationDeadline={settings?.advent_cancellation_deadline}
          submitAction={submit}
        />
      )}
    </main>
  );
}
