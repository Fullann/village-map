"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import {
  Check,
  Clock,
  Search,
  Navigation,
  ChevronUp,
  ChevronRight,
  X,
  Calendar,
  LocateFixed,
  Route,
  ArrowUpRight,
  Footprints,
  Flame,
  Gift,
  Sparkles,
  Lock,
} from "lucide-react";
import {
  SEASON_THEMES,
  listContainerVariants,
  listItemVariants,
  springBounceTransition,
  triggerHaptic,
} from "@/lib/themeTokens";
import type { SeasonMode, VillageMapEvent } from "@/types";

export type DrawerSnap = "collapsed" | "card" | "expanded";

interface MobileDrawerProps {
  officialSeason: SeasonMode;
  adventPublished: boolean;
  adventOpensAt: string;
  events: VillageMapEvent[];
  selectedEvent: VillageMapEvent | null;
  onSelectEvent: (ev: VillageMapEvent | null) => void;
  hoveredAddressId?: string | null;
  onHoverAddress?: (addressId: string | null) => void;
  visitedIds: string[];
  onToggleVisited: (addressId: string) => void;
  filterActiveNow: boolean;
  onToggleFilterActiveNow: () => void;
  filterSelfService: boolean;
  onToggleFilterSelfService: () => void;
  userLocation: [number, number] | null;
  onRequestLocation: () => void;
  showRouteLoop: boolean;
  onToggleRouteLoop: () => void;
  snap: DrawerSnap;
  onChangeSnap: (snap: DrawerSnap) => void;
}

const SNAP_HEIGHTS: Record<DrawerSnap, string> = {
  collapsed: "135px",
  card: "440px",
  expanded: "85dvh",
};

