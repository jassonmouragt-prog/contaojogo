"use client";

import { useRef, useState } from "react";
import { snapshot, type ClockState } from "@/domain/match/clock";
import { PLAY_LABEL, PitchGround, PitchLines } from "@/components/match/live-pitch";
import type { PlayKind } from "@/db/schema/match-ops";
import { newOpId } from "@/lib/offline/outbox";
import { useOutbox } from "@/lib/offline/use-outbox";
import { cn } from "@/lib/utils";

type Team = { id: string; name: string };
const stamp = () => Date.now();
const ACTIONS: { kind: PlayKind; label: string; tone?: "hot" }[] = [
  { kind: "FREE_KICK", label: "Falta" },
  { kind: "THROW_IN", label: "Lateral" },
  { kind: "GOAL_KICK", label: "Tiro de meta" },
  { kind: "SHOT", label: "Chute fora" },
  { kind: "SHOT_ON", label: "Chute no gol", tone: "hot" },
  { kind: "CORNER", label: "Escanteio" },
];

/**
 * Zona do toque, do ponto de vista de quem ataca (mandante ataca para a direita):
 * campo de defesa/meio = posse; campo de ataque = ataque; perto da área = ataque perigoso.
 */
export function zoneKind(x: number, y: number, attacksRight: boolean): PlayKind {
  const ax = attacksRight ? x : 1000 - x;
  const nearBox = ax >= 780 || (ax >= 720 && y > 150 && y < 450);
  if (nearBox) return "DANGER";
  if (ax >= 520) return "ATTACK";
  return "POSSESSION";
}

/**
 * Painel do olheiro: toque no campo onde está a bola, escolha o time e o lance.
 * Usa a mesma fila offline do operador (sem sinal, guarda e envia depois).
 */
type Player = { athleteId: string; teamId: string; name: string; nickname: string | null };

