import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Panel } from "@/components/admin/fields";
import { AthleteActiveToggle, AthleteForm, TeamForm } from "@/components/admin/forms/team-forms";
import { PageHeader } from "@/components/admin/page-header";
import { getTeamBy, listTeamAthletes } from "@/domain/competitions/queries";
import { POSITION_LABEL } from "@/domain/labels";
import { requirePermission } from "@/lib/auth/session";

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePermission("competition.manage", `/admin/equipes/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const team = await getTeamBy({ id, organizationId: actor.organizationId });
  if (!team) notFound();
  const squad = await listTeamAthletes(team.id);
  return (
    <>
      <PageHeader title={team.name} description={team.city ?? undefined} />
      <div className="grid gap-4">
        <Panel title="Dados da equipe"><TeamForm values={team} /></Panel>
        <Panel title={`Elenco (${squad.filter((a) => a.active).length} ativos)`}>
          <AthleteForm teamId={team.id} />
          {squad.length > 0 && (
            <ul className="mt-4 divide-y text-sm">
              {squad.map((a) => (
                <li key={a.id} className={`flex items-center gap-3 py-2 ${a.active ? "" : "opacity-50"}`}>
                  <span className="tabular w-8 text-center font-mono font-bold text-brand-amber">{a.shirtNumber ?? "–"}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{a.name}</span>
                  <span className="w-10 text-xs text-muted-foreground">{a.position ? POSITION_LABEL[a.position] : ""}</span>
                  <AthleteActiveToggle athlete={a} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

export default function Page(props: PageProps<"/admin/equipes/[id]">) {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-xl bg-card" />}>
      <Detail params={props.params} />
    </Suspense>
  );
}
