import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Logo oficial para fundo escuro (bola em órbita + contaojogo.club). */
export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} aria-label="Conta o Jogo — página inicial" className={cn("inline-flex shrink-0 items-center", className)}>
      <Image src="/brand/logo-dark.png" alt="contaojogo.club — futebol contado em números" width={358} height={240} priority className="h-10 w-auto sm:h-11" />
    </Link>
  );
}
