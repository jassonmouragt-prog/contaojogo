import Link from "next/link";
import { Suspense } from "react";
import { CreatePanel } from "@/components/admin/create-panel";
import { TeamForm } from "@/components/admin/forms/team-forms";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { TeamCrest } from "@/components/brand/team-crest";
import { listTeams } from "@/domain/competitions/queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata = { title: "Equipes" };

async function List() {
  const actor = await requirePermission("competition.manage", "/admin/equipes");
  const rows = await listTeams(actor.organizationId);
  if (rows.length === 0) return <EmptyState title="Nenhuma equipe cadastrada" text="Cadastre a equipe e, na página dela, adicione os atletas com número da camisa." />;
  return (
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((t) => (
        <li key={t.id}>
          <Link href={`/admin/equipes/${t.id}`} className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 transition-colors hover:border-brand-amber/50">
            <TeamCrest name={t.name} src={t.crestUrl} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{t.name}</span>
              <span className="block text-xs text-muted-foreground">{t.city ?? "—"} • {t.athletes} atletas ativos</span>
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
      <PageHeader title="Equipes e atletas" description="Clubes e elencos. Ao inscrever numa competição, o elenco ativo vai junto." />
      <div className="space-y-5">
        <CreatePanel label="Nova equipe"><TeamForm /></CreatePanel>
        <Suspense fallback={<div className="h-20 animate-pulse rounded-2xl bg-card" />}><List /></Suspense>
      </div>
    </>
  );
}
