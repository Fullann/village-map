/**
 * Import de la whitelist d'adresses depuis data/addresses.geojson directement dans PostgreSQL.
 * Usage : DATABASE_URL=postgresql://... npm run import:addresses
 */
import { readFileSync } from "node:fs";
import { pool } from "../src/lib/db";

type Feature = {
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { id?: string; street: string; number: string; postcode: string; city: string };
};

async function run() {
  const geo = JSON.parse(readFileSync("data/addresses.geojson", "utf8")) as { features: Feature[] };
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    for (const f of geo.features) {
      const [lng, lat] = f.geometry.coordinates;
      await client.query(
        `INSERT INTO public.addresses (external_cadastre_id, street_name, house_number, postal_code, city, lng, lat)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (street_name, house_number, postal_code)
         DO UPDATE SET lng = EXCLUDED.lng, lat = EXCLUDED.lat, city = EXCLUDED.city`,
        [
          f.properties.id ?? null,
          f.properties.street,
          f.properties.number,
          f.properties.postcode,
          f.properties.city,
          lng,
          lat,
        ]
      );
    }
    await client.query("COMMIT");
    console.log(`✓ ${geo.features.length} adresses importées dans PostgreSQL.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
