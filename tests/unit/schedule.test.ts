import { describe, expect, it } from "vitest";
import { findScheduleConflicts, slotMinutesFor } from "@/domain/schedule/conflicts";
import { fromLocalInput, toLocalInput } from "@/lib/datetime";
import { slugify } from "@/lib/slug";

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 20, h, m));
const existing = [{ id: "m1", homeTeamId: "A", awayTeamId: "B", venueId: "V1", scheduledAt: at(21) }];
const slot = slotMinutesFor(45); // 125 min

describe("conflitos de agenda", () => {
  it("detecta equipe em dois jogos sobrepostos", () => {
    const c = findScheduleConflicts({ homeTeamId: "C", awayTeamId: "A", venueId: "V2", scheduledAt: at(22) }, existing, slot);
    expect(c).toEqual([{ kind: "team", teamId: "A", matchId: "m1" }]);
  });
  it("detecta local ocupado", () => {
    const c = findScheduleConflicts({ homeTeamId: "C", awayTeamId: "D", venueId: "V1", scheduledAt: at(22, 30) }, existing, slot);
    expect(c).toEqual([{ kind: "venue", venueId: "V1", matchId: "m1" }]);
  });
  it("aceita jogo depois do fim do slot", () => {
    expect(findScheduleConflicts({ homeTeamId: "A", awayTeamId: "C", venueId: "V1", scheduledAt: at(23, 5) }, existing, slot)).toEqual([]);
  });
  it("ignora o próprio jogo ao editar", () => {
    expect(findScheduleConflicts({ id: "m1", homeTeamId: "A", awayTeamId: "B", venueId: "V1", scheduledAt: at(21, 30) }, existing, slot)).toEqual([]);
  });
});

describe("utilitários", () => {
  it("gera slug sem acentos", () => {
    expect(slugify("Copa LIFAQUI 2026")).toBe("copa-lifaqui-2026");
    expect(slugify("  Borússia São José! ")).toBe("borussia-sao-jose");
  });
  it("converte horário de Brasília do input", () => {
    expect(fromLocalInput("2026-11-20T18:30")?.toISOString()).toBe("2026-11-20T21:30:00.000Z");
    expect(fromLocalInput("lixo")).toBeNull();
    expect(toLocalInput(new Date("2026-11-20T21:30:00.000Z"))).toBe("2026-11-20T18:30");
  });
});
