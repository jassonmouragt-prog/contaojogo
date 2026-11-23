import { Suspense } from "react";
import { TicketForm, TicketReplyForm } from "@/components/engagement/public-forms";
import { myTickets, ticketThread } from "@/domain/engagement/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/datetime";

export const metadata = { title: "Suporte" };
const STATUS = { OPEN: "Aberto", IN_PROGRESS: "Em atendimento", RESOLVED: "Resolvido" } as const;

async function Support({ searchParams }: { searchParams: Promise<{ tipo?: string; pagina?: string }> }) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  const tickets = me ? await myTickets(me.id) : [];
  const threads = await Promise.all(tickets.map((t) => ticketThread(t.id)));
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-2xl border bg-card p-5">
        <TicketForm name={me?.name} email={me?.email} category={sp.tipo} page={sp.pagina} />
      </section>
      <aside className="space-y-3">
        <h2 className="text-lg font-extrabold uppercase">Meus chamados</h2>
        {!me ? <p className="text-sm text-muted-foreground">Entre na sua conta para acompanhar as respostas aqui.</p>
          : tickets.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum chamado.</p>
          : tickets.map((t, i) => (
            <div key={t.id} className="rounded-xl border bg-card p-3 text-sm">
              <p className="flex justify-between"><span className="font-bold">#{String(t.number).padStart(4, "0")}</span><span className="text-xs text-brand-green">{STATUS[t.status]}</span></p>
              <p className="mt-1 line-clamp-2 text-muted-foreground">{t.message}</p>
              {threads[i].map((m) => (
                <p key={m.id} className={`mt-2 rounded-lg px-2 py-1 text-xs ${m.fromStaff ? "bg-brand-deep text-brand-green" : "bg-background"}`}>
                  <span className="font-semibold">{m.fromStaff ? "Suporte" : "Você"}</span> • {formatDateTime(m.createdAt)}<br />{m.body}
                </p>
              ))}
              {t.status !== "RESOLVED" && <TicketReplyForm ticketId={t.id} />}
            </div>
          ))}
      </aside>
    </div>
  );
}

export default function Page(props: PageProps<"/suporte">) {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 py-6 sm:px-4">
      <div>
        <h1 className="text-3xl font-extrabold uppercase">Como podemos ajudar?</h1>
        <p className="text-sm text-muted-foreground">Escolha uma opção para iniciar o atendimento. Cada chamado recebe um número.</p>
      </div>
      <Suspense fallback={<div className="h-60 animate-pulse rounded-xl bg-card" />}><Support searchParams={props.searchParams as Promise<{ tipo?: string; pagina?: string }>} /></Suspense>
    </div>
  );
}
