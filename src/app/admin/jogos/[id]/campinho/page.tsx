import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { and, eq } from "drizzle-orm";
import { ScoutPanel } from "@/components/operator/scout-panel";
import { getMatch } from "@/domain/competitions/queries";
import { requirePermission } from "@/lib/auth/session";
import { getDb } from "@/db";
import { matches } from "@/db/schema";

export const metadata = { title: "Campinho ao vivo — olheiro" };

async function Panel({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePermission("match.operate", `/admin/jogos/${id}/campinho`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [owned] = await getDb().select({ id: matches.id }).from(matches).where(and(eq(matches.id, id), eq(matches.organizationId, actor.organizationId ?? "")));
  if (!owned) notFound();
  const m = await getMatch(id);
  if (!m) notFound();
  return (
    <>
      <div className="mx-auto mb-3 flex max-w-xl items-center justify-between text-xs text-muted-foreground">
        <span>Olheiro • {m.homeName} x {m.awayName}</span>
        <Link href={`/admin/jogos/${id}`} className="font-semibold hover:text-foreground">Painel do operador →</Link>
      </div>
      <ScoutPanel matchId={m.id} futsal={m.modality === "FUTSAL"} live={m.status === "LIVE"} finished={m.status === "FINISHED" || m.status === "CONFIRMED" || m.period === "FINISHED"} home={{ id: m.homeId, name: m.homeName }} away={{ id: m.awayId, name: m.awayName }} />
    </>
  );
}

export default function Page(props: PageProps<"/admin/jogos/[id]/campinho">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-xl animate-pulse rounded-2xl bg-card" />}>
      <Panel params={props.params} />
    </Suspense>
  );
}
