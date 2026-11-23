import Image from "next/image";
import { cn } from "@/lib/utils";

/** Escudo da equipe; sem imagem cadastrada, mostra a inicial (como na tela 12 do PDF). */
export function TeamCrest({
  name,
  src,
  size = 20,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  if (src) {
    return (
      <Image src={src} alt="" width={size} height={size} className={cn("shrink-0 object-contain", className)} />
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-brand-deep font-bold text-brand-green",
        className,
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
