import Link from "next/link";
import { Suspense } from "react";
import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { matches, supportTickets } from "@/db/schema";
import { listMatchesBetween } from "@/domain/competitions/queries";
import { MATCH_STATUS_LABEL } from "@/domain/labels";
import { requestNow } from "@/lib/clock-now";
import { dayStart, toLocalDay } from "@/lib/format";
import { formatTime } from "@/lib/datetime";
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
  const now = await requestNow();
  const today = toLocalDay(new Date(now));
  const org = user.organizationId ?? "";
  const [todayGames, [pending], [tickets]] = await Promise.all([
    listMatchesBetween({ organizationId: org, from: dayStart(today), to: new Date(dayStart(today).getTime() + 86_400_000) }),
    getDb().select({ n: count() }).from(matches).where(and(eq(matches.organizationId, org), eq(matches.status, "FINISHED"))),
    getDb().select({ n: count() }).from(supportTickets).where(and(eq(supportTickets.organizationId, org), eq(supportTickets.status, "OPEN"))),
  ]);
  const shortcuts = [
    { href: "/admin/competicoes", label: "Nova competição" },
    { href: "/admin/equipes", label: "Nova equipe" },
    { href: "/admin/banners", label: "Novo banner" },
    { href: "/admin/conteudo", label: "Nova notícia" },
  ];
  return (
    <>
      <PageHeader title={`Olá, ${firstName}`} description="O que precisa da sua atenção hoje." />
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="text-sm font-bold">Jogos de hoje</h2>
            <Link href="/admin/jogos" className="text-xs font-semibold text-brand-amber">Agenda completa →</Link>
          </div>
          {todayGames.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">Nenhum jogo hoje.</p> : (
            <ul className="divide-y">
              {todayGames.filter((g) => g.status !== "CANCELLED").map((g) => (
                <li key={g.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="w-12 font-mono font-bold text-brand-amber">{formatTime(g.scheduledAt)}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{g.homeName} x {g.awayName}</span><span className="text-xs text-muted-foreground">{g.competitionName} • {MATCH_STATUS_LABEL[g.status]}</span></span>
                  <Link href={`/admin/jogos/${g.id}`} className="rounded-lg bg-brand-amber px-3 py-1.5 text-xs font-bold text-black">{g.status === "SCHEDULED" || g.status === "LIVE" ? "Operar" : "Súmula"}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="space-y-3">
          <Link href="/admin/jogos" className={`block rounded-2xl border p-4 ${pending.n ? "border-brand-amber/60 bg-brand-amber/10" : "bg-card"}`}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Resultados a confirmar</p>
            <p className="font-mono text-3xl font-bold text-brand-amber">{pending.n}</p>
          </Link>
          <Link href="/admin/suporte" className={`block rounded-2xl border p-4 ${tickets.n ? "border-brand-amber/60 bg-brand-amber/10" : "bg-card"}`}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Chamados abertos</p>
            <p className="font-mono text-3xl font-bold text-brand-amber">{tickets.n}</p>
          </Link>
          <div className="grid grid-cols-2 gap-2">
            {shortcuts.map((x) => <Link key={x.href} href={x.href} className="rounded-xl border bg-card px-3 py-2.5 text-center text-xs font-semibold hover:border-brand-amber/50">+ {x.label}</Link>)}
          </div>
        </div>
      </div>
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
