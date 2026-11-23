import Link from "next/link";
import { Suspense } from "react";
import { SponsorSlot } from "@/components/engagement/sponsor-slot";
import { HeroCarousel, type HeroSlide } from "@/components/public/hero-carousel";
import { MatchCenter } from "@/components/public/match-center";
import { TeamCrest } from "@/components/brand/team-crest";
import { getDb } from "@/db";
import { sponsors } from "@/db/schema";
import { listCompetitions, listMatchesBetween } from "@/domain/competitions/queries";
import { activeHeroSlides, listPolls, publishedNews } from "@/domain/engagement/queries";
import { toMatchRow } from "@/domain/labels";
import { groupMatchesForCenter } from "@/domain/public/match-groups";
import { requestNow } from "@/lib/clock-now";
import { formatDateTime } from "@/lib/datetime";
import { dayRange, dayStart, toLocalDay } from "@/lib/format";
import { realtimeEnabled } from "@/lib/realtime";
import { inArray } from "drizzle-orm";

async function loadWeek(now: number) {
  const today = toLocalDay(new Date(now));
  const days = dayRange(today, 3, 3);
  const rows = await listMatchesBetween({ from: dayStart(days[0]), to: new Date(dayStart(days[days.length - 1]).getTime() + 86_400_000), publicOnly: true });
  return { today, days, rows };
}

async function Hero() {
  const now = await requestNow();
  const [slides, { today, rows }] = await Promise.all([activeHeroSlides(new Date(now)), loadWeek(now)]);
  const sponsorIds = slides.map((s) => s.sponsorId).filter((x): x is string => !!x);
  const names = sponsorIds.length ? new Map((await getDb().select({ id: sponsors.id, name: sponsors.name }).from(sponsors).where(inArray(sponsors.id, sponsorIds))).map((s) => [s.id, s.name])) : new Map<string, string>();

  const todayRows = rows.filter((m) => toLocalDay(m.scheduledAt) === today && m.status !== "CANCELLED");
  const todayMatches = todayRows.map((m) => toMatchRow(m, now, `/jogos/${m.id}`));
  const live = todayMatches.filter((m) => m.status === "live" || m.status === "halftime").length;
  const ordered = [...todayMatches].sort((a, b) => (a.status === "live" ? -1 : 0) - (b.status === "live" ? -1 : 0));

  const admin: HeroSlide[] = slides.map((s) => ({
    id: s.id, kind: s.kind === "SPONSOR" ? "SPONSOR" : "HIGHLIGHT", title: s.title, subtitle: s.subtitle, imageUrl: s.imageUrl,
    href: s.linkUrl ? `/api/hero/${s.id}/click` : null, cta: s.linkUrl ? s.ctaLabel ?? (s.kind === "SPONSOR" ? "Conheça" : "Ver mais") : null,
    duration: s.durationSeconds, sponsorId: s.sponsorId, sponsorName: s.sponsorId ? names.get(s.sponsorId) : null,
  }));
  const todaySlide: HeroSlide | null = todayMatches.length ? { id: "today", kind: "TODAY", matches: ordered.slice(0, 4), total: todayMatches.length, live, duration: 8 } : null;
  // Jogo ao vivo vem primeiro; sem nenhum banner cadastrado, a vitrine da marca ocupa o espaço.
  const list: HeroSlide[] = todaySlide && live > 0 ? [todaySlide, ...admin] : todaySlide ? [admin[0], todaySlide, ...admin.slice(1)].filter(Boolean) as HeroSlide[] : admin;
  if (list.length === 0) list.push({ id: "brand", kind: "BRAND", duration: 8 });
  return <HeroCarousel slides={list} />;
}

async function Matches() {
  const now = await requestNow();
  const { today, days, rows } = await loadWeek(now);
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
          <Link href={`/campeonatos/${c.slug}`} className="flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-row-hover hover:text-brand-green">
            <TeamCrest name={c.name} size={22} />
            <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{c.name}</span><span className="block text-[11px] text-muted-foreground">{c.season}</span></span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function RightRail() {
  const now = await requestNow();
  const [news, polls] = await Promise.all([publishedNews(new Date(now), 3), listPolls()]);
  const open = polls.find((p) => p.status === "OPEN" || p.status === "FINALISTS");
  return (
    <div className="space-y-4">
      <SponsorSlot placement="HOME" />
      {open && (
        <Link href="/indicacoes" className="block overflow-hidden rounded-xl border border-brand-green/30 bg-gradient-to-br from-brand-deep to-card p-4 transition-colors hover:border-brand-green">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green">{open.status === "FINALISTS" ? "Votação no Instagram" : "Indicações abertas"}</p>
          <p className="mt-1 font-display text-xl font-bold uppercase leading-tight">{open.title}</p>
          <p className="mt-2 text-xs font-semibold text-brand-green">{open.status === "FINALISTS" ? "Ver finalistas →" : "Indicar atleta →"}</p>
        </Link>
      )}
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between bg-surface-2 px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-wide">Notícias</p>
          <Link href="/noticias" className="text-[11px] font-semibold text-brand-green">Ver todas</Link>
        </div>
        {news.length === 0 ? <p className="px-3 py-4 text-sm text-muted-foreground">Nenhuma notícia publicada.</p> : (
          <ul className="divide-y divide-border/60">
            {news.map((n) => (
              <li key={n.id}>
                <Link href={`/noticias/${n.slug}`} className="flex gap-3 px-3 py-3 hover:bg-row-hover">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {n.coverUrl && <img src={n.coverUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />}
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-sm font-semibold leading-snug">{n.title}</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">{formatDateTime(n.publishAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const box = (h: string) => <div className={`${h} animate-pulse rounded-xl border bg-card`} aria-hidden />;

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-3 py-4 sm:px-4 sm:py-6">
      <Suspense fallback={box("h-[240px] sm:h-[330px] lg:h-[380px] rounded-2xl")}><Hero /></Suspense>

      <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_300px]">
        <aside className="hidden lg:block">
          <div className="sticky top-20 overflow-hidden rounded-xl border bg-card">
            <p className="bg-surface-2 px-3 py-2 text-xs font-bold uppercase tracking-wide">Competições</p>
            <Suspense fallback={box("h-24")}><CompetitionsSidebar /></Suspense>
          </div>
        </aside>

        <section aria-labelledby="jogos-title" className="min-w-0 space-y-3">
          <div className="flex items-end justify-between">
            <h2 id="jogos-title" className="text-2xl font-extrabold uppercase tracking-tight">Jogos</h2>
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">Futebol contado em números</span>
          </div>
          <Suspense fallback={box("h-64")}><Matches /></Suspense>
        </section>

        <aside className="min-w-0 lg:col-span-2 xl:col-span-1">
          <div className="xl:sticky xl:top-20"><Suspense fallback={box("h-40")}><RightRail /></Suspense></div>
        </aside>
      </div>
    </div>
  );
}
