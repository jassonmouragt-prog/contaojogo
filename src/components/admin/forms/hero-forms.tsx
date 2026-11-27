"use client";

import { useEffect, useRef, useState } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { ImageUpload } from "@/components/admin/image-upload";
import { SelectInput, SubmitButton, TextInput } from "@/components/admin/fields";
import { createHeroSlide, deleteHeroSlide, editHeroSlide, updateHeroSlide } from "@/domain/engagement/actions";

export type HeroInitial = { id: string; kind: string; sponsorId: string | null; title: string; subtitle: string | null; imageUrl: string; mobileImageUrl: string | null; linkUrl: string | null; ctaLabel: string | null; durationSeconds: number; startsAt: string; endsAt: string };

export function HeroSlideForm({ sponsors, initial, onDone }: { sponsors: { value: string; label: string }[]; initial?: HeroInitial; onDone?: () => void }) {
  const [kind, setKind] = useState(initial?.kind ?? "HIGHLIGHT");
  const anchor = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = anchor.current?.closest("form");
    const reset = () => setKind("HIGHLIGHT");
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);
  return (
    <ActionForm action={initial ? editHeroSlide : createHeroSlide} resetOnSuccess={!initial} onSuccess={onDone} className="grid gap-3 sm:grid-cols-2">
      {(pending) => (
        <>
          <span ref={anchor} hidden />
          {initial && <input type="hidden" name="id" value={initial.id} />}
          <SelectInput label="Tipo" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} options={[{ value: "HIGHLIGHT", label: "Destaque (jogo, campeonato, notícia)" }, { value: "SPONSOR", label: "Anúncio de patrocinador" }]} />
          {kind === "SPONSOR" ? <SelectInput label="Patrocinador" name="sponsorId" options={sponsors} placeholder="Escolha…" required defaultValue={initial?.sponsorId ?? undefined} /> : <span />}
          <TextInput label="Título (opcional)" name="title" maxLength={90} placeholder="Final da Copa LIFAQUI" hint="Deixe vazio se o texto já está na arte." defaultValue={initial?.title} />
          <TextInput label="Subtítulo (opcional)" name="subtitle" maxLength={160} placeholder="Domingo, 16h, Arena Souzão" defaultValue={initial?.subtitle ?? ""} />
          <ImageUpload label="Imagem para computador" name="imageUrl" purpose="BANNER" required initialUrl={initial?.imageUrl} hint="2400×730 px (horizontal). Conteúdo importante no centro." />
          <div>
            <ImageUpload label="Imagem para celular (opcional)" name="mobileImageUrl" purpose="BANNER" initialUrl={initial?.mobileImageUrl ?? undefined} hint="1080×660 px. Sem ela, o celular recorta as laterais da imagem do computador." />
            {initial?.mobileImageUrl && <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" name="removeMobile" /> Remover a imagem de celular</label>}
          </div>
          <TextInput label="Link ao clicar" name="linkUrl" placeholder="/campeonatos/copa-lifaqui ou https://…" defaultValue={initial?.linkUrl ?? ""} />
          <TextInput label="Texto do botão (opcional)" name="ctaLabel" maxLength={30} placeholder="Ver tabela" defaultValue={initial?.ctaLabel ?? ""} />
          <TextInput label="Tempo na tela (s)" name="durationSeconds" type="number" min={3} max={30} defaultValue={initial?.durationSeconds ?? 6} />
          <span />
          <TextInput label="Exibir a partir de (dia e hora)" name="startsAt" type="datetime-local" hint="Vazio = já começa agora" defaultValue={initial?.startsAt} />
          <TextInput label="Exibir até (dia e hora)" name="endsAt" type="datetime-local" hint="Vazio = sem data para sair" defaultValue={initial?.endsAt} />
          <div className="sm:col-span-2"><SubmitButton pending={pending}>{initial ? "Salvar alterações" : "Publicar banner"}</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

export function HeroRowActions({ id, active }: { id: string; active: boolean }) {
  return (
    <div className="flex gap-1">
      {(["up", "down", "toggle"] as const).map((op) => (
        <ActionForm key={op} action={updateHeroSlide} compact>
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

/** Editar (inline) e excluir com confirmação. */
export function HeroItemControls({ initial, sponsors }: { initial: HeroInitial; sponsors: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-md border px-2 py-1 text-[11px] font-semibold hover:bg-muted">{open ? "Fechar" : "Editar"}</button>
      {confirm ? (
        <ActionForm action={deleteHeroSlide} compact>
          {(pending) => (
            <span className="flex items-center gap-1">
              <input type="hidden" name="id" value={initial.id} />
              <button disabled={pending} className="rounded-md bg-destructive px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50">Confirmar exclusão</button>
              <button type="button" onClick={() => setConfirm(false)} className="rounded-md border px-2 py-1 text-[11px]">Não</button>
            </span>
          )}
        </ActionForm>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="rounded-md border border-destructive/50 px-2 py-1 text-[11px] font-semibold text-destructive">Excluir</button>
      )}
      {open && <div className="basis-full rounded-xl border bg-muted/30 p-4"><HeroSlideForm sponsors={sponsors} initial={initial} onDone={() => setOpen(false)} /></div>}
    </>
  );
}
