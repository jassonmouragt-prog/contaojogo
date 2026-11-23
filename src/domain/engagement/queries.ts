import "server-only";
import { and, arrayContains, asc, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  athletes, documents, newsPosts, nominationPolls, nominations, pollFinalists, rosterEntries, sponsorMetrics, sponsors, supportTickets, teams, ticketMessages, user,
} from "@/db/schema";

/** Patrocinadores ativos e dentro do período para uma posição. */
export function activeSponsors(placement: "HOME" | "COMPETITION" | "MATCH", now: Date) {
  return getDb()
    .select({ id: sponsors.id, name: sponsors.name, logoUrl: sponsors.logoUrl, linkUrl: sponsors.linkUrl, durationSeconds: sponsors.durationSeconds })
    .from(sponsors)
    .where(and(
      eq(sponsors.active, true),
      arrayContains(sponsors.placements, [placement]),
      or(isNull(sponsors.startsAt), lte(sponsors.startsAt, now)),
      or(isNull(sponsors.endsAt), gte(sponsors.endsAt, now)),
    ))
    .orderBy(asc(sponsors.sortOrder));
}

export function listSponsorsWithMetrics(org: string) {
  return getDb()
    .select({
      id: sponsors.id, name: sponsors.name, logoUrl: sponsors.logoUrl, linkUrl: sponsors.linkUrl, active: sponsors.active,
      placements: sponsors.placements, durationSeconds: sponsors.durationSeconds, startsAt: sponsors.startsAt, endsAt: sponsors.endsAt,
      impressions: sql<number>`coalesce((select sum(${sponsorMetrics.impressions}) from ${sponsorMetrics} where ${sponsorMetrics.sponsorId} = ${sponsors.id}),0)::int`,
      clicks: sql<number>`coalesce((select sum(${sponsorMetrics.clicks}) from ${sponsorMetrics} where ${sponsorMetrics.sponsorId} = ${sponsors.id}),0)::int`,
      impressions7d: sql<number>`coalesce((select sum(${sponsorMetrics.impressions}) from ${sponsorMetrics} where ${sponsorMetrics.sponsorId} = ${sponsors.id} and ${sponsorMetrics.day} >= current_date - 6),0)::int`,
      clicks7d: sql<number>`coalesce((select sum(${sponsorMetrics.clicks}) from ${sponsorMetrics} where ${sponsorMetrics.sponsorId} = ${sponsors.id} and ${sponsorMetrics.day} >= current_date - 6),0)::int`,
    })
    .from(sponsors)
    .where(eq(sponsors.organizationId, org))
    .orderBy(asc(sponsors.sortOrder));
}

export function publishedNews(now: Date, limit = 20) {
  return getDb().select().from(newsPosts)
    .where(and(eq(newsPosts.published, true), lte(newsPosts.publishAt, now), or(isNull(newsPosts.expiresAt), gte(newsPosts.expiresAt, now))))
    .orderBy(desc(newsPosts.publishAt)).limit(limit);
}

export async function newsBySlug(slug: string, now: Date) {
  const [n] = await getDb().select().from(newsPosts)
    .where(and(eq(newsPosts.slug, slug), eq(newsPosts.published, true), lte(newsPosts.publishAt, now), or(isNull(newsPosts.expiresAt), gte(newsPosts.expiresAt, now))));
  return n ?? null;
}

export function listNewsAdmin(org: string) {
  return getDb().select().from(newsPosts).where(eq(newsPosts.organizationId, org)).orderBy(desc(newsPosts.createdAt)).limit(100);
}

export function listDocuments(opts: { org?: string; competitionId?: string; publicOnly?: boolean }) {
  const f = [];
  if (opts.org) f.push(eq(documents.organizationId, opts.org));
  if (opts.competitionId) f.push(eq(documents.competitionId, opts.competitionId));
  if (opts.publicOnly) f.push(eq(documents.published, true));
  return getDb().select().from(documents).where(f.length ? and(...f) : undefined).orderBy(desc(documents.createdAt));
}

