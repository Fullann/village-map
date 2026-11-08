import { readFileSync, writeFileSync } from "node:fs";
import { pool } from "../src/lib/db";

interface BuildingFeature {
  type: "Feature";
  id: number;
  properties: {
    osm_id: string;
    street_name: string | null;
    house_number: string | null;
    height: number;
    min_height: number;
    levels: number;
    building_type: string;
    address_id: string | null;
  };
  geometry: {
    type: "Polygon";
    coordinates: [number, number][][];
  };
}

function makeBuildingPolygon(
  lng: number,
  lat: number,
  widthMeters: number,
  depthMeters: number,
  angleDeg: number
): [number, number][] {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);
  const hw = widthMeters / 2;
  const hd = depthMeters / 2;
  const corners: [number, number][] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  const ring: [number, number][] = corners.map(([dx, dy]) => {
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return [
      Number((lng + rx / mPerDegLng).toFixed(7)),
      Number((lat + ry / mPerDegLat).toFixed(7)),
    ];
  });
  ring.push(ring[0]);
  return ring;
}

async function enrichBuildings() {
  const geoPath = "public/data/vufflens-buildings-3d.geojson";
  const geo = JSON.parse(readFileSync(geoPath, "utf8")) as {
    type: string;
    name: string;
    features: BuildingFeature[];
  };

  console.log(`Bâtiments actuels dans le GeoJSON 3D : ${geo.features.length}`);

  // Récupérer toutes les adresses depuis Swisstopo RegBL pour Vufflens-la-Ville (1302)
  console.log("Interrogation du Registre fédéral des bâtiments Swisstopo RegBL (PLZ 1302)...");
  const swisstopoUrl =
    "https://api3.geo.admin.ch/rest/services/ech/MapServer/find?layer=ch.bfs.gebaeude_wohnungs_register&searchText=1302&searchField=dplz4&returnGeometry=true&sr=4326";
  const stRes = await fetch(swisstopoUrl, {
    headers: { "User-Agent": "VufflensVillage3DMap/1.0" },
  });
  const stData = (await stRes.json()) as {
    results?: Array<{
      id: number;
      attributes: {
        strname_deinr?: string;
        strname?: string[] | string;
        deinr?: string;
        gastw?: number;
      };
      geometry?: { x: number; y: number };
    }>;
  };

  const results = stData.results ?? [];
  console.log(`Total bâtiments retournés par Swisstopo RegBL : ${results.length}`);

  // Ensemble des coordonnées et clés déjà présentes
  const existingSet = new Set<string>();
  for (const f of geo.features) {
    const p = f.properties;
    if (p.street_name && p.house_number) {
      existingSet.add(`${p.street_name.toLowerCase()}|${p.house_number.toLowerCase()}`);
    }
  }

  let addedCount = 0;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const item of results) {
      if (!item.geometry) continue;
      const lng = item.geometry.x;
      const lat = item.geometry.y;

      // Filtrer dans la boîte englobante de Vufflens
      if (lng < 6.526 || lng > 6.547 || lat < 46.574 || lat > 46.589) continue;

      let street = Array.isArray(item.attributes.strname)
        ? item.attributes.strname[0]
        : item.attributes.strname;
      if (!street) continue;
      street = street.trim();
      const num = (item.attributes.deinr ?? "").trim();
      if (!num) continue;

      const key = `${street.toLowerCase()}|${num.toLowerCase()}`;
      if (existingSet.has(key)) continue;

      // Vérifier également la distance par rapport aux bâtiments existants pour éviter les doublons
      let tooClose = false;
      for (const f of geo.features) {
        const c = f.geometry.coordinates[0];
        const cLng = c[0][0];
        const cLat = c[0][1];
        const dist = Math.hypot((cLng - lng) * 80000, (cLat - lat) * 111000);
        if (dist < 6) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      existingSet.add(key);

      const levels =
        item.attributes.gastw && item.attributes.gastw > 0
          ? item.attributes.gastw
          : 2 + (item.id % 2);
      const height = Number((levels * 3.2 + 1.8).toFixed(1));

      // Calculer l'angle d'orientation de la rue (l'Arzillier est à ~16° d'inclinaison)
      const angle = street.includes("Arzillier") ? 18 : (item.id * 23) % 180;
      const width = 12 + (item.id % 4);
      const depth = 9 + (item.id % 3);

      // 1. Insérer ou récupérer l'adresse dans public.addresses
      const addrRes = await client.query<{ id: string }>(
        `INSERT INTO public.addresses (external_cadastre_id, street_name, house_number, postal_code, city, lng, lat)
         VALUES ($1, $2, $3, '1302', 'Vufflens-la-Ville', $4, $5)
         ON CONFLICT (street_name, house_number, postal_code)
         DO UPDATE SET lng = EXCLUDED.lng, lat = EXCLUDED.lat
         RETURNING id`,
        [`egid/${item.id}`, street, num, lng, lat]
      );
      const addressId = addrRes.rows[0]?.id ?? null;

      // 2. Créer le polygone 3D
      const poly = makeBuildingPolygon(lng, lat, width, depth, angle);

      geo.features.push({
        type: "Feature",
        id: item.id,
        properties: {
          osm_id: `swisstopo/${item.id}`,
          street_name: street,
          house_number: num,
          height,
          min_height: 0,
          levels,
          building_type: "residential",
          address_id: addressId,
        },
        geometry: {
          type: "Polygon",
          coordinates: [poly],
        },
      });

      addedCount++;
    }

    await client.query("COMMIT");
    writeFileSync(geoPath, JSON.stringify(geo, null, 2), "utf8");
    console.log(`✓ Succès : ${addedCount} nouveaux bâtiments 3D créés et ajoutés au GeoJSON !`);
    console.log(`Nouveau total de bâtiments 3D : ${geo.features.length}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erreur lors de l'enrichissement :", err);
  } finally {
    client.release();
    await pool.end();
  }
}

enrichBuildings();
