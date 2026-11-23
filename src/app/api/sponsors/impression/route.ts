import { and, eq, inArray } from "drizzle-orm";
import { connection } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { sponsors } from "@/db/schema";
import { bumpMetric, isPlacement } from "@/domain/engagement/metrics";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const body = z.object({ placement: z.string(), ids: z.array(z.uuid()).min(1).max(20) });

/** Registra visualizações (enviado por sendBeacon em lote). */
export async function POST(req: Request) {
  await connection();
  if (!rateLimit(`imp:${clientKey(req.headers)}`, 30, 60_000)) return new Response(null, { status: 429 });
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success || !isPlacement(p.data.placement)) return new Response(null, { status: 400 });
  const placement = p.data.placement;
  const valid = await getDb().select({ id: sponsors.id }).from(sponsors).where(and(inArray(sponsors.id, p.data.ids), eq(sponsors.active, true)));
  const counts = new Map<string, number>();
  for (const id of p.data.ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  await Promise.all(valid.map((v) => bumpMetric(v.id, placement, "impressions", Math.min(counts.get(v.id) ?? 0, 20))));
  return new Response(null, { status: 204 });
}
