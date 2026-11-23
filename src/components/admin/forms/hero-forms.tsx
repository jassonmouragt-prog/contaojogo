"use client";

import { useState } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { SelectInput, SubmitButton, TextInput } from "@/components/admin/fields";
import { createHeroSlide, updateHeroSlide } from "@/domain/engagement/actions";

export function HeroSlideForm({ sponsors }: { sponsors: { value: string; label: string }[] }) {
  const [kind, setKind] = useState("HIGHLIGHT");
  return (
    <ActionForm action={createHeroSlide} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
      {(pending) => (
        <>
          <SelectInput label="Tipo" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} options={[{ value: "HIGHLIGHT", label: "Destaque (jogo, campeonato, notícia)" }, { value: "SPONSOR", label: "Anúncio de patrocinador" }]} />
          {kind === "SPONSOR" ? <SelectInput label="Patrocinador" name="sponsorId" options={sponsors} placeholder="Escolha…" required /> : <span />}
          <TextInput label="Título" name="title" required maxLength={90} placeholder="Final da Copa LIFAQUI" />
          <TextInput label="Subtítulo" name="subtitle" maxLength={160} placeholder="Domingo, 16h, Arena Souzão" />
          <TextInput label="Imagem (link https, horizontal ~1600×600)" name="imageUrl" type="url" required className="sm:col-span-2" />
          <TextInput label="Link ao clicar" name="linkUrl" placeholder="/campeonatos/copa-lifaqui ou https://…" />
          <TextInput label="Texto do botão" name="ctaLabel" maxLength={30} placeholder="Ver tabela" />
          <TextInput label="Tempo na tela (s)" name="durationSeconds" type="number" min={3} max={30} defaultValue={6} />
          <span />
          <TextInput label="Exibir a partir de" name="startsAt" type="datetime-local" />
          <TextInput label="Exibir até" name="endsAt" type="datetime-local" />
          <div className="sm:col-span-2"><SubmitButton pending={pending}>Publicar banner</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

export function HeroRowActions({ id, active }: { id: string; active: boolean }) {
  return (
    <div className="flex gap-1">
      {(["up", "down", "toggle"] as const).map((op) => (
        <ActionForm key={op} action={updateHeroSlide}>
          {(pending) => (
            <>
              <input type="hidden" name="id" value={id} /><input type="hidden" name="op" value={op} />
              <button disabled={pending} aria-label={op === "up" ? "Subir" : op === "down" ? "Descer" : undefined} className="rounded-md border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">
                {op === "up" ? "↑" : op === "down" ? "↓" : active ? "Pausar" : "Ativar"}
              </button>
            </>
          )}
        </ActionForm>
      ))}
    </div>
  );
}
