import { Suspense } from "react";
import { Panel } from "@/components/admin/fields";
import { FinalistsForm, HideNominationButton, PollForm } from "@/components/admin/forms/engagement-forms";
import { PageHeader } from "@/components/admin/page-header";
import { listCompetitions } from "@/domain/competitions/queries";
import { finalists, listPolls, nominationTally, recentNominations } from "@/domain/engagement/queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata = { title: "Indicações" };

async function Polls() {
  const actor = await requirePermission("content.manage", "/admin/indicacoes");
  const org = actor.organizationId!;
  const [comps, polls] = await Promise.all([listCompetitions({ organizationId: org }), listPolls(org)]);
  return (
    <div className="grid gap-4">
      <Panel title="Nova indicação"><PollForm competitions={comps.map((c) => ({ value: c.id, label: c.name }))} /></Panel>
      {await Promise.all(polls.map(async (p) => {
        const [tally, recent, fin] = await Promise.all([nominationTally(p.id), recentNominations(p.id), finalists(p.id)]);
        return (
          <Panel key={p.id} title={`${p.title} • ${p.status === "OPEN" ? "aberta" : p.status === "FINALISTS" ? "finalistas publicados" : "encerrada"}`}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Mais indicados</p>
                {tally.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma indicação ainda.</p> : (
                  <ol className="space-y-1 text-sm">{tally.slice(0, 10).map((t, i) => (
                    <li key={t.athleteId} className="flex justify-between"><span>{i + 1}. <strong>{t.nickname ?? t.name}</strong> <span className="text-muted-foreground">{t.teamName}</span></span><span className="font-mono font-bold text-brand-amber">{t.total}</span></li>
                  ))}</ol>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Moderação (últimas)</p>
                <ul className="max-h-56 space-y-1 overflow-y-auto text-xs">{recent.map((r) => (
                  <li key={r.id} className={`flex items-center justify-between gap-2 ${r.hidden ? "line-through opacity-50" : ""}`}>
                    <span>{r.userName} → <strong>{r.athleteName}</strong>{r.reason ? `: “${r.reason}”` : ""}</span>
                    {!r.hidden && <HideNominationButton id={r.id} />}
                  </li>
                ))}</ul>
              </div>
            </div>
            {tally.length >= 3 && (
              <div className="mt-4 border-t pt-4">
                {fin.length > 0 && <p className="mb-2 text-sm text-brand-green">Finalistas atuais: {fin.map((f) => f.nickname ?? f.name).join(", ")}</p>}
                <FinalistsForm pollId={p.id} instagramUrl={p.instagramUrl}
                  options={tally.map((t) => ({ value: t.athleteId, label: `${t.nickname ?? t.name} (${t.total})` }))} />
              </div>
            )}
          </Panel>
        );
      }))}
    </div>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader title="Indicações" description="Torcedores indicam atletas no site; você escolhe 3 finalistas para a votação no Instagram." />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-card" />}><Polls /></Suspense>
    </>
  );
}
