import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Panel } from "@/components/admin/fields";
import { CompetitionForm } from "@/components/admin/forms/competition-form";
import { EnrollForm, GroupForm, MatchForm, MatchStatusActions, PhaseForm } from "@/components/admin/forms/competition-forms";
import { PageHeader } from "@/components/admin/page-header";
import { getCompetitionBy, getCompetitionStructure, listCompetitionMatches, listTeams, listVenues } from "@/domain/competitions/queries";
import { MATCH_STATUS_LABEL, PHASE_TYPE_LABEL } from "@/domain/labels";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/datetime";

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePermission("competition.manage", `/admin/competicoes/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const comp = await getCompetitionBy({ id, organizationId: actor.organizationId });
  if (!comp) notFound();
  const [structure, allTeams, venues, games] = await Promise.all([
    getCompetitionStructure(comp.id),
    listTeams(actor.organizationId),
    listVenues(actor.organizationId),
    listCompetitionMatches(comp.id),
  ]);
  const enrolledIds = new Set(structure.enrolled.map((t) => t.teamId));
  const groupOpts = structure.groups.map((g) => ({
    value: g.id,
    label: `${g.name} (${structure.phases.find((p) => p.id === g.phaseId)?.name ?? ""})`,
  }));
  const phaseOpts = structure.phases.map((p) => ({ value: p.id, label: p.name }));
  const groupName = (gid: string | null) => structure.groups.find((g) => g.id === gid)?.name;

  return (
    <>
      <PageHeader title={`${comp.name} ${comp.season}`} description={comp.published ? "Publicada no site" : "Rascunho — invisível no site até ser publicada"} />
      <div className="grid gap-4">
        <Panel title="Dados e regras"><CompetitionForm key={comp.id} values={comp} /></Panel>

        <Panel title="Fases e grupos">
          <ul className="mb-4 space-y-2 text-sm">
            {structure.phases.map((p) => (
              <li key={p.id}>
                <span className="font-semibold">{p.name}</span>
                <span className="text-muted-foreground"> • {PHASE_TYPE_LABEL[p.type]}</span>
                {structure.groups.filter((g) => g.phaseId === p.id).length > 0 && (
                  <span className="text-muted-foreground"> • {structure.groups.filter((g) => g.phaseId === p.id).map((g) => g.name).join(", ")}</span>
                )}
              </li>
            ))}
          </ul>
          <div className="grid gap-3 lg:grid-cols-2">
            <PhaseForm competitionId={comp.id} />
            {phaseOpts.length > 0 && <GroupForm phases={phaseOpts} />}
          </div>
        </Panel>

        <Panel title={`Equipes inscritas (${structure.enrolled.length})`}>
          {structure.enrolled.length > 0 && (
            <ul className="mb-4 grid gap-1 text-sm sm:grid-cols-2">
              {structure.enrolled.map((t) => (
                <li key={t.teamId} className="flex justify-between rounded-lg bg-background px-3 py-2">
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{groupName(t.groupId) ?? "sem grupo"} • {t.athletes} atletas</span>
                </li>
              ))}
            </ul>
          )}
          <EnrollForm
            competitionId={comp.id}
            teams={allTeams.filter((t) => t.active && !enrolledIds.has(t.id)).map((t) => ({ value: t.id, label: t.name }))}
            groups={groupOpts}
          />
        </Panel>

        <Panel title="Agendar jogo">
          <MatchForm
            competitionId={comp.id}
            teams={structure.enrolled.map((t) => ({ value: t.teamId, label: t.name }))}
            venues={venues.map((v) => ({ value: v.id, label: v.name }))}
            phases={phaseOpts}
            groups={groupOpts}
          />
        </Panel>

        <Panel title={`Jogos (${games.length})`}>
          {games.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum jogo agendado.</p>
          ) : (
            <ul className="divide-y text-sm">
              {games.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="font-semibold">{g.homeName} x {g.awayName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(g.scheduledAt)}{g.venueName ? ` • ${g.venueName}` : ""}{g.groupName ? ` • ${g.groupName}` : ""}{g.round ? ` • ${g.round}ª rodada` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{MATCH_STATUS_LABEL[g.status]}</span>
                    <MatchStatusActions matchId={g.id} status={g.status} />
                    <Link href={`/admin/jogos/${g.id}`} className="rounded-md bg-brand-amber px-2 py-1 text-[11px] font-bold text-black">Abrir</Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

export default function Page(props: PageProps<"/admin/competicoes/[id]">) {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-xl bg-card" />}>
      <Detail params={props.params} />
    </Suspense>
  );
}
