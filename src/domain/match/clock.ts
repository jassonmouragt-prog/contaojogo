/**
 * Cronômetro da partida baseado em timestamps persistidos.
 *
 * O servidor guarda apenas o estado (período, se a bola está rolando, início
 * do segmento atual e tempos acumulados). Qualquer cliente calcula o tempo
 * exibido localmente a partir de `now`, sem requisições por segundo.
 *
 * - Bola rolando e bola parada são acumulados separadamente (PDF, tela 09).
 * - O minuto oficial é o tempo total do período (rolando + parada) somado à
 *   base do período; acréscimos aparecem como "45+2'".
 */

export const PERIODS = [
  "NOT_STARTED",
  "FIRST_HALF",
  "HALFTIME",
  "SECOND_HALF",
  "FINISHED",
] as const;
export type Period = (typeof PERIODS)[number];

export type ClockState = {
  period: Period;
  /** true = bola rolando; false = bola parada. Só tem efeito com o período em jogo. */
  ballInPlay: boolean;
  /** Epoch ms do início do segmento atual (rolando ou parado). null fora de jogo. */
  segmentStartedAt: number | null;
  /** Tempo acumulado de bola rolando no período atual, sem o segmento corrente. */
  rollingMs: number;
  /** Tempo acumulado de bola parada no período atual, sem o segmento corrente. */
  stoppedMs: number;
};

export type ClockConfig = {
  /** Duração regulamentar de cada tempo, em minutos (campo 45, futsal 20). */
  periodMinutes: number;
};

export type ClockSnapshot = {
  period: Period;
  running: boolean;
  ballInPlay: boolean;
  rollingMs: number;
  stoppedMs: number;
  totalMs: number;
  /** Minuto corrido da partida (1-based) ou null fora de jogo. */
  minute: number | null;
  /** Acréscimo em minutos quando o período passou do tempo regulamentar. */
  stoppageMinute: number | null;
  /** Rótulo pronto para exibir: "67'", "45+2'", "Intervalo", "Encerrado". */
  label: string;
};

export class ClockTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClockTransitionError";
  }
}

export const INITIAL_CLOCK: ClockState = {
  period: "NOT_STARTED",
  ballInPlay: false,
  segmentStartedAt: null,
  rollingMs: 0,
  stoppedMs: 0,
};

const IN_PLAY: ReadonlySet<Period> = new Set(["FIRST_HALF", "SECOND_HALF"]);

export function isPeriodInPlay(period: Period): boolean {
  return IN_PLAY.has(period);
}

function elapsedSince(start: number | null, now: number): number {
  if (start === null) return 0;
  return Math.max(0, now - start);
}

/** Fecha o segmento corrente somando-o ao acumulador correspondente. */
function settle(state: ClockState, now: number): ClockState {
  if (!isPeriodInPlay(state.period) || state.segmentStartedAt === null) return state;
  const delta = elapsedSince(state.segmentStartedAt, now);
  return state.ballInPlay
    ? { ...state, rollingMs: state.rollingMs + delta, segmentStartedAt: now }
    : { ...state, stoppedMs: state.stoppedMs + delta, segmentStartedAt: now };
}

/** Inicia o 1º tempo (antes do jogo) ou o 2º tempo (no intervalo). */
export function kickOff(state: ClockState, now: number): ClockState {
  const next: Partial<Record<Period, Period>> = {
    NOT_STARTED: "FIRST_HALF",
    HALFTIME: "SECOND_HALF",
  };
  const period = next[state.period];
  if (!period) {
    throw new ClockTransitionError(`Não é possível iniciar a partir de ${state.period}.`);
  }
  return { period, ballInPlay: true, segmentStartedAt: now, rollingMs: 0, stoppedMs: 0 };
}

/** Pausa (bola parada) ou retoma (bola rolando). */
export function setBallInPlay(state: ClockState, ballInPlay: boolean, now: number): ClockState {
  if (!isPeriodInPlay(state.period)) {
    throw new ClockTransitionError("O cronômetro só pode ser pausado com a partida em andamento.");
  }
  if (state.ballInPlay === ballInPlay) return state;
  return { ...settle(state, now), ballInPlay };
}

/** Encerra o período atual: 1º tempo → intervalo, 2º tempo → fim de jogo. */
export function endPeriod(state: ClockState, now: number): ClockState {
  if (!isPeriodInPlay(state.period)) {
    throw new ClockTransitionError(`Não há período em andamento (${state.period}).`);
  }
  const settled = settle(state, now);
  return {
    ...settled,
    period: state.period === "FIRST_HALF" ? "HALFTIME" : "FINISHED",
    ballInPlay: false,
    segmentStartedAt: null,
  };
}

function periodBaseMinutes(period: Period, cfg: ClockConfig): number {
  return period === "SECOND_HALF" ? cfg.periodMinutes : 0;
}

export function snapshot(state: ClockState, now: number, cfg: ClockConfig): ClockSnapshot {
  const running = isPeriodInPlay(state.period) && state.segmentStartedAt !== null;
  const live = running ? elapsedSince(state.segmentStartedAt, now) : 0;
  const rollingMs = state.rollingMs + (running && state.ballInPlay ? live : 0);
  const stoppedMs = state.stoppedMs + (running && !state.ballInPlay ? live : 0);
  const totalMs = rollingMs + stoppedMs;

  if (!isPeriodInPlay(state.period)) {
    const labels: Record<Period, string> = {
      NOT_STARTED: "Pré-jogo",
      HALFTIME: "Intervalo",
      FINISHED: "Encerrado",
      FIRST_HALF: "",
      SECOND_HALF: "",
    };
    return {
      period: state.period,
      running: false,
      ballInPlay: false,
      rollingMs,
      stoppedMs,
      totalMs,
      minute: null,
      stoppageMinute: null,
      label: labels[state.period],
    };
  }

  const base = periodBaseMinutes(state.period, cfg);
  const periodMinute = Math.floor(totalMs / 60_000) + 1;
  const regulationEnd = base + cfg.periodMinutes;
  const minute = base + periodMinute;
  const stoppage = minute > regulationEnd ? minute - regulationEnd : null;

  return {
    period: state.period,
    running,
    ballInPlay: state.ballInPlay,
    rollingMs,
    stoppedMs,
    totalMs,
    minute,
    stoppageMinute: stoppage,
    label: stoppage ? `${regulationEnd}+${stoppage}'` : `${minute}'`,
  };
}
