import Link from "next/link";
import { notFound } from "next/navigation";
import { requestNow } from "@/lib/clock-now";
import { Suspense } from "react";
import { CompetitionGroup } from "@/components/brand/competition-group";
import { MatchRow } from "@/components/brand/match-row";
import { TeamCrest } from "@/components/brand/team-crest";
import { getTeamBy, listTeamAthletes, listTeamCompetitions, listTeamMatches } from "@/domain/competitions/queries";
import { POSITION_LABEL, toMatchRow } from "@/domain/labels";
import { getScorersBy } from "@/domain/standings/queries";

async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const now = await requestNow();
  const team = await getTeamBy({ slug });
  if (!team) notFound();
  const [comps, squad, games] = await Promise.all([
    listTeamCompetitions(team.id),
    listTeamAthletes(team.id, false),
    listTeamMatches(team.id, true),
  ]);
  const scorers = await getScorersBy({ teamId: team.id });
  const goals = new Map(scorers.map((s) => [s.athleteId, s.goals]));
  const top = scorers.filter((s) => s.goals > 0).slice(0, 3);
  // Equipe só aparece no portal se participa de alguma competição publicada.
  if (comps.length === 0) notFound();
    const visible = games.filter((g) => g.status !== "CANCELLED");
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-3 py-6 sm:px-4">
      <header className="flex items-center gap-4 rounded-2xl border bg-card p-5">
        <TeamCrest name={team.name} src={team.crestUrl} size={64} />
        <div className="min-w-0">
          <h1 className="truncate text-4xl font-extrabold uppercase leading-none">{team.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[team.city, ...comps.map((c) => (c.groupName ? `${c.name} • ${c.groupName}` : c.name))].filter(Boolean).join(" • ")}
          </p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-3">
          <h2 className="text-xl font-extrabold uppercase">Jogos</h2>
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum jogo divulgado.</p>
          ) : (
            comps.map((c) => {
              const list = visible.filter((g) => g.competitionId === c.id);
              if (!list.length) return null;
              return (
                <CompetitionGroup key={c.id} name={c.name} href={`/campeonatos/${c.slug}`}>
                  {list.map((g) => <MatchRow key={g.id} match={toMatchRow(g, now, `/jogos/${g.id}`)} />)}
                </CompetitionGroup>
              );
            })
          )}
        </section>
        <section className="space-y-3">
          {top.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xl font-extrabold uppercase">Artilheiros</h2>
              <ol className="space-y-2">
                {top.map((s, i) => (
                  <li key={s.athleteId} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
                    <span className={`flex size-8 items-center justify-center rounded-lg font-display text-lg font-extrabold ${i === 0 ? "bg-brand-green text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {s.photoUrl && <img src={s.photoUrl} alt="" className="size-8 rounded-full object-cover" />}
                    <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
                    <span className="font-mono text-lg font-bold text-brand-green">{s.goals}</span><span className="text-xs text-muted-foreground">gol{s.goals > 1 ? "s" : ""}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <h2 className="text-xl font-extrabold uppercase">Elenco</h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            {squad.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Elenco não divulgado.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-[11px] uppercase text-muted-foreground">
                  <tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Atleta</th><th className="px-3 py-2 text-left">Pos</th><th className="px-3 py-2 text-center">Gols</th></tr>
                </thead>
                <tbody className="divide-y">
                  {squad.map((a) => (
                    <tr key={a.id}>
                      <td className="tabular px-3 py-2 font-mono font-bold text-brand-green">{a.shirtNumber ?? "–"}</td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {a.photoUrl ? <img src={a.photoUrl} alt="" className="size-8 rounded-full object-cover" /> : <span className="flex size-8 items-center justify-center rounded-full bg-brand-deep text-xs font-bold text-brand-green">{a.name.charAt(0)}</span>}
                          <span className="font-semibold">{a.nickname ?? a.name}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{a.position ? POSITION_LABEL[a.position] : ""}</td>
                      <td className="tabular px-3 py-2 text-center font-mono font-bold">{goals.get(a.id) ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="text-xs text-muted-foreground"><Link href="/campeonatos" className="hover:text-foreground">← Campeonatos</Link></p>
        </section>
      </div>
    </div>
  );
}

export default function Page(props: PageProps<"/equipes/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-80 max-w-5xl animate-pulse rounded-xl bg-card" />}>
      <TeamPage params={props.params} />
    </Suspense>
  );
}
