"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Check, Clock, Flame, Gift, Ban } from "lucide-react";
import { triggerHaptic } from "@/lib/themeTokens";
import type { VillageMapEvent } from "@/types";

export interface FloatingMarkerProps {
  event: VillageMapEvent;
  season: "halloween" | "advent";
  isVisited: boolean;
  isSelected: boolean;
  isHoveredFromList?: boolean;
  isActiveTonight: boolean;
  onSelect: (ev: VillageMapEvent) => void;
}

export default function FloatingMarker({
  event,
  season,
  isVisited,
  isSelected,
  isHoveredFromList = false,
  isActiveTonight,
  onSelect,
}: FloatingMarkerProps) {
  const [hovered, setHovered] = useState(false);

  const isHospitality = event.participation_type === "hospitality";
  const isSelfService = Boolean(event.is_self_service);
  const isOutOfCandy = Boolean(event.out_of_candy);
  const isHighlighted = isHoveredFromList || hovered || isSelected;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(14);
    onSelect(event);
  };

  return (
    <div
      className="relative flex flex-col items-center justify-end cursor-pointer select-none group"
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        transform: "translate3d(0, 0, 0)",
        zIndex: isHighlighted ? 60 : 25,
      }}
    >
      {/* 1. Onde radar / Sonar concentrique sur la toiture pour les maisons actives */}
      {isActiveTonight && !isVisited && !isOutOfCandy && (
        <div className="pointer-events-none absolute bottom-0 flex items-center justify-center">
          <motion.span
            animate={{
              scale: [0.6, 2.2],
              opacity: [0.75, 0],
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: "easeOut",
            }}
            className={`absolute h-8 w-8 rounded-full blur-[1px] ${
              season === "halloween"
                ? "bg-orange-500/50"
                : isHospitality
                ? "bg-rose-500/50"
                : "bg-emerald-500/50"
            }`}
          />
          <motion.span
            animate={{
              scale: [0.6, 1.8],
              opacity: [0.6, 0],
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.9,
            }}
            className={`absolute h-8 w-8 rounded-full blur-[1px] ${
              season === "halloween"
                ? "bg-amber-400/50"
                : isHospitality
                ? "bg-red-400/50"
                : "bg-teal-400/50"
            }`}
          />
        </div>
      )}

      {/* 2. Disque d'ancrage lumineux sur le toit */}
      <div className="pointer-events-none absolute bottom-0 flex items-center justify-center">
        <div
          className={`h-2.5 w-5 rounded-full blur-[1px] transition-all duration-300 ${
            isHighlighted
              ? "bg-stone-900/60 scale-125"
              : isVisited
              ? "bg-stone-800/30"
              : season === "halloween"
              ? "bg-orange-950/40"
              : "bg-emerald-950/40"
          }`}
        />
        <span
          className={`absolute h-1.5 w-1.5 rounded-full transition-transform ${
            isHighlighted ? "scale-150" : ""
          } ${
            isOutOfCandy
              ? "bg-stone-400"
              : isVisited
              ? "bg-emerald-400"
              : season === "halloween"
              ? "bg-orange-400 shadow-[0_0_8px_#f97316]"
              : "bg-emerald-400 shadow-[0_0_8px_#34d399]"
          }`}
        />
      </div>

      {/* 3. Info-bulle flottante stylisée au survol ou à la sélection */}
      <AnimatePresence>
        {isHighlighted && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 450, damping: 26 }}
            className="pointer-events-none absolute -top-14 z-50 flex flex-col items-center"
          >
            <div className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-stone-900/95 px-3 py-1.5 text-xs text-white shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <span className="font-semibold text-white">
                {event.street_name} {event.house_number}
              </span>
              <span className="text-white/40">·</span>
              <span className="font-mono text-[11px] text-amber-300">
                {season === "halloween"
                  ? isOutOfCandy
                    ? "Stock épuisé"
                    : isSelfService
                    ? "Libre-service"
                    : `${event.halloween_start?.slice(0, 5) ?? "18:00"}`
                  : event.activity_label ||
                    (isHospitality ? "Verrée" : "Fenêtre illuminée")}
              </span>
            </div>
            {/* Pointe de l'info-bulle */}
            <div className="h-1.5 w-2.5 border-t-4 border-l-4 border-r-4 border-t-stone-900/95 border-l-transparent border-r-transparent" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Marqueur Capsule 3D Moderne avec lévitation dynamique */}
      <motion.button
        type="button"
        animate={{
          y: isHighlighted ? -8 : [0, -4, 0],
          scale: isHighlighted ? 1.15 : 1,
        }}
        transition={{
          y: isHighlighted
            ? { duration: 0.2 }
            : { duration: 2.6, repeat: Infinity, ease: "easeInOut" },
          scale: { type: "spring", stiffness: 400, damping: 24 },
        }}
        whileTap={{ scale: 0.92 }}
        className="relative z-10 flex flex-col items-center focus:outline-none"
      >
        {/* Halo volumétrique d'arrière-plan */}
        <div
          className={`absolute -inset-1 rounded-full blur-md transition-opacity duration-300 ${
            isHighlighted ? "opacity-100" : "opacity-60"
          } ${
            isOutOfCandy
              ? "bg-stone-500/20"
              : isVisited
              ? "bg-emerald-500/30"
              : season === "halloween"
              ? "bg-gradient-to-r from-orange-500/60 to-amber-400/60"
              : isHospitality
              ? "bg-gradient-to-r from-rose-500/60 to-red-600/60"
              : "bg-gradient-to-r from-emerald-500/60 to-teal-400/60"
          }`}
        />

        {/* Corps principal du marqueur façon badge horloger / capsule 3D */}
        <div
          className={`relative flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-tight shadow-[0_8px_20px_-3px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] border transition-all duration-200 backdrop-blur-md ${
            isOutOfCandy
              ? "bg-stone-700/90 border-stone-500 text-stone-300"
              : isVisited
              ? "bg-gradient-to-b from-stone-800 to-stone-900 border-emerald-500/60 text-emerald-300"
              : season === "halloween"
              ? isSelfService
                ? "bg-gradient-to-b from-amber-500 via-orange-600 to-amber-700 border-amber-300 text-white"
                : "bg-gradient-to-b from-orange-500 via-orange-600 to-rose-700 border-orange-300 text-white"
              : isHospitality
              ? "bg-gradient-to-b from-rose-600 via-red-700 to-rose-900 border-rose-300 text-white"
              : "bg-gradient-to-b from-emerald-600 via-emerald-700 to-teal-900 border-emerald-300 text-white"
          } ${
            isSelected
              ? "ring-2 ring-white ring-offset-2 ring-offset-stone-900 shadow-[0_0_20px_rgba(249,115,22,0.7)]"
              : ""
          }`}
        >
          {/* Micro-icône contextuelle */}
          {isOutOfCandy ? (
            <Ban className="h-3 w-3 text-stone-400" />
          ) : isVisited ? (
            <Check className="h-3 w-3 text-emerald-400 stroke-[2.5]" />
          ) : season === "halloween" ? (
            <Flame className="h-3 w-3 text-amber-200 fill-amber-300" />
          ) : isHospitality ? (
            <Gift className="h-3 w-3 text-rose-200 fill-rose-300" />
          ) : (
            <Sparkles className="h-3 w-3 text-emerald-200" />
          )}

          {/* Numéro ou Libellé en typographie nette */}
          <span className="font-mono tabular-nums leading-none drop-shadow-sm">
            {isOutOfCandy
              ? "Épuisé"
              : isVisited
              ? `N° ${event.house_number}`
              : season === "halloween"
              ? `N° ${event.house_number}`
              : `${event.day_number}`}
          </span>

          {/* Indicateur EN DIRECT pulsant si la maison est ouverte */}
          {isActiveTonight && !isVisited && !isOutOfCandy && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-200 shadow-[0_0_6px_#fde68a]" />
            </span>
          )}
        </div>

        {/* Tige 3D effilée plongeant directement vers la toiture */}
        <div
          className={`w-0.5 transition-all duration-300 ${
            isHighlighted ? "h-3.5 w-1" : "h-2.5"
          } ${
            isOutOfCandy
              ? "bg-stone-500/60"
              : isVisited
              ? "bg-emerald-500/70"
              : season === "halloween"
              ? "bg-gradient-to-b from-orange-400 to-orange-600 shadow-[0_0_4px_#ea580c]"
              : "bg-gradient-to-b from-emerald-400 to-teal-600 shadow-[0_0_4px_#10b981]"
          }`}
        />
      </motion.button>
    </div>
  );
}
