"use client";

import { cn } from "@/lib/utils";

export const MATCH_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "live", label: "Ao vivo" },
  { value: "finished", label: "Finalizados" },
  { value: "scheduled", label: "Agendados" },
] as const;
export type MatchFilter = (typeof MATCH_FILTERS)[number]["value"];

export function MatchFilterTabs({
  value,
  onChange,
  liveCount = 0,
}: {
  value: MatchFilter;
  onChange: (v: MatchFilter) => void;
  liveCount?: number;
}) {
  return (
    <div role="tablist" aria-label="Filtrar partidas" className="flex gap-1.5 overflow-x-auto">
      {MATCH_FILTERS.map((f) => {
        const active = f.value === value;
        return (
          <button
            key={f.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(f.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
              active
                ? f.value === "live"
                  ? "border-brand-live bg-brand-live text-white"
                  : "border-brand-green bg-brand-green text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
            {f.value === "live" && liveCount > 0 && (
              <span className="rounded-full bg-black/25 px-1.5 text-[10px]">{liveCount}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
