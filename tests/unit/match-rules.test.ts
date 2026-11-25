import { describe, expect, it } from "vitest";
import { canTransition, computeScore, validateStats } from "@/domain/match/rules";

describe("regras da partida", () => {
  it("calcula placar ignorando anulados e tratando gol contra", () => {
    const ev = [
      { type: "GOAL", teamId: "H", voided: false },
      { type: "GOAL", teamId: "H", voided: true },
      { type: "GOAL", teamId: "A", voided: false, ownGoal: true },
      { type: "YELLOW", teamId: "A", voided: false },
      { type: "GOAL", teamId: "A", voided: false },
    ];
    expect(computeScore(ev, "H", "A")).toEqual({ home: 2, away: 1 });
  });
  it("valida estatísticas", () => {
    expect(validateStats({ shots: 5, shotsOnTarget: 6, corners: 0, offsides: 0 }, 0)).toMatch(/Chutes no gol/);
    expect(validateStats({ shots: 5, shotsOnTarget: 1, corners: 0, offsides: 0 }, 2)).toMatch(/mais gols/);
    expect(validateStats({ shots: 11, shotsOnTarget: 6, corners: 5, offsides: 2 }, 2)).toBeNull();
  });
  it("restringe transições de status", () => {
    expect(canTransition("SCHEDULED", "LIVE")).toBe(true);
    expect(canTransition("SCHEDULED", "CONFIRMED")).toBe(false);
    expect(canTransition("FINISHED", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "LIVE")).toBe(false);
  });
});

import { clampClientTime, shouldApplyStats } from "@/domain/match/sync-rules";

describe("sincronização offline", () => {
  const now = 1_000_000_000;
  it("aceita horário do aparelho dentro do intervalo", () => {
    expect(clampClientTime(now - 60_000, now, now - 120_000)).toBe(now - 60_000);
  });
  it("não aceita horário no futuro nem antes do segmento atual", () => {
    expect(clampClientTime(now + 5_000, now, null)).toBe(now);
    expect(clampClientTime(now - 300_000, now, now - 120_000)).toBe(now - 120_000);
    expect(clampClientTime(Number.NaN, now, null)).toBe(now);
  });
  it("estatísticas mais antigas não sobrescrevem as mais novas", () => {
    expect(shouldApplyStats(2000, new Date(1000))).toBe(true);
    expect(shouldApplyStats(500, new Date(1000))).toBe(false);
    expect(shouldApplyStats(500, null)).toBe(true);
  });
});

import { accumulatedFouls, computePens, shootoutState } from "@/domain/match/rules";
describe("disputa de pênaltis e futsal", () => {
  const H = "h", A = "a";
  const k = (teamId: string, goal: boolean) => ({ type: goal ? "SHOOTOUT_GOAL" : "SHOOTOUT_MISS", teamId, voided: false });
  it("decide antes das 5 quando não dá mais para alcançar", () => {
    const ev = [k(H, true), k(A, false), k(H, true), k(A, false), k(H, true), k(A, false)];
    expect(shootoutState(ev, H, A).winner).toBe("home");
  });
  it("morte súbita após 5x5 empatado", () => {
    const five = Array.from({ length: 5 }, () => [k(H, true), k(A, true)]).flat();
    expect(shootoutState(five, H, A).winner).toBeNull();
    expect(shootoutState([...five, k(H, true), k(A, false)], H, A).winner).toBe("home");
    expect(computePens([...five, k(H, true), k(A, false)], H)).toEqual({ home: 6, away: 5 });
  });
  it("faltas acumuladas zeram por tempo", () => {
    const f = (period: string) => ({ type: "FOUL", teamId: H, voided: false, period });
    expect(accumulatedFouls([f("FIRST_HALF"), f("FIRST_HALF"), f("SECOND_HALF")], H, "FIRST_HALF")).toBe(2);
  });
});
