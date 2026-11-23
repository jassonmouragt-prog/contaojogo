import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { getServerEnv } from "@/lib/env";

export const DEFAULT_ORG_SLUG = "contaojogo";

function createAuth() {
  const env = getServerEnv();
  const db = getDb();
  return betterAuth({
    appName: "Conta o Jogo",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        twoFactor: schema.twoFactor,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      // Sem e-mail transacional: senhas esquecidas são redefinidas por um
      // administrador no painel (Usuários) ou via `npm run user:set-password`.
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },
    rateLimit: { enabled: true, window: 60, max: 30, storage: "memory" },
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "USER", input: false },
        organizationId: { type: "string", required: false, input: false },
        banned: { type: "boolean", required: false, defaultValue: false, input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const [org] = await db
              .select({ id: schema.organizations.id })
              .from(schema.organizations)
              .where(eq(schema.organizations.slug, DEFAULT_ORG_SLUG))
              .limit(1);
            return { data: { ...user, role: "USER", organizationId: org?.id ?? null } };
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const [u] = await db
              .select({ banned: schema.user.banned })
              .from(schema.user)
              .where(eq(schema.user.id, session.userId))
              .limit(1);
            if (u?.banned) {
              throw new APIError("FORBIDDEN", { message: "Conta bloqueada. Fale com a organização." });
            }
            return { data: session };
          },
        },
      },
    },
    plugins: [
      twoFactor({ issuer: "Conta o Jogo", backupCodeOptions: { amount: 8 } }),
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;
const globalForAuth = globalThis as unknown as { __auth?: Auth };

export function getAuth(): Auth {
  globalForAuth.__auth ??= createAuth();
  return globalForAuth.__auth;
}
