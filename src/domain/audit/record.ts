import "server-only";
import type { Database } from "@/db";
import { auditLog } from "@/db/schema";

type Executor = Pick<Database, "insert">;

export type AuditEntry = {
  organizationId?: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
};

/** Grava auditoria dentro da mesma transação da alteração. */
export async function recordAudit(db: Executor, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    organizationId: entry.organizationId ?? null,
    actorUserId: entry.actorUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    before: entry.before ?? null,
    after: entry.after ?? null,
    ipAddress: entry.ipAddress ?? null,
  });
}
