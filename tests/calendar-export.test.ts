import test, { describe, it } from "node:test";
import assert from "node:assert/strict";

function pad2(n: number | string): string {
  return String(n).padStart(2, "0");
}

function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function buildIcsEvent(ev: {
  address_id: string;
  street_name: string;
  house_number: string;
  current_season: "halloween" | "advent";
  day_number?: number;
  activity_label?: string;
  halloween_start?: string;
  halloween_end?: string;
  lighting_time?: string;
  event_start_time?: string;
  is_self_service?: boolean;
  is_accessible_step_free?: boolean;
  hospitality_details?: string;
  access_instructions?: string;
  year?: number;
}) {
  const currentYear = ev.year || 2026;
  const address = `${ev.street_name} ${ev.house_number}`;
  const location = `${address}, 1302 Vufflens-la-Ville, Suisse`;
  const uid = `vufflens-${ev.address_id}-${ev.day_number || "halloween"}-${currentYear}@vufflens-la-ville.ch`;

  let summary = "";
  let description = "";
  let dtStart = "";
  let dtEnd = "";

  if (ev.current_season === "halloween") {
    summary = `🎃 Halloween : ${address}`;
    const startH = ev.halloween_start?.slice(0, 5) || "18:00";
    const endH = ev.halloween_end?.slice(0, 5) || "20:30";
    const [sH, sM] = startH.split(":");
    const [eH, eM] = endH.split(":");
    dtStart = `${currentYear}1031T${pad2(sH)}${pad2(sM)}00`;
    dtEnd = `${currentYear}1031T${pad2(eH)}${pad2(eM)}00`;

    const detailsList = [
      "Soirée d'Halloween à Vufflens-la-Ville",
      ev.is_self_service ? "Panier en libre-service" : "Accueil à la porte",
      ev.is_accessible_step_free ? "Accès de plain-pied (poussettes & PMR)" : null,
      ev.access_instructions ? `Infos : ${ev.access_instructions}` : null,
    ].filter(Boolean);
    description = detailsList.join("\\n");
  } else {
    const day = ev.day_number || 1;
    const actName = ev.activity_label || "Fenêtre illuminée";
    summary = `🎄 Avent #${day} : ${actName} (${address})`;

    const timeStr = ev.event_start_time?.slice(0, 5) || ev.lighting_time?.slice(0, 5) || "17:30";
    const [tH, tM] = timeStr.split(":");
    const sH = parseInt(tH || "17", 10);
    const sM = parseInt(tM || "30", 10);
    const endH = (sH + 2) % 24;

    dtStart = `${currentYear}12${pad2(day)}T${pad2(sH)}${pad2(sM)}00`;
    dtEnd = `${currentYear}12${pad2(day)}T${pad2(endH)}${pad2(sM)}00`;

    const detailsList = [
      `Calendrier de l'Avent de Vufflens-la-Ville - Jour ${day}`,
      `Formule : ${actName}`,
      ev.is_accessible_step_free ? "Accès de plain-pied (poussettes & PMR)" : null,
      ev.hospitality_details ? `Précisions : ${ev.hospitality_details}` : null,
    ].filter(Boolean);
    description = detailsList.join("\\n");
  }

  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART;TZID=Europe/Zurich:${dtStart}`,
    `DTEND;TZID=Europe/Zurich:${dtEnd}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
  ].join("\r\n");
}

describe("Export Calendrier RFC 5545 (.ics)", () => {
  describe("escapeIcsText", () => {
    it("échappe correctement les virgules, points-virgules, barres obliques et retours à la ligne", () => {
      const raw = "Thé, vin chaud; soupe & pain\nDeuxième ligne avec \\ antislash";
      const escaped = escapeIcsText(raw);
      assert.equal(
        escaped,
        "Thé\\, vin chaud\\; soupe & pain\\nDeuxième ligne avec \\\\ antislash"
      );
    });
  });

  describe("Événement Halloween (.ics)", () => {
    it("génère un événement VEVENT valide le 31 octobre", () => {
      const ics = buildIcsEvent({
        address_id: "addr-001",
        street_name: "Route de Bovon",
        house_number: "16",
        current_season: "halloween",
        halloween_start: "18:00",
        halloween_end: "21:00",
        is_self_service: true,
        is_accessible_step_free: true,
        access_instructions: "Panier devant la barrière blanche.",
      });

      assert.match(ics, /^BEGIN:VEVENT\r\n/);
      assert.match(ics, /\r\nEND:VEVENT$/);
      assert.match(ics, /UID:vufflens-addr-001-halloween-2026@vufflens-la-ville\.ch/);
      assert.match(ics, /DTSTART;TZID=Europe\/Zurich:20261031T180000/);
      assert.match(ics, /DTEND;TZID=Europe\/Zurich:20261031T210000/);
      assert.match(ics, /SUMMARY:🎃 Halloween : Route de Bovon 16/);
      assert.match(ics, /LOCATION:Route de Bovon 16\\, 1302 Vufflens-la-Ville\\, Suisse/);
      assert.match(ics, /Accès de plain-pied \(poussettes & PMR\)/);
      assert.match(ics, /Panier en libre-service/);
    });
  });

  describe("Événement Calendrier de l'Avent (.ics)", () => {
    it("génère un événement VEVENT valide avec la date exacte en décembre", () => {
      const ics = buildIcsEvent({
        address_id: "addr-002",
        street_name: "Rue de Marteley",
        house_number: "2",
        current_season: "advent",
        day_number: 8,
        activity_label: "Lecture de contes & chocolat chaud",
        lighting_time: "17:30",
        event_start_time: "18:15",
        is_accessible_step_free: true,
        hospitality_details: "Dans la cour intérieure, chauffée avec un brasero.",
      });

      assert.match(ics, /UID:vufflens-addr-002-8-2026@vufflens-la-ville\.ch/);
      assert.match(ics, /DTSTART;TZID=Europe\/Zurich:20261208T181500/);
      assert.match(ics, /DTEND;TZID=Europe\/Zurich:20261208T201500/);
      assert.match(ics, /SUMMARY:🎄 Avent #8 : Lecture de contes & chocolat chaud \(Rue de Marteley 2\)/);
      assert.match(ics, /Accès de plain-pied \(poussettes & PMR\)/);
      assert.match(ics, /Précisions : Dans la cour intérieure\\, chauffée avec un brasero\./);
    });
  });
});
