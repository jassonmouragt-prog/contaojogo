import { Suspense } from "react";
import { Panel } from "@/components/admin/fields";
import { CreatePanel } from "@/components/admin/create-panel";
import { DocumentForm, NewsForm, NewsToggle } from "@/components/admin/forms/engagement-forms";
import { PageHeader } from "@/components/admin/page-header";
import { listCompetitions } from "@/domain/competitions/queries";
import { listDocuments, listNewsAdmin } from "@/domain/engagement/queries";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/datetime";

export const metadata = { title: "Conteúdo" };

async function Content() {
  const actor = await requirePermission("content.manage", "/admin/conteudo");
  const org = actor.organizationId!;
  const [comps, news, docs] = await Promise.all([listCompetitions({ organizationId: org }), listNewsAdmin(org), listDocuments({ org })]);
  const opts = comps.map((c) => ({ value: c.id, label: c.name }));
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3">
        <CreatePanel label="Nova notícia"><NewsForm competitions={opts} /></CreatePanel>
      </div>
      <Panel title="Notícias">
        {news.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma notícia.</p> : (
          <ul className="divide-y text-sm">{news.map((n) => (
            <li key={n.id} className="flex items-center justify-between gap-2 py-2">
              <span><span className="font-semibold">{n.title}</span><span className="block text-xs text-muted-foreground">{n.published ? "Publicada" : "Rascunho"} • {formatDateTime(n.publishAt)}{n.expiresAt ? ` → ${formatDateTime(n.expiresAt)}` : ""}</span></span>
              <NewsToggle id={n.id} published={n.published} />
            </li>
          ))}</ul>
        )}
      </Panel>
      <Panel title="Documentos (regulamentos, súmulas, comunicados)">
        <CreatePanel label="Novo documento"><DocumentForm competitions={opts} /></CreatePanel>
        {docs.length > 0 && <ul className="mt-3 divide-y text-sm">{docs.map((d) => <li key={d.id} className="py-2"><a href={d.url} target="_blank" rel="noopener" className="font-semibold hover:text-brand-amber">{d.title}</a></li>)}</ul>}
      </Panel>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader title="Conteúdo" description="Notícias com agendamento e expiração, e documentos oficiais." />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-card" />}><Content /></Suspense>
    </>
  );
}
