"use client";

import { useSyncExternalStore } from "react";
import { snapshot, type ClockState } from "@/domain/match/clock";

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
export function LiveMinute({ clock, periodMinutes, futsal, fallback }: { clock: ClockState; periodMinutes: number; futsal?: boolean; fallback: string }) {
  const now = useTick();
  if (now === null) return <>{fallback}</>;
  return <>{snapshot(clock, now, { periodMinutes, futsal }).label}</>;
}
