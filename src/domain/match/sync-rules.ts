/** Regras puras da sincronização offline (testadas). */

/** Horário informado pelo aparelho, limitado ao intervalo plausível. */
export function clampClientTime(at: number, serverNow: number, lowerBound: number | null): number {
  const upper = serverNow;
  const lower = lowerBound ?? serverNow - 6 * 3_600_000;
  if (!Number.isFinite(at)) return serverNow;
  return Math.min(upper, Math.max(lower, at));
}

/** Estatísticas: vence a leitura mais recente do aparelho (last-write-wins por horário). */
export function shouldApplyStats(clientAt: number, storedAt: Date | null): boolean {
  return storedAt === null || clientAt >= storedAt.getTime();
}

export type SyncOutcome = "applied" | "duplicate" | "rejected";
