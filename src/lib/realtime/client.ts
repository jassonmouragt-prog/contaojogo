/** WebRTC no navegador para a narração (Cloudflare Realtime). */
export const ICE: RTCIceServer[] = [{ urls: "stun:stun.cloudflare.com:3478" }];

export async function waitIce(pc: RTCPeerConnection, ms = 2500) {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    pc.addEventListener("icegatheringstatechange", () => { if (pc.iceGatheringState === "complete") { clearTimeout(t); resolve(); } });
  });
}

/** Ouvinte: conecta e devolve o fluxo de áudio do narrador. */
export async function listen(matchId: string, onState: (s: RTCPeerConnectionState) => void) {
  const res = await fetch("/api/narration/listen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchId }) });
  const data = (await res.json()) as { sessionId?: string; offer?: RTCSessionDescriptionInit; error?: string };
  if (!res.ok || !data.offer || !data.sessionId) throw new Error(data.error ?? "Narração indisponível.");
  const pc = new RTCPeerConnection({ iceServers: ICE, bundlePolicy: "max-bundle" });
  pc.addEventListener("connectionstatechange", () => onState(pc.connectionState));
  const stream = new Promise<MediaStream>((resolve) => pc.addEventListener("track", (e) => resolve(e.streams[0] ?? new MediaStream([e.track]))));
  await pc.setRemoteDescription(data.offer);
  await pc.setLocalDescription(await pc.createAnswer());
  await waitIce(pc);
  const ok = await fetch("/api/narration/answer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: data.sessionId, answer: pc.localDescription }) });
  if (!ok.ok) { pc.close(); throw new Error("Falha ao conectar."); }
  return { pc, stream: await stream };
}
