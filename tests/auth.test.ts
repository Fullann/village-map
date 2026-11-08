import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sha256Hex,
  verifyHashConstantTime,
  generateVillageSecretCode,
  getJwtSecret,
  DEV_FALLBACK_SECRET,
} from "../src/lib/auth";

describe("Module Authentification & Sécurité (src/lib/auth.ts)", () => {
  describe("sha256Hex", () => {
    it("génère un hachage SHA-256 déterministe en minuscules de 64 caractères", () => {
      const hash1 = sha256Hex("VILLAGE2026");
      const hash2 = sha256Hex("VILLAGE2026");
      assert.equal(hash1, hash2);
      assert.equal(hash1.length, 64);
      assert.match(hash1, /^[0-9a-f]{64}$/);
    });

    it("correspond au hachage connu du code par défaut de seed", () => {
      const computed = sha256Hex("VILLAGE2026");
      assert.equal(
        computed,
        "8d576aa877aa9e67f5dd0758bf7c34efe71216a6a5586ec50ae0e019522f70c1"
      );
    });
  });

  describe("verifyHashConstantTime", () => {
    const expectedHash = sha256Hex("VILLAGE2026");

    it("valide un code identique", () => {
      assert.equal(verifyHashConstantTime("VILLAGE2026", expectedHash), true);
    });

    it("valide un code en minuscules (insensible à la casse)", () => {
      assert.equal(verifyHashConstantTime("village2026", expectedHash), true);
    });

    it("valide un code entouré d'espaces (nettoyage automatique)", () => {
      assert.equal(verifyHashConstantTime("  VILLAGE2026  ", expectedHash), true);
    });

    it("rejette un code erroné", () => {
      assert.equal(verifyHashConstantTime("MAUVAISCODE", expectedHash), false);
    });

    it("rejette une chaîne vide ou de mauvaise longueur sans lever d'exception", () => {
      assert.equal(verifyHashConstantTime("", expectedHash), false);
      assert.equal(verifyHashConstantTime("123", expectedHash), false);
    });
  });

  describe("generateVillageSecretCode", () => {
    it("génère un code de 8 caractères exactement", () => {
      const code = generateVillageSecretCode();
      assert.equal(code.length, 8);
    });

    it("utilise uniquement l'alphabet non ambigu (sans 0, O, 1, I)", () => {
      const allowedAlphabet = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
      for (let i = 0; i < 50; i++) {
        const code = generateVillageSecretCode();
        assert.match(
          code,
          allowedAlphabet,
          `Le code ${code} contient des caractères non autorisés`
        );
        assert.equal(code.includes("0"), false);
        assert.equal(code.includes("O"), false);
        assert.equal(code.includes("1"), false);
        assert.equal(code.includes("I"), false);
      }
    });

    it("génère des codes différents et aléatoires (entropie)", () => {
      const codes = new Set<string>();
      for (let i = 0; i < 20; i++) {
        codes.add(generateVillageSecretCode());
      }
      assert.equal(codes.size, 20);
    });
  });

  describe("Sécurité des environnements (getJwtSecret)", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.AUTH_SECRET;

    it("autorise le fallback de développement en mode dev", () => {
      (process.env as any).NODE_ENV = "development";
      delete process.env.AUTH_SECRET;
      const secret = getJwtSecret();
      assert.ok(secret instanceof Uint8Array);
      assert.equal(new TextDecoder().decode(secret), DEV_FALLBACK_SECRET);
    });

    it("bloque strictement le fallback en mode production si AUTH_SECRET est absent", () => {
      (process.env as any).NODE_ENV = "production";
      delete process.env.AUTH_SECRET;
      assert.throws(
        () => getJwtSecret(),
        /AUTH_SECRET doit être défini avec une clé secrète robuste en production/
      );
    });

    it("bloque le fallback en mode production si AUTH_SECRET vaut le secret dev par défaut", () => {
      (process.env as any).NODE_ENV = "production";
      process.env.AUTH_SECRET = DEV_FALLBACK_SECRET;
      assert.throws(
        () => getJwtSecret(),
        /AUTH_SECRET doit être défini avec une clé secrète robuste en production/
      );
    });

    it("accepte un secret valide en production", () => {
      (process.env as any).NODE_ENV = "production";
      process.env.AUTH_SECRET = "production_super_strong_secret_key_vufflens_2026_xyz";
      const secret = getJwtSecret();
      assert.equal(
        new TextDecoder().decode(secret),
        "production_super_strong_secret_key_vufflens_2026_xyz"
      );
      // Restauration de l'environnement
      (process.env as any).NODE_ENV = originalEnv;
      process.env.AUTH_SECRET = originalSecret;
    });
  });
});
