import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { athletes, competitionGroups, competitionPhases, competitionTeams, competitions, matchEvents, matches, teams } from "@/db/schema";
import { computeScorers, computeStandings, type StandingRow } from "./compute";

/** Somente partidas CONFIRMADAS pelo administrador alimentam rankings oficiais. */
async function confirmedEvents(competitionId: string) {
  return getDb()
    .select({ type: matchEvents.type, teamId: matchEvents.teamId, athleteId: matchEvents.athleteId, detail: matchEvents.detail })
    .from(matchEvents)
    .innerJoin(matches, eq(matches.id, matchEvents.matchId))
    .where(and(eq(matches.competitionId, competitionId), eq(matches.status, "CONFIRMED"), isNull(matchEvents.voidedAt)));
}

export type GroupStanding = { groupId: string | null; groupName: string; rows: StandingRow[] };

export async function getStandings(competition: typeof competitions.$inferSelect): Promise<GroupStanding[]> {
  const db = getDb();
  const [enrolled, groups, results, events] = await Promise.all([
    db.select({ id: teams.id, name: teams.name, slug: teams.slug, crestUrl: teams.crestUrl, groupId: competitionTeams.groupId })
      .from(competitionTeams).innerJoin(teams, eq(teams.id, competitionTeams.teamId))
      .where(eq(competitionTeams.competitionId, competition.id)),
    db.select({ id: competitionGroups.id, name: competitionGroups.name })
      .from(competitionGroups).innerJoin(competitionPhases, eq(competitionPhases.id, competitionGroups.phaseId))
      .where(eq(competitionPhases.competitionId, competition.id)).orderBy(competitionPhases.sortOrder, competitionGroups.sortOrder),
    db.select({ homeId: matches.homeTeamId, awayId: matches.awayTeamId, homeScore: matches.homeScore, awayScore: matches.awayScore, phaseType: competitionPhases.type })
      .from(matches).leftJoin(competitionPhases, eq(competitionPhases.id, matches.phaseId))
      .where(and(eq(matches.competitionId, competition.id), eq(matches.status, "CONFIRMED"))),
    confirmedEvents(competition.id),
  ]);
  // Mata-mata não entra na tabela de pontos.
  const table = results.filter((r) => r.phaseType !== "KNOCKOUT");
  const cards = new Map<string, number>();
  for (const e of events) if (e.type === "YELLOW" || e.type === "RED") cards.set(e.teamId, (cards.get(e.teamId) ?? 0) + (e.type === "RED" ? 3 : 1));
  const rules = { pointsWin: competition.pointsWin, pointsDraw: competition.pointsDraw, pointsLoss: competition.pointsLoss, tiebreakers: competition.tiebreakers };

  const used = groups.filter((g) => enrolled.some((t) => t.groupId === g.id));
  if (used.length === 0) return [{ groupId: null, groupName: "Classificação geral", rows: computeStandings(enrolled, table, rules, cards) }];
  const out: GroupStanding[] = used.map((g) => ({ groupId: g.id, groupName: g.name, rows: computeStandings(enrolled.filter((t) => t.groupId === g.id), table, rules, cards) }));
  const loose = enrolled.filter((t) => !t.groupId);
  if (loose.length) out.push({ groupId: null, groupName: "Sem grupo", rows: computeStandings(loose, table, rules, cards) });
  return out;
}

export async function getScorers(competitionId: string) {
  const events = await confirmedEvents(competitionId);
  const ids = [...new Set(events.flatMap((e) => [e.athleteId, e.detail.assistAthleteId ?? null]).filter((x): x is string => !!x))];
  const people = ids.length
    ? await getDb().select({ id: athletes.id, name: athletes.name, nickname: athletes.nickname, teamName: teams.name })
        .from(athletes).leftJoin(teams, eq(teams.id, athletes.teamId)).where(inArray(athletes.id, ids))
    : [];
  const names = new Map(people.map((p) => [p.id, { name: p.nickname ?? p.name, teamName: p.teamName ?? "" }]));
  return computeScorers(events.map((e) => ({ athleteId: e.athleteId, name: "", teamName: "", type: e.type, ownGoal: e.detail.ownGoal, assistAthleteId: e.detail.assistAthleteId })), names);
}

/** Disciplina por equipe e atletas com cartões (vermelho = suspenso no próximo jogo). */
export async function getDiscipline(competitionId: string) {
  const events = (await confirmedEvents(competitionId)).filter((e) => e.type === "YELLOW" || e.type === "RED");
  const teamIds = [...new Set(events.map((e) => e.teamId))];
  const athleteIds = [...new Set(events.map((e) => e.athleteId).filter((x): x is string => !!x))];
  const [teamRows, people] = await Promise.all([
    teamIds.length ? getDb().select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, teamIds)) : [],
    athleteIds.length ? getDb().select({ id: athletes.id, name: athletes.name, nickname: athletes.nickname }).from(athletes).where(inArray(athletes.id, athleteIds)) : [],
  ]);
  const tName = new Map(teamRows.map((t) => [t.id, t.name]));
  const aName = new Map(people.map((p) => [p.id, p.nickname ?? p.name]));
  const byTeam = new Map<string, { teamId: string; name: string; yellow: number; red: number }>();
  const byAthlete = new Map<string, { athleteId: string; name: string; teamName: string; yellow: number; red: number }>();
  for (const e of events) {
    const t = byTeam.get(e.teamId) ?? { teamId: e.teamId, name: tName.get(e.teamId) ?? "", yellow: 0, red: 0 };
    t[e.type === "RED" ? "red" : "yellow"]++;
    byTeam.set(e.teamId, t);
    if (e.athleteId) {
      const a = byAthlete.get(e.athleteId) ?? { athleteId: e.athleteId, name: aName.get(e.athleteId) ?? "", teamName: tName.get(e.teamId) ?? "", yellow: 0, red: 0 };
      a[e.type === "RED" ? "red" : "yellow"]++;
      byAthlete.set(e.athleteId, a);
    }
  }
  const order = <T extends { yellow: number; red: number; name: string }>(a: T, b: T) => b.red * 3 + b.yellow - (a.red * 3 + a.yellow) || a.name.localeCompare(b.name, "pt-BR");
  return { teams: [...byTeam.values()].sort(order), athletes: [...byAthlete.values()].sort(order) };
}
