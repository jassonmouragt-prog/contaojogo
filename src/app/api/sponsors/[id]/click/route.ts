import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db";
import { sponsors } from "@/db/schema";
import { bumpMetric, isPlacement } from "@/domain/engagement/metrics";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/** Conta o clique e redireciona para o link cadastrado (somente https). */
export async function GET(req: Request, ctx: RouteContext<"/api/sponsors/[id]/click">) {
  await connection();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  const [s] = await getDb().select({ linkUrl: sponsors.linkUrl, active: sponsors.active }).from(sponsors).where(eq(sponsors.id, id));
  if (!s?.linkUrl || !s.linkUrl.startsWith("https://")) return new Response(null, { status: 404 });
  const p = new URL(req.url).searchParams.get("p");
  // Cliques repetidos do mesmo IP (>20/min) redirecionam mas não contam.
  if (s.active && isPlacement(p) && rateLimit(`click:${clientKey(req.headers)}`, 20, 60_000)) await bumpMetric(id, p, "clicks").catch(() => undefined);
  return Response.redirect(s.linkUrl, 302);
}
