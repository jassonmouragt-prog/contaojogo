import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { AUDIT_ACTION_LABEL, listAudit } from "@/domain/admin/dashboard";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/datetime";

export const metadata = { title: "Auditoria" };
const PAGE_SIZE = 50;

function summarize(before: unknown, after: unknown): string {
  if (!before && !after) return "";
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  return Object.keys({ ...b, ...a })
    .map((k) => `${k}: ${JSON.stringify(b[k] ?? null)} → ${JSON.stringify(a[k] ?? null)}`)
    .join(" • ");
}

async function AuditList({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const actor = await requirePermission("audit.view", "/admin/auditoria");
  const page = Math.max(1, Number.parseInt((await searchParams).pagina ?? "1", 10) || 1);
  const rows = await listAudit({ organizationId: actor.organizationId, page, pageSize: PAGE_SIZE });
  const hasNext = rows.length > PAGE_SIZE;
  const visible = rows.slice(0, PAGE_SIZE);
  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        {visible.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum registro.</p>
        ) : (
          <ul className="divide-y">
            {visible.map((r) => (
              <li key={r.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold">{AUDIT_ACTION_LABEL[r.action] ?? r.action}</span>
                  <time className="tabular text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</time>
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.actorName ?? "Sistema"}{r.actorEmail ? ` (${r.actorEmail})` : ""} • {r.entityType} {r.entityId.slice(0, 8)}
                  {r.ipAddress ? ` • IP ${r.ipAddress}` : ""}
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-foreground/70">{summarize(r.before, r.after)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-3 flex justify-between text-sm">
        {page > 1 ? <Link href={`?pagina=${page - 1}`} className="text-brand-amber">← Anterior</Link> : <span />}
        {hasNext && <Link href={`?pagina=${page + 1}`} className="text-brand-amber">Próxima →</Link>}
      </div>
    </>
  );
}

export default function Page(props: PageProps<"/admin/auditoria">) {
  return (
    <>
      <PageHeader title="Auditoria" description="Registro de quem alterou o quê, e quando." />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-card" />}>
        <AuditList searchParams={props.searchParams as Promise<{ pagina?: string }>} />
      </Suspense>
    </>
  );
}
