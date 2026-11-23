"use server";

import sharp, { type OutputInfo } from "sharp";
import { getDb } from "@/db";
import { media } from "@/db/schema";
import { recordAudit } from "@/domain/audit/record";
import { requireOrg } from "@/domain/shared/action-helpers";
import { authorizeAction } from "@/lib/auth/session";

export type UploadResult = { ok: true; url: string; size: number; originalSize: number; width: number; height: number } | { ok: false; message: string };

/** Tamanho máximo final por uso e qualidade WebP. */
const PRESETS = {
  BANNER: { width: 1920, height: 1080, quality: 72 },
  LOGO: { width: 600, height: 600, quality: 82 },
  COVER: { width: 1280, height: 960, quality: 72 },
  CREST: { width: 400, height: 400, quality: 82 },
  PHOTO: { width: 600, height: 800, quality: 72 },
} as const;
type Purpose = keyof typeof PRESETS;

const MAX_UPLOAD = 10 * 1024 * 1024;

/**
 * Recebe a imagem do painel, corrige rotação, reduz ao tamanho do uso,
 * remove metadados (EXIF/GPS) e converte para WebP. Guarda só o resultado.
 */
export async function uploadImage(fd: FormData): Promise<UploadResult> {
  const file = fd.get("file");
  const purpose = String(fd.get("purpose")) as Purpose;
  const actor = await authorizeAction(purpose === "CREST" || purpose === "PHOTO" ? "competition.manage" : "content.manage");
  const org = requireOrg(actor);

  if (!(file instanceof File)) return { ok: false, message: "Selecione uma imagem." };
  if (!(purpose in PRESETS)) return { ok: false, message: "Uso inválido." };
  if (file.size > MAX_UPLOAD) return { ok: false, message: "Imagem acima de 10 MB." };
  if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) return { ok: false, message: "Use JPG, PNG, WebP ou GIF." };

  const p = PRESETS[purpose];
  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 60_000_000, animated: false })
      .rotate()
      .resize({ width: p.width, height: p.height, fit: "inside", withoutEnlargement: true })
      .webp({ quality: p.quality, effort: 5, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });
  } catch {
    return { ok: false, message: "Não foi possível ler essa imagem." };
  }
  const [row] = await getDb()
    .insert(media)
    .values({ organizationId: org, purpose, mime: "image/webp", width: out.info.width, height: out.info.height, size: out.data.length, originalSize: file.size, data: out.data, uploadedBy: actor.id })
    .returning({ id: media.id });
  await recordAudit(getDb(), { organizationId: org, actorUserId: actor.id, action: "media.uploaded", entityType: "media", entityId: row.id, after: { purpose, size: out.data.length, originalSize: file.size } });
  return { ok: true, url: `/api/media/${row.id}`, size: out.data.length, originalSize: file.size, width: out.info.width, height: out.info.height };
}
