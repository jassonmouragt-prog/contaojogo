import { describe, expect, it } from "vitest";
import { formatClock, formatMatchDate, formatScore } from "@/lib/format";

describe("formatação", () => {
  it("formata cronômetro mm:ss", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(42 * 60_000 + 18_000)).toBe("42:18");
    expect(formatClock(92 * 60_000 + 5_999)).toBe("92:05");
    expect(formatClock(-500)).toBe("00:00");
  });

  it("formata data no fuso de São Paulo", () => {
    expect(formatMatchDate(new Date("2026-11-20T21:30:00.000Z"))).toBe("20 NOV • 18:30");
  });

  it("formata placar", () => {
    expect(formatScore(5, 0)).toBe("5 - 0");
  });
});

import { dayRange, toLocalDay } from "@/lib/format";

describe("datas da agenda", () => {
  it("usa o dia de São Paulo, não o UTC", () => {
    expect(toLocalDay(new Date("2026-11-23T02:30:00.000Z"))).toBe("2026-11-22");
  });
  it("gera faixa de dias ao redor de hoje", () => {
    expect(dayRange("2026-12-31", 1, 1)).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
  });
});
