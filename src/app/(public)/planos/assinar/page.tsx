import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { SubscribeForm } from "@/components/public/subscribe-form";
import { INTERVAL_LABEL, formatPrice } from "@/domain/billing/platform";
import { listPlans } from "@/domain/billing/queries";

export const metadata = { title: "Assinar plano" };

async function Form({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const sp = await searchParams;
  const plans = await listPlans(true);
  const chosen = plans.find((p) => p.id === sp.plano) ?? plans[0];
  if (!chosen) return <p className="text-muted-foreground">Nenhum plano à venda no momento. <Link href="/planos" className="text-brand-green">Voltar</Link></p>;
  return <SubscribeForm plans={plans.map((p) => ({ id: p.id, label: `${p.name} — ${formatPrice(p.priceCents)}${INTERVAL_LABEL[p.interval]}` }))} defaultPlan={chosen.id} />;
}

export default function Page(props: PageProps<"/planos/assinar">) {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-3 py-8 sm:px-4">
      <h1 className="text-2xl font-black uppercase">Assinar</h1>
      <p className="text-sm text-muted-foreground">Crie a conta do seu clube ou liga. Depois da confirmação do pagamento, o painel é liberado no mesmo login.</p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-card" />}><Form searchParams={props.searchParams} /></Suspense>
    </div>
  );
}
