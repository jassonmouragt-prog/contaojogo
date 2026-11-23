import { Suspense } from "react";
import { AdminNav, type AdminNavGroup, type IconKey } from "@/components/admin/admin-nav";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { Logo } from "@/components/brand/logo";
import { StatusPill } from "@/components/brand/status-pill";
import { ROLE_LABEL, can, type Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";

export const metadata = { title: { default: "Painel", template: "%s • Admin Conta o Jogo" }, robots: { index: false } };

type NavDef = { href: string; label: string; icon: IconKey; permission: Permission };
const NAV: { title: string; items: NavDef[] }[] = [
  { title: "Operação", items: [
    { href: "/admin", label: "Painel", icon: "gauge", permission: "dashboard.view" },
    { href: "/admin/jogos", label: "Agenda e operação", icon: "calendar", permission: "dashboard.view" },
  ] },
  { title: "Campeonatos", items: [
    { href: "/admin/competicoes", label: "Competições", icon: "trophy", permission: "competition.manage" },
    { href: "/admin/equipes", label: "Equipes e atletas", icon: "users", permission: "competition.manage" },
    { href: "/admin/locais", label: "Locais", icon: "pin", permission: "competition.manage" },
  ] },
  { title: "Portal", items: [
    { href: "/admin/banners", label: "Banners do topo", icon: "image", permission: "content.manage" },
    { href: "/admin/patrocinadores", label: "Patrocinadores", icon: "megaphone", permission: "content.manage" },
    { href: "/admin/conteudo", label: "Notícias e documentos", icon: "file", permission: "content.manage" },
    { href: "/admin/indicacoes", label: "Indicações", icon: "star", permission: "content.manage" },
  ] },
  { title: "Atendimento", items: [
    { href: "/admin/suporte", label: "Suporte", icon: "help", permission: "content.manage" },
  ] },
  { title: "Sistema", items: [
    { href: "/admin/usuarios", label: "Usuários", icon: "usercog", permission: "users.view" },
    { href: "/admin/auditoria", label: "Auditoria", icon: "shield", permission: "audit.view" },
    { href: "/admin/configuracoes", label: "Configurações", icon: "settings", permission: "settings.manage" },
    { href: "/admin/conta", label: "Minha conta", icon: "me", permission: "admin.access" },
  ] },
];

async function AdminShell({ children }: { children: React.ReactNode }) {
  const user = await requirePermission("admin.access");
  const groups: AdminNavGroup[] = NAV.map((g) => ({
    title: g.title,
    items: g.items.filter((i) => can(user.role, i.permission)).map(({ href, label, icon }) => ({ href, label, icon })),
  })).filter((g) => g.items.length > 0);
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#030504]/90 backdrop-blur-xl">
        <div aria-hidden className="h-0.5 bg-brand-amber" />
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-3 sm:px-4">
          <Logo href="/admin" />
          <StatusPill tone="admin">Admin</StatusPill>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">{user.name}</p>
              <p className="text-[11px] text-muted-foreground">{ROLE_LABEL[user.role]}</p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <AdminNav groups={groups} />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
