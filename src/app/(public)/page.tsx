import Link from "next/link";
import { requestNow } from "@/lib/clock-now";
import { Suspense } from "react";
import { MatchCenter } from "@/components/public/match-center";
import { listCompetitions, listMatchesBetween } from "@/domain/competitions/queries";
import { groupMatchesForCenter } from "@/domain/public/match-groups";
import { dayRange, dayStart, toLocalDay } from "@/lib/format";
import { realtimeEnabled } from "@/lib/realtime";
import { SponsorSlot } from "@/components/engagement/sponsor-slot";

async function TodayMatchCenter() {
  const now = await requestNow();
  const today = toLocalDay(new Date(now));
  const days = dayRange(today, 3, 3);
  const rows = await listMatchesBetween({
    from: dayStart(days[0]),
    to: new Date(dayStart(days[days.length - 1]).getTime() + 86_400_000),
    publicOnly: true,
  });
  return <MatchCenter groups={groupMatchesForCenter(rows, now)} days={days} today={today} realtime={realtimeEnabled()} />;
}

async function CompetitionsSidebar() {
  await requestNow();
  const rows = await listCompetitions({ publicOnly: true });
  if (rows.length === 0) return <p className="px-3 py-4 text-sm text-muted-foreground">Nenhuma competição publicada.</p>;
  return (
    <ul className="py-1">
      {rows.map((c) => (
        <li key={c.id}>
          <Link href={`/campeonatos/${c.slug}`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-row-hover hover:text-brand-green">
            <span aria-hidden className="h-3 w-0.5 rounded-full bg-brand-green" />
            <span className="truncate">{c.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const skeleton = <div className="h-64 animate-pulse rounded-xl border bg-card" aria-hidden />;

export default function HomePage() {
  return (
    <div className="mx-auto grid max-w-7xl gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-20 overflow-hidden rounded-xl border bg-card">
          <p className="bg-surface-2 px-3 py-2 text-xs font-bold uppercase tracking-wide">Competições</p>
          <Suspense fallback={<div className="h-24 animate-pulse" />}><CompetitionsSidebar /></Suspense>
        </div>
      </aside>
      <section aria-labelledby="jogos-title" className="min-w-0 space-y-3">
        <div className="flex items-end justify-between">
          <h1 id="jogos-title" className="text-2xl font-extrabold uppercase tracking-tight">
            Jogos <span className="text-brand-green">de hoje</span>
          </h1>
          <span className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">Futebol contado em números</span>
        </div>
        <Suspense fallback={null}><SponsorSlot placement="HOME" /></Suspense>
        <Suspense fallback={skeleton}><TodayMatchCenter /></Suspense>
      </section>
    </div>
  );
}
