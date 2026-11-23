import { Suspense } from "react";
import { AdminNav, type AdminNavItem } from "@/components/admin/admin-nav";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { Logo } from "@/components/brand/logo";
import { StatusPill } from "@/components/brand/status-pill";
import { ROLE_LABEL, can, type Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";

export const metadata = { title: { default: "Painel", template: "%s • Admin Conta o Jogo" }, robots: { index: false } };

const NAV: (AdminNavItem & { permission: Permission })[] = [
  { href: "/admin", label: "Painel", permission: "dashboard.view" },
  { href: "/admin/jogos", label: "Agenda", permission: "dashboard.view" },
  { href: "/admin/competicoes", label: "Competições", permission: "competition.manage" },
  { href: "/admin/equipes", label: "Equipes", permission: "competition.manage" },
  { href: "/admin/locais", label: "Locais", permission: "competition.manage" },
  { href: "/admin/banners", label: "Banners do topo", permission: "content.manage" },
  { href: "/admin/patrocinadores", label: "Patrocinadores", permission: "content.manage" },
  { href: "/admin/conteudo", label: "Conteúdo", permission: "content.manage" },
  { href: "/admin/indicacoes", label: "Indicações", permission: "content.manage" },
  { href: "/admin/suporte", label: "Suporte", permission: "content.manage" },
  { href: "/admin/usuarios", label: "Usuários", permission: "users.view" },
  { href: "/admin/auditoria", label: "Auditoria", permission: "audit.view" },
  { href: "/admin/configuracoes", label: "Configurações", permission: "settings.manage" },
  { href: "/admin/conta", label: "Minha conta", permission: "admin.access" },
];

async function AdminShell({ children }: { children: React.ReactNode }) {
  const user = await requirePermission("admin.access");
  const items = NAV.filter((i) => can(user.role, i.permission)).map(({ href, label }) => ({ href, label }));
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-brand-amber/30 bg-[#030504]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:px-4">
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
      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <AdminNav items={items} />
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
