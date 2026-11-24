"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ClockCard } from "@/components/brand/clock-card";
import { StatusPill } from "@/components/brand/status-pill";
import { confirmMatch, finishMatch } from "@/domain/match/actions";
import { computeScore } from "@/domain/match/rules";
import { newOpId } from "@/lib/offline/outbox";
import { useOutbox } from "@/lib/offline/use-outbox";
import { ClockTransitionError, endPeriod, kickOff, setBallInPlay, snapshot, type ClockState } from "@/domain/match/clock";
import type { ActionResult } from "@/domain/shared/action-helpers";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";

type Team = { id: string; name: string };
type Player = { athleteId: string; name: string; nickname: string | null; teamId: string; shirtNumber: number | null };
type Ev = { id: string; clientEventId: string; type: "GOAL" | "YELLOW" | "RED" | "SUB"; teamId: string; minute: number; athleteName: string | null; voided: boolean; ownGoal?: boolean; penalty?: boolean; pending?: boolean };
type Stats = { shots: number; shotsOnTarget: number; corners: number; offsides: number };

export type ConsoleProps = {
  matchId: string;
  version: number;
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "CONFIRMED" | "POSTPONED" | "CANCELLED";
  clock: ClockState;
  periodMinutes: number;
  home: Team & { score: number };
  away: Team & { score: number };
  roster: Player[];
  events: Ev[];
  stats: { home: Stats; away: Stats };
  canConfirm: boolean;
};

/** Horário do aparelho no momento do toque (enviado junto para a fila offline). */
const stamp = () => Date.now();

const EVENT_LABEL = { GOAL: "Gol", YELLOW: "Amarelo", RED: "Vermelho", SUB: "Substituição" } as const;
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
  const [sheet, setSheet] = useState<Ev["type"] | null>(null);

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
      events = [...events, { id: op.clientOpId, clientEventId: op.clientOpId, type: op.type, teamId: op.teamId, minute: op.minute, athleteName: op.athleteId ? names.get(op.athleteId) ?? null : null, voided: false, ownGoal: op.ownGoal, penalty: op.penalty, pending: true }];
    } else if (op.kind === "void") {
      events = events.map((e) => (e.clientEventId === op.targetClientOpId ? { ...e, voided: true, pending: true } : e));
    }
  }
  events = [...events].sort((a, b) => a.minute - b.minute);
  const score = computeScore(events.map((e) => ({ type: e.type, teamId: e.teamId, voided: e.voided, ownGoal: e.ownGoal })), props.home.id, props.away.id);
  const live = status === "LIVE";
  const now = useNow(live);
  const snap = snapshot(clockState, now, { periodMinutes: props.periodMinutes });
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
  const clockButtons: { label: string; cmd: Parameters<typeof clock>[0]; tone?: string }[] = [];
  if (status === "SCHEDULED" || (live && p === "NOT_STARTED")) clockButtons.push({ label: "Iniciar 1º tempo", cmd: "KICK_OFF" });
  if (live && p === "HALFTIME") clockButtons.push({ label: "Iniciar 2º tempo", cmd: "KICK_OFF" });
  if (live && (p === "FIRST_HALF" || p === "SECOND_HALF")) {
    clockButtons.push(clockState.ballInPlay ? { label: "Pausar (bola parada)", cmd: "PAUSE" } : { label: "Retomar (bola rolando)", cmd: "RESUME" });
    clockButtons.push({ label: p === "FIRST_HALF" ? "Encerrar 1º tempo" : "Encerrar 2º tempo", cmd: "END_PERIOD", tone: "danger" });
  }

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
        <div className="grid grid-cols-2 gap-2">
          <ClockCard label="Bola rolando" value={formatClock(snap.rollingMs)} />
          <ClockCard label="Bola parada" value={formatClock(snap.stoppedMs)} tone="amber" />
        </div>
        {clockButtons.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {clockButtons.map((b) => (
              <button key={b.label} disabled={pending} onClick={() => clock(b.cmd)}
                className={cn("h-12 rounded-xl text-sm font-bold disabled:opacity-50", b.tone === "danger" ? "border border-destructive/50 text-destructive" : "bg-brand-amber text-black", clockButtons.length === 1 && "col-span-2")}>
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
        </div>
      )}

      {sheet && (
        <EventSheet type={sheet} props={props} defaultMinute={snap.minute ?? (p === "FINISHED" ? props.periodMinutes * 2 : 0)} pending={pending}
          onCancel={() => setSheet(null)}
          onSubmit={(data) => { setSheet(null); void outbox.push({ kind: "event", clientOpId: newOpId(), at: stamp(), ...data }); }} />
      )}

      {lastEvent && editable && (
        <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm">
          <span><span className="text-xs uppercase text-muted-foreground">Último evento </span>{lastEvent.minute}&apos; • {EVENT_LABEL[lastEvent.type]} • {teamName(lastEvent.teamId)}{lastEvent.athleteName ? ` • ${lastEvent.athleteName}` : ""}</span>
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
                <span className="tabular w-10 font-mono font-bold">{e.minute}&apos;</span>
                <span className="flex-1">{EVENT_LABEL[e.type]}{e.ownGoal ? " (contra)" : ""}{e.penalty ? " (pênalti)" : ""} • {e.athleteName ?? "—"}</span>
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
  type: Ev["type"]; props: ConsoleProps; defaultMinute: number; pending: boolean; onCancel: () => void;
  onSubmit: (d: { type: Ev["type"]; teamId: string; athleteId: string | null; minute: number; ownGoal?: boolean; penalty?: boolean; assistAthleteId?: string | null; playerOutId?: string | null }) => void;
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
        <select name="athleteId" required={type !== "GOAL"} className="mt-1 h-11 w-full rounded-lg border bg-background px-2 text-sm" key={teamId}>
          <option value="">{type === "GOAL" ? "Não identificado" : "Escolha…"}</option>
          {players.map((r) => <option key={r.athleteId} value={r.athleteId}>{label(r)}</option>)}
        </select>
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
