import Link from "next/link";
import { TeamCrest } from "@/components/brand/team-crest";
import type { GroupStanding } from "@/domain/standings/queries";
import { cn } from "@/lib/utils";

const th = "px-2 py-2 text-center font-semibold";
const td = "tabular px-2 py-2 text-center";

export function StandingsTables({ groups, qualify = 2 }: { groups: GroupStanding[]; qualify?: number }) {
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.groupId ?? g.groupName} className="overflow-hidden rounded-xl border bg-card">
          <p className="bg-surface-2 px-3 py-2 text-xs font-bold uppercase tracking-wide">{g.groupName}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-[11px] uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="w-8 px-2 py-2">#</th><th className="px-2 py-2 text-left">Equipe</th>
                  <th className={th}>J</th><th className={th}>V</th><th className={th}>E</th><th className={th}>D</th>
                  <th className={th}>GP</th><th className={th}>GC</th><th className={th}>SG</th><th className={cn(th, "text-foreground")}>PTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {g.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-row-hover">
                    <td className="px-2 py-2 text-center">
                      <span className={cn("inline-flex size-6 items-center justify-center rounded-md text-xs font-bold", r.position <= qualify && r.played > 0 ? "bg-brand-green text-primary-foreground" : "text-muted-foreground")}>{r.position}</span>
                    </td>
                    <td className="px-2 py-2">
                      <Link href={`/equipes/${r.slug}`} className="flex items-center gap-2 font-semibold hover:text-brand-green">
                        <TeamCrest name={r.name} src={r.crestUrl} size={20} /><span className="truncate">{r.name}</span>
                      </Link>
                    </td>
                    <td className={td}>{r.played}</td><td className={td}>{r.wins}</td><td className={td}>{r.draws}</td><td className={td}>{r.losses}</td>
                    <td className={td}>{r.goalsFor}</td><td className={td}>{r.goalsAgainst}</td>
                    <td className={td}>{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</td>
                    <td className={cn(td, "font-mono font-bold text-brand-green")}>{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-3 rounded-sm bg-brand-green" /> Zona de classificação • só resultados confirmados pela organização</p>
    </div>
  );
}

export function ScorersTable({ rows }: { rows: { athleteId: string; name: string; teamName: string; goals: number; assists: number; teamSlug?: string | null; crestUrl?: string | null }[] }) {
  if (rows.length === 0) return <p className="rounded-xl border border-dashed bg-card/60 p-6 text-center text-sm text-muted-foreground">Nenhum gol em jogos confirmados.</p>;
  const podium = rows.filter((r) => r.goals > 0).slice(0, 3);
  return (
    <div className="space-y-4">
      {podium.length > 0 && (
        <div className="grid grid-cols-3 items-end gap-2">
          {[podium[1], podium[0], podium[2]].map((p, i) => p && (
            <div key={p.athleteId} className={cn("rounded-xl border bg-card p-3 text-center", i === 1 && "border-brand-green/60 pb-6")}>
              <p className="font-display text-2xl font-extrabold text-brand-green">{i === 1 ? "1º" : i === 0 ? "2º" : "3º"}</p>
              <p className="truncate font-semibold">{p.name}</p>
              <p className="truncate text-xs text-muted-foreground">{p.teamName}</p>
              <p className="tabular mt-1 font-mono text-lg font-bold">{p.goals} gol{p.goals > 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-[11px] uppercase text-muted-foreground">
            <tr><th className="w-8 px-3 py-2">#</th><th className="px-3 py-2 text-left">Atleta</th><th className="px-3 py-2 text-center">Gols</th><th className="px-3 py-2 text-center">Assist.</th></tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((r, i) => (
              <tr key={r.athleteId}>
                <td className="tabular px-3 py-2 text-center text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <TeamCrest name={r.teamName || r.name} src={r.crestUrl ?? null} size={20} />
                    <span className="min-w-0"><span className="block truncate font-semibold">{r.name}</span>
                      {r.teamSlug ? <Link href={`/equipes/${r.teamSlug}`} className="block truncate text-xs text-muted-foreground hover:text-brand-green">{r.teamName}</Link> : <span className="block truncate text-xs text-muted-foreground">{r.teamName}</span>}
                    </span>
                  </span>
                </td>
                <td className="tabular px-3 py-2 text-center font-mono font-bold text-brand-green">{r.goals}</td>
                <td className="tabular px-3 py-2 text-center">{r.assists}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Head({ first }: { first: string }) {
  return (
    <thead className="bg-surface-2 text-[11px] uppercase text-muted-foreground">
      <tr><th className="px-3 py-2 text-left">{first}</th><th className="px-3 py-2 text-center" aria-label="Amarelos">🟨</th><th className="px-3 py-2 text-center" aria-label="Vermelhos">🟥</th></tr>
    </thead>
  );
}

export function DisciplineTables({ data }: { data: { teams: { teamId: string; name: string; yellow: number; red: number }[]; athletes: { athleteId: string; name: string; teamName: string; yellow: number; red: number }[] } }) {
  if (data.teams.length === 0) return <p className="rounded-xl border border-dashed bg-card/60 p-6 text-center text-sm text-muted-foreground">Nenhum cartão em jogos confirmados.</p>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <table className="w-full overflow-hidden rounded-xl border bg-card text-sm"><Head first="Equipe" />
        <tbody className="divide-y divide-border/60">{data.teams.map((t) => (
          <tr key={t.teamId}><td className="px-3 py-2 font-semibold">{t.name}</td><td className="tabular px-3 py-2 text-center">{t.yellow}</td><td className="tabular px-3 py-2 text-center">{t.red}</td></tr>
        ))}</tbody>
      </table>
      <table className="w-full overflow-hidden rounded-xl border bg-card text-sm"><Head first="Atleta" />
        <tbody className="divide-y divide-border/60">{data.athletes.map((a) => (
          <tr key={a.athleteId}>
            <td className="px-3 py-2"><span className="font-semibold">{a.name}</span> <span className="text-xs text-muted-foreground">{a.teamName}</span>{a.red > 0 && <span className="ml-2 rounded bg-brand-live/20 px-1.5 text-[10px] font-bold text-brand-live">EXPULSO</span>}</td>
            <td className="tabular px-3 py-2 text-center">{a.yellow}</td><td className="tabular px-3 py-2 text-center">{a.red}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
