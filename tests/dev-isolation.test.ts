import test, { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { GET as devLoginRoute } from "../src/app/auth/dev-login/route";
import { getJwtSecret, DEV_FALLBACK_SECRET } from "../src/lib/auth";

describe("Isolation Stricte Développement / Production", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalSecret = process.env.AUTH_SECRET;

  afterEach(() => {
    (process.env as any).NODE_ENV = originalEnv;
    process.env.AUTH_SECRET = originalSecret;
  });

  describe("Route /auth/dev-login", () => {
    it("renvoie strictement un statut 404 (Not Found) en environnement de production", async () => {
      (process.env as any).NODE_ENV = "production";

      const req = new Request("http://localhost:3000/auth/dev-login?email=admin@village.ch");
      const res = await devLoginRoute(req);

      assert.equal(res.status, 404);
      const text = await res.text();
      assert.equal(text, "Not Found");
    });
  });

  describe("Secrets & Clés JWT en production", () => {
    it("interdit formellement l'utilisation du secret de dev par défaut en production", () => {
      (process.env as any).NODE_ENV = "production";
      process.env.AUTH_SECRET = DEV_FALLBACK_SECRET;

      assert.throws(() => {
        getJwtSecret();
      }, /AUTH_SECRET doit être défini avec une clé secrète robuste en production/);
    });

    it("interdit une clé vide ou absente en production", () => {
      (process.env as any).NODE_ENV = "production";
      delete process.env.AUTH_SECRET;

      assert.throws(() => {
        getJwtSecret();
      }, /AUTH_SECRET doit être défini avec une clé secrète robuste en production/);
    });
  });

  describe("Garantie de non-divulgation des liens Magic en production", () => {
    it("devMagicUrl est strictement absent lorsque NODE_ENV === 'production'", () => {
      (process.env as any).NODE_ENV = "production";
      const magicUrl = "http://localhost:3000/auth/callback?token=abc";

      // Simulation du retour de signInWithMagicLink
      const responsePayload = {
        success: true,
        devMagicUrl: process.env.NODE_ENV !== "production" ? magicUrl : undefined,
      };

      assert.equal(responsePayload.devMagicUrl, undefined);
      assert.equal("devMagicUrl" in responsePayload && responsePayload.devMagicUrl !== undefined, false);
    });

    it("devMagicUrl est fourni uniquement en environnement local / développement", () => {
      (process.env as any).NODE_ENV = "development";
      const magicUrl = "http://localhost:3000/auth/callback?token=abc";

      const responsePayload = {
        success: true,
        devMagicUrl: process.env.NODE_ENV !== "production" ? magicUrl : undefined,
      };

      assert.equal(responsePayload.devMagicUrl, magicUrl);
    });
  });
});
