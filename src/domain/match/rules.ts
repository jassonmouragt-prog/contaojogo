/** Regras puras da operação da partida (testadas em tests/unit/match-rules.test.ts). */

export type ScoringEvent = { type: string; teamId: string; voided: boolean; ownGoal?: boolean };

/** Placar a partir dos gols não anulados (gol contra conta para o adversário). */
export function computeScore(events: ScoringEvent[], homeTeamId: string, awayTeamId: string) {
  let home = 0;
  let away = 0;
  for (const e of events) {
    if (e.type !== "GOAL" || e.voided) continue;
    const forHome = e.ownGoal ? e.teamId === awayTeamId : e.teamId === homeTeamId;
    if (forHome) home++;
    else away++;
  }
  return { home, away };
}

export type TeamStats = { shots: number; shotsOnTarget: number; corners: number; offsides: number };

export function validateStats(s: TeamStats, goals: number): string | null {
  for (const v of Object.values(s)) if (!Number.isInteger(v) || v < 0 || v > 99) return "Valores entre 0 e 99.";
  if (s.shotsOnTarget > s.shots) return "Chutes no gol não podem passar das finalizações.";
  if (goals > s.shotsOnTarget) return "Há mais gols que chutes no gol — confira os números.";
  return null;
}

/** Transições permitidas do status da partida. */
export const MATCH_TRANSITIONS: Record<string, readonly string[]> = {
  SCHEDULED: ["LIVE"],
  LIVE: ["FINISHED"],
  FINISHED: ["CONFIRMED", "LIVE"],
  CONFIRMED: [],
};

export function canTransition(from: string, to: string): boolean {
  return MATCH_TRANSITIONS[from]?.includes(to) ?? false;
}
