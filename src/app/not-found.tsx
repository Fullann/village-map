import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-stone-900 bg-[#FAF8F5]">
      <div className="w-full max-w-md rounded-3xl border border-stone-900/[0.08] bg-white/90 p-8 text-center space-y-4 shadow-sm backdrop-blur-md">
        <span className="font-mono text-xs uppercase tracking-widest text-stone-400">
          Erreur 404
        </span>
        <h1 className="font-editorial text-2xl font-bold text-stone-900">
          Page introuvable
        </h1>
        <p className="text-xs text-stone-600 leading-relaxed">
          La page que vous recherchez n&apos;existe pas ou a été déplacée.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-stone-800 transition"
          >
            Retourner à la carte du village
          </Link>
        </div>
      </div>
    </main>
  );
}
