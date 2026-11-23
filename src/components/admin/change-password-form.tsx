"use client";

import { useState } from "react";
import { FormError, FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const newPassword = String(fd.get("newPassword"));
    setDone(false);
    if (newPassword.length < 8) return setError("A nova senha precisa ter pelo menos 8 caracteres.");
    if (newPassword !== String(fd.get("confirm"))) return setError("As senhas não conferem.");
    setPending(true);
    setError(null);
    const { error } = await authClient.changePassword({
      currentPassword: String(fd.get("currentPassword")),
      newPassword,
      revokeOtherSessions: true,
    });
    setPending(false);
    if (error) return setError("Senha atual incorreta.");
    form.reset();
    setDone(true);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border bg-card p-4" noValidate>
      <h2 className="text-lg font-bold">Trocar senha</h2>
      <FormField id="currentPassword" label="Senha atual" type="password" autoComplete="current-password" required />
      <FormField id="newPassword" label="Nova senha" type="password" autoComplete="new-password" required minLength={8} />
      <FormField id="confirm" label="Confirmar nova senha" type="password" autoComplete="new-password" required />
      <FormError message={error} />
      {done && <p role="status" className="text-sm text-brand-green">Senha alterada. Outras sessões foram encerradas.</p>}
      <Button type="submit" disabled={pending} className="bg-brand-amber font-bold text-black hover:bg-brand-amber/85">
        {pending ? "Salvando…" : "Salvar nova senha"}
      </Button>
    </form>
  );
}
