"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ShootoutBoard } from "@/components/match/shootout-board";
import { QuickPlayer } from "@/components/operator/quick-player";
import { StatusPill } from "@/components/brand/status-pill";
import { confirmMatch, finishMatch } from "@/domain/match/actions";
import { FREE_KICK_FROM_FOUL, accumulatedFouls, computeScore, shootoutState, timeoutsUsed } from "@/domain/match/rules";
import { newOpId } from "@/lib/offline/outbox";
import { useOutbox } from "@/lib/offline/use-outbox";
import { ClockTransitionError, endPeriod, kickOff, setBallInPlay, snapshot, type ClockState } from "@/domain/match/clock";
import type { ActionResult } from "@/domain/shared/action-helpers";
import { cn } from "@/lib/utils";

type Team = { id: string; name: string };
type Player = { athleteId: string; name: string; nickname: string | null; teamId: string; shirtNumber: number | null };
type EvType = "GOAL" | "YELLOW" | "RED" | "SUB" | "FOUL" | "TIMEOUT" | "PENALTY_MISS" | "SHOOTOUT_GOAL" | "SHOOTOUT_MISS";
type Ev = { id: string; clientEventId: string; type: EvType; teamId: string; minute: number; athleteName: string | null; voided: boolean; ownGoal?: boolean; penalty?: boolean; pending?: boolean; period?: string | null };
type Stats = { shots: number; shotsOnTarget: number; corners: number; offsides: number };

export type ConsoleProps = {
  matchId: string;
  version: number;
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "CONFIRMED" | "POSTPONED" | "CANCELLED";
  clock: ClockState;
  periodMinutes: number;
  modality: "FIELD" | "FUTSAL";
  intervalMinutes: number;
  timeoutsPerHalf: number;
  knockout: boolean;
  home: Team & { score: number };
  away: Team & { score: number };
  roster: Player[];
  events: Ev[];
  stats: { home: Stats; away: Stats };
  canConfirm: boolean;
};

/** Horário do aparelho no momento do toque (enviado junto para a fila offline). */
const stamp = () => Date.now();

