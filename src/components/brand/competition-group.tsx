import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TeamCrest } from "./team-crest";

/** Cabeçalho de grupo de partidas por competição (faixa verde escura). */
export function CompetitionGroup({
  name,
  subtitle,
  href,
  children,
  logoUrl,
}: {
  logoUrl?: string | null;
  name: string;
  subtitle?: string;
  href?: string;
  children: React.ReactNode;
}) {
  const header = (
    <div className="flex items-center gap-2 bg-surface-2 px-3 py-2">
      {logoUrl ? <TeamCrest name={name} src={logoUrl} size={22} /> : <span aria-hidden className="h-4 w-1 rounded-full bg-brand-green" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold uppercase tracking-wide">{name}</span>
        {subtitle && <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>}
      </span>
      {href && <ChevronRight className="size-4 text-muted-foreground" aria-hidden />}
    </div>
  );
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      {href ? <Link href={href}>{header}</Link> : header}
      <div>{children}</div>
    </section>
  );
}
