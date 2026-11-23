"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { AthleteActiveToggle, AthleteEditForm } from "@/components/admin/forms/team-forms";
import { POSITION_LABEL, POSITION_NAME } from "@/domain/labels";
import { cn } from "@/lib/utils";

type Athlete = { id: string; name: string; nickname: string | null; shirtNumber: number | null; position: keyof typeof POSITION_NAME | null; photoUrl: string | null; active: boolean; birthDate: string | null };

export function AthleteCard({ athlete, teamId, goals, pending }: { athlete: Athlete; teamId: string; goals: number; pending: number }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <li className="rounded-2xl border border-brand-amber/40 bg-card p-4 sm:col-span-2 xl:col-span-3"><AthleteEditForm athlete={athlete} teamId={teamId} onDone={() => setEditing(false)} /></li>;
  return (
    <li className={cn("flex items-center gap-3 rounded-2xl border bg-card p-3", !athlete.active && "opacity-50")}>
      <span className="relative shrink-0">
        {athlete.photoUrl ? (
          <img src={athlete.photoUrl} alt="" className="size-14 rounded-full object-cover" />
        ) : (
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-deep font-display text-xl font-bold text-brand-green">{athlete.name.charAt(0)}</span>
        )}
        {athlete.shirtNumber != null && <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-brand-amber font-mono text-[11px] font-bold text-black">{athlete.shirtNumber}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{athlete.nickname ?? athlete.name}</span>
        <span className="block text-xs text-muted-foreground">
          {athlete.position ? POSITION_LABEL[athlete.position] : "Sem posição"} • <span className="font-semibold text-brand-amber">{goals}</span> gol{goals === 1 ? "" : "s"}{pending > 0 ? ` (+${pending})` : ""}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <button type="button" onClick={() => setEditing(true)} className="rounded-md bg-brand-amber px-2.5 py-1 text-[11px] font-bold text-black">Editar</button>
        <AthleteActiveToggle athlete={athlete} />
      </span>
    </li>
  );
}
