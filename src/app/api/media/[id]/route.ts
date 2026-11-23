import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db";
import { media } from "@/db/schema";

/** Imagens são imutáveis (nova imagem = novo id): cache de 1 ano no navegador e na CDN. */
export async function GET(req: Request, ctx: RouteContext<"/api/media/[id]">) {
  await connection();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  if (req.headers.get("if-none-match") === `"${id}"`) return new Response(null, { status: 304 });
  const [m] = await getDb().select({ mime: media.mime, data: media.data }).from(media).where(eq(media.id, id));
  if (!m) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(m.data), {
    headers: {
      "Content-Type": m.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: `"${id}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
