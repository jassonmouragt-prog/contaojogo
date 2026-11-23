import { pgEnum } from "drizzle-orm/pg-core";

export const ROLES = ["OWNER", "ADMIN", "OPERATOR", "USER"] as const;
export type Role = (typeof ROLES)[number];
export const roleEnum = pgEnum("role", ROLES);
