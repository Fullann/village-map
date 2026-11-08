"use client";

export function PrintPosterButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800 transition shadow-sm"
    >
      Imprimer / Enregistrer en PDF (A4)
    </button>
  );
}

