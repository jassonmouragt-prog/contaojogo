"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <>
      {items.map((item) => {
        const active = item.href === "/" ? path === "/" || path.startsWith("/jogos") : path.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
            className={cn("relative shrink-0 px-3 py-4 text-[13px] font-bold uppercase tracking-wide transition-colors",
              active ? "text-brand-green after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-green" : "text-foreground/70 hover:text-foreground")}>
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
