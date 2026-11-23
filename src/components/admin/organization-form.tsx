"use client";

import { ActionForm } from "@/components/admin/action-form";
import { updateOrganization } from "@/domain/organization/actions";

export function OrganizationForm({ name }: { name: string }) {
  return (
    <ActionForm action={updateOrganization} className="max-w-md space-y-2 rounded-xl border bg-card p-4">
      {(pending) => (
        <>
          <label htmlFor="name" className="text-sm font-semibold">Nome da organização</label>
          <input id="name" name="name" defaultValue={name} required minLength={2} maxLength={80}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm" />
          <button disabled={pending} className="h-9 rounded-lg bg-brand-amber px-4 text-sm font-bold text-black disabled:opacity-50">
            {pending ? "Salvando…" : "Salvar"}
          </button>
        </>
      )}
    </ActionForm>
  );
}
