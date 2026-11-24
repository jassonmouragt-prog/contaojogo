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

const WHATSAPP_URL = "https://wa.me/5588999247743";

/** Botão flutuante do WhatsApp (contato do Conta o Jogo). */
export function FloatingWhatsApp() {
  return (
    <a href={WHATSAPP_URL} target="_blank" rel="noopener" aria-label="Falar no WhatsApp"
      className="fixed bottom-36 right-4 z-40 flex size-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/50 transition hover:scale-105 sm:bottom-6 sm:right-6 sm:size-14">
      <svg viewBox="0 0 24 24" className="size-7 sm:size-8" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
      </svg>
    </a>
  );
}
