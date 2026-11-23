"use client";

import { useSyncExternalStore } from "react";
import { snapshot, type ClockState } from "@/domain/match/clock";
import { formatClock } from "@/lib/format";

// Relógio compartilhado: um único intervalo de 1s para todos os componentes.
let current = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** null no servidor/hidratação; depois, o horário atual a cada segundo. */
function useTick(): number | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/** Minuto ao vivo calculado no navegador a partir do estado salvo (sem requisições). */
export function LiveMinute({ clock, periodMinutes, fallback }: { clock: ClockState; periodMinutes: number; fallback: string }) {
  const now = useTick();
  if (now === null) return <>{fallback}</>;
  return <>{snapshot(clock, now, { periodMinutes }).label}</>;
}

export function LiveClocks({ clock, periodMinutes }: { clock: ClockState; periodMinutes: number }) {
  const now = useTick();
  const s = snapshot(clock, now ?? clock.segmentStartedAt ?? 0, { periodMinutes });
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <div className="rounded-xl border bg-background p-3">
        <p className="text-[11px] font-bold uppercase text-muted-foreground">Bola rolando</p>
        <p className="tabular font-mono text-2xl font-bold text-brand-green">{now === null ? "--:--" : formatClock(s.rollingMs)}</p>
      </div>
      <div className="rounded-xl border bg-background p-3">
        <p className="text-[11px] font-bold uppercase text-muted-foreground">Bola parada</p>
        <p className="tabular font-mono text-2xl font-bold text-brand-amber">{now === null ? "--:--" : formatClock(s.stoppedMs)}</p>
      </div>
      <div className="col-span-2 rounded-xl border bg-background p-3 sm:col-span-1">
        <p className="text-[11px] font-bold uppercase text-muted-foreground">Minuto</p>
        <p className="tabular font-mono text-2xl font-bold text-brand-blue">{now === null ? "--" : s.label}</p>
      </div>
    </div>
  );
}
