import { Suspense } from "react";
import { Panel } from "@/components/admin/fields";
import { SponsorForm, SponsorRowActions } from "@/components/admin/forms/engagement-forms";
import { PageHeader } from "@/components/admin/page-header";
import { listSponsorsWithMetrics } from "@/domain/engagement/queries";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/datetime";

export const metadata = { title: "Patrocinadores" };
const POS: Record<string, string> = { HOME: "Início", COMPETITION: "Competição", MATCH: "Partida" };
const ctr = (c: number, i: number) => (i ? `${((c / i) * 100).toFixed(1).replace(".", ",")}%` : "–");

async function List() {
  const actor = await requirePermission("content.manage", "/admin/patrocinadores");
  const rows = await listSponsorsWithMetrics(actor.organizationId!);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nenhum patrocinador.</p>;
  return (
    <ul className="divide-y">
      {rows.map((s) => (
        <li key={s.id} className={`flex flex-wrap items-center gap-3 py-3 ${s.active ? "" : "opacity-60"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.logoUrl} alt="" className="h-10 w-16 rounded bg-white object-contain p-1" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{s.name} <span className="text-xs text-muted-foreground">• {s.durationSeconds}s • {s.placements.map((p) => POS[p]).join(", ")}</span></p>
            <p className="text-xs text-muted-foreground">
              {s.startsAt ? `de ${formatDateTime(s.startsAt)} ` : ""}{s.endsAt ? `até ${formatDateTime(s.endsAt)}` : ""}
              {!s.active && " • pausado"}
            </p>
          </div>
          <div className="text-right text-xs">
            <p><span className="font-mono font-bold text-brand-amber">{s.impressions}</span> visualizações • <span className="font-mono font-bold text-brand-amber">{s.clicks}</span> cliques ({ctr(s.clicks, s.impressions)})</p>
            <p className="text-muted-foreground">7 dias: {s.impressions7d} / {s.clicks7d}</p>
          </div>
          <SponsorRowActions id={s.id} active={s.active} />
        </li>
      ))}
    </ul>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader title="Patrocinadores" description="Banners rotativos (padrão 4s) com relatório de visualizações e cliques." />
      <div className="grid gap-4">
        <Panel title="Novo patrocinador"><SponsorForm /></Panel>
        <Panel title="Banners e relatório"><Suspense fallback={<div className="h-20 animate-pulse rounded bg-muted" />}><List /></Suspense></Panel>
      </div>
    </>
  );
}
