import { eq, inArray } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db";
import * as t from "@/db/schema";
import { recordAudit } from "@/domain/audit/record";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Exportação completa dos dados da organização em JSON (PDF p.21:
 * "exportação de dados", "troca de fornecedor sem bloqueio"). Só o proprietário.
 * Senhas, sessões e tokens não são exportados.
 */
export async function GET() {
  await connection();
  const me = await getCurrentUser();
  if (!me || !can(me.role, "settings.manage") || !me.organizationId) return new Response("Não autorizado", { status: 403 });
  const org = me.organizationId;
  const db = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byOrg = (table: any): Promise<any[]> => db.select().from(table).where(eq(table.organizationId, org));

  const [organization, users, teams, athletes, venues, competitions, matches, sponsors, news, documents, polls, tickets, audit] = await Promise.all([
    db.select().from(t.organizations).where(eq(t.organizations.id, org)),
    db.select({ id: t.user.id, name: t.user.name, email: t.user.email, role: t.user.role, banned: t.user.banned, createdAt: t.user.createdAt }).from(t.user).where(eq(t.user.organizationId, org)),
    byOrg(t.teams), byOrg(t.athletes), byOrg(t.venues), byOrg(t.competitions), byOrg(t.matches),
    byOrg(t.sponsors), byOrg(t.newsPosts), byOrg(t.documents), byOrg(t.nominationPolls), byOrg(t.supportTickets), byOrg(t.auditLog),
  ]);
  const compIds = competitions.map((c: { id: string }) => c.id);
  const matchIds = matches.map((m: { id: string }) => m.id);
  const ids = (a: string[]) => (a.length ? a : ["00000000-0000-0000-0000-000000000000"]);
  const [phases, competitionTeams, rosters, events, stats] = await Promise.all([
    db.select().from(t.competitionPhases).where(inArray(t.competitionPhases.competitionId, ids(compIds))),
    db.select().from(t.competitionTeams).where(inArray(t.competitionTeams.competitionId, ids(compIds))),
    db.select().from(t.rosterEntries).where(inArray(t.rosterEntries.competitionId, ids(compIds))),
    db.select().from(t.matchEvents).where(inArray(t.matchEvents.matchId, ids(matchIds))),
    db.select().from(t.matchStats).where(inArray(t.matchStats.matchId, ids(matchIds))),
  ]);
  await recordAudit(db, { organizationId: org, actorUserId: me.id, action: "data.exported", entityType: "organization", entityId: org });
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), organization, users, teams, athletes, venues, competitions, phases, competitionTeams, rosters, matches, events, stats, sponsors, news, documents, polls, tickets, audit }, null, 2);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(body, { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="contaojogo-export-${day}.json"`, "Cache-Control": "no-store" } });
}
