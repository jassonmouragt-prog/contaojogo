import { formatScore } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Scoreboard({
  homeName,
  awayName,
  homeScore,
  awayScore,
  scorers,
  accent = "green",
  className,
}: {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  scorers?: string;
  accent?: "green" | "amber";
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-4", className)}>
      <p className="truncate text-right text-sm font-bold uppercase sm:text-lg">{homeName}</p>
      <div className="text-center">
        <p
          className={cn(
            "tabular font-mono text-5xl font-black sm:text-6xl",
            accent === "green" ? "text-brand-green" : "text-brand-amber",
          )}
          aria-label={`${homeName} ${homeScore}, ${awayName} ${awayScore}`}
        >
          {formatScore(homeScore, awayScore)}
        </p>
        {scorers && <p className="mt-1 text-xs text-muted-foreground">{scorers}</p>}
      </div>
      <p className="truncate text-sm font-bold uppercase sm:text-lg">{awayName}</p>
    </div>
  );
}
