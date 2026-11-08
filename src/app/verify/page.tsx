import { redirect } from "next/navigation";
import Link from "next/link";
import { query } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { verifyResidenceAction } from "@/app/actions/verify-residence";
import { AddressAutocompleteAndMap, type AddressOption } from "@/components/AddressAutocompleteAndMap";
import { Button } from "@/components/ui/button";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const addresses = await query<AddressOption>(
    `SELECT id,
            street_name,
            house_number,
            ST_X(location::geometry) AS lng,
            ST_Y(location::geometry) AS lat
     FROM public.addresses
     ORDER BY street_name ASC, house_number ASC`
  );

  const { error } = await searchParams;

  async function submit(fd: FormData) {
    "use server";
    const r = await verifyResidenceAction(fd);
    if (r.success) redirect("/dashboard");
    redirect(`/verify?error=${encodeURIComponent(r.error ?? "Erreur")}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-stone-900">
      <form
        action={submit}
        className="w-full max-w-lg space-y-4 rounded-lg border border-stone-300 bg-white p-6 shadow-sm"
      >
        <div className="flex items-baseline justify-between border-b border-stone-200 pb-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
              1302 Vufflens-la-Ville
            </p>
            <h1 className="font-editorial text-xl font-bold mt-0.5">
              Rattachement à votre adresse
            </h1>
          </div>
          <Link href="/dashboard" className="text-xs text-stone-500 hover:text-stone-900">
            ← Retour
          </Link>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 border border-red-300 p-3 text-xs text-red-900">
            {error}
          </p>
        )}

        <AddressAutocompleteAndMap addresses={addresses} />

        <label className="block text-xs font-medium text-stone-700">
          Code communal (transmis par courrier tout-ménage)
          <input
            name="villageCode"
            placeholder="Code à 8 caractères"
            className="mt-1.5 w-full rounded-md bg-white border border-stone-300 px-3 py-2 text-sm uppercase text-stone-900"
          />
        </label>

        <div className="flex gap-2 pt-1">
          <Button type="submit" name="mode" value="code" className="flex-1">
            Valider avec le code
          </Button>
          <Button
            type="submit"
            name="mode"
            value="manual_moderation"
            variant="outline"
            className="flex-1"
          >
            Validation par la mairie
          </Button>
        </div>
      </form>
    </main>
  );
}