export function ScoutPanel({ matchId, futsal, live, finished = false, home, away, clock, periodMinutes, roster }: {
  matchId: string; futsal: boolean; live: boolean; finished?: boolean; home: Team; away: Team; clock: ClockState; periodMinutes: number; roster: Player[];
}) {
  const [goalFor, setGoalFor] = useState<string | null>(null);
  const [own, setOwn] = useState(false);
  const outbox = useOutbox(matchId);
  const [pos, setPos] = useState({ x: 500, y: 300 });
  const [team, setTeam] = useState(home.id);
  const [log, setLog] = useState<{ id: string; text: string }[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  // Toque no campo = a bola vai para lá no site, já com o tipo de lance pela zona.
  function tap(e: React.PointerEvent<SVGSVGElement>) {
    const r = svgRef.current!.getBoundingClientRect();
    const x = Math.round(Math.max(0, Math.min(1000, ((e.clientX - r.left) / r.width) * 1000)));
    const y = Math.round(Math.max(0, Math.min(600, ((e.clientY - r.top) / r.height) * 600)));
    setPos({ x, y });
    if (!live) return;
    emit(zoneKind(x, y, team === home.id), x, y);
  }

  function emit(kind: PlayKind, x: number, y: number) {
    const id = newOpId();
    void outbox.push({ kind: "play", clientOpId: id, at: stamp(), teamId: team, play: kind, x, y });
    setLog((l) => [{ id, text: `${PLAY_LABEL[kind]} · ${team === home.id ? home.name : away.name}` }, ...l].slice(0, 6));
    if (navigator.vibrate) navigator.vibrate(12);
  }

  // Botões: o lance sai de onde a bola está (o site anima o chute dali).
  function send(kind: PlayKind) {
    let { x, y } = pos;
    const attacksRight = team === home.id;
    if (kind === "CORNER") { x = attacksRight ? 975 : 25; y = y < 300 ? 25 : 575; }
    if (kind === "GOAL_KICK") { x = attacksRight ? 80 : 920; y = 300; }
    if (kind === "THROW_IN") y = y < 300 ? 22 : 578;
    setPos({ x, y });
    emit(kind, x, y);
  }

  // Gol de verdade (vale no placar), com autor opcional; o site faz a animação.
  // benefited = time que ganha o gol. Gol contra: o lance é do atleta do outro time.
  function goal(benefited: string, athleteId: string | null, ownGoal: boolean) {
    const minute = snapshot(clock, stamp(), { periodMinutes, futsal }).minute ?? 0;
    const teamId = ownGoal ? (benefited === home.id ? away.id : home.id) : benefited;
    const id = newOpId();
    void outbox.push({ kind: "event", clientOpId: id, at: stamp(), type: "GOAL", teamId, athleteId, minute, ownGoal, penalty: false });
    setLog((l) => [{ id, text: `⚽ GOL · ${benefited === home.id ? home.name : away.name}${ownGoal ? " (contra)" : ""}` }, ...l].slice(0, 6));
    setGoalFor(null); setOwn(false);
    setPos({ x: 500, y: 300 });
    if (navigator.vibrate) navigator.vibrate([40, 40, 80]);
  }

  const queued = outbox.queued.length;
  return (
    <div className="mx-auto max-w-xl space-y-3">
      {finished ? <p className="rounded-xl border border-brand-live/50 bg-brand-live/10 px-4 py-3 text-center text-base font-extrabold uppercase text-brand-live">Fim de jogo</p>
        : !live && <p className="rounded-xl border border-brand-amber/50 bg-brand-amber/10 px-4 py-2 text-sm font-semibold text-brand-amber">O campinho só envia lances com o jogo ao vivo (iniciado pelo operador).</p>}
      {(queued > 0 || outbox.state === "offline") && (
        <p role="status" className="rounded-xl border border-brand-amber/50 bg-brand-amber/10 px-4 py-2 text-sm font-semibold text-brand-amber">
          {outbox.state === "offline" ? "Sem internet — " : ""}{queued} lance(s) aguardando envio. Pode continuar.
        </p>
      )}
      <div className="overflow-hidden rounded-2xl border">
        <svg ref={svgRef} viewBox="0 0 1000 600" className="block w-full cursor-crosshair touch-manipulation" onPointerDown={tap} aria-label="Toque onde está a bola">
          <PitchGround futsal={futsal} id="scout" />
          {/* Zonas do time com a bola: ataque e ataque perigoso. */}
          <g opacity=".18" pointerEvents="none">
            {team === home.id ? (<><rect x="520" y="0" width="260" height="600" fill="#ffd23f" /><rect x="780" y="0" width="220" height="600" fill="#ff4d4d" /></>)
              : (<><rect x="220" y="0" width="260" height="600" fill="#ffd23f" /><rect x="0" y="0" width="220" height="600" fill="#ff4d4d" /></>)}
          </g>
          <PitchLines futsal={futsal} />
          {/* Marca onde o olheiro tocou = onde está a bola agora. */}
          <circle cx={pos.x} cy={pos.y} r="20" fill="none" stroke={team === home.id ? "#1ee37b" : "#fff"} strokeWidth="6" />
          <circle cx={pos.x} cy={pos.y} r="9" fill="#fff" />
          <text x="40" y="60" fill="rgba(255,255,255,.6)" fontSize="28" fontWeight="700">← {away.name}</text>
          <text x="960" y="60" fill="rgba(255,255,255,.6)" fontSize="28" fontWeight="700" textAnchor="end">{home.name} →</text>
        </svg>
      </div>
      <p className="text-center text-xs text-muted-foreground">Toque onde a bola está: a zona define sozinha posse, ataque ou ataque perigoso. {home.name} ataca para a direita →</p>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Time com a bola">
        {[home, away].map((t) => (
          <button key={t.id} type="button" aria-pressed={team === t.id} onClick={() => setTeam(t.id)}
            className={cn("h-12 truncate rounded-xl border-2 px-2 text-sm font-extrabold uppercase", team === t.id ? (t.id === home.id ? "border-brand-green text-brand-green" : "border-white text-white") : "text-muted-foreground")}>
            {t.name}
          </button>
        ))}
      </div>
      <p className="text-center text-[11px] text-muted-foreground"><span className="text-brand-amber">■</span> ataque · <span className="text-brand-live">■</span> ataque perigoso</p>
      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map((a) => (
          <button key={a.kind} type="button" disabled={!live} onClick={() => send(a.kind)}
            className={cn("h-14 rounded-xl px-1 text-sm font-bold leading-tight active:scale-95 disabled:opacity-40", a.tone === "hot" ? "bg-brand-green text-primary-foreground" : "bg-surface-2")}>
            {a.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[home, away].map((t) => (
          <button key={t.id} type="button" disabled={!live} onClick={() => setGoalFor(t.id)}
            className="h-14 truncate rounded-xl bg-brand-green px-2 text-base font-black uppercase text-primary-foreground active:scale-95 disabled:opacity-40">⚽ Gol {t.name}</button>
        ))}
      </div>
      {goalFor && (
        <form className="space-y-2 rounded-xl border-2 border-brand-green bg-card p-3" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          goal(goalFor, (fd.get("athleteId") as string) || null, own);
        }}>
          <p className="font-bold">Gol do {goalFor === home.id ? home.name : away.name}</p>
          <label className="block text-xs font-semibold text-muted-foreground">Quem fez
            <select name="athleteId" key={String(own)} className="mt-1 h-11 w-full rounded-lg border bg-background px-2 text-sm">
              <option value="">Não identificado</option>
              {roster.filter((r) => (own ? r.teamId !== goalFor : r.teamId === goalFor)).map((r) => <option key={r.athleteId} value={r.athleteId}>{r.nickname ?? r.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} /> Gol contra (atleta do outro time)</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setGoalFor(null); setOwn(false); }} className="h-11 rounded-lg border font-semibold">Cancelar</button>
            <button className="h-11 rounded-lg bg-brand-green font-black text-primary-foreground">Confirmar gol</button>
          </div>
        </form>
      )}
      <p className="text-xs text-muted-foreground">Cartões e substituições continuam no painel do operador — o campinho anima esses lances sozinho.</p>
      {log.length > 0 && (
        <ul className="divide-y rounded-xl border bg-card text-sm">
          {log.map((l) => <li key={l.id} className="px-4 py-2">{l.text}</li>)}
        </ul>
      )}
    </div>
  );
}
