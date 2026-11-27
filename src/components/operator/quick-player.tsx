"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { POSITION_NAME, POSITION_ORDER } from "@/domain/labels";
import { quickAddPlayer } from "@/domain/match/roster-actions";
import { cn } from "@/lib/utils";

type Team = { id: string; name: string };

/**
 * Cadastro rápido de jogador na hora do jogo: nome, número e posição.
 * Fica salvo no time (vale para os próximos jogos também).
 */
export function QuickPlayer({ matchId, home, away, counts }: { matchId: string; home: Team; away: Team; counts: Record<string, number> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState(home.id);
  const [pending, start] = useTransition();
  const [added, setAdded] = useState<string[]>([]);
  const nameRef = useRef<HTMLInputElement>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const shirt = String(fd.get("shirt") ?? "").trim();
    start(async () => {
      const r = await quickAddPlayer({
        matchId, teamId: team, name: String(fd.get("name") ?? ""),
        shirtNumber: shirt === "" ? null : Number(shirt),
        position: (String(fd.get("position") || "") || null) as (typeof POSITION_ORDER)[number] | null,
      });
      if (!r?.ok) { toast.error(r?.message ?? "Erro ao cadastrar."); return; }
      toast.success(r.message);
      setAdded((a) => [`${shirt ? `${shirt} · ` : ""}${fd.get("name")} (${team === home.id ? home.name : away.name})`, ...a].slice(0, 8));
      form.reset();
      nameRef.current?.focus();
      router.refresh();
    });
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between bg-surface-2 px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide">
        <span>+ Cadastrar jogador na hora</span>
        <span className="font-normal normal-case text-muted-foreground">{home.name}: {counts[home.id] ?? 0} • {away.name}: {counts[away.id] ?? 0} {open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <form onSubmit={submit} className="space-y-3 p-3">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Time do jogador">
            {[home, away].map((t) => (
              <button key={t.id} type="button" aria-pressed={team === t.id} onClick={() => setTeam(t.id)}
                className={cn("h-11 truncate rounded-lg border-2 px-2 text-sm font-bold", team === t.id ? "border-brand-green text-brand-green" : "text-muted-foreground")}>{t.name}</button>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Nome do jogador
              <input ref={nameRef} name="name" required minLength={2} maxLength={80} autoComplete="off" className="mt-1 h-12 w-full rounded-lg border bg-background px-3 text-base" />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">Número
              <input name="shirt" type="number" inputMode="numeric" min={0} max={99} className="mt-1 h-12 w-full rounded-lg border bg-background px-3 text-base" />
            </label>
          </div>
          <label className="block text-xs font-semibold text-muted-foreground">Posição (opcional)
            <select name="position" className="mt-1 h-12 w-full rounded-lg border bg-background px-3 text-base">
              <option value="">—</option>
              {POSITION_ORDER.map((p) => <option key={p} value={p}>{POSITION_NAME[p]}</option>)}
            </select>
          </label>
          <button disabled={pending} className="h-12 w-full rounded-xl bg-brand-green font-extrabold text-primary-foreground disabled:opacity-50">{pending ? "Salvando…" : "Cadastrar jogador"}</button>
          <p className="text-[11px] text-muted-foreground">O jogador fica salvo no time e já aparece para gol, cartão e substituição.</p>
          {added.length > 0 && <ul className="space-y-1 text-sm">{added.map((a, i) => <li key={i}>✓ {a}</li>)}</ul>}
        </form>
      )}
    </section>
  );
}
