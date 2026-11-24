"use client";

import { useState } from "react";
import { SponsorForm, SponsorRowActions, type SponsorInitial } from "@/components/admin/forms/engagement-forms";

const POS: Record<string, string> = { HOME: "Início", COMPETITION: "Competição", MATCH: "Partida" };

export function SponsorItem({ s, period, stats }: { s: SponsorInitial & { active: boolean }; period: string; stats: string }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className={`py-3 ${s.active || editing ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.logoUrl} alt="" className="h-12 w-20 rounded bg-white object-contain p-1" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {s.name}
            <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${s.active ? "bg-brand-green/15 text-brand-green" : "bg-muted text-muted-foreground"}`}>{s.active ? "No ar" : "Pausado"}</span>
          </p>
          <p className="text-xs text-muted-foreground">{period} · aparece em: {s.placements.map((p) => POS[p]).join(", ")} · {s.durationSeconds}s na tela</p>
          <p className="text-xs text-muted-foreground">{stats}</p>
        </div>
        <button type="button" onClick={() => setEditing((v) => !v)} className="rounded-md border px-3 py-1 text-xs font-semibold hover:bg-muted">
          {editing ? "Fechar" : "Editar"}
        </button>
        <SponsorRowActions id={s.id} active={s.active} />
      </div>
      {editing && (
        <div className="mt-3 rounded-xl border bg-muted/30 p-4">
          <SponsorForm initial={s} onDone={() => setEditing(false)} />
        </div>
      )}
    </li>
  );
}
