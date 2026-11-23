import Ably from "ably";
import { connection } from "next/server";
import { getServerEnv } from "@/lib/env";

/** Token só de leitura para canais públicos de partidas (a chave nunca vai ao navegador). */
export async function GET() {
  await connection();
  const key = getServerEnv().ABLY_API_KEY;
  if (!key) return Response.json({ error: "realtime_disabled" }, { status: 404 });
  const rest = new Ably.Rest({ key });
  const token = await rest.auth.createTokenRequest({ capability: { "match:*": ["subscribe"] }, ttl: 60 * 60 * 1000 });
  return Response.json(token, { headers: { "Cache-Control": "no-store" } });
}
