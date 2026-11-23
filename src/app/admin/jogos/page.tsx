import { requestNow } from "@/lib/clock-now";
import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { listMatchesBetween } from "@/domain/competitions/queries";
import { MATCH_STATUS_LABEL } from "@/domain/labels";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/datetime";

export const metadata = { title: "Agenda" };

async function Agenda() {
  const actor = await requirePermission("dashboard.view", "/admin/jogos");
  const now = await requestNow();
  const rows = await listMatchesBetween({ organizationId: actor.organizationId, from: new Date(now - 2 * 86_400_000), to: new Date(now + 30 * 86_400_000) });
  rows.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  if (rows.length === 0) return <p className="rounded-xl border border-dashed bg-card/60 p-6 text-sm text-muted-foreground">Nenhum jogo entre ontem e os próximos 30 dias.</p>;
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card text-sm">
      {rows.map((g) => (
        <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span>
            <span className="font-semibold">{g.homeName} x {g.awayName}</span>
            <span className="block text-xs text-muted-foreground">{formatDateTime(g.scheduledAt)} • {g.competitionName}{g.venueName ? ` • ${g.venueName}` : ""}</span>
          </span>
          <span className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground">{MATCH_STATUS_LABEL[g.status]}</span>
            {g.status !== "CANCELLED" && g.status !== "POSTPONED" && (
              <Link href={`/admin/jogos/${g.id}`} className="rounded-lg bg-brand-amber px-3 py-1.5 text-xs font-bold text-black">
                {g.status === "SCHEDULED" || g.status === "LIVE" ? "Operar" : "Súmula"}
              </Link>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader title="Agenda" description="Jogos de ontem até os próximos 30 dias." />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-card" />}><Agenda /></Suspense>
    </>
  );
}
