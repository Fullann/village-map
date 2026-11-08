import { describe, it } from "node:test";
import assert from "node:assert";
import { getStorageConfig } from "../src/lib/storage";

describe("Module de Stockage Modulaire (src/lib/storage.ts)", () => {
  it("bascule par défaut sur le driver local en l'absence de variables S3", () => {
    const originalEnv = { ...process.env };
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_BUCKET;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;

    try {
      const config = getStorageConfig();
      assert.strictEqual(config.driver, "local");
    } finally {
      process.env = originalEnv;
    }
  });

  it("active le driver S3 lorsque toutes les variables d'environnement requises sont fournies", () => {
    const originalEnv = { ...process.env };
    process.env.S3_ENDPOINT = "https://s3.fr-par.scw.cloud";
    process.env.S3_BUCKET = "village-uploads";
    process.env.S3_ACCESS_KEY_ID = "SCWTEST123";
    process.env.S3_SECRET_ACCESS_KEY = "supersecret";
    process.env.S3_REGION = "fr-par";

    try {
      const config = getStorageConfig();
      assert.strictEqual(config.driver, "s3");
      assert.strictEqual(config.s3Bucket, "village-uploads");
      assert.strictEqual(config.s3Region, "fr-par");
    } finally {
      process.env = originalEnv;
    }
  });
});
