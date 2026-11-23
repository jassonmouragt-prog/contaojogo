import { customType, index, integer, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organizations } from "./organizations";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/**
 * Imagens enviadas pelo painel (banners, logos, capas), já comprimidas em
 * WebP. Ficam no PostgreSQL (fonte única de verdade); servidas com cache
 * longo em /api/media/[id]. Pode migrar para R2 sem mudar as telas.
 */
export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  purpose: text("purpose").notNull(),
  mime: text("mime").notNull(),
  width: smallint("width").notNull(),
  height: smallint("height").notNull(),
  size: integer("size").notNull(),
  originalSize: integer("original_size").notNull(),
  data: bytea("data").notNull(),
  uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("media_org_idx").on(t.organizationId, t.createdAt)]);
