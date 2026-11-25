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

export type FlowEvent = { type: string; teamId: string; voided: boolean; period?: string | null };

/** Placar da disputa de pênaltis (null se não houve cobrança). */
export function computePens(events: FlowEvent[], homeTeamId: string) {
  const kicks = events.filter((e) => !e.voided && (e.type === "SHOOTOUT_GOAL" || e.type === "SHOOTOUT_MISS"));
  if (kicks.length === 0) return null;
  let home = 0, away = 0;
  for (const k of kicks) if (k.type === "SHOOTOUT_GOAL") (k.teamId === homeTeamId ? home++ : away++);
  return { home, away };
}

/**
 * Situação da disputa: cobranças de cada lado (em ordem) e se já está decidida.
 * Séries de 5; depois, alternadas até um converter e o outro errar (morte súbita).
 */
export function shootoutState(events: FlowEvent[], homeTeamId: string, awayTeamId: string, series = 5) {
  const kicks = events.filter((e) => !e.voided && (e.type === "SHOOTOUT_GOAL" || e.type === "SHOOTOUT_MISS"));
  const side = (t: string) => kicks.filter((k) => k.teamId === t).map((k) => k.type === "SHOOTOUT_GOAL");
  const home = side(homeTeamId), away = side(awayTeamId);
  const g = (a: boolean[]) => a.filter(Boolean).length;
  const hg = g(home), ag = g(away);
  let winner: "home" | "away" | null = null;
  if (home.length <= series && away.length <= series) {
    const hLeft = series - home.length, aLeft = series - away.length;
    if (hg > ag + aLeft) winner = "home";
    else if (ag > hg + hLeft) winner = "away";
  }
  if (!winner && home.length >= series && home.length === away.length && hg !== ag) winner = hg > ag ? "home" : "away";
  return { home, away, homeGoals: hg, awayGoals: ag, winner };
}

/** Faltas acumuladas de cada equipe no período (futsal: a 6ª em diante dá tiro livre direto). */
export function accumulatedFouls(events: FlowEvent[], teamId: string, period: string) {
  return events.filter((e) => !e.voided && e.type === "FOUL" && e.teamId === teamId && e.period === period).length;
}
export function timeoutsUsed(events: FlowEvent[], teamId: string, period: string) {
  return events.filter((e) => !e.voided && e.type === "TIMEOUT" && e.teamId === teamId && e.period === period).length;
}
export const FREE_KICK_FROM_FOUL = 6;
