import "server-only";
import { headers } from "next/headers";
import type { z } from "zod";
import type { CurrentUser } from "@/lib/auth/session";

export type ActionResult = { ok: boolean; message: string; id?: string } | null;

export function fail(message: string): ActionResult {
  return { ok: false, message };
}

export function requireOrg(actor: CurrentUser): string {
  if (!actor.organizationId) throw new Error("Conta sem organização vinculada.");
  return actor.organizationId;
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/** Converte FormData em objeto; campos vazios viram undefined. */
export function formObject(fd: FormData): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    out[k] = t === "" ? undefined : t;
  }
  return out;
}

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

/** Violação de unicidade do Postgres (23505). */
export function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

/** Imagem anexada no painel (/api/media/<id>) ou link https; vazio = sem imagem. */
export function imageRefOrNull(v: string | undefined): string | null | false {
  if (!v) return null;
  if (/^\/api\/media\/[0-9a-f-]{36}$/i.test(v) || /^https:\/\//.test(v)) return v;
  return false;
}