export function listPolls(org?: string) {
  return getDb().select().from(nominationPolls).where(org ? eq(nominationPolls.organizationId, org) : undefined).orderBy(desc(nominationPolls.createdAt));
}

/** Contagem de indicações por atleta (indicações ocultadas pela moderação não contam). */
export function nominationTally(pollId: string) {
  return getDb()
    .select({ athleteId: athletes.id, name: athletes.name, nickname: athletes.nickname, teamName: teams.name, total: sql<number>`count(*)::int` })
    .from(nominations)
    .innerJoin(athletes, eq(athletes.id, nominations.athleteId))
    .leftJoin(teams, eq(teams.id, athletes.teamId))
    .where(and(eq(nominations.pollId, pollId), eq(nominations.hidden, false)))
    .groupBy(athletes.id, teams.name)
    .orderBy(desc(sql`count(*)`), asc(athletes.name));
}

export function recentNominations(pollId: string) {
  return getDb()
    .select({ id: nominations.id, reason: nominations.reason, hidden: nominations.hidden, createdAt: nominations.createdAt, athleteName: athletes.name, userName: user.name })
    .from(nominations).innerJoin(athletes, eq(athletes.id, nominations.athleteId)).innerJoin(user, eq(user.id, nominations.userId))
    .where(eq(nominations.pollId, pollId)).orderBy(desc(nominations.createdAt)).limit(50);
}

export function finalists(pollId: string) {
  return getDb()
    .select({ position: pollFinalists.position, athleteId: athletes.id, name: athletes.name, nickname: athletes.nickname, teamName: teams.name })
    .from(pollFinalists).innerJoin(athletes, eq(athletes.id, pollFinalists.athleteId)).leftJoin(teams, eq(teams.id, athletes.teamId))
    .where(eq(pollFinalists.pollId, pollId)).orderBy(asc(pollFinalists.position));
}

/** Atletas elegíveis: inscritos na competição da enquete (ou todos os ativos). */
export function eligibleAthletes(competitionId: string | null) {
  const db = getDb();
  if (competitionId) {
    return db.select({ id: athletes.id, name: athletes.name, nickname: athletes.nickname, teamName: teams.name })
      .from(rosterEntries).innerJoin(athletes, eq(athletes.id, rosterEntries.athleteId)).innerJoin(teams, eq(teams.id, rosterEntries.teamId))
      .where(eq(rosterEntries.competitionId, competitionId)).orderBy(asc(teams.name), asc(athletes.name));
  }
  return db.select({ id: athletes.id, name: athletes.name, nickname: athletes.nickname, teamName: teams.name })
    .from(athletes).leftJoin(teams, eq(teams.id, athletes.teamId)).where(eq(athletes.active, true)).orderBy(asc(teams.name), asc(athletes.name));
}

export async function myNomination(pollId: string, userId: string) {
  const [n] = await getDb().select({ athleteName: athletes.name }).from(nominations).innerJoin(athletes, eq(athletes.id, nominations.athleteId))
    .where(and(eq(nominations.pollId, pollId), eq(nominations.userId, userId)));
  return n ?? null;
}

export function listTickets(org: string) {
  return getDb().select().from(supportTickets).where(eq(supportTickets.organizationId, org)).orderBy(asc(sql`case ${supportTickets.status} when 'OPEN' then 0 when 'IN_PROGRESS' then 1 else 2 end`), desc(supportTickets.createdAt)).limit(200);
}

export function myTickets(userId: string) {
  return getDb().select().from(supportTickets).where(eq(supportTickets.userId, userId)).orderBy(desc(supportTickets.createdAt)).limit(50);
}

export function ticketThread(ticketId: string) {
  return getDb().select({ id: ticketMessages.id, body: ticketMessages.body, fromStaff: ticketMessages.fromStaff, createdAt: ticketMessages.createdAt })
    .from(ticketMessages).where(eq(ticketMessages.ticketId, ticketId)).orderBy(asc(ticketMessages.createdAt));
}
