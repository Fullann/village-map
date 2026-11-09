"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { motion, AnimatePresence } from "framer-motion";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Compass,
  LocateFixed,
  RotateCcw,
  Box,
  Plus,
  Minus,
  Layers,
  Route,
  Sparkles,
  Moon,
  Sun,
  Play,
  Square,
  AlertTriangle,
  Megaphone,
  Bell,
  X,
} from "lucide-react";
import FloatingMarker from "@/components/map/FloatingMarker";
import AtmosphericParticles from "@/components/map/AtmosphericParticles";
import MobileDrawer, {
  computeDistanceMeters,
  type DrawerSnap,
} from "@/components/map/MobileDrawer";
import { SEASON_THEMES, triggerHaptic } from "@/lib/themeTokens";
import { toggleOutOfCandyAction } from "@/app/actions/halloween";
import type { SeasonMode, VillageMapEvent, CommunalAlert, MyHalloweenStatus } from "@/types";

export interface Map3DContainerProps {
  initialSeason: SeasonMode;
  adventPublished?: boolean;
  adventOpensAt?: string;
  events: VillageMapEvent[];
  villageCenter: [number, number];
  villageBounds: [[number, number], [number, number]];
  mapStyle?: string;
  initialAlert?: CommunalAlert | null;
  myHalloweenStatus?: MyHalloweenStatus | null;
}

const VISITED_KEY = "village_visited_addresses_v1";
const OFFLINE_EVENTS_KEY = "village_offline_events_cache_v1";
const BUILDINGS_GEOJSON_URL = "/data/vufflens-buildings-3d.geojson";

// Style cartographique combinant Plan Cadastral Clair + Orthophoto Aérienne officielle Swisstopo (swissimage)
const BASE_MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "osm-raster": {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap · swissBUILDINGS3D & SWISSIMAGE Swisstopo · Vufflens-la-Ville",
    },
    "swisstopo-aerial": {
      type: "raster",
      tiles: [
        "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg",
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution: "© swisstopo SWISSIMAGE",
    },
  },
  layers: [
    {
      id: "osm-paper",
      type: "raster",
      source: "osm-raster",
      paint: {
        "raster-saturation": -0.78,
        "raster-contrast": -0.05,
        "raster-brightness-min": 0.16,
        "raster-brightness-max": 0.98,
      },
    },
    {
      id: "swisstopo-aerial-layer",
      type: "raster",
      source: "swisstopo-aerial",
      layout: {
        visibility: "none",
      },
      paint: {
        "raster-opacity": 0.92,
      },
    },
  ],
};

function isActiveNow(start?: string | null, end?: string | null) {
  if (!start || !end) return true;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return cur >= sh * 60 + sm && cur <= eh * 60 + em;
}

function sanitizeCenter(c: [number, number]): [number, number] {
  const lng = Number(c?.[0]);
  const lat = Number(c?.[1]);
  if (Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    return [lng, lat];
  }
  return [6.5364, 46.5822];
}

function sanitizeBounds(
  b: [[number, number], [number, number]],
  center: [number, number]
): [[number, number], [number, number]] {
  const swLng = Number(b?.[0]?.[0]);
  const swLat = Number(b?.[0]?.[1]);
  const neLng = Number(b?.[1]?.[0]);
  const neLat = Number(b?.[1]?.[1]);
  if (
    Number.isFinite(swLng) &&
    Number.isFinite(swLat) &&
    Number.isFinite(neLng) &&
    Number.isFinite(neLat) &&
    swLng < neLng &&
    swLat < neLat
  ) {
    const padLng = Math.max((neLng - swLng) * 0.65, 0.035);
    const padLat = Math.max((neLat - swLat) * 0.65, 0.035);
    return [
      [swLng - padLng, swLat - padLat],
      [neLng + padLng, neLat + padLat],
    ];
  }
  return [
    [center[0] - 0.04, center[1] - 0.04],
    [center[0] + 0.04, center[1] + 0.04],
  ];
}

/** Construit un itinéraire pédestre ordonné */
function buildWalkingRouteCoords(
  events: VillageMapEvent[],
  season: "halloween" | "advent",
  visitedIds: string[],
  startPoint: [number, number]
): [number, number][] {
  if (season === "advent") {
    return [...events]
      .filter((e) => typeof e.day_number === "number")
      .sort((a, b) => (a.day_number ?? 99) - (b.day_number ?? 99))
      .map((e) => [Number(e.lng), Number(e.lat)]);
  }

  const remaining = events.filter(
    (e) => !visitedIds.includes(e.address_id) && !e.out_of_candy
  );
  const pool = remaining.length >= 2 ? [...remaining] : [...events];
  const coords: [number, number][] = [];
  let current: [number, number] = startPoint;

  while (pool.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < pool.length; i++) {
      const d = computeDistanceMeters(current, Number(pool[i].lng), Number(pool[i].lat));
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = pool.splice(bestIdx, 1)[0];
    current = [Number(next.lng), Number(next.lat)];
    coords.push(current);
  }
  return coords;
}

