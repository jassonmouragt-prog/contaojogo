import { notFound } from "next/navigation";
import { ClockCard } from "@/components/brand/clock-card";
import { Logo } from "@/components/brand/logo";
import { MatchCard } from "@/components/brand/match-card";
import { Scoreboard } from "@/components/brand/scoreboard";
import { SectionHeading } from "@/components/brand/section-heading";
import { StatCompare } from "@/components/brand/stat-compare";
import { StatusPill } from "@/components/brand/status-pill";
import { Button } from "@/components/ui/button";
import { CompetitionGroup } from "@/components/brand/competition-group";
import { MatchRow } from "@/components/brand/match-row";

export const metadata = { title: "Design system", robots: { index: false } };

/**
 * Catálogo do design system — disponível apenas em desenvolvimento.
 * Os valores abaixo são exemplos visuais do PDF, não dados de produção.
 */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const sample = new Date("2026-11-20T21:30:00.000Z");
  return (
    <main className="mx-auto max-w-5xl space-y-12 px-4 py-10">
      <SectionHeading eyebrow="Conta o Jogo" title="Design system" description="Somente desenvolvimento." />

      <section className="space-y-3">
        <h3 className="text-lg font-bold">Marca e paleta</h3>
        <Logo />
        <div className="flex flex-wrap gap-3">
          {["bg-background border", "bg-brand-green", "bg-brand-lime", "bg-brand-amber", "bg-brand-blue", "bg-brand-live", "bg-white"].map((c) => (
            <div key={c} className={`size-12 rounded-full ${c}`} title={c} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-bold">Status</h3>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="live">Ao vivo • 67&apos;</StatusPill>
          <StatusPill tone="finished">Finalizado</StatusPill>
          <StatusPill tone="scheduled">Em breve</StatusPill>
          <StatusPill tone="public">Público</StatusPill>
          <StatusPill tone="admin">Admin</StatusPill>
        </div>
      </section>

      <section className="space-y-3 rounded-3xl border bg-card p-5">
        <Scoreboard homeName="Mulungu" awayName="Gaspar" homeScore={2} awayScore={1} scorers="Ryan 18' • João 51'" />
        <div className="grid gap-3 sm:grid-cols-3">
          <ClockCard label="Bola rolando" value="42:18" />
          <ClockCard label="Bola parada" value="24:42" tone="amber" />
          <ClockCard label="Atualização" value="agora" tone="blue" />
        </div>
        <div className="space-y-3 pt-2">
          <StatCompare label="Finalizações" home={11} away={8} />
          <StatCompare label="No gol" home={6} away={4} />
          <StatCompare label="Escanteios" home={5} away={3} />
        </div>
      </section>

      <section className="max-w-xl space-y-3">
        <h3 className="text-lg font-bold">Lista de jogos (estilo Flashscore/Sofascore)</h3>
        <CompetitionGroup name="Copa LIFAQUI 2026" subtitle="Quartas de final" href="#">
          <MatchRow match={{ id: "1", status: "live", kickoffTime: "18:30", liveLabel: "67'", home: { name: "Mulungu", score: 2 }, away: { name: "Gaspar", score: 1 } }} />
          <MatchRow match={{ id: "2", status: "halftime", kickoffTime: "19:00", home: { name: "Antonico", score: 0 }, away: { name: "Borússia", score: 0 } }} />
          <MatchRow match={{ id: "3", status: "finished", kickoffTime: "16:00", home: { name: "Mulungu", score: 5 }, away: { name: "Tricolor", score: 0 } }} />
          <MatchRow match={{ id: "4", status: "scheduled", kickoffTime: "21:15", home: { name: "União" }, away: { name: "Ajax" } }} />
        </CompetitionGroup>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <MatchCard homeName="Mulungu" awayName="Gaspar" kickoffAt={sample} status="scheduled" venue="Arena Souzão" />
        <MatchCard homeName="Mulungu" awayName="Gaspar" kickoffAt={sample} status="live" liveLabel="67'" homeScore={2} awayScore={1} />
        <MatchCard homeName="Mulungu" awayName="Tricolor" kickoffAt={sample} status="finished" homeScore={5} awayScore={0} />
      </section>

      <section className="flex flex-wrap gap-3">
        <Button>Ação principal</Button>
        <Button variant="outline">Secundária</Button>
        <Button variant="destructive">Desfazer</Button>
      </section>
    </main>
  );
}
