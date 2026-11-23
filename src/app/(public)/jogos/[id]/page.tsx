import Link from "next/link";
import { notFound } from "next/navigation";
import { requestNow } from "@/lib/clock-now";
import { Suspense } from "react";
import { LiveClocks, LiveMinute } from "@/components/live/live-minute";
import { LiveRefresher } from "@/components/live/live-refresher";
import { realtimeEnabled } from "@/lib/realtime";
import { SponsorSlot } from "@/components/engagement/sponsor-slot";
import { StatCompare } from "@/components/brand/stat-compare";
import { listMatchEvents, listMatchStats } from "@/domain/match/queries";
import { Scoreboard } from "@/components/brand/scoreboard";
import { StatusPill } from "@/components/brand/status-pill";
import { getCompetitionBy, getMatch } from "@/domain/competitions/queries";
import { MATCH_STATUS_LABEL, clockStateOf } from "@/domain/labels";
import { snapshot } from "@/domain/match/clock";
import { formatDateTime } from "@/lib/datetime";

async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const now = await requestNow();
  const m = await getMatch(id);
  if (!m) notFound();
  const comp = await getCompetitionBy({ id: m.competitionId, publicOnly: true });
  if (!comp) notFound();
  const [events, stats] = await Promise.all([listMatchEvents(m.id), listMatchStats(m.id)]);
  const valid = events.filter((e) => !e.voidedAt);
  const hs = stats.find((x) => x.teamId === m.homeId);
  const as = stats.find((x) => x.teamId === m.awayId);
  const cards = (teamId: string, t: "YELLOW" | "RED") => valid.filter((e) => e.teamId === teamId && e.type === t).length;
  const scorers = valid
    .filter((e) => e.type === "GOAL")
    .map((e) => `${e.athleteNick ?? e.athleteName ?? "Gol"} ${e.minute}'${e.detail.ownGoal ? " (contra)" : ""}`)
    .join(" • ");
  const live = m.status === "LIVE";
  const showScore = m.status === "LIVE" || m.status === "FINISHED" || m.status === "CONFIRMED";
  const clock = snapshot(clockStateOf(m), now, { periodMinutes: m.periodMinutes });
  const tone = live ? "live" : m.status === "CONFIRMED" || m.status === "FINISHED" ? "finished" : "scheduled";
  const label = m.status === "SCHEDULED" ? "Em breve" : MATCH_STATUS_LABEL[m.status];

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 py-6 sm:px-4">
      {m.status !== "CONFIRMED" && m.status !== "CANCELLED" && <LiveRefresher matches={[{ id: m.id, version: m.version }]} realtime={realtimeEnabled()} />}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusPill tone={tone}>{live ? <>Ao vivo • <LiveMinute clock={clockStateOf(m)} periodMinutes={m.periodMinutes} fallback={clock.label} /></> : label}</StatusPill>
          <Link href={`/campeonatos/${m.competitionSlug}`} className="text-xs text-muted-foreground hover:text-foreground">
            {m.competitionName}{m.phaseName ? ` • ${m.phaseName}` : ""}{m.groupName ? ` • ${m.groupName}` : ""}
          </Link>
        </div>
        {showScore ? (
          <Scoreboard homeName={m.homeName} awayName={m.awayName} homeScore={m.homeScore} awayScore={m.awayScore} scorers={scorers || undefined} />
        ) : (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-6">
            <Link href={`/equipes/${m.homeSlug}`} className="truncate text-right text-lg font-bold uppercase hover:text-brand-green">{m.homeName}</Link>
            <span className="font-mono text-2xl font-black text-brand-green">x</span>
            <Link href={`/equipes/${m.awaySlug}`} className="truncate text-lg font-bold uppercase hover:text-brand-green">{m.awayName}</Link>
          </div>
        )}
        {live && <div className="mb-4"><LiveClocks clock={clockStateOf(m)} periodMinutes={m.periodMinutes} /></div>}
        <dl className="grid gap-2 border-t pt-4 text-sm sm:grid-cols-3">
          <div><dt className="text-[11px] uppercase text-muted-foreground">Data</dt><dd className="font-semibold">{formatDateTime(m.scheduledAt)}</dd></div>
          <div><dt className="text-[11px] uppercase text-muted-foreground">Local</dt><dd className="font-semibold">{m.venueName ?? "A definir"}</dd></div>
          <div><dt className="text-[11px] uppercase text-muted-foreground">Arbitragem</dt><dd className="font-semibold">{m.refereeName ?? "A definir"}</dd></div>
        </dl>
      </div>
      <SponsorSlot placement="MATCH" />
      {(hs || as) && (
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Estatísticas</h2>
          <StatCompare label="Finalizações" home={hs?.shots ?? 0} away={as?.shots ?? 0} />
          <StatCompare label="No gol" home={hs?.shotsOnTarget ?? 0} away={as?.shotsOnTarget ?? 0} />
          <StatCompare label="Escanteios" home={hs?.corners ?? 0} away={as?.corners ?? 0} />
          <StatCompare label="Impedimentos" home={hs?.offsides ?? 0} away={as?.offsides ?? 0} />
          <StatCompare label="Cartões amarelos" home={cards(m.homeId, "YELLOW")} away={cards(m.awayId, "YELLOW")} />
          <StatCompare label="Cartões vermelhos" home={cards(m.homeId, "RED")} away={cards(m.awayId, "RED")} />
        </section>
      )}
      {valid.length > 0 && (
        <section className="overflow-hidden rounded-2xl border bg-card">
          <h2 className="bg-surface-2 px-5 py-2 text-xs font-bold uppercase tracking-wide">Linha do tempo</h2>
          <ul className="divide-y text-sm">
            {valid.map((e) => {
              const isHome = e.teamId === m.homeId;
              const label = { GOAL: "⚽ Gol", YELLOW: "🟨 Cartão", RED: "🟥 Expulsão", SUB: "🔁 Substituição" }[e.type];
              return (
                <li key={e.id} className={`flex items-center gap-3 px-5 py-2.5 ${isHome ? "" : "flex-row-reverse text-right"}`}>
                  <span className="tabular w-10 font-mono font-bold text-brand-green">{e.minute}&apos;</span>
                  <span className="flex-1"><span className="font-semibold">{label}</span> • {e.athleteNick ?? e.athleteName ?? (isHome ? m.homeName : m.awayName)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function Page(props: PageProps<"/jogos/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-60 max-w-3xl animate-pulse rounded-xl bg-card" />}>
      <MatchPage params={props.params} />
    </Suspense>
  );
}
