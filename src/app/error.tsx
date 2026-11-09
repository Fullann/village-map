"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erreur applicative capturée :", error);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-stone-900 relative overflow-hidden bg-[#FAF8F5] pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {/* Halos d'ambiance d'arrière-plan */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-red-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="w-full max-w-md space-y-6 relative z-10 animate-fade-in">
        <div className="rounded-3xl border border-stone-900/[0.08] bg-white/95 p-8 shadow-[0_24px_60px_-15px_rgba(28,25,23,0.12)] backdrop-blur-2xl text-center space-y-6">
          {/* Badge communal */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-stone-200/80 bg-stone-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-600 shadow-2xs">
            <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-[#b91c1c] text-[8px] font-bold text-white shadow-2xs">
              +
            </span>
            <span>Vufflens-la-Ville · 1302</span>
          </div>

          {/* Illustration visuelle */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50/80 text-amber-800 shadow-inner">
            <AlertTriangle className="h-10 w-10 stroke-[1.75] text-amber-700" />
          </div>

          <div className="space-y-2">
            <span className="font-mono text-xs uppercase tracking-widest font-semibold text-amber-800 bg-amber-100/70 border border-amber-300/60 px-2.5 py-0.5 rounded-full">
              Erreur 500 · Incident momentané
            </span>
            <h1 className="font-editorial text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 pt-1">
              Un imprévu est survenu
            </h1>
            <p className="text-xs text-stone-600 leading-relaxed max-w-xs mx-auto">
              Le service du village rencontre une difficulté passagère de connexion ou de chargement. Vos données sont en sécurité.
            </p>
            {error.digest && (
              <p className="font-mono text-[10px] text-stone-400 pt-1">
                Code référence : {error.digest}
              </p>
            )}
          </div>

          {/* Actions rapides */}
          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-xs font-semibold text-white shadow-sm hover:bg-stone-800 active:scale-[0.99] transition touch-manipulation cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Réessayer de charger la page</span>
            </button>

            <Link
              href="/"
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-xs font-medium text-stone-700 hover:bg-stone-50 active:scale-[0.99] transition touch-manipulation"
            >
              <Home className="h-3.5 w-3.5 text-stone-500" />
              <span>Retourner à la carte du village</span>
            </Link>
          </div>

          {/* Pied de page */}
          <div className="border-t border-stone-200/80 pt-4 text-[11px] text-stone-400 flex items-center justify-center gap-4">
            <Link href="/privacy" className="hover:text-stone-700 transition">
              Protection des données (nLPD)
            </Link>
            <span>·</span>
            <a href="mailto:greffe@vufflens-la-ville.ch" className="hover:text-stone-700 transition">
              Contacter le greffe
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
