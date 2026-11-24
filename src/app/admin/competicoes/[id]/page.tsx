import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Panel } from "@/components/admin/fields";
import { CompetitionRulesForm, PublishToggle } from "@/components/admin/forms/competition-form";
import { EnrollForm, GroupForm, MatchForm, MatchStatusActions, PhaseForm } from "@/components/admin/forms/competition-forms";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { TeamCrest } from "@/components/brand/team-crest";
import { getCompetitionBy, getCompetitionStructure, listCompetitionMatches, listTeams, listVenues } from "@/domain/competitions/queries";
import { MATCH_STATUS_LABEL, MODALITY_LABEL, PHASE_TYPE_LABEL } from "@/domain/labels";
import { requirePermission } from "@/lib/auth/session";
import { getScorersBy } from "@/domain/standings/queries";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "resumo", label: "Resumo" },
  { key: "equipes", label: "Equipes e grupos" },
  { key: "jogos", label: "Jogos" },
  { key: "artilharia", label: "Artilharia" },
  { key: "regulamento", label: "Regulamento" },
] as const;
type Tab = (typeof TABS)[number]["key"];

async function Detail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }> }) {
  const { id } = await params;
  const actor = await requirePermission("competition.manage", `/admin/competicoes/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const comp = await getCompetitionBy({ id, organizationId: actor.organizationId });
  if (!comp) notFound();
  const sp = await searchParams;
  const tab: Tab = (TABS.find((t) => t.key === sp.aba)?.key ?? "resumo") as Tab;
  const [structure, allTeams, venues, games] = await Promise.all([
    getCompetitionStructure(comp.id), listTeams(actor.organizationId), listVenues(actor.organizationId), listCompetitionMatches(comp.id),
  ]);
  const base = `/admin/competicoes/${comp.id}`;
  const enrolledIds = new Set(structure.enrolled.map((t) => t.teamId));
  const groupOpts = structure.groups.map((g) => ({ value: g.id, label: `${g.name} (${structure.phases.find((p) => p.id === g.phaseId)?.name ?? ""})` }));
  const phaseOpts = structure.phases.map((p) => ({ value: p.id, label: p.name }));
  const groupName = (gid: string | null) => structure.groups.find((g) => g.id === gid)?.name;

  const steps = [
    { done: structure.enrolled.length >= 2, label: "Inscrever as equipes", detail: `${structure.enrolled.length} inscrita(s)`, href: `${base}?aba=equipes` },
    { done: structure.groups.length > 0, label: "Montar grupos (opcional em pontos corridos)", detail: `${structure.groups.length} grupo(s)`, href: `${base}?aba=equipes` },
    { done: games.length > 0, label: "Agendar os jogos", detail: `${games.length} jogo(s)`, href: `${base}?aba=jogos` },
    { done: comp.published, label: "Publicar no site", detail: comp.published ? "visível para o público" : "ainda em rascunho", href: null },
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/admin/competicoes", label: "Competições" }}
        title={`${comp.name} ${comp.season}`}
        description={`${MODALITY_LABEL[comp.modality]} • ${comp.published ? "publicada no site" : "rascunho — invisível no site"}`}
        actions={<>
          {comp.published && <Link href={`/campeonatos/${comp.slug}`} target="_blank" className="inline-flex h-10 items-center rounded-xl border px-4 text-sm font-semibold hover:border-brand-green/50">Ver no site ↗</Link>}
          <PublishToggle id={comp.id} published={comp.published} />
        </>}
      />

      <nav aria-label="Seções da competição" className="mb-5 flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <Link key={t.key} href={`${base}?aba=${t.key}`} aria-current={t.key === tab ? "page" : undefined}
            className={cn("relative shrink-0 px-4 py-2.5 text-sm font-semibold", t.key === tab ? "text-brand-amber after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-brand-amber" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "resumo" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Panel title="Próximos passos">
            <ol className="space-y-2">
              {steps.map((s, i) => (
                <li key={s.label} className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3">
                  {s.done ? <CheckCircle2 className="size-5 text-brand-green" /> : <Circle className="size-5 text-muted-foreground" />}
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-semibold", s.done && "text-muted-foreground line-through")}>{i + 1}. {s.label}</span>
                    <span className="block text-xs text-muted-foreground">{s.detail}</span>
                  </span>
                  {s.href && !s.done && <Link href={s.href} className="rounded-lg bg-brand-amber px-3 py-1.5 text-xs font-bold text-black">Fazer</Link>}
                  {!s.href && !s.done && <PublishToggle id={comp.id} published={comp.published} />}
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="Números">
            <dl className="grid grid-cols-2 gap-3 text-center">
              {[["Equipes", structure.enrolled.length], ["Jogos", games.length], ["Encerrados", games.filter((g) => g.status === "CONFIRMED").length], ["A confirmar", games.filter((g) => g.status === "FINISHED").length]].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-background p-3"><dt className="text-[11px] uppercase text-muted-foreground">{l}</dt><dd className="font-mono text-2xl font-bold text-brand-amber">{v}</dd></div>
              ))}
            </dl>
          </Panel>
        </div>
      )}

      {tab === "equipes" && (
        <div className="grid gap-4">
          <Panel title="Inscrever equipe">
            {allTeams.length === 0 ? (
              <EmptyState title="Nenhuma equipe cadastrada" text="Cadastre as equipes e seus atletas primeiro."><Link href="/admin/equipes" className="rounded-xl bg-brand-amber px-4 py-2 text-sm font-bold text-black">Ir para Equipes</Link></EmptyState>
            ) : (
              <EnrollForm competitionId={comp.id} teams={allTeams.filter((t) => t.active && !enrolledIds.has(t.id)).map((t) => ({ value: t.id, label: t.name }))} groups={groupOpts} />
            )}
          </Panel>
          <Panel title={`Equipes inscritas (${structure.enrolled.length})`}>
            {structure.enrolled.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma equipe inscrita.</p> : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {structure.enrolled.map((t) => (
                  <li key={t.teamId} className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5">
                    <TeamCrest name={t.name} src={t.crestUrl} size={28} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{t.name}</span><span className="text-[11px] text-muted-foreground">{groupName(t.groupId) ?? "Sem grupo"} • {t.athletes} atletas</span></span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Fases e grupos">
            <ul className="mb-4 space-y-1.5 text-sm">
              {structure.phases.map((p) => {
                const gs = structure.groups.filter((g) => g.phaseId === p.id);
                return <li key={p.id}><span className="font-semibold">{p.name}</span> <span className="text-muted-foreground">• {PHASE_TYPE_LABEL[p.type]}{gs.length ? ` • ${gs.map((g) => g.name).join(", ")}` : ""}</span></li>;
              })}
            </ul>
            <div className="grid gap-4 lg:grid-cols-2">
              {phaseOpts.length > 0 && <GroupForm phases={phaseOpts} />}
              <PhaseForm competitionId={comp.id} />
            </div>
          </Panel>
        </div>
      )}

      {tab === "jogos" && (
        <div className="grid gap-4">
          <Panel title="Agendar jogo">
            <MatchForm competitionId={comp.id} teams={structure.enrolled.map((t) => ({ value: t.teamId, label: t.name }))} venues={venues.map((v) => ({ value: v.id, label: v.name }))} phases={phaseOpts} groups={groupOpts} />
          </Panel>
          <Panel title={`Tabela de jogos (${games.length})`}>
            {games.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum jogo agendado.</p> : (
              <ul className="divide-y text-sm">
                {games.map((g) => (
                  <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span className="min-w-0">
                      <span className="font-semibold">{g.homeName} {g.status === "SCHEDULED" ? "x" : `${g.homeScore} x ${g.awayScore}`} {g.awayName}</span>
                      <span className="block text-xs text-muted-foreground">{formatDateTime(g.scheduledAt)}{g.venueName ? ` • ${g.venueName}` : ""}{g.phaseName ? ` • ${g.phaseName}` : ""}{g.groupName ? ` • ${g.groupName}` : ""}{g.round ? ` • ${g.round}ª rodada` : ""}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{MATCH_STATUS_LABEL[g.status]}</span>
                      <MatchStatusActions matchId={g.id} status={g.status} />
                      <Link href={`/admin/jogos/${g.id}`} className="rounded-lg bg-brand-amber px-3 py-1.5 text-xs font-bold text-black">{g.status === "SCHEDULED" || g.status === "LIVE" ? "Operar" : "Súmula"}</Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {tab === "artilharia" && <ScorersAdmin competitionId={comp.id} />}

      {tab === "regulamento" && <Panel title="Regulamento e configurações"><CompetitionRulesForm key={comp.updatedAt.toISOString()} values={comp} /></Panel>}
    </>
  );
}

export default function Page(props: PageProps<"/admin/competicoes/[id]">) {
  return (
    <Suspense fallback={<div className="h-60 animate-pulse rounded-2xl bg-card" />}>
      <Detail params={props.params} searchParams={props.searchParams as Promise<{ aba?: string }>} />
    </Suspense>
  );
}

async function ScorersAdmin({ competitionId }: { competitionId: string }) {
  const rows = await getScorersBy({ competitionId, includeUnconfirmed: true });
  if (rows.length === 0) return <EmptyState title="Nenhum gol registrado" text="Os gols lançados na operação das partidas aparecem aqui automaticamente." />;
  const pending = rows.some((r) => r.pending > 0);
  return (
    <Panel title="Artilharia da competição">
      {pending && <p className="mb-3 rounded-xl bg-brand-amber/10 px-3 py-2 text-xs text-brand-amber">Gols “a confirmar” são de jogos ainda não confirmados. Eles entram no ranking oficial do site quando você confirmar o resultado.</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-[11px] uppercase text-muted-foreground">
            <tr className="border-b"><th className="w-10 py-2 text-left">#</th><th className="py-2 text-left">Atleta</th><th className="py-2 text-left">Equipe</th><th className="py-2 text-center">Gols</th><th className="py-2 text-center">A confirmar</th><th className="py-2 text-center">Assist.</th></tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r, i) => (
              <tr key={r.athleteId}>
                <td className="py-2 font-mono text-muted-foreground">{i + 1}</td>
                <td className="py-2 font-semibold">{r.shirtNumber != null && <span className="mr-1.5 font-mono text-xs text-brand-amber">{r.shirtNumber}</span>}{r.name}</td>
                <td className="py-2 text-muted-foreground">{r.teamName}</td>
                <td className="py-2 text-center font-mono text-lg font-bold text-brand-amber">{r.goals}</td>
                <td className="py-2 text-center font-mono text-muted-foreground">{r.pending || "–"}</td>
                <td className="py-2 text-center font-mono">{r.assists || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
