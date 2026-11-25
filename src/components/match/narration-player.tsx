"use client";

import { useEffect, useRef, useState } from "react";
import { listen } from "@/lib/realtime/client";
import { cn } from "@/lib/utils";

/** Botão "Ouvir narração ao vivo" na página do jogo. Aparece só com o narrador no ar. */
export function NarrationPlayer({ matchId, initialOn }: { matchId: string; initialOn: boolean }) {
  const [on, setOn] = useState(initialOn);
  const [state, setState] = useState<"idle" | "connecting" | "playing" | "error">("idle");
  const [msg, setMsg] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const want = useRef(false);

  // Descobre se a narração entrou/saiu do ar.
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`/api/narration/listen?match=${matchId}`, { cache: "no-store" });
        const { on: now } = (await r.json()) as { on: boolean };
        setOn((was) => {
          if (was && !now) stop();
          if (!was && now && want.current) void start();
          return now;
        });
      } catch { /* tenta de novo */ }
    }, 8000);
    return () => { clearInterval(t); pcRef.current?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  async function start() {
    want.current = true;
    setState("connecting"); setMsg("");
    pcRef.current?.close();
    try {
      const { pc, stream } = await listen(matchId, (s) => {
        if (s === "failed" || s === "disconnected") {
          setState("connecting");
          setTimeout(() => { if (want.current) void start(); }, 3000);
        }
      });
      pcRef.current = pc;
      if (audio.current) { audio.current.srcObject = stream; await audio.current.play(); }
      setState("playing");
    } catch (e) {
      setState("error"); setMsg(e instanceof Error ? e.message : "Não foi possível tocar.");
    }
  }
  function stop() {
    want.current = false;
    pcRef.current?.close(); pcRef.current = null;
    if (audio.current) audio.current.srcObject = null;
    setState("idle");
  }

  if (!on && state === "idle") return null;
  return (
    <section className={cn("flex items-center gap-3 rounded-2xl border p-4", state === "playing" ? "border-brand-green/60 bg-brand-green/10" : "bg-card")} aria-label="Narração ao vivo">
      <audio ref={audio} autoPlay playsInline />
      <button type="button" onClick={() => (state === "playing" || state === "connecting" ? stop() : void start())}
        className={cn("grid size-14 shrink-0 place-items-center rounded-full text-2xl font-black", state === "playing" ? "bg-brand-green text-primary-foreground" : "bg-brand-live text-white")}
        aria-label={state === "playing" ? "Parar narração" : "Ouvir narração ao vivo"}>
        {state === "playing" ? "❚❚" : state === "connecting" ? "…" : "▶"}
      </button>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-extrabold uppercase">
          <span className="size-2 animate-pulse rounded-full bg-brand-live" />🎙 Narração ao vivo
        </p>
        <p className="text-xs text-muted-foreground">
          {state === "playing" ? "Você está ouvindo o narrador do Conta o Jogo." : state === "connecting" ? "Conectando…" : state === "error" ? msg : on ? "Toque para ouvir o jogo narrado direto do campo." : "A narração saiu do ar."}
        </p>
      </div>
      {state === "playing" && (
        <span className="flex h-6 items-end gap-0.5" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <span key={i} className="w-1 animate-[eq_1s_ease-in-out_infinite] rounded bg-brand-green" style={{ animationDelay: `${i * 0.15}s`, height: "100%" }} />)}
        </span>
      )}
    </section>
  );
}