/** Calcule la distance à vol d'oiseau en mètres (formule de Haversine) */
export function computeDistanceMeters(
  from: [number, number],
  toLng: number,
  toLat: number
): number {
  const R = 6371000;
  const dLat = ((toLat - from[1]) * Math.PI) / 180;
  const dLng = ((toLng - from[0]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from[1] * Math.PI) / 180) *
      Math.cos((toLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

export function formatWalkingMinutes(meters: number): string {
  const mins = Math.max(1, Math.round(meters / 72));
  return `~${mins} min`;
}

export default function MobileDrawer({
  officialSeason,
  adventPublished,
  adventOpensAt,
  events,
  selectedEvent,
  onSelectEvent,
  hoveredAddressId,
  onHoverAddress,
  visitedIds,
  onToggleVisited,
  filterActiveNow,
  onToggleFilterActiveNow,
  filterSelfService,
  onToggleFilterSelfService,
  userLocation,
  onRequestLocation,
  showRouteLoop,
  onToggleRouteLoop,
  snap,
  onChangeSnap,
}: MobileDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortByProximity, setSortByProximity] = useState(true);
  const [filterStepFree, setFilterStepFree] = useState(false);

  // Ping statistiques anonymisées
  useEffect(() => {
    fetch("/api/analytics/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "page_view" }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      fetch("/api/analytics/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "address_view",
          addressId: selectedEvent.address_id,
        }),
      }).catch(() => {});
    }
  }, [selectedEvent?.address_id]);

  const activeSeasonKey: "halloween" | "advent" =
    officialSeason === "advent" ? "advent" : "halloween";
  const theme = SEASON_THEMES[activeSeasonKey];

  const searchedEvents = events
    .filter((ev) => {
      if (filterStepFree && !ev.is_accessible_step_free) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        ev.street_name.toLowerCase().includes(q) ||
        ev.house_number.toLowerCase().includes(q) ||
        (ev.day_number && String(ev.day_number) === q.trim()) ||
        (ev.activity_label && ev.activity_label.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (userLocation && sortByProximity) {
        const da = computeDistanceMeters(userLocation, Number(a.lng), Number(a.lat));
        const db = computeDistanceMeters(userLocation, Number(b.lng), Number(b.lat));
        return da - db;
      }
      if (officialSeason === "advent") {
        return (a.day_number ?? 99) - (b.day_number ?? 99);
      }
      return a.street_name.localeCompare(b.street_name);
    });

  const activeCount = events.filter((e) => !e.out_of_candy).length;
  const visitedCount = events.filter((e) => visitedIds.includes(e.address_id)).length;
  const progressPercent =
    events.length > 0 ? Math.min(100, Math.round((visitedCount / events.length) * 100)) : 0;

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const vy = info.velocity.y;
    const dy = info.offset.y;

    if (dy < -50 || vy < -300) {
      triggerHaptic(10);
      if (snap === "collapsed") onChangeSnap(selectedEvent ? "card" : "expanded");
      else if (snap === "card") onChangeSnap("expanded");
    } else if (dy > 50 || vy > 300) {
      triggerHaptic(10);
      if (snap === "expanded") onChangeSnap(selectedEvent ? "card" : "collapsed");
      else if (snap === "card") onChangeSnap("collapsed");
    }
  };

  const openPedestrianRoute = (ev: VillageMapEvent) => {
    triggerHaptic(15);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${ev.lat},${ev.lng}&travelmode=walking`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Tracker de progression dynamique avec animation fluide
  const renderProgressTracker = () => {
    if (events.length === 0) return null;
    return (
      <div className="relative overflow-hidden rounded-2xl border border-stone-900/[0.08] bg-white/80 p-3.5 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-stone-700">
            <Footprints className="h-4 w-4 text-stone-400" />
            <span>Progression de la soirée</span>
          </span>
          <span className="font-mono text-xs font-bold text-stone-900">
            {visitedCount}{" "}
            <span className="font-sans font-normal text-stone-400">/ {events.length}</span>{" "}
            <span className="text-[11px] font-medium text-emerald-600">
              ({progressPercent}%)
            </span>
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-100">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: "spring", stiffness: 220, damping: 25 }}
            className={`h-full rounded-full ${
              officialSeason === "halloween"
                ? "bg-gradient-to-r from-amber-500 to-orange-600 shadow-[0_0_8px_rgba(249,115,22,0.5)]"
                : "bg-gradient-to-r from-teal-500 to-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
            }`}
          />
        </div>
      </div>
    );
  };

  // Pilules de filtrage interactives avec micro-rebond
  const renderQuickFilters = () => (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {officialSeason === "halloween" && (
          <>
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                triggerHaptic(10);
                onToggleFilterActiveNow();
              }}
              className={`min-h-[34px] inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                filterActiveNow
                  ? "bg-gradient-to-r from-orange-500 to-rose-600 border-transparent text-white shadow-md shadow-orange-500/20"
                  : "bg-white/90 border-stone-200/90 text-stone-700 hover:border-stone-300 hover:bg-white shadow-sm"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  filterActiveNow ? "bg-amber-200 animate-pulse" : "bg-orange-500"
                }`}
              />
              <span>En cours</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                triggerHaptic(10);
                onToggleFilterSelfService();
              }}
              className={`min-h-[34px] inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                filterSelfService
                  ? "bg-stone-900 border-stone-900 text-white shadow-md"
                  : "bg-white/90 border-stone-200/90 text-stone-700 hover:border-stone-300 hover:bg-white shadow-sm"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Libre-service</span>
            </motion.button>
          </>
        )}

        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={() => {
            triggerHaptic(10);
            onToggleRouteLoop();
          }}
          className={`min-h-[34px] inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold border transition-all ${
            showRouteLoop
              ? "bg-stone-900 border-stone-900 text-white shadow-md"
              : "bg-white/90 border-stone-200/90 text-stone-700 hover:border-stone-300 hover:bg-white shadow-sm"
          }`}
        >
          <Route className="w-3.5 h-3.5" />
          <span>Boucle piétonne</span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={() => {
            triggerHaptic(10);
            setFilterStepFree((v) => !v);
          }}
          className={`min-h-[34px] inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold border transition-all ${
            filterStepFree
              ? "bg-sky-900 border-sky-900 text-white shadow-md shadow-sky-900/20"
              : "bg-white/90 border-stone-200/90 text-stone-700 hover:border-stone-300 hover:bg-white shadow-sm"
          }`}
        >
          <span>♿ Plain-pied</span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={() => {
            triggerHaptic(10);
            if (!userLocation) onRequestLocation();
            else setSortByProximity((v) => !v);
          }}
          className={`min-h-[34px] inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold border transition-all ${
            userLocation && sortByProximity
              ? "bg-stone-900 border-stone-900 text-white shadow-md"
              : "bg-white/90 border-stone-200/90 text-stone-700 hover:border-stone-300 hover:bg-white shadow-sm"
          }`}
        >
          <LocateFixed className="w-3.5 h-3.5" />
          <span>{userLocation ? "À proximité" : "GPS"}</span>
        </motion.button>
      </div>

      {officialSeason === "advent" && !adventPublished && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-emerald-600/20 bg-emerald-50/70 p-4 text-xs text-stone-700 space-y-2.5 shadow-sm backdrop-blur-md"
        >
          <div className="font-semibold text-stone-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-700" />
            <span>Inscriptions au Calendrier de l&apos;Avent</span>
          </div>
          <p className="leading-relaxed text-stone-600">
            Les inscriptions sont ouvertes dès le <strong>{adventOpensAt}</strong>. La commune publiera ensuite le parcours officiel avec les 24 fenêtres.
          </p>
          <Link
            href="/advent"
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-800 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
          >
            <span>Réserver une date libre</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>
      )}
    </div>
  );

  // Fiche détaillée d'une adresse sélectionnée
  const renderSelectedCard = (ev: VillageMapEvent) => {
    const isVisited = visitedIds.includes(ev.address_id);
    const isOutOfCandy = Boolean(ev.out_of_candy);
    const meters =
      userLocation != null
        ? computeDistanceMeters(userLocation, Number(ev.lng), Number(ev.lat))
        : null;

    return (
      <motion.div
        key={ev.address_id}
        layout
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.96 }}
        transition={springBounceTransition}
        className="relative overflow-hidden rounded-2xl border border-stone-900/15 bg-white/95 p-4 space-y-3.5 shadow-[0_16px_36px_-8px_rgba(28,25,23,0.16)] backdrop-blur-xl"
      >
        {/* Barre d'accentuation lumineuse */}
        <span
          className={`absolute left-0 top-0 bottom-0 w-1.5 ${
            isOutOfCandy
              ? "bg-stone-400"
              : officialSeason === "halloween"
              ? "bg-gradient-to-b from-amber-400 to-orange-600"
              : ev.participation_type === "hospitality"
              ? "bg-gradient-to-b from-rose-500 to-red-700"
              : "bg-gradient-to-b from-teal-400 to-emerald-700"
          }`}
        />

        <div className="flex items-start justify-between gap-2 pl-2">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-bold shadow-sm ${
                  isOutOfCandy
                    ? "bg-stone-100 text-stone-600"
                    : officialSeason === "halloween"
                    ? "bg-orange-500/15 text-orange-700"
                    : "bg-emerald-500/15 text-emerald-800"
                }`}
              >
                {officialSeason === "halloween"
                  ? isOutOfCandy
                    ? "Stock épuisé pour ce soir"
                    : ev.is_self_service
                    ? "Panier libre-service"
                    : "Accueil à la porte"
                  : `Fenêtre du ${ev.day_number} décembre`}
              </span>

              {meters != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-stone-700">
                  <Navigation className="h-2.5 w-2.5" />
                  <span>{formatDistance(meters)}</span>
                  <span className="text-stone-400">({formatWalkingMinutes(meters)})</span>
                </span>
              )}

              {ev.is_accessible_step_free && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200/80 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                  ♿ Plain-pied
                </span>
              )}
            </div>

            <h3 className="font-editorial text-2xl font-bold text-stone-900 mt-1 leading-snug">
              {ev.street_name} {ev.house_number}
            </h3>
            <p className="text-[11px] text-stone-500">1302 Vufflens-la-Ville</p>
          </div>

          <button
            type="button"
            onClick={() => onSelectEvent(null)}
            className="h-8 w-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition"
            aria-label="Fermer la fiche"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Photo de la fenêtre ou du stand */}
        {ev.photo_url && (
          <div className="pl-2">
            <a
              href={ev.photo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-inner"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ev.photo_url}
                alt={`Photo ${ev.street_name} ${ev.house_number}`}
                className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <span className="absolute bottom-2.5 right-2.5 rounded-full bg-stone-900/80 backdrop-blur-md px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm flex items-center gap-1">
                <span>Agrandir</span>
                <ArrowUpRight className="w-3 h-3" />
              </span>
            </a>
          </div>
        )}

        <div className="pl-2 space-y-2.5">
          {officialSeason === "halloween" ? (
            <div className="space-y-2 text-xs">
              <div className="inline-flex items-center gap-2 rounded-xl bg-stone-100/80 px-3 py-1.5 text-stone-800 font-mono font-semibold">
                <Clock className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                <span>
                  Distribution : {ev.halloween_start?.slice(0, 5)} – {ev.halloween_end?.slice(0, 5)}
                </span>
              </div>

              {isOutOfCandy && (
                <div className="rounded-xl bg-stone-100 border border-stone-300 p-3 text-stone-700 text-xs font-medium">
                  Le stock de bonbons est épuisé pour ce soir. La maison reste visible pour mémoire.
                </div>
              )}

              {ev.access_instructions && !isOutOfCandy && (
                <blockquote className="rounded-xl bg-amber-50/60 border-l-2 border-amber-500 px-3 py-2 text-stone-800 text-xs leading-relaxed italic">
                  « {ev.access_instructions} »
                </blockquote>
              )}
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="inline-flex items-center gap-2 rounded-xl bg-stone-100/80 px-3 py-1.5 text-stone-800 font-mono font-semibold">
                <Clock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>Illumination dès {ev.lighting_time?.slice(0, 5)}</span>
              </div>

              {(ev.participation_type === "hospitality" || ev.activity_label) && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                    <Gift className="h-3.5 w-3.5 text-rose-600" />
                    <span>{ev.activity_label || "Verrée & accueil"}</span>
                    {ev.event_start_time && (
                      <span className="font-mono text-[10px]">· dès {ev.event_start_time.slice(0, 5)}</span>
                    )}
                  </div>
                  {ev.hospitality_details && (
                    <p className="text-stone-700 text-xs leading-relaxed">
                      {ev.hospitality_details}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 pl-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => openPedestrianRoute(ev)}
            className="min-h-[40px] flex items-center justify-center gap-2 rounded-xl bg-stone-100 hover:bg-stone-200/80 text-stone-900 font-semibold text-xs px-3 border border-stone-200 transition shadow-sm"
          >
            <Navigation className="w-3.5 h-3.5 text-stone-700" />
            <span>Itinéraire à pied</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              triggerHaptic(18);
              onToggleVisited(ev.address_id);
            }}
            className={`min-h-[40px] flex items-center justify-center gap-2 rounded-xl font-semibold text-xs px-3 transition shadow-sm ${
              isVisited
                ? "bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold"
                : "bg-stone-900 hover:bg-stone-800 text-white shadow-stone-900/20"
            }`}
          >
            <Check className={`w-3.5 h-3.5 ${isVisited ? "text-emerald-700" : "text-white"}`} />
            <span>{isVisited ? "Visité !" : "Marquer visité"}</span>
          </motion.button>
        </div>

        <div className="pl-2">
          <a
            href={`/api/calendar/export?addressId=${ev.address_id}`}
            download
            className="w-full min-h-[38px] flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-stone-50 text-stone-800 font-semibold text-xs px-3 border border-stone-200 shadow-sm transition"
          >
            <Calendar className="w-3.5 h-3.5 text-stone-600" />
            <span>Ajouter à mon agenda (.ics)</span>
          </a>
        </div>
      </motion.div>
    );
  };

  // Liste des adresses avec interactivité cartographique bidirectionnelle
  const renderAddressList = () => (
    <div className="space-y-3">
      <div className="relative group">
        <Search className="w-4 h-4 text-stone-400 group-focus-within:text-stone-900 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher une rue, un n° de maison…"
          className="w-full h-10 rounded-2xl bg-white/90 border border-stone-200/90 pl-10 pr-9 text-xs text-stone-900 placeholder:text-stone-400 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] focus:bg-white focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <motion.div
        variants={listContainerVariants}
        initial="hidden"
        animate="show"
        className="space-y-2 max-h-[38dvh] md:max-h-[42dvh] overflow-y-auto custom-scrollbar pr-0.5"
      >
        {searchedEvents.length === 0 ? (
          <div className="rounded-2xl border border-stone-200/75 bg-white/70 p-6 text-xs text-stone-500 text-center">
            {officialSeason === "advent" && !adventPublished
              ? "Le calendrier définitif sera affiché ici dès sa publication par la commune."
              : "Aucune adresse ne correspond à votre recherche."}
          </div>
        ) : (
          searchedEvents.map((ev) => {
            const isVisited = visitedIds.includes(ev.address_id);
            const isOutOfCandy = Boolean(ev.out_of_candy);
            const isSelected = selectedEvent?.address_id === ev.address_id;
            const isHovered = hoveredAddressId === ev.address_id;
            const meters =
              userLocation != null
                ? computeDistanceMeters(userLocation, Number(ev.lng), Number(ev.lat))
                : null;

            return (
              <motion.button
                key={ev.address_id}
                variants={listItemVariants}
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.985 }}
                type="button"
                onMouseEnter={() => onHoverAddress?.(ev.address_id)}
                onMouseLeave={() => onHoverAddress?.(null)}
                onClick={() => {
                  triggerHaptic(12);
                  onSelectEvent(ev);
                  onChangeSnap("card");
                }}
                className={`group w-full flex items-center justify-between gap-3 rounded-2xl border p-3 text-left transition-all duration-200 ${
                  isSelected || isHovered
                    ? "border-stone-900 bg-white shadow-[0_8px_20px_-4px_rgba(28,25,23,0.12)] scale-[1.01]"
                    : "border-stone-200/80 bg-white/80 hover:border-stone-300 hover:bg-white hover:shadow-sm"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Badge numéro avec gradient et ombre */}
                  <div
                    className={`flex h-10 min-w-[40px] px-2.5 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-bold shadow-sm transition-transform group-hover:scale-105 ${
                      isVisited || isOutOfCandy
                        ? "bg-stone-100 text-stone-400 border border-stone-200"
                        : officialSeason === "halloween"
                        ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-orange-500/25"
                        : ev.participation_type === "hospitality"
                        ? "bg-gradient-to-br from-rose-600 to-red-800 text-white shadow-rose-600/25"
                        : "bg-gradient-to-br from-teal-600 to-emerald-700 text-white shadow-teal-600/25"
                    }`}
                  >
                    {officialSeason === "halloween" ? `N° ${ev.house_number}` : ev.day_number}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-semibold text-xs truncate ${
                          isVisited || isOutOfCandy
                            ? "text-stone-400 line-through decoration-stone-300"
                            : "text-stone-900"
                        }`}
                      >
                        {ev.street_name} {ev.house_number}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-stone-500">
                      <span className="font-mono">
                        {officialSeason === "halloween"
                          ? isOutOfCandy
                            ? "Stock épuisé"
                            : `${ev.halloween_start?.slice(0, 5)}–${ev.halloween_end?.slice(0, 5)}`
                          : `${ev.day_number} déc. · ${ev.lighting_time?.slice(0, 5)}`}
                      </span>

                      {officialSeason === "halloween" && ev.is_self_service && !isOutOfCandy && (
                        <span className="rounded-full bg-amber-100/80 border border-amber-300/80 px-2 py-0.2 text-[10px] font-semibold text-amber-900">
                          Libre-service
                        </span>
                      )}

                      {officialSeason === "advent" &&
                        (ev.activity_label || ev.participation_type === "hospitality") && (
                          <span className="rounded-full bg-rose-100/80 border border-rose-300/80 px-2 py-0.2 text-[10px] font-semibold text-rose-900 truncate max-w-[155px]">
                            {ev.activity_label || "Verrée"}
                          </span>
                        )}

                      {ev.is_accessible_step_free && (
                        <span className="text-[10px] opacity-75" title="Accès de plain-pied sans escaliers">♿</span>
                      )}
                      {ev.photo_url && (
                        <span className="text-[10px] opacity-75" title="Photo disponible">📷</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col items-end gap-0.5">
                    {meters != null && (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 font-mono text-[10px] font-bold text-stone-700">
                        {formatDistance(meters)}
                      </span>
                    )}
                    {isVisited && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        <span>Visité</span>
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-stone-900 group-hover:translate-x-0.5 transition-all" />
                </div>
              </motion.button>
            );
          })
        )}
      </motion.div>

      <div className="pt-2 pb-1 text-center">
        <Link
          href="/privacy"
          className="text-[11px] text-stone-500 hover:text-stone-800 underline underline-offset-2 transition"
        >
          Protection des données & vie privée (nLPD)
        </Link>
      </div>
    </div>
  );

  const statusSummary =
    officialSeason === "off_season"
      ? "Carte communale hors-saison"
      : officialSeason === "halloween"
      ? `${activeCount} foyers illuminés ce soir`
      : adventPublished
      ? `${events.length} fenêtres au parcours officiel`
      : "Inscriptions ouvertes — publication prochainement";

  return (
    <>
      {/* Panneau latéral flottant Desktop (Glassmorphism ultra-moderne) */}
      <motion.aside
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="hidden md:flex md:flex-col fixed top-5 left-5 max-h-[calc(100dvh-40px)] z-20 w-[400px] rounded-3xl border border-stone-900/[0.08] bg-[#FAF8F4]/90 backdrop-blur-2xl p-5 text-stone-900 shadow-[0_24px_60px_-15px_rgba(28,25,23,0.18)] overflow-hidden"
      >
        {/* En-tête avec badge suisse et indicateur EN DIRECT */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-stone-900/[0.08]">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500">
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-[#b91c1c] text-[9px] font-bold text-white shadow-sm">
                +
              </span>
              <span>Vufflens-la-Ville · 1302</span>
            </div>

            <h1 className="font-editorial text-[27px] leading-tight font-bold text-stone-900 pt-0.5">
              {officialSeason === "off_season" ? "Carte Communale" : theme.title}
            </h1>

            <div className="flex items-center gap-2 pt-0.5">
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    officialSeason === "halloween" ? "bg-orange-500" : "bg-emerald-600"
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    officialSeason === "halloween" ? "bg-orange-500" : "bg-emerald-600"
                  }`}
                />
              </span>
              <p className="text-xs font-semibold text-stone-600">{statusSummary}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/auth/lock"
              title="Verrouiller le site / Tester le code villageois"
              className="h-8 w-8 flex items-center justify-center rounded-full border border-stone-200 bg-white/80 hover:bg-stone-900 hover:text-white text-stone-500 shadow-sm transition-all"
            >
              <Lock className="w-3.5 h-3.5" />
            </a>
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-1.5 rounded-full border border-stone-300/90 bg-white/95 hover:bg-stone-900 hover:border-stone-900 hover:text-white px-3.5 py-1.5 text-xs font-semibold text-stone-800 shadow-sm transition-all duration-200"
            >
              <span>Espace habitant</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Corps défilable du panneau */}
        <div className="mt-4 space-y-3.5 flex-1 overflow-y-auto custom-scrollbar pr-0.5">
          {renderProgressTracker()}
          {renderQuickFilters()}

          <AnimatePresence mode="wait">
            {selectedEvent && renderSelectedCard(selectedEvent)}
          </AnimatePresence>

          <div className="pt-0.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400 mb-2 px-1">
              <span>Adresses ({searchedEvents.length})</span>
              <span>Survolez pour allumer la maison 3D</span>
            </div>
            {renderAddressList()}
          </div>
        </div>
      </motion.aside>

      {/* Tiroir tactile Mobile (Bottom Sheet fluide) */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.12}
        onDragEnd={handleDragEnd}
        animate={{ height: SNAP_HEIGHTS[snap] }}
        transition={springBounceTransition}
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl border-t border-stone-900/10 bg-[#FAF8F4]/95 backdrop-blur-2xl px-4 pt-2.5 pb-5 text-stone-900 shadow-[0_-16px_40px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden"
      >
        <button
          type="button"
          onClick={() =>
            onChangeSnap(snap === "collapsed" ? "expanded" : snap === "card" ? "expanded" : "collapsed")
          }
          className="w-full flex flex-col items-center justify-center py-1.5 focus:outline-none"
          aria-label="Déployer ou réduire"
        >
          <span className="h-1.5 w-12 rounded-full bg-stone-300" />
        </button>

        <div className="mt-1 flex items-center justify-between gap-2">
          <div
            onClick={() => onChangeSnap(snap === "collapsed" ? "expanded" : "collapsed")}
            className="flex-1 cursor-pointer"
          >
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
              <span className="inline-flex h-3 w-3 items-center justify-center rounded-[2px] bg-[#b91c1c] text-[8px] font-bold text-white">
                +
              </span>
              <span>Vufflens-la-Ville · {theme.badgeLabel}</span>
            </div>
            <div className="font-editorial text-lg font-bold text-stone-900 truncate">
              {officialSeason === "off_season" ? "Carte Communale" : theme.title}
            </div>
            <div className="text-xs text-stone-600 truncate">{statusSummary}</div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href="/auth/lock"
              title="Verrouiller et retester le code communal"
              className="h-9 w-9 flex items-center justify-center rounded-full bg-white border border-stone-300 text-stone-500 shadow-sm"
            >
              <Lock className="w-3.5 h-3.5" />
            </a>
            <Link
              href="/dashboard"
              className="min-h-[38px] inline-flex items-center gap-1 rounded-full bg-white border border-stone-300 px-3.5 text-xs font-semibold text-stone-800 shadow-sm"
            >
              <span>Habitant</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => onChangeSnap(snap === "expanded" ? "collapsed" : "expanded")}
            className="h-10 w-10 flex items-center justify-center rounded-full bg-white border border-stone-300 text-stone-700 shadow-sm"
            aria-label="Afficher la liste"
          >
            <ChevronUp
              className={`w-4 h-4 transition-transform duration-300 ${
                snap === "expanded" ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        <div className="mt-3.5 space-y-3.5 overflow-y-auto custom-scrollbar flex-1 pb-4">
          {renderProgressTracker()}
          {renderQuickFilters()}
          {selectedEvent && renderSelectedCard(selectedEvent)}
          {snap === "expanded" && renderAddressList()}
        </div>
      </motion.div>
    </>
  );
}
