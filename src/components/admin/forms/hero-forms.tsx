"use client";

import { useEffect, useRef, useState } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { ImageUpload } from "@/components/admin/image-upload";
import { SelectInput, SubmitButton, TextInput } from "@/components/admin/fields";
import { createHeroSlide, updateHeroSlide } from "@/domain/engagement/actions";

export function HeroSlideForm({ sponsors }: { sponsors: { value: string; label: string }[] }) {
  const [kind, setKind] = useState("HIGHLIGHT");
  const anchor = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = anchor.current?.closest("form");
    const reset = () => setKind("HIGHLIGHT");
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);
  return (
    <ActionForm action={createHeroSlide} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
      {(pending) => (
        <>
          <span ref={anchor} hidden />
          <SelectInput label="Tipo" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} options={[{ value: "HIGHLIGHT", label: "Destaque (jogo, campeonato, notícia)" }, { value: "SPONSOR", label: "Anúncio de patrocinador" }]} />
          {kind === "SPONSOR" ? <SelectInput label="Patrocinador" name="sponsorId" options={sponsors} placeholder="Escolha…" required /> : <span />}
          <TextInput label="Título" name="title" required maxLength={90} placeholder="Final da Copa LIFAQUI" />
          <TextInput label="Subtítulo" name="subtitle" maxLength={160} placeholder="Domingo, 16h, Arena Souzão" />
          <div className="sm:col-span-2"><ImageUpload label="Imagem do banner" name="imageUrl" purpose="BANNER" required hint="Horizontal, de preferência 1920×720. O texto fica sobre o lado esquerdo." /></div>
          <TextInput label="Link ao clicar" name="linkUrl" placeholder="/campeonatos/copa-lifaqui ou https://…" />
          <TextInput label="Texto do botão" name="ctaLabel" maxLength={30} placeholder="Ver tabela" />
          <TextInput label="Tempo na tela (s)" name="durationSeconds" type="number" min={3} max={30} defaultValue={6} />
          <span />
          <TextInput label="Exibir a partir de (dia e hora)" name="startsAt" type="datetime-local" hint="Vazio = já começa agora" />
          <TextInput label="Exibir até (dia e hora)" name="endsAt" type="datetime-local" hint="Vazio = sem data para sair" />
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
