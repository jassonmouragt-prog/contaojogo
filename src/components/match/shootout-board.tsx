import { cn } from "@/lib/utils";

type Side = { name: string; crest?: string | null; kicks: boolean[] };

/**
 * Disputa de pênaltis: uma fileira de bolas por equipe (✓ convertido, ✗ perdido,
 * vazio = ainda vai cobrar). Mostra 5 cobranças e cresce na morte súbita.
 */
export function ShootoutBoard({ home, away, winner, size = "md" }: { home: Side; away: Side; winner: "home" | "away" | null; size?: "md" | "lg" }) {
  const slots = Math.max(5, home.kicks.length, away.kicks.length);
  const goals = (k: boolean[]) => k.filter(Boolean).length;
  const row = (s: Side, won: boolean, lost: boolean) => (
    <div className={cn("flex items-center gap-3 rounded-xl px-3 py-2", won ? "bg-brand-green/10 ring-1 ring-brand-green/50" : "", lost && "opacity-70")}>
      <span className={cn("w-24 shrink-0 truncate font-bold sm:w-32", size === "lg" ? "text-base" : "text-sm")}>{s.name}</span>
      <ol className="flex flex-1 flex-wrap items-center gap-1.5" aria-label={`Cobranças de ${s.name}`}>
        {Array.from({ length: slots }, (_, i) => {
          const k = s.kicks[i];
          return (
            <li key={i} title={k === undefined ? "A cobrar" : k ? "Convertido" : "Perdido"}
              className={cn("grid place-items-center rounded-full font-black transition-transform",
                size === "lg" ? "size-8 text-sm" : "size-7 text-xs",
                k === undefined ? "border-2 border-dashed border-muted-foreground/40 text-transparent"
                  : k ? "animate-[kickin_.4s_ease] bg-brand-green text-primary-foreground shadow-[0_0_12px] shadow-brand-green/50"
                  : "animate-[kickin_.4s_ease] bg-brand-live text-white")}>
              {k === undefined ? "·" : k ? "✓" : "✗"}
            </li>
          );
        })}
      </ol>
      <span className={cn("tabular w-8 text-right font-mono font-black", size === "lg" ? "text-3xl" : "text-2xl", won && "text-brand-green")}>{goals(s.kicks)}</span>
    </div>
  );
  return (
    <div className="space-y-1.5">
      {row(home, winner === "home", winner === "away")}
      {row(away, winner === "away", winner === "home")}
      {winner && (
        <p className="pt-1 text-center text-sm font-extrabold uppercase tracking-wide text-brand-green">
          {(winner === "home" ? home : away).name} vence nos pênaltis por {goals((winner === "home" ? home : away).kicks)} a {goals((winner === "home" ? away : home).kicks)}
        </p>
      )}
    </div>
  );
}
