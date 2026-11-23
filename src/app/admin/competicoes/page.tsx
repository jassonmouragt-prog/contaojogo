import Link from "next/link";
import { Suspense } from "react";
import { CreatePanel } from "@/components/admin/create-panel";
import { CompetitionCreateForm } from "@/components/admin/forms/competition-form";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { TeamCrest } from "@/components/brand/team-crest";
import { listCompetitions } from "@/domain/competitions/queries";
import { COMPETITION_STATUS_LABEL, MODALITY_LABEL } from "@/domain/labels";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Competições" };

async function List() {
  const actor = await requirePermission("competition.manage", "/admin/competicoes");
  const rows = await listCompetitions({ organizationId: actor.organizationId });
  if (rows.length === 0) return <EmptyState title="Nenhuma competição ainda" text="Crie a primeira competição pelo botão acima. Depois você inscreve as equipes e agenda os jogos." />;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {rows.map((c) => (
        <li key={c.id}>
          <Link href={`/admin/competicoes/${c.id}`} className="flex items-center gap-4 rounded-2xl border bg-card p-4 transition-colors hover:border-brand-amber/50">
            <TeamCrest name={c.name} src={c.logoUrl} size={44} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-lg font-bold uppercase">{c.name} <span className="text-muted-foreground">{c.season}</span></span>
              <span className="block text-xs text-muted-foreground">{MODALITY_LABEL[c.modality]} • {c.teamCount} equipes{c.currentPhase ? ` • ${c.currentPhase}` : ""}</span>
            </span>
            <span className="flex flex-col items-end gap-1">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", c.published ? "bg-brand-green/15 text-brand-green" : "bg-muted text-muted-foreground")}>{c.published ? "No site" : "Rascunho"}</span>
              <span className="text-[11px] text-muted-foreground">{COMPETITION_STATUS_LABEL[c.status]}</span>
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
      <PageHeader title="Competições" description="Campeonatos, inscrições, grupos e tabela de jogos." />
      <div className="space-y-5">
        <CreatePanel label="Nova competição"><CompetitionCreateForm /></CreatePanel>
        <Suspense fallback={<div className="h-28 animate-pulse rounded-2xl bg-card" />}><List /></Suspense>
      </div>
    </>
  );
}
