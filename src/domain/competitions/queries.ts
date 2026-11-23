import "server-only";
import { aliasedTable, and, asc, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  athletes,
  competitionGroups,
  competitionPhases,
  competitionTeams,
  competitions,
  matches,
  rosterEntries,
  teams,
  venues,
} from "@/db/schema";

const home = aliasedTable(teams, "home");
const away = aliasedTable(teams, "away");

export const matchSelect = {
  id: matches.id,
  version: matches.version,
  status: matches.status,
  scheduledAt: matches.scheduledAt,
  homeScore: matches.homeScore,
  awayScore: matches.awayScore,
  round: matches.round,
  period: matches.period,
  ballInPlay: matches.ballInPlay,
  segmentStartedAt: matches.segmentStartedAt,
  rollingMs: matches.rollingMs,
  stoppedMs: matches.stoppedMs,
  refereeName: matches.refereeName,
  competitionId: competitions.id,
  competitionName: competitions.name,
  competitionSlug: competitions.slug,
  periodMinutes: competitions.periodMinutes,
  phaseName: competitionPhases.name,
  groupName: competitionGroups.name,
  venueName: venues.name,
  homeId: home.id,
  homeName: home.name,
  homeSlug: home.slug,
  homeCrest: home.crestUrl,
  awayId: away.id,
  awayName: away.name,
  awaySlug: away.slug,
  awayCrest: away.crestUrl,
};

function matchQuery() {
  return getDb()
    .select(matchSelect)
    .from(matches)
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .innerJoin(home, eq(home.id, matches.homeTeamId))
    .innerJoin(away, eq(away.id, matches.awayTeamId))
    .leftJoin(competitionPhases, eq(competitionPhases.id, matches.phaseId))
    .leftJoin(competitionGroups, eq(competitionGroups.id, matches.groupId))
    .leftJoin(venues, eq(venues.id, matches.venueId));
}

export type MatchListItem = Awaited<ReturnType<typeof listMatchesBetween>>[number];

/** Jogos entre duas datas. `publicOnly` restringe a competições publicadas. */
export function listMatchesBetween(opts: { organizationId?: string | null; from: Date; to: Date; publicOnly?: boolean; competitionId?: string }) {
  const filters = [gte(matches.scheduledAt, opts.from), lt(matches.scheduledAt, opts.to)];
  if (opts.organizationId) filters.push(eq(matches.organizationId, opts.organizationId));
  if (opts.publicOnly) filters.push(eq(competitions.published, true));
  if (opts.competitionId) filters.push(eq(matches.competitionId, opts.competitionId));
  return matchQuery()
    .where(and(...filters))
    .orderBy(asc(competitions.name), asc(matches.scheduledAt));
}

export function listCompetitionMatches(competitionId: string) {
  return matchQuery().where(eq(matches.competitionId, competitionId)).orderBy(asc(matches.scheduledAt));
}

export function listTeamMatches(teamId: string, publicOnly: boolean) {
  const f = [sql`(${matches.homeTeamId} = ${teamId} or ${matches.awayTeamId} = ${teamId})`];
  if (publicOnly) f.push(eq(competitions.published, true));
  return matchQuery().where(and(...f)).orderBy(asc(matches.scheduledAt));
}

export async function getMatch(id: string) {
  const [m] = await matchQuery().where(eq(matches.id, id)).limit(1);
  return m ?? null;
}

export async function listCompetitions(opts: { organizationId?: string | null; publicOnly?: boolean }) {
  const f = [];
  if (opts.organizationId) f.push(eq(competitions.organizationId, opts.organizationId));
  if (opts.publicOnly) f.push(eq(competitions.published, true));
  return getDb()
    .select({
      id: competitions.id,
      name: competitions.name,
      slug: competitions.slug,
      season: competitions.season,
      modality: competitions.modality,
      status: competitions.status,
      city: competitions.city,
      published: competitions.published,
      teamCount: sql<number>`(select count(*)::int from ${competitionTeams} where ${competitionTeams.competitionId} = ${competitions.id})`,
      currentPhase: sql<string | null>`(select ${competitionPhases.name} from ${competitionPhases} where ${competitionPhases.competitionId} = ${competitions.id} order by ${competitionPhases.sortOrder} desc limit 1)`,
    })
    .from(competitions)
    .where(f.length ? and(...f) : undefined)
    .orderBy(desc(competitions.createdAt));
}

