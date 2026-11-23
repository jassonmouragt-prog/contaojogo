"use client";

import { ActionForm } from "@/components/admin/action-form";
import { SelectInput, SubmitButton, TextInput } from "@/components/admin/fields";
import { saveCompetition, togglePublished } from "@/domain/competitions/actions";
import { COMPETITION_STATUS_LABEL, MODALITY_LABEL } from "@/domain/labels";

const opts = <T extends Record<string, string>>(o: T) => Object.entries(o).map(([value, label]) => ({ value, label }));

/** Cadastro: só o essencial. Pontuação e tempo de jogo têm padrão e ficam no Regulamento. */
export function CompetitionCreateForm() {
  return (
    <ActionForm action={saveCompetition} resetOnSuccess redirectTo="/admin/competicoes/:id" className="grid gap-4 sm:grid-cols-2">
      {(pending) => (
        <>
          <TextInput label="Nome da competição" name="name" required placeholder="Copa LIFAQUI" autoFocus />
          <TextInput label="Temporada" name="season" required defaultValue={String(new Date().getFullYear())} />
          <SelectInput label="Modalidade" name="modality" options={opts(MODALITY_LABEL)} defaultValue="FIELD" />
          <TextInput label="Cidade (opcional)" name="city" placeholder="Gaspar" />
          <p className="text-xs text-muted-foreground sm:col-span-2">Depois de criar, você inscreve as equipes, monta os grupos e agenda os jogos. A pontuação padrão (3 por vitória, 1 por empate) pode ser ajustada em Regulamento.</p>
          <div className="sm:col-span-2"><SubmitButton pending={pending}>Criar competição</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

type Values = {
  id: string; name: string; season: string; modality: "FIELD" | "FUTSAL"; status: keyof typeof COMPETITION_STATUS_LABEL;
  city: string | null; description: string | null; periodMinutes: number; pointsWin: number; pointsDraw: number; pointsLoss: number; published: boolean;
};

/** Aba Regulamento: dados, situação, tempo de jogo e pontuação da tabela. */
export function CompetitionRulesForm({ values }: { values: Values }) {
  return (
    <ActionForm action={saveCompetition} className="space-y-6">
      {(pending) => (
        <>
          <input type="hidden" name="id" value={values.id} />
          <input type="hidden" name="published" value={String(values.published)} />
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Dados</legend>
            <TextInput label="Nome" name="name" required defaultValue={values.name} />
            <TextInput label="Temporada" name="season" required defaultValue={values.season} />
            <SelectInput label="Modalidade" name="modality" options={opts(MODALITY_LABEL)} defaultValue={values.modality} />
            <TextInput label="Cidade" name="city" defaultValue={values.city ?? ""} />
            <SelectInput label="Situação" name="status" options={opts(COMPETITION_STATUS_LABEL)} defaultValue={values.status} />
          </fieldset>
          <fieldset className="grid gap-4 sm:grid-cols-4">
            <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Regras da tabela</legend>
            <TextInput label="Minutos por tempo" name="periodMinutes" type="number" min={5} max={60} defaultValue={values.periodMinutes} hint="Campo 45 • Futsal 20" />
            <TextInput label="Pontos por vitória" name="pointsWin" type="number" min={0} max={10} defaultValue={values.pointsWin} />
            <TextInput label="Pontos por empate" name="pointsDraw" type="number" min={0} max={10} defaultValue={values.pointsDraw} />
            <TextInput label="Pontos por derrota" name="pointsLoss" type="number" min={0} max={10} defaultValue={values.pointsLoss} />
            <p className="text-xs text-muted-foreground sm:col-span-4">Desempate: pontos → saldo de gols → gols marcados → confronto direto. Só resultados confirmados entram na classificação.</p>
          </fieldset>
          <div className="space-y-1">
            <label htmlFor="description" className="text-xs font-semibold text-muted-foreground">Regulamento resumido (aparece no site)</label>
            <textarea id="description" name="description" rows={4} defaultValue={values.description ?? ""} className="w-full rounded-xl border border-input bg-background p-3.5 text-sm focus-visible:border-brand-amber focus-visible:outline-none" />
          </div>
          <SubmitButton pending={pending}>Salvar alterações</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function PublishToggle({ id, published }: { id: string; published: boolean }) {
  return (
    <ActionForm action={togglePublished} compact className="contents">
      {(pending) => (
        <>
          <input type="hidden" name="id" value={id} />
          <button disabled={pending}
            className={published
              ? "h-10 rounded-xl border px-4 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
              : "h-10 rounded-xl bg-brand-green px-4 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50"}>
            {published ? "Retirar do site" : "Publicar no site"}
          </button>
        </>
      )}
    </ActionForm>
  );
}
