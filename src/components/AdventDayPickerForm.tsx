"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import PhotoUploadField from "@/components/PhotoUploadField";

export interface AdventDayMeta {
  status: string;
  is_communal: boolean;
  label?: string | null;
}

interface AdventDayPickerFormProps {
  takenByOthers: number[];
  takenMeta?: Record<number, AdventDayMeta>;
  initialDay: number | null;
  initialType: "window_only" | "hospitality";
  initialActivityLabel: string;
  initialLightingTime: string;
  initialEventStart: string;
  initialEventEnd: string;
  initialDetails: string;
  initialIsAccessible?: boolean;
  initialPhotoUrl?: string | null;
  hasExisting: boolean;
  isCancellationClosed?: boolean;
  cancellationDeadline?: string | null;
  submitAction: (fd: FormData) => Promise<void>;
}

const FORMULA_SUGGESTIONS: Array<{
  label: string;
  type: "window_only" | "hospitality";
}> = [
  { label: "Fenêtre décorée (visible depuis la rue)", type: "window_only" },
  { label: "Partage d'une soupe & pain", type: "hospitality" },
  { label: "Lecture de contes (Bibliothèque / foyer)", type: "hospitality" },
  { label: "Verrée : vin chaud, thé & bricelets", type: "hospitality" },
  { label: "Chants de Noël & chocolat chaud", type: "hospitality" },
  { label: "Animation / atelier pour les enfants", type: "hospitality" },
];

