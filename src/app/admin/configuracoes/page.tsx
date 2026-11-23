import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { OrganizationForm } from "@/components/admin/organization-form";
import { PageHeader } from "@/components/admin/page-header";
import { getDb } from "@/db";
import { organizations } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";

export const metadata = { title: "Configurações" };

async function Settings() {
  const actor = await requirePermission("settings.manage", "/admin/configuracoes");
  const [org] = actor.organizationId
    ? await getDb().select().from(organizations).where(eq(organizations.id, actor.organizationId)).limit(1)
    : [];
  if (!org) return <p className="text-sm text-muted-foreground">Conta sem organização vinculada.</p>;
  return (
    <div className="grid gap-4">
      <OrganizationForm name={org.name} />
      <section className="max-w-md space-y-2 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-bold">Exportar dados</h2>
        <p className="text-xs text-muted-foreground">Baixe todos os dados da organização em JSON (competições, jogos, súmulas, equipes, patrocínio, conteúdo, chamados e auditoria). Senhas e sessões não são incluídas.</p>
        <a href="/api/admin/export" className="inline-flex h-9 items-center rounded-lg bg-brand-amber px-4 text-sm font-bold text-black">Baixar exportação</a>
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader title="Configurações" description="Disponível apenas para o proprietário." />
      <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-card" />}>
        <Settings />
      </Suspense>
    </>
  );
}
