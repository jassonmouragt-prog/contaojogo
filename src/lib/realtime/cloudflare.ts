import "server-only";

/** Cloudflare Realtime SFU (WebRTC). Sem as variáveis, a narração fica desligada. */
const BASE = "https://rtc.live.cloudflare.com/v1";
export const NARRATION_TRACK = "narracao";

export function realtimeConfigured() {
  return Boolean(process.env.CF_REALTIME_APP_ID && process.env.CF_REALTIME_APP_TOKEN);
}

type Sdp = { type: "offer" | "answer"; sdp: string };
type TracksResponse = { errorCode?: string; errorDescription?: string; requiresImmediateRenegotiation?: boolean; sessionDescription?: Sdp; tracks?: { errorCode?: string; errorDescription?: string }[] };

async function call<T>(method: "POST" | "PUT", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/apps/${process.env.CF_REALTIME_APP_ID}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.CF_REALTIME_APP_TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { errorCode?: string; errorDescription?: string };
  if (!res.ok || json.errorCode) throw new Error(`Realtime ${res.status}: ${json.errorDescription ?? json.errorCode ?? "falha"}`);
  return json;
}

export async function newSession() {
  return (await call<{ sessionId: string }>("POST", "/sessions/new")).sessionId;
}

/** Narrador publica o microfone: recebe a oferta do navegador e devolve a resposta do SFU. */
export async function publish(offer: Sdp, mid: string) {
  const sessionId = await newSession();
  const r = await call<TracksResponse>("POST", `/sessions/${sessionId}/tracks/new`, {
    sessionDescription: offer,
    tracks: [{ location: "local", mid, trackName: NARRATION_TRACK }],
  });
  const err = r.tracks?.find((t) => t.errorCode);
  if (err) throw new Error(err.errorDescription ?? err.errorCode);
  return { sessionId, answer: r.sessionDescription! };
}

/** Ouvinte: nova sessão que puxa a faixa do narrador. O SFU devolve uma oferta. */
export async function subscribe(narratorSessionId: string) {
  const sessionId = await newSession();
  const r = await call<TracksResponse>("POST", `/sessions/${sessionId}/tracks/new`, {
    tracks: [{ location: "remote", sessionId: narratorSessionId, trackName: NARRATION_TRACK }],
  });
  const err = r.tracks?.find((t) => t.errorCode);
  if (err) throw new Error(err.errorDescription ?? err.errorCode);
  return { sessionId, offer: r.sessionDescription! };
}

export async function renegotiate(sessionId: string, answer: Sdp) {
  await call("PUT", `/sessions/${sessionId}/renegotiate`, { sessionDescription: answer });
}
