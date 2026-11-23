import { Suspense } from "react";
import { Panel } from "@/components/admin/fields";
import { CreatePanel } from "@/components/admin/create-panel";
import { VenueForm } from "@/components/admin/forms/team-forms";
import { PageHeader } from "@/components/admin/page-header";
import { listVenues } from "@/domain/competitions/queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata = { title: "Locais" };

async function List() {
  const actor = await requirePermission("competition.manage", "/admin/locais");
  const rows = await listVenues(actor.organizationId);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nenhum local cadastrado.</p>;
  return (
    <ul className="divide-y text-sm">
      {rows.map((v) => (
        <li key={v.id} className="py-2"><span className="font-semibold">{v.name}</span>{v.city && <span className="text-muted-foreground"> • {v.city}</span>}</li>
      ))}
    </ul>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader title="Locais" description="Arenas e campos usados na agenda." />
      <div className="grid gap-4">
        <CreatePanel label="Novo local"><VenueForm /></CreatePanel>
        <Panel title="Cadastrados"><Suspense fallback={<div className="h-16 animate-pulse rounded bg-muted" />}><List /></Suspense></Panel>
      </div>
    </>
  );
}
