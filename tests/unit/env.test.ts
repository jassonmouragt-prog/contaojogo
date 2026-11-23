import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env";

describe("variáveis de ambiente", () => {
  it("aplica padrões", () => {
    const env = parseServerEnv({});
    expect(env.APP_TIMEZONE).toBe("America/Sao_Paulo");
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it("rejeita segredo curto e URL inválida sem expor valores", () => {
    expect(() =>
      parseServerEnv({ BETTER_AUTH_SECRET: "curto", DATABASE_URL: "nao-e-url" }),
    ).toThrow(/BETTER_AUTH_SECRET.*DATABASE_URL|DATABASE_URL.*BETTER_AUTH_SECRET/);
    try {
      parseServerEnv({ BETTER_AUTH_SECRET: "curto" });
    } catch (e) {
      expect(String(e)).not.toContain("curto");
    }
  });
});
