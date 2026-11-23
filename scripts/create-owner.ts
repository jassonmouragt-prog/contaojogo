/**
 * Cria (ou promove) a conta do proprietário.
 * Uso: npm run owner:create -- --email dono@exemplo.com --name "Nome" [--password "..."]
 * Sem --password, a senha é lida da variável OWNER_PASSWORD.
 */
import "dotenv/config";
import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { Pool } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "../src/db/schema";

config({ path: ".env.local", override: false });

async function main() {
  const { values } = parseArgs({
    options: { email: { type: "string" }, name: { type: "string" }, password: { type: "string" } },
  });
  const email = values.email?.trim().toLowerCase();
  const name = values.name?.trim();
  const password = values.password ?? process.env.OWNER_PASSWORD;
  if (!email || !name) throw new Error("Informe --email e --name.");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente.");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool, schema, casing: "snake_case" });
  try {
    const [org] = await db
      .insert(schema.organizations)
      .values({ slug: "contaojogo", name: "Conta o Jogo" })
      .onConflictDoUpdate({ target: schema.organizations.slug, set: { slug: "contaojogo" } })
      .returning({ id: schema.organizations.id });

    const [existing] = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
    if (existing) {
      await db.update(schema.user).set({ role: "OWNER", banned: false, organizationId: org.id }).where(eq(schema.user.id, existing.id));
      console.log(`Conta existente promovida a proprietário: ${email}`);
      return;
    }
    if (!password || password.length < 8) throw new Error("Senha ausente ou com menos de 8 caracteres.");

    const id = randomBytes(16).toString("hex");
    await db.transaction(async (tx) => {
      await tx.insert(schema.user).values({ id, name, email, emailVerified: true, role: "OWNER", organizationId: org.id });
      await tx.insert(schema.account).values({
        id: randomBytes(16).toString("hex"),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: await hashPassword(password),
      });
      await tx.insert(schema.auditLog).values({
        organizationId: org.id,
        actorUserId: null,
        action: "user.owner_bootstrapped",
        entityType: "user",
        entityId: id,
        after: { email, role: "OWNER" },
      });
    });
    console.log(`Proprietário criado: ${email}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
