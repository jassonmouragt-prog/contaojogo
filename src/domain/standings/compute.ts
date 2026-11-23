import type { Tiebreaker } from "@/db/schema";

export type StandingTeam = { id: string; name: string; slug: string; crestUrl: string | null; groupId: string | null };
export type ResultMatch = { homeId: string; awayId: string; homeScore: number; awayScore: number };
export type Rules = { pointsWin: number; pointsDraw: number; pointsLoss: number; tiebreakers: Tiebreaker[] };

export type StandingRow = StandingTeam & {
  position: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  cards: number;
};

function blank(t: StandingTeam, cards: number): StandingRow {
  return { ...t, position: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, cards };
}

function apply(rows: Map<string, StandingRow>, m: ResultMatch, r: Rules) {
  const h = rows.get(m.homeId);
  const a = rows.get(m.awayId);
  if (!h || !a) return;
  h.played++; a.played++;
  h.goalsFor += m.homeScore; h.goalsAgainst += m.awayScore;
  a.goalsFor += m.awayScore; a.goalsAgainst += m.homeScore;
  if (m.homeScore > m.awayScore) { h.wins++; a.losses++; h.points += r.pointsWin; a.points += r.pointsLoss; }
  else if (m.homeScore < m.awayScore) { a.wins++; h.losses++; a.points += r.pointsWin; h.points += r.pointsLoss; }
  else { h.draws++; a.draws++; h.points += r.pointsDraw; a.points += r.pointsDraw; }
  h.goalDiff = h.goalsFor - h.goalsAgainst;
  a.goalDiff = a.goalsFor - a.goalsAgainst;
}

/** Pontos em confronto direto entre as equipes empatadas (mini-tabela). */
function headToHeadPoints(ids: Set<string>, matches: ResultMatch[], r: Rules) {
  const pts = new Map<string, number>([...ids].map((id) => [id, 0]));
  const gd = new Map<string, number>([...ids].map((id) => [id, 0]));
  for (const m of matches) {
    if (!ids.has(m.homeId) || !ids.has(m.awayId)) continue;
    const d = m.homeScore - m.awayScore;
    gd.set(m.homeId, gd.get(m.homeId)! + d);
    gd.set(m.awayId, gd.get(m.awayId)! - d);
    if (d > 0) { pts.set(m.homeId, pts.get(m.homeId)! + r.pointsWin); pts.set(m.awayId, pts.get(m.awayId)! + r.pointsLoss); }
    else if (d < 0) { pts.set(m.awayId, pts.get(m.awayId)! + r.pointsWin); pts.set(m.homeId, pts.get(m.homeId)! + r.pointsLoss); }
    else { pts.set(m.homeId, pts.get(m.homeId)! + r.pointsDraw); pts.set(m.awayId, pts.get(m.awayId)! + r.pointsDraw); }
  }
  return { pts, gd };
}

const KEY: Record<Exclude<Tiebreaker, "HEAD_TO_HEAD">, (r: StandingRow) => number> = {
  POINTS: (r) => r.points,
  WINS: (r) => r.wins,
  GOAL_DIFF: (r) => r.goalDiff,
  GOALS_FOR: (r) => r.goalsFor,
  FEWEST_CARDS: (r) => -r.cards,
};

/**
 * Ordena um bloco de equipes aplicando os critérios em sequência. Quando um
 * critério separa o bloco em sub-blocos empatados, cada sub-bloco segue para
 * o próximo critério; o confronto direto é recalculado só entre as empatadas.
 */
function rank(block: StandingRow[], criteria: Tiebreaker[], matches: ResultMatch[], r: Rules): StandingRow[] {
  if (block.length <= 1 || criteria.length === 0) return [...block].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const [c, ...rest] = criteria;
  let score: (row: StandingRow) => number;
  if (c === "HEAD_TO_HEAD") {
    const { pts, gd } = headToHeadPoints(new Set(block.map((b) => b.id)), matches, r);
    score = (row) => pts.get(row.id)! * 1000 + gd.get(row.id)!;
  } else score = KEY[c];
  const buckets = new Map<number, StandingRow[]>();
  for (const row of block) buckets.set(score(row), [...(buckets.get(score(row)) ?? []), row]);
  return [...buckets.entries()].sort((a, b) => b[0] - a[0]).flatMap(([, rows]) => rank(rows, rest, matches, r));
}

/** Classificação a partir apenas de resultados confirmados. */
export function computeStandings(
  teams: StandingTeam[],
  matches: ResultMatch[],
  rules: Rules,
  cardsByTeam: Map<string, number> = new Map(),
): StandingRow[] {
  const rows = new Map(teams.map((t) => [t.id, blank(t, cardsByTeam.get(t.id) ?? 0)]));
  for (const m of matches) apply(rows, m, rules);
  const criteria: Tiebreaker[] = rules.tiebreakers.includes("POINTS") ? rules.tiebreakers : ["POINTS", ...rules.tiebreakers];
  return rank([...rows.values()], criteria, matches, rules).map((row, i) => ({ ...row, position: i + 1 }));
}

export type ScorerEvent = { athleteId: string | null; name: string; teamName: string; type: string; ownGoal?: boolean; assistAthleteId?: string | null };

/** Artilharia: gols não anulados, sem gols contra; desempate por assistências e nome. */
export function computeScorers(events: ScorerEvent[], names: Map<string, { name: string; teamName: string }>) {
  const map = new Map<string, { athleteId: string; name: string; teamName: string; goals: number; assists: number }>();
  const get = (id: string) => {
    let row = map.get(id);
    if (!row) {
      const n = names.get(id);
      row = { athleteId: id, name: n?.name ?? "—", teamName: n?.teamName ?? "", goals: 0, assists: 0 };
      map.set(id, row);
    }
    return row;
  };
  for (const e of events) {
    if (e.type !== "GOAL" || e.ownGoal) continue;
    if (e.athleteId) get(e.athleteId).goals++;
    if (e.assistAthleteId) get(e.assistAthleteId).assists++;
  }
  return [...map.values()]
    .filter((r) => r.goals > 0 || r.assists > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name, "pt-BR"));
}
