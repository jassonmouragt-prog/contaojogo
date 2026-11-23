import "server-only";
import { z } from "zod";

/**
 * Variáveis de ambiente do servidor, validadas sob demanda.
 * Itens opcionais pertencem a fases futuras (R2, realtime) e são exigidos
 * apenas pelos módulos que os usam.
 */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.url().optional(),
  APP_TIMEZONE: z.string().default("America/Sao_Paulo"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.url().optional(),
  ABLY_API_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Variáveis de ambiente inválidas: ${fields}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

export function requireEnv<K extends keyof ServerEnv>(key: K): NonNullable<ServerEnv[K]> {
  const value = getServerEnv()[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(`Variável de ambiente obrigatória ausente: ${String(key)}`);
  }
  return value as NonNullable<ServerEnv[K]>;
}
