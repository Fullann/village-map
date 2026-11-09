import Link from "next/link";
import { Compass, Home, MapPin, ShieldCheck } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-stone-900 relative overflow-hidden bg-[#FAF8F5] pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {/* Halos d'ambiance d'arrière-plan */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-orange-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-purple-500/5 blur-3xl" />

      <div className="w-full max-w-md space-y-6 relative z-10 animate-fade-in">
        <div className="rounded-3xl border border-stone-900/[0.08] bg-white/90 p-8 shadow-[0_24px_60px_-15px_rgba(28,25,23,0.12)] backdrop-blur-2xl text-center space-y-6">
          
          {/* Badge communal */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-stone-200/80 bg-stone-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-600 shadow-2xs">
            <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-[#b91c1c] text-[8px] font-bold text-white shadow-2xs">
              +
            </span>
            <span>Vufflens-la-Ville · 1302</span>
          </div>

          {/* Illustration visuelle 404 */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-stone-200/90 bg-stone-50/80 text-stone-700 shadow-inner">
            <Compass className="h-10 w-10 stroke-[1.5] text-amber-800/85" />
          </div>

          <div className="space-y-2">
            <span className="font-mono text-xs uppercase tracking-widest font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 px-2.5 py-0.5 rounded-full">
              Erreur 404 · Chemin introuvable
            </span>
            <h1 className="font-editorial text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 pt-1">
              Vous vous êtes égaré dans le village
            </h1>
            <p className="text-xs text-stone-600 leading-relaxed max-w-xs mx-auto">
              L&apos;adresse ou la page demandée n&apos;existe pas, a été déplacée ou n&apos;est plus accessible pour cette saison.
            </p>
          </div>

          {/* Actions rapides de redirection */}
          <div className="space-y-2.5 pt-2">
            <Link
              href="/"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-xs font-semibold text-white shadow-sm hover:bg-stone-800 active:scale-[0.99] transition touch-manipulation"
            >
              <MapPin className="h-4 w-4" />
              <span>Retourner à la carte interactive du village</span>
            </Link>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 active:scale-[0.99] transition touch-manipulation"
              >
                <Home className="h-3.5 w-3.5 text-stone-500" />
                <span>Mon foyer</span>
              </Link>

              <Link
                href="/access"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 active:scale-[0.99] transition touch-manipulation"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-stone-500" />
                <span>Code d&apos;accès</span>
              </Link>
            </div>
          </div>

          {/* Pied de page discret */}
          <div className="border-t border-stone-200/80 pt-4 text-[11px] text-stone-400 flex items-center justify-center gap-4">
            <Link href="/" className="hover:text-stone-700 transition">
              Carte 3D
            </Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-stone-700 transition">
              Protection des données (nLPD)
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
