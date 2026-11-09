import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HalloweenSchema,
  AdventApplicationSchema,
  CommunalAdventReservationSchema,
  CommunalAdventBlockSchema,
} from "../src/lib/schemas";

describe("Validation des Schémas de Formulaires (Zod)", () => {
  describe("HalloweenSchema", () => {
    it("valide un formulaire d'inscription complet et correct", () => {
      const valid = {
        is_distributing: true,
        start_time: "18:00",
        end_time: "20:30",
        is_self_service: false,
        is_accessible_step_free: true,
        photo_url: "/uploads/deco-halloween-12345.jpg",
        access_instructions: "Sonner à la porte de gauche.",
      };
      const res = HalloweenSchema.safeParse(valid);
      assert.equal(res.success, true);
    });

    it("accepte une inscription sans photo ni instruction (optionnels)", () => {
      const minimal = {
        is_distributing: true,
        start_time: "17:30",
        end_time: "21:00",
        is_self_service: true,
      };
      const res = HalloweenSchema.safeParse(minimal);
      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.is_accessible_step_free, true);
        assert.equal(res.data.photo_url, undefined);
      }
    });

    it("rejette des heures au format invalide", () => {
      const invalid = {
        is_distributing: true,
        start_time: "18h00", // doit être HH:MM
        end_time: "20:30",
        is_self_service: false,
      };
      const res = HalloweenSchema.safeParse(invalid);
      assert.equal(res.success, false);
    });

    it("rejette une instruction trop longue (> 280 caractères)", () => {
      const tooLong = {
        is_distributing: true,
        start_time: "18:00",
        end_time: "20:30",
        is_self_service: false,
        access_instructions: "a".repeat(281),
      };
      const res = HalloweenSchema.safeParse(tooLong);
      assert.equal(res.success, false);
    });

    it("accepte une URL relative (/uploads/...) ou absolue http(s) pour la photo", () => {
      const relative = HalloweenSchema.safeParse({
        is_distributing: true,
        start_time: "18:00",
        end_time: "20:30",
        is_self_service: false,
        photo_url: "/uploads/stand.webp",
      });
      assert.equal(relative.success, true);

      const absolute = HalloweenSchema.safeParse({
        is_distributing: true,
        start_time: "18:00",
        end_time: "20:30",
        is_self_service: false,
        photo_url: "https://images.unsplash.com/photo-123",
      });
      assert.equal(absolute.success, true);

      const invalidUrl = HalloweenSchema.safeParse({
        is_distributing: true,
        start_time: "18:00",
        end_time: "20:30",
        is_self_service: false,
        photo_url: "not-a-valid-url-or-path",
      });
      assert.equal(invalidUrl.success, false);

      const maliciousUrl = HalloweenSchema.safeParse({
        is_distributing: true,
        start_time: "18:00",
        end_time: "20:30",
        is_self_service: false,
        photo_url: "javascript:alert(1)",
      });
      assert.equal(maliciousUrl.success, false);
    });
  });

  describe("AdventApplicationSchema", () => {
    it("valide une candidature complète pour le Calendrier de l'Avent", () => {
      const valid = {
        requested_day: 12,
        participation_type: "hospitality" as const,
        activity_label: "Partage d'une soupe & pain d'épices",
        lighting_time: "17:30",
        event_start_time: "18:00",
        event_end_time: "20:00",
        hospitality_details: "Venez nombreux avec votre tasse !",
        is_accessible_step_free: true,
        photo_url: "/uploads/fenetre-12.jpg",
      };
      const res = AdventApplicationSchema.safeParse(valid);
      assert.equal(res.success, true);
    });

    it("rejette un jour en dehors de la plage 1..24", () => {
      assert.equal(
        AdventApplicationSchema.safeParse({
          requested_day: 0,
          participation_type: "window_only",
          activity_label: "Fenêtre illuminée",
          lighting_time: "17:30",
        }).success,
        false
      );

      assert.equal(
        AdventApplicationSchema.safeParse({
          requested_day: 25,
          participation_type: "window_only",
          activity_label: "Fenêtre illuminée",
          lighting_time: "17:30",
        }).success,
        false
      );
    });

    it("accepte les jours valides du 1er au 24 décembre", () => {
      for (let day = 1; day <= 24; day++) {
        const res = AdventApplicationSchema.safeParse({
          requested_day: day,
          participation_type: "window_only",
          activity_label: "Fenêtre illuminée",
          lighting_time: "17:30",
        });
        assert.equal(res.success, true, `Jour ${day} devrait être accepté`);
      }
    });

    it("nettoie et vérifie la longueur du libellé de l'activité", () => {
      const trimmed = AdventApplicationSchema.safeParse({
        requested_day: 5,
        participation_type: "window_only",
        activity_label: "   Fenêtre avec bougies   ",
        lighting_time: "17:30",
      });
      assert.equal(trimmed.success, true);
      if (trimmed.success) {
        assert.equal(trimmed.data.activity_label, "Fenêtre avec bougies");
      }

      const tooShort = AdventApplicationSchema.safeParse({
        requested_day: 5,
        participation_type: "window_only",
        activity_label: "a",
        lighting_time: "17:30",
      });
      assert.equal(tooShort.success, false);
    });

    it("rejette un type de participation inconnu", () => {
      const res = AdventApplicationSchema.safeParse({
        requested_day: 5,
        participation_type: "spectacle_inconnu",
        activity_label: "Animation",
        lighting_time: "17:30",
      });
      assert.equal(res.success, false);
    });
  });

  describe("CommunalAdventReservationSchema", () => {
    const validUuid = "11111111-2222-3333-4444-555555555555";

    it("valide une pré-réservation communale officielle (ex: 1er déc. Maison de Commune)", () => {
      const res = CommunalAdventReservationSchema.safeParse({
        day_number: 1,
        address_id: validUuid,
        activity_label: "Inauguration officielle du Calendrier & Apéritif municipal",
        lighting_time: "18:00",
        event_start_time: "18:30",
        hospitality_details: "Vin chaud et jus de pomme offerts par la Municipalité",
      });
      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.day_number, 1);
        assert.equal(res.data.lighting_time, "18:00");
      }
    });

    it("rejette un jour communal invalide ou hors plage (0 ou 25)", () => {
      assert.equal(
        CommunalAdventReservationSchema.safeParse({
          day_number: 0,
          address_id: validUuid,
          activity_label: "Inauguration",
        }).success,
        false
      );
      assert.equal(
        CommunalAdventReservationSchema.safeParse({
          day_number: 25,
          address_id: validUuid,
          activity_label: "Inauguration",
        }).success,
        false
      );
    });

    it("rejette une adresse UUID malformée", () => {
      const res = CommunalAdventReservationSchema.safeParse({
        day_number: 6,
        address_id: "not-a-valid-uuid",
        activity_label: "Visite de Saint-Nicolas",
      });
      assert.equal(res.success, false);
    });
  });

  describe("CommunalAdventBlockSchema", () => {
    it("valide un blocage de date communal avec un motif explicite", () => {
      const res = CommunalAdventBlockSchema.safeParse({
        day_number: 18,
        block_reason: "Fête de Noël de l'école primaire",
      });
      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.day_number, 18);
        assert.equal(res.data.block_reason, "Fête de Noël de l'école primaire");
      }
    });

    it("rejette un motif de blocage vide ou trop court", () => {
      assert.equal(
        CommunalAdventBlockSchema.safeParse({
          day_number: 10,
          block_reason: "  ",
        }).success,
        false
      );
    });
  });

  describe("Advent Cancellation Deadline Logic", () => {
    it("détermine avec exactitude si la date limite communale de désinscription est échue", () => {
      const isDeadlinePassed = (deadline: string | null, currentDate: string): boolean => {
        if (!deadline) return false;
        return currentDate > deadline;
      };

      // Avant la date limite : désinscription permise
      assert.equal(isDeadlinePassed("2026-11-20", "2026-11-10"), false);
      assert.equal(isDeadlinePassed("2026-11-20", "2026-11-20"), false);

      // Passée la date limite : désinscription verrouillée par la commune
      assert.equal(isDeadlinePassed("2026-11-20", "2026-11-21"), true);
      assert.equal(isDeadlinePassed("2026-11-20", "2026-12-01"), true);

      // Sans date limite configurée : désinscription toujours permise
      assert.equal(isDeadlinePassed(null, "2026-12-01"), false);
    });
  });

  describe("Halloween Quick Action Banner Visibility", () => {
    const isCandyBannerActive = (
      season: string,
      day: number,
      month: number // 0-indexed: 9 = Oct, 11 = Dec
    ): boolean => {
      if (season !== "halloween") return false;
      return day === 31 && (month === 9 || month === 11);
    };

    it("s'affiche uniquement si la carte est en mode halloween ET le 31 (octobre ou décembre)", () => {
      // En mode halloween le 31 octobre : actif
      assert.equal(isCandyBannerActive("halloween", 31, 9), true);
      // En mode halloween le 31 décembre : actif
      assert.equal(isCandyBannerActive("halloween", 31, 11), true);

      // En mode halloween un jour ordinaire (ex: 9 novembre, 15 octobre) : masqué
      assert.equal(isCandyBannerActive("halloween", 9, 10), false);
      assert.equal(isCandyBannerActive("halloween", 15, 9), false);
      assert.equal(isCandyBannerActive("halloween", 30, 9), false);

      // Si la carte n'est pas en mode halloween (advent ou off_season) : toujours masqué
      assert.equal(isCandyBannerActive("advent", 31, 9), false);
      assert.equal(isCandyBannerActive("advent", 31, 11), false);
      assert.equal(isCandyBannerActive("off_season", 31, 9), false);
    });
  });
});
