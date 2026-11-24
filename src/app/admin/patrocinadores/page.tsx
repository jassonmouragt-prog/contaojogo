import { Suspense } from "react";
import { Panel } from "@/components/admin/fields";
import { CreatePanel } from "@/components/admin/create-panel";
import { SponsorForm } from "@/components/admin/forms/engagement-forms";
import { SponsorItem } from "@/components/admin/sponsor-item";
import { PageHeader } from "@/components/admin/page-header";
import { listSponsorsWithMetrics } from "@/domain/engagement/queries";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime, toLocalInput } from "@/lib/datetime";

export const metadata = { title: "Patrocinadores" };
const ctr = (c: number, i: number) => (i ? `${((c / i) * 100).toFixed(1).replace(".", ",")}%` : "–");

async function List() {
  const actor = await requirePermission("content.manage", "/admin/patrocinadores");
  const rows = await listSponsorsWithMetrics(actor.organizationId!);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nenhum patrocinador.</p>;
  return (
    <ul className="divide-y">
      {rows.map((s) => {
        const period = s.startsAt || s.endsAt
          ? `${s.startsAt ? `De ${formatDateTime(s.startsAt)}` : "Já no ar"}${s.endsAt ? ` até ${formatDateTime(s.endsAt)}` : ", sem data para sair"}`
          : "Sem data para sair";
        const stats = `Total: ${s.impressions} visualizações e ${s.clicks} cliques (${ctr(s.clicks, s.impressions)} clicaram) · Últimos 7 dias: ${s.impressions7d} visualizações e ${s.clicks7d} cliques`;
        return (
          <SponsorItem key={s.id} period={period} stats={stats} s={{
            id: s.id, name: s.name, logoUrl: s.logoUrl, linkUrl: s.linkUrl, durationSeconds: s.durationSeconds, placements: s.placements, active: s.active,
            startsAt: s.startsAt ? toLocalInput(s.startsAt) : "", endsAt: s.endsAt ? toLocalInput(s.endsAt) : "",
          }} />
        );
      })}
    </ul>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader title="Patrocinadores" description="Banners rotativos (padrão 4s) com relatório de visualizações e cliques." />
      <div className="grid gap-4">
        <CreatePanel label="Novo patrocinador"><SponsorForm /></CreatePanel>
        <Panel title="Banners e relatório"><Suspense fallback={<div className="h-20 animate-pulse rounded bg-muted" />}><List /></Suspense></Panel>
      </div>
    </>
  );
}
