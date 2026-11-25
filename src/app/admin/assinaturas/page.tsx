import { Suspense } from "react";
import { Panel } from "@/components/admin/fields";
import { SubscriptionActions } from "@/components/admin/forms/billing-forms";
import { PageHeader } from "@/components/admin/page-header";
import { INTERVAL_LABEL, formatPrice, requirePlatformOwner } from "@/domain/billing/platform";
import { listSubscriptions } from "@/domain/billing/queries";
import { formatDateTime } from "@/lib/datetime";

export const metadata = { title: "Assinaturas" };
const STATUS = { PENDING: ["Aguardando pagamento", "bg-brand-amber/15 text-brand-amber"], ACTIVE: ["Ativa", "bg-brand-green/15 text-brand-green"], SUSPENDED: ["Suspensa", "bg-muted text-muted-foreground"], CANCELLED: ["Cancelada", "bg-destructive/15 text-destructive"] } as const;

async function List() {
  await requirePlatformOwner("/admin/assinaturas");
  const rows = await listSubscriptions();
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma assinatura ainda. Quando um clube ou liga assinar em /planos, aparece aqui.</p>;
  const mrr = rows.filter((r) => r.status === "ACTIVE").reduce((t, r) => t + (r.interval === "YEAR" ? r.priceCents / 12 : r.priceCents), 0);
  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">Receita mensal recorrente (ativas): <strong className="font-mono text-foreground">{formatPrice(Math.round(mrr))}</strong> · {rows.filter((r) => r.status === "PENDING").length} aguardando pagamento</p>
      <ul className="divide-y">
        {rows.map((s) => {
          const [label, tone] = STATUS[s.status];
          const wa = s.phone ? `https://wa.me/55${s.phone.replace(/\D/g, "").replace(/^55/, "")}` : null;
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{s.orgName} <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tone}`}>{label}</span></p>
                <p className="text-xs text-muted-foreground">{s.planName} · {formatPrice(s.priceCents)}{INTERVAL_LABEL[s.interval]} · {s.userName} ({s.userEmail}){s.phone ? ` · ${s.phone}` : ""}</p>
                <p className="text-xs text-muted-foreground">Assinou em {formatDateTime(s.createdAt)}{s.expiresAt ? ` · acesso até ${formatDateTime(s.expiresAt)}` : ""}{wa && <> · <a href={wa} target="_blank" rel="noopener" className="font-semibold text-brand-green">WhatsApp</a></>}</p>
              </div>
              <SubscriptionActions id={s.id} status={s.status} />
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader title="Assinaturas" description="Clubes e ligas assinantes. Ao confirmar o pagamento, clique em Ativar: o responsável ganha acesso ao painel da organização dele." />
      <Panel title="Assinantes"><Suspense fallback={<div className="h-24 animate-pulse rounded-xl bg-muted" />}><List /></Suspense></Panel>
    </>
  );
}
