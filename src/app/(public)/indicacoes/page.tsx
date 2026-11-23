import { Suspense } from "react";
import { LoginToNominate, NominationForm } from "@/components/engagement/public-forms";
import { eligibleAthletes, finalists, listPolls, myNomination } from "@/domain/engagement/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { requestNow } from "@/lib/clock-now";
import { formatDateTime } from "@/lib/datetime";

export const metadata = { title: "Indicações" };

async function Polls() {
  const now = await requestNow();
  const [polls, me] = await Promise.all([listPolls(), getCurrentUser()]);
  const visible = polls.filter((p) => p.status !== "CLOSED");
  if (visible.length === 0) return <p className="rounded-xl border border-dashed bg-card/60 p-8 text-center text-sm text-muted-foreground">Nenhuma indicação aberta no momento.</p>;
  return (
    <div className="space-y-4">
      {await Promise.all(visible.map(async (poll) => {
        const open = poll.status === "OPEN" && (!poll.closesAt || poll.closesAt.getTime() > now);
        const [list, mine, fin] = await Promise.all([
          open ? eligibleAthletes(poll.competitionId) : Promise.resolve([]),
          me ? myNomination(poll.id, me.id) : Promise.resolve(null),
          poll.status === "FINALISTS" ? finalists(poll.id) : Promise.resolve([]),
        ]);
        return (
          <section key={poll.id} className="space-y-3 rounded-2xl border bg-card p-5">
            <div>
              <h2 className="text-2xl font-extrabold uppercase">{poll.title}</h2>
              {poll.description && <p className="text-sm text-muted-foreground">{poll.description}</p>}
              {open && poll.closesAt && <p className="mt-1 text-xs text-muted-foreground">Indicações até {formatDateTime(poll.closesAt)}</p>}
            </div>
            {poll.status === "FINALISTS" ? (
              <>
                <ol className="grid gap-2 sm:grid-cols-3">
                  {fin.map((f) => (
                    <li key={f.athleteId} className="rounded-xl border border-brand-green/40 bg-background p-4 text-center">
                      <p className="font-display text-2xl font-extrabold text-brand-green">{f.position}º</p>
                      <p className="font-semibold">{f.nickname ?? f.name}</p>
                      <p className="text-xs text-muted-foreground">{f.teamName}</p>
                    </li>
                  ))}
                </ol>
                {poll.instagramUrl && <a href={poll.instagramUrl} target="_blank" rel="noopener" className="block rounded-lg bg-brand-green py-3 text-center font-bold text-primary-foreground">Votar no Instagram ↗</a>}
                <p className="text-xs text-muted-foreground">A votação final acontece no Instagram e não altera as estatísticas oficiais.</p>
              </>
            ) : mine ? (
              <p className="rounded-lg bg-brand-deep px-4 py-3 text-sm text-brand-green">Sua indicação: <strong>{mine.athleteName}</strong>. A organização vai anunciar os 3 finalistas.</p>
            ) : !open ? (
              <p className="text-sm text-muted-foreground">Indicações encerradas. Aguarde os finalistas.</p>
            ) : me ? (
              <NominationForm pollId={poll.id} athletes={list.map((a) => ({ id: a.id, label: `${a.nickname ?? a.name}${a.teamName ? ` — ${a.teamName}` : ""}` }))} />
            ) : (
              <LoginToNominate />
            )}
          </section>
        );
      }))}
    </div>
  );
}

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 py-6 sm:px-4">
      <div>
        <h1 className="text-3xl font-extrabold uppercase">Indicações</h1>
        <p className="text-sm text-muted-foreground">Indique o destaque. A organização escolhe 3 finalistas para a votação no Instagram.</p>
      </div>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-card" />}><Polls /></Suspense>
    </div>
  );
}
