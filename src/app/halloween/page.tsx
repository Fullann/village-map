import { redirect } from "next/navigation";
import Link from "next/link";
import { withRlsContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { saveHalloweenRegistration, toggleOutOfCandyAction } from "@/app/actions/halloween";
import { Button } from "@/components/ui/button";
import PhotoUploadField from "@/components/PhotoUploadField";

export default async function HalloweenRegisterPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const reg = await withRlsContext(user.id, async (client) => {
    const res = await client.query<{
      is_distributing: boolean;
      out_of_candy: boolean;
      start_time: string;
      end_time: string;
      is_self_service: boolean;
      is_accessible_step_free: boolean | null;
      photo_url: string | null;
      access_instructions: string | null;
    }>(
      `SELECT is_distributing, COALESCE(out_of_candy, FALSE) AS out_of_candy, start_time::TEXT, end_time::TEXT, is_self_service, is_accessible_step_free, photo_url, access_instructions
       FROM public.halloween_registrations
       WHERE user_id = $1 AND season_year = EXTRACT(YEAR FROM CURRENT_DATE)`,
      [user.id]
    );
    return res.rows[0] ?? null;
  });

  async function submit(fd: FormData) {
    "use server";
    await saveHalloweenRegistration(fd);
    redirect("/dashboard");
  }

  async function toggleCandy() {
    "use server";
    await toggleOutOfCandyAction();
    redirect("/halloween");
  }

  return (
    <main className="mx-auto max-w-lg p-6 text-stone-900 space-y-6">
      <div className="flex items-baseline justify-between border-b border-stone-300 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            Vufflens-la-Ville · 31 octobre
          </p>
          <h1 className="font-editorial text-2xl font-bold mt-0.5">
            Participation à la soirée d&apos;Halloween
          </h1>
        </div>
        <Link href="/dashboard" className="text-xs font-medium text-stone-600 hover:text-stone-900">
          ← Retour
        </Link>
      </div>

      {reg && reg.is_distributing && (
        <section
          className={`rounded-lg border p-4 space-y-3 shadow-sm ${
            reg.out_of_candy
              ? "border-stone-400 bg-stone-100"
              : "border-[#b84a27]/40 bg-[#b84a27]/5"
          }`}
        >
          <div className="text-xs font-semibold text-stone-900">
            {reg.out_of_candy
              ? "Statut actuel : Stock de bonbons épuisé (votre maison apparaît en gris sur la carte)"
              : "Statut actuel : Distribution en cours (votre maison 3D est illuminée sur la carte)"}
          </div>
          <form action={toggleCandy}>
            <input
              type="hidden"
              name="out_of_candy"
              value={reg.out_of_candy ? "false" : "true"}
            />
            <button
              type="submit"
              className={`w-full min-h-[44px] rounded-md px-4 py-2 text-xs font-bold transition ${
                reg.out_of_candy
                  ? "border border-stone-900 bg-white text-stone-900 hover:bg-stone-50"
                  : "bg-[#b84a27] text-white hover:bg-[#9e3d1e]"
              }`}
            >
              {reg.out_of_candy
                ? "Réactiver la distribution de bonbons"
                : "Signaler « Stock de bonbons épuisé pour ce soir »"}
            </button>
          </form>
        </section>
      )}

      <form
        action={submit}
        className="space-y-4 rounded-lg border border-stone-300 bg-white p-6 shadow-sm"
      >
        <label className="flex items-center gap-2.5 text-sm font-medium text-stone-900">
          <input
            type="checkbox"
            name="is_distributing"
            defaultChecked={reg?.is_distributing ?? true}
            className="h-4 w-4 rounded border-stone-300"
          />
          <span>Notre foyer accueille les enfants pour les bonbons</span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-stone-700">
            Heure de début
            <input
              type="time"
              name="start_time"
              defaultValue={reg?.start_time?.slice(0, 5) ?? "18:00"}
              className="mt-1.5 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-stone-700">
            Heure de fin
            <input
              type="time"
              name="end_time"
              defaultValue={reg?.end_time?.slice(0, 5) ?? "20:30"}
              className="mt-1.5 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="flex items-center gap-2.5 text-xs font-medium text-stone-700">
          <input
            type="checkbox"
            name="is_self_service"
            defaultChecked={reg?.is_self_service ?? false}
            className="h-4 w-4 rounded border-stone-300"
          />
          <span>Panier en libre-service devant l&apos;entrée (sans sonner)</span>
        </label>

        {/* Accessibilité Plain-pied / Poussettes & PMR */}
        <div className="rounded-xl border border-stone-200/80 bg-stone-50/60 p-3.5 space-y-1.5">
          <label className="flex items-start gap-2.5 text-xs font-medium text-stone-800 cursor-pointer">
            <input
              type="checkbox"
              name="is_accessible_step_free"
              defaultChecked={reg?.is_accessible_step_free ?? true}
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-800"
            />
            <div>
              <span className="font-semibold text-stone-900">
                ♿ Accès de plain-pied (sans escaliers ni marches)
              </span>
              <p className="text-[11px] text-stone-500 font-normal">
                Cochez cette case si le point de distribution ou le panier est facilement praticable pour les poussettes d&apos;enfants et personnes à mobilité réduite.
              </p>
            </div>
          </label>
        </div>

        {/* Photo de la décoration / du stand */}
        <div className="border-t border-stone-200/80 pt-4">
          <PhotoUploadField
            initialPhotoUrl={reg?.photo_url}
            label="Photo de votre maison ou stand décoré (optionnel)"
            helperText="Téléversez une photo de votre devanture ou de vos décorations pour donner envie aux enfants du village de s'arrêter !"
          />
        </div>

        <label className="block text-xs font-medium text-stone-700">
          Indications d&apos;accès pour les familles
          <textarea
            name="access_instructions"
            maxLength={280}
            rows={3}
            defaultValue={reg?.access_instructions ?? ""}
            placeholder="Ex. : Sonnette du bas, entrée par le chemin latéral…"
            className="mt-1.5 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          />
        </label>

        <Button type="submit" className="w-full">
          Enregistrer ma participation
        </Button>
      </form>
    </main>
  );
}
