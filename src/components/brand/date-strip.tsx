"use client";

import { cn } from "@/lib/utils";

/** Faixa de dias (tela 08 / Flashscore). `days` vêm como ISO yyyy-mm-dd no fuso do app. */
export function DateStrip({
  days,
  value,
  today,
  onChange,
}: {
  days: string[];
  value: string;
  today: string;
  onChange: (day: string) => void;
}) {
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });
  return (
    <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Escolher data">
      {days.map((d) => {
        const date = new Date(`${d}T12:00:00Z`);
        const active = d === value;
        const label = d === today ? "Hoje" : weekday.format(date).replace(".", "");
        return (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(d)}
            className={cn(
              "flex min-w-14 shrink-0 flex-col items-center rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase transition-colors",
              active ? "bg-brand-deep text-brand-green" : "text-muted-foreground hover:bg-card hover:text-foreground",
            )}
          >
            <span>{label}</span>
            <span className="tabular text-sm text-foreground">{d.slice(8, 10)}/{d.slice(5, 7)}</span>
          </button>
        );
      })}
    </div>
  );
}