export default function AdventDayPickerForm({
  takenByOthers,
  takenMeta = {},
  initialDay,
  initialType,
  initialActivityLabel,
  initialLightingTime,
  initialEventStart,
  initialEventEnd,
  initialDetails,
  initialIsAccessible = true,
  initialPhotoUrl,
  hasExisting,
  isCancellationClosed = false,
  cancellationDeadline,
  submitAction,
}: AdventDayPickerFormProps) {
  const takenSet = new Set(takenByOthers);

  const firstFreeDay =
    initialDay && !takenSet.has(initialDay)
      ? initialDay
      : Array.from({ length: 24 }, (_, i) => i + 1).find((d) => !takenSet.has(d)) ?? null;

  const [selectedDay, setSelectedDay] = useState<number | null>(firstFreeDay);
  const [participationType, setParticipationType] = useState<"window_only" | "hospitality">(
    initialType
  );
  const [activityLabel, setActivityLabel] = useState<string>(
    initialActivityLabel ||
      (initialType === "hospitality"
        ? "Verrée : vin chaud, thé & bricelets"
        : "Fenêtre décorée (visible depuis la rue)")
  );

  const handleSelectSuggestion = (s: { label: string; type: "window_only" | "hospitality" }) => {
    setActivityLabel(s.label);
    setParticipationType(s.type);
  };

  return (
    <form
      action={submitAction}
      className="space-y-6 rounded-2xl border border-stone-300/90 bg-white p-6 shadow-sm"
    >
      <input type="hidden" name="requested_day" value={selectedDay ?? ""} />
      <input type="hidden" name="participation_type" value={participationType} />

      {/* 1. Choix de la proposition de date (1 au 24 décembre) */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <label className="text-xs font-semibold text-stone-800">
            1. Proposez une date souhaitée (1 au 24 décembre)
          </label>
          <span className="font-mono-tabular text-[11px] text-stone-500">
            {24 - takenSet.size} date(s) disponible(s)
          </span>
        </div>
        <p className="text-[11px] text-stone-500 mb-2.5">
          Indiquez à la commune le jour que vous souhaiteriez animer. L&apos;attribution officielle sera confirmée par la mairie.
        </p>

        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
          {Array.from({ length: 24 }, (_, i) => i + 1).map((day) => {
            const isTaken = takenSet.has(day);
            const isSelected = selectedDay === day;
            const meta = takenMeta[day];
            const isBlocked = meta?.status === "blocked";
            const isCommunal = meta?.is_communal || meta?.status === "reserved_commune";

            let labelText = "Libre";
            let buttonTitle = `${day} décembre : disponible`;

            if (isSelected) {
              labelText = "Choisi";
            } else if (isBlocked) {
              labelText = "Bloqué";
              buttonTitle = `${day} décembre : Bloqué par la commune${meta?.label ? ` (${meta.label})` : ""}`;
            } else if (isCommunal) {
              labelText = "Commune";
              buttonTitle = `${day} décembre : Réservé par la commune${meta?.label ? ` (${meta.label})` : ""}`;
            } else if (isTaken) {
              labelText = "Pris";
              buttonTitle = `${day} décembre : déjà réservé par un autre foyer`;
            }

            return (
              <button
                key={day}
                type="button"
                disabled={isTaken}
                onClick={() => setSelectedDay(day)}
                title={buttonTitle}
                className={`h-11 rounded-xl border text-xs font-mono-tabular font-semibold transition flex flex-col items-center justify-center ${
                  isSelected
                    ? "border-[#14532d] bg-[#14532d] text-white shadow-sm ring-2 ring-[#14532d]/25"
                    : isBlocked
                    ? "border-stone-300 bg-stone-200/80 text-stone-500 cursor-not-allowed opacity-90"
                    : isCommunal
                    ? "border-purple-300 bg-purple-50 text-purple-700 cursor-not-allowed opacity-95"
                    : isTaken
                    ? "border-stone-200 bg-stone-100 text-stone-400 line-through cursor-not-allowed"
                    : "border-stone-200/90 bg-white text-stone-800 hover:border-stone-900 hover:bg-stone-50"
                }`}
              >
                <span>{day}</span>
                <span className="font-sans text-[9px] font-normal opacity-85">
                  {labelText}
                </span>
              </button>
            );
          })}
        </div>

        {/* Légende explicative */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-stone-600 bg-stone-50/80 border border-stone-200/60 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-stone-300 bg-white inline-block" />
            <span>Libre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#14532d] inline-block" />
            <span>Sélectionné</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-purple-600 inline-block" />
            <span>Réservé Commune</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-stone-400 inline-block" />
            <span>Bloqué Commune</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-stone-300 inline-block" />
            <span>Réservé habitant</span>
          </div>
        </div>

        {selectedDay ? (
          <p className="mt-2 text-xs text-stone-700">
            Date sélectionnée : <strong>{selectedDay} décembre</strong>
          </p>
        ) : (
          <p className="mt-2 text-xs text-red-800">
            Toutes les 24 dates sont actuellement réservées.
          </p>
        )}
      </div>

      {/* 2. Formule libre + Suggestions rapides */}
      <div className="space-y-3 border-t border-stone-200/80 pt-5">
        <div className="space-y-1">
          <label htmlFor="activity_label" className="block text-xs font-semibold text-stone-800">
            2. Formule ou animation proposée (champ libre)
          </label>
          <p className="text-[11px] text-stone-500">
            Écrivez librement ce que vous proposez (ex. lecture à la bibliothèque, partage d&apos;une soupe, verrée, exposition, ou simple fenêtre décorée) ou cliquez sur une suggestion :
          </p>
        </div>

        <input
          id="activity_label"
          name="activity_label"
          type="text"
          required
          maxLength={120}
          value={activityLabel}
          onChange={(e) => setActivityLabel(e.target.value)}
          placeholder="Ex. : Lecture de contes à la Bibliothèque, Partage d'une soupe, Fenêtre illuminée…"
          className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-medium text-stone-900 focus:border-stone-900 focus:outline-none"
        />

        {/* Idées rapides cliquables */}
        <div className="flex flex-wrap gap-1.5">
          {FORMULA_SUGGESTIONS.map((s) => {
            const active = activityLabel === s.label;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => handleSelectSuggestion(s)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  active
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-400 hover:bg-stone-100"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Type d'accueil sur place (pour la couleur 3D et l'horaire d'accueil) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => setParticipationType("window_only")}
            className={`rounded-xl border p-3 text-left text-xs transition ${
              participationType === "window_only"
                ? "border-[#14532d] bg-[#14532d]/[0.06] text-stone-900 ring-1 ring-[#14532d]"
                : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
            }`}
          >
            <div className="flex items-center gap-2 font-semibold text-stone-900">
              <span className="h-2.5 w-2.5 rounded-full bg-[#14532d]" />
              <span>Visite libre depuis la rue</span>
            </div>
            <p className="mt-0.5 text-[11px] text-stone-500">
              Fenêtre ou décoration illuminée à admirer en passant.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setParticipationType("hospitality")}
            className={`rounded-xl border p-3 text-left text-xs transition ${
              participationType === "hospitality"
                ? "border-[#991b1b] bg-[#991b1b]/[0.06] text-stone-900 ring-1 ring-[#991b1b]"
                : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
            }`}
          >
            <div className="flex items-center gap-2 font-semibold text-stone-900">
              <span className="h-2.5 w-2.5 rounded-full bg-[#991b1b]" />
              <span>Accueil / Animation à heure fixe</span>
            </div>
            <p className="mt-0.5 text-[11px] text-stone-500">
              Soupe, lecture, verrée, musique ou moment partagé avec les habitants.
            </p>
          </button>
        </div>
      </div>

      {/* 3. Horaires & Précisions */}
      <div className="space-y-4 border-t border-stone-200/80 pt-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block text-xs font-medium text-stone-700">
            Heure d&apos;illumination
            <input
              type="time"
              name="lighting_time"
              defaultValue={initialLightingTime}
              className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm font-mono-tabular"
            />
          </label>
          <label className="block text-xs font-medium text-stone-700">
            Début de l&apos;animation {participationType === "hospitality" ? "(requis)" : "(optionnel)"}
            <input
              type="time"
              name="event_start_time"
              required={participationType === "hospitality"}
              defaultValue={initialEventStart}
              className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm font-mono-tabular"
            />
          </label>
          <label className="block text-xs font-medium text-stone-700">
            Fin de l&apos;animation (optionnel)
            <input
              type="time"
              name="event_end_time"
              defaultValue={initialEventEnd}
              className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm font-mono-tabular"
            />
          </label>
        </div>

        <label className="block text-xs font-medium text-stone-700">
          Détails pratiques pour les visiteurs (lieu exact, programme, quoi apporter…)
          <textarea
            name="hospitality_details"
            maxLength={350}
            rows={3}
            defaultValue={initialDetails}
            placeholder="Ex. : Lecture de contes d'hiver à 18h00 à la Bibliothèque communale, suivie d'une soupe à la courge ouverte à tous !"
            className="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
        </label>

        {/* 4. Accessibilité Plain-pied / Poussettes & PMR */}
        <div className="rounded-xl border border-stone-200/80 bg-stone-50/70 p-3.5">
          <label className="flex items-start gap-2.5 text-xs font-medium text-stone-800 cursor-pointer">
            <input
              type="checkbox"
              name="is_accessible_step_free"
              defaultChecked={initialIsAccessible}
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-800"
            />
            <div>
              <span className="font-semibold text-stone-900">
                ♿ Accès de plain-pied (sans escaliers ni marches)
              </span>
              <p className="text-[11px] text-stone-500 font-normal">
                Indique si le lieu de la fenêtre ou de l&apos;accueil est directement accessible en poussette et pour les personnes à mobilité réduite.
              </p>
            </div>
          </label>
        </div>

        {/* 5. Galerie photo de la fenêtre illuminée */}
        <div className="border-t border-stone-200/80 pt-4">
          <PhotoUploadField
            initialPhotoUrl={initialPhotoUrl}
            label="Photo de la fenêtre illuminée ou du stand (optionnel)"
            helperText="Téléversez une photo de votre fenêtre le soir de son illumination : les promeneurs pourront la contempler depuis la carte 3D !"
          />
        </div>
      </div>

      {isCancellationClosed && hasExisting && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          ⚠️ La date limite de modification/désinscription fixée par la commune {cancellationDeadline ? `(le ${cancellationDeadline})` : ""} est passée. Votre participation est enregistrée. Pour tout changement, contactez la mairie.
        </div>
      )}

      <Button
        type="submit"
        disabled={!selectedDay || (hasExisting && isCancellationClosed)}
        className="w-full h-11 rounded-xl"
      >
        {hasExisting
          ? isCancellationClosed
            ? "Modifications fermées par la commune"
            : `Mettre à jour ma proposition pour le ${selectedDay ?? ""} décembre`
          : `Proposer le ${selectedDay ?? ""} décembre à la commune`}
      </Button>
    </form>
  );
}
