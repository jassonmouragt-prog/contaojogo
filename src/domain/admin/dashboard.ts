import "server-only";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, session, user } from "@/db/schema";

export async function getDashboardSummary(organizationId: string | null) {
  const db = getDb();
  const orgUser = organizationId ? eq(user.organizationId, organizationId) : undefined;
  const since = new Date(Date.now() - 7 * 86_400_000);

  const [byRole, [activeSessions], recent] = await Promise.all([
    db.select({ role: user.role, total: count() }).from(user).where(orgUser).groupBy(user.role),
    db
      .select({ total: sql<number>`count(distinct ${session.userId})::int` })
      .from(session)
      .innerJoin(user, eq(user.id, session.userId))
      .where(and(gte(session.updatedAt, since), orgUser)),
    db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        createdAt: auditLog.createdAt,
        actorName: user.name,
      })
      .from(auditLog)
      .leftJoin(user, eq(user.id, auditLog.actorUserId))
      .where(organizationId ? eq(auditLog.organizationId, organizationId) : undefined)
      .orderBy(desc(auditLog.createdAt))
      .limit(8),
  ]);

  const roleCount = Object.fromEntries(byRole.map((r) => [r.role, r.total])) as Partial<Record<string, number>>;
  return {
    users: byRole.reduce((a, r) => a + r.total, 0),
    staff: (roleCount.OWNER ?? 0) + (roleCount.ADMIN ?? 0) + (roleCount.OPERATOR ?? 0),
    operators: roleCount.OPERATOR ?? 0,
    activeUsers7d: activeSessions?.total ?? 0,
    recent,
  };
}

export async function listAudit(opts: { organizationId: string | null; page: number; pageSize?: number }) {
  const pageSize = opts.pageSize ?? 50;
  return getDb()
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      before: auditLog.before,
      after: auditLog.after,
      ipAddress: auditLog.ipAddress,
      createdAt: auditLog.createdAt,
      actorName: user.name,
      actorEmail: user.email,
    })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorUserId))
    .where(opts.organizationId ? eq(auditLog.organizationId, opts.organizationId) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(pageSize + 1)
    .offset((opts.page - 1) * pageSize);
}

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "user.role_changed": "Perfil alterado",
  "user.banned": "Acesso bloqueado",
  "user.unbanned": "Acesso liberado",
  "organization.updated": "Configurações alteradas",
  "user.owner_bootstrapped": "Proprietário criado",
  "team.created": "Equipe cadastrada",
  "team.updated": "Equipe alterada",
  "athlete.created": "Atleta cadastrado",
  "athlete.updated": "Atleta alterado",
  "venue.created": "Local cadastrado",
  "competition.created": "Competição criada",
  "competition.updated": "Competição alterada",
  "phase.created": "Fase criada",
  "competition.team_enrolled": "Equipe inscrita",
  "match.created": "Jogo agendado",
  "match.status_changed": "Situação do jogo alterada",
  "match.clock.kick_off": "Cronômetro iniciado",
  "match.clock.pause": "Bola parada",
  "match.clock.resume": "Bola rolando",
  "match.clock.end_period": "Tempo encerrado",
  "match.event_added": "Evento lançado",
  "match.event_voided": "Evento desfeito",
  "match.stats_saved": "Estatísticas lançadas",
  "match.finished": "Súmula encerrada",
  "match.confirmed": "Resultado confirmado",
  "match.reopened": "Súmula reaberta",
  "hero.created": "Banner publicado",
  "user.password_reset": "Senha redefinida pelo admin",
  "user.password_set_cli": "Senha definida via terminal",
};
