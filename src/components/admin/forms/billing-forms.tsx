"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionForm } from "@/components/admin/action-form";
import { SelectInput, SubmitButton, TextInput } from "@/components/admin/fields";
import { savePlan, setSubscriptionStatus } from "@/domain/billing/actions";

export type PlanValues = { id: string; name: string; description: string | null; priceCents: number; interval: "MONTH" | "YEAR"; benefits: string[]; maxCompetitions: number | null; highlighted: boolean; active: boolean };

export function PlanForm({ plan, onDone }: { plan?: PlanValues; onDone?: () => void }) {
  return (
    <ActionForm action={savePlan} resetOnSuccess={!plan} onSuccess={onDone} className="grid gap-3 sm:grid-cols-2">
      {(pending) => (
        <>
          {plan && <input type="hidden" name="id" value={plan.id} />}
          <TextInput label="Nome do plano" name="name" required placeholder="Liga Pro" defaultValue={plan?.name} />
          <div className="grid grid-cols-[1fr_8rem] gap-2">
            <TextInput label="Preço (R$)" name="price" required inputMode="decimal" placeholder="49,90" defaultValue={plan ? (plan.priceCents / 100).toFixed(2).replace(".", ",") : ""} />
            <SelectInput label="Cobrança" name="interval" options={[{ value: "MONTH", label: "Mensal" }, { value: "YEAR", label: "Anual" }]} defaultValue={plan?.interval ?? "MONTH"} />
          </div>
          <TextInput label="Descrição curta" name="description" className="sm:col-span-2" placeholder="Para ligas com vários campeonatos por ano" defaultValue={plan?.description ?? ""} />
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor={`benefits-${plan?.id ?? "new"}`} className="text-xs font-semibold text-muted-foreground">Benefícios (um por linha)</label>
            <textarea id={`benefits-${plan?.id ?? "new"}`} name="benefits" rows={5} defaultValue={plan?.benefits.join("\n") ?? ""}
              placeholder={"Campeonatos ilimitados\nOperação ao vivo pelo celular\nCampinho virtual\nEscudos e fotos dos atletas"}
              className="w-full rounded-xl border border-input bg-background p-3.5 text-sm focus-visible:border-brand-amber focus-visible:outline-none" />
          </div>
          <TextInput label="Limite de competições ativas" name="maxCompetitions" type="number" min={1} max={999} placeholder="Vazio = ilimitado" defaultValue={plan?.maxCompetitions ?? ""} />
          <div className="flex flex-wrap items-end gap-4 pb-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="highlighted" defaultChecked={plan?.highlighted} /> Destacar (“mais escolhido”)</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={plan ? plan.active : true} /> À venda</label>
          </div>
          <div className="sm:col-span-2"><SubmitButton pending={pending}>{plan ? "Salvar plano" : "Criar plano"}</SubmitButton></div>
        </>
      )}
    </ActionForm>
  );
}

export function PlanEdit({ plan }: { plan: PlanValues }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-md border px-3 py-1 text-xs font-semibold hover:bg-muted">{open ? "Fechar" : "Editar"}</button>
      {open && <div className="mt-3 w-full rounded-xl border bg-muted/30 p-4"><PlanForm plan={plan} onDone={() => setOpen(false)} /></div>}
    </>
  );
}

export function SubscriptionActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const [months, setMonths] = useState(1);
  const run = (s: "ACTIVE" | "SUSPENDED" | "CANCELLED") => start(async () => {
    const r = await setSubscriptionStatus({ id, status: s, months });
    if (r?.ok) toast.success(r.message); else toast.error(r?.message ?? "Erro.");
  });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="h-9 rounded-md border bg-background px-2 text-xs" aria-label="Período liberado">
          {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} {m === 1 ? "mês" : "meses"}</option>)}
        </select>
      </label>
      <button disabled={pending} onClick={() => run("ACTIVE")} className="h-9 rounded-md bg-brand-green px-3 text-xs font-bold text-primary-foreground disabled:opacity-50">{status === "ACTIVE" ? "Renovar" : "Ativar"}</button>
      {status === "ACTIVE" && <button disabled={pending} onClick={() => run("SUSPENDED")} className="h-9 rounded-md border px-3 text-xs font-semibold disabled:opacity-50">Suspender</button>}
      {status !== "CANCELLED" && <button disabled={pending} onClick={() => run("CANCELLED")} className="h-9 rounded-md border border-destructive/50 px-3 text-xs font-semibold text-destructive disabled:opacity-50">Cancelar</button>}
    </div>
  );
}
