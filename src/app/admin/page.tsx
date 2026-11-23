import { Suspense } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { StatTile } from "@/components/admin/stat-tile";
import { AUDIT_ACTION_LABEL, getDashboardSummary } from "@/domain/admin/dashboard";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/datetime";

async function Dashboard() {
  const user = await requirePermission("dashboard.view");
  const firstName = user.name.split(" ")[0];
  if (!can(user.role, "users.view")) {
    return (
      <>
        <PageHeader title={`Olá, ${firstName}`} description="Central do operador." />
        <p className="rounded-xl border border-dashed bg-card/60 p-6 text-sm text-muted-foreground">
          As partidas atribuídas a você aparecerão aqui quando a agenda for cadastrada.
        </p>
      </>
    );
  }
  const s = await getDashboardSummary(user.organizationId);
  return (
    <>
      <PageHeader title={`Olá, ${firstName}`} description="Resumo operacional." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Usuários" value={s.users} />
        <StatTile label="Equipe interna" value={s.staff} hint="proprietário, admins e operadores" />
        <StatTile label="Operadores" value={s.operators} />
        <StatTile label="Ativos" value={s.activeUsers7d} hint="últimos 7 dias" />
      </div>
      <section className="mt-6 overflow-hidden rounded-xl border bg-card">
        <p className="bg-surface-2 px-4 py-2 text-xs font-bold uppercase tracking-wide">Atividade recente</p>
        {s.recent.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>
        ) : (
          <ul className="divide-y">
            {s.recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span>
                  <span className="font-semibold">{AUDIT_ACTION_LABEL[r.action] ?? r.action}</span>
                  <span className="text-muted-foreground"> • {r.actorName ?? "Sistema"}</span>
                </span>
                <time className="tabular shrink-0 text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-card" />}>
      <Dashboard />
    </Suspense>
  );
}
