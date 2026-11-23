import { describe, expect, it } from "vitest";
import { toMatchRow } from "@/domain/labels";

const base = {
  id: "m", scheduledAt: new Date("2026-11-20T21:30:00Z"), homeScore: 1, awayScore: 0, ballInPlay: true,
  stoppedMs: 0, periodMinutes: 45, version: 7, homeName: "Mulungu", homeCrest: null, awayName: "Gaspar", awayCrest: null,
};

describe("linha ao vivo", () => {
  it("leva estado do cronômetro e versão para o cliente", () => {
    const start = Date.UTC(2026, 10, 20, 21, 30);
    const row = toMatchRow({ ...base, status: "LIVE", period: "FIRST_HALF", segmentStartedAt: new Date(start), rollingMs: 0 }, start + 17 * 60_000);
    expect(row.status).toBe("live");
    expect(row.liveLabel).toBe("18'");
    expect(row.version).toBe(7);
    expect(row.clock?.state.segmentStartedAt).toBe(start);
  });
  it("não envia relógio para jogo agendado", () => {
    const row = toMatchRow({ ...base, status: "SCHEDULED", period: "NOT_STARTED", segmentStartedAt: null, rollingMs: 0 }, Date.now());
    expect(row.clock).toBeUndefined();
    expect(row.kickoffTime).toBe("18:30");
  });
});
