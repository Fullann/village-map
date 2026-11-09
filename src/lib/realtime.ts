import { EventEmitter } from "node:events";

export interface LiveCandyUpdateEvent {
  type: "candy_update";
  addressId: string;
  outOfCandy: boolean;
  streetName?: string;
  houseNumber?: string;
  timestamp: string;
}

export interface LiveSeasonChangeEvent {
  type: "season_change";
  season: string;
  timestamp: string;
}

export interface LiveCommunalAlertEvent {
  type: "communal_alert";
  id?: string;
  level: "info" | "warning" | "urgent";
  title: string;
  message: string;
  active: boolean;
  timestamp: string;
}

export interface LivePingEvent {
  type: "ping";
  timestamp: string;
}

export type LiveVillageEvent =
  | LiveCandyUpdateEvent
  | LiveSeasonChangeEvent
  | LiveCommunalAlertEvent
  | LivePingEvent;

declare global {
  // eslint-disable-next-line no-var
  var __villageEventBus: EventEmitter | undefined;
}

const eventBus: EventEmitter = global.__villageEventBus ?? new EventEmitter();
eventBus.setMaxListeners(200); // Supporte jusqu'à 200 clients concurrents par instance Node

if (process.env.NODE_ENV !== "production") {
  global.__villageEventBus = eventBus;
}

export function broadcastLiveEvent(event: LiveVillageEvent) {
  try {
    eventBus.emit("village_event", event);
  } catch (err) {
    console.error("Erreur lors de la diffusion de l'événement en direct :", err);
  }
}

export function subscribeLiveEvents(listener: (event: LiveVillageEvent) => void): () => void {
  eventBus.on("village_event", listener);
  return () => {
    eventBus.off("village_event", listener);
  };
}
