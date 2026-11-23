import { Suspense } from "react";
import { TicketReplyAdmin } from "@/components/admin/forms/engagement-forms";
import { PageHeader } from "@/components/admin/page-header";
import { listTickets, ticketThread } from "@/domain/engagement/queries";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/datetime";

export const metadata = { title: "Suporte" };
const CAT = { ACCESS: "Acesso", MATCH_ERROR: "Erro em jogo", OTHER: "Geral" } as const;
const STATUS = { OPEN: "Aberto", IN_PROGRESS: "Em atendimento", RESOLVED: "Resolvido" } as const;

async function Tickets() {
  const actor = await requirePermission("content.manage", "/admin/suporte");
  const rows = await listTickets(actor.organizationId!);
  if (rows.length === 0) return <p className="rounded-xl border border-dashed bg-card/60 p-6 text-sm text-muted-foreground">Nenhum chamado.</p>;
  const threads = await Promise.all(rows.map((t) => ticketThread(t.id)));
  return (
    <ul className="space-y-3">
      {rows.map((t, i) => (
        <li key={t.id} className="rounded-xl border bg-card p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p><span className="font-mono font-bold text-brand-amber">#{String(t.number).padStart(4, "0")}</span> <span className="font-semibold">{CAT[t.category]}</span> • {t.name} &lt;{t.email}&gt;</p>
            <p className="text-xs"><span className={t.status === "RESOLVED" ? "text-muted-foreground" : "font-bold text-brand-amber"}>{STATUS[t.status]}</span> • {formatDateTime(t.createdAt)}</p>
          </div>
          <p className="mt-2 whitespace-pre-line">{t.message}</p>
          {(t.pageUrl || t.attachmentUrl) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t.pageUrl && <>Página: {t.pageUrl} </>}
              {t.attachmentUrl && <a href={t.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-brand-amber underline">ver print</a>}
            </p>
          )}
          {threads[i].map((m) => <p key={m.id} className={`mt-2 rounded-lg px-3 py-2 text-xs ${m.fromStaff ? "bg-brand-amber/10" : "bg-background"}`}><strong>{m.fromStaff ? "Equipe" : t.name}</strong> • {formatDateTime(m.createdAt)}<br />{m.body}</p>)}
          <TicketReplyAdmin ticketId={t.id} status={t.status} />
        </li>
      ))}
    </ul>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader title="Suporte" description="Chamados com número, situação e histórico de respostas." />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-card" />}><Tickets /></Suspense>
    </>
  );
}
