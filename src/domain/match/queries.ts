import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { athletes, matchEvents, matchPlays, matchStats, rosterEntries } from "@/db/schema";

export function listMatchEvents(matchId: string) {
  return getDb()
    .select({
      id: matchEvents.id,
      type: matchEvents.type,
      teamId: matchEvents.teamId,
      minute: matchEvents.minute,
      detail: matchEvents.detail,
      voidedAt: matchEvents.voidedAt,
      clientEventId: matchEvents.clientEventId,
      athleteId: matchEvents.athleteId,
      athleteName: athletes.name,
      athleteNick: athletes.nickname,
    })
    .from(matchEvents)
    .leftJoin(athletes, eq(athletes.id, matchEvents.athleteId))
    .where(eq(matchEvents.matchId, matchId))
    .orderBy(asc(matchEvents.minute), asc(matchEvents.createdAt));
}

export function listMatchStats(matchId: string) {
  return getDb().select().from(matchStats).where(eq(matchStats.matchId, matchId));
}

export function listMatchRoster(competitionId: string, teamIds: string[]) {
  return getDb()
    .select({ athleteId: athletes.id, name: athletes.name, nickname: athletes.nickname, teamId: rosterEntries.teamId, shirtNumber: rosterEntries.shirtNumber })
    .from(rosterEntries)
    .innerJoin(athletes, eq(athletes.id, rosterEntries.athleteId))
    .where(and(eq(rosterEntries.competitionId, competitionId)))
    .orderBy(asc(rosterEntries.shirtNumber), asc(athletes.name))
    .then((rows) => rows.filter((r) => teamIds.includes(r.teamId)));
}

/** Últimos lances do campinho (mais antigo primeiro). */
export async function listMatchPlays(matchId: string, limit = 12) {
  const rows = await getDb().select().from(matchPlays).where(eq(matchPlays.matchId, matchId)).orderBy(desc(matchPlays.createdAt)).limit(limit);
  return rows.reverse();
}
