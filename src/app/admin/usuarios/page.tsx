import { Suspense } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { UserRowActions } from "@/components/admin/user-row-actions";
import { ROLES, type Role } from "@/db/schema/enums";
import { listUsers } from "@/domain/users/queries";
import { ROLE_LABEL, checkBanChange, checkRoleChange } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/datetime";

export const metadata = { title: "Usuários" };

type Search = { q?: string; perfil?: string };

async function UsersTable({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await requirePermission("users.view", "/admin/usuarios");
  const sp = await searchParams;
  const role = (ROLES as readonly string[]).includes(sp.perfil ?? "") ? (sp.perfil as Role) : undefined;
  const rows = await listUsers({ organizationId: actor.organizationId, search: sp.q?.slice(0, 80), role });
  // ownerCount alto aqui: a checagem de "último proprietário" é refeita no servidor ao salvar.
  const assignable = (targetId: string, targetRole: Role) =>
    ROLES.filter(
      (r) =>
        r === targetRole ||
        !checkRoleChange({ actorId: actor.id, actorRole: actor.role, targetId, targetRole, newRole: r, ownerCount: 2 }),
    );

  return (
    <>
      <form className="mb-3 flex flex-wrap gap-2" role="search">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Buscar por nome ou e-mail"
          className="h-9 min-w-56 flex-1 rounded-lg border bg-card px-3 text-sm"
        />
        <select name="perfil" defaultValue={role ?? ""} className="h-9 rounded-lg border bg-card px-2 text-sm" aria-label="Perfil">
          <option value="">Todos os perfis</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
        <button className="h-9 rounded-lg border px-4 text-sm font-semibold">Filtrar</button>
      </form>

      <div className="overflow-hidden rounded-xl border bg-card">
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((u) => {
              const roles = assignable(u.id, u.role);
              const canBan = !checkBanChange({ actorId: actor.id, actorRole: actor.role, targetId: u.id, targetRole: u.role });
              return (
                <li key={u.id} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {u.name}
                      {u.id === actor.id && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.email} • {ROLE_LABEL[u.role]} • desde {formatDateTime(u.createdAt)}
                      {u.banned && <span className="ml-2 font-bold text-destructive">BLOQUEADO</span>}
                    </p>
                  </div>
                  {u.id !== actor.id && (
                    <UserRowActions
                      userId={u.id}
                      role={u.role}
                      banned={u.banned}
                      assignableRoles={roles.length > 1 ? roles : []}
                      canBan={canBan}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

export default function Page(props: PageProps<"/admin/usuarios">) {
  return (
    <>
      <PageHeader
        title="Usuários"
        description="Gerencie perfis de acesso. Operadores são criados promovendo uma conta cadastrada."
      />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-card" />}>
        <UsersTable searchParams={props.searchParams as Promise<Search>} />
      </Suspense>
    </>
  );
}
