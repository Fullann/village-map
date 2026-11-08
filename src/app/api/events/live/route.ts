import { NextRequest } from "next/server";
import { subscribeLiveEvents, type LiveVillageEvent } from "@/lib/realtime";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Message de bienvenue SSE initial
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`)
      );

      // 2. Abonnement aux événements du village
      const unsubscribe = subscribeLiveEvents((event: LiveVillageEvent) => {
        try {
          const payload = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Erreur d'écriture si le client a fermé brutalement
        }
      });

      // 3. Heartbeat toutes les 25 secondes pour empêcher les coupures proxy / cPanel
      const interval = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`: heartbeat ${new Date().toISOString()}\n\n`)
          );
        } catch {
          clearInterval(interval);
          unsubscribe();
        }
      }, 25_000);

      // 4. Nettoyage lors de la déconnexion
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Ignorer si déjà fermé
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Empêche la mise en mémoire tampon par Nginx ou reverse proxy
    },
  });
}
