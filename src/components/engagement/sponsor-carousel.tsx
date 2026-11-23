"use client";

/* eslint-disable @next/next/no-img-element -- logos externos (https) cadastrados pelo admin */
import { useEffect, useRef, useState } from "react";

export type SponsorItem = { id: string; name: string; logoUrl: string; linkUrl: string | null; durationSeconds: number };

/**
 * Carrossel de patrocinadores (PDF p.4): troca no tempo de cada banner
 * (padrão 4s), conta visualizações só com a aba visível (envio em lote por
 * sendBeacon) e cliques pelo redirecionamento /api/sponsors/[id]/click.
 */
export function SponsorCarousel({ items, placement }: { items: SponsorItem[]; placement: "HOME" | "COMPETITION" | "MATCH" }) {
  const [index, setIndex] = useState(0);
  const buffer = useRef<string[]>([]);
  const current = items[index % Math.max(items.length, 1)];

  useEffect(() => {
    if (!current) return;
    if (document.visibilityState === "visible") buffer.current.push(current.id);
    if (items.length < 2) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % items.length), current.durationSeconds * 1000);
    return () => clearTimeout(t);
  }, [current, items.length]);

  useEffect(() => {
    const flush = () => {
      if (buffer.current.length === 0) return;
      const ids = buffer.current.splice(0, 20);
      navigator.sendBeacon?.("/api/sponsors/impression", new Blob([JSON.stringify({ placement, ids })], { type: "application/json" }));
    };
    const t = setInterval(flush, 15_000);
    window.addEventListener("pagehide", flush);
    return () => { clearInterval(t); window.removeEventListener("pagehide", flush); flush(); };
  }, [placement]);

  if (!current) return null;
  const content = (
    <div className="flex h-20 items-center gap-4 rounded-xl border bg-white px-4 sm:h-24">
      <img src={current.logoUrl} alt={current.name} className="h-14 max-w-[45%] object-contain sm:h-16" />
      <div className="min-w-0 flex-1 text-black">
        <p className="text-[10px] font-bold uppercase tracking-widest text-black/50">Patrocinador</p>
        <p className="truncate font-display text-lg font-bold uppercase">{current.name}</p>
      </div>
      {current.linkUrl && <span className="shrink-0 rounded-full bg-black px-3 py-1.5 text-xs font-bold text-brand-green">Conheça</span>}
    </div>
  );
  return (
    <aside aria-label="Patrocinadores" aria-live="off">
      {current.linkUrl ? (
        <a href={`/api/sponsors/${current.id}/click?p=${placement}`} target="_blank" rel="noopener sponsored" key={current.id} className="block animate-in fade-in">
          {content}
        </a>
      ) : (
        <div key={current.id} className="animate-in fade-in">{content}</div>
      )}
      {items.length > 1 && (
        <div className="mt-1.5 flex justify-center gap-1">
          {items.map((s, i) => <span key={s.id} className={`h-1 rounded-full transition-all ${i === index % items.length ? "w-4 bg-brand-green" : "w-1.5 bg-muted"}`} />)}
        </div>
      )}
    </aside>
  );
}
