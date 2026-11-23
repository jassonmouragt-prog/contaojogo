import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("limite de taxa", () => {
  it("bloqueia após o limite e libera depois da janela", () => {
    const k = `t-${Math.random()}`;
    expect([1, 2, 3].map((i) => rateLimit(k, 3, 1000, i))).toEqual([true, true, true]);
    expect(rateLimit(k, 3, 1000, 10)).toBe(false);
    expect(rateLimit(k, 3, 1000, 1500)).toBe(true);
  });
});