export default function Map3DContainer({
  initialSeason,
  adventPublished = true,
  adventOpensAt = "2026-11-01",
  events,
  villageCenter,
  villageBounds,
  initialAlert = null,
  myHalloweenStatus = null,
}: Map3DContainerProps) {
  const safeCenter = useMemo(() => sanitizeCenter(villageCenter), [villageCenter]);
  const safeBounds = useMemo(() => sanitizeBounds(villageBounds, safeCenter), [villageBounds, safeCenter]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerInstancesRef = useRef<Array<{ marker: maplibregl.Marker; root: Root }>>([]);
  const buildingsGeoJsonRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const tourTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeLayer: "halloween" | "advent" =
    initialSeason === "advent" ? "advent" : "halloween";

  const [offlineEvents, setOfflineEvents] = useState<VillageMapEvent[]>(events);
  const [selectedEvent, setSelectedEvent] = useState<VillageMapEvent | null>(null);
  const [hoveredAddressId, setHoveredAddressId] = useState<string | null>(null);
  const [drawerSnap, setDrawerSnap] = useState<DrawerSnap>("collapsed");
  const [visitedIds, setVisitedIds] = useState<string[]>([]);
  const [filterActiveNow, setFilterActiveNow] = useState(false);
  const [filterSelfService, setFilterSelfService] = useState(false);
  const [is3DPitch, setIs3DPitch] = useState(true);
  const [aerialView, setAerialView] = useState(false);
  const [showRouteLoop, setShowRouteLoop] = useState(false);
  const [magicAtmosphere, setMagicAtmosphere] = useState(true);
  const [nightAmbiance, setNightAmbiance] = useState(false);
  const [tourIndex, setTourIndex] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [liveToast, setLiveToast] = useState<{ message: string; id: number } | null>(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Alerte communale en direct & état bonbons de l'habitant
  const [communalAlert, setCommunalAlert] = useState<CommunalAlert | null>(initialAlert);
  const [dismissedAlertId, setDismissedAlertId] = useState<string | null>(null);
  const [myCandyState, setMyCandyState] = useState<MyHalloweenStatus | null>(myHalloweenStatus);
  const [isTogglingCandy, setIsTogglingCandy] = useState(false);

  const handleToggleMyCandy = async () => {
    if (!myCandyState || isTogglingCandy) return;
    setIsTogglingCandy(true);
    triggerHaptic(20);
    const nextState = !myCandyState.outOfCandy;
    // Optimistic update immédiat
    setMyCandyState({ ...myCandyState, outOfCandy: nextState });

    try {
      await toggleOutOfCandyAction();
      setLiveToast({
        message: nextState
          ? "🚫 Votre maison est signalée en rupture pour ce soir."
          : "🎉 Distribution de bonbons réactivée !",
        id: Date.now(),
      });
    } catch {
      // Annulation en cas d'erreur
      setMyCandyState({ ...myCandyState, outOfCandy: !nextState });
    } finally {
      setIsTogglingCandy(false);
    }
  };

  const theme = SEASON_THEMES[activeLayer];

  // Enregistrement Service Worker PWA + Cache hors-ligne des adresses
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VISITED_KEY);
      if (saved) setVisitedIds(JSON.parse(saved));

      if (events.length > 0) {
        localStorage.setItem(OFFLINE_EVENTS_KEY, JSON.stringify(events));
        setOfflineEvents(events);
      } else {
        const cached = localStorage.getItem(OFFLINE_EVENTS_KEY);
        if (cached) setOfflineEvents(JSON.parse(cached));
      }
    } catch {
      /* ignore */
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, [events]);

  // Connexion temps réel SSE (Server-Sent Events) pour la soirée d'Halloween
  useEffect(() => {
    if (typeof window === "undefined" || !("EventSource" in window)) return;

    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/events/live");

      es.onopen = () => {
        setIsLiveConnected(true);
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "candy_update") {
            setOfflineEvents((prev) =>
              prev.map((ev) =>
                ev.address_id === data.addressId ? { ...ev, out_of_candy: data.outOfCandy } : ev
              )
            );
            setSelectedEvent((prev) =>
              prev && prev.address_id === data.addressId
                ? { ...prev, out_of_candy: data.outOfCandy }
                : prev
            );
            const msg = data.outOfCandy
              ? `🍬 Plus de bonbons : ${data.streetName || "Une maison"} ${data.houseNumber || ""}`
              : `🎉 Bonbons à nouveau disponibles ! (${data.streetName || ""} ${data.houseNumber || ""})`;
            setLiveToast({ message: msg, id: Date.now() });
            triggerHaptic(15);
          } else if (data.type === "communal_alert") {
            if (data.active) {
              setCommunalAlert({
                id: data.id || `live-${Date.now()}`,
                level: data.level,
                title: data.title,
                message: data.message,
                created_at: data.timestamp,
              });
              setDismissedAlertId(null);
              triggerHaptic(30);
            } else {
              setCommunalAlert(null);
            }
          }
        } catch {
          /* ignore parse error */
        }
      };

      es.onerror = () => {
        setIsLiveConnected(false);
      };
    } catch {
      /* ignore */
    }

    return () => {
      if (es) es.close();
    };
  }, []);

  useEffect(() => {
    if (!liveToast) return;
    const timer = setTimeout(() => setLiveToast(null), 4500);
    return () => clearTimeout(timer);
  }, [liveToast]);

  const toggleVisited = useCallback((addressId: string) => {
    setVisitedIds((prev) => {
      const next = prev.includes(addressId)
        ? prev.filter((id) => id !== addressId)
        : [...prev, addressId];
      try {
        localStorage.setItem(VISITED_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const filteredEvents = useMemo(() => {
    if (initialSeason === "off_season") return [];
    if (initialSeason === "advent" && !adventPublished) return [];

    return offlineEvents.filter((ev) => {
      if (activeLayer === "halloween") {
        if (!ev.is_distributing) return false;
        if (filterSelfService && !ev.is_self_service) return false;
        if (filterActiveNow && (!isActiveNow(ev.halloween_start, ev.halloween_end) || ev.out_of_candy)) {
          return false;
        }
        return true;
      }
      return typeof ev.day_number === "number";
    });
  }, [offlineEvents, initialSeason, adventPublished, activeLayer, filterActiveNow, filterSelfService]);

  const updateBuildings3DSource = useCallback(() => {
    const map = mapRef.current;
    const baseGeo = buildingsGeoJsonRef.current;
    if (!map || !baseGeo) return;

    const src = map.getSource("vufflens-buildings") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    const activeByAddress = new Map<string, VillageMapEvent>();
    for (const ev of filteredEvents) {
      activeByAddress.set(ev.address_id, ev);
    }

    const enriched: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: baseGeo.features.map((f) => {
        const addrId = f.properties?.address_id as string | null;
        const ev = addrId ? activeByAddress.get(addrId) : undefined;
        const isParticipant = Boolean(ev);
        const isOutOfCandy = Boolean(ev?.out_of_candy);
        const isVisited = Boolean(addrId && visitedIds.includes(addrId));
        const isSelected = Boolean(addrId && selectedEvent?.address_id === addrId);
        const isHovered = Boolean(addrId && hoveredAddressId === addrId);
        const isSpecial =
          activeLayer === "halloween"
            ? Boolean(ev?.is_self_service)
            : ev?.participation_type === "hospitality";

        const baseH = Number(f.properties?.height ?? 8);
        const extrusionH = isHovered
          ? baseH + 3.5
          : isSelected
          ? baseH + 2.5
          : isParticipant
          ? baseH + 1.5
          : baseH;

        return {
          ...f,
          properties: {
            ...f.properties,
            is_participant: isParticipant,
            is_out_of_candy: isOutOfCandy,
            is_visited: isVisited,
            is_selected: isSelected,
            is_hovered: isHovered,
            is_special: isSpecial,
            extrusion_height: extrusionH,
          },
        };
      }),
    };

    src.setData(enriched);
  }, [filteredEvents, visitedIds, selectedEvent, hoveredAddressId, activeLayer]);

  const updateWalkingRouteSource = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const routeSrc = map.getSource("vufflens-walk-route") as maplibregl.GeoJSONSource | undefined;
    if (!routeSrc) return;

    if (!showRouteLoop || filteredEvents.length < 2) {
      routeSrc.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    const coords = buildWalkingRouteCoords(
      filteredEvents,
      activeLayer,
      visitedIds,
      userLocation ?? safeCenter
    );

    routeSrc.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: coords,
          },
        },
      ],
    });
  }, [showRouteLoop, filteredEvents, activeLayer, visitedIds, userLocation, safeCenter]);

  const handleSelectEvent = useCallback((ev: VillageMapEvent | null) => {
    setSelectedEvent(ev);
    if (ev) {
      setDrawerSnap("card");
      const map = mapRef.current;
      if (map) {
        map.flyTo({
          center: [Number(ev.lng), Number(ev.lat)],
          zoom: 18.2,
          pitch: 58,
          bearing: -18,
          duration: 1200,
          essential: true,
        });
      }
    }
  }, []);

  // Visite guidée automatique en hélicoptère 3D
  const toggleTour = useCallback(() => {
    if (tourIndex !== null) {
      if (tourTimerRef.current) clearTimeout(tourTimerRef.current);
      setTourIndex(null);
      return;
    }

    if (filteredEvents.length === 0) return;
    triggerHaptic(15);
    setTourIndex(0);

    const stepTour = (idx: number) => {
      const nextEv = filteredEvents[idx];
      if (!nextEv) {
        setTourIndex(null);
        return;
      }
      handleSelectEvent(nextEv);

      tourTimerRef.current = setTimeout(() => {
        const nextIdx = (idx + 1) % filteredEvents.length;
        setTourIndex(nextIdx);
        stepTour(nextIdx);
      }, 4200);
    };

    stepTour(0);
  }, [tourIndex, filteredEvents, handleSelectEvent]);

  useEffect(() => {
    return () => {
      if (tourTimerRef.current) clearTimeout(tourTimerRef.current);
    };
  }, []);

  // Initialisation MapLibre
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const isMobile = window.innerWidth < 768;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_MAP_STYLE,
      center: safeCenter,
      zoom: isMobile ? 15.6 : 16.0,
      pitch: isMobile ? 38 : 42,
      bearing: -6,
      maxPitch: 70,
      maxBounds: safeBounds,
    });

    map.on("load", async () => {
      try {
        map.addSource("vufflens-walk-route", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: "vufflens-walk-route-casing",
          type: "line",
          source: "vufflens-walk-route",
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#FAF8F4",
            "line-width": 6,
            "line-opacity": 0.9,
          },
        });

        map.addLayer({
          id: "vufflens-walk-route-line",
          type: "line",
          source: "vufflens-walk-route",
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": theme.accentHex,
            "line-width": 3,
            "line-dasharray": [2, 2],
            "line-opacity": 0.95,
          },
        });

        const res = await fetch(BUILDINGS_GEOJSON_URL);
        const geojson = (await res.json()) as GeoJSON.FeatureCollection;
        buildingsGeoJsonRef.current = geojson;

        map.addSource("vufflens-buildings", {
          type: "geojson",
          data: geojson,
        });

        map.addLayer({
          id: "vufflens-buildings-glow",
          type: "fill",
          source: "vufflens-buildings",
          filter: ["==", ["get", "is_participant"], true],
          paint: {
            "fill-color": theme.buildingFootprintHalo,
            "fill-opacity": 0.45,
          },
        });

        map.addLayer({
          id: "vufflens-buildings-3d",
          type: "fill-extrusion",
          source: "vufflens-buildings",
          paint: {
            "fill-extrusion-color": [
              "case",
              ["boolean", ["get", "is_hovered"], false],
              "#f59e0b", // Jaune doré rayonnant au survol
              ["boolean", ["get", "is_selected"], false],
              "#18181b",
              ["boolean", ["get", "is_out_of_candy"], false],
              "#78716c",
              ["boolean", ["get", "is_visited"], false],
              theme.buildingVisitedColor,
              ["boolean", ["get", "is_participant"], false],
              [
                "case",
                ["boolean", ["get", "is_special"], false],
                theme.buildingSpecialColor,
                theme.buildingActiveColor,
              ],
              theme.buildingDefaultColor,
            ],
            "fill-extrusion-height": [
              "coalesce",
              ["get", "extrusion_height"],
              ["get", "height"],
              ["*", ["coalesce", ["get", "levels"], 2], 3.2],
            ],
            "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
            "fill-extrusion-opacity": 0.92,
            "fill-extrusion-vertical-gradient": true,
          },
        });

        map.on("click", "vufflens-buildings-3d", (e) => {
          const feat = e.features?.[0];
          const addrId = feat?.properties?.address_id;
          if (!addrId) return;
          const found = offlineEvents.find((ev) => ev.address_id === addrId);
          if (found) {
            triggerHaptic(12);
            handleSelectEvent(found);
          }
        });

        map.on("mouseenter", "vufflens-buildings-3d", (e) => {
          if (e.features?.[0]?.properties?.is_participant) {
            map.getCanvas().style.cursor = "pointer";
            const addrId = e.features?.[0]?.properties?.address_id;
            if (addrId) setHoveredAddressId(addrId);
          }
        });
        map.on("mouseleave", "vufflens-buildings-3d", () => {
          map.getCanvas().style.cursor = "";
          setHoveredAddressId(null);
        });

        updateBuildings3DSource();
        updateWalkingRouteSource();

        // Mouvement d'introduction cinématique doux au chargement
        map.easeTo({
          zoom: isMobile ? 15.8 : 16.35,
          pitch: isMobile ? 52 : 56,
          bearing: -15,
          duration: 1400,
        });
      } catch (err) {
        console.error("Erreur de chargement du bâti 3D :", err);
      }
    });

    mapRef.current = map;

    return () => {
      markerInstancesRef.current.forEach(({ marker, root }) => {
        marker.remove();
        setTimeout(() => root.unmount(), 0);
      });
      markerInstancesRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeCenter, safeBounds]);

  // Synchronisation des calques et couleurs
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    updateBuildings3DSource();
    updateWalkingRouteSource();

    if (map.getLayer("vufflens-buildings-3d")) {
      const defaultBld = nightAmbiance ? "#292524" : theme.buildingDefaultColor;
      const activeBld = nightAmbiance ? "#f59e0b" : theme.buildingActiveColor;
      const specialBld = nightAmbiance ? "#fb923c" : theme.buildingSpecialColor;

      map.setPaintProperty("vufflens-buildings-3d", "fill-extrusion-color", [
        "case",
        ["boolean", ["get", "is_hovered"], false],
        "#fbbf24",
        ["boolean", ["get", "is_selected"], false],
        "#ffffff",
        ["boolean", ["get", "is_out_of_candy"], false],
        "#57534e",
        ["boolean", ["get", "is_visited"], false],
        theme.buildingVisitedColor,
        ["boolean", ["get", "is_participant"], false],
        [
          "case",
          ["boolean", ["get", "is_special"], false],
          specialBld,
          activeBld,
        ],
        defaultBld,
      ]);
    }

    if (map.getLayer("vufflens-buildings-glow")) {
      map.setPaintProperty(
        "vufflens-buildings-glow",
        "fill-color",
        nightAmbiance ? "#f97316" : theme.buildingFootprintHalo
      );
      map.setPaintProperty(
        "vufflens-buildings-glow",
        "fill-opacity",
        nightAmbiance ? 0.75 : 0.45
      );
    }

    if (map.getLayer("osm-paper")) {
      map.setPaintProperty(
        "osm-paper",
        "raster-brightness-max",
        nightAmbiance ? 0.38 : 0.98
      );
      map.setPaintProperty(
        "osm-paper",
        "raster-brightness-min",
        nightAmbiance ? 0.05 : 0.16
      );
      map.setPaintProperty(
        "osm-paper",
        "raster-saturation",
        nightAmbiance ? -0.95 : -0.78
      );
    }

    if (map.getLayer("vufflens-walk-route-line")) {
      map.setPaintProperty("vufflens-walk-route-line", "line-color", theme.accentHex);
    }
  }, [theme, nightAmbiance, updateBuildings3DSource, updateWalkingRouteSource]);

  // Synchronisation des marqueurs 3D
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markerInstancesRef.current.forEach(({ marker, root }) => {
      marker.remove();
      setTimeout(() => root.unmount(), 0);
    });
    markerInstancesRef.current = [];

    filteredEvents.forEach((ev) => {
      const lng = Number(ev.lng);
      const lat = Number(ev.lat);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

      const host = document.createElement("div");
      host.className = "z-20";
      const root = createRoot(host);

      const activeTonight =
        activeLayer === "halloween"
          ? isActiveNow(ev.halloween_start, ev.halloween_end) && !ev.out_of_candy
          : true;

      root.render(
        <FloatingMarker
          event={ev}
          season={activeLayer}
          isVisited={visitedIds.includes(ev.address_id)}
          isSelected={selectedEvent?.address_id === ev.address_id}
          isHoveredFromList={hoveredAddressId === ev.address_id}
          isActiveTonight={activeTonight}
          onSelect={handleSelectEvent}
        />
      );

      const marker = new maplibregl.Marker({
        element: host,
        anchor: "bottom",
        offset: [0, -10],
      })
        .setLngLat([lng, lat])
        .addTo(map);

      markerInstancesRef.current.push({ marker, root });
    });
  }, [filteredEvents, activeLayer, visitedIds, selectedEvent, hoveredAddressId, handleSelectEvent]);

  const toggle3DView = () => {
    const map = mapRef.current;
    if (!map) return;
    triggerHaptic(10);
    const next3D = !is3DPitch;
    setIs3DPitch(next3D);
    map.easeTo({ pitch: next3D ? 56 : 0, bearing: next3D ? -15 : 0, duration: 700 });
  };

  const toggleSwisstopoAerial = () => {
    const map = mapRef.current;
    if (!map) return;
    triggerHaptic(10);
    const nextAerial = !aerialView;
    setAerialView(nextAerial);
    if (map.getLayer("swisstopo-aerial-layer")) {
      map.setLayoutProperty(
        "swisstopo-aerial-layer",
        "visibility",
        nextAerial ? "visible" : "none"
      );
    }
  };

  const toggleNightAmbiance = () => {
    triggerHaptic(12);
    setNightAmbiance((v) => !v);
  };

  const resetCameraToVufflens = () => {
    const map = mapRef.current;
    if (!map) return;
    triggerHaptic(10);
    setSelectedEvent(null);
    map.flyTo({ center: safeCenter, zoom: 16.3, pitch: 56, bearing: -15, duration: 1050 });
  };

  const locateWalker = useCallback(() => {
    triggerHaptic(10);
    if (!("geolocation" in navigator)) {
      setUserLocation(safeCenter);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setUserLocation(coords);
        mapRef.current?.flyTo({
          center: coords,
          zoom: 17.4,
          pitch: 56,
          duration: 1100,
        });
      },
      () => {
        setUserLocation(safeCenter);
        resetCameraToVufflens();
      },
      { enableHighAccuracy: true }
    );
  }, [safeCenter]);

  // Raccourcis clavier ergonomiques Desktop (Échap pour fermer, C pour recentrer, N pour nuit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "Escape") {
        setSelectedEvent(null);
        setHoveredAddressId(null);
      } else if (e.key === "c" || e.key === "C") {
        resetCameraToVufflens();
      } else if (e.key === "n" || e.key === "N") {
        toggleNightAmbiance();
      } else if (e.key === "+" || e.key === "=") {
        mapRef.current?.zoomIn();
      } else if (e.key === "-" || e.key === "_") {
        mapRef.current?.zoomOut();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [safeCenter]);

  return (
    <div
      className={`relative w-full h-[100dvh] overflow-hidden select-none transition-colors duration-700 ${
        nightAmbiance ? "bg-[#141210]" : "bg-[#EAE6DF]"
      }`}
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* 📢 Bannière d'Alerte Communale en direct (SSE) */}
      <AnimatePresence>
        {communalAlert && communalAlert.id !== dismissedAlertId && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="fixed top-3 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-xl z-50 pointer-events-auto"
          >
            <div
              className={`rounded-2xl border p-4 shadow-2xl backdrop-blur-2xl flex items-start gap-3.5 text-white ${
                communalAlert.level === "urgent"
                  ? "bg-red-950/95 border-red-500/60 shadow-red-950/40"
                  : communalAlert.level === "warning"
                  ? "bg-amber-950/95 border-amber-500/60 shadow-amber-950/40"
                  : "bg-stone-950/95 border-sky-500/60 shadow-stone-950/40"
              }`}
            >
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  communalAlert.level === "urgent"
                    ? "bg-red-500/20 text-red-400"
                    : communalAlert.level === "warning"
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-sky-500/20 text-sky-400"
                }`}
              >
                {communalAlert.level === "urgent" ? (
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                ) : (
                  <Megaphone className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      communalAlert.level === "urgent"
                        ? "bg-red-500 text-white"
                        : communalAlert.level === "warning"
                        ? "bg-amber-500 text-stone-950"
                        : "bg-sky-500 text-white"
                    }`}
                  >
                    Flash Commune
                  </span>
                  <span className="text-xs font-bold text-white truncate">
                    {communalAlert.title}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-200 leading-relaxed break-words font-medium">
                  {communalAlert.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDismissedAlertId(communalAlert.id)}
                className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition shrink-0"
                aria-label="Masquer l'alerte"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🍬 Bouton d'action rapide d'Halloween pour l'habitant connecté (1 clic direct sur la carte) */}
      {activeLayer === "halloween" && myCandyState?.isRegistered && myCandyState?.isDistributing && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-md pointer-events-auto"
        >
          <div
            className={`rounded-2xl border p-2.5 shadow-xl backdrop-blur-2xl flex items-center justify-between gap-2.5 transition-all ${
              myCandyState.outOfCandy
                ? "bg-stone-900/90 border-stone-700/80 text-stone-200"
                : "bg-amber-950/90 border-amber-500/50 text-amber-100"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 pl-1.5">
              <span className="text-base shrink-0">
                {myCandyState.outOfCandy ? "🚫" : "🍬"}
              </span>
              <div className="truncate">
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                  Votre maison ({myCandyState.addressLabel})
                </div>
                <div className="text-xs font-bold text-white truncate">
                  {myCandyState.outOfCandy ? "Stock signalé épuisé" : "Distribution active"}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={isTogglingCandy}
              onClick={handleToggleMyCandy}
              className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold shadow-md transition-all active:scale-95 ${
                myCandyState.outOfCandy
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-red-600 hover:bg-red-500 text-white animate-pulse"
              }`}
            >
              {isTogglingCandy
                ? "Envoi..."
                : myCandyState.outOfCandy
                ? "Réactiver"
                : "Plus de bonbons !"}
            </button>
          </div>
        </motion.div>
      )}

      {/* Toast de notification temps réel (SSE) */}
      <AnimatePresence>
        {liveToast && (
          <motion.div
            key={liveToast.id}
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-stone-950/90 backdrop-blur-xl px-4 py-2 text-xs font-semibold text-white shadow-2xl">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span>{liveToast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Badge statut Live en haut à droite */}
      {isLiveConnected && (
        <div
          className="hidden sm:flex items-center gap-1.5 fixed top-4 right-4 z-20 rounded-full border border-stone-200/60 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md px-2.5 py-1 text-[11px] font-medium text-stone-600 dark:text-stone-300 shadow-sm"
          title="Carte connectée en direct aux mises à jour du village"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span>En direct</span>
        </div>
      )}

      {/* Particules atmosphériques magiques (braises pour Halloween, neige pour l'Avent) */}
      <AtmosphericParticles season={activeLayer} enabled={magicAtmosphere} />

      {/* Vignette atmosphérique cinématique */}
      <div
        className={`pointer-events-none fixed inset-0 z-10 transition-opacity duration-700 ${
          nightAmbiance
            ? "shadow-[inset_0_0_120px_rgba(0,0,0,0.65)]"
            : "shadow-[inset_0_0_90px_rgba(28,25,23,0.08)]"
        }`}
      />

      {/* Dock flottant en bas au centre (Desktop) : Calques, Nuit, Ambiance, Visite guidée */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="hidden lg:flex items-center gap-2.5 fixed bottom-6 left-[calc(50%+155px)] -translate-x-1/2 z-20 rounded-full border border-white/60 bg-[#FAF8F4]/90 dark:bg-stone-900/90 backdrop-blur-2xl px-3.5 py-2 shadow-[0_16px_36px_-8px_rgba(0,0,0,0.22)]"
      >
        {/* Bascule Plan clair / Photo Swisstopo */}
        <div className="flex items-center rounded-full bg-stone-200/70 p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              if (aerialView) toggleSwisstopoAerial();
            }}
            className={`rounded-full px-3 py-1 transition-all ${
              !aerialView
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            Plan
          </button>
          <button
            type="button"
            onClick={() => {
              if (!aerialView) toggleSwisstopoAerial();
            }}
            className={`rounded-full px-3 py-1 transition-all ${
              aerialView
                ? "bg-stone-900 text-white shadow-sm"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            Photo aérienne
          </button>
        </div>

        <span className="h-4 w-[1px] bg-stone-300/80" />

        {/* Bouton Mode Nuit / Ambiance Soirée */}
        <button
          type="button"
          onClick={toggleNightAmbiance}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
            nightAmbiance
              ? "bg-amber-400 text-stone-950 shadow-md shadow-amber-400/20"
              : "text-stone-700 hover:bg-stone-100"
          }`}
          title="Activer l'ambiance nocturne (les maisons s'illuminent comme des lanternes)"
        >
          {nightAmbiance ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5 text-amber-600" />}
          <span>{nightAmbiance ? "Mode Jour" : "Ambiance Nuit"}</span>
        </button>

        {/* Bouton Particules magiques */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic(10);
            setMagicAtmosphere((v) => !v);
          }}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
            magicAtmosphere
              ? "bg-stone-900 text-white shadow-sm"
              : "text-stone-700 hover:bg-stone-100"
          }`}
          title="Activer les braises magiques ou les flocons qui flottent sur le village"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>Effet magique</span>
        </button>

        {/* Bouton Visite guidée automatique */}
        <button
          type="button"
          onClick={toggleTour}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
            tourIndex !== null
              ? "bg-rose-600 text-white shadow-md animate-pulse"
              : "text-stone-700 hover:bg-stone-100"
          }`}
          title="Lancer le survol automatique de toutes les maisons ouvertes"
        >
          {tourIndex !== null ? (
            <>
              <Square className="w-3.5 h-3.5 fill-white" />
              <span>Arrêter le vol</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Survol guidé</span>
            </>
          )}
        </button>
      </motion.div>

      {/* Pods de navigation 3D flottants en haut à droite */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-5 right-5 z-20 flex flex-col gap-2.5"
      >
        {/* Pod 1 : Zoom */}
        <div className="flex flex-col divide-y divide-stone-200/80 rounded-2xl border border-white/60 bg-[#FAF8F4]/90 backdrop-blur-2xl shadow-[0_12px_32px_-6px_rgba(0,0,0,0.18)] overflow-hidden">
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn({ duration: 250 })}
            className="h-10 w-10 flex items-center justify-center text-stone-700 hover:bg-white hover:text-stone-950 transition"
            title="Zoomer"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut({ duration: 250 })}
            className="h-10 w-10 flex items-center justify-center text-stone-700 hover:bg-white hover:text-stone-950 transition"
            title="Dézoomer"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        {/* Pod 2 : Calques, 3D, Rotation & Géolocalisation */}
        <div className="flex flex-col divide-y divide-stone-200/80 rounded-2xl border border-white/60 bg-[#FAF8F4]/90 backdrop-blur-2xl shadow-[0_12px_32px_-6px_rgba(0,0,0,0.18)] overflow-hidden">
          <button
            type="button"
            onClick={toggleSwisstopoAerial}
            className={`h-10 w-10 flex items-center justify-center transition ${
              aerialView
                ? "bg-stone-900 text-white"
                : "text-stone-700 hover:bg-white hover:text-stone-950"
            }`}
            title="Vue aérienne Swisstopo (SWISSIMAGE)"
          >
            <Layers className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              setShowRouteLoop((v) => !v);
            }}
            className={`h-10 w-10 flex items-center justify-center transition ${
              showRouteLoop
                ? "bg-stone-900 text-white"
                : "text-stone-700 hover:bg-white hover:text-stone-950"
            }`}
            title="Tracé de la boucle pédestre"
          >
            <Route className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggle3DView}
            className={`h-10 w-10 flex items-center justify-center text-xs font-bold transition ${
              is3DPitch
                ? "bg-stone-900 text-white"
                : "text-stone-700 hover:bg-white hover:text-stone-950"
            }`}
            title="Basculer inclinaison 3D / 2D"
          >
            <Box className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() =>
              mapRef.current?.easeTo({
                bearing: (mapRef.current.getBearing() || 0) + 45,
                duration: 400,
              })
            }
            className="h-10 w-10 flex items-center justify-center text-stone-700 hover:bg-white hover:text-stone-950 transition"
            title="Pivoter la caméra de 45°"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={resetCameraToVufflens}
            className="h-10 w-10 flex items-center justify-center text-stone-700 hover:bg-white hover:text-stone-950 transition"
            title="Recentrer sur Vufflens-la-Ville"
          >
            <Compass className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={locateWalker}
            className={`h-10 w-10 flex items-center justify-center transition ${
              userLocation
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-stone-700 hover:bg-white hover:text-stone-950"
            }`}
            title="Ma position GPS & distances en mètres"
          >
            <LocateFixed className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Tiroir / Panneau latéral avec support du survol bidirectionnel */}
      <MobileDrawer
        officialSeason={initialSeason}
        adventPublished={adventPublished}
        adventOpensAt={adventOpensAt}
        events={filteredEvents}
        selectedEvent={selectedEvent}
        onSelectEvent={handleSelectEvent}
        hoveredAddressId={hoveredAddressId}
        onHoverAddress={setHoveredAddressId}
        visitedIds={visitedIds}
        onToggleVisited={toggleVisited}
        filterActiveNow={filterActiveNow}
        onToggleFilterActiveNow={() => setFilterActiveNow((v) => !v)}
        filterSelfService={filterSelfService}
        onToggleFilterSelfService={() => setFilterSelfService((v) => !v)}
        userLocation={userLocation}
        onRequestLocation={locateWalker}
        showRouteLoop={showRouteLoop}
        onToggleRouteLoop={() => setShowRouteLoop((v) => !v)}
        snap={drawerSnap}
        onChangeSnap={setDrawerSnap}
      />
    </div>
  );
}
