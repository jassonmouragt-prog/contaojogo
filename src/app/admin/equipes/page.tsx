import Link from "next/link";
import { Suspense } from "react";
import { Panel } from "@/components/admin/fields";
import { TeamForm } from "@/components/admin/forms/team-forms";
import { PageHeader } from "@/components/admin/page-header";
import { TeamCrest } from "@/components/brand/team-crest";
import { listTeams } from "@/domain/competitions/queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata = { title: "Equipes" };

async function List() {
  const actor = await requirePermission("competition.manage", "/admin/equipes");
  const rows = await listTeams(actor.organizationId);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma equipe cadastrada.</p>;
  return (
    <ul className="grid gap-1 sm:grid-cols-2">
      {rows.map((t) => (
        <li key={t.id}>
          <Link href={`/admin/equipes/${t.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-background">
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
      <PageHeader title="Equipes" description="Clubes e elencos. A inscrição em competições copia o elenco ativo." />
      <div className="grid gap-4">
        <Panel title="Nova equipe"><TeamForm /></Panel>
        <Panel title="Cadastradas"><Suspense fallback={<div className="h-20 animate-pulse rounded bg-muted" />}><List /></Suspense></Panel>
      </div>
    </>
  );
}
