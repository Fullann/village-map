"use client";

import { useState } from "react";
import Link from "next/link";
import { signInWithMagicLink } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export default function AdminLoginPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(null);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 text-stone-900">
      <form
        action={async (fd) => {
          setMsg(null);
          setError(null);
          const r = await signInWithMagicLink(fd);
          if (r.success) {
            setMsg("Lien de connexion envoyé sur votre boîte mail d'administration.");
            setDevUrl(r.devMagicUrl ?? null);
          } else {
            setError(r.error ?? "Connexion refusée.");
          }
        }}
        className="w-full max-w-sm space-y-4 rounded-lg border border-stone-300 bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="adminOnly" value="true" />

        <div className="border-b border-stone-200 pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
            Commune de Vufflens-la-Ville
          </p>
          <h1 className="font-editorial text-xl font-bold mt-0.5">
            Connexion Administration
          </h1>
          <p className="text-xs text-stone-600 mt-1">
            Accès direct au back-office communal sans code villageois.
          </p>
        </div>

        <label className="block text-xs font-medium text-stone-700">
          Email administrateur ou modérateur
          <input
            name="email"
            type="email"
            required
            placeholder="nom@commune.ch"
            className="mt-1.5 w-full rounded-md bg-white border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-900"
          />
        </label>

        {error && (
          <p className="rounded-md border border-red-300 bg-red-50 p-2.5 text-xs text-red-900">
            {error}
          </p>
        )}
        {msg && <p className="text-xs text-stone-600">{msg}</p>}

        <Button type="submit" className="w-full">
          Recevoir mon lien d&apos;administration
        </Button>

        {process.env.NODE_ENV !== "production" && devUrl && (
          <a
            href={devUrl}
            className="block rounded-md border border-stone-300 bg-stone-100 p-2.5 text-center text-xs font-medium text-stone-900 hover:bg-stone-200"
          >
            Ouvrir le lien de connexion admin (dev) →
          </a>
        )}
      </form>

      {process.env.NODE_ENV !== "production" && (
        <div className="w-full max-w-sm space-y-2.5 rounded-lg border border-stone-300 bg-[#FAF8F5] p-5 text-xs">
          <div className="font-semibold text-stone-900">
            Accès direct Administration (développement)
          </div>
          <a
            href="/auth/dev-login?email=admin@village.ch&next=/admin"
            className="flex h-9 w-full items-center justify-center rounded-md bg-stone-900 px-3 font-medium text-white transition hover:bg-stone-800"
          >
            Ouvrir /admin en tant que admin@village.ch →
          </a>
        </div>
      )}

      <Link href="/access" className="text-xs text-stone-500 hover:text-stone-900">
        ← Retour au portail habitant
      </Link>
    </main>
  );
}

