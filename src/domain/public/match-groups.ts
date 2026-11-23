import "server-only";
import type { MatchCenterGroup } from "@/components/public/match-center";
import type { MatchListItem } from "@/domain/competitions/queries";
import { toMatchRow } from "@/domain/labels";
import { toLocalDay } from "@/lib/format";

/** Agrupa jogos por competição e dia (lista estilo Flashscore). */
export function groupMatchesForCenter(rows: MatchListItem[], now: number): MatchCenterGroup[] {
  const map = new Map<string, MatchCenterGroup>();
  for (const m of rows) {
    const day = toLocalDay(m.scheduledAt);
    const key = `${m.competitionId}|${day}`;
    let g = map.get(key);
    if (!g) {
      g = {
        competitionId: m.competitionId,
        competitionName: m.competitionName,
        subtitle: [m.phaseName, m.groupName].filter(Boolean).join(" • ") || undefined,
        href: `/campeonatos/${m.competitionSlug}`,
        day,
        matches: [],
      };
      map.set(key, g);
    }
    g.matches.push(toMatchRow(m, now, `/jogos/${m.id}`));
  }
  return [...map.values()];
}
