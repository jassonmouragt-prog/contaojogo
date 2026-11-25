import { z } from "zod";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { renegotiate } from "@/lib/realtime/cloudflare";

const body = z.object({ sessionId: z.string().min(8).max(128), answer: z.object({ type: z.literal("answer"), sdp: z.string().max(20_000) }) });

/** Torcedor devolve a resposta SDP para concluir a conexão. */
export async function POST(req: Request) {
  if (!rateLimit(`answer:${clientKey(req.headers)}`, 20, 60_000)) return Response.json({ error: "Muitas tentativas." }, { status: 429 });
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    await renegotiate(p.data.sessionId, p.data.answer);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("narration answer", e);
    return Response.json({ error: "Falha ao conectar." }, { status: 502 });
  }
}
