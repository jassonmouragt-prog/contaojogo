/**
 * Barra comparativa mandante (verde) × visitante (azul), como na tela 09.
 */
export function StatCompare({
  label,
  home,
  away,
}: {
  label: string;
  home: number;
  away: number;
}) {
  const total = home + away;
  const homePct = total === 0 ? 50 : (home / total) * 100;
  return (
    <div className="grid grid-cols-[2rem_1fr_2rem] items-center gap-3">
      <span className="tabular text-right text-sm font-bold">{home}</span>
      <div>
        <p className="mb-1 text-center text-[11px] font-semibold text-muted-foreground">{label}</p>
        <div
          className="flex h-1.5 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`${label}: ${home} a ${away}`}
        >
          <div className="bg-brand-green" style={{ width: `${homePct}%` }} />
          <div className="flex-1 bg-brand-blue" />
        </div>
      </div>
      <span className="tabular text-sm font-bold">{away}</span>
    </div>
  );
}
