import "server-only";
import { and, eq, inArray, isNull, type SQL } from "drizzle-orm";
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

type ScopeOpts = { competitionId?: string; teamId?: string; includeUnconfirmed?: boolean };

/**
 * Artilharia por competição e/ou equipe. Oficial = só jogos CONFIRMADOS.
 * Com includeUnconfirmed, separa os gols de jogos encerrados/ao vivo ainda
 * não confirmados (visão do admin).
 */
export async function getScorersBy(opts: ScopeOpts) {
  const f: SQL[] = [isNull(matchEvents.voidedAt), eq(matchEvents.type, "GOAL")];
  if (opts.competitionId) f.push(eq(matches.competitionId, opts.competitionId));
  if (opts.teamId) f.push(eq(matchEvents.teamId, opts.teamId));
  f.push(opts.includeUnconfirmed ? inArray(matches.status, ["CONFIRMED", "FINISHED", "LIVE"]) : eq(matches.status, "CONFIRMED"));
  const rows = await getDb()
    .select({ athleteId: matchEvents.athleteId, detail: matchEvents.detail, status: matches.status, publishedComp: competitions.published })
    .from(matchEvents)
    .innerJoin(matches, eq(matches.id, matchEvents.matchId))
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .where(and(...f));
  const tally = new Map<string, { goals: number; pending: number; assists: number }>();
  const get = (id: string) => tally.get(id) ?? tally.set(id, { goals: 0, pending: 0, assists: 0 }).get(id)!;
  for (const r of rows) {
    if (!opts.competitionId && !opts.includeUnconfirmed && !r.publishedComp) continue;
    const official = r.status === "CONFIRMED";
    if (r.athleteId && !r.detail.ownGoal) {
      if (official) get(r.athleteId).goals++;
      else get(r.athleteId).pending++;
    }
    if (r.detail.assistAthleteId && official) get(r.detail.assistAthleteId).assists++;
  }
  const ids = [...tally.keys()];
  if (ids.length === 0) return [];
  const people = await getDb()
    .select({ id: athletes.id, name: athletes.name, nickname: athletes.nickname, shirtNumber: athletes.shirtNumber, teamName: teams.name, teamSlug: teams.slug, crestUrl: teams.crestUrl })
    .from(athletes).leftJoin(teams, eq(teams.id, athletes.teamId)).where(inArray(athletes.id, ids));
  return people
    .map((p) => ({ athleteId: p.id, name: p.nickname ?? p.name, shirtNumber: p.shirtNumber, teamName: p.teamName ?? "", teamSlug: p.teamSlug, crestUrl: p.crestUrl, ...tally.get(p.id)! }))
    .filter((r) => r.goals + r.pending + r.assists > 0)
    .sort((a, b) => b.goals - a.goals || b.pending - a.pending || b.assists - a.assists || a.name.localeCompare(b.name, "pt-BR"));
}

/** Gols oficiais por atleta (mapa) — usado no elenco da equipe. */
export async function goalsByAthlete(teamId: string) {
  const list = await getScorersBy({ teamId });
  return new Map(list.map((r) => [r.athleteId, r.goals]));
}
