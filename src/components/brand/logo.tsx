import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      aria-label="Conta o Jogo — página inicial"
      className={cn(
        "inline-flex h-11 items-center rounded-xl bg-white px-2.5 shadow-sm ring-1 ring-black/5",
        className,
      )}
    >
      <Image
        src="/brand/logo.jpg"
        alt="contaojogo.club"
        width={1050}
        height={720}
        priority
        className="h-9 w-auto object-contain"
      />
    </Link>
  );
}
