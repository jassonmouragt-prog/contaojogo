"use client";

import { ActionForm } from "@/components/admin/action-form";
import { SelectInput, SubmitButton, TextInput } from "@/components/admin/fields";
import { createGroup, createMatch, createPhase, enrollTeam, setMatchScheduleStatus } from "@/domain/competitions/actions";
import { PHASE_TYPE_LABEL } from "@/domain/labels";

type Opt = { value: string; label: string };

export function PhaseForm({ competitionId }: { competitionId: string }) {
  return (
    <ActionForm action={createPhase} resetOnSuccess className="flex flex-wrap items-end gap-2">
      {(pending) => (
        <>
          <input type="hidden" name="competitionId" value={competitionId} />
          <TextInput label="Nova fase" name="name" required placeholder="Quartas de final" className="min-w-40 flex-1" />
          <SelectInput label="Tipo" name="type" options={Object.entries(PHASE_TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
          <SubmitButton pending={pending}>Adicionar</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function GroupForm({ phases }: { phases: Opt[] }) {
  return (
    <ActionForm action={createGroup} resetOnSuccess className="flex flex-wrap items-end gap-2">
      {(pending) => (
        <>
          <SelectInput label="Fase" name="phaseId" options={phases} required />
          <TextInput label="Novo grupo" name="name" required placeholder="Grupo A" className="min-w-32 flex-1" />
          <SubmitButton pending={pending}>Adicionar</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function EnrollForm({ competitionId, teams, groups }: { competitionId: string; teams: Opt[]; groups: Opt[] }) {
  if (teams.length === 0) return <p className="text-sm text-muted-foreground">Todas as equipes cadastradas já estão inscritas.</p>;
  return (
    <ActionForm action={enrollTeam} resetOnSuccess className="flex flex-wrap items-end gap-2">
      {(pending) => (
        <>
          <input type="hidden" name="competitionId" value={competitionId} />
          <SelectInput label="Equipe" name="teamId" options={teams} placeholder="Escolha…" required className="min-w-44 flex-1" />
          {groups.length > 0 && <SelectInput label="Grupo" name="groupId" options={groups} placeholder="Sem grupo" />}
          <SubmitButton pending={pending}>Inscrever com elenco</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/** Fases de mata-mata prontas; as que ainda não existem são criadas ao agendar. */
export const KNOCKOUT_PRESETS = ["Oitavas de final", "Quartas de final", "Semifinal", "Disputa de 3º lugar", "Final"];
function phaseChoices(phases: Opt[]): Opt[] {
  const names = new Set(phases.map((p) => p.label.toLowerCase()));
  return [...phases, ...KNOCKOUT_PRESETS.filter((n) => !names.has(n.toLowerCase())).map((n) => ({ value: `new:${n}`, label: n }))];
}

/** Mantém data/local preenchidos após agendar: facilita cadastrar a rodada inteira. */
export function MatchForm({ competitionId, teams, venues, phases, groups }: { competitionId: string; teams: Opt[]; venues: Opt[]; phases: Opt[]; groups: Opt[] }) {
  if (teams.length < 2) return <p className="text-sm text-muted-foreground">Inscreva pelo menos duas equipes para agendar jogos.</p>;
  return (
    <ActionForm action={createMatch} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {(pending) => (
        <>
          <input type="hidden" name="competitionId" value={competitionId} />
          <SelectInput label="Mandante" name="homeTeamId" options={teams} placeholder="Escolha…" required />
          <SelectInput label="Visitante" name="awayTeamId" options={teams} placeholder="Escolha…" required />
          <TextInput label="Data e hora (Brasília)" name="scheduledAt" type="datetime-local" required />
          <SelectInput label="Local" name="venueId" options={venues} placeholder="A definir" />
          <SelectInput label="Fase" name="phaseId" options={phaseChoices(phases)} placeholder="Fase normal / rodada" />
          {groups.length > 0 && <SelectInput label="Grupo (se for fase de grupos)" name="groupId" options={groups} placeholder="—" />}
          <TextInput label="Rodada (opcional)" name="round" type="number" min={1} max={99} />
          <TextInput label="Árbitro" name="referee" placeholder="Nome do árbitro" />
          <TextInput label="Auxiliar 1" name="assistant1" placeholder="Nome do 1º auxiliar" />
          <TextInput label="Auxiliar 2" name="assistant2" placeholder="Nome do 2º auxiliar" />
          <div className="flex items-end"><SubmitButton pending={pending}>Agendar jogo</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

export function MatchStatusActions({ matchId, status }: { matchId: string; status: string }) {
  const options =
    status === "SCHEDULED"
      ? [{ to: "POSTPONED", label: "Adiar" }, { to: "CANCELLED", label: "Cancelar" }]
      : status === "POSTPONED" || status === "CANCELLED"
        ? [{ to: "SCHEDULED", label: "Reativar" }]
        : [];
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <ActionForm key={o.to} action={setMatchScheduleStatus} compact>
          {(pending) => (
            <>
              <input type="hidden" name="matchId" value={matchId} />
              <input type="hidden" name="status" value={o.to} />
              <button disabled={pending} className="rounded-md border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">
                {o.label}
              </button>
            </>
          )}
        </ActionForm>
      ))}
    </div>
  );
}
