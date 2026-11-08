"use client";

import { useState } from "react";
import Link from "next/link";
import { signInWithMagicLink } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(null);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 text-stone-900">
      <form
        action={async (fd) => {
          const r = await signInWithMagicLink(fd);
          setMsg(r.success ? "Un lien de connexion vous a été envoyé par email." : r.error ?? "Erreur");
          setDevUrl(r.devMagicUrl ?? null);
        }}
        className="w-full max-w-sm space-y-4 rounded-lg border border-stone-300 bg-white p-6 shadow-sm"
      >
        <div className="flex items-baseline justify-between border-b border-stone-200 pb-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
              Vufflens-la-Ville
            </p>
            <h1 className="font-editorial text-xl font-bold mt-0.5">Connexion habitant</h1>
          </div>
          <Link href="/" className="text-xs text-stone-500 hover:text-stone-900">
            ← Carte
          </Link>
        </div>

        <label className="block text-xs font-medium text-stone-700">
          Adresse email
          <input
            name="email"
            type="email"
            required
            placeholder="nom@domaine.ch"
            className="mt-1.5 w-full rounded-md bg-white border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-900"
          />
        </label>

        <Button type="submit" className="w-full">
          Recevoir un lien de connexion
        </Button>

        {msg && <p className="text-xs text-stone-600">{msg}</p>}
        {process.env.NODE_ENV !== "production" && devUrl && (
          <a
            href={devUrl}
            className="block rounded-md border border-stone-300 bg-stone-100 p-2.5 text-center text-xs font-medium text-stone-900 hover:bg-stone-200"
          >
            Ouvrir le lien de connexion (environnement local) →
          </a>
        )}

        <div className="pt-2 text-center text-xs text-stone-500">
          <Link href="/privacy" className="underline hover:text-stone-800 transition">
            Protection des données & nLPD
          </Link>
        </div>
      </form>

      {/* Comptes de démonstration pré-configurés (strictement masqués en production) */}
      {process.env.NODE_ENV !== "production" && (
        <div className="w-full max-w-sm space-y-3 rounded-lg border border-stone-300 bg-[#FAF8F5] p-5 text-xs">
          <div className="font-semibold text-stone-900">
            Accès direct pour vos essais (développement)
          </div>
          <div className="space-y-2">
            <a
              href="/auth/dev-login?email=admin@village.ch"
              className="flex h-9 w-full items-center justify-center rounded-md bg-stone-900 px-3 font-medium text-white transition hover:bg-stone-800"
            >
              Compte Administration (admin@village.ch)
            </a>
            <a
              href="/auth/dev-login?email=habitant@village.ch"
              className="flex h-9 w-full items-center justify-center rounded-md border border-stone-300 bg-white px-3 font-medium text-stone-800 transition hover:bg-stone-100"
            >
              Compte Habitant vérifié (habitant@village.ch)
            </a>
          </div>
          <p className="text-[11px] text-stone-500">
            Code d&apos;accès communal pour valider une nouvelle adresse :{" "}
            <code className="font-mono font-semibold text-stone-800">VILLAGE2026</code>
          </p>
        </div>
      )}
    </main>
  );
}
