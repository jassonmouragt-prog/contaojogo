import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db";
import { heroSlides } from "@/db/schema";
import { bumpMetric } from "@/domain/engagement/metrics";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/** Clique em banner do topo: conta para o patrocinador (se houver) e redireciona. */
export async function GET(req: Request, ctx: RouteContext<"/api/hero/[id]/click">) {
  await connection();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  const [s] = await getDb().select({ linkUrl: heroSlides.linkUrl, sponsorId: heroSlides.sponsorId }).from(heroSlides).where(eq(heroSlides.id, id));
  if (!s?.linkUrl) return new Response(null, { status: 404 });
  if (s.sponsorId && rateLimit(`hclick:${clientKey(req.headers)}`, 20, 60_000)) await bumpMetric(s.sponsorId, "HOME", "clicks").catch(() => undefined);
  const target = s.linkUrl.startsWith("/") ? new URL(s.linkUrl, req.url).toString() : s.linkUrl;
  return Response.redirect(target, 302);
}
