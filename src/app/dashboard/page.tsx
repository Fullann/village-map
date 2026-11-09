import { redirect } from "next/navigation";
import Link from "next/link";
import { query } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { toggleOutOfCandyAction } from "@/app/actions/halloween";
import type { SeasonMode } from "@/types";

export default async function DashboardPage() {
  const profile = await getSessionUser();
  if (!profile) redirect("/login");

  const stateRows = await query<{
    current_season: SeasonMode;
    advent_registration_opens_at: string;
    advent_is_published: boolean;
  }>(
    `SELECT current_season, advent_registration_opens_at::TEXT, advent_is_published
     FROM public.public_village_state LIMIT 1`
  );
  const state = stateRows[0];
  const verified = profile.verification_status.startsWith("verified");

  const addressRows = profile.address_id
    ? await query<{ street_name: string; house_number: string }>(
        `SELECT street_name, house_number FROM public.addresses WHERE id = $1`,
        [profile.address_id]
      )
    : [];
  const addressLabel = addressRows[0]
    ? `${addressRows[0].street_name} ${addressRows[0].house_number}, 1302 Vufflens-la-Ville`
    : "Aucune adresse rattachée";

  const halloweenRegRows = verified
    ? await query<{
        is_distributing: boolean;
        out_of_candy: boolean;
        start_time: string;
        end_time: string;
      }>(
        `SELECT is_distributing, COALESCE(out_of_candy, FALSE) AS out_of_candy, start_time::TEXT, end_time::TEXT
         FROM public.halloween_registrations
         WHERE user_id = $1 AND season_year = EXTRACT(YEAR FROM CURRENT_DATE)`,
        [profile.id]
      )
    : [];
  const halloweenReg = halloweenRegRows[0] ?? null;

  async function toggleCandy() {
    "use server";
    await toggleOutOfCandyAction();
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6 text-stone-900">
      <header className="flex items-baseline justify-between border-b border-stone-300 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            Commune de Vufflens-la-Ville
          </p>
          <h1 className="font-editorial text-2xl font-bold mt-0.5">Espace habitant</h1>
        </div>
        <Link
          href="/"
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-900 hover:bg-stone-100"
        >
          ← Carte du village
        </Link>
      </header>

      <section className="rounded-lg border border-stone-300 bg-white p-5 space-y-2 text-xs shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-stone-500">Compte connecté</span>
          <span className="font-semibold text-stone-900">{profile.email}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-stone-500">Adresse de résidence</span>
          <span className="font-semibold text-stone-900">{addressLabel}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-stone-500">Statut de vérification</span>
          <span className="font-medium text-stone-700">
            {verified ? "Résidence confirmée" : "En attente de validation"}
          </span>
        </div>
      </section>

      {/* Bouton d'action rapide en 1 clic : Stock de bonbons épuisé ce soir */}
      {/* Actif uniquement si la saison est en mode Halloween ET le jour du 31 (31 octobre ou 31 décembre) */}
      {state?.current_season === "halloween" &&
        (() => {
          const now = new Date();
          return now.getDate() === 31 && (now.getMonth() === 9 || now.getMonth() === 11);
        })() &&
        verified &&
        halloweenReg &&
        halloweenReg.is_distributing && (
        <section
          className={`rounded-lg border p-4 shadow-sm space-y-3 ${
            halloweenReg.out_of_candy
              ? "border-stone-400 bg-stone-100"
              : "border-[#b84a27]/40 bg-[#b84a27]/5"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#b84a27]">
                Action rapide · Soirée du 31 octobre
              </div>
              <div className="font-editorial text-base font-bold text-stone-900 mt-0.5">
                {halloweenReg.out_of_candy
                  ? "Votre stock est signalé comme épuisé pour ce soir"
                  : "Vous distribuez des bonbons ce soir"}
              </div>
              <p className="text-xs text-stone-600 mt-0.5">
                {halloweenReg.out_of_candy
                  ? "Votre maison 3D apparaît en gris sur la carte des promeneurs pour éviter les détours inutiles."
                  : "Si votre stock est vide avant la fin de la soirée, signalez-le en 1 clic sans supprimer votre fiche."}
              </p>
            </div>
          </div>

          <form action={toggleCandy}>
            <input
              type="hidden"
              name="out_of_candy"
              value={halloweenReg.out_of_candy ? "false" : "true"}
            />
            <button
              type="submit"
              className={`w-full min-h-[46px] rounded-md px-4 py-2.5 text-xs font-bold transition shadow-sm ${
                halloweenReg.out_of_candy
                  ? "border border-stone-900 bg-white text-stone-900 hover:bg-stone-50"
                  : "bg-[#b84a27] text-white hover:bg-[#9e3d1e]"
              }`}
            >
              {halloweenReg.out_of_candy
                ? "Réactiver la distribution (nous avons à nouveau des bonbons)"
                : "Signaler « Stock de bonbons épuisé pour ce soir » (1 clic)"}
            </button>
          </form>
        </section>
      )}

      {!verified ? (
        <Link
          href="/verify"
          className="block rounded-lg border border-stone-900 bg-stone-900 p-4 text-sm font-medium text-white hover:bg-stone-800"
        >
          Rattacher et valider mon adresse à Vufflens-la-Ville →
        </Link>
      ) : (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/halloween"
            className="rounded-lg border border-stone-300 bg-white p-4 hover:border-stone-900 transition space-y-1 shadow-sm"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#b84a27]">
              31 octobre {state?.current_season === "halloween" ? "· Saison active" : ""}
            </div>
            <div className="font-editorial text-base font-bold text-stone-900">
              Soirée d&apos;Halloween
            </div>
            <p className="text-xs text-stone-600">
              Indiquer vos horaires de distribution de bonbons ou votre panier en libre-service.
            </p>
          </Link>

          <Link
            href="/advent"
            className="rounded-lg border border-stone-300 bg-white p-4 hover:border-stone-900 transition space-y-1 shadow-sm"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#1b4d3e]">
              1 – 24 décembre {state?.current_season === "advent" ? "· Saison active" : ""}
            </div>
            <div className="font-editorial text-base font-bold text-stone-900">
              Fenêtres de l&apos;Avent
            </div>
            <p className="text-xs text-stone-600">
              Proposer une date dès le {state?.advent_registration_opens_at ?? "01.11"} et consulter votre attribution.
            </p>
          </Link>
        </section>
      )}

      {(profile.role === "admin" || profile.role === "moderator") && (
        <Link
          href="/admin"
          className="block rounded-lg border border-stone-300 bg-stone-100 p-4 text-xs font-semibold text-stone-900 hover:bg-stone-200 transition"
        >
          Accéder à l&apos;administration communale (choix du mode Halloween / Noël, attribution des 24 fenêtres et publication) →
        </Link>
      )}

      <div className="pt-2">
        <a
          href="/auth/logout"
          className="inline-flex h-9 items-center justify-center rounded-md border border-stone-300 bg-white px-4 text-xs font-medium text-stone-700 hover:bg-stone-100"
        >
          Se déconnecter
        </a>
      </div>
    </main>
  );
}
