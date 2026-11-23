"use client";

/* eslint-disable @next/next/no-img-element -- banners externos (https) cadastrados no admin */
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TeamCrest } from "@/components/brand/team-crest";
import type { MatchRowData } from "@/components/brand/match-row";
import { LiveMinute } from "@/components/live/live-minute";
import { cn } from "@/lib/utils";

export type HeroSlide =
  | { id: string; kind: "SPONSOR" | "HIGHLIGHT"; title: string; subtitle: string | null; imageUrl: string; href: string | null; cta: string | null; duration: number; sponsorId: string | null; sponsorName?: string | null }
  | { id: "today"; kind: "TODAY"; matches: MatchRowData[]; total: number; live: number; duration: number }
  | { id: "brand"; kind: "BRAND"; duration: number };

/**
 * Banner principal do portal (inspirado no site antigo + Sofascore):
 * anúncios de patrocinadores, destaques e o resumo automático dos jogos do dia.
 * Troca sozinho com barra de progresso; pausa ao passar o mouse; arrasta no celular.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0);
  const seen = useRef(new Set<string>());
  const touchX = useRef<number | null>(null);
  const n = slides.length;
  const s = slides[i % n];

  const go = useCallback((d: number) => { setI((x) => (x + d + n) % n); setCycle((c) => c + 1); }, [n]);

  useEffect(() => {
    if (n < 2 || paused) return;
    const t = setTimeout(() => go(1), s.duration * 1000);
    return () => clearTimeout(t);
  }, [s, n, paused, go, cycle]);

  // Visualização do anúncio conta uma vez por página aberta.
  useEffect(() => {
    if (s.kind !== "SPONSOR" || !s.sponsorId || seen.current.has(s.id) || document.visibilityState !== "visible") return;
    seen.current.add(s.id);
    navigator.sendBeacon?.("/api/sponsors/impression", new Blob([JSON.stringify({ placement: "HOME", ids: [s.sponsorId] })], { type: "application/json" }));
  }, [s]);

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touchX.current === null) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); touchX.current = null; }}
      className="group relative h-[240px] overflow-hidden rounded-2xl border border-brand-green/20 bg-[#04100a] shadow-[0_20px_60px_-30px_rgba(30,227,123,0.35)] sm:h-[330px] lg:h-[380px]"
    >
      <div key={s.id} className="absolute inset-0 animate-in fade-in duration-500">
        <SlideView s={s} />
      </div>

      {n > 1 && (
        <>
          <div className="absolute inset-x-4 top-3 z-20 flex gap-1.5">
            {slides.map((x, k) => (
              <button key={x.id} type="button" onClick={() => { setI(k); setCycle((c) => c + 1); }} aria-label={`Ir para o destaque ${k + 1}`} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                <span
                  key={`${cycle}-${k === i}`}
                  className={cn("block h-full rounded-full bg-brand-green", k < i ? "w-full" : k === i ? "hero-progress" : "w-0")}
                  style={k === i ? { animationDuration: `${s.duration}s`, animationPlayState: paused ? "paused" : "running" } : undefined}
                />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => go(-1)} aria-label="Anterior" className="absolute left-3 top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 sm:flex"><ChevronLeft className="size-5" /></button>
          <button type="button" onClick={() => go(1)} aria-label="Próximo" className="absolute right-3 top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 sm:flex"><ChevronRight className="size-5" /></button>
        </>
      )}
    </section>
  );
}

function SlideView({ s }: { s: HeroSlide }) {
  if (s.kind === "TODAY") return <TodaySlide s={s} />;
  if (s.kind === "BRAND") return <BrandSlide />;
  const textless = !s.title && !s.subtitle && !s.cta;
  const body = textless ? (
    <img src={s.imageUrl} alt={s.sponsorName ?? "Destaque"} className="absolute inset-0 size-full object-cover" />
  ) : (
    <>
      <img src={s.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent sm:bg-gradient-to-r sm:from-black/85 sm:via-black/40" />
      <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 p-5 sm:max-w-xl sm:p-8">
        <span className={cn("inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest", s.kind === "SPONSOR" ? "bg-white text-black" : "bg-brand-green text-primary-foreground")}>
          {s.kind === "SPONSOR" ? s.sponsorName ?? "Patrocinador" : "Destaque"}
        </span>
        {s.title && <h2 className="font-display text-3xl font-extrabold uppercase leading-[0.95] text-white drop-shadow sm:text-5xl">{s.title}</h2>}
        {s.subtitle && <p className="max-w-md text-sm text-white/80 sm:text-base">{s.subtitle}</p>}
        {s.href && s.cta && <span className="mt-1 inline-flex h-10 items-center rounded-full bg-brand-green px-5 text-sm font-bold text-primary-foreground">{s.cta}</span>}
      </div>
    </>
  );
  return s.href ? (
    <a href={s.href} target={s.href.startsWith("/api/hero") && s.kind === "SPONSOR" ? "_blank" : undefined} rel={s.kind === "SPONSOR" ? "noopener sponsored" : undefined} className="absolute inset-0 block" aria-label={s.title || s.sponsorName || "Destaque"}>{body}</a>
  ) : <div className="absolute inset-0">{body}</div>;
}

function TodaySlide({ s }: { s: Extract<HeroSlide, { kind: "TODAY" }> }) {
  return (
    <div className="bg-pitch-grid absolute inset-0 flex flex-col justify-end gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-brand-green/20 blur-3xl" />
      <div className="relative z-10 space-y-2">
        {s.live > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-live px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white"><span className="size-1.5 animate-pulse rounded-full bg-white" />{s.live} ao vivo</span>
        ) : (
          <span className="inline-block rounded-full bg-brand-green px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">Hoje</span>
        )}
        <h2 className="font-display text-4xl font-extrabold uppercase leading-[0.9] text-white sm:text-6xl">Jogos<br /><span className="text-brand-green">de hoje</span></h2>
        <p className="text-sm text-white/70">{s.total} {s.total === 1 ? "partida" : "partidas"} na agenda</p>
      </div>
      <ul className="relative z-10 hidden w-full max-w-md gap-2 sm:grid">
        {s.matches.map((m) => (
          <li key={m.id}>
            <Link href={m.href ?? "#"} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 backdrop-blur transition-colors hover:border-brand-green/50">
              <span className="flex min-w-0 items-center justify-end gap-2 text-right text-sm font-semibold text-white"><span className="truncate">{m.home.name}</span><TeamCrest name={m.home.name} src={m.home.crest} size={22} /></span>
              <span className={cn("tabular min-w-16 rounded-md px-2 py-1 text-center font-mono text-sm font-bold", m.status === "live" ? "bg-brand-live/20 text-brand-live" : m.status === "finished" ? "bg-white/10 text-white" : "bg-brand-green/15 text-brand-green")}>
                {m.status === "scheduled" || m.status === "postponed" ? m.kickoffTime : `${m.home.score} - ${m.away.score}`}
                {m.status === "live" && m.clock && <span className="block text-[10px]"><LiveMinute clock={m.clock.state} periodMinutes={m.clock.periodMinutes} fallback={m.liveLabel ?? ""} /></span>}
              </span>
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white"><TeamCrest name={m.away.name} src={m.away.crest} size={22} /><span className="truncate">{m.away.name}</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BrandSlide() {
  return (
    <div className="bg-pitch-grid absolute inset-0 flex flex-col justify-end p-5 sm:justify-center sm:p-10">
      <div aria-hidden className="pointer-events-none absolute -left-24 -bottom-24 size-96 rounded-full bg-brand-green/20 blur-3xl" />
      <p className="relative text-xs font-bold uppercase tracking-[0.25em] text-brand-green">contaojogo.club</p>
      <h1 className="relative mt-2 max-w-2xl font-display text-4xl font-extrabold uppercase leading-[0.9] text-white sm:text-6xl">
        O futebol da região <span className="text-brand-green">contado em números.</span>
      </h1>
      <p className="relative mt-3 max-w-md text-sm text-white/70">Placar ao vivo, tabelas, artilharia e estatísticas dos campeonatos de várzea.</p>
    </div>
  );
}
