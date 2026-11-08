import { redirect } from "next/navigation";
import Link from "next/link";
import { query, withRlsContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { submitAdventApplication } from "@/app/actions/advent";
import AdventDayPickerForm from "@/components/AdventDayPickerForm";

export default async function AdventBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const settingsRows = await query<{
    advent_registration_opens_at: string;
    advent_is_published: boolean;
    opens_now: boolean;
  }>(
    `SELECT advent_registration_opens_at::TEXT,
            advent_is_published,
            (CURRENT_DATE >= advent_registration_opens_at) AS opens_now
     FROM public.village_settings WHERE id = 1`
  );
  const settings = settingsRows[0];

  // Récupère toutes les dates déjà prises par d'autres foyers
  const takenRows = await query<{ day_number: number; user_id: string }>(
    `SELECT day_number, user_id FROM public.advent_taken_days`
  );
  const takenByOthers = takenRows
    .filter((t) => t.user_id !== user.id)
    .map((t) => Number(t.day_number));

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

  const { saved, error } = await searchParams;

  async function submit(fd: FormData) {
    "use server";
    const r = await submitAdventApplication(fd);
    if (!r.success) {
      redirect(`/advent?error=${encodeURIComponent(r.error ?? "Erreur")}`);
    }
    redirect("/advent?saved=1");
  }

  return (
    <main className="mx-auto max-w-xl p-6 text-stone-900 space-y-6">
      <div className="flex items-baseline justify-between border-b border-stone-300 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            Vufflens-la-Ville · Décembre
          </p>
          <h1 className="font-editorial text-2xl font-bold mt-0.5">
            Inscription au Calendrier de l&apos;Avent
          </h1>
        </div>
        <Link href="/dashboard" className="text-xs font-medium text-stone-600 hover:text-stone-900">
          ← Retour
        </Link>
      </div>

      {mine && (
        <div className="rounded-xl border border-stone-300 bg-white p-4 text-xs space-y-1 shadow-sm">
          <div className="font-semibold text-stone-900">
            Votre date réservée :{" "}
            <span className="text-[#14532d]">
              {mine.day_number ?? mine.requested_day} décembre
            </span>{" "}
            —{" "}
            <span className="font-medium text-stone-700">
              {mine.activity_label ||
                (mine.participation_type === "hospitality"
                  ? "Verrée & accueil"
                  : "Fenêtre décorée")}
            </span>{" "}
            <span className="text-stone-500">
              ({mine.status === "assigned" ? "Validée par la commune" : "Enregistrée"})
            </span>
          </div>
          <p className="text-stone-600">
            Vous pouvez librement modifier votre formule ou choisir une autre date disponible ci-dessous.
          </p>
        </div>
      )}

      {saved && (
        <p className="rounded-xl border border-[#14532d]/30 bg-[#14532d]/10 p-3 text-xs font-medium text-[#14532d]">
          Votre participation et votre formule personnalisée ont bien été enregistrées.
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-900">
          {error}
        </p>
      )}

      {settings && !settings.opens_now ? (
        <div className="rounded-xl border border-stone-300 bg-white p-6 space-y-2">
          <h2 className="font-editorial text-lg font-bold">Inscriptions bientôt ouvertes</h2>
          <p className="text-xs text-stone-600 leading-relaxed">
            Les inscriptions pour les fenêtres de l&apos;Avent ouvriront le{" "}
            <strong>{settings.advent_registration_opens_at}</strong>.
          </p>
        </div>
      ) : (
        <AdventDayPickerForm
          takenByOthers={takenByOthers}
          initialDay={mine?.day_number ?? mine?.requested_day ?? null}
          initialType={mine?.participation_type ?? "window_only"}
          initialActivityLabel={mine?.activity_label ?? ""}
          initialLightingTime={mine?.lighting_time?.slice(0, 5) ?? "17:30"}
          initialEventStart={mine?.event_start_time?.slice(0, 5) ?? ""}
          initialEventEnd={mine?.event_end_time?.slice(0, 5) ?? ""}
          initialDetails={mine?.hospitality_details ?? ""}
          initialIsAccessible={mine?.is_accessible_step_free ?? true}
          initialPhotoUrl={mine?.photo_url}
          hasExisting={Boolean(mine)}
          submitAction={submit}
        />
      )}
    </main>
  );
}
