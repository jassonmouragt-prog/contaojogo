"use client";

import { ActionForm } from "@/components/admin/action-form";
import { ImageUpload } from "@/components/admin/image-upload";
import { SelectInput, SubmitButton, TextInput } from "@/components/admin/fields";
import { createDocument, createNews, createPoll, createSponsor, hideNomination, replyTicket, setFinalists, toggleNews, updateSponsor, editSponsor } from "@/domain/engagement/actions";

type Opt = { value: string; label: string };
const small = "rounded-md border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50";

export type SponsorInitial = { id: string; name: string; logoUrl: string; linkUrl: string | null; durationSeconds: number; startsAt: string; endsAt: string; placements: string[] };

export function SponsorForm({ initial, onDone }: { initial?: SponsorInitial; onDone?: () => void } = {}) {
  return (
    <ActionForm action={initial ? editSponsor : createSponsor} resetOnSuccess={!initial} onSuccess={onDone} className="grid gap-3 sm:grid-cols-2">
      {(pending) => (
        <>
          {initial && <input type="hidden" name="id" value={initial.id} />}
          <TextInput label="Nome" name="name" required placeholder="Laticínios Richard" defaultValue={initial?.name} />
          <ImageUpload label="Logo do patrocinador" name="logoUrl" purpose="LOGO" aspect="aspect-[3/2]" required initialUrl={initial?.logoUrl} hint={initial ? "Envie outra imagem só se quiser trocar." : "PNG com fundo transparente fica melhor."} />
          <TextInput label="Link ao clicar (site, WhatsApp ou Instagram)" name="linkUrl" type="url" placeholder="https://wa.me/55…" defaultValue={initial?.linkUrl ?? ""} />
          <TextInput label="Tempo na tela (segundos)" name="durationSeconds" type="number" min={2} max={30} defaultValue={initial?.durationSeconds ?? 4} />
          <TextInput label="Exibir a partir de (dia e hora)" name="startsAt" type="datetime-local" hint="Vazio = já começa agora" defaultValue={initial?.startsAt} />
          <TextInput label="Exibir até (dia e hora)" name="endsAt" type="datetime-local" hint="Vazio = sem data para sair" defaultValue={initial?.endsAt} />
          <fieldset className="sm:col-span-2">
            <legend className="text-xs font-semibold text-muted-foreground">Posições</legend>
            <div className="mt-1 flex flex-wrap gap-4 text-sm">
              {[["HOME", "Início"], ["COMPETITION", "Competição"], ["MATCH", "Partida"]].map(([v, l]) => (
                <label key={v} className="flex items-center gap-2"><input type="checkbox" name="placements" value={v} defaultChecked={initial ? initial.placements.includes(v) : true} /> {l}</label>
              ))}
            </div>
          </fieldset>
          <div className="sm:col-span-2"><SubmitButton pending={pending}>{initial ? "Salvar alterações" : "Cadastrar patrocinador"}</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

export function SponsorRowActions({ id, active }: { id: string; active: boolean }) {
  return (
    <div className="flex gap-1">
      {(["up", "down", "toggle"] as const).map((op) => (
        <ActionForm key={op} action={updateSponsor} compact>
          {(pending) => (
            <>
              <input type="hidden" name="id" value={id} /><input type="hidden" name="op" value={op} />
              <button disabled={pending} className={small} aria-label={op === "up" ? "Subir" : op === "down" ? "Descer" : undefined}>
                {op === "up" ? "↑" : op === "down" ? "↓" : active ? "Pausar" : "Ativar"}
              </button>
            </>
          )}
        </ActionForm>
      ))}
    </div>
  );
}

export function NewsForm({ competitions }: { competitions: Opt[] }) {
  return (
    <ActionForm action={createNews} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
      {(pending) => (
        <>
          <TextInput label="Título" name="title" required className="sm:col-span-2" />
          <TextInput label="Resumo" name="summary" maxLength={280} className="sm:col-span-2" />
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="news-body" className="text-xs font-semibold text-muted-foreground">Texto</label>
            <textarea id="news-body" name="body" required minLength={10} rows={6} className="w-full rounded-lg border bg-background p-3 text-sm" />
          </div>
          <ImageUpload label="Imagem de capa" name="coverUrl" purpose="COVER" aspect="aspect-video" />
          <SelectInput label="Competição" name="competitionId" options={competitions} placeholder="Geral" />
          <TextInput label="Publicar em" name="publishAt" type="datetime-local" hint="Vazio = agora" />
          <TextInput label="Expira em" name="expiresAt" type="datetime-local" />
          <SelectInput label="Situação" name="published" options={[{ value: "true", label: "Publicar" }, { value: "false", label: "Rascunho" }]} defaultValue="true" />
          <div className="flex items-end"><SubmitButton pending={pending}>Salvar notícia</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

export function NewsToggle({ id, published }: { id: string; published: boolean }) {
  return (
    <ActionForm action={toggleNews} compact>
      {(pending) => (<><input type="hidden" name="id" value={id} /><button disabled={pending} className={small}>{published ? "Despublicar" : "Publicar"}</button></>)}
    </ActionForm>
  );
}

export function DocumentForm({ competitions }: { competitions: Opt[] }) {
  return (
    <ActionForm action={createDocument} resetOnSuccess className="flex flex-wrap items-end gap-2">
      {(pending) => (
        <>
          <TextInput label="Título" name="title" required placeholder="Regulamento" className="min-w-40 flex-1" />
          <TextInput label="Link do arquivo (https)" name="url" type="url" required className="min-w-56 flex-1" />
          <SelectInput label="Competição" name="competitionId" options={competitions} placeholder="Geral" />
          <SubmitButton pending={pending}>Publicar</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function PollForm({ competitions }: { competitions: Opt[] }) {
  return (
    <ActionForm action={createPoll} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
      {(pending) => (
        <>
          <TextInput label="Título" name="title" required placeholder="Craque da rodada" />
          <SelectInput label="Competição (restringe aos inscritos)" name="competitionId" options={competitions} placeholder="Todas" />
          <TextInput label="Descrição" name="description" className="sm:col-span-1" />
          <TextInput label="Indicações até" name="closesAt" type="datetime-local" />
          <div className="sm:col-span-2"><SubmitButton pending={pending}>Abrir indicações</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

export function FinalistsForm({ pollId, options, instagramUrl }: { pollId: string; options: Opt[]; instagramUrl: string | null }) {
  return (
    <ActionForm action={setFinalists} className="grid gap-2 sm:grid-cols-3">
      {(pending) => (
        <>
          <input type="hidden" name="pollId" value={pollId} />
          {[1, 2, 3].map((n) => <SelectInput key={n} label={`${n}º finalista`} name={`f${n}`} options={options} placeholder="Escolha…" defaultValue={options[n - 1]?.value ?? ""} required />)}
          <TextInput label="Link da votação no Instagram" name="instagramUrl" type="url" defaultValue={instagramUrl ?? ""} className="sm:col-span-2" />
          <div className="flex items-end"><SubmitButton pending={pending}>Publicar finalistas</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

export function HideNominationButton({ id }: { id: string }) {
  return (
    <ActionForm action={hideNomination} compact>
      {(pending) => (<><input type="hidden" name="id" value={id} /><button disabled={pending} className={small}>Remover</button></>)}
    </ActionForm>
  );
}

export function TicketReplyAdmin({ ticketId, status }: { ticketId: string; status: string }) {
  return (
    <ActionForm action={replyTicket} resetOnSuccess className="mt-2 flex flex-wrap items-end gap-2">
      {(pending) => (
        <>
          <input type="hidden" name="ticketId" value={ticketId} />
          <input name="body" placeholder="Resposta ao usuário (opcional)" aria-label="Resposta" className="h-10 min-w-48 flex-1 rounded-lg border bg-background px-3 text-sm" />
          <select name="status" defaultValue={status === "OPEN" ? "IN_PROGRESS" : status} aria-label="Situação" className="h-10 rounded-lg border bg-background px-2 text-sm">
            <option value="OPEN">Aberto</option><option value="IN_PROGRESS">Em atendimento</option><option value="RESOLVED">Resolvido</option>
          </select>
          <SubmitButton pending={pending}>Salvar</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