export const EVENT_LABEL: Record<EvType, string> = { GOAL: "Gol", YELLOW: "Amarelo", RED: "Vermelho", SUB: "Substituição", FOUL: "Falta", TIMEOUT: "Tempo técnico", PENALTY_MISS: "Pênalti perdido", SHOOTOUT_GOAL: "Pênalti convertido (disputa)", SHOOTOUT_MISS: "Pênalti perdido (disputa)" };
const ZERO: Stats = { shots: 0, shotsOnTarget: 0, corners: 0, offsides: 0 };

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function MatchConsole(props: ConsoleProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const outbox = useOutbox(props.matchId);
  const [sheet, setSheet] = useState<EvType | null>(null);
  const futsal = props.modality === "FUTSAL";
  const [kicker, setKicker] = useState<Record<string, string>>({});

  // ===== Estado otimista: servidor + fila local ainda não sincronizada =====
  let clockState = props.clock;
  let status = props.status;
  const names = new Map(props.roster.map((r) => [r.athleteId, r.nickname ?? r.name]));
  let events: Ev[] = props.events;
  for (const op of outbox.queued) {
    if (op.kind === "clock") {
      try {
        if (op.command === "KICK_OFF") { clockState = kickOff(clockState, op.at); if (status === "SCHEDULED") status = "LIVE"; }
        else if (op.command === "END_PERIOD") clockState = endPeriod(clockState, op.at);
        else clockState = setBallInPlay(clockState, op.command === "RESUME", op.at);
      } catch (e) { if (!(e instanceof ClockTransitionError)) throw e; }
    } else if (op.kind === "event") {
      const inPlay = clockState.period === "FIRST_HALF" || clockState.period === "SECOND_HALF";
      events = [...events, { id: op.clientOpId, clientEventId: op.clientOpId, type: op.type, teamId: op.teamId, minute: op.minute, athleteName: op.athleteId ? names.get(op.athleteId) ?? null : null, voided: false, ownGoal: op.ownGoal, penalty: op.penalty, pending: true, period: inPlay ? clockState.period : null }];
      if (op.type === "TIMEOUT" && clockState.ballInPlay) { try { clockState = setBallInPlay(clockState, false, op.at); } catch {} }
    } else if (op.kind === "void") {
      events = events.map((e) => (e.clientEventId === op.targetClientOpId ? { ...e, voided: true, pending: true } : e));
    }
  }
  events = [...events].sort((a, b) => a.minute - b.minute);
  const score = computeScore(events.map((e) => ({ type: e.type, teamId: e.teamId, voided: e.voided, ownGoal: e.ownGoal })), props.home.id, props.away.id);
  const live = status === "LIVE";
  const now = useNow(live);
  const snap = snapshot(clockState, now, { periodMinutes: props.periodMinutes, futsal });
  const editable = status === "LIVE" || status === "FINISHED";
  const queuedCount = outbox.queued.length;

  function run(fn: () => Promise<ActionResult>) {
    start(async () => {
      const r = await fn();
      if (r?.ok) toast.success(r.message);
      else toast.error(r?.message ?? "Erro inesperado.");
      router.refresh();
    });
  }
  const clock = (command: "KICK_OFF" | "PAUSE" | "RESUME" | "END_PERIOD") =>
    void outbox.push({ kind: "clock", clientOpId: newOpId(), at: stamp(), command });

  const p = clockState.period;
  const inPlay = p === "FIRST_HALF" || p === "SECOND_HALF";
  const clockButtons: { label: string; cmd: Parameters<typeof clock>[0]; tone?: string }[] = [];
  if (status === "SCHEDULED" || (live && p === "NOT_STARTED")) clockButtons.push({ label: "Iniciar 1º tempo", cmd: "KICK_OFF" });
  if (live && p === "HALFTIME") clockButtons.push({ label: "Iniciar 2º tempo", cmd: "KICK_OFF" });
  if (live && inPlay) {
    // Futsal: um único cronômetro de tempo corrido (para e volta com a bola).
    if (futsal) clockButtons.push(clockState.ballInPlay ? { label: "⏸ Parar cronômetro", cmd: "PAUSE" } : { label: "▶ Bola rolando", cmd: "RESUME", tone: "go" });
    clockButtons.push({ label: p === "FIRST_HALF" ? "Encerrar 1º tempo" : "Encerrar 2º tempo", cmd: "END_PERIOD", tone: "danger" });
  }
  const flow = events.map((e) => ({ type: e.type, teamId: e.teamId, voided: e.voided, period: e.period ?? null }));
  const tied = score.home === score.away;
  const showShootout = props.knockout && p === "FINISHED" && tied && (live || status === "FINISHED");
  const so = shootoutState(flow, props.home.id, props.away.id);
  const quick = (type: "FOUL" | "TIMEOUT", teamId: string) =>
    void outbox.push({ kind: "event", clientOpId: newOpId(), at: stamp(), type, teamId, athleteId: null, minute: snap.minute ?? 0 });
  const kick = (teamId: string, goal: boolean) => {
    const athleteId = kicker[teamId] || null;
    void outbox.push({ kind: "event", clientOpId: newOpId(), at: stamp(), type: goal ? "SHOOTOUT_GOAL" : "SHOOTOUT_MISS", teamId, athleteId, minute: props.periodMinutes * 2 });
    setKicker((k) => ({ ...k, [teamId]: "" }));
  };
  const kickersOf = (teamId: string) => events.filter((e) => !e.voided && e.teamId === teamId && e.type.startsWith("SHOOTOUT")).map((e) => e.athleteName);

  const visibleEvents = events.filter((e) => !e.voided);
  const lastEvent = visibleEvents.at(-1);
  const teamName = (id: string) => (id === props.home.id ? props.home.name : props.away.name);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {(queuedCount > 0 || outbox.state === "offline") && (
        <div role="status" className={cn("rounded-xl border px-4 py-2 text-sm font-semibold", outbox.state === "offline" ? "border-brand-live/50 bg-brand-live/10 text-brand-live" : "border-brand-amber/50 bg-brand-amber/10 text-brand-amber")}>
          {outbox.state === "offline" ? "Sem internet — " : outbox.state === "syncing" ? "Sincronizando — " : ""}
          {queuedCount > 0 ? `${queuedCount} lançamento(s) aguardando envio. Pode continuar operando.` : "os lançamentos serão guardados neste aparelho."}
        </div>
      )}
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <StatusPill tone={live ? "live" : status === "CONFIRMED" ? "finished" : "admin"}>
            {live ? `Ao vivo • ${snap.label}` : status === "FINISHED" ? "Aguardando confirmação" : status === "CONFIRMED" ? "Confirmado" : "Pré-jogo"}
          </StatusPill>
          <span className="text-xs text-muted-foreground">{snap.label}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-4">
          <p className="truncate text-right font-bold">{props.home.name}</p>
          <p className="tabular font-mono text-5xl font-black text-brand-amber" aria-live="polite">{score.home} - {score.away}</p>
          <p className="truncate font-bold">{props.away.name}</p>
        </div>
        <div className="rounded-xl border bg-background py-3 text-center">
          <p className="text-[11px] font-bold uppercase text-muted-foreground">{p === "FIRST_HALF" ? "1º tempo" : p === "SECOND_HALF" ? "2º tempo" : p === "HALFTIME" ? `Intervalo · ${props.intervalMinutes} min` : p === "FINISHED" ? "Fim do tempo normal" : "Cronômetro"}</p>
          <p className={cn("tabular font-mono text-4xl font-black", futsal && inPlay && !clockState.ballInPlay ? "text-brand-amber" : "text-brand-green")}>{inPlay ? snap.label : futsal ? "00:00" : "—"}</p>
          {futsal && inPlay && !clockState.ballInPlay && <p className="text-xs font-semibold text-brand-amber">Cronômetro parado</p>}
        </div>
        {clockButtons.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {clockButtons.map((b) => (
              <button key={b.label} disabled={pending} onClick={() => clock(b.cmd)}
                className={cn("h-12 rounded-xl text-sm font-bold disabled:opacity-50", b.tone === "danger" ? "border border-destructive/50 text-destructive" : b.tone === "go" ? "bg-brand-green text-primary-foreground" : "bg-brand-amber text-black", clockButtons.length === 1 && "col-span-2")}>
                {b.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {editable && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setSheet("GOAL")} className="h-14 rounded-xl bg-brand-green text-base font-extrabold text-primary-foreground">+ GOL</button>
          <button onClick={() => setSheet("YELLOW")} className="h-14 rounded-xl bg-brand-amber text-base font-extrabold text-black">+ AMARELO</button>
          <button onClick={() => setSheet("RED")} className="h-14 rounded-xl border border-brand-live text-base font-extrabold text-brand-live">+ VERMELHO</button>
          <button onClick={() => setSheet("SUB")} className="h-14 rounded-xl border border-brand-blue text-base font-extrabold text-brand-blue">+ SUBSTITUIÇÃO</button>
          <button onClick={() => setSheet("PENALTY_MISS")} className="col-span-2 h-12 rounded-xl border text-sm font-bold">+ Pênalti perdido</button>
        </div>
      )}

      {status !== "CONFIRMED" && (
        <QuickPlayer matchId={props.matchId} home={props.home} away={props.away}
          counts={{ [props.home.id]: props.roster.filter((r) => r.teamId === props.home.id).length, [props.away.id]: props.roster.filter((r) => r.teamId === props.away.id).length }} />
      )}

      {futsal && live && inPlay && (
        <section className="overflow-hidden rounded-xl border bg-card">
          <p className="bg-surface-2 px-4 py-2 text-xs font-bold uppercase tracking-wide">Faltas acumuladas e tempo técnico · {p === "FIRST_HALF" ? "1º tempo" : "2º tempo"}</p>
          <div className="grid grid-cols-2 divide-x">
            {[props.home, props.away].map((t) => {
              const f = accumulatedFouls(flow, t.id, p);
              const to = timeoutsUsed(flow, t.id, p);
              return (
                <div key={t.id} className="space-y-2 p-3 text-center">
                  <p className="truncate text-sm font-bold">{t.name}</p>
                  <p className={cn("tabular font-mono text-3xl font-black", f >= FREE_KICK_FROM_FOUL - 1 ? "text-brand-live" : "")}>{f}</p>
                  <p className="text-[11px] text-muted-foreground">falta(s)</p>
                  {f >= FREE_KICK_FROM_FOUL ? <p className="rounded bg-brand-live/15 px-1 py-0.5 text-[11px] font-bold text-brand-live">Tiro livre direto a cada falta</p>
                    : f === FREE_KICK_FROM_FOUL - 1 ? <p className="text-[11px] font-bold text-brand-amber">Próxima falta: tiro livre direto</p> : null}
                  <button onClick={() => quick("FOUL", t.id)} className="h-11 w-full rounded-lg bg-brand-amber text-sm font-bold text-black">+ Falta</button>
                  <button disabled={to >= props.timeoutsPerHalf} onClick={() => quick("TIMEOUT", t.id)} className="h-10 w-full rounded-lg border text-xs font-bold disabled:opacity-40">
                    Tempo técnico ({to}/{props.timeoutsPerHalf})
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {showShootout && (
        <section className="overflow-hidden rounded-xl border-2 border-brand-green/60 bg-card">
          <p className="bg-surface-2 px-4 py-2 text-xs font-bold uppercase tracking-wide">Disputa de pênaltis</p>
          <div className="p-3">
            <ShootoutBoard home={{ name: props.home.name, kicks: so.home, kickers: kickersOf(props.home.id) }} away={{ name: props.away.name, kicks: so.away, kickers: kickersOf(props.away.id) }} winner={so.winner} />
            {!so.winner && status === "LIVE" && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                {[props.home, props.away].map((t) => (
                  <div key={t.id} className="space-y-2">
                    <p className="truncate text-center text-xs font-bold">{t.name}</p>
                    <select aria-label={`Cobrador ${t.name}`} value={kicker[t.id] ?? ""} onChange={(e) => setKicker((k) => ({ ...k, [t.id]: e.target.value }))}
                      className="h-11 w-full rounded-lg border bg-background px-2 text-sm">
                      <option value="">Quem vai cobrar?</option>
                      {props.roster.filter((r) => r.teamId === t.id).map((r) => <option key={r.athleteId} value={r.athleteId}>{r.nickname ?? r.name}</option>)}
                    </select>
                    <button onClick={() => kick(t.id, true)} className="h-11 w-full rounded-lg bg-brand-green text-sm font-bold text-primary-foreground">✓ Converteu</button>
                    <button onClick={() => kick(t.id, false)} className="h-11 w-full rounded-lg border border-brand-live text-sm font-bold text-brand-live">✗ Perdeu</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {sheet && (
        <EventSheet type={sheet} props={props} defaultMinute={snap.minute ?? (p === "FINISHED" ? props.periodMinutes * 2 : 0)} pending={pending}
          onCancel={() => setSheet(null)}
          onSubmit={(data) => { setSheet(null); void outbox.push({ kind: "event", clientOpId: newOpId(), at: stamp(), ...data }); }} />
      )}

      {lastEvent && editable && (
        <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm">
          <span><span className="text-xs uppercase text-muted-foreground">Último evento </span>{lastEvent.type.startsWith("SHOOTOUT") ? "Pênaltis" : `${lastEvent.minute}'`} • {EVENT_LABEL[lastEvent.type]} • {teamName(lastEvent.teamId)}{lastEvent.athleteName ? ` • ${lastEvent.athleteName}` : ""}</span>
          <button
            onClick={() => (lastEvent.pending && !lastEvent.voided ? void outbox.discard(lastEvent.clientEventId) : void outbox.push({ kind: "void", clientOpId: newOpId(), at: stamp(), targetClientOpId: lastEvent.clientEventId }))}
            className="font-semibold text-destructive">Desfazer</button>
        </div>
      )}

      {status !== "SCHEDULED" && (
        <StatsPanel key={props.version} props={props} pending={false} disabled={status === "CONFIRMED"}
          onSave={(s) => void outbox.push({ kind: "stats", clientOpId: newOpId(), at: stamp(), ...s })} />
      )}

      <section className="overflow-hidden rounded-xl border bg-card">
        <p className="bg-surface-2 px-4 py-2 text-xs font-bold uppercase tracking-wide">Súmula</p>
        {events.length === 0 ? <p className="px-4 py-4 text-sm text-muted-foreground">Nenhum evento.</p> : (
          <ul className="divide-y text-sm">
            {events.map((e) => (
              <li key={e.id} className={cn("flex items-center gap-3 px-4 py-2", e.voided && "line-through opacity-40")}>
                <span className="tabular w-10 font-mono font-bold">{e.type.startsWith("SHOOTOUT") ? "PÊN" : `${e.minute}'`}</span>
                <span className="flex-1">{EVENT_LABEL[e.type]}{e.ownGoal ? " (contra)" : ""}{e.penalty ? " (pênalti)" : ""}{e.athleteName ? ` • ${e.athleteName}` : ""}</span>
                <span className="text-xs text-muted-foreground">{teamName(e.teamId)}</span>
                {e.pending && <span className="rounded bg-brand-amber/20 px-1.5 text-[10px] font-bold text-brand-amber">PENDENTE</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {live && p === "FINISHED" && (
        <button disabled={pending || queuedCount > 0} onClick={() => run(() => finishMatch({ matchId: props.matchId }))} className="h-12 w-full rounded-xl bg-brand-amber font-bold text-black disabled:opacity-50">Encerrar súmula</button>
      )}
      {status === "FINISHED" && props.canConfirm && queuedCount === 0 && (
        <div className="grid grid-cols-2 gap-2">
          <button disabled={pending} onClick={() => run(() => confirmMatch({ matchId: props.matchId, reopen: true }))} className="h-12 rounded-xl border font-semibold">Reabrir para correção</button>
          <button disabled={pending} onClick={() => run(() => confirmMatch({ matchId: props.matchId }))} className="h-12 rounded-xl bg-brand-green font-bold text-primary-foreground">Confirmar resultado</button>
        </div>
      )}
    </div>
  );
}

function EventSheet({ type, props, defaultMinute, pending, onCancel, onSubmit }: {
  type: EvType; props: ConsoleProps; defaultMinute: number; pending: boolean; onCancel: () => void;
  onSubmit: (d: { type: EvType; teamId: string; athleteId: string | null; minute: number; ownGoal?: boolean; penalty?: boolean; assistAthleteId?: string | null; playerOutId?: string | null }) => void;
}) {
  const [teamId, setTeamId] = useState(props.home.id);
  const players = props.roster.filter((r) => r.teamId === teamId);
  const label = (r: Player) => (r.shirtNumber != null ? `${r.shirtNumber} • ` : "") + (r.nickname ?? r.name);
  return (
    <form className="space-y-3 rounded-2xl border-2 border-brand-amber/60 bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const v = (k: string) => (fd.get(k) ? String(fd.get(k)) : null);
        onSubmit({ type, teamId, athleteId: v("athleteId"), minute: Number(fd.get("minute")), ownGoal: fd.get("ownGoal") === "on", penalty: fd.get("penalty") === "on", assistAthleteId: v("assist"), playerOutId: v("out") });
      }}>
      <p className="font-bold">{EVENT_LABEL[type]}</p>
      <div className="grid grid-cols-2 gap-2">
        {[props.home, props.away].map((t) => (
          <button type="button" key={t.id} onClick={() => setTeamId(t.id)} className={cn("h-11 rounded-lg border text-sm font-bold", teamId === t.id ? "border-brand-amber bg-brand-amber text-black" : "text-muted-foreground")}>{t.name}</button>
        ))}
      </div>
      <label className="block text-xs font-semibold text-muted-foreground">{type === "SUB" ? "Entra" : "Atleta"}
        <select name="athleteId" required={type !== "GOAL" && type !== "PENALTY_MISS"} className="mt-1 h-11 w-full rounded-lg border bg-background px-2 text-sm" key={teamId}>
          <option value="">{type === "GOAL" || type === "PENALTY_MISS" ? "Não identificado" : "Escolha…"}</option>
          {players.map((r) => <option key={r.athleteId} value={r.athleteId}>{label(r)}</option>)}
        </select>
        {players.length === 0 && <span className="mt-1 block text-xs text-brand-amber">Nenhum atleta no elenco desta equipe. Cadastre em Equipes → atletas: eles entram sozinhos no elenco.</span>}
      </label>
      {type === "SUB" && (
        <label className="block text-xs font-semibold text-muted-foreground">Sai
          <select name="out" required className="mt-1 h-11 w-full rounded-lg border bg-background px-2 text-sm" key={`o${teamId}`}>
            <option value="">Escolha…</option>
            {players.map((r) => <option key={r.athleteId} value={r.athleteId}>{label(r)}</option>)}
          </select>
        </label>
      )}
      {type === "GOAL" && (
        <>
          <label className="block text-xs font-semibold text-muted-foreground">Assistência
            <select name="assist" className="mt-1 h-11 w-full rounded-lg border bg-background px-2 text-sm" key={`a${teamId}`}>
              <option value="">Sem assistência</option>
              {players.map((r) => <option key={r.athleteId} value={r.athleteId}>{label(r)}</option>)}
            </select>
          </label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="penalty" /> Pênalti</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="ownGoal" /> Gol contra</label>
          </div>
        </>
      )}
      <label className="block text-xs font-semibold text-muted-foreground">Minuto
        <input name="minute" type="number" min={0} max={200} defaultValue={defaultMinute} required className="mt-1 h-11 w-full rounded-lg border bg-background px-3 text-sm" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className="h-11 rounded-lg border font-semibold">Cancelar</button>
        <button disabled={pending} className="h-11 rounded-lg bg-brand-amber font-bold text-black">Registrar</button>
      </div>
    </form>
  );
}

const STAT_FIELDS: { key: keyof Stats; label: string }[] = [
  { key: "shots", label: "Finalizações" },
  { key: "shotsOnTarget", label: "Chutes no gol" },
  { key: "corners", label: "Escanteios" },
  { key: "offsides", label: "Impedimentos" },
];

function StatsPanel({ props, pending, disabled, onSave }: { props: ConsoleProps; pending: boolean; disabled: boolean; onSave: (s: { home: Stats; away: Stats }) => void }) {
  const [s, setS] = useState({ home: { ...ZERO, ...props.stats.home }, away: { ...ZERO, ...props.stats.away } });
  const bump = (side: "home" | "away", k: keyof Stats, d: number) => setS((cur) => ({ ...cur, [side]: { ...cur[side], [k]: Math.max(0, Math.min(99, cur[side][k] + d)) } }));
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <p className="bg-surface-2 px-4 py-2 text-xs font-bold uppercase tracking-wide">Estatísticas</p>
      <div className="divide-y">
        {STAT_FIELDS.map((f) => (
          <div key={f.key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2">
            {(["home", "away"] as const).map((side, i) => (
              <div key={side} className={cn("flex items-center gap-1", i === 0 ? "order-1 justify-start" : "order-3 justify-end")}>
                <button type="button" disabled={disabled} aria-label={`Diminuir ${f.label} ${side === "home" ? props.home.name : props.away.name}`} onClick={() => bump(side, f.key, -1)} className="size-9 rounded-lg border text-lg">−</button>
                <span className="tabular w-8 text-center font-mono text-lg font-bold">{s[side][f.key]}</span>
                <button type="button" disabled={disabled} aria-label={`Aumentar ${f.label} ${side === "home" ? props.home.name : props.away.name}`} onClick={() => bump(side, f.key, 1)} className="size-9 rounded-lg border text-lg">+</button>
              </div>
            ))}
            <span className="order-2 text-center text-xs font-semibold text-muted-foreground">{f.label}</span>
          </div>
        ))}
      </div>
      {!disabled && (
        <div className="p-3"><button disabled={pending} onClick={() => onSave(s)} className="h-11 w-full rounded-lg bg-brand-amber font-bold text-black disabled:opacity-50">Salvar estatísticas</button></div>
      )}
    </section>
  );
}
