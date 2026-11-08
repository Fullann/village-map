import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeDistanceMeters,
  formatDistance,
  formatWalkingMinutes,
} from "../src/components/map/MobileDrawer";

describe("Calculs Géodésiques & GPS (MobileDrawer)", () => {
  describe("computeDistanceMeters (Haversine)", () => {
    it("retourne 0 mètre pour deux coordonnées identiques", () => {
      const p: [number, number] = [6.5364, 46.5822];
      const d = computeDistanceMeters(p, p[0], p[1]);
      assert.equal(d, 0);
    });

    it("est symétrique : dist(A, B) === dist(B, A)", () => {
      const p1: [number, number] = [6.5364, 46.5822];
      const p2: [number, number] = [6.5402, 46.5851];
      const d1 = computeDistanceMeters(p1, p2[0], p2[1]);
      const d2 = computeDistanceMeters(p2, p1[0], p1[1]);
      assert.equal(d1, d2);
    });

    it("calcule avec précision une distance piétonne dans le village", () => {
      // Église de Vufflens (6.5385, 46.5825) vers la Gare / Arrêt (6.5450, 46.5855)
      const eglise: [number, number] = [6.5385, 46.5825];
      const d = computeDistanceMeters(eglise, 6.545, 46.5855);
      // Distance attendue : environ 600m à vol d'oiseau
      assert.ok(d > 550 && d < 650, `Distance inattendue : ${d}m`);
    });
  });

  describe("formatDistance", () => {
    it("formate en mètres en dessous de 1000m", () => {
      assert.equal(formatDistance(0), "0 m");
      assert.equal(formatDistance(85), "85 m");
      assert.equal(formatDistance(999), "999 m");
    });

    it("formate en kilomètres avec virgule suisse au-delà de 1000m", () => {
      assert.equal(formatDistance(1000), "1,0 km");
      assert.equal(formatDistance(1240), "1,2 km");
      assert.equal(formatDistance(2500), "2,5 km");
    });
  });

  describe("formatWalkingMinutes", () => {
    it("retourne au minimum ~1 min", () => {
      assert.equal(formatWalkingMinutes(10), "~1 min");
      assert.equal(formatWalkingMinutes(70), "~1 min");
    });

    it("estime correctement le temps de marche à ~4.3 km/h (72m par min)", () => {
      assert.equal(formatWalkingMinutes(360), "~5 min");
      assert.equal(formatWalkingMinutes(720), "~10 min");
      assert.equal(formatWalkingMinutes(1440), "~20 min");
    });
  });
});
