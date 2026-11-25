"use client";

import { useActionState } from "react";
import { subscribe } from "@/domain/billing/actions";

const input = "mt-1 h-12 w-full rounded-xl border bg-background px-3.5 text-base focus-visible:border-brand-green focus-visible:outline-none";

export function SubscribeForm({ plans, defaultPlan }: { plans: { id: string; label: string }[]; defaultPlan: string }) {
  const [state, action, pending] = useActionState(subscribe, { ok: false, message: "" });
  return (
    <form action={action} className="space-y-3 rounded-2xl border bg-card p-5">
      <label className="block text-sm font-semibold">Plano
        <select name="planId" defaultValue={defaultPlan} className={input}>{plans.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
      </label>
      <label className="block text-sm font-semibold">Nome do clube ou da liga<input name="orgName" required minLength={3} maxLength={80} className={input} placeholder="Liga Esportiva de Quixadá" /></label>
      <label className="block text-sm font-semibold">Seu nome<input name="name" required minLength={3} maxLength={80} autoComplete="name" className={input} /></label>
      <label className="block text-sm font-semibold">E-mail (será o seu login)<input name="email" type="email" required autoComplete="email" className={input} /></label>
      <label className="block text-sm font-semibold">WhatsApp com DDD<input name="phone" type="tel" required inputMode="tel" autoComplete="tel" className={input} placeholder="(88) 99999-9999" /></label>
      <label className="block text-sm font-semibold">Senha<input name="password" type="password" required minLength={8} autoComplete="new-password" className={input} /></label>
      {state?.message && !state.ok && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">{state.message}</p>}
      <button disabled={pending} className="h-12 w-full rounded-xl bg-brand-green font-extrabold text-primary-foreground disabled:opacity-50">{pending ? "Criando conta…" : "Criar conta e assinar"}</button>
    </form>
  );
}
