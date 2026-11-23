import Link from "next/link";
import { Logo } from "./logo";

/**
 * Itens de navegação do portal (PDF, tela 03). Cada item só é exibido quando
 * a rota correspondente existir, evitando links decorativos.
 */
export const PUBLIC_NAV = [
  { href: "/", label: "Jogos", available: true },
  { href: "/campeonatos", label: "Campeonatos", available: true },
  { href: "/ranking", label: "Ranking", available: true },
  { href: "/noticias", label: "Notícias", available: true },
  { href: "/indicacoes", label: "Indicações", available: true },
  { href: "/suporte", label: "Suporte", available: true },
] as const;

export function SiteHeader() {
  const items = PUBLIC_NAV.filter((i) => i.available);
  return (
    <header className="sticky top-0 z-40 border-b border-brand-green/25 bg-[#030504]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-3 sm:px-4">
        <Logo />
        <nav aria-label="Principal" className="flex items-center gap-1 overflow-x-auto text-sm">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-foreground/80 transition-colors hover:bg-brand-deep hover:text-brand-green"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/entrar"
          className="ml-auto rounded-full border border-brand-green/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-green hover:bg-brand-deep"
        >
          Entrar
        </Link>
      </div>
      <div aria-hidden className="h-px bg-gradient-to-r from-transparent via-brand-green/60 to-transparent" />
    </header>
  );
}
