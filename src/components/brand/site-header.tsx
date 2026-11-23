import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";

/** Itens de navegação do portal (PDF, tela 03). */
export const PUBLIC_NAV = [
  { href: "/", label: "Jogos" },
  { href: "/campeonatos", label: "Campeonatos" },
  { href: "/ranking", label: "Ranking" },
  { href: "/noticias", label: "Notícias" },
  { href: "/indicacoes", label: "Indicações" },
  { href: "/suporte", label: "Suporte" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#030504]/90 backdrop-blur-xl">
      <div aria-hidden className="h-0.5 bg-gradient-to-r from-brand-green via-brand-lime to-brand-green" />
      <div className="mx-auto flex h-[72px] max-w-7xl sm:h-20 items-center gap-4 px-3 sm:px-4">
        <Logo />
        <nav aria-label="Principal" className="hidden items-center overflow-x-auto md:flex">
          <Suspense fallback={null}><NavLinks items={[...PUBLIC_NAV]} /></Suspense>
        </nav>
        <Link href="/entrar" className="ml-auto rounded-full bg-brand-green px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary-foreground shadow-[0_0_20px_-6px_var(--brand-green)] transition-transform hover:scale-[1.03]">
          Entrar
        </Link>
      </div>
    </header>
  );
}
