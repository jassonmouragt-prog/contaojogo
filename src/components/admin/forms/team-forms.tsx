"use client";

import { useState } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { SelectInput, SubmitButton, TextInput } from "@/components/admin/fields";
import { ImageUpload } from "@/components/admin/image-upload";
import { bulkAddAthletes, createVenue, saveAthlete, saveTeam, setAthleteActive } from "@/domain/teams/actions";
import { POSITION_NAME, POSITION_ORDER } from "@/domain/labels";
import { cn } from "@/lib/utils";

type TeamValues = { id: string; name: string; shortName: string | null; city: string | null; crestUrl: string | null };

/** Equipe: escudo + nome + cidade. Na criação leva para a página da equipe (atletas). */
export function TeamForm({ values }: { values?: TeamValues }) {
  return (
    <ActionForm action={saveTeam} resetOnSuccess={!values} redirectTo={values ? undefined : "/admin/equipes/:id"}
      className="flex flex-col gap-4 sm:flex-row sm:items-start">
      {(pending) => (
        <>
          {values && <><input type="hidden" name="id" value={values.id} /><input type="hidden" name="keepCrest" value="1" /></>}
          <ImageUpload label="Escudo" name="crestUrl" purpose="CREST" compact initialUrl={values?.crestUrl} />
          <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_8rem_12rem]">
            <TextInput label="Nome da equipe" name="name" required defaultValue={values?.name} placeholder="Mulungu" autoFocus={!values} />
            <TextInput label="Sigla" name="shortName" maxLength={20} defaultValue={values?.shortName ?? ""} placeholder="MUL" />
            <TextInput label="Cidade" name="city" defaultValue={values?.city ?? ""} placeholder="Gaspar" />
            <div className="sm:col-span-2"><SubmitButton pending={pending}>{values ? "Salvar equipe" : "Criar equipe e adicionar atletas"}</SubmitButton></div>
          </div>
        </>
      )}
    </ActionForm>
  );
}

const positions = POSITION_ORDER.map((value) => ({ value, label: POSITION_NAME[value] }));

/** Adicionar atletas: um por vez (com foto) ou colando a lista inteira. */
export function AddAthletes({ teamId }: { teamId: string }) {
  const [mode, setMode] = useState<"one" | "list">("one");
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl border bg-background p-1 text-sm font-semibold">
        {([["one", "Um atleta"], ["list", "Colar lista"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setMode(k)} className={cn("rounded-lg px-4 py-1.5", mode === k ? "bg-brand-amber text-black" : "text-muted-foreground")}>{l}</button>
        ))}
      </div>
      {mode === "one" ? (
        <ActionForm action={saveAthlete} resetOnSuccess className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {(pending) => (
            <>
              <input type="hidden" name="teamId" value={teamId} />
              <ImageUpload label="Foto" name="photoUrl" purpose="PHOTO" compact round />
              <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_13rem]">
                <TextInput label="Nome do atleta" name="name" required placeholder="Pedro Lima" />
                <SelectInput label="Posição" name="position" options={positions} placeholder="—" />
                <div className="sm:col-span-2"><SubmitButton pending={pending}>Adicionar atleta</SubmitButton></div>
              </div>
            </>
          )}
        </ActionForm>
      ) : (
        <ActionForm action={bulkAddAthletes} resetOnSuccess className="space-y-3">
          {(pending) => (
            <>
              <input type="hidden" name="teamId" value={teamId} />
              <label htmlFor="bulk-lines" className="text-xs font-semibold text-muted-foreground">Um atleta por linha (só o nome)</label>
              <textarea id="bulk-lines" name="lines" rows={8} required placeholder={"Rafael\nDavi Santos\nPedro Lima\nJoão Vitor"}
                className="w-full rounded-xl border border-input bg-background p-3.5 font-mono text-sm focus-visible:border-brand-amber focus-visible:outline-none" />
              <p className="text-[11px] text-muted-foreground">Fotos e posições podem ser adicionadas depois, tocando em “Editar” no atleta.</p>
              <SubmitButton pending={pending}>Adicionar todos</SubmitButton>
            </>
          )}
        </ActionForm>
      )}
    </div>
  );
}

type Athlete = { id: string; name: string; nickname: string | null; shirtNumber: number | null; position: keyof typeof POSITION_NAME | null; photoUrl: string | null; active: boolean; birthDate: string | null };

/** Edição rápida do atleta (foto, nome, posição). */
export function AthleteEditForm({ athlete, teamId, onDone }: { athlete: Athlete; teamId: string; onDone: () => void }) {
  return (
    <ActionForm action={saveAthlete} onSuccess={onDone} className="flex flex-col gap-4 sm:flex-row sm:items-start">
      {(pending) => (
        <>
          <input type="hidden" name="id" value={athlete.id} />
          <input type="hidden" name="teamId" value={teamId} />
          <input type="hidden" name="keepPhoto" value="1" />
          <ImageUpload label="Foto" name="photoUrl" purpose="PHOTO" compact round initialUrl={athlete.photoUrl} />
          <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_13rem]">
            <TextInput label="Nome" name="name" required defaultValue={athlete.name} />
            <SelectInput label="Posição" name="position" options={positions} placeholder="—" defaultValue={athlete.position ?? ""} />
            <div className="flex gap-2 sm:col-span-2">
              <SubmitButton pending={pending}>Salvar</SubmitButton>
              <button type="button" onClick={onDone} className="h-11 rounded-xl border px-4 text-sm font-semibold text-muted-foreground">Cancelar</button>
            </div>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function AthleteActiveToggle({ athlete }: { athlete: { id: string; active: boolean } }) {
  return (
    <ActionForm action={setAthleteActive} compact>
      {(pending) => (
        <>
          <input type="hidden" name="id" value={athlete.id} />
          <input type="hidden" name="active" value={athlete.active ? "false" : "true"} />
          <button disabled={pending} className="rounded-md border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">
            {athlete.active ? "Desativar" : "Reativar"}
          </button>
        </>
      )}
    </ActionForm>
  );
}

export function VenueForm() {
  return (
    <ActionForm action={createVenue} resetOnSuccess className="flex flex-wrap items-end gap-2">
      {(pending) => (
        <>
          <TextInput label="Nome do local" name="name" required placeholder="Arena Souzão" className="min-w-48 flex-1" />
          <TextInput label="Cidade" name="city" className="min-w-36" />
          <SubmitButton pending={pending}>Cadastrar</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
