"use client";

/* eslint-disable @next/next/no-img-element */
import { ImagePlus, Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { uploadImage } from "@/domain/media/actions";

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Reduz no navegador antes de enviar (upload rápido no 4G); o servidor comprime de novo em WebP. */
async function preshrink(file: File, maxDim: number): Promise<Blob> {
  if (file.type === "image/gif") return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 1_500_000) { bmp.close(); return file; }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.9));
  return blob && blob.size < file.size ? blob : file;
}

export function ImageUpload({
  name,
  label,
  purpose,
  required,
  hint,
  aspect = "aspect-[16/6]",
}: {
  name: string;
  label: string;
  purpose: "BANNER" | "LOGO" | "COVER";
  required?: boolean;
  hint?: string;
  aspect?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const holder = useRef<HTMLDivElement>(null);

  // Quando o formulário é limpo (após publicar), a imagem anexada também é.
  useEffect(() => {
    const form = holder.current?.closest("form");
    if (!form) return;
    const clear = () => { setUrl(""); setInfo(null); setError(null); };
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, []);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError(null); setInfo(null);
    try {
      const blob = await preshrink(file, purpose === "LOGO" ? 1200 : 2400);
      const fd = new FormData();
      fd.set("file", new File([blob], "imagem", { type: blob.type || file.type }));
      fd.set("purpose", purpose);
      const r = await uploadImage(fd);
      if (!r.ok) { setError(r.message); return; }
      setUrl(r.url);
      setInfo(`${kb(file.size)} → ${kb(r.size)} • ${r.width}×${r.height}`);
    } catch {
      setError("Falha no envio. Tente de novo.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div ref={holder} className="space-y-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <input type="hidden" name={name} value={url} required={required} />
      <label
        htmlFor={id}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void onPick(e.dataTransfer.files[0]); }}
        className={`relative flex ${aspect} cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-background transition-colors hover:border-brand-amber/60 ${purpose === "LOGO" ? "max-w-56" : ""}`}
      >
        {url ? (
          <img src={url} alt="Pré-visualização" className={`size-full ${purpose === "LOGO" ? "bg-white object-contain p-2" : "object-cover"}`} />
        ) : (
          <span className="flex flex-col items-center gap-1 p-4 text-center text-xs text-muted-foreground">
            <ImagePlus className="size-6" />
            Toque para anexar ou arraste a imagem
          </span>
        )}
        {busy && <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-semibold text-white"><Loader2 className="mr-2 size-4 animate-spin" />Comprimindo…</span>}
      </label>
      <input ref={input} id={id} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" onChange={(e) => void onPick(e.target.files?.[0])} />
      {info && <p className="text-[11px] text-brand-green">Imagem otimizada: {info}</p>}
      {error && <p role="alert" className="text-[11px] text-destructive">{error}</p>}
      {!info && !error && hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
