"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type Play = { id: string; teamId: string; kind: string; x: number; y: number };
type Ev = { id: string; type: "GOAL" | "YELLOW" | "RED" | string; teamId: string; minute: number; ownGoal: boolean };
type Team = { id: string; name: string };

const HOME_COLOR = "#1ee37b";
const AWAY_COLOR = "#ffffff";
export const PLAY_LABEL: Record<string, string> = {
  POSSESSION: "Posse de bola", ATTACK: "Ataque", DANGER: "Ataque perigoso", SHOT: "Chute para fora", SHOT_ON: "Chute no gol",
  CORNER: "Escanteio", FREE_KICK: "Falta", THROW_IN: "Lateral", GOAL_KICK: "Tiro de meta",
};

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Linhas do campo (campo de futebol ou quadra de futsal) num viewBox 1000×600. */
export function PitchLines({ futsal }: { futsal: boolean }) {
  return futsal ? (
    <g fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="3">
      <rect x="20" y="20" width="960" height="560" />
      <line x1="500" y1="20" x2="500" y2="580" />
      <circle cx="500" cy="300" r="70" />
      <circle cx="500" cy="300" r="4" fill="#fff" />
      <path d="M20 150 A150 150 0 0 1 170 300 A150 150 0 0 1 20 450" />
      <path d="M980 150 A150 150 0 0 0 830 300 A150 150 0 0 0 980 450" />
      <circle cx="170" cy="300" r="4" fill="#fff" /><circle cx="830" cy="300" r="4" fill="#fff" />
      <circle cx="260" cy="300" r="4" fill="#fff" /><circle cx="740" cy="300" r="4" fill="#fff" />
    </g>
  ) : (
    <g fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="3">
      <rect x="20" y="20" width="960" height="560" />
      <line x1="500" y1="20" x2="500" y2="580" />
      <circle cx="500" cy="300" r="80" />
      <rect x="20" y="160" width="140" height="280" /><rect x="20" y="230" width="50" height="140" />
      <rect x="840" y="160" width="140" height="280" /><rect x="930" y="230" width="50" height="140" />
      <path d="M160 245 A70 70 0 0 1 160 355M840 245 A70 70 0 0 0 840 355" />
    </g>
  );
}

