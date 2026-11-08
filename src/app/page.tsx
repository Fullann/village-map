import { query } from "@/lib/db";
import Map3DContainer from "@/components/map/Map3DContainer";
import type { SeasonMode, VillageMapEvent } from "@/types";

export const dynamic = "force-dynamic";

interface PublicVillageStateRow {
  current_season: SeasonMode;
  advent_registration_opens_at: string;
  advent_is_published: boolean;
  map_center_lng: number;
  map_center_lat: number;
  map_bounds_sw_lng: number;
  map_bounds_sw_lat: number;
  map_bounds_ne_lng: number;
  map_bounds_ne_lat: number;
  map_style_url: string;
}

export default async function HomePage() {
  let season: SeasonMode = "halloween";
  let adventPublished = true;
  let adventOpensAt = "2026-11-01";
  let villageCenter: [number, number] = [6.5364, 46.5822];
  let villageBounds: [[number, number], [number, number]] = [
    [6.526, 46.576],
    [6.547, 46.589],
  ];
  let mapStyle = "https://vectortiles.geo.admin.ch/styles/ch.swisstopo.basemap.vt/style.json";
  let events: VillageMapEvent[] = [];

  try {
    const stateRows = await query<PublicVillageStateRow>(
      `SELECT * FROM public.public_village_state LIMIT 1`
    );
    const st = stateRows[0];
    if (st) {
      season = st.current_season;
      adventPublished = Boolean(st.advent_is_published);
      adventOpensAt = st.advent_registration_opens_at ?? "2026-11-01";
      villageCenter = [Number(st.map_center_lng), Number(st.map_center_lat)];
      villageBounds = [
        [Number(st.map_bounds_sw_lng), Number(st.map_bounds_sw_lat)],
        [Number(st.map_bounds_ne_lng), Number(st.map_bounds_ne_lat)],
      ];
      mapStyle = st.map_style_url;
    }
    events = await query<VillageMapEvent>(`SELECT * FROM public.public_map_events`);
  } catch {
    // Valeurs par défaut si base non initialisée
  }

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden">
      <Map3DContainer
        initialSeason={season}
        adventPublished={adventPublished}
        adventOpensAt={adventOpensAt}
        events={events}
        villageCenter={villageCenter}
        villageBounds={villageBounds}
        mapStyle={mapStyle}
      />
    </main>
  );
}
