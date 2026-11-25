import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { INTERVAL_LABEL, formatPrice } from "@/domain/billing/platform";
import { listPlans } from "@/domain/billing/queries";

export const metadata = { title: "Planos para clubes e ligas", description: "Tenha seu campeonato no Conta o Jogo: tabela, jogos ao vivo e campinho virtual." };

async function Plans() {
  await connection();
  const rows = await listPlans(true);
  if (rows.length === 0) return <p className="rounded-2xl border bg-card p-6 text-center text-muted-foreground">Os planos estão sendo preparados. Fale com a gente pelo WhatsApp.</p>;
  return (
    <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
      {rows.map((p) => (
        <article key={p.id} className={`relative flex flex-col rounded-2xl border bg-card p-6 ${p.highlighted ? "border-brand-green shadow-[0_0_40px_-12px] shadow-brand-green/60" : ""}`}>
          {p.highlighted && <span className="absolute -top-3 left-6 rounded-full bg-brand-green px-3 py-0.5 text-xs font-extrabold uppercase text-primary-foreground">Mais escolhido</span>}
          <h2 className="text-xl font-black uppercase">{p.name}</h2>
          {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
          <p className="mt-4"><span className="font-mono text-4xl font-black text-brand-green">{formatPrice(p.priceCents)}</span><span className="text-muted-foreground">{INTERVAL_LABEL[p.interval]}</span></p>
          <ul className="mt-5 flex-1 space-y-2 text-sm">
            {p.maxCompetitions ? <li>✓ Até {p.maxCompetitions} competição(ões) ativa(s)</li> : <li>✓ Competições ilimitadas</li>}
            {p.benefits.map((b) => <li key={b}>✓ {b}</li>)}
          </ul>
          <Link href={`/planos/assinar?plano=${p.id}`} className={`mt-6 grid h-12 place-items-center rounded-xl font-extrabold ${p.highlighted ? "bg-brand-green text-primary-foreground" : "border border-brand-green text-brand-green"}`}>Assinar</Link>
        </article>
      ))}
    </div>
  );
}

export default function Page() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-3 py-8 sm:px-4">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-black uppercase sm:text-4xl">Seu campeonato no Conta o Jogo</h1>
        <p className="mt-2 text-muted-foreground">Para clubes e ligas: painel próprio para cadastrar equipes, atletas e jogos, tabela automática, jogos ao vivo pelo celular e campinho virtual para a torcida acompanhar.</p>
      </header>
      <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-card" />}><Plans /></Suspense>
    </div>
  );
}
