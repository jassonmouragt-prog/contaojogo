import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Organização dona dos dados. Inicialmente existe apenas uma (Conta o Jogo),
 * mas toda tabela de domínio referencia organization_id para permitir
 * isolamento futuro sem reescrever o schema.
 */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
