"use client";

import { CalendarDays, Trophy, UserRound, BarChart3 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Jogos", icon: CalendarDays, match: (p: string) => p === "/" || p.startsWith("/jogos") },
  { href: "/campeonatos", label: "Campeonatos", icon: Trophy, match: (p: string) => p.startsWith("/campeonatos") || p.startsWith("/equipes") },
  { href: "/ranking", label: "Ranking", icon: BarChart3, match: (p: string) => p.startsWith("/ranking") },
  { href: "/entrar", label: "Entrar", icon: UserRound, match: (p: string) => p.startsWith("/entrar") },
];

/** Barra inferior no celular, herdada do site antigo do Conta o Jogo. */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação rápida" className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-green/25 bg-[#030504]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      <ul className="grid grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold", active ? "text-brand-green" : "text-muted-foreground")}>
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Botão flutuante de suporte no celular (PDF p.16), leva a página atual junto. */
export function FloatingSupport() {
  const pathname = usePathname();
  if (pathname.startsWith("/suporte")) return null;
  return (
    <Link href={`/suporte?pagina=${encodeURIComponent(pathname)}`} aria-label="Suporte"
      className="fixed bottom-20 right-4 z-40 flex size-12 items-center justify-center rounded-full bg-brand-green text-xl font-black text-primary-foreground shadow-lg shadow-black/50 sm:hidden">?</Link>
  );
}
