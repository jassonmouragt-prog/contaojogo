"use client";

import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { nominateAthlete, openTicket, addTicketMessage } from "@/domain/engagement/public-actions";

const control = "h-11 w-full rounded-lg border bg-background px-3 text-sm";
const btn = "h-11 w-full rounded-lg bg-brand-green font-bold text-primary-foreground disabled:opacity-50";

export function NominationForm({ pollId, athletes }: { pollId: string; athletes: { id: string; label: string }[] }) {
  return (
    <ActionForm action={nominateAthlete} className="space-y-3">
      {(pending) => (
        <>
          <input type="hidden" name="pollId" value={pollId} />
          <label className="block text-sm font-semibold">Atleta
            <select name="athleteId" required className={`mt-1 ${control}`} defaultValue="">
              <option value="" disabled>Escolha…</option>
              {athletes.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">Por quê? (opcional)
            <textarea name="reason" maxLength={280} rows={2} className="mt-1 w-full rounded-lg border bg-background p-3 text-sm" />
          </label>
          <button disabled={pending} className={btn}>{pending ? "Enviando…" : "Indicar atleta"}</button>
        </>
      )}
    </ActionForm>
  );
}

const CATEGORIES = [
  { value: "ACCESS", label: "Problema de acesso — senha, login ou cadastro" },
  { value: "MATCH_ERROR", label: "Erro em jogo — placar ou estatística incorreta" },
  { value: "OTHER", label: "Falar com o suporte" },
];

export function TicketForm({ name, email, category, page }: { name?: string; email?: string; category?: string; page?: string }) {
  return (
    <ActionForm action={openTicket} resetOnSuccess className="space-y-3">
      {(pending) => (
        <>
          <label className="block text-sm font-semibold">Assunto
            <select name="category" className={`mt-1 ${control}`} defaultValue={category ?? "OTHER"}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">Nome<input name="name" required defaultValue={name} className={`mt-1 ${control}`} /></label>
            <label className="block text-sm font-semibold">E-mail<input name="email" type="email" required defaultValue={email} className={`mt-1 ${control}`} /></label>
          </div>
          <label className="block text-sm font-semibold">Página onde ocorreu (opcional)<input name="pageUrl" defaultValue={page} placeholder="ex.: /jogos/…" className={`mt-1 ${control}`} /></label>
          <label className="block text-sm font-semibold">Link do print (opcional)<input name="attachmentUrl" type="url" placeholder="https://…" className={`mt-1 ${control}`} /></label>
          <label className="block text-sm font-semibold">Mensagem<textarea name="message" required minLength={10} maxLength={4000} rows={4} className="mt-1 w-full rounded-lg border bg-background p-3 text-sm" /></label>
          <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
          <button disabled={pending} className={btn}>{pending ? "Enviando…" : "Abrir chamado"}</button>
        </>
      )}
    </ActionForm>
  );
}

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  return (
    <ActionForm action={addTicketMessage} resetOnSuccess className="mt-2 flex gap-2">
      {(pending) => (
        <>
          <input type="hidden" name="ticketId" value={ticketId} />
          <input name="body" required minLength={2} placeholder="Responder…" aria-label="Responder" className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm" />
          <button disabled={pending} className="h-10 rounded-lg border px-3 text-sm font-semibold">Enviar</button>
        </>
      )}
    </ActionForm>
  );
}

export function LoginToNominate() {
  return <Link href="/entrar?next=/indicacoes" className="block rounded-lg bg-brand-green py-3 text-center font-bold text-primary-foreground">Entrar para indicar</Link>;
}
