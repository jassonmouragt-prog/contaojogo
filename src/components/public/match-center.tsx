"use client";

import { useMemo, useState } from "react";
import { CompetitionGroup } from "@/components/brand/competition-group";
import { DateStrip } from "@/components/brand/date-strip";
import { MatchFilterTabs, type MatchFilter } from "@/components/brand/match-filter-tabs";
import { MatchRow, type MatchRowData } from "@/components/brand/match-row";
import { LiveRefresher } from "@/components/live/live-refresher";

export type MatchCenterGroup = {
  competitionId: string;
  competitionName: string;
  logoUrl?: string | null;
  subtitle?: string;
  href?: string;
  day: string;
  matches: MatchRowData[];
};

function matchesFilter(m: MatchRowData, f: MatchFilter) {
  if (f === "all") return true;
  if (f === "live") return m.status === "live" || m.status === "halftime";
  if (f === "finished") return m.status === "finished";
  return m.status === "scheduled" || m.status === "postponed";
}

/** Central de jogos do dia, no padrão Flashscore: datas + filtros + grupos por competição. */
export function MatchCenter({
  groups,
  days,
  today,
  realtime = false,
}: {
  groups: MatchCenterGroup[];
  days: string[];
  today: string;
  realtime?: boolean;
}) {
  const [day, setDay] = useState(today);
  const [filter, setFilter] = useState<MatchFilter>("all");

  const liveCount = useMemo(
    () => groups.flatMap((g) => g.matches).filter((m) => matchesFilter(m, "live")).length,
    [groups],
  );

  const visible = groups
    .filter((g) => (filter === "live" ? true : g.day === day))
    .map((g) => ({ ...g, matches: g.matches.filter((m) => matchesFilter(m, filter)) }))
    .filter((g) => g.matches.length > 0);

  // Acompanha jogos de hoje que ainda podem mudar (agendados ou ao vivo).
  const watch = groups
    .filter((g) => g.day === today)
    .flatMap((g) => g.matches)
    .filter((m) => m.status !== "finished" && m.version !== undefined)
    .map((m) => ({ id: m.id, version: m.version! }));

  return (
    <div className="space-y-3">
      <LiveRefresher matches={watch} realtime={realtime} />
      <div className="space-y-3 rounded-xl border bg-card p-3">
        <DateStrip days={days} value={day} today={today} onChange={setDay} />
        <MatchFilterTabs value={filter} onChange={setFilter} liveCount={liveCount} />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/60 px-6 py-10 text-center">
          <p className="font-semibold">
            {filter === "live" ? "Nenhuma partida ao vivo agora." : "Nenhuma partida nesta data."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Os jogos aparecem aqui assim que a organização publicar a agenda.
          </p>
        </div>
      ) : (
        visible.map((g) => (
          <CompetitionGroup key={`${g.competitionId}-${g.day}`} name={g.competitionName} subtitle={g.subtitle} href={g.href} logoUrl={g.logoUrl}>
            {g.matches.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </CompetitionGroup>
        ))
      )}
    </div>
  );
}
