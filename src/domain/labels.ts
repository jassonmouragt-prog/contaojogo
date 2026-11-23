import type { MatchRowData, MatchRowStatus } from "@/components/brand/match-row";
import type { ClockState } from "@/domain/match/clock";
import { snapshot } from "@/domain/match/clock";
import { formatTime } from "@/lib/datetime";

export const MODALITY_LABEL = { FIELD: "Futebol de campo", FUTSAL: "Futsal" } as const;
export const COMPETITION_STATUS_LABEL = {
  DRAFT: "Rascunho",
  REGISTRATION: "Inscrições",
  ONGOING: "Em andamento",
  FINISHED: "Finalizado",
} as const;
export const PHASE_TYPE_LABEL = { LEAGUE: "Pontos corridos", GROUPS: "Grupos", KNOCKOUT: "Mata-mata" } as const;
export const POSITION_LABEL = { GK: "GOL", DEF: "DEF", MID: "MEI", FWD: "ATA" } as const;
export const POSITION_NAME = { GK: "Goleiro", DEF: "Defensor", MID: "Meio-campo", FWD: "Atacante" } as const;
export const MATCH_STATUS_LABEL = {
  SCHEDULED: "Agendado",
  LIVE: "Ao vivo",
  FINISHED: "Aguardando confirmação",
  CONFIRMED: "Finalizado",
  POSTPONED: "Adiado",
  CANCELLED: "Cancelado",
} as const;

type MatchLike = {
  id: string;
  status: keyof typeof MATCH_STATUS_LABEL;
  scheduledAt: Date;
  homeScore: number;
  awayScore: number;
  period: ClockState["period"];
  ballInPlay: boolean;
  segmentStartedAt: Date | null;
  rollingMs: number;
  stoppedMs: number;
  periodMinutes: number;
  version?: number;
  homeName: string;
  homeCrest: string | null;
  awayName: string;
  awayCrest: string | null;
};

export function clockStateOf(m: Pick<MatchLike, "period" | "ballInPlay" | "segmentStartedAt" | "rollingMs" | "stoppedMs">): ClockState {
  return {
    period: m.period,
    ballInPlay: m.ballInPlay,
    segmentStartedAt: m.segmentStartedAt ? m.segmentStartedAt.getTime() : null,
    rollingMs: m.rollingMs,
    stoppedMs: m.stoppedMs,
  };
}

export function toRowStatus(m: Pick<MatchLike, "status" | "period">): MatchRowStatus {
  switch (m.status) {
    case "LIVE":
      return m.period === "HALFTIME" ? "halftime" : "live";
    case "FINISHED":
    case "CONFIRMED":
      return "finished";
    case "POSTPONED":
    case "CANCELLED":
      return "postponed";
    default:
      return "scheduled";
  }
}

export function toMatchRow(m: MatchLike, now: number, href?: string): MatchRowData {
  const status = toRowStatus(m);
  return {
    id: m.id,
    href,
    status,
    kickoffTime: formatTime(m.scheduledAt),
    liveLabel: status === "live" ? snapshot(clockStateOf(m), now, { periodMinutes: m.periodMinutes }).label : undefined,
    clock: status === "live" ? { state: clockStateOf(m), periodMinutes: m.periodMinutes } : undefined,
    version: m.version,
    home: { name: m.homeName, crest: m.homeCrest, score: m.homeScore },
    away: { name: m.awayName, crest: m.awayCrest, score: m.awayScore },
  };
}
