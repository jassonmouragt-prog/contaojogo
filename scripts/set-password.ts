/**
 * Define a senha de qualquer conta pelo terminal (inclusive proprietários).
 * Uso: npm run user:set-password -- --email pessoa@exemplo.com --password "nova-senha"
 * Encerra as sessões ativas da conta e registra auditoria (sem a senha).
 */
import "dotenv/config";
import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { Pool } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "../src/db/schema";

config({ path: ".env.local", override: false });

async function main() {
  const { values } = parseArgs({ options: { email: { type: "string" }, password: { type: "string" } } });
  const email = values.email?.trim().toLowerCase();
  const password = values.password;
  if (!email || !password || password.length < 8) throw new Error("Informe --email e --password (mín. 8 caracteres).");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente.");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool, schema, casing: "snake_case" });
  try {
    const [u] = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
    if (!u) throw new Error(`Conta não encontrada: ${email}`);
    const hash = await hashPassword(password);
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(schema.account)
        .set({ password: hash })
        .where(and(eq(schema.account.userId, u.id), eq(schema.account.providerId, "credential")))
        .returning({ id: schema.account.id });
      if (updated.length === 0) {
        await tx.insert(schema.account).values({ id: randomBytes(16).toString("hex"), accountId: u.id, providerId: "credential", userId: u.id, password: hash });
      }
      await tx.delete(schema.session).where(eq(schema.session.userId, u.id));
      await tx.insert(schema.auditLog).values({
        organizationId: u.organizationId,
        actorUserId: null,
        action: "user.password_set_cli",
        entityType: "user",
        entityId: u.id,
      });
    });
    console.log(`Senha atualizada: ${email}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
