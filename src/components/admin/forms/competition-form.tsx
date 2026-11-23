"use client";

import { ActionForm } from "@/components/admin/action-form";
import { SelectInput, SubmitButton, TextInput } from "@/components/admin/fields";
import { saveCompetition } from "@/domain/competitions/actions";
import { COMPETITION_STATUS_LABEL, MODALITY_LABEL } from "@/domain/labels";

type Values = {
  id: string;
  name: string;
  season: string;
  modality: "FIELD" | "FUTSAL";
  status: keyof typeof COMPETITION_STATUS_LABEL;
  city: string | null;
  description: string | null;
  periodMinutes: number;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  published: boolean;
};

const opts = <T extends Record<string, string>>(o: T) => Object.entries(o).map(([value, label]) => ({ value, label }));

export function CompetitionForm({ values }: { values?: Values }) {
  return (
    <ActionForm action={saveCompetition} redirectTo={values ? undefined : "/admin/competicoes/:id"} className="grid gap-3 sm:grid-cols-2">
      {(pending) => (
        <>
          {values && <input type="hidden" name="id" value={values.id} />}
          <TextInput label="Nome" name="name" required defaultValue={values?.name} placeholder="Copa LIFAQUI" />
          <TextInput label="Temporada" name="season" required defaultValue={values?.season ?? String(new Date().getFullYear())} />
          <SelectInput label="Modalidade" name="modality" options={opts(MODALITY_LABEL)} defaultValue={values?.modality ?? "FIELD"} />
          <TextInput label="Cidade" name="city" defaultValue={values?.city ?? ""} />
          <TextInput label="Minutos por tempo" name="periodMinutes" type="number" min={5} max={60} defaultValue={values?.periodMinutes ?? 45} hint="Campo: 45 • Futsal: 20" />
          <div className="grid grid-cols-3 gap-2">
            <TextInput label="Vitória" name="pointsWin" type="number" min={0} max={10} defaultValue={values?.pointsWin ?? 3} />
            <TextInput label="Empate" name="pointsDraw" type="number" min={0} max={10} defaultValue={values?.pointsDraw ?? 1} />
            <TextInput label="Derrota" name="pointsLoss" type="number" min={0} max={10} defaultValue={values?.pointsLoss ?? 0} />
          </div>
          {values && (
            <>
              <SelectInput label="Situação" name="status" options={opts(COMPETITION_STATUS_LABEL)} defaultValue={values.status} />
              <SelectInput label="Visível no site" name="published" options={[{ value: "false", label: "Não (rascunho)" }, { value: "true", label: "Sim, publicada" }]} defaultValue={String(values.published)} />
            </>
          )}
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="description" className="text-xs font-semibold text-muted-foreground">Descrição / regulamento resumido</label>
            <textarea id="description" name="description" rows={3} defaultValue={values?.description ?? ""} className="w-full rounded-lg border bg-background p-3 text-sm" />
          </div>
          <div className="sm:col-span-2"><SubmitButton pending={pending}>{values ? "Salvar alterações" : "Criar competição"}</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}
