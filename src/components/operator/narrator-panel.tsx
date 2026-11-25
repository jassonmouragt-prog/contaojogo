"use client";

import { useEffect, useRef, useState } from "react";
import { ICE, waitIce } from "@/lib/realtime/client";
import { cn } from "@/lib/utils";

/**
 * Painel do narrador: transmite a voz do celular para quem está na página do jogo.
 * Se a conexão cair, tenta voltar sozinho.
 */
export function NarratorPanel({ matchId, configured, initialOn }: { matchId: string; configured: boolean; initialOn: boolean }) {
  const [state, setState] = useState<"off" | "starting" | "live" | "reconnecting">("off");
  const [error, setError] = useState(initialOn ? "Havia uma narração aberta. Toque em começar para assumir." : "");
  const [level, setLevel] = useState(0);
  const [muted, setMuted] = useState(false);
  const [since, setSince] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const want = useRef(false);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); want.current = false; pcRef.current?.close(); streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  async function connect() {
    const stream = streamRef.current!;
    const pc = new RTCPeerConnection({ iceServers: ICE, bundlePolicy: "max-bundle" });
    const tr = pc.addTransceiver(stream.getAudioTracks()[0], { direction: "sendonly" });
    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "connected") { setState("live"); setError(""); }
      if ((pc.connectionState === "failed" || pc.connectionState === "disconnected") && want.current) {
        setState("reconnecting");
        setTimeout(() => { if (want.current) void connect().catch((e) => setError(String(e))); }, 2000);
      }
    });
    await pc.setLocalDescription(await pc.createOffer());
    await waitIce(pc);
    const res = await fetch("/api/narration/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchId, mid: tr.mid, offer: pc.localDescription }) });
    const data = (await res.json()) as { answer?: RTCSessionDescriptionInit; error?: string };
    if (!res.ok || !data.answer) { pc.close(); throw new Error(data.error ?? "Falha ao transmitir."); }
    await pc.setRemoteDescription(data.answer);
    pcRef.current?.close();
    pcRef.current = pc;
  }

  async function start() {
    setError(""); setState("starting"); want.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      meter(stream);
      try { wake.current = await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null; } catch { /* sem wake lock */ }
      await connect();
      setSince(Date.now());
    } catch (e) {
      want.current = false; setState("off");
      setError(e instanceof DOMException && e.name === "NotAllowedError" ? "Permita o uso do microfone no navegador para narrar." : e instanceof Error ? e.message : "Falha ao iniciar.");
    }
  }

  async function stop() {
    want.current = false;
    pcRef.current?.close(); pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null;
    await wake.current?.release().catch(() => {});
    await fetch("/api/narration/stop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchId }) });
    setState("off"); setSince(null); setLevel(0);
  }

  function meter(stream: MediaStream) {
    const ctx = new AudioContext();
    const an = ctx.createAnalyser(); an.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    const tick = () => {
      if (!streamRef.current) { void ctx.close(); return; }
      an.getByteFrequencyData(buf);
      setLevel(Math.min(1, buf.reduce((a, b) => a + b, 0) / buf.length / 90));
      requestAnimationFrame(tick);
    };
    tick();
  }

  function toggleMute() {
    const t = streamRef.current?.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled; setMuted(!t.enabled);
  }

  const elapsed = since ? Math.floor((now - since) / 1000) : 0;
  if (!configured) return <p className="rounded-xl border border-brand-amber/50 bg-brand-amber/10 p-4 text-sm text-brand-amber">A narração ainda não foi configurada (conta da Cloudflare). Assim que configurar, este painel libera.</p>;
  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <div className={cn("relative mx-auto grid size-48 place-items-center rounded-full border-4 transition-colors", state === "live" ? "border-brand-live" : "border-muted")}>
        <span className="absolute inset-0 rounded-full bg-brand-live/20 transition-transform" style={{ transform: `scale(${0.6 + level * 0.4})`, opacity: state === "live" && !muted ? 1 : 0 }} />
        <span className="relative text-6xl" aria-hidden="true">🎙</span>
      </div>
      <p className={cn("text-lg font-extrabold uppercase", state === "live" ? "text-brand-live" : "text-muted-foreground")}>
        {state === "live" ? (muted ? "No ar · microfone mudo" : "● No ar") : state === "starting" ? "Conectando…" : state === "reconnecting" ? "Sinal fraco · reconectando…" : "Fora do ar"}
      </p>
      {since && <p className="font-mono text-2xl font-black">{String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}</p>}
      {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">{error}</p>}
      {state === "off" ? (
        <button type="button" onClick={() => void start()} className="h-16 w-full rounded-2xl bg-brand-live text-lg font-extrabold uppercase text-white">Começar narração</button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={toggleMute} className="h-14 rounded-2xl border text-base font-bold">{muted ? "Ativar microfone" : "Mutar (intervalo)"}</button>
          <button type="button" onClick={() => void stop()} className="h-14 rounded-2xl border border-destructive/60 text-base font-bold text-destructive">Encerrar narração</button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Use fone com microfone ou fale perto do celular. Deixe esta tela aberta durante o jogo — a tela não apaga enquanto estiver no ar.</p>
    </div>
  );
}
