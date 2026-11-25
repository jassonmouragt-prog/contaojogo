import { Suspense } from "react";
import { Panel } from "@/components/admin/fields";
import { CreatePanel } from "@/components/admin/create-panel";
import { PlanEdit, PlanForm } from "@/components/admin/forms/billing-forms";
import { PageHeader } from "@/components/admin/page-header";
import { INTERVAL_LABEL, formatPrice, requirePlatformOwner } from "@/domain/billing/platform";
import { listPlans } from "@/domain/billing/queries";

export const metadata = { title: "Planos" };

async function List() {
  await requirePlatformOwner("/admin/planos");
  const rows = await listPlans();
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nenhum plano ainda. Crie o primeiro acima — ele aparece em contaojogo.club/planos.</p>;
  return (
    <ul className="divide-y">
      {rows.map((p) => (
        <li key={p.id} className={`flex flex-wrap items-center gap-3 py-3 ${p.active ? "" : "opacity-60"}`}>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{p.name} <span className="ml-1 font-mono text-brand-green">{formatPrice(p.priceCents)}{INTERVAL_LABEL[p.interval]}</span>
              {p.highlighted && <span className="ml-2 rounded-full bg-brand-green/15 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-green">Destaque</span>}
              {!p.active && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">Fora de venda</span>}</p>
            <p className="text-xs text-muted-foreground">{p.benefits.join(" · ") || "Sem benefícios cadastrados"}{p.maxCompetitions ? ` · até ${p.maxCompetitions} competição(ões)` : ""}</p>
          </div>
          <PlanEdit plan={p} />
        </li>
      ))}
    </ul>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader title="Planos" description="Planos para clubes e ligas. Quem assina ganha um painel próprio para cadastrar os campeonatos." />
      <div className="grid gap-4">
        <CreatePanel label="Novo plano" title="Novo plano"><PlanForm /></CreatePanel>
        <Panel title="Planos cadastrados"><Suspense fallback={<div className="h-24 animate-pulse rounded-xl bg-muted" />}><List /></Suspense></Panel>
      </div>
    </>
  );
}
