"use client";

import React, { useState, useRef } from "react";
import { Camera, Image as ImageIcon, Trash2, Loader2 } from "lucide-react";

interface PhotoUploadFieldProps {
  initialPhotoUrl?: string | null;
  label?: string;
  helperText?: string;
}

export default function PhotoUploadField({
  initialPhotoUrl,
  label = "Photo de votre fenêtre / stand (optionnel)",
  helperText = "Visible par les promeneurs lorsqu'ils cliquent sur votre maison 3D.",
}: PhotoUploadFieldProps) {
  const [photoUrl, setPhotoUrl] = useState<string>(initialPhotoUrl || "");
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Échec de l'envoi de la photo.");
      }

      setPhotoUrl(data.url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de téléversement.";
      setError(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    setPhotoUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <input type="hidden" name="photo_url" value={photoUrl} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      <label className="block text-xs font-semibold text-stone-800">
        {label}
      </label>
      <p className="text-[11px] text-stone-500">{helperText}</p>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
          {error}
        </p>
      )}

      {photoUrl ? (
        <div className="relative group overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="Aperçu de la décoration"
            className="w-full h-44 object-cover transition-transform group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full bg-white/90 p-2 text-stone-800 hover:bg-white text-xs font-semibold flex items-center gap-1.5 shadow-md"
            >
              <Camera className="w-4 h-4" />
              <span>Changer</span>
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="rounded-full bg-red-600/90 p-2 text-white hover:bg-red-700 text-xs font-semibold flex items-center gap-1.5 shadow-md"
            >
              <Trash2 className="w-4 h-4" />
              <span>Supprimer</span>
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-stone-300 hover:border-stone-500 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 text-stone-600 hover:bg-stone-50 transition"
        >
          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin text-stone-500" />
              <span className="text-xs font-medium">Téléversement en cours…</span>
            </>
          ) : (
            <>
              <div className="h-10 w-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600">
                <ImageIcon className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-stone-800">
                Ajouter une photo de votre maison / fenêtre
              </span>
              <span className="text-[10px] text-stone-400">
                Formats : JPG, PNG ou WEBP (max 6 Mo)
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
