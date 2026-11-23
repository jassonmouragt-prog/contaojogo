import { formatMatchDate } from "@/lib/format";
import { StatusPill } from "./status-pill";

export type MatchCardStatus = "scheduled" | "live" | "finished";

const statusLabel: Record<MatchCardStatus, string> = {
  scheduled: "Em breve",
  live: "Ao vivo",
  finished: "Finalizado",
};

export function MatchCard({
  homeName,
  awayName,
  kickoffAt,
  status,
  venue,
  homeScore,
  awayScore,
  liveLabel,
}: {
  homeName: string;
  awayName: string;
  kickoffAt: Date;
  status: MatchCardStatus;
  venue?: string;
  homeScore?: number;
  awayScore?: number;
  liveLabel?: string;
}) {
  const showScore = status !== "scheduled" && homeScore !== undefined && awayScore !== undefined;
  return (
    <article className="rounded-2xl border bg-card p-4">
      <StatusPill tone={status}>
        {statusLabel[status]}
        {status === "live" && liveLabel ? ` • ${liveLabel}` : ""}
      </StatusPill>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <p className="truncate text-right font-bold">{homeName}</p>
        <p className="tabular font-mono text-lg font-black text-brand-green">
          {showScore ? `${homeScore} - ${awayScore}` : "x"}
        </p>
        <p className="truncate font-bold">{awayName}</p>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        <time dateTime={kickoffAt.toISOString()}>{formatMatchDate(kickoffAt)}</time>
        {venue ? ` • ${venue}` : ""}
      </p>
    </article>
  );
}
