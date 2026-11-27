import { Suspense } from "react";
import { Panel } from "@/components/admin/fields";
import { CreatePanel } from "@/components/admin/create-panel";
import { HeroItemControls, HeroRowActions, HeroSlideForm } from "@/components/admin/forms/hero-forms";
import { PageHeader } from "@/components/admin/page-header";
import { listHeroSlides, listSponsorsWithMetrics } from "@/domain/engagement/queries";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime, toLocalInput } from "@/lib/datetime";

export const metadata = { title: "Banners do topo" };

async function Banners() {
  const actor = await requirePermission("content.manage", "/admin/banners");
  const org = actor.organizationId!;
  const [rows, sp] = await Promise.all([listHeroSlides(org), listSponsorsWithMetrics(org)]);
  const sponsorOpts = sp.map((s) => ({ value: s.id, label: s.name }));
  return (
    <div className="grid gap-4">
      <CreatePanel label="Novo banner"><HeroSlideForm sponsors={sponsorOpts} /></CreatePanel>
      <Panel title="Ordem de exibição">
        <p className="mb-3 text-xs text-muted-foreground">O banner automático “Jogos de hoje” entra sozinho quando há partidas no dia (e vai para o início se houver jogo ao vivo).</p>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum banner. Sem banners, o topo mostra a vitrine da marca.</p> : (
          <ul className="divide-y">
            {rows.map(({ slide: s, sponsorName }) => (
              <li key={s.id} className={`flex flex-wrap items-center gap-3 py-3 ${s.active ? "" : "opacity-50"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.imageUrl} alt="" className="h-14 w-36 rounded-lg object-cover" />
                {s.mobileImageUrl && <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={s.mobileImageUrl} alt="" title="Versão celular" className="h-14 w-20 rounded-lg object-cover" /></>}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{s.title || <span className="text-muted-foreground">Só imagem (texto na arte)</span>}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.kind === "SPONSOR" ? `Anúncio • ${sponsorName ?? ""}` : "Destaque"} • {s.durationSeconds}s{s.mobileImageUrl ? " • com versão celular" : ""}
                    {s.startsAt ? ` • de ${formatDateTime(s.startsAt)}` : ""}{s.endsAt ? ` até ${formatDateTime(s.endsAt)}` : ""}{!s.active ? " • pausado" : ""}
                  </p>
                </div>
                <HeroRowActions id={s.id} active={s.active} />
                <HeroItemControls sponsors={sponsorOpts} initial={{
                  id: s.id, kind: s.kind, sponsorId: s.sponsorId, title: s.title, subtitle: s.subtitle, imageUrl: s.imageUrl, mobileImageUrl: s.mobileImageUrl,
                  linkUrl: s.linkUrl, ctaLabel: s.ctaLabel, durationSeconds: s.durationSeconds,
                  startsAt: s.startsAt ? toLocalInput(s.startsAt) : "", endsAt: s.endsAt ? toLocalInput(s.endsAt) : "",
                }} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader title="Banners do topo" description="Carrossel principal do site. Tamanhos: computador 2400×730 px; celular 1080×660 px (opcional)." />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-card" />}><Banners /></Suspense>
    </>
  );
}
