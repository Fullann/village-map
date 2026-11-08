/**
 * Applique les migrations SQL et le seed sur la base PostgreSQL (o2switch ou locale).
 * Usage : DATABASE_URL=postgresql://... npm run db:migrate
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pool } from "../src/lib/db";

async function run() {
  const migrationsDir = join(process.cwd(), "db", "migrations");
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    console.log(`→ Application de ${file}...`);
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    await pool.query(sql);
  }

  const seedPath = join(process.cwd(), "db", "seed.sql");
  console.log("→ Application de db/seed.sql...");
  await pool.query(readFileSync(seedPath, "utf8"));

  console.log("✓ Base de données PostgreSQL prête !");
  await pool.end();
}

run().catch((err) => {
  console.error("Erreur de migration :", err);
  process.exit(1);
});

