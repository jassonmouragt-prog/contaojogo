"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type Known = { id: string; version: number };

/**
 * Mantém a página pública atualizada:
 * - realtime gerenciado (Ably) quando habilitado: mensagem → confere versão → refresh;
 * - polling de reserva (5s sem realtime, 60s com realtime), só com a aba visível;
 * - ao reconectar (online / aba volta a ficar visível) confere imediatamente,
 *   recuperando o estado sem depender de mensagens perdidas.
 */
export function LiveRefresher({ matches, realtime }: { matches: Known[]; realtime: boolean }) {
  const router = useRouter();
  const known = useRef(new Map(matches.map((m) => [m.id, m.version])));
  const ids = matches.map((m) => m.id).join(",");

  useEffect(() => {
    known.current = new Map(matches.map((m) => [m.id, m.version]));
  }, [matches]);

  useEffect(() => {
    if (!ids) return;
    let stopped = false;
    let realtimeUp = false;
    let inflight = false;

    async function check() {
      if (inflight || document.visibilityState !== "visible") return;
      inflight = true;
      try {
        const res = await fetch(`/api/public/live?ids=${ids}`, { cache: "no-store" });
        if (!res.ok) return;
        const { matches: rows } = (await res.json()) as { matches: Known[] };
        const changed = rows.some((r) => known.current.get(r.id) !== r.version);
        if (changed && !stopped) {
          rows.forEach((r) => known.current.set(r.id, r.version));
          router.refresh();
        }
      } catch {
        /* offline: a próxima tentativa ou o evento "online" recupera */
      } finally {
        inflight = false;
      }
    }

    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(async () => {
        await check();
        if (!stopped) loop();
      }, realtimeUp ? 60_000 : 5_000);
    };
    loop();

    const onWake = () => void check();
    window.addEventListener("online", onWake);
    document.addEventListener("visibilitychange", onWake);

    let cleanupRealtime: (() => void) | undefined;
    if (realtime) {
      void import("ably").then(({ default: Ably }) => {
        if (stopped) return;
        const client = new Ably.Realtime({ authUrl: "/api/realtime/token", autoConnect: true });
        client.connection.on((s) => {
          const wasUp = realtimeUp;
          realtimeUp = s.current === "connected";
          if (realtimeUp && !wasUp) void check(); // reconectou: recupera o que perdeu
        });
        const channels = ids.split(",").map((id) => client.channels.get(`match:${id}`));
        channels.forEach((ch) => void ch.subscribe("update", () => void check()));
        cleanupRealtime = () => {
          channels.forEach((ch) => ch.unsubscribe());
          client.close();
        };
      });
    }

    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("online", onWake);
      document.removeEventListener("visibilitychange", onWake);
      cleanupRealtime?.();
    };
  }, [ids, realtime, router]);

  return null;
}
