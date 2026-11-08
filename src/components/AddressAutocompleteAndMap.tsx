"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface AddressOption {
  id: string;
  street_name: string;
  house_number: string;
  lng: number;
  lat: number;
}

interface Props {
  addresses: AddressOption[];
}

export function AddressAutocompleteAndMap({ addresses }: Props) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [queryText, setQueryText] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [showMiniMap, setShowMiniMap] = useState<boolean>(true);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === selectedId) ?? null,
    [addresses, selectedId]
  );

  const filteredAddresses = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return addresses.slice(0, 12);
    return addresses
      .filter((a) => `${a.street_name} ${a.house_number}`.toLowerCase().includes(q))
      .slice(0, 15);
  }, [addresses, queryText]);

  const selectAddress = (addr: AddressOption) => {
    setSelectedId(addr.id);
    setQueryText(`${addr.street_name} ${addr.house_number}`);
    setDropdownOpen(false);

    if (mapRef.current && Number.isFinite(addr.lng) && Number.isFinite(addr.lat)) {
      mapRef.current.flyTo({
        center: [addr.lng, addr.lat],
        zoom: 17.8,
        pitch: 50,
        duration: 850,
      });

      if (markerRef.current) {
        markerRef.current.setLngLat([addr.lng, addr.lat]);
      } else {
        const el = document.createElement("div");
        el.style.width = "18px";
        el.style.height = "18px";
        el.style.borderRadius = "9999px";
        el.style.backgroundColor = "#1b4d3e";
        el.style.border = "3px solid #ffffff";
        el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.35)";
        markerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([addr.lng, addr.lat])
          .addTo(mapRef.current);
      }
    }
  };

  useEffect(() => {
    if (!showMiniMap || !mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://vectortiles.geo.admin.ch/styles/ch.swisstopo.basemap.vt/style.json",
      center: [6.5364, 46.5822],
      zoom: 15.8,
      pitch: 45,
      bearing: -12,
      attributionControl: false,
    });

    map.on("load", () => {
      map.addSource("vufflens-verify-buildings", {
        type: "geojson",
        data: "/data/vufflens-buildings-3d.geojson",
      });

      map.addLayer({
        id: "vufflens-verify-3d",
        type: "fill-extrusion",
        source: "vufflens-verify-buildings",
        paint: {
          "fill-extrusion-color": [
            "case",
            ["==", ["get", "address_id"], selectedId || "__none__"],
            "#1b4d3e",
            ["has", "address_id"],
            "#78716c",
            "#d6d3d1",
          ],
          "fill-extrusion-height": ["coalesce", ["get", "height"], 8.5],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.88,
        },
      });

      map.on("click", "vufflens-verify-3d", (e) => {
        const feat = e.features?.[0];
        const addrId = feat?.properties?.address_id as string | undefined;
        if (addrId) {
          const found = addresses.find((a) => a.id === addrId);
          if (found) {
            selectAddress(found);
            return;
          }
        }
        // Fallback: pick closest address to click point
        if (e.lngLat) {
          let best: AddressOption | null = null;
          let bestDist = Infinity;
          for (const a of addresses) {
            const d = Math.hypot(a.lng - e.lngLat.lng, a.lat - e.lngLat.lat);
            if (d < bestDist) {
              bestDist = d;
              best = a;
            }
          }
          if (best && bestDist < 0.0012) {
            selectAddress(best);
          }
        }
      });

      map.on("mouseenter", "vufflens-verify-3d", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "vufflens-verify-3d", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    mapRef.current = map;

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [showMiniMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer("vufflens-verify-3d")) return;
    map.setPaintProperty("vufflens-verify-3d", "fill-extrusion-color", [
      "case",
      ["==", ["get", "address_id"], selectedId || "__none__"],
      "#1b4d3e",
      ["has", "address_id"],
      "#78716c",
      "#d6d3d1",
    ]);
  }, [selectedId]);

  return (
    <div className="space-y-3">
      {/* Champ caché soumis au serveur */}
      <input type="hidden" name="addressId" value={selectedId} required />

      <div className="relative">
        <label className="block text-xs font-medium text-stone-700">
          Rechercher votre rue et numéro ({addresses.length} adresses à Vufflens-la-Ville)
          <input
            type="text"
            value={queryText}
            onFocus={() => setDropdownOpen(true)}
            onChange={(e) => {
              setQueryText(e.target.value);
              setSelectedId("");
              setDropdownOpen(true);
            }}
            placeholder="Tapez ex. Grand-Rue 12, Chemin des Vignes…"
            className="mt-1.5 w-full rounded-md bg-white border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none"
          />
        </label>

        {dropdownOpen && filteredAddresses.length > 0 && (
          <ul className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-stone-300 bg-white py-1 shadow-lg divide-y divide-stone-100">
            {filteredAddresses.map((addr) => {
              const isSel = addr.id === selectedId;
              return (
                <li key={addr.id}>
                  <button
                    type="button"
                    onClick={() => selectAddress(addr)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition ${
                      isSel
                        ? "bg-stone-900 text-white font-semibold"
                        : "text-stone-800 hover:bg-stone-100"
                    }`}
                  >
                    <span>
                      {addr.street_name} {addr.house_number}
                    </span>
                    <span className="text-[10px] opacity-65">1302 Vufflens-la-Ville</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selectedAddress ? (
        <div className="flex items-center justify-between rounded-md border border-[#1b4d3e]/40 bg-[#1b4d3e]/10 px-3 py-2 text-xs text-[#1b4d3e]">
          <span>
            Adresse sélectionnée :{" "}
            <strong>
              {selectedAddress.street_name} {selectedAddress.house_number}
            </strong>
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedId("");
              setQueryText("");
            }}
            className="text-[11px] underline hover:opacity-80"
          >
            Changer
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-stone-500">
          Astuce : vous pouvez aussi cliquer directement sur votre bâtiment 3D ci-dessous.
        </p>
      )}

      {/* Mini-carte 3D interactive pour cliquer sur sa maison */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-stone-600">
            Sélection sur la carte 3D des bâtiments
          </span>
          <button
            type="button"
            onClick={() => setShowMiniMap((v) => !v)}
            className="text-[11px] font-medium text-stone-500 underline hover:text-stone-900"
          >
            {showMiniMap ? "Masquer la mini-carte" : "Afficher la mini-carte 3D"}
          </button>
        </div>

        {showMiniMap && (
          <div className="relative h-56 w-full overflow-hidden rounded-lg border border-stone-300 bg-stone-100">
            <div ref={mapContainerRef} className="h-full w-full" />
          </div>
        )}
      </div>
    </div>
  );
}

