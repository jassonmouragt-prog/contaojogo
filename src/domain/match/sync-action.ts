"use server";

import { z } from "zod";
import { authorizeAction } from "@/lib/auth/session";
import { applyOp, type OpResult } from "@/domain/match/core";
import { matchOpSchema } from "@/domain/match/ops";
import { requireOrg } from "@/domain/shared/action-helpers";
import { publishMatchUpdate } from "@/lib/realtime";
import { revalidatePath } from "next/cache";

const batchSchema = z.object({ matchId: z.uuid(), ops: z.array(matchOpSchema).min(1).max(200) });

/** Recebe a fila do operador, aplica em ordem e devolve o resultado de cada operação. */
export async function syncMatchOps(input: z.infer<typeof batchSchema>): Promise<{ results: OpResult[] } | { error: string }> {
  const actor = await authorizeAction("match.operate");
  const org = requireOrg(actor);
  const p = batchSchema.safeParse(input);
  if (!p.success) return { error: "Fila inválida." };
  const results: OpResult[] = [];
  for (const op of p.data.ops) results.push(await applyOp({ id: actor.id, organizationId: org }, p.data.matchId, op));
  // Toques do campinho não precisam revalidar páginas (o site busca os lances à parte).
  const kindOf = new Map(p.data.ops.map((o) => [o.clientOpId, o.kind]));
  if (results.some((r) => r.outcome === "applied" && kindOf.get(r.clientOpId) !== "play")) {
    void publishMatchUpdate(p.data.matchId, Date.now());
    revalidatePath(`/admin/jogos/${p.data.matchId}`);
    revalidatePath(`/jogos/${p.data.matchId}`);
    revalidatePath("/");
  }
  return { results };
}
