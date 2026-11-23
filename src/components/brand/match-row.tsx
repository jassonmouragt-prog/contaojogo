import Link from "next/link";
import { cn } from "@/lib/utils";
import { LiveMinute } from "@/components/live/live-minute";
import type { ClockState } from "@/domain/match/clock";
import { TeamCrest } from "./team-crest";

export type MatchRowStatus = "scheduled" | "live" | "halftime" | "finished" | "postponed";

export type MatchRowData = {
  id: string;
  href?: string;
  status: MatchRowStatus;
  /** Horário já formatado ("18:30") para jogos agendados. */
  kickoffTime: string;
  /** Minuto ao vivo ("67'", "45+2'"). */
  liveLabel?: string;
  /** Estado do cronômetro para o minuto andar no navegador. */
  clock?: { state: ClockState; periodMinutes: number };
  version?: number;
  home: { name: string; crest?: string | null; score?: number | null };
  away: { name: string; crest?: string | null; score?: number | null };
};

const statusText: Record<MatchRowStatus, string> = {
  scheduled: "",
  live: "",
  halftime: "Int.",
  finished: "Fim",
  postponed: "Adiado",
};

export const MATCH_ROW_STATUS_TEXT = statusText;

function TeamLine({
  team,
  bold,
  dim,
}: {
  team: MatchRowData["home"];
  bold: boolean;
  dim: boolean;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", dim && "text-muted-foreground")}>
      <TeamCrest name={team.name} src={team.crest} size={18} />
      <span className={cn("truncate text-sm", bold && "font-bold text-foreground")}>{team.name}</span>
    </span>
  );
}

/**
 * Linha de partida no padrão Flashscore/Sofascore: status/horário à esquerda,
 * equipes empilhadas e placar alinhado à direita. Vencedor em negrito.
 */
export function MatchRow({ match }: { match: MatchRowData }) {
  const { home, away, status } = match;
  const live = status === "live" || status === "halftime";
  const hasScore = status !== "scheduled" && status !== "postponed";
  const hs = home.score ?? 0;
  const as = away.score ?? 0;
  const finished = status === "finished";

  const content = (
    <div
      className={cn(
        "grid grid-cols-[3.25rem_1fr_auto] items-center gap-3 border-b border-border/60 px-3 py-2 transition-colors hover:bg-row-hover",
        live && "border-l-2 border-l-brand-live pl-[10px]",
      )}
    >
      <span
        className={cn(
          "tabular text-center text-xs",
          live ? "font-bold text-brand-live" : "text-muted-foreground",
        )}
      >
        {status === "live" ? (match.clock ? <LiveMinute clock={match.clock.state} periodMinutes={match.clock.periodMinutes} fallback={match.liveLabel ?? ""} /> : match.liveLabel) : statusText[status] || match.kickoffTime}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <TeamLine team={home} bold={finished && hs > as} dim={finished && hs < as} />
        <TeamLine team={away} bold={finished && as > hs} dim={finished && as < hs} />
      </span>
      <span
        className={cn(
          "tabular flex flex-col items-end gap-1 font-mono text-sm font-bold",
          live ? "text-brand-live" : "text-foreground",
        )}
      >
        <span>{hasScore ? hs : ""}</span>
        <span>{hasScore ? as : ""}</span>
      </span>
    </div>
  );

  return match.href ? (
    <Link href={match.href} className="block focus-visible:outline-2 focus-visible:outline-ring">
      {content}
    </Link>
  ) : (
    content
  );
}
