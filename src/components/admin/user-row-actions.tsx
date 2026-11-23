"use client";

import { ActionForm } from "@/components/admin/action-form";
import type { Role } from "@/db/schema/enums";
import { useState } from "react";
import { changeUserRole, resetUserPassword, setUserBanned } from "@/domain/users/actions";
import { ROLE_LABEL } from "@/lib/auth/permissions";

export function UserRowActions({
  userId,
  role,
  banned,
  assignableRoles,
  canBan,
}: {
  userId: string;
  role: Role;
  banned: boolean;
  assignableRoles: Role[];
  canBan: boolean;
}) {
  const [showReset, setShowReset] = useState(false);
  return (
    <div className="flex flex-wrap items-start gap-2">
      {assignableRoles.length > 0 && (
        <ActionForm action={changeUserRole} className="flex flex-col">
          {(pending) => (
            <div className="flex gap-1.5">
              <input type="hidden" name="userId" value={userId} />
              <select
                name="role"
                defaultValue={role}
                aria-label="Perfil"
                className="h-8 rounded-lg border bg-background px-2 text-xs"
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
              <button
                disabled={pending}
                className="h-8 rounded-lg bg-brand-amber px-3 text-xs font-bold text-black disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          )}
        </ActionForm>
      )}
      {canBan && (
        <ActionForm action={setUserBanned} className="flex flex-col">
          {(pending) => (
            <>
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="banned" value={banned ? "false" : "true"} />
              <button
                disabled={pending}
                className={
                  banned
                    ? "h-8 rounded-lg border border-brand-green/40 px-3 text-xs font-semibold text-brand-green"
                    : "h-8 rounded-lg border border-destructive/40 px-3 text-xs font-semibold text-destructive"
                }
              >
                {banned ? "Liberar acesso" : "Bloquear"}
              </button>
            </>
          )}
        </ActionForm>
      )}
      {canBan && (
        <button
          type="button"
          onClick={() => setShowReset((v) => !v)}
          aria-expanded={showReset}
          className="h-8 rounded-lg border px-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Redefinir senha
        </button>
      )}
      {canBan && showReset && (
        <ActionForm action={resetUserPassword} className="flex w-full flex-col">
          {(pending) => (
            <div className="flex gap-1.5">
              <input type="hidden" name="userId" value={userId} />
              <input
                name="password"
                type="text"
                minLength={8}
                maxLength={128}
                required
                autoComplete="off"
                placeholder="Nova senha (mín. 8)"
                aria-label="Nova senha"
                className="h-8 flex-1 rounded-lg border bg-background px-2 text-xs"
              />
              <button disabled={pending} className="h-8 rounded-lg bg-brand-amber px-3 text-xs font-bold text-black disabled:opacity-50">
                Definir
              </button>
            </div>
          )}
        </ActionForm>
      )}
    </div>
  );
}
