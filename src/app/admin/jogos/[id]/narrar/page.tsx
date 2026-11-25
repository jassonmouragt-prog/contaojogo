import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { and, eq } from "drizzle-orm";
import { NarratorPanel } from "@/components/operator/narrator-panel";
import { getDb } from "@/db";
import { matches, teams } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { realtimeConfigured } from "@/lib/realtime/cloudflare";
import { alias } from "drizzle-orm/pg-core";

export const metadata = { title: "Narração ao vivo" };

async function Panel({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePermission("match.operate", `/admin/jogos/${id}/narrar`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const h = alias(teams, "h"), a = alias(teams, "a");
  const [m] = await getDb().select({ id: matches.id, on: matches.narrationSessionId, home: h.name, away: a.name }).from(matches)
    .innerJoin(h, eq(h.id, matches.homeTeamId)).innerJoin(a, eq(a.id, matches.awayTeamId))
    .where(and(eq(matches.id, id), eq(matches.organizationId, actor.organizationId ?? "")));
  if (!m) notFound();
  return (
    <>
      <div className="mx-auto mb-4 flex max-w-md items-center justify-between text-xs text-muted-foreground">
        <span>Narrador • {m.home} x {m.away}</span>
        <Link href={`/admin/jogos/${id}`} className="font-semibold hover:text-foreground">Painel do operador →</Link>
      </div>
      <NarratorPanel matchId={m.id} configured={realtimeConfigured()} initialOn={Boolean(m.on)} />
    </>
  );
}

export default function Page(props: PageProps<"/admin/jogos/[id]/narrar">) {
  return <Suspense fallback={<div className="mx-auto h-96 max-w-md animate-pulse rounded-2xl bg-card" />}><Panel params={props.params} /></Suspense>;
}
