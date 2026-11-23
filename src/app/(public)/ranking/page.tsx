import Link from "next/link";
import { Suspense } from "react";
import { ScorersTable } from "@/components/public/standings/tables";
import { getCompetitionBy, listCompetitions } from "@/domain/competitions/queries";
import { getScorers } from "@/domain/standings/queries";
import { requestNow } from "@/lib/clock-now";
import { cn } from "@/lib/utils";

export const metadata = { title: "Ranking" };

async function Ranking({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const sp = await searchParams;
  await requestNow();
  const comps = (await listCompetitions({ publicOnly: true })).filter((c) => c.status !== "DRAFT");
  if (comps.length === 0) return <p className="rounded-xl border border-dashed bg-card/60 p-8 text-center text-sm text-muted-foreground">Nenhuma competição publicada.</p>;
  const selected = comps.find((c) => c.slug === sp.c) ?? comps[0];
  const comp = await getCompetitionBy({ id: selected.id, publicOnly: true });
  const rows = comp ? await getScorers(comp.id) : [];
  return (
    <>
      <nav className="flex gap-1.5 overflow-x-auto" aria-label="Competição">
        {comps.map((c) => (
          <Link key={c.id} href={`/ranking?c=${c.slug}`} aria-current={c.id === selected.id ? "page" : undefined}
            className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold uppercase", c.id === selected.id ? "border-brand-green bg-brand-green text-primary-foreground" : "bg-card text-muted-foreground")}>
            {c.name}
          </Link>
        ))}
      </nav>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold uppercase">Artilharia</h2>
        <Link href={`/campeonatos/${selected.slug}?aba=classificacao`} className="text-xs font-semibold text-brand-green">Ver classificação →</Link>
      </div>
      <ScorersTable rows={rows} />
    </>
  );
}

export default function Page(props: PageProps<"/ranking">) {
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-3 py-6 sm:px-4">
      <div>
        <h1 className="text-3xl font-extrabold uppercase">Ranking</h1>
        <p className="text-sm text-muted-foreground">Artilharia e assistências com base em resultados confirmados.</p>
      </div>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-card" />}>
        <Ranking searchParams={props.searchParams as Promise<{ c?: string }>} />
      </Suspense>
    </div>
  );
}
