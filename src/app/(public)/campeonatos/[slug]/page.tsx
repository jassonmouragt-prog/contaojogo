import Link from "next/link";
import { notFound } from "next/navigation";
import { requestNow } from "@/lib/clock-now";
import { Suspense } from "react";
import { CompetitionGroup } from "@/components/brand/competition-group";
import { MatchRow } from "@/components/brand/match-row";
import { TeamCrest } from "@/components/brand/team-crest";
import { getCompetitionBy, getCompetitionStructure, getCompetitionSummary, listCompetitionMatches } from "@/domain/competitions/queries";
import { COMPETITION_STATUS_LABEL, MODALITY_LABEL, toMatchRow } from "@/domain/labels";
import { toLocalDay } from "@/lib/format";
import { DisciplineTables, ScorersTable, StandingsTables } from "@/components/public/standings/tables";
import { getDiscipline, getScorersBy, getStandings } from "@/domain/standings/queries";
import { cn } from "@/lib/utils";
import { SponsorSlot } from "@/components/engagement/sponsor-slot";
import { listDocuments } from "@/domain/engagement/queries";

const TABS = [
  { key: "jogos", label: "Jogos" },
  { key: "classificacao", label: "Classificação" },
  { key: "artilharia", label: "Artilharia" },
  { key: "disciplina", label: "Disciplina" },
  { key: "equipes", label: "Equipes" },
  { key: "documentos", label: "Documentos" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="tabular font-mono text-2xl font-bold text-brand-green">{value}</p>
    </div>
  );
}

async function Central({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ aba?: string }> }) {
  const { slug } = await params;
  const aba = ((await searchParams).aba ?? "jogos") as TabKey;
  const tab: TabKey = TABS.some((t) => t.key === aba) ? aba : "jogos";
  const now = await requestNow();
  const comp = await getCompetitionBy({ slug, publicOnly: true });
  if (!comp) notFound();
  const [summary, structure, games] = await Promise.all([
    getCompetitionSummary(comp.id),
    getCompetitionStructure(comp.id),
    listCompetitionMatches(comp.id),
  ]);
    const byDay = new Map<string, typeof games>();
  for (const g of games.filter((g) => g.status !== "CANCELLED")) {
    const d = toLocalDay(g.scheduledAt);
    byDay.set(d, [...(byDay.get(d) ?? []), g]);
  }
  const dayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" });
  const avg = summary.confirmed ? (summary.goals / summary.confirmed).toFixed(1).replace(".", ",") : "–";
  const currentPhase = structure.phases.at(-1)?.name;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-3 py-6 sm:px-4">
      <header className="bg-pitch-grid overflow-hidden rounded-2xl border bg-card p-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-green">{COMPETITION_STATUS_LABEL[comp.status]}</p>
        <h1 className="mt-1 text-4xl font-extrabold uppercase leading-none sm:text-5xl">{comp.name} <span className="text-brand-green">{comp.season}</span></h1>
        <p className="mt-2 text-sm text-muted-foreground">{MODALITY_LABEL[comp.modality]}{currentPhase ? ` • fase: ${currentPhase}` : ""}{comp.city ? ` • ${comp.city}` : ""}</p>
        {comp.description && <p className="mt-3 max-w-2xl whitespace-pre-line text-sm text-foreground/80">{comp.description}</p>}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Equipes" value={structure.enrolled.length} />
        <Tile label="Jogos" value={summary.matches} />
        <Tile label="Gols" value={summary.goals} />
        <Tile label="Média" value={avg} />
      </div>

      <SponsorSlot placement="COMPETITION" />

      <nav aria-label="Seções da competição" className="flex gap-1.5 overflow-x-auto border-b pb-3">
        {TABS.map((t) => (
          <Link key={t.key} href={`/campeonatos/${comp.slug}?aba=${t.key}`} aria-current={t.key === tab ? "page" : undefined}
            className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide", t.key === tab ? "border-brand-green bg-brand-green text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "classificacao" && <StandingsTables groups={await getStandings(comp)} />}
      {tab === "artilharia" && <ScorersTable rows={await getScorersBy({ competitionId: comp.id })} />}
      {tab === "disciplina" && <DisciplineTables data={await getDiscipline(comp.id)} />}
      {tab === "documentos" && <DocumentList competitionId={comp.id} />}

      {tab === "jogos" && <section className="space-y-3">
        {byDay.size === 0 ? (
          <p className="rounded-xl border border-dashed bg-card/60 p-6 text-center text-sm text-muted-foreground">Tabela ainda não divulgada.</p>
        ) : (
          [...byDay.entries()].map(([day, list]) => (
            <CompetitionGroup key={day} name={dayLabel.format(new Date(`${day}T12:00:00Z`))}>
              {list.map((g) => <MatchRow key={g.id} match={toMatchRow(g, now, `/jogos/${g.id}`)} />)}
            </CompetitionGroup>
          ))
        )}
      </section>}

      {tab === "equipes" && <section className="space-y-3">
        {structure.enrolled.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inscrições em andamento.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {structure.enrolled.map((t) => (
              <li key={t.teamId}>
                <Link href={`/equipes/${t.slug}`} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 hover:border-brand-green/50">
                  <TeamCrest name={t.name} src={t.crestUrl} size={28} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{structure.groups.find((g) => g.id === t.groupId)?.name ?? ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>}
    </div>
  );
}

export default function Page(props: PageProps<"/campeonatos/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-80 max-w-5xl animate-pulse rounded-xl bg-card" />}>
      <Central params={props.params} searchParams={props.searchParams as Promise<{ aba?: string }>} />
    </Suspense>
  );
}

async function DocumentList({ competitionId }: { competitionId: string }) {
  const docs = await listDocuments({ competitionId, publicOnly: true });
  if (docs.length === 0) return <p className="rounded-xl border border-dashed bg-card/60 p-6 text-center text-sm text-muted-foreground">Nenhum documento publicado.</p>;
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {docs.map((d) => (
        <li key={d.id}><a href={d.url} target="_blank" rel="noopener" className="flex items-center justify-between px-4 py-3 text-sm font-semibold hover:text-brand-green">{d.title}<span aria-hidden>↗</span></a></li>
      ))}
    </ul>
  );
}
