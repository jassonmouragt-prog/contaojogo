import Link from "next/link";
import { Suspense } from "react";
import { Panel } from "@/components/admin/fields";
import { CompetitionForm } from "@/components/admin/forms/competition-form";
import { PageHeader } from "@/components/admin/page-header";
import { listCompetitions } from "@/domain/competitions/queries";
import { COMPETITION_STATUS_LABEL, MODALITY_LABEL } from "@/domain/labels";
import { requirePermission } from "@/lib/auth/session";

export const metadata = { title: "Competições" };

async function List() {
  const actor = await requirePermission("competition.manage", "/admin/competicoes");
  const rows = await listCompetitions({ organizationId: actor.organizationId });
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma competição cadastrada.</p>;
  return (
    <ul className="divide-y">
      {rows.map((c) => (
        <li key={c.id}>
          <Link href={`/admin/competicoes/${c.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-brand-amber">
            <span className="min-w-0">
              <span className="block truncate font-semibold">{c.name} <span className="text-muted-foreground">{c.season}</span></span>
              <span className="block text-xs text-muted-foreground">
                {MODALITY_LABEL[c.modality]} • {c.teamCount} equipes{c.currentPhase ? ` • ${c.currentPhase}` : ""}
              </span>
            </span>
            <span className="shrink-0 text-right text-xs">
              <span className="block font-semibold">{COMPETITION_STATUS_LABEL[c.status]}</span>
              <span className={c.published ? "text-brand-green" : "text-muted-foreground"}>{c.published ? "Publicada" : "Não publicada"}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader title="Competições" description="Campeonatos, regras, fases, inscrições e agenda." />
      <div className="grid gap-4">
        <Panel title="Nova competição"><CompetitionForm /></Panel>
        <Panel title="Cadastradas">
          <Suspense fallback={<div className="h-20 animate-pulse rounded bg-muted" />}><List /></Suspense>
        </Panel>
      </div>
    </>
  );
}
