"use client";

import {
  BarChart3, CalendarDays, ClipboardList, FileText, Gauge, ImageIcon, LifeBuoy, MapPin, Megaphone, Menu, Settings, Shield, Star, Trophy, UserCog, Users, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const ICONS = {
  gauge: Gauge, calendar: CalendarDays, trophy: Trophy, users: Users, pin: MapPin, image: ImageIcon, megaphone: Megaphone,
  file: FileText, star: Star, help: LifeBuoy, usercog: UserCog, shield: ClipboardList, settings: Settings, me: Shield, chart: BarChart3,
} as const;
export type IconKey = keyof typeof ICONS;
export type AdminNavItem = { href: string; label: string; icon: IconKey };
export type AdminNavGroup = { title: string; items: AdminNavItem[] };

function Links({ groups, onNavigate }: { groups: AdminNavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Administração" className="space-y-5">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                    className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                      active ? "bg-brand-amber text-black" : "text-foreground/75 hover:bg-card hover:text-foreground")}>
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminNav({ groups }: { groups: AdminNavGroup[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = groups.flatMap((g) => g.items).find((i) => (i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href)));
  return (
    <>
      <div className="hidden lg:block"><Links groups={groups} /></div>
      <div className="lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm font-semibold">
          <Menu className="size-4" /> {current?.label ?? "Menu"}
        </button>
        {open && (
          <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Menu do admin">
            <button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
            <div className="relative h-full w-72 overflow-y-auto border-r bg-background p-4 animate-in slide-in-from-left">
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="mb-4 ml-auto flex rounded-md p-1 hover:bg-card"><X className="size-5" /></button>
              <Links groups={groups} onNavigate={() => setOpen(false)} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
