"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { organizations } from "@/db/schema";
import { recordAudit } from "@/domain/audit/record";
import { authorizeAction } from "@/lib/auth/session";
import type { ActionResult } from "@/domain/users/actions";

const schema = z.object({ name: z.string().trim().min(2).max(80) });

export async function updateOrganization(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("settings.manage");
  if (!actor.organizationId) return { ok: false, message: "Conta sem organização vinculada." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Informe um nome entre 2 e 80 caracteres." };

  return getDb().transaction(async (tx) => {
    const [org] = await tx.select().from(organizations).where(eq(organizations.id, actor.organizationId!)).for("update");
    if (!org) return { ok: false, message: "Organização não encontrada." };
    if (org.name === parsed.data.name) return { ok: true, message: "Nenhuma alteração." };
    await tx.update(organizations).set({ name: parsed.data.name }).where(eq(organizations.id, org.id));
    await recordAudit(tx, {
      organizationId: org.id,
      actorUserId: actor.id,
      action: "organization.updated",
      entityType: "organization",
      entityId: org.id,
      before: { name: org.name },
      after: { name: parsed.data.name },
    });
    revalidatePath("/admin/configuracoes");
    return { ok: true, message: "Configurações salvas." };
  });
}
