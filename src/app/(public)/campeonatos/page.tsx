import Link from "next/link";
import { Suspense } from "react";
import { listCompetitions } from "@/domain/competitions/queries";
import { COMPETITION_STATUS_LABEL, MODALITY_LABEL } from "@/domain/labels";
import { cn } from "@/lib/utils";

export const metadata = { title: "Campeonatos" };

const TABS = [
  { key: "andamento", label: "Em andamento", match: ["ONGOING"] },
  { key: "proximos", label: "Próximos", match: ["REGISTRATION", "DRAFT"] },
  { key: "finalizados", label: "Finalizados", match: ["FINISHED"] },
] as const;

async function List({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.situacao) ?? TABS[0];
  const rows = (await listCompetitions({ publicOnly: true })).filter((c) => (tab.match as readonly string[]).includes(c.status));
  return (
    <>
      <nav className="flex gap-1.5 overflow-x-auto" aria-label="Situação">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/campeonatos?situacao=${t.key}`}
            aria-current={t.key === tab.key ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide",
              t.key === tab.key ? "border-brand-green bg-brand-green text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card/60 p-8 text-center text-sm text-muted-foreground">Nenhuma competição nesta situação.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/campeonatos/${c.slug}`} className="block rounded-xl border bg-card p-4 transition-colors hover:border-brand-green/50">
                <p className="font-display text-xl font-bold uppercase">{c.name} <span className="text-muted-foreground">{c.season}</span></p>
                <p className="mt-1 text-sm text-muted-foreground">{MODALITY_LABEL[c.modality]} • {c.teamCount} equipes{c.city ? ` • ${c.city}` : ""}</p>
                <p className="mt-3 inline-block rounded-full bg-brand-deep px-2.5 py-1 text-[11px] font-bold uppercase text-brand-green">
                  {c.currentPhase ?? COMPETITION_STATUS_LABEL[c.status]}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function Page(props: PageProps<"/campeonatos">) {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 py-6 sm:px-4">
      <div>
        <h1 className="text-3xl font-extrabold uppercase">Campeonatos</h1>
        <p className="text-sm text-muted-foreground">Acompanhe tabelas, jogos e estatísticas.</p>
      </div>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-card" />}>
        <List searchParams={props.searchParams as Promise<{ situacao?: string }>} />
      </Suspense>
    </div>
  );
}
