"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { MatchOp } from "@/domain/match/ops";
import { syncMatchOps } from "@/domain/match/sync-action";
import { enqueue, listQueued, removeQueued, type QueuedOp } from "./outbox";

export type SyncState = "idle" | "syncing" | "offline";

/** Grava a operação na fila local e sincroniza assim que houver conexão. */
export function useOutbox(matchId: string) {
  const router = useRouter();
  const [queued, setQueued] = useState<QueuedOp[]>([]);
  const [state, setState] = useState<SyncState>("idle");
  const flushing = useRef(false);
  const dirty = useRef(false);

  const reload = useCallback(async () => setQueued(await listQueued(matchId)), [matchId]);

  const flush = useCallback(async () => {
    if (flushing.current) { dirty.current = true; return; }
    const pending = await listQueued(matchId);
    if (pending.length === 0) return;
    if (!navigator.onLine) { setState("offline"); return; }
    flushing.current = true;
    setState("syncing");
    let ok = false;
    try {
      const ops = pending.map((q) => {
        const op: Partial<QueuedOp> = { ...q };
        delete op.matchId;
        delete op.seq;
        return op as MatchOp;
      });
      const res = await syncMatchOps({ matchId, ops });
      if ("error" in res) { toast.error(res.error); return; }
      await removeQueued(res.results.map((r) => r.clientOpId));
      res.results.filter((r) => r.outcome === "rejected").forEach((r) => toast.error(`Não aplicado: ${r.message}`));
      const plays = new Set(ops.filter((o) => o.kind === "play").map((o) => o.clientOpId));
      const applied = res.results.filter((r) => r.outcome === "applied" && !plays.has(r.clientOpId));
      if (applied.length === 1) toast.success(applied[0].message);
      else if (applied.length > 1) toast.success(`${applied.length} lançamentos sincronizados.`);
      setState("idle");
      ok = true;
      if (applied.length > 0) router.refresh();
    } catch {
      setState(navigator.onLine ? "idle" : "offline"); // sem rede: tenta de novo depois
    } finally {
      flushing.current = false;
      await reload();
    }
    // Lances lançados enquanto enviava: manda em seguida (sem esperar o próximo ciclo).
    if (ok && dirty.current) { dirty.current = false; setTimeout(() => window.dispatchEvent(new Event(`outbox:${matchId}`)), 0); }
  }, [matchId, reload, router]);

  const push = useCallback(async (op: MatchOp) => {
    await enqueue({ ...op, matchId, seq: Date.now() + Math.random() });
    await reload();
    await flush();
  }, [flush, matchId, reload]);

  const discard = useCallback(async (clientOpId: string) => {
    await removeQueued([clientOpId]);
    await reload();
  }, [reload]);

  useEffect(() => {
    const first = setTimeout(() => void reload().then(flush), 0);
    const online = () => void flush();
    const offline = () => setState("offline");
    window.addEventListener(`outbox:${matchId}`, online);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    const t = setInterval(() => void flush(), 15_000);
    return () => {
      window.removeEventListener(`outbox:${matchId}`, online);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      clearInterval(t);
      clearTimeout(first);
    };
  }, [flush, reload, matchId]);

  return { queued, state, push, discard, flush };
}
