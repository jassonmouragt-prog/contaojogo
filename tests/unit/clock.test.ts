import { describe, expect, it } from "vitest";
import {
  ClockTransitionError,
  INITIAL_CLOCK,
  endPeriod,
  kickOff,
  setBallInPlay,
  snapshot,
} from "@/domain/match/clock";

const cfg = { periodMinutes: 45 };
const T0 = Date.UTC(2026, 10, 20, 21, 30);
const min = (m: number) => m * 60_000;
const sec = (s: number) => s * 1000;

describe("cronômetro da partida", () => {
  it("antes do início não corre", () => {
    const s = snapshot(INITIAL_CLOCK, T0 + min(10), cfg);
    expect(s).toMatchObject({ running: false, minute: null, totalMs: 0, label: "Pré-jogo" });
  });

  it("calcula o tempo apenas a partir dos timestamps persistidos", () => {
    const st = kickOff(INITIAL_CLOCK, T0);
    const s = snapshot(st, T0 + min(17) + sec(30), cfg);
    expect(s.rollingMs).toBe(min(17) + sec(30));
    expect(s.stoppedMs).toBe(0);
    expect(s.label).toBe("18'");
  });

  it("separa bola rolando e bola parada (valores da tela 09)", () => {
    let st = kickOff(INITIAL_CLOCK, T0);
    st = setBallInPlay(st, false, T0 + min(42) + sec(18));
    const s = snapshot(st, T0 + min(67), cfg);
    expect(s.rollingMs).toBe(min(42) + sec(18));
    expect(s.stoppedMs).toBe(min(24) + sec(42));
    expect(s.label).toBe("45+23'");
  });

  it("retomar soma segmentos corretamente e é idempotente", () => {
    let st = kickOff(INITIAL_CLOCK, T0);
    st = setBallInPlay(st, false, T0 + min(10));
    const again = setBallInPlay(st, false, T0 + min(11));
    expect(again).toEqual(st);
    st = setBallInPlay(st, true, T0 + min(12));
    const s = snapshot(st, T0 + min(20), cfg);
    expect(s.rollingMs).toBe(min(18));
    expect(s.stoppedMs).toBe(min(2));
  });

  it("mostra acréscimos e segundo tempo a partir de 46'", () => {
    let st = kickOff(INITIAL_CLOCK, T0);
    expect(snapshot(st, T0 + min(46) + sec(5), cfg).label).toBe("45+2'");
    st = endPeriod(st, T0 + min(47));
    expect(snapshot(st, T0 + min(55), cfg)).toMatchObject({ label: "Intervalo", running: false, totalMs: min(47) });
    st = kickOff(st, T0 + min(62));
    expect(snapshot(st, T0 + min(62), cfg).label).toBe("46'");
    expect(snapshot(st, T0 + min(62) + min(21), cfg).label).toBe("67'");
  });

  it("encerra a partida e congela o tempo", () => {
    let st = kickOff(INITIAL_CLOCK, T0);
    st = endPeriod(st, T0 + min(45));
    st = kickOff(st, T0 + min(60));
    st = endPeriod(st, T0 + min(106));
    const later = snapshot(st, T0 + min(500), cfg);
    expect(later).toMatchObject({ period: "FINISHED", label: "Encerrado", totalMs: min(46) });
  });

  it("ignora relógio do cliente atrasado em relação ao servidor", () => {
    const st = kickOff(INITIAL_CLOCK, T0);
    expect(snapshot(st, T0 - sec(3), cfg).totalMs).toBe(0);
  });

  it("rejeita transições inválidas", () => {
    expect(() => setBallInPlay(INITIAL_CLOCK, false, T0)).toThrow(ClockTransitionError);
    expect(() => endPeriod(INITIAL_CLOCK, T0)).toThrow(ClockTransitionError);
    const live = kickOff(INITIAL_CLOCK, T0);
    expect(() => kickOff(live, T0)).toThrow(ClockTransitionError);
  });

  it("respeita duração de futsal (20 min)", () => {
    const st = kickOff(INITIAL_CLOCK, T0);
    expect(snapshot(st, T0 + min(21), { periodMinutes: 20 }).label).toBe("20+2'");
  });
});
