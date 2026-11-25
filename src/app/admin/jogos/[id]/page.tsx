import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MatchConsole } from "@/components/operator/match-console";
import { getMatch } from "@/domain/competitions/queries";
import { clockStateOf } from "@/domain/labels";
import { listMatchEvents, listMatchRoster, listMatchStats } from "@/domain/match/queries";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getDb } from "@/db";
import { matches } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const metadata = { title: "Operação da partida" };

async function Console({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePermission("match.operate", `/admin/jogos/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [owned] = await getDb().select({ id: matches.id }).from(matches).where(and(eq(matches.id, id), eq(matches.organizationId, actor.organizationId ?? "")));
  if (!owned) notFound();
  const m = await getMatch(id);
  if (!m) notFound();
  const [events, stats, roster] = await Promise.all([listMatchEvents(id), listMatchStats(id), listMatchRoster(m.competitionId, [m.homeId, m.awayId])]);
  const statOf = (teamId: string) => {
    const s = stats.find((x) => x.teamId === teamId);
    return { shots: s?.shots ?? 0, shotsOnTarget: s?.shotsOnTarget ?? 0, corners: s?.corners ?? 0, offsides: s?.offsides ?? 0 };
  };
  return (
    <>
      <div className="mx-auto mb-3 flex max-w-xl items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{m.competitionName}{m.venueName ? ` • ${m.venueName}` : ""}</span>
        <Link href={`/admin/jogos/${m.id}/campinho`} className="rounded-lg border px-3 py-1.5 font-semibold text-foreground hover:bg-muted">Campinho (olheiro) →</Link>
      </div>
      <MatchConsole
        matchId={m.id}
        version={m.version}
        status={m.status}
        clock={clockStateOf(m)}
        periodMinutes={m.periodMinutes}
        modality={m.modality}
        intervalMinutes={m.intervalMinutes}
        timeoutsPerHalf={m.timeoutsPerHalf}
        knockout={m.phaseType === "KNOCKOUT"}
        home={{ id: m.homeId, name: m.homeName, score: m.homeScore }}
        away={{ id: m.awayId, name: m.awayName, score: m.awayScore }}
        roster={roster}
        events={events.map((e) => ({ id: e.id, clientEventId: e.clientEventId, type: e.type, teamId: e.teamId, minute: e.minute, athleteName: e.athleteNick ?? e.athleteName, voided: e.voidedAt !== null, ownGoal: e.detail.ownGoal, penalty: e.detail.penalty, period: e.detail.period ?? null }))}
        stats={{ home: statOf(m.homeId), away: statOf(m.awayId) }}
        canConfirm={can(actor.role, "match.confirm")}
      />
    </>
  );
}

export default function Page(props: PageProps<"/admin/jogos/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-xl animate-pulse rounded-2xl bg-card" />}>
      <Console params={props.params} />
    </Suspense>
  );
}
