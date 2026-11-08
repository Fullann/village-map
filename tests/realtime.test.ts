import { describe, it } from "node:test";
import assert from "node:assert";
import { broadcastLiveEvent, subscribeLiveEvents, type LiveCandyUpdateEvent } from "../src/lib/realtime";

describe("Module Temps Réel SSE (src/lib/realtime.ts)", () => {
  it("diffuse et reçoit correctement les événements en direct aux abonnés", async () => {
    let receivedEvent: LiveCandyUpdateEvent | null = null;

    const unsubscribe = subscribeLiveEvents((ev) => {
      if (ev.type === "candy_update") {
        receivedEvent = ev;
      }
    });

    const testPayload: LiveCandyUpdateEvent = {
      type: "candy_update",
      addressId: "addr-1234",
      outOfCandy: true,
      streetName: "Rue du Village",
      houseNumber: "12",
      timestamp: new Date().toISOString(),
    };

    broadcastLiveEvent(testPayload);

    assert.ok(receivedEvent);
    assert.strictEqual(receivedEvent.addressId, "addr-1234");
    assert.strictEqual(receivedEvent.outOfCandy, true);
    assert.strictEqual(receivedEvent.streetName, "Rue du Village");

    // Nettoyage
    unsubscribe();

    // Vérifie qu'après désabonnement, l'écouteur n'est plus appelé
    receivedEvent = null;
    broadcastLiveEvent({
      ...testPayload,
      outOfCandy: false,
    });
    assert.strictEqual(receivedEvent, null);
  });
});
