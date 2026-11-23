import "server-only";
import { getServerEnv } from "@/lib/env";

/** Canal público de uma partida. */
export const matchChannel = (matchId: string) => `match:${matchId}`;

/**
 * Publica "a partida mudou" no realtime gerenciado (Ably) — chamado somente
 * DEPOIS do commit no banco. A mensagem leva apenas a versão: o cliente busca
 * o estado oficial no servidor, então nada fica inconsistente se uma mensagem
 * se perder. Sem ABLY_API_KEY, os clientes usam polling.
 */
export async function publishMatchUpdate(matchId: string, version: number): Promise<void> {
  const key = getServerEnv().ABLY_API_KEY;
  if (!key) return;
  try {
    const res = await fetch(`https://rest.ably.io/channels/${encodeURIComponent(matchChannel(matchId))}/messages`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(key).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "update", data: { version } }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) console.warn(`[realtime] publish falhou (${res.status})`);
  } catch (e) {
    // Falha de publicação não desfaz a operação: o polling de reserva cobre.
    console.warn("[realtime] publish indisponível", e instanceof Error ? e.message : e);
  }
}

export function realtimeEnabled(): boolean {
  return !!getServerEnv().ABLY_API_KEY;
}