export async function getCompetitionBy(opts: { id?: string; slug?: string; organizationId?: string | null; publicOnly?: boolean }) {
  const f = [];
  if (opts.id) f.push(eq(competitions.id, opts.id));
  if (opts.slug) f.push(eq(competitions.slug, opts.slug));
  if (opts.organizationId) f.push(eq(competitions.organizationId, opts.organizationId));
  if (opts.publicOnly) f.push(eq(competitions.published, true));
  const [c] = await getDb().select().from(competitions).where(and(...f)).limit(1);
  return c ?? null;
}

export async function getCompetitionStructure(competitionId: string) {
  const db = getDb();
  const [phases, groups, enrolled] = await Promise.all([
    db.select().from(competitionPhases).where(eq(competitionPhases.competitionId, competitionId)).orderBy(asc(competitionPhases.sortOrder)),
    db
      .select({ id: competitionGroups.id, name: competitionGroups.name, phaseId: competitionGroups.phaseId })
      .from(competitionGroups)
      .innerJoin(competitionPhases, eq(competitionPhases.id, competitionGroups.phaseId))
      .where(eq(competitionPhases.competitionId, competitionId))
      .orderBy(asc(competitionGroups.sortOrder)),
    db
      .select({
        teamId: teams.id,
        name: teams.name,
        slug: teams.slug,
        crestUrl: teams.crestUrl,
        groupId: competitionTeams.groupId,
        athletes: sql<number>`(select count(*)::int from ${rosterEntries} where ${rosterEntries.competitionId} = ${competitionId} and ${rosterEntries.teamId} = ${teams.id})`,
      })
      .from(competitionTeams)
      .innerJoin(teams, eq(teams.id, competitionTeams.teamId))
      .where(eq(competitionTeams.competitionId, competitionId))
      .orderBy(asc(teams.name)),
  ]);
  return { phases, groups, enrolled };
}

export async function getCompetitionSummary(competitionId: string) {
  const [row] = await getDb()
    .select({
      matches: count(),
      played: sql<number>`count(*) filter (where ${matches.status} in ('FINISHED','CONFIRMED'))::int`,
      goals: sql<number>`coalesce(sum(${matches.homeScore} + ${matches.awayScore}) filter (where ${matches.status} = 'CONFIRMED'), 0)::int`,
      confirmed: sql<number>`count(*) filter (where ${matches.status} = 'CONFIRMED')::int`,
    })
    .from(matches)
    .where(eq(matches.competitionId, competitionId));
  return row;
}

export async function listTeams(organizationId: string | null) {
  return getDb()
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      city: teams.city,
      crestUrl: teams.crestUrl,
      active: teams.active,
      athletes: sql<number>`(select count(*)::int from ${athletes} where ${athletes.teamId} = ${teams.id} and ${athletes.active})`,
    })
    .from(teams)
    .where(organizationId ? eq(teams.organizationId, organizationId) : undefined)
    .orderBy(asc(teams.name));
}

export async function getTeamBy(opts: { id?: string; slug?: string; organizationId?: string | null }) {
  const f = [];
  if (opts.id) f.push(eq(teams.id, opts.id));
  if (opts.slug) f.push(eq(teams.slug, opts.slug));
  if (opts.organizationId) f.push(eq(teams.organizationId, opts.organizationId));
  const [t] = await getDb().select().from(teams).where(and(...f)).limit(1);
  return t ?? null;
}

export function listTeamAthletes(teamId: string, includeInactive = true) {
  const f = [eq(athletes.teamId, teamId)];
  if (!includeInactive) f.push(eq(athletes.active, true));
  return getDb()
    .select()
    .from(athletes)
    .where(and(...f))
    .orderBy(asc(athletes.shirtNumber), asc(athletes.name));
}

export function listVenues(organizationId: string | null) {
  return getDb()
    .select()
    .from(venues)
    .where(organizationId ? eq(venues.organizationId, organizationId) : undefined)
    .orderBy(asc(venues.name));
}

/** Competições publicadas de que a equipe participa. */
export function listTeamCompetitions(teamId: string) {
  return getDb()
    .select({ id: competitions.id, name: competitions.name, slug: competitions.slug, groupName: competitionGroups.name })
    .from(competitionTeams)
    .innerJoin(competitions, eq(competitions.id, competitionTeams.competitionId))
    .leftJoin(competitionGroups, eq(competitionGroups.id, competitionTeams.groupId))
    .where(and(eq(competitionTeams.teamId, teamId), eq(competitions.published, true)));
}