export function PitchGround({ futsal, id }: { futsal: boolean; id: string }) {
  return (
    <>
      <defs>
        {futsal ? (
          <linearGradient id={`${id}-g`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#1d4f8f" /><stop offset="1" stopColor="#163e72" /></linearGradient>
        ) : (
          <pattern id={`${id}-g`} width="100" height="600" patternUnits="userSpaceOnUse"><rect width="50" height="600" fill="#0e4a29" /><rect x="50" width="50" height="600" fill="#0b4024" /></pattern>
        )}
      </defs>
      <rect width="1000" height="600" fill={`url(#${id}-g)`} />
    </>
  );
}

/**
 * Campinho ao vivo do site. Formato 1: anima os lances do olheiro (bola,
 * área de ataque, rastro na cor do time). Formato 2: sem olheiro, anima os
 * lances do operador (gol para o lado certo, cartões).
 */
export function LivePitch({ futsal, live, home, away, score, plays: initialPlays, events, matchId }: {
  futsal: boolean; live: boolean; home: Team; away: Team; score: [number, number]; plays: Play[]; events: Ev[]; matchId?: string;
}) {
  const ballRef = useRef<SVGGElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);
  const tailRef = useRef<SVGPathElement>(null);
  const pos = useRef({ x: 500, y: 300 });
  const anim = useRef(0);
  const seenPlays = useRef(new Set(initialPlays.map((p) => p.id)));
  const seenEvents = useRef(new Set(events.map((e) => e.id)));
  const queue = useRef<Play[]>([]);
  const busy = useRef(false);
  const [banner, setBanner] = useState<{ text: string; team?: string } | null>(() => {
    const last = initialPlays.at(-1);
    return last ? { text: PLAY_LABEL[last.kind] ?? "", team: last.teamId === home.id ? home.name : away.name } : { text: live ? "Bola rolando" : "Fim de jogo" };
  });
  const [zone, setZone] = useState<"home" | "away" | null>(null);
  const [goal, setGoal] = useState<{ name: string; key: number } | null>(null);
  const [cur, setCur] = useState(score);

  const color = (teamId: string) => (teamId === home.id ? HOME_COLOR : AWAY_COLOR);

  function draw(x: number, y: number, h: number) {
    const k = 1 + h / 90;
    ballRef.current?.setAttribute("transform", `translate(${x} ${y - h}) scale(${k})`);
    const sh = shadowRef.current;
    if (sh) { sh.setAttribute("cx", String(x)); sh.setAttribute("cy", String(y + 6)); sh.setAttribute("rx", String(14 - h / 12)); sh.setAttribute("opacity", String(1 - h / 160)); }
  }

  function move(x: number, y: number, tail: string, opts: { dur?: number; lift?: number } = {}) {
    return new Promise<void>((resolve) => {
      const fx = pos.current.x, fy = pos.current.y;
      const dist = Math.hypot(x - fx, y - fy);
      cancelAnimationFrame(anim.current);
      if (dist < 2) { pos.current = { x, y }; draw(x, y, 0); resolve(); return; }
      const dur = opts.dur ?? Math.min(1400, 450 + dist * 1.1);
      const lift = opts.lift ?? Math.min(70, dist / 7);
      const tr = tailRef.current!;
      tr.setAttribute("d", `M${fx} ${fy} Q${(fx + x) / 2} ${(fy + y) / 2 - lift * 1.6} ${x} ${y}`);
      tr.setAttribute("stroke", tail);
      const L = tr.getTotalLength(), SEG = Math.min(140, L);
      tr.style.strokeDasharray = `${SEG} ${L + SEG}`;
      tr.style.strokeDashoffset = String(SEG);
      const t0 = performance.now();
      const frame = (now: number) => {
        const t = Math.min(1, (now - t0) / dur), e = ease(t);
        const bx = fx + (x - fx) * e, by = fy + (y - fy) * e;
        pos.current = { x: bx, y: by };
        draw(bx, by, Math.sin(Math.PI * t) * lift);
        tr.style.strokeDashoffset = String(SEG - L * e);
        if (t < 1) { anim.current = requestAnimationFrame(frame); return; }
        // rabo encolhe até a bola
        const t1 = performance.now();
        const fade = (n: number) => {
          const u = Math.min(1, (n - t1) / 350), seg = SEG * (1 - u);
          tr.style.strokeDasharray = `${seg} ${L + SEG}`; tr.style.strokeDashoffset = String(seg - L);
          if (u < 1) requestAnimationFrame(fade); else tr.setAttribute("d", "");
        };
        requestAnimationFrame(fade);
        resolve();
      };
      anim.current = requestAnimationFrame(frame);
    });
  }

  async function playOne(p: Play) {
    const isHome = p.teamId === home.id;
    const name = isHome ? home.name : away.name;
    const attackZone = isHome ? p.x > 600 : p.x < 400;
    setZone(p.kind === "DANGER" || p.kind === "SHOT_ON" || p.kind === "CORNER" || (p.kind === "ATTACK" && attackZone) ? (isHome ? "home" : "away") : null);
    setBanner({ text: PLAY_LABEL[p.kind] ?? p.kind, team: name });
    const fast = p.kind === "SHOT" || p.kind === "SHOT_ON";
    await move(p.x, p.y, color(p.teamId), fast ? { dur: 600, lift: 30 } : {});
  }

  async function drain() {
    if (busy.current) return;
    busy.current = true;
    while (queue.current.length) {
      // atrasado demais: pula para os 3 últimos
      if (queue.current.length > 3) queue.current = queue.current.slice(-3);
      await playOne(queue.current.shift()!);
      await new Promise((r) => setTimeout(r, 250));
    }
    busy.current = false;
  }

  // Posição inicial: último lance conhecido.
  useEffect(() => {
    const last = initialPlays.at(-1);
    if (last) { pos.current = { x: last.x, y: last.y }; }
    draw(pos.current.x, pos.current.y, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Busca lances novos do olheiro a cada 2s (só com o jogo ao vivo e a aba visível).
  useEffect(() => {
    if (!live || !matchId) return;
    let stop = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/public/plays?match=${matchId}`, { cache: "no-store" });
        if (!res.ok || stop) return;
        const { plays } = (await res.json()) as { plays: Play[] };
        const fresh = plays.filter((p) => !seenPlays.current.has(p.id));
        fresh.forEach((p) => seenPlays.current.add(p.id));
        if (fresh.length) { queue.current.push(...fresh); void drain(); }
      } catch { /* sem rede: tenta de novo */ }
    };
    const t = setInterval(tick, 2000);
    return () => { stop = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, matchId]);

  // Gols e cartões novos (chegam pela atualização da página).
  useEffect(() => {
    const fresh = events.filter((e) => !seenEvents.current.has(e.id));
    fresh.forEach((e) => seenEvents.current.add(e.id));
    for (const e of fresh) {
      const scorerHome = e.ownGoal ? e.teamId !== home.id : e.teamId === home.id;
      const name = e.teamId === home.id ? home.name : away.name;
      if (e.type === "GOAL") {
        const team = scorerHome ? home : away;
        setZone(null);
        setBanner({ text: "GOL", team: team.name });
        void move(scorerHome ? 988 : 12, 285 + Math.random() * 30, scorerHome ? HOME_COLOR : AWAY_COLOR, { dur: 650, lift: 22 }).then(() => {
          setCur(score);
          setGoal({ name: team.name, key: Date.now() });
          setTimeout(() => { setGoal(null); void move(500, 300, "#ffffff", { dur: 1200, lift: 40 }); }, 3200);
        });
      } else {
        setBanner({ text: e.type === "RED" ? "Cartão vermelho" : "Cartão amarelo", team: name });
      }
    }
    if (!fresh.some((e) => e.type === "GOAL")) setCur(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, score[0], score[1]]);

  const gid = `p${(matchId ?? "x").slice(0, 6)}`;
  return (
    <section className="overflow-hidden rounded-2xl border bg-card" aria-label="Campinho ao vivo">
      <div className="flex items-center justify-between px-4 py-2 text-xs font-bold uppercase tracking-wide">
        <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: HOME_COLOR }} />{home.name}</span>
        <span className="text-muted-foreground">{futsal ? "Quadra ao vivo" : "Campinho ao vivo"}</span>
        <span className="flex items-center gap-2">{away.name}<span className="size-2 rounded-full border" style={{ background: AWAY_COLOR }} /></span>
      </div>
      <div className="relative aspect-[5/3] w-full">
        <svg viewBox="0 0 1000 600" className="absolute inset-0 size-full">
          <PitchGround futsal={futsal} id={gid} />
          <defs>
            <linearGradient id={`${gid}-zr`} x1="0" x2="1"><stop offset="0" stopColor={HOME_COLOR} stopOpacity="0" /><stop offset="1" stopColor={HOME_COLOR} stopOpacity=".45" /></linearGradient>
            <linearGradient id={`${gid}-zl`} x1="1" x2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity=".35" /></linearGradient>
          </defs>
          <rect x="667" y="20" width="313" height="560" fill={`url(#${gid}-zr)`} style={{ opacity: zone === "home" ? 1 : 0, transition: "opacity .45s" }} />
          <rect x="20" y="20" width="313" height="560" fill={`url(#${gid}-zl)`} style={{ opacity: zone === "away" ? 1 : 0, transition: "opacity .45s" }} />
          <PitchLines futsal={futsal} />
          <rect x="980" y={futsal ? 260 : 255} width="16" height={futsal ? 80 : 90} fill="rgba(255,255,255,.25)" stroke="#fff" strokeWidth="2" className={goal ? "animate-pulse" : ""} />
          <rect x="4" y={futsal ? 260 : 255} width="16" height={futsal ? 80 : 90} fill="rgba(255,255,255,.25)" stroke="#fff" strokeWidth="2" />
          <path ref={tailRef} d="" fill="none" strokeWidth="5" strokeLinecap="round" opacity=".9" />
          <ellipse ref={shadowRef} cx="500" cy="306" rx="14" ry="6" fill="rgba(0,0,0,.4)" />
          <g ref={ballRef} transform="translate(500 300)">
            <circle r="13" fill="#fff" stroke="#111" strokeWidth="2" />
            <path d="M-5 -4 L0 -8 L5 -4 L3 3 L-3 3Z" fill="#111" />
          </g>
        </svg>
        {banner && (
          <div className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-black/70 px-3.5 py-1 text-sm font-bold uppercase text-white">
            {banner.text}{banner.team && <> · <span className="text-brand-green">{banner.team}</span></>}
          </div>
        )}
        {goal && (
          <div key={goal.key} className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle,rgba(30,227,123,.35),rgba(0,0,0,.75)_70%)] animate-[goalin_3.2s_ease_forwards]">
            <div className="text-center">
              <strong className="block text-6xl font-black tracking-widest text-brand-green drop-shadow-[0_0_24px_rgba(30,227,123,.6)] sm:text-8xl">GOOOL!</strong>
              <span className="text-lg font-bold uppercase text-white sm:text-2xl">{goal.name} · {cur[0]} x {cur[1]}</span>
            </div>
          </div>
        )}
      </div>
      <p className={cn("px-4 py-2 text-[11px] text-muted-foreground", !live && "hidden")}>Lances atualizados ao vivo.</p>
    </section>
  );
}
