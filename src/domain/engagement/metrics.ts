import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { SPONSOR_PLACEMENTS, sponsorMetrics } from "@/db/schema";
import { toLocalDay } from "@/lib/format";

export type Placement = (typeof SPONSOR_PLACEMENTS)[number];
export const isPlacement = (p: string | null): p is Placement => !!p && (SPONSOR_PLACEMENTS as readonly string[]).includes(p);

/** Soma atômica por patrocinador/dia/posição (upsert). */
export async function bumpMetric(sponsorId: string, placement: Placement, kind: "impressions" | "clicks", amount = 1) {
  const day = toLocalDay(new Date());
  await getDb()
    .insert(sponsorMetrics)
    .values({ sponsorId, day, placement, impressions: kind === "impressions" ? amount : 0, clicks: kind === "clicks" ? amount : 0 })
    .onConflictDoUpdate({
      target: [sponsorMetrics.sponsorId, sponsorMetrics.day, sponsorMetrics.placement],
      set: kind === "impressions" ? { impressions: sql`${sponsorMetrics.impressions} + ${amount}` } : { clicks: sql`${sponsorMetrics.clicks} + ${amount}` },
    });
}
