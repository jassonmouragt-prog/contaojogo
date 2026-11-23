import { describe, expect, it } from "vitest";
import { computeScorers, computeStandings } from "@/domain/standings/compute";

const T = (id: string) => ({ id, name: id, slug: id, crestUrl: null, groupId: "g" });
const rules = { pointsWin: 3, pointsDraw: 1, pointsLoss: 0, tiebreakers: ["POINTS", "GOAL_DIFF", "GOALS_FOR", "HEAD_TO_HEAD"] as never };
const M = (homeId: string, homeScore: number, awayScore: number, awayId: string) => ({ homeId, awayId, homeScore, awayScore });

describe("classificação", () => {
  it("soma pontos, saldo e jogos", () => {
    const s = computeStandings([T("Mulungu"), T("Tricolor"), T("Cruzeiro")], [M("Mulungu", 5, 0, "Tricolor"), M("Cruzeiro", 1, 1, "Tricolor")], rules);
    expect(s.map((r) => [r.name, r.points, r.goalDiff, r.played])).toEqual([
      ["Mulungu", 3, 5, 1],
      ["Cruzeiro", 1, 0, 1],
      ["Tricolor", 1, -5, 2],
    ]);
    expect(s[0].position).toBe(1);
  });

  it("desempata por confronto direto quando pontos, saldo e gols pró empatam", () => {
    // A e B: 3 pts, SG 0, GP 2. A venceu B.
    const ms = [M("A", 2, 1, "B"), M("B", 1, 0, "C"), M("C", 1, 0, "A")];
    const s = computeStandings([T("A"), T("B"), T("C")], ms, rules);
    expect(s.every((r) => r.points === 3)).toBe(true);
    // Todos empatados também no confronto direto entre os três → ordem alfabética estável
    expect(s.map((r) => r.name)).toEqual(["A", "B", "C"]);
    const two = computeStandings([T("A"), T("B")], [M("A", 1, 0, "B"), M("B", 1, 0, "A"), M("A", 2, 2, "B")], { ...rules, tiebreakers: ["POINTS", "HEAD_TO_HEAD"] as never });
    expect(two.map((r) => r.points)).toEqual([4, 4]);
  });

  it("aplica critério de menos cartões", () => {
    const s = computeStandings([T("A"), T("B")], [M("A", 1, 1, "B")], { ...rules, tiebreakers: ["POINTS", "FEWEST_CARDS"] as never }, new Map([["A", 4], ["B", 1]]));
    expect(s[0].name).toBe("B");
  });

  it("artilharia ignora gol contra e conta assistências", () => {
    const names = new Map([["p", { name: "Pedro Lima", teamName: "Mulungu" }], ["r", { name: "Ryan", teamName: "Gaspar" }], ["j", { name: "João Vitor", teamName: "Mulungu" }]]);
    const r = computeScorers([
      { athleteId: "r", name: "", teamName: "", type: "GOAL" },
      { athleteId: "r", name: "", teamName: "", type: "GOAL" },
      { athleteId: "p", name: "", teamName: "", type: "GOAL", assistAthleteId: "j" },
      { athleteId: "p", name: "", teamName: "", type: "GOAL", ownGoal: true },
      { athleteId: "j", name: "", teamName: "", type: "YELLOW" },
    ], names);
    expect(r.map((x) => [x.name, x.goals, x.assists])).toEqual([["Ryan", 2, 0], ["Pedro Lima", 1, 0], ["João Vitor", 0, 1]]);
  });
});
