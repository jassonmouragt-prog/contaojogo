"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { FormError, FormField } from "./form-field";

export function TwoFactorVerifyForm({ next }: { next: string }) {
  const router = useRouter();
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const code = String(fd.get("code")).replace(/\s/g, "");
    const trustDevice = fd.get("trust") === "on";
    setPending(true);
    setError(null);
    const { error } = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice });
    setPending(false);
    if (error) {
      setError(error.status === 429 ? "Muitas tentativas. Aguarde alguns minutos." : "Código inválido ou expirado.");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <h1 className="text-2xl font-extrabold uppercase">Verificação</h1>
        <p className="text-sm text-muted-foreground">
          {useBackup ? "Digite um dos seus códigos de backup." : "Digite o código de 6 dígitos do seu app autenticador."}
        </p>
      </div>
      <FormField
        key={useBackup ? "backup" : "totp"}
        id="code"
        label={useBackup ? "Código de backup" : "Código"}
        inputMode={useBackup ? "text" : "numeric"}
        autoComplete="one-time-code"
        maxLength={useBackup ? 32 : 6}
        autoFocus
        required
      />
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" name="trust" className="accent-[var(--brand-green)]" /> Confiar neste dispositivo por 30 dias
      </label>
      <FormError message={error} />
      <Button type="submit" className="h-10 w-full font-bold" disabled={pending}>
        {pending ? "Verificando…" : "Verificar"}
      </Button>
      <button type="button" onClick={() => setUseBackup((v) => !v)} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
        {useBackup ? "Usar o app autenticador" : "Perdi o acesso ao app — usar código de backup"}
      </button>
    </form>
  );
}
