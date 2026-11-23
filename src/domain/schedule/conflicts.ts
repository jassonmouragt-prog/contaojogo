/**
 * Validação de agenda (PDF p.18): uma equipe ou um local não podem ter
 * dois jogos sobrepostos. Cada jogo ocupa `slotMinutes` a partir do horário.
 */
export type ScheduledSlot = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  venueId: string | null;
  scheduledAt: Date;
};

export type ScheduleConflict =
  | { kind: "team"; teamId: string; matchId: string }
  | { kind: "venue"; venueId: string; matchId: string };

export function slotMinutesFor(periodMinutes: number): number {
  // dois tempos + intervalo + margem operacional
  return periodMinutes * 2 + 15 + 20;
}

export function findScheduleConflicts(
  candidate: Omit<ScheduledSlot, "id"> & { id?: string },
  existing: ScheduledSlot[],
  slotMinutes: number,
): ScheduleConflict[] {
  const start = candidate.scheduledAt.getTime();
  const end = start + slotMinutes * 60_000;
  const out: ScheduleConflict[] = [];
  const teams = new Set([candidate.homeTeamId, candidate.awayTeamId]);
  for (const m of existing) {
    if (candidate.id && m.id === candidate.id) continue;
    const s = m.scheduledAt.getTime();
    const e = s + slotMinutes * 60_000;
    if (!(s < end && start < e)) continue;
    for (const t of [m.homeTeamId, m.awayTeamId]) {
      if (teams.has(t)) out.push({ kind: "team", teamId: t, matchId: m.id });
    }
    if (candidate.venueId && m.venueId === candidate.venueId) {
      out.push({ kind: "venue", venueId: candidate.venueId, matchId: m.id });
    }
  }
  return out;
}
