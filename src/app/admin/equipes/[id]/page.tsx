import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AthleteCard } from "@/components/admin/athlete-card";
import { Panel } from "@/components/admin/fields";
import { AddAthletes, TeamForm } from "@/components/admin/forms/team-forms";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { getTeamBy, listTeamAthletes } from "@/domain/competitions/queries";
import { getScorersBy } from "@/domain/standings/queries";
import { requirePermission } from "@/lib/auth/session";

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePermission("competition.manage", `/admin/equipes/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const team = await getTeamBy({ id, organizationId: actor.organizationId });
  if (!team) notFound();
  const [squad, scorers] = await Promise.all([listTeamAthletes(team.id), getScorersBy({ teamId: team.id, includeUnconfirmed: true })]);
  const stats = new Map(scorers.map((s) => [s.athleteId, s]));
  const active = squad.filter((a) => a.active);
  return (
    <>
      <PageHeader back={{ href: "/admin/equipes", label: "Equipes" }} title={team.name} description={`${active.length} atleta(s) ativo(s)${team.city ? ` • ${team.city}` : ""}`} />
      <div className="grid gap-4">
        <Panel title="Dados da equipe"><TeamForm key={team.updatedAt.toISOString()} values={team} /></Panel>
        <Panel title="Adicionar atletas"><AddAthletes teamId={team.id} /></Panel>
        <Panel title={`Elenco (${squad.length})`}>
          {squad.length === 0 ? <EmptyState title="Nenhum atleta ainda" text="Adicione um por vez com foto, ou cole a lista inteira acima." /> : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {squad.map((a) => <AthleteCard key={`${a.id}-${a.updatedAt.toISOString()}`} athlete={a} teamId={team.id} goals={stats.get(a.id)?.goals ?? 0} pending={stats.get(a.id)?.pending ?? 0} />)}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

export default function Page(props: PageProps<"/admin/equipes/[id]">) {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-2xl bg-card" />}>
      <Detail params={props.params} />
    </Suspense>
  );
}
