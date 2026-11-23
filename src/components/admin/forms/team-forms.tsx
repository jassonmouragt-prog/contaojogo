"use client";

import { ActionForm } from "@/components/admin/action-form";
import { SelectInput, SubmitButton, TextInput } from "@/components/admin/fields";
import { createVenue, saveAthlete, saveTeam, setAthleteActive } from "@/domain/teams/actions";
import { POSITION_NAME } from "@/domain/labels";

export function TeamForm({ values }: { values?: { id: string; name: string; shortName: string | null; city: string | null } }) {
  return (
    <ActionForm action={saveTeam} resetOnSuccess={!values} redirectTo={values ? undefined : "/admin/equipes/:id"} className="flex flex-wrap items-end gap-2">
      {(pending) => (
        <>
          {values && <input type="hidden" name="id" value={values.id} />}
          <TextInput label="Nome da equipe" name="name" required defaultValue={values?.name} className="min-w-48 flex-1" />
          <TextInput label="Sigla" name="shortName" maxLength={20} defaultValue={values?.shortName ?? ""} className="w-28" />
          <TextInput label="Cidade" name="city" defaultValue={values?.city ?? ""} className="min-w-36" />
          <SubmitButton pending={pending}>{values ? "Salvar" : "Cadastrar"}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

const positions = Object.entries(POSITION_NAME).map(([value, label]) => ({ value, label }));

export function AthleteForm({ teamId }: { teamId: string }) {
  return (
    <ActionForm action={saveAthlete} resetOnSuccess className="grid gap-2 sm:grid-cols-[1fr_8rem_6rem_10rem_auto] sm:items-end">
      {(pending) => (
        <>
          <input type="hidden" name="teamId" value={teamId} />
          <TextInput label="Nome do atleta" name="name" required />
          <SelectInput label="Posição" name="position" options={positions} placeholder="—" />
          <TextInput label="Camisa" name="shirtNumber" type="number" min={0} max={99} />
          <TextInput label="Nascimento (privado)" name="birthDate" type="date" />
          <SubmitButton pending={pending}>Adicionar</SubmitButton>
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
