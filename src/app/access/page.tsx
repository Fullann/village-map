"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, KeyRound } from "lucide-react";
import { unlockSiteWithVillageCode } from "@/app/actions/auth";

export default function VillageAccessGatePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-stone-900 relative overflow-hidden bg-[#FAF8F5]">
      {/* Halo d'ambiance d'arrière-plan */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-orange-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md space-y-6 relative z-10"
      >
        <div className="rounded-3xl border border-stone-900/[0.08] bg-white/90 p-8 shadow-[0_24px_60px_-15px_rgba(28,25,23,0.14)] backdrop-blur-2xl space-y-6">
          <div className="border-b border-stone-200/80 pb-5 space-y-2">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] bg-[#b91c1c] text-[9px] font-bold text-white shadow-sm">
                +
              </span>
              <span>Commune de Vufflens-la-Ville · 1302</span>
            </div>

            <h1 className="font-editorial text-3xl font-bold tracking-tight text-stone-900">
              Accès réservé aux habitants
            </h1>

            <p className="text-xs text-stone-600 leading-relaxed pt-0.5">
              Consultez la carte 3D du village (Halloween &amp; Fenêtres de l&apos;Avent) et suivez les animations en direct grâce au code de votre tout-ménage communal.
            </p>
          </div>

          <form
            action={async (fd) => {
              setLoading(true);
              setError(null);
              const res = await unlockSiteWithVillageCode(fd);
              if (res.success) {
                router.push("/");
                router.refresh();
              } else {
                setError(res.error ?? "Code invalide.");
                setLoading(false);
              }
            }}
            className="space-y-4"
          >
            <label className="block text-xs font-semibold text-stone-700">
              Code communal villageois
              <div className="relative mt-2">
                <KeyRound className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  name="villageCode"
                  type="text"
                  required
                  autoFocus
                  placeholder="Code secret tout-ménage"
                  className="w-full h-11 rounded-2xl border border-stone-300/90 bg-white pl-10 pr-4 text-sm font-mono uppercase tracking-wider font-bold text-stone-900 placeholder:text-stone-300 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 shadow-sm"
                />
              </div>
            </label>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-red-200 bg-red-50/80 p-3 text-xs font-medium text-red-900"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-lg shadow-stone-900/20 transition-all disabled:opacity-60"
            >
              <span>{loading ? "Vérification en cours…" : "Entrer sur la carte du village"}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </motion.button>
          </form>

          {process.env.NODE_ENV !== "production" && (
            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-3 text-[11px] text-stone-600 flex items-center justify-between">
              <span>Code de démonstration :</span>
              <code className="font-mono font-bold text-stone-900 bg-white px-2 py-0.5 rounded-md border border-stone-300">
                VILLAGE2026
              </code>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-2 text-xs text-stone-500">
          <Link
            href="/privacy"
            className="inline-flex items-center gap-1 font-medium hover:text-stone-900 transition underline underline-offset-2"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Vie privée & nLPD</span>
          </Link>
          <Link
            href="/admin/login"
            className="font-medium underline hover:text-stone-900 transition"
          >
            Administration (/admin) →
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
